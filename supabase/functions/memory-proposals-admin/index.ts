import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify super user
    const { data: profile } = await admin
      .from("user_profiles")
      .select("is_super_user")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.is_super_user) {
      return new Response(JSON.stringify({ error: "Forbidden — admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, proposalId, editedAfter } = body;

    // List proposals with filters
    if (action === "list") {
      const { status, pass, risk } = body;
      let query = admin
        .from("memory_proposals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (status) query = query.eq("status", status);
      if (pass) query = query.eq("pass", pass);
      if (risk) query = query.eq("risk", risk);

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ proposals: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Approve and apply a proposal
    if (action === "approve") {
      const { data: proposal } = await admin
        .from("memory_proposals")
        .select("*")
        .eq("id", proposalId)
        .maybeSingle();

      if (!proposal) {
        return new Response(JSON.stringify({ error: "Proposal not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (proposal.status !== "pending") {
        return new Response(JSON.stringify({ error: `Proposal is already ${proposal.status}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const applyContent = editedAfter ?? proposal.after;

      // For a merge (or a supersede with no replacement text) the kept memory
      // is the first evidence id that is another active memory of this user.
      const evidenceIds = (Array.isArray(proposal.evidence) ? proposal.evidence : [])
        .filter((e: unknown): e is string => typeof e === "string" && e !== proposal.target_id);
      let keepId: string | null = null;
      if (evidenceIds.length > 0) {
        const { data: keepers } = await admin
          .from("memory_items")
          .select("id")
          .in("id", evidenceIds.filter((e: string) => /^[0-9a-f-]{36}$/i.test(e)))
          .eq("user_id", proposal.user_id)
          .eq("status", "active");
        const active = new Set((keepers ?? []).map((k: { id: string }) => k.id));
        keepId = evidenceIds.find((e: string) => active.has(e)) ?? null;
      }
      const isFold = proposal.action === "merge" || (proposal.action === "supersede" && !applyContent);

      try {
        let applied: { data: unknown; error: { message: string } | null } | null = null;
        if (proposal.action === "retire" || isFold) {
          applied = await admin.rpc("update_memory_item", {
            p_id: proposal.target_id,
            p_base_version: proposal.base_version ?? 0,
            p_patch: isFold && keepId
              ? { status: "superseded", superseded_by: keepId }
              : { status: "retired" },
            p_actor_type: "admin",
          });
        } else if (proposal.action === "supersede" && applyContent) {
          // New active row with the corrected text; the old row stays as history.
          applied = await admin.rpc("supersede_memory_item", {
            p_id: proposal.target_id,
            p_base_version: proposal.base_version ?? 0,
            p_patch: { content: applyContent, source: "dream", confidence: 0.85 },
            p_actor_type: "admin",
          });
        } else if (proposal.action === "edit" && applyContent) {
          applied = await admin.rpc("update_memory_item", {
            p_id: proposal.target_id,
            p_base_version: proposal.base_version ?? 0,
            p_patch: { content: applyContent },
            p_actor_type: "admin",
          });
        }
        if (!applied) throw new Error("Nothing to apply for this proposal");
        if (applied.error) throw new Error(applied.error.message);
        // NULL = the memory changed since the proposal was made (version conflict).
        if (!applied.data) throw new Error("Memory changed since this proposal was made; re-run hygiene");

        await admin.from("memory_proposals").update({
          status: "approved",
          applied_at: new Date().toISOString(),
          applied_by: user.id,
          after: applyContent,
        }).eq("id", proposalId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (applyErr) {
        await admin.from("memory_proposals").update({
          status: "failed",
          applied_at: new Date().toISOString(),
          applied_by: user.id,
        }).eq("id", proposalId);

        return new Response(JSON.stringify({
          error: applyErr instanceof Error ? applyErr.message : "Apply failed",
        }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Reject a proposal
    if (action === "reject") {
      const { error } = await admin
        .from("memory_proposals")
        .update({ status: "rejected", applied_at: new Date().toISOString(), applied_by: user.id })
        .eq("id", proposalId)
        .eq("status", "pending");

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[memory-proposals-admin] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
