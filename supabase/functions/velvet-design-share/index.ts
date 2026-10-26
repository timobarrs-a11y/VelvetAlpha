import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { moderateInput } from "../_shared/moderation.ts";

// Publishes a Velvet Sims garment design (its share code) for friends or for the public gallery.
// The name is checked with the app's moderation first; the database function does the rest of the checking
// and the limits. A public design waits for a moderator before it shows in the gallery.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const CODE = /^VH-[0-9A-Z]{4}(-[0-9A-Z]{1,5})+$/;
const KNOWN_ERRORS = ["bad_visibility", "bad_name", "bad_code", "banned", "too_many", "slow_down"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    if (req.method !== "POST") return json({ error: "bad_request" }, 405);
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "unauthorized" }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 24) : "";
    const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
    const visibility = body?.visibility;
    if (!name || !CODE.test(code) || code.length > 700 || !["private", "friends", "public"].includes(visibility)) {
      return json({ error: "bad_request" }, 400);
    }

    // What others will read is the name (the rest is a recipe the game checks again when it loads it).
    const verdict = await moderateInput(supabase, Deno.env.get("ANTHROPIC_API_KEY") ?? "", user.id, name);
    if (verdict.action === "block") return json({ error: "blocked" }, 403);

    const { data, error } = await supabase.rpc("velvet_design_publish", { p_owner: user.id, p_name: name, p_code: code, p_visibility: visibility });
    if (error) {
      const known = KNOWN_ERRORS.find((k) => String(error.message ?? "").includes(k));
      if (known) return json({ error: known }, known === "banned" ? 403 : known === "slow_down" || known === "too_many" ? 429 : 400);
      console.error("velvet-design-share publish failed", error.message);
      return json({ error: "unavailable" }, 500);
    }
    const row = Array.isArray(data) ? data[0] : data;
    return json({ id: row?.id, status: row?.status });
  } catch (err) {
    console.error("velvet-design-share error", err);
    return json({ error: "unavailable" }, 500);
  }
});
