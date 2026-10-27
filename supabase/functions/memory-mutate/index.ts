import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MemoryItem {
  id: string;
  content: string;
  kind: string;
  scope: string;
  status: string;
  importance: number;
  source: string;
  version: number;
  companion_id: string | null;
  created_at: string;
  updated_at: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { action } = body;

    // LIST — read memory_items for this user (RLS already allows SELECT)
    if (action === "list") {
      const { companionId } = body;
      let query = admin
        .from("memory_items")
        .select("id, content, kind, scope, status, importance, source, version, companion_id, created_at, updated_at")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(200);

      if (companionId) {
        query = query.eq("companion_id", companionId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ items: data as MemoryItem[] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // REMOVED — memories retired in the last 30 days, so a wrong retirement can be undone. Forgotten and cleared rows
    // are scrubbed placeholders and expired temporary states are not "removed", so neither is listed.
    if (action === "removed") {
      const { companionId } = body;
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      let query = admin
        .from("memory_items")
        .select("id, content, kind, scope, status, importance, source, version, companion_id, created_at, updated_at")
        .eq("user_id", user.id)
        .eq("status", "retired")
        .gte("updated_at", since)
        .not("content", "like", "[%")
        .or(`valid_until.is.null,valid_until.gt.${new Date().toISOString()}`)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (companionId) query = query.eq("companion_id", companionId);
      const { data, error } = await query;
      if (error) throw error;
      return new Response(JSON.stringify({ items: data as MemoryItem[] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // RESTORE — undo a retirement or supersede (30-day window, see restore_memory_item).
    if (action === "restore") {
      const { id } = body;
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: outcome, error } = await admin.rpc("restore_memory_item", { p_id: id, p_user_id: user.id });
      if (error) throw error;
      const ok = outcome === "restored";
      return new Response(JSON.stringify({ success: ok, outcome }), {
        status: ok ? 200 : outcome === "not_found" ? 404 : 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // EDIT — update content via optimistic-concurrency RPC
    if (action === "edit") {
      const { id, content, baseVersion } = body;
      if (!id || !content || typeof baseVersion !== "number") {
        return new Response(JSON.stringify({ error: "Missing id, content, or baseVersion" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // The RPC trusts the service role, so ownership is checked here.
      const { data: owned } = await admin
        .from("memory_items")
        .select("id, companion_id, shared_origin_companion_id")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!owned) {
        return new Response(JSON.stringify({ error: "Memory not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: result, error } = await admin.rpc("update_memory_item", {
        p_id: id,
        p_base_version: baseVersion,
        // Text the user wrote themselves is the most trusted memory there is.
        p_patch: { content, source: "user_edited", confidence: 1 },
        p_actor_type: "user",
      });

      if (error) throw error;

      // Log a memory_event for the edit (events need a companion; a shared
      // memory is attributed to the companion that first heard it)
      const eventCompanion = owned.companion_id ?? owned.shared_origin_companion_id ?? body.companionId ?? null;
      if (eventCompanion) {
        await admin.from("memory_events").insert({
          user_id: user.id,
          companion_id: eventCompanion,
          memory_item_id: id,
          event_type: "correction",
          payload: { action: "user_edit", new_content: content },
        }).then(() => {}, () => {});
      }

      if (!result) {
        return new Response(JSON.stringify({ error: "Version conflict — someone else edited this memory. Please refresh." }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // FORGET — retire the memory and scrub its text from every copy: earlier
    // versions, history, events, proposals and the companion summary.
    if (action === "forget") {
      const { id } = body;
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: item } = await admin
        .from("memory_items")
        .select("id, companion_id, shared_origin_companion_id")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!item) {
        return new Response(JSON.stringify({ error: "Memory not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await admin.rpc("forget_memory_item", { p_id: id, p_user_id: user.id });
      if (error) throw error;

      const eventCompanion = item.companion_id ?? item.shared_origin_companion_id ?? body.companionId ?? null;
      if (eventCompanion) {
        await admin.from("memory_events").insert({
          user_id: user.id,
          companion_id: eventCompanion,
          memory_item_id: id,
          event_type: "correction",
          payload: { action: "user_forgot" },
        }).then(() => {}, () => {});
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CLEAR — forget everything every companion remembers about this user.
    if (action === "clear") {
      const { data: cleared, error } = await admin.rpc("clear_user_memory", { p_user_id: user.id });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, cleared: cleared ?? 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PIN (set importance to 10)
    if (action === "pin") {
      const { id, pinned } = body;
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: item } = await admin
        .from("memory_items")
        .select("id, version")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!item) {
        return new Response(JSON.stringify({ error: "Memory not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await admin.rpc("update_memory_item", {
        p_id: id,
        p_base_version: item.version,
        p_patch: { importance: pinned ? 10 : 5 },
        p_actor_type: "user",
      });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[memory-mutate] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
