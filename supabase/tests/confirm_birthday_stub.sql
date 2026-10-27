-- Stand-ins for the app's tables, only so confirm_birthday_behaviour.sql can run on a scratch Postgres.
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema public, auth to authenticated;
create table public.user_profiles (id uuid primary key, birthday date, age_verified_at timestamptz, updated_at timestamptz, welcome_window_expires_at timestamptz, messages_remaining int, haiku_model_enabled boolean, sonnet_model_enabled boolean);
insert into public.user_profiles (id, birthday, age_verified_at, welcome_window_expires_at, messages_remaining) values
 ('c0000000-0000-0000-0000-00000000000c', null, null, '2026-10-01', 5),
 ('d0000000-0000-0000-0000-00000000000d', '1990-05-05', now(), '2026-10-01', 5),
 ('e0000000-0000-0000-0000-00000000000e', null, null, now() + interval '1 day', 7);
grant select on public.user_profiles to authenticated;
