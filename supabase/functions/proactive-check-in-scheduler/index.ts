import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // Auto-retire threads older than 21 days
    const twentyOneDaysAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('memory_items')
      .update({ status: 'retired' })
      .eq('kind', 'thread')
      .eq('status', 'active')
      .lt('created_at', twentyOneDaysAgo)
      .then(() => {})
      .catch(() => {});

    // Find all companions whose last message was > 24h ago (not just mentors)
    const { data: staleCompanions, error: fetchError } = await supabase
      .from('companions')
      .select('id, user_id, custom_name, relationship_type, last_message_at')
      .eq('is_active', true)
      .or(`last_message_at.is.null,last_message_at.lt.${twentyFourHoursAgo}`);

    if (fetchError) {
      throw new Error(`Failed to fetch stale companions: ${fetchError.message}`);
    }

    if (!staleCompanions || staleCompanions.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: 'No stale companions' }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let processed = 0;
    for (const companion of staleCompanions) {
      // Check if there's already a proactive message in the last 24h
      const { data: recentProactive } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', companion.user_id)
        .eq('companion_id', companion.id)
        .eq('role', 'assistant')
        .gte('created_at', twentyFourHoursAgo)
        .limit(1);

      if (recentProactive && recentProactive.length > 0) continue;

      // Rate limit: max one thread follow-up per day per companion.
      // Check if a thread-follow-up message was already sent today.
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const { data: todayThreadFollowup } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', companion.user_id)
        .eq('companion_id', companion.id)
        .eq('role', 'assistant')
        .gte('created_at', startOfToday)
        .filter('metadata->>type', 'eq', 'thread_follow_up')
        .limit(1);

      if (todayThreadFollowup && todayThreadFollowup.length > 0) continue;

      let checkInText: string;
      let messageType = 'proactive_check_in';

      const isMentor = companion.relationship_type === 'mentor';

      // Fetch due, unresolved, companion-scoped threads from memory_items
      const { data: dueThreads } = await supabase
        .from('memory_items')
        .select('id, content, due_at')
        .eq('user_id', companion.user_id)
        .eq('companion_id', companion.id)
        .eq('kind', 'thread')
        .eq('status', 'active')
        .not('due_at', 'is', null)
        .lte('due_at', now.toISOString())
        .order('due_at', { ascending: true })
        .limit(1);

      if (dueThreads && dueThreads.length > 0) {
        const thread = dueThreads[0];
        // Use the thread content to craft a follow-up
        const threadTopic = thread.content.split(' — ')[0] || thread.content;
        checkInText = `Hey — I was thinking about ${threadTopic}. Did that ever get resolved?`;
        messageType = 'thread_follow_up';

        // Mark the thread as recalled
        await supabase
          .rpc('update_memory_recall', {
            p_ids: [thread.id],
            p_actor_type: 'extractor',
          })
          .then(() => {})
          .catch(() => {});
      } else if (isMentor) {
        // Fall back to commitment-based check-in for mentors
        const { data: openCommitments } = await supabase
          .from('coaching_commitments')
          .select('description, due_date')
          .eq('user_id', companion.user_id)
          .eq('companion_id', companion.id)
          .eq('status', 'pending')
          .order('due_date', { ascending: true })
          .limit(1);

        if (openCommitments && openCommitments.length > 0) {
          const c = openCommitments[0];
          checkInText = `Hey — checking in on your commitment to "${c.description}". How's it going?`;
        } else {
          const greetings = [
            "Hey, haven't heard from you in a bit. How are things going with your goals?",
            "Checking in! What's been on your mind lately?",
            "Just wanted to see how you're doing. Any progress you want to talk through?",
          ];
          checkInText = greetings[Math.floor(Math.random() * greetings.length)];
        }
      } else {
        // Non-mentor companions: light check-in
        const greetings = [
          "Hey, just thinking about you. How's your day going?",
          "Hi! Haven't talked in a bit — what's been on your mind?",
          "Just checking in. Anything you want to chat about?",
        ];
        checkInText = greetings[Math.floor(Math.random() * greetings.length)];
      }

      await supabase
        .from('conversations')
        .insert({
          user_id: companion.user_id,
          companion_id: companion.id,
          role: 'assistant',
          content: checkInText,
          metadata: { type: messageType },
          client_message_id: `proactive_${companion.id}_${Date.now()}`,
        });

      // Update last_message_at so this companion doesn't get pinged again immediately
      await supabase
        .from('companions')
        .update({ last_message_at: now.toISOString() })
        .eq('id', companion.id);

      processed++;
    }

    return new Response(
      JSON.stringify({ processed, total: staleCompanions.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error('Error in proactive check-in scheduler:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
