-- Stand-ins for the app's tables, only so open_statuses_hero_behaviour.sql can run on a scratch Postgres.
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role anon; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema public, auth to authenticated;
create table public.user_profiles (id uuid primary key, nickname text, name text, favorite_color text, zodiac_sign text, birthday date, interests text[], hobbies text[], sports_interests text[], entertainment_interests text[], tech_interests text[], lifestyle_interests text[], music_genre text, is_bot boolean default false, is_banned boolean default false, social_paused boolean default false, age_verified_at timestamptz, subscription_tier text default 'free');
create table public.member_profiles (user_id uuid primary key, display_name text, headline text, profile_image_type text, profile_smilie_code text, is_bot boolean default false, is_public boolean default true, profile_mode text default 'friends', who_can_message text, accepts_friend_requests boolean default true, share_accomplishments boolean default true);
create table public.im_friendships (requester_id uuid, addressee_id uuid, status text);
create table public.user_goals (id uuid primary key default gen_random_uuid(), user_id uuid, title text, goal_type text, status text default 'active', show_on_profile boolean default false, current_value numeric, target_value numeric, created_at timestamptz default now());
create table public.world_plots (user_id uuid primary key, slot_index int, house jsonb default '{}', sign jsonb default '{}', yard jsonb default '{}', moved_in_at timestamptz default now());
create table public.user_medals (user_id uuid, medal_slug text, earned_at timestamptz, showcase_slot int);
create table public.community_boards (id uuid primary key default gen_random_uuid(), name text, visibility text default 'open');
create table public.community_board_members (user_id uuid, board_id uuid, joined_at timestamptz default now());
create table public.rate_limits (user_id uuid, endpoint text, created_at timestamptz default now());
create table public.progress_posts (id uuid primary key, user_id uuid, post_type text, title text, body text, ref_target_type text, ref_target_id uuid, is_auto_generated boolean, audience text);
create function public.users_blocked(a uuid, b uuid) returns boolean language sql as $$ select false $$;
create function public.members_are_friends(a uuid, b uuid) returns boolean language sql as $$ select exists (select 1 from public.im_friendships f where f.status = 'accepted' and ((f.requester_id = a and f.addressee_id = b) or (f.requester_id = b and f.addressee_id = a))) $$;
create function public.zodiac_for(d date) returns text language sql as $$ select null::text $$;
create function public.is_paid_member(u uuid) returns boolean language sql as $$ select false $$;
create function public.world_is_bot(u uuid) returns boolean language sql as $$ select coalesce((select is_bot from public.member_profiles where user_id = u), false) $$;
create function public.world_earned_medals(u uuid) returns text[] language sql as $$ select '{}'::text[] $$;
create function public.world_blocked(a uuid, b uuid) returns boolean language sql as $$ select false $$;
create function public.check_rate_limit(u uuid, e text, a int, b int) returns boolean language sql as $$ select (select count(*) from public.rate_limits where user_id = u and endpoint = e) < a $$;
create function public.can_use_social(u uuid) returns boolean language sql as $$ select (select subscription_tier from public.user_profiles where id = u) in ('plus','elite') $$;
grant select, insert, update on all tables in schema public to authenticated;
revoke update (favorite_color) on public.user_profiles from authenticated;

-- F is a free member (no plan), C is not age verified, B is banned, D is a normal member, A is a seeded bot
insert into auth.users values ('f0000000-0000-0000-0000-00000000000f'),('b0000000-0000-0000-0000-00000000000b'),('c0000000-0000-0000-0000-00000000000c'),('d0000000-0000-0000-0000-00000000000d'),('a0000000-0000-0000-0000-00000000000a');
insert into public.user_profiles (id, nickname, name, age_verified_at, is_banned) values
 ('f0000000-0000-0000-0000-00000000000f','Fee','Fee Real', now(), false),
 ('b0000000-0000-0000-0000-00000000000b','Ban','Ban Real', now(), true),
 ('c0000000-0000-0000-0000-00000000000c','Cee','Cee Real', null, false),
 ('d0000000-0000-0000-0000-00000000000d','Dee','Dee Real', now(), false);
insert into public.user_profiles (id, nickname, is_bot, age_verified_at) values ('a0000000-0000-0000-0000-00000000000a','Authored', true, now());
insert into public.member_profiles (user_id, display_name, is_bot) select id, nickname, coalesce(is_bot,false) from public.user_profiles;
insert into public.world_plots (user_id, slot_index) select id, row_number() over (order by id) from public.user_profiles;

