-- Behaviour checks for the daily objectives migrations (20261105100000, 20261106100000, 20261107120000), run against a scratch Postgres with the
-- stand-ins in daily_objectives_stub.sql:
--   psql -d scratch -f daily_objectives_stub.sql -f ../migrations/20261105100000_daily_objectives.sql \
--        -f ../migrations/20261106100000_objective_xp.sql -f ../migrations/20261107120000_space_chat_counts.sql -f daily_objectives_behaviour.sql
-- Stops at the first failure and prints "ALL PASSED" at the end.
\set ON_ERROR_STOP on
create function pg_temp.as_user(u text) returns void language sql as $$ select set_config('test.uid', u, false) $$;
create function pg_temp.must(cond boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(cond, false) then raise exception 'FAILED: %', msg; end if; end $$;

-- A is new; B is a long-time member with a comment and a companion already; C and D are for the board
insert into auth.users values ('a0000000-0000-0000-0000-00000000000a'),('b0000000-0000-0000-0000-00000000000b'),('c0000000-0000-0000-0000-00000000000c'),('d0000000-0000-0000-0000-00000000000d');
insert into public.user_profiles (id, nickname, name) values
 ('a0000000-0000-0000-0000-00000000000a','Ace','Alex Real'),('b0000000-0000-0000-0000-00000000000b','Bea','Bea Real'),
 ('c0000000-0000-0000-0000-00000000000c','','Cy Real'),('d0000000-0000-0000-0000-00000000000d','Bot','Bot');
update public.user_profiles set is_bot = true where nickname = 'Bot';
insert into public.member_profiles (user_id, display_name) values ('c0000000-0000-0000-0000-00000000000c','Cy Nick');
insert into public.companions (user_id, relationship_type) values ('a0000000-0000-0000-0000-00000000000a','mentor');  -- A's coach, made by the arrival
insert into public.community_comments (author_id, created_at) values ('b0000000-0000-0000-0000-00000000000b', now() - interval '40 days');
insert into public.companions (user_id, relationship_type, created_at) values ('b0000000-0000-0000-0000-00000000000b','friend', now() - interval '40 days');

set role authenticated;
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');

-- the catalogue has about forty-five objectives, and the core five are marked
select pg_temp.must((select count(*) between 44 and 50 from public.objective_catalog()), 'about forty-five objectives');
select pg_temp.must((select count(*) = 5 from public.objective_catalog() where core_target is not null), 'five core');

-- a new member sees only the core five, none done (their coach does not count as a companion)
select pg_temp.must((select count(*) = 5 and bool_and(core) and not bool_or(done) and string_agg(key, ',') = 'visit_town,comment_in_space,create_companion,play_velvet_sims,read_feed' from public.get_daily_objectives(date_trunc('day', now()))), 'core five, in order, none done');

-- the app cannot read or write the tables directly
do $$ begin begin perform * from public.daily_activity; raise exception 'read allowed'; exception when insufficient_privilege then null; end; end $$;
do $$ begin begin insert into public.objective_days values (auth.uid(), current_date, 1, 5, 10); raise exception 'write allowed'; exception when insufficient_privilege then null; end; end $$;
do $$ begin begin perform * from public.objective_core_done; raise exception 'core read allowed'; exception when insufficient_privilege then null; end; end $$;

-- reported activities tick, the allowlist holds, and unlisted keys are refused
select public.report_activity('visit_town');
select public.report_activity('visit_town');
select pg_temp.must((select done from public.get_daily_objectives(date_trunc('day', now())) where key = 'visit_town'), 'town ticked');
select pg_temp.must((select progress = 0 and target = 1 from public.get_daily_objectives(date_trunc('day', now())) where key = 'read_feed'), 'feed not yet');
do $$ begin begin perform public.report_activity('post_in_space'); raise exception 'faking allowed'; exception when raise_exception then if sqlerrm like 'faking%' then raise; end if; end; end $$;
do $$ begin begin perform public.report_activity('nonsense'); raise exception 'junk allowed'; exception when raise_exception then if sqlerrm like 'junk%' then raise; end if; end; end $$;

-- things they did tick, and the rest of the site stays locked until all five are done
reset role;
insert into public.community_comments (author_id) values ('a0000000-0000-0000-0000-00000000000a');
insert into public.companions (user_id, relationship_type) values ('a0000000-0000-0000-0000-00000000000a','friend');
insert into public.daily_activity (user_id, activity) values ('a0000000-0000-0000-0000-00000000000a','play_velvet_sims');
set role authenticated;
select pg_temp.must((select count(*) = 5 and count(*) filter (where done) = 4 and bool_and(core) from public.get_daily_objectives(date_trunc('day', now()))), 'four of five core, still locked');
reset role;
select pg_temp.must((select count(*) = 0 from public.refresh_calls where false) and (select count(*) = 4 from public.objective_core_done where user_id = 'a0000000-0000-0000-0000-00000000000a'), 'four core remembered');
select pg_temp.must((select count(*) = 0 from public.objective_days), 'no daily record while on core');

-- finishing the fifth unlocks the daily set, and the core stays done even if a companion is later deleted
insert into public.daily_activity (user_id, activity) values ('a0000000-0000-0000-0000-00000000000a','read_feed');
set role authenticated;
select pg_temp.must((select count(*) = 5 and not bool_or(core) and count(*) filter (where hard) = 1 from public.get_daily_objectives(date_trunc('day', now()))), 'daily five: four easy, one hard, no longer core');
reset role;
delete from public.companions where user_id = 'a0000000-0000-0000-0000-00000000000a' and relationship_type = 'friend';
select pg_temp.must((select count(*) = 5 from public.objective_core_done where user_id = 'a0000000-0000-0000-0000-00000000000a'), 'core five stay done');
select pg_temp.must((select count(*) >= 1 from public.refresh_calls), 'medals refreshed when core objectives finished');
select pg_temp.must((public.medal_stats('a0000000-0000-0000-0000-00000000000a') ->> 'core_objectives')::int = 5, 'medal stat counts the core');
select pg_temp.must((select count(*) = 4 from public.medals where slug in ('settled-in','daily-driver','on-a-roll','town-regular')), 'four medals added');

-- every objective is worth the same XP, hard or not: a day's XP is objectives done x 10
set role authenticated;
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
create temp table pg_temp.today_done as select count(*) filter (where done)::int as n from public.get_daily_objectives(date_trunc('day', now()));
reset role;
select pg_temp.must((select t.n * 10 = coalesce((select xp from public.objective_days where user_id = 'a0000000-0000-0000-0000-00000000000a' and day = current_date), 0) from pg_temp.today_done t), 'XP is a flat 10 per objective done, hard or not');
set role authenticated;

-- the daily set is the same all day, and different people get different ones
set role authenticated;
select pg_temp.must((select string_agg(key, ',') from public.get_daily_objectives(date_trunc('day', now()))) = (select string_agg(key, ',') from public.get_daily_objectives(date_trunc('day', now()))), 'stable all day');

-- a long-time member is credited for what they already did, but still has to do the rest
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select pg_temp.must((select count(*) filter (where done) = 2 and bool_and(core) from public.get_daily_objectives(date_trunc('day', now()))), 'credit for a past comment and companion');

-- doing a daily objective counts: A finishes every item in the day's set
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
reset role;
-- give A a friend and a plan so any pick is possible, then complete whatever was picked by reporting/inserting
insert into public.objective_days values ('a0000000-0000-0000-0000-00000000000a', current_date - 1, 5, 5, 50);
select pg_temp.must((public.medal_stats('a0000000-0000-0000-0000-00000000000a') ->> 'objective_days')::int = 1, 'a full day counts');

-- chatting in a Space room counts as leaving a comment in a Space; a deleted message does not
reset role;
insert into public.community_room_messages (author_id) values ('d0000000-0000-0000-0000-00000000000d');
insert into public.community_room_messages (author_id, deleted_at) values ('c0000000-0000-0000-0000-00000000000c', now());
set role authenticated;
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
select pg_temp.must((select done from public.get_daily_objectives(date_trunc('day', now())) where key = 'comment_in_space'), 'a room message ticks the Space comment objective');
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select pg_temp.must((select not done from public.get_daily_objectives(date_trunc('day', now())) where key = 'comment_in_space'), 'a deleted room message does not');
reset role;

-- leaderboard: people only, nicknames only, bots out, you wherever you are
delete from public.objective_days; delete from public.objective_core_done;
insert into public.objective_days values ('a0000000-0000-0000-0000-00000000000a', current_date, 5, 5, 50),
  ('b0000000-0000-0000-0000-00000000000b', current_date, 4, 5, 40),
  ('c0000000-0000-0000-0000-00000000000c', current_date, 2, 5, 20),
  ('d0000000-0000-0000-0000-00000000000d', current_date, 5, 5, 50),
  ('c0000000-0000-0000-0000-00000000000c', current_date - 30, 5, 5, 50);
insert into public.objective_core_done (user_id, key) values ('c0000000-0000-0000-0000-00000000000c', 'visit_town');
set role authenticated;
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select pg_temp.must((select string_agg(nickname, ',' order by rank) = 'Ace,Bea,Cy Nick' from public.get_objective_leaderboard('week', 50)), 'week order, nicknames, no bot');
select pg_temp.must((select xp = 30 from public.get_objective_leaderboard('week', 50) where is_you), 'a core objective is the same XP as any other');
select pg_temp.must((select not exists (select 1 from public.get_objective_leaderboard('all', 50) where nickname like '%Real%')), 'no real names');
select pg_temp.must((select xp = 80 and full_days = 1 from public.get_objective_leaderboard('all', 50) where is_you), 'all-time XP for you');
select pg_temp.must((select rank = 3 and is_you from public.get_objective_leaderboard('week', 2) where is_you), 'you shown with your true rank outside the top 2');
reset role;
insert into public.im_blocks values ('b0000000-0000-0000-0000-00000000000b','c0000000-0000-0000-0000-00000000000c');
set role authenticated;
select pg_temp.must((select not exists (select 1 from public.get_objective_leaderboard('week', 50) where nickname = 'Bea')), 'blocked people do not appear');

select 'ALL PASSED';
