import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { mapInterestsToCorrespondents, CURATED_CORRESPONDENT_MAP } from "../_shared/correspondentFramework.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the user's profile with interest fields
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, name, sports, interests, hobbies, news_categories, political_leaning')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine which correspondents should exist based on interests
    const desiredCorrespondentIds = mapInterestsToCorrespondents(profile);

    // Fetch existing correspondent companions for this user
    const { data: existingCorrespondents, error: existingError } = await supabaseAdmin
      .from('companions')
      .select('id, correspondent_id, custom_name, first_message_sent')
      .eq('user_id', user.id)
      .eq('relationship_type', 'correspondent')
      .eq('is_active', true);

    if (existingError) {
      return new Response(JSON.stringify({ error: "Failed to query existing correspondents" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existingIds = new Set((existingCorrespondents || []).map((c: { correspondent_id: string }) => c.correspondent_id));
    const existingMap = new Map((existingCorrespondents || []).map((c: { correspondent_id: string }) => [c.correspondent_id, c]));

    // Determine adds and removals
    const toAdd = desiredCorrespondentIds.filter((id: string) => !existingIds.has(id));
    const toRemove = desiredCorrespondentIds.length === 0
      ? [] // If user has no interests mapped, don't remove existing ones (they may have been manually kept)
      : (existingCorrespondents || [])
        .filter((c: { correspondent_id: string }) => !desiredCorrespondentIds.includes(c.correspondent_id))
        .map((c: { id: string }) => c.id);

    // Also include correspondents that exist but are no longer in the desired list
    // Only remove if the user still has SOME interests (otherwise we might purge everything for a user who just hasn't filled interests yet)
    const allExistingNotDesired = (existingCorrespondents || [])
      .filter((c: { correspondent_id: string }) => !desiredCorrespondentIds.includes(c.correspondent_id))
      .map((c: { id: string, correspondent_id: string, first_message_sent: boolean }) => ({
        id: c.id,
        correspondentId: c.correspondent_id,
        firstMessageSent: c.first_message_sent,
      }));

    const created: string[] = [];
    const removed: string[] = [];

    // Create new correspondents
    for (const corrId of toAdd) {
      const config = CURATED_CORRESPONDENT_MAP[corrId];
      if (!config) continue;

      // Determine gender from voice key
      const gender = config.voiceKey === 'big_sister' || config.voiceKey === 'tsundere' || config.voiceKey === 'cheerleader'
        ? 'female'
        : config.voiceKey === 'therapist' || config.voiceKey === 'brooklyn_native' || config.voiceKey === 'french_romantic' || config.voiceKey === 'rnb_lover'
          ? 'female'
          : 'male';

      const { data: newCompanion, error: createError } = await supabaseAdmin
        .from('companions')
        .insert({
          user_id: user.id,
          gender,
          relationship_type: 'correspondent',
          custom_name: correspondentDisplayName(corrId),
          font_family: null,
          hobbies: [],
          sports: [],
          correspondent_id: corrId,
          beat: config.beat,
          voice_key: config.voiceKey,
          signature_voice: config.voiceKey,
          news_categories: config.newsCategories,
          first_message_sent: false,
          is_active: true,
          last_message_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle();

      if (!createError && newCompanion) {
        created.push(corrId);
      }
    }

    // Remove correspondents that no longer match interests
    // Only remove if the user has explicitly changed interests (has some desired correspondents)
    // AND the correspondent hasn't had messages sent yet (preserve conversation history)
    if (desiredCorrespondentIds.length > 0) {
      for (const existing of allExistingNotDesired) {
        // Don't remove if messages have been exchanged — preserve history
        if (existing.firstMessageSent) continue;

        const { error: deleteError } = await supabaseAdmin
          .from('companions')
          .delete()
          .eq('id', existing.id);

        if (!deleteError) {
          removed.push(existing.correspondentId);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      desired: desiredCorrespondentIds,
      created,
      removed,
      existing: [...existingIds],
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("sync-correspondents error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function correspondentDisplayName(corrId: string): string {
  const names: Record<string, string> = {
    the_sideline: 'The Sideline',
    the_insider: 'The Insider',
    the_field: 'The Field',
    the_signal: 'The Signal',
    the_ledger: 'The Ledger',
    the_pulse: 'The Pulse',
    the_arcade: 'The Arcade',
  };
  return names[corrId] || corrId;
}
