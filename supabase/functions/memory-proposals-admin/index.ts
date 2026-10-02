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

      try {
        if (proposal.action === "retire") {
          await admin.rpc("update_memory_item", {
            p_id: proposal.target_id,
            p_base_version: proposal.base_version ?? 0,
            p_patch: { status: "retired" },
            p_actor_type: "admin",
          });
        } else if (proposal.action === "supersede" && applyContent) {
          await admin.rpc("update_memory_item", {
            p_id: proposal.target_id,
            p_base_version: proposal.base_version ?? 0,
            p_patch: { content: applyContent, status: "superseded" },
            p_actor_type: "admin",
          });
        } else if (proposal.action === "edit" && applyContent) {
          await admin.rpc("update_memory_item", {
            p_id: proposal.target_id,
            p_base_version: proposal.base_version ?? 0,
            p_patch: { content: applyContent },
            p_actor_type: "admin",
          });
        }

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
