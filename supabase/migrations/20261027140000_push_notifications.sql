/*
  # Phone notifications (web push): saved devices, and a trigger for messages from people

  A person can turn notifications on for each device. The device's push address is saved
  here, and when someone messages them while they are away, the `push-notify` edge function
  sends the notification (see supabase/functions/push-notify).

  Settings (on, people messages, show text, quiet hours) live in the existing
  `user_profiles.notification_settings` JSON, which the Settings page already edits.

  Setup that cannot live in git (once):
    - Edge function secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...).
      Make the keys with:  npx web-push generate-vapid-keys
    - The same public key as VITE_VAPID_PUBLIC_KEY for the web app.
    - The Vault secret `cron_secret` (already required by the scheduled functions).
  Until the function is deployed and the secrets exist, the trigger below does nothing visible:
  it never blocks or fails a message.
*/

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count integer not null default 0
);

create index if not exists idx_push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "read_own_push_subscriptions" on public.push_subscriptions;
create policy "read_own_push_subscriptions" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "add_own_push_subscription" on public.push_subscriptions;

drop policy if exists "remove_own_push_subscription" on public.push_subscriptions;
create policy "remove_own_push_subscription" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

-- Devices are added through this function, not by writing the table: a phone shared by two accounts keeps one
-- address, and signing in as someone else moves it to them (the earlier owner stops getting their notifications).
create or replace function public.register_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_endpoint is null or length(p_endpoint) not between 10 and 2000 or p_endpoint !~ '^https://' then
    raise exception 'invalid endpoint';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, failure_count = 0;
end;
$$;

revoke all on function public.register_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;

-- People manage their own devices through the function above and by removing them; the sending function
-- (service role) does the rest.
revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;

-- When a message from a person arrives, ask the sender function to consider a notification.
-- Skipped cheaply when the recipient has no saved device. Never fails the message itself.
create or replace function public.notify_im_message_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient uuid;
begin
  select case when c.user_a_id = new.sender_id then c.user_b_id else c.user_a_id end
    into v_recipient
    from public.im_conversations c
   where c.id = new.conversation_id;

  if v_recipient is null or not exists (select 1 from public.push_subscriptions s where s.user_id = v_recipient) then
    return new;
  end if;

  perform net.http_post(
    url := 'https://lcygiskxwxomytglkwnt.supabase.co/functions/v1/push-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := jsonb_build_object('kind', 'im', 'messageId', new.id)
  );
  return new;
exception when others then
  -- Notifications are best-effort: a problem here must never stop a message from being sent.
  return new;
end;
$$;

revoke all on function public.notify_im_message_push() from public, anon, authenticated;

drop trigger if exists trg_im_messages_push on public.im_messages;
create trigger trg_im_messages_push
  after insert on public.im_messages
  for each row execute function public.notify_im_message_push();
