-- Behaviour checks for 20261110100000_goal_notes.sql on a scratch Postgres:
--   psql -d scratch -f goal_notes_stub.sql -f ../migrations/20261110100000_goal_notes.sql -f goal_notes_behaviour.sql
\set ON_ERROR_STOP on
create function pg_temp.as_user(u text) returns void language sql as $$ select set_config('test.uid', u, false) $$;
create function pg_temp.must(cond boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(cond, false) then raise exception 'FAILED: %', msg; end if; end $$;
create function pg_temp.fails(sql text) returns boolean language plpgsql as $$ begin execute sql; return false; exception when others then return true; end $$;

-- two notes written the way the function does (service role: not RLS-bound here)
insert into public.goal_notes (user_id, title, summary, key_points) values
 ('a0000000-0000-0000-0000-00000000000a', 'Trademark filing: what the USPTO needs', 'Filing needs a clear mark, a goods and services class, and a fee per class.', '["Search first","Pick the class","Pay per class"]'),
 ('b0000000-0000-0000-0000-00000000000b', 'Someone else''s note', 'Not for A to see at all, ever.', '[]');

set role authenticated;
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select pg_temp.must((select count(*) from public.goal_notes) = 1, 'sees only their own note');

-- can pin, and nothing else changes
select pg_temp.must(not pg_temp.fails($$update public.goal_notes set pinned = true$$), 'can pin');
select pg_temp.must((select pinned from public.goal_notes), 'pinned');
select pg_temp.must(pg_temp.fails($$update public.goal_notes set title = 'Edited by the app'$$), 'cannot change the content');
select pg_temp.must(pg_temp.fails($$update public.goal_notes set summary = 'Edited by the app, still long enough'$$), 'cannot change the summary');
-- cannot write one from the app, or touch another member's
select pg_temp.must(pg_temp.fails($$insert into public.goal_notes (user_id, title, summary) values ('a0000000-0000-0000-0000-00000000000a', 'Made up note', 'Made up by the app, which it must not be able to do')$$), 'cannot insert from the client');
reset role;
set role authenticated;
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
delete from public.goal_notes where user_id = 'b0000000-0000-0000-0000-00000000000b';
select pg_temp.must(not pg_temp.fails($$delete from public.goal_notes where title like 'Trademark%'$$), 'can delete their own');
reset role;
select pg_temp.must((select count(*) from public.goal_notes) = 1 and (select user_id from public.goal_notes) = 'b0000000-0000-0000-0000-00000000000b', 'B''s note survived A''s delete, and A''s own is gone');

-- the table rejects empty or oversized notes
select pg_temp.must(pg_temp.fails($$insert into public.goal_notes (user_id, title, summary) values ('a0000000-0000-0000-0000-00000000000a', 'x', 'too short title')$$), 'title length');
select pg_temp.must(pg_temp.fails($$insert into public.goal_notes (user_id, title, summary, key_points) values ('a0000000-0000-0000-0000-00000000000a', 'A title', 'A summary that is long enough.', '{"not":"an array"}')$$), 'key_points must be an array');
select 'ALL PASSED';
