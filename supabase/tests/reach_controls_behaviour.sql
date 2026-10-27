-- Behaviour checks for 20261103100000_reach_controls_and_status_audience.sql, run against a scratch
-- Postgres with stand-ins for the app's tables (from the supabase/tests folder):
--   psql -d scratch -f reach_controls_stub.sql -f reach_controls_behaviour.sql
-- Stops at the first failure and prints "ALL PASSED" at the end.
\set ON_ERROR_STOP on
create function pg_temp.expect_error(q text, needle text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then
    if position(needle in sqlerrm) > 0 then return; end if;
    raise exception 'wrong error for [%]: %', q, sqlerrm;
  end;
  raise exception 'expected an error for [%] but it succeeded', q;
end $$;

insert into auth.users values ('a0000000-0000-0000-0000-00000000000a'),('b0000000-0000-0000-0000-00000000000b'),('c0000000-0000-0000-0000-00000000000c');
insert into public.member_profiles (user_id) select id from auth.users;
insert into public.user_profiles (id) select id from auth.users;
insert into public.world_plots select id from auth.users;
-- A and B are friends; C is a stranger
insert into public.im_friendships (requester_id, addressee_id, status) values ('a0000000-0000-0000-0000-00000000000a','b0000000-0000-0000-0000-00000000000b','accepted');
insert into public.im_conversations (id, user_a_id, user_b_id) values
 ('11111111-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a','b0000000-0000-0000-0000-00000000000b'),
 ('11111111-0000-0000-0000-000000000002','b0000000-0000-0000-0000-00000000000b','c0000000-0000-0000-0000-00000000000c');
-- default: everyone can message (migration ran after these rows exist, so test it explicitly below)
\i ../migrations/20261103100000_reach_controls_and_status_audience.sql

\echo == messages
update public.member_profiles set who_can_message='friends' where user_id='b0000000-0000-0000-0000-00000000000b';
select set_config('test.uid','a0000000-0000-0000-0000-00000000000a',false);
insert into public.im_messages (conversation_id, sender_id, body) values ('11111111-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a','hi from a friend');
select set_config('test.uid','c0000000-0000-0000-0000-00000000000c',false);
select pg_temp.expect_error($$insert into public.im_messages (conversation_id, sender_id, body) values ('11111111-0000-0000-0000-000000000002','c0000000-0000-0000-0000-00000000000c','hi stranger')$$, 'not taking messages');
update public.member_profiles set who_can_message='nobody' where user_id='b0000000-0000-0000-0000-00000000000b';
select pg_temp.expect_error($$insert into public.im_messages (conversation_id, sender_id, body) values ('11111111-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a','friend, but nobody')$$, 'not taking messages');
update public.member_profiles set who_can_message='everyone' where user_id='b0000000-0000-0000-0000-00000000000b';
insert into public.im_messages (conversation_id, sender_id, body) values ('11111111-0000-0000-0000-000000000002','c0000000-0000-0000-0000-00000000000c','now everyone is allowed');
-- the setting protects the recipient: C takes friends only, B is a stranger to C
update public.member_profiles set who_can_message='friends' where user_id='c0000000-0000-0000-0000-00000000000c';
select pg_temp.expect_error($$insert into public.im_messages (conversation_id, sender_id, body) values ('11111111-0000-0000-0000-000000000002','b0000000-0000-0000-0000-00000000000b','b is a stranger to c')$$, 'not taking messages');
update public.member_profiles set who_can_message='everyone' where user_id='c0000000-0000-0000-0000-00000000000c';

\echo == friend requests
update public.member_profiles set accepts_friend_requests=false where user_id='b0000000-0000-0000-0000-00000000000b';
select pg_temp.expect_error($$insert into public.im_friendships (requester_id, addressee_id) values ('c0000000-0000-0000-0000-00000000000c','b0000000-0000-0000-0000-00000000000b')$$, 'not accepting friend requests');
update public.member_profiles set accepts_friend_requests=true where user_id='b0000000-0000-0000-0000-00000000000b';
insert into public.im_friendships (requester_id, addressee_id) values ('c0000000-0000-0000-0000-00000000000c','b0000000-0000-0000-0000-00000000000b');

\echo == status audience and feeds
select set_config('test.uid','a0000000-0000-0000-0000-00000000000a',false);
select (public.create_status_post('friends only note','friends')->>'success') = 'true' as ok \gset
\if :ok \else \echo FAIL create friends status \quit \endif
select (public.create_status_post('public note')->>'success') = 'true' as ok2 \gset
\if :ok2 \else \echo FAIL create default status \quit \endif
select (public.create_status_post('x','everybody')->>'error') = 'bad_audience' as ok3 \gset
\if :ok3 \else \echo FAIL bad audience accepted \quit \endif
create function pg_temp.visible(viewer uuid) returns text language sql as $$
  select coalesce(string_agg(p->>'body', ',' order by p->>'body'), '') from jsonb_array_elements(public.get_member_posts_inner(array['a0000000-0000-0000-0000-00000000000a'::uuid], viewer, 50, 0)->'posts') p $$;
select 'author sees: ' || pg_temp.visible('a0000000-0000-0000-0000-00000000000a');
select 'friend sees: ' || pg_temp.visible('b0000000-0000-0000-0000-00000000000b');
select 'stranger sees: ' || pg_temp.visible('c0000000-0000-0000-0000-00000000000c');
do $$ begin
  assert pg_temp.visible('a0000000-0000-0000-0000-00000000000a') = 'friends only note,public note', 'author should see both';
  assert pg_temp.visible('b0000000-0000-0000-0000-00000000000b') = 'friends only note,public note', 'friend should see both';
  assert pg_temp.visible('c0000000-0000-0000-0000-00000000000c') = 'public note', 'stranger should only see the public note';
end $$;
select jsonb_path_exists(public.get_member_posts_inner(array['a0000000-0000-0000-0000-00000000000a'::uuid],'a0000000-0000-0000-0000-00000000000a',5,0), '$.posts[*].audience') as has_audience_field;
select (public.get_trending_posts_inner(array['a0000000-0000-0000-0000-00000000000a'::uuid],'c0000000-0000-0000-0000-00000000000c',10, now() - interval '1 day')::text like '%friends only note%') as trending_leaks;

\echo == comments and likes (row level security as a signed-in member)
create temp table ids as select (select id from public.progress_posts where body='friends only note') as friends_post, (select id from public.progress_posts where body='public note') as public_post;
grant select on ids to authenticated;
set role authenticated;
select set_config('test.uid','c0000000-0000-0000-0000-00000000000c',false);
select pg_temp.expect_error($$insert into public.progress_post_comments (post_id, user_id, body) select friends_post, 'c0000000-0000-0000-0000-00000000000c', 'sneaky' from ids$$, 'row-level security');
select pg_temp.expect_error($$insert into public.progress_post_likes (post_id, user_id) select friends_post, 'c0000000-0000-0000-0000-00000000000c' from ids$$, 'row-level security');
insert into public.progress_post_comments (post_id, user_id, body) select public_post, 'c0000000-0000-0000-0000-00000000000c', 'hello public' from ids;
select set_config('test.uid','b0000000-0000-0000-0000-00000000000b',false);
insert into public.progress_post_comments (post_id, user_id, body) select friends_post, 'b0000000-0000-0000-0000-00000000000b', 'hi from friend' from ids;
insert into public.progress_post_likes (post_id, user_id) select friends_post, 'b0000000-0000-0000-0000-00000000000b' from ids;
select 'stranger can read comments on the friends post: ' || count(*) from public.progress_post_comments c, ids where c.post_id = ids.friends_post and auth.uid() = 'c0000000-0000-0000-0000-00000000000c';
select set_config('test.uid','c0000000-0000-0000-0000-00000000000c',false);
do $$ begin assert (select count(*) from public.progress_post_comments c join ids on c.post_id = ids.friends_post) = 0, 'stranger can read friends-post comments'; end $$;
reset role;

\echo == comments_from
update public.member_profiles set comments_from='friends' where user_id='a0000000-0000-0000-0000-00000000000a';
select set_config('test.uid','c0000000-0000-0000-0000-00000000000c',false);
select pg_temp.expect_error($$insert into public.progress_post_comments (post_id, user_id, body) select public_post, 'c0000000-0000-0000-0000-00000000000c', 'stranger comment' from ids$$, 'Only friends can comment');
insert into public.progress_post_comments (post_id, user_id, body) select public_post, 'b0000000-0000-0000-0000-00000000000b', 'friend comment' from ids;
insert into public.progress_post_comments (post_id, user_id, body) select public_post, 'a0000000-0000-0000-0000-00000000000a', 'author reply' from ids;

\echo == mail
update public.member_profiles set accepts_mail=false where user_id='b0000000-0000-0000-0000-00000000000b';
select set_config('test.uid','a0000000-0000-0000-0000-00000000000a',false);
select set_config('test.admin','1',false);
select 'letters sent: ' || public.send_town_letter('Hello','body');
do $$ begin
  assert (select count(*) from public.town_letters) = 2, 'expected 2 letters (B opted out)';
  assert not exists (select 1 from public.town_letters where user_id='b0000000-0000-0000-0000-00000000000b'), 'B opted out but got a letter';
end $$;
select set_config('test.admin','0',false);
select pg_temp.expect_error($$select public.send_town_letter('Nope','not admin')$$, 'Only an admin');

\echo == ALL PASSED
