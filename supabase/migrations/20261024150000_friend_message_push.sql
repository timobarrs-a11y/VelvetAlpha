/*
  # Push notifications for friend messages

  When a friend messages you and Velvet isn't open in front of you, your phone
  or computer gets a notification ("Leah: hey").

  1. `push_subscriptions`: one row per browser/device that turned notifications
     on. Members manage only their own rows.
  2. A trigger on `im_messages` calls the `friend-message-push` edge function
     (authenticated with the Vault secret `cron_secret`, like the cron jobs).
     The function decides who to notify and skips people who are online.
*/

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own push subscriptions select" ON public.push_subscriptions;
CREATE POLICY "own push subscriptions select" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "own push subscriptions insert" ON public.push_subscriptions;
CREATE POLICY "own push subscriptions insert" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "own push subscriptions update" ON public.push_subscriptions;
CREATE POLICY "own push subscriptions update" ON public.push_subscriptions
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "own push subscriptions delete" ON public.push_subscriptions;
CREATE POLICY "own push subscriptions delete" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- SECURITY DEFINER: reads the Vault secret, which members cannot.
CREATE OR REPLACE FUNCTION public.notify_friend_message_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://lcygiskxwxomytglkwnt.supabase.co/functions/v1/friend-message-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := jsonb_build_object('message_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- A failed notification must never block sending the message.
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_friend_message_push() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS im_messages_push ON public.im_messages;
CREATE TRIGGER im_messages_push
  AFTER INSERT ON public.im_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_friend_message_push();
