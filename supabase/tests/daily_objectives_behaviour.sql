-- Behaviour checks for 20261105100000_daily_objectives.sql, run against a scratch Postgres with the
-- stand-ins in daily_objectives_stub.sql:
--   psql -d scratch -f daily_objectives_stub.sql -f ../migrations/20261105100000_daily_objectives.sql -f daily_objectives_behaviour.sql
-- Stops at the first failure and prints "ALL PASSED" at the end.
\set ON_ERROR_STOP on
create function pg_temp.as_user(u text) returns void language sql as $$ select set_config('test.uid', u, false) $$;
create function pg_temp.must(cond boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(cond, false) then raise exception 'FAILED: %', msg; end if; end $$;

insert into auth.users values ('a0000000-0000-0000-0000-00000000000a'),('b0000000-0000-0000-0000-00000000000b'),('c0000000-0000-0000-0000-00000000000c'),('d0000000-0000-0000-0000-00000000000d');
insert into public.user_profiles (id, nickname, name) values
 ('a0000000-0000-0000-0000-00000000000a','Ace','Alex Real'),('b0000000-0000-0000-0000-00000000000b','Bea','Bea Real'),
 ('c0000000-0000-0000-0000-00000000000c','','Cy Real'),('d0000000-0000-0000-0000-00000000000d','Bot','Bot');
update public.user_profiles set is_bot = true where nickname = 'Bot';
insert into public.member_profiles (user_id, display_name) values ('c0000000-0000-0000-0000-00000000000c','Cy Nick');

set role authenticated;

-- nothing is done on a fresh day
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select pg_temp.must((select count(*) filter (where done) = 0 and count(*) = 5 from public.get_daily_objectives(date_trunc('day', now()))), 'five objectives, none done');

-- the app cannot read or write the tables directly
do $$ begin begin perform * from public.daily_activity; raise exception 'read allowed'; exception when insufficient_privilege then null; end; end $$;
do $$ begin begin insert into public.objective_days values (auth.uid(), current_date, 5); raise exception 'write allowed'; exception when insufficient_privilege then null; end; end $$;

-- reported activities tick, and the allowlist holds
select public.report_activity('visit_town');
select public.report_activity('visit_town');
select pg_temp.must((select count(*) = 1 from (select 1 from public.get_daily_objectives(date_trunc('day', now())) o where o.key = 'visit_town' and o.done) x), 'town ticked');
do $$ begin begin perform public.report_activity('post_in_space'); raise exception 'faking allowed'; exception when raise_exception then if sqlerrm like 'faking%' then raise; end if; end; end $$;

-- derived ones tick from real rows
reset role;
insert into public.community_comments (author_id) values ('a0000000-0000-0000-0000-00000000000a');
insert into public.progress_post_likes (user_id) values ('a0000000-0000-0000-0000-00000000000a');
set role authenticated;
select pg_temp.must((select count(*) filter (where done) = 3 from public.get_daily_objectives(date_trunc('day', now()))), 'town, comment, cheer');
reset role;
select pg_temp.must((select done_count = 3 from public.objective_days where user_id = 'a0000000-0000-0000-0000-00000000000a'), 'three points recorded');
select pg_temp.must((select count(*) = 0 from public.refresh_calls), 'no medal refresh before a full day');

-- a full day triggers medals, and a day's count never goes down
insert into public.coaching_commitments (user_id, status, completed_at) values ('a0000000-0000-0000-0000-00000000000a','completed', now());
insert into public.daily_activity (user_id, activity, happened_at) values ('a0000000-0000-0000-0000-00000000000a','play_game', now() - interval '2 minutes');
set role authenticated;
select pg_temp.must((select count(*) filter (where done) = 5 from public.get_daily_objectives(date_trunc('day', now()))), 'all five');
reset role;
select pg_temp.must((select done_count = 5 from public.objective_days where user_id = 'a0000000-0000-0000-0000-00000000000a'), 'full day recorded');
select pg_temp.must((select count(*) = 1 from public.refresh_calls), 'medals refreshed once on the full day');
select pg_temp.must((public.medal_stats('a0000000-0000-0000-0000-00000000000a') ->> 'objective_days')::int = 1, 'medal stat counts the full day');
select pg_temp.must((select count(*) = 3 from public.medals where slug in ('daily-driver','on-a-roll','town-regular')), 'three medals added');

-- leaderboard: people only, nicknames only, bots out, you wherever you are
insert into public.objective_days values ('b0000000-0000-0000-0000-00000000000b', current_date, 4),
  ('c0000000-0000-0000-0000-00000000000c', current_date, 2),
  ('d0000000-0000-0000-0000-00000000000d', current_date, 5),
  ('c0000000-0000-0000-0000-00000000000c', current_date - 30, 5);
set role authenticated;
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select pg_temp.must((select string_agg(nickname, ',' order by rank) = 'Ace,Bea,Cy Nick' from public.get_objective_leaderboard('week', 50)), 'week order, nicknames, no bot');
select pg_temp.must((select not exists (select 1 from public.get_objective_leaderboard('all', 50) where nickname like '%Real%')), 'no real names');
select pg_temp.must((select points = 7 and full_days = 1 from public.get_objective_leaderboard('all', 50) where is_you), 'all-time points for you');
select pg_temp.must((select rank = 3 and is_you from public.get_objective_leaderboard('week', 2) where is_you), 'you shown with your true rank outside the top 2');
reset role;
insert into public.im_blocks values ('b0000000-0000-0000-0000-00000000000b','c0000000-0000-0000-0000-00000000000c');
set role authenticated;
select pg_temp.must((select not exists (select 1 from public.get_objective_leaderboard('week', 50) where nickname = 'Bea')), 'blocked people do not appear');

select 'ALL PASSED';
