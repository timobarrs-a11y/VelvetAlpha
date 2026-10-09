import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { requireCronAuth } from "../_shared/cronAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? Deno.env.get('OPENAI_API_KEY') ?? '';

interface Companion {
  id: string;
  user_id: string;
  custom_name: string;
  relationship_type: string | null;
  last_message_at: string | null;
}

interface MemoryItem {
  id: string;
  kind: string;
  content: string;
  scope: string;
  companion_id: string | null;
  shared_origin_companion_id: string | null;
}

async function generateCheckInMessage(
  companion: Companion,
  gapDays: number,
  memories: MemoryItem[],
  openCommitments: Array<{ description: string; due_date: string | null; status: string }>,
  companionNameMap: Map<string, string>,
): Promise<string> {
  const isMentor = companion.relationship_type === 'mentor';
  const companionName = companion.custom_name || (isMentor ? 'your coach' : 'your friend');

  // Build the context for the LLM
  const memoryLines: string[] = [];
  for (const m of memories) {
    let line = `- ${m.content}`;
    if (m.shared_origin_companion_id) {
      const originName = companionNameMap.get(m.shared_origin_companion_id);
      if (originName && originName !== companionName) {
        line += ` (originally shared by ${originName})`;
      }
    }
    memoryLines.push(line);
  }

  const commitmentLines = openCommitments.map(c => {
    let line = `- ${c.description}`;
    if (c.due_date) {
      const due = new Date(c.due_date);
      const daysLeft = Math.ceil((due.getTime() - Date.now()) / 86400000);
      if (daysLeft < 0) line += ` (overdue by ${Math.abs(daysLeft)} days)`;
      else if (daysLeft === 0) line += ` (due today)`;
      else line += ` (due in ${daysLeft} days)`;
    }
    if (c.status === 'missed') line += ' [MISSED]';
    return line;
  });

  // Determine tone based on gap length
  let toneInstruction: string;
  if (gapDays <= 1) {
    return ''; // Don't send anything for short gaps
  } else if (gapDays <= 3) {
    toneInstruction = 'light and casual, like a friend following up on something. No mention of time apart.';
  } else if (gapDays <= 7) {
    toneInstruction = 'warm and genuinely interested. You can reference that it\'s been a few days but never say a specific number. Sound like you noticed they\'ve been away, not like you\'re tracking them.';
  } else {
    toneInstruction = 'genuinely concerned but not dramatic. Something like "haven\'t heard from you in a while" — never say a specific number of days. If there\'s something personal in the memories (like a sick parent), ask about it with real care. Sound like a friend who missed them, not a system that tracked their absence.';
  }

  const roleInstruction = isMentor
    ? 'You are the user\'s COACH. You check in on their goals and commitments with warmth, never scolding. You care about them as a person, not just their progress.'
    : 'You are the user\'s COMPANION/FRIEND. You check in on THEM — how they\'re doing, what\'s going on in their life. You\'re not here to push goals, you\'re here because you care.';

  const memoriesBlock = memoryLines.length > 0
    ? `\n\nWhat you know about the user and their life:\n${memoryLines.join('\n')}`
    : '';

  const commitmentsBlock = commitmentLines.length > 0
    ? `\n\nOpen commitments the user made:\n${commitmentLines.join('\n')}`
    : '';

  const prompt = `${roleInstruction}

Write a short check-in message to the user. Keep it to 1-3 sentences, natural and conversational — like a real text from a friend.

Tone: ${toneInstruction}

Your name is ${companionName}.${memoriesBlock}${commitmentsBlock}

Rules:
- NEVER mention a specific number of days since you last talked. Use vague references like "a few days", "a while", "since Tuesday" if you reference time at all.
- If there\'s something personal in what you know (like a family member being sick, a job interview, a move), bring it up with genuine care — but only ONE thing, not a list.
- Don\'t list multiple memories or make it feel like you\'re reading from a file.
- Sound like you genuinely remember these things, not like you\'re checking boxes.
- Don\'t use exclamation marks excessively. Be real.
- If the user asked for something to stay private, do NOT bring it up.
- Keep it short. This is a check-in, not a paragraph.

Write only the message, no preamble, no quotes.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error('[check-in-scheduler] LLM request failed:', res.status);
      return '';
    }

    const data = await res.json();
    const text = data.content?.[0]?.text?.trim() || '';
    return text;
  } catch (err) {
    console.error('[check-in-scheduler] LLM error:', err);
    return '';
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const unauthorized = requireCronAuth(req, corsHeaders);
  if (unauthorized) return unauthorized;

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

    // Find all companions whose last message was > 24h ago
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
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Only process ONE companion per user per run — never the whole cast at once
    const byUser = new Map<string, typeof staleCompanions>();
    for (const c of staleCompanions) {
      if (!byUser.has(c.user_id)) byUser.set(c.user_id, []);
      byUser.get(c.user_id)!.push(c);
    }

    // Fetch subscription tiers for all users with stale companions
    const allUserIds = Array.from(byUser.keys());
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, subscription_tier, is_super_user')
      .in('id', allUserIds);

    const tierMap = new Map<string, string>();
    for (const p of profiles ?? []) {
      const tier = p.is_super_user ? 'elite' : (p.subscription_tier || 'free');
      tierMap.set(p.id, tier);
    }

    let processed = 0;
    for (const [_userId, userCompanions] of byUser) {
      // Pick the stalest companion for this user
      const companion = userCompanions.sort((a, b) => {
        const aT = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bT = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return aT - bT;
      })[0];

      // Free-tier users only get check-ins from non-mentor companions (friends).
      // Coach/mentor check-ins are a paid feature.
      const userTier = tierMap.get(companion.user_id) || 'free';
      if (userTier === 'free' && companion.relationship_type === 'mentor') continue;

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

      // Calculate the real gap from the user's last message (not from our last check-in)
      const { data: lastUserMsg } = await supabase
        .from('conversations')
        .select('created_at')
        .eq('user_id', companion.user_id)
        .eq('companion_id', companion.id)
        .eq('role', 'user')
        .order('created_at', { ascending: false })
        .limit(1);

      let gapDays: number;
      if (lastUserMsg && lastUserMsg.length > 0) {
        gapDays = Math.floor((now.getTime() - new Date(lastUserMsg[0].created_at).getTime()) / 86400000);
      } else if (companion.last_message_at) {
        gapDays = Math.floor((now.getTime() - new Date(companion.last_message_at).getTime()) / 86400000);
      } else {
        gapDays = 7; // default if no messages at all
      }

      // Don't send check-ins for very short gaps
      if (gapDays < 2) continue;

      // Fetch relevant memories: shared (global) + this companion's scoped memories
      // Include person and fact kinds, not just threads
      const { data: memories } = await supabase
        .from('memory_items')
        .select('id, kind, content, scope, companion_id, shared_origin_companion_id')
        .eq('user_id', companion.user_id)
        .eq('status', 'active')
        .in('kind', ['fact', 'person', 'thread'])
        .or(`and(scope.eq.global,companion_id.is.null),and(scope.eq.companion,companion_id.eq.${companion.id})`)
        .order('updated_at', { ascending: false })
        .limit(15);

      // Filter out boundary memories (things the user said not to bring up)
      const { data: boundaries } = await supabase
        .from('memory_items')
        .select('content')
        .eq('user_id', companion.user_id)
        .eq('kind', 'boundary')
        .eq('status', 'active');

      const boundaryContents = (boundaries || []).map(b => b.content.toLowerCase());
      const filteredMemories = (memories || []).filter(m => {
        const contentLower = m.content.toLowerCase();
        return !boundaryContents.some(b => contentLower.includes(b) || b.includes(contentLower));
      });

      // Build a map of companion names for shared memory attribution
      const companionNameMap = new Map<string, string>();
      const { data: allCompanions } = await supabase
        .from('companions')
        .select('id, custom_name')
        .eq('user_id', companion.user_id);
      for (const c of allCompanions || []) {
        if (c.custom_name) companionNameMap.set(c.id, c.custom_name);
      }

      // Fetch open commitments for mentors
      let openCommitments: Array<{ description: string; due_date: string | null; status: string }> = [];
      if (companion.relationship_type === 'mentor') {
        const { data: commitments } = await supabase
          .from('coaching_commitments')
          .select('description, due_date, status')
          .eq('user_id', companion.user_id)
          .eq('companion_id', companion.id)
          .in('status', ['pending', 'missed'])
          .order('due_date', { ascending: true, nullsFirst: false })
          .limit(3);
        openCommitments = commitments || [];
      }

      // Generate the check-in message using the LLM
      const checkInText = await generateCheckInMessage(
        companion,
        gapDays,
        filteredMemories,
        openCommitments,
        companionNameMap,
      );

      if (!checkInText) continue;

      // Insert the check-in message
      await supabase
        .from('conversations')
        .insert({
          user_id: companion.user_id,
          companion_id: companion.id,
          role: 'assistant',
          content: checkInText,
          metadata: { type: 'check_in', gap_days: gapDays },
          client_message_id: `proactive_${companion.id}_${Date.now()}`,
        });

      // Do NOT update last_message_at — that would erase the real gap.
      // The gap is tracked from the user's last message, not from our check-in.

      processed++;
    }

    return new Response(
      JSON.stringify({ processed, total: staleCompanions.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in proactive check-in scheduler:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
