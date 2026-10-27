do $$ begin
  create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role service_role nologin; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid());
-- the caller, as Supabase sets it
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table public.user_profiles (id uuid primary key references auth.users(id), name text, is_banned boolean default false, is_super_user boolean default false);
create table public.im_friendships (id uuid primary key default gen_random_uuid(), requester_id uuid not null references auth.users(id), addressee_id uuid not null references auth.users(id), status text not null default 'pending');
create table public.im_blocks (id uuid primary key default gen_random_uuid(), blocker_id uuid not null references auth.users(id), blocked_id uuid not null references auth.users(id));
create function public.im_member_display_name(p uuid) returns text language sql stable as $$ select coalesce((select name from public.user_profiles where id = p), 'Member') $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant select on all tables in schema public to authenticated;
grant execute on function auth.uid() to anon, authenticated, service_role;
