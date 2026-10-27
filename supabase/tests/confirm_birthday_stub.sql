-- Stand-ins for the app's tables, only so confirm_birthday_behaviour.sql can run on a scratch Postgres.
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema public, auth to authenticated;
create table public.user_profiles (id uuid primary key, birthday date, age_verified_at timestamptz, updated_at timestamptz);
insert into public.user_profiles (id, birthday, age_verified_at) values
 ('c0000000-0000-0000-0000-00000000000c', null, null),
 ('d0000000-0000-0000-0000-00000000000d', '1990-05-05', now());
grant select on public.user_profiles to authenticated;
