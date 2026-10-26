// Sends a phone notification (web push) for something that happened to a person.
//
// Called by a database trigger (messages from people) with the project's cron credentials, never by the
// browser. Whether to send is decided by the pure rules in ../_shared/pushRules.ts.
//
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...).
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";
import { requireCronAuth } from "../_shared/cronAuth.ts";
import { buildImPayload, decideImDelivery, type PushSettings } from "../_shared/pushRules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// After this many failed sends in a row a device is dropped (expired ones are dropped at once).
const MAX_FAILURES = 5;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const unauthorized = requireCronAuth(req, corsHeaders);
  if (unauthorized) return unauthorized;

  try {
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const subject = Deno.env.get("VAPID_SUBJECT");
    if (!publicKey || !privateKey || !subject) return json({ sent: 0, skipped: "not_configured" });
    webpush.setVapidDetails(subject, publicKey, privateKey);

    const body = await req.json().catch(() => null);
    if (body?.kind !== "im" || typeof body.messageId !== "string") return json({ error: "bad_request" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { data: msg } = await supabase.from("im_messages").select("id, conversation_id, sender_id, content").eq("id", body.messageId).maybeSingle();
    if (!msg) return json({ sent: 0, skipped: "no_message" });
    const { data: conv } = await supabase.from("im_conversations").select("user_a_id, user_b_id").eq("id", msg.conversation_id).maybeSingle();
    if (!conv) return json({ sent: 0, skipped: "no_conversation" });
    const recipientId = conv.user_a_id === msg.sender_id ? conv.user_b_id : conv.user_a_id;

    const [{ data: profile }, { data: presence }, { data: block }, { data: subs }, { data: sender }, { data: senderProfile }] = await Promise.all([
      supabase.from("user_settings").select("notification_settings").eq("user_id", recipientId).maybeSingle(),
      supabase.from("im_presence").select("is_online, last_seen_at").eq("user_id", recipientId).maybeSingle(),
      supabase.from("im_blocks").select("id").eq("blocker_id", recipientId).eq("blocked_id", msg.sender_id).maybeSingle(),
      supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth, failure_count").eq("user_id", recipientId),
      supabase.from("im_discovery_profiles").select("display_name, alias").eq("user_id", msg.sender_id).maybeSingle(),
      supabase.from("user_profiles").select("nickname, name").eq("id", msg.sender_id).maybeSingle(),
    ]);

    const settings = (profile?.notification_settings ?? {}) as PushSettings;
    const decision = decideImDelivery({
      settings, hasSubscription: (subs ?? []).length > 0, blocked: !!block, recipientPresence: presence, now: new Date(),
    });
    if (!decision.send) return json({ sent: 0, skipped: decision.reason });

    const senderName = sender?.display_name || sender?.alias || senderProfile?.nickname || senderProfile?.name || "Someone";
    const payload = buildImPayload({
      senderName, content: String(msg.content ?? ""), conversationId: msg.conversation_id, senderId: msg.sender_id,
      showPreview: settings.show_preview === true,
    });

    let sent = 0;
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24, urgency: "normal", topic: payload.tag.slice(0, 32).replace(/[^A-Za-z0-9_-]/g, "") },
        );
        sent++;
        await supabase.from("push_subscriptions").update({ last_success_at: new Date().toISOString(), failure_count: 0 }).eq("id", s.id);
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          // The device unsubscribed or the address expired.
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
        } else if ((s.failure_count ?? 0) + 1 >= MAX_FAILURES) {
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          await supabase.from("push_subscriptions").update({ failure_count: (s.failure_count ?? 0) + 1 }).eq("id", s.id);
        }
      }
    }
    return json({ sent });
  } catch (err) {
    console.error("push-notify error", err);
    return json({ error: "unavailable" }, 500);
  }
});
