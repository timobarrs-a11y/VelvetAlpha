import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import webpush from 'npm:web-push@3.6.7';
import { requireCronAuth } from "../_shared/cronAuth.ts";

// Sends "Leah: hey" to the other person in a friend chat, on every device
// where they turned notifications on, unless Velvet is open in front of them.
// Called by the im_messages insert trigger.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const VAPID_PUBLIC_KEY = 'BOqyxzhZP2hmG5gMi0MyHx19Uw0vLqdakkPW8usVeQWefdQAELLBo8vFEeVojf3T5Oxso_GvplQTtYxXfIDCcZE';
// Heartbeats run every 45s while Velvet is visible; fresher than this means they'll see it live.
const ONLINE_WINDOW_MS = 2 * 60 * 1000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const unauthorized = requireCronAuth(req, corsHeaders);
  if (unauthorized) return unauthorized;

  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!privateKey) return json({ error: 'VAPID_PRIVATE_KEY not set' }, 500);
  webpush.setVapidDetails('mailto:support@projectvelvet.app', VAPID_PUBLIC_KEY, privateKey);

  const { message_id } = await req.json().catch(() => ({}));
  if (!message_id) return json({ error: 'message_id required' }, 400);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: msg } = await db.from('im_messages').select('id, conversation_id, sender_id, content').eq('id', message_id).maybeSingle();
  if (!msg) return json({ skipped: 'no message' });
  const { data: conv } = await db.from('im_conversations').select('user_a_id, user_b_id').eq('id', msg.conversation_id).maybeSingle();
  if (!conv) return json({ skipped: 'no conversation' });
  const recipient = conv.user_a_id === msg.sender_id ? conv.user_b_id : conv.user_a_id;

  const { data: pres } = await db.from('im_presence').select('is_online, last_seen_at').eq('user_id', recipient).maybeSingle();
  if (pres?.is_online && pres.last_seen_at && Date.now() - new Date(pres.last_seen_at).getTime() < ONLINE_WINDOW_MS) {
    return json({ skipped: 'recipient online' });
  }

  const { data: subs } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', recipient);
  if (!subs?.length) return json({ skipped: 'no subscriptions' });

  const { data: name } = await db.rpc('im_member_display_name', { p_user_id: msg.sender_id });
  const text = String(msg.content ?? '');
  const payload = JSON.stringify({
    title: String(name ?? 'A friend'),
    body: text.length > 140 ? text.slice(0, 137) + '...' : text,
    url: '/lobby',
    tag: `im-${msg.conversation_id}`,
  });

  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // The browser dropped this subscription; forget it.
      if (status === 404 || status === 410) await db.from('push_subscriptions').delete().eq('id', s.id);
    }
  }));
  return json({ sent });
});
