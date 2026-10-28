// supabase/functions/community-room-send/index.ts
//
// The only way a person posts into a live room. Clients have no INSERT policy
// on community_room_messages, so every message passes through here:
// auth -> ban check -> social access -> membership -> room kind -> rate limit
// -> moderation -> insert (service role).
//
// Request:  POST { room_id: string, body: string, reply_to_id?: string }
// Response: 200 { message: { id, room_id, board_id, author_id, body, reply_to_id, kind, created_at } }
//           4xx { error: string, message?: string }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { moderateInput, MODERATION_REFUSAL } from "../_shared/moderation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_LENGTH = 2000;
const RATE_LIMIT_COUNT = 20;      // messages
const RATE_LIMIT_WINDOW_MIN = 1;  // per minute

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") return json(405, { error: 'Method not allowed' });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json(401, { error: 'No authorization header' });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    // Runs as the caller so auth.uid()-based RPCs (check_access) see them.
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return json(401, { error: 'Invalid authentication token' });

    const payload = await req.json().catch(() => null) as
      { room_id?: string; body?: string; reply_to_id?: string | null } | null;
    const roomId = payload?.room_id;
    const body = (payload?.body ?? '').trim();
    const replyToId = payload?.reply_to_id ?? null;
    if (!roomId || !body) return json(400, { error: 'room_id and body are required' });
    if (body.length > MAX_LENGTH) return json(400, { error: `Messages are limited to ${MAX_LENGTH} characters` });

    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('is_banned, is_super_user')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.is_banned === true) {
      return json(403, { error: 'Account suspended', message: 'Your account has been suspended for violating our content policy.' });
    }
    const isSuperUser = profile?.is_super_user === true;

    const { data: access } = await supabaseUser.rpc('check_access');
    if (!isSuperUser && access?.can_access_social !== true) {
      return json(403, { error: 'social_access_required', message: 'Verify your age and start your membership to chat in spaces.' });
    }

    const { data: room } = await supabaseAdmin
      .from('community_rooms')
      .select('id, board_id, kind')
      .eq('id', roomId)
      .maybeSingle();
    if (!room) return json(404, { error: 'Room not found' });

    const { data: membership } = await supabaseAdmin
      .from('community_board_members')
      .select('role')
      .eq('board_id', room.board_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership && !isSuperUser) return json(403, { error: 'not_a_member', message: 'Join this space to chat.' });

    const canModerate = isSuperUser || membership?.role === 'owner' || membership?.role === 'mod';
    if (room.kind === 'announcements' && !canModerate) {
      return json(403, { error: 'read_only', message: 'Only hosts can post in announcements.' });
    }

    if (replyToId) {
      const { data: parent } = await supabaseAdmin
        .from('community_room_messages')
        .select('id')
        .eq('id', replyToId)
        .eq('room_id', room.id)
        .maybeSingle();
      if (!parent) return json(400, { error: 'reply_to_id is not in this room' });
    }

    if (!isSuperUser) {
      const { data: allowed } = await supabaseAdmin.rpc('check_rate_limit', {
        p_user_id: user.id,
        p_endpoint: 'community-room-send',
        p_limit_count: RATE_LIMIT_COUNT,
        p_time_window_minutes: RATE_LIMIT_WINDOW_MIN,
      });
      if (allowed === false) return json(429, { error: 'slow_down', message: 'You are sending messages too fast.' });
      await supabaseAdmin.rpc('record_rate_limit', { p_user_id: user.id, p_endpoint: 'community-room-send' });
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
    const verdict = await moderateInput(supabaseAdmin, apiKey, user.id, body);
    if (verdict.action === 'block') {
      console.warn(`Blocked room message, category=${verdict.category}, user=${user.id}`);
      return json(403, { error: 'Content policy violation', message: MODERATION_REFUSAL });
    }

    const { data: message, error: insertError } = await supabaseAdmin
      .from('community_room_messages')
      .insert({ room_id: room.id, author_id: user.id, body, reply_to_id: replyToId, kind: 'user' })
      .select('id, room_id, board_id, author_id, body, reply_to_id, kind, created_at')
      .single();
    // The database word bank refuses slurs and hate speech with VM001 and a
    // message written for the sender.
    if (insertError?.code === 'VM001') {
      return json(403, { error: 'Content policy violation', message: insertError.message });
    }
    if (insertError) throw insertError;

    // @mentions: the client inserts <@user-uuid> tokens from its autocomplete.
    // Notify mentioned members of this space (max 10, never yourself).
    // Needs Phase 4's 'mention' notification type; before that the insert is skipped harmlessly.
    const mentioned = [...new Set([...body.matchAll(/<@([0-9a-f-]{36})>/g)].map((m) => m[1]))]
      .filter((id) => id !== user.id)
      .slice(0, 10);
    if (mentioned.length > 0) {
      const { data: mentionedMembers } = await supabaseAdmin
        .from('community_board_members')
        .select('user_id')
        .eq('board_id', room.board_id)
        .in('user_id', mentioned);
      const rows = (mentionedMembers ?? []).map((m: { user_id: string }) => ({
        user_id: m.user_id,
        type: 'mention',
        actor_id: user.id,
        meta: { board_id: room.board_id, room_id: room.id, message_id: message.id },
      }));
      if (rows.length > 0) {
        const { error: mentionError } = await supabaseAdmin.from('community_notifications').insert(rows);
        if (mentionError) console.warn('mention notifications skipped:', mentionError.message);
      }
    }

    return json(200, { message });
  } catch (error) {
    console.error('community-room-send error:', error);
    return json(500, { error: 'Could not send message' });
  }
});
