-- Behaviour checks for 20261103100000_profile_levels_and_reach_controls.sql, run against a scratch
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
create function pg_temp.as_user(u text) returns void language sql as $$ select set_config('test.uid', u, false) $$;

-- A and B are friends; C is a stranger; D has a profile but is blocked by A
insert into auth.users values ('a0000000-0000-0000-0000-00000000000a'),('b0000000-0000-0000-0000-00000000000b'),('c0000000-0000-0000-0000-00000000000c'),('d0000000-0000-0000-0000-00000000000d');
insert into public.member_profiles (user_id, display_name, bio) select id, 'Member', 'secret bio' from auth.users;
insert into public.user_profiles (id, nickname, name) values
 ('a0000000-0000-0000-0000-00000000000a','Ace','Alex Real'),('b0000000-0000-0000-0000-00000000000b','','Bea Real'),
 ('c0000000-0000-0000-0000-00000000000c','','there'),('d0000000-0000-0000-0000-00000000000d','Dee','Dana');
insert into public.world_plots (user_id, slot_index) select id, (row_number() over (order by id) - 1)::int from auth.users;
-- G has no house yet, and X is a community bot: the migration should house G and skip X
insert into auth.users values ('a1000000-0000-0000-0000-0000000000a1', 'g@example.com');
insert into auth.users values ('a2000000-0000-0000-0000-0000000000a2', 'x-bot@community.local');
insert into public.im_friendships (requester_id, addressee_id, status) values ('a0000000-0000-0000-0000-00000000000a','b0000000-0000-0000-0000-00000000000b','accepted');
insert into public.im_conversations (id, user_a_id, user_b_id) values
 ('11111111-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a','b0000000-0000-0000-0000-00000000000b'),
 ('11111111-0000-0000-0000-000000000002','b0000000-0000-0000-0000-00000000000b','c0000000-0000-0000-0000-00000000000c');
-- A says the user's profile was private before: existence must not depend on is_public
update public.member_profiles set is_public = false where user_id = 'a0000000-0000-0000-0000-00000000000a';
\i ../migrations/20261103100000_profile_levels_and_reach_controls.sql
create trigger t_goal after update on public.user_goals for each row execute function public.create_post_on_goal_completed();
create trigger t_commit after update on public.coaching_commitments for each row execute function public.create_post_on_commitment_completed();
create trigger t_step after update on public.coach_plan_steps for each row execute function public.create_post_on_plan_step_completed();
create trigger t_mile after insert on public.milestone_achievements for each row execute function public.create_post_on_milestone();

\echo == everyone has a house
do $$ begin
  assert exists (select 1 from public.world_plots where user_id='a1000000-0000-0000-0000-0000000000a1'), 'an account with no house was given one';
  assert not exists (select 1 from public.world_plots where user_id='a2000000-0000-0000-0000-0000000000a2'), 'community bot accounts are skipped';
  assert (select count(distinct slot_index) from public.world_plots) = (select count(*) from public.world_plots), 'every house has its own slot';
  assert (select max(slot_index) + 1 from public.world_plots) = (select count(*) from public.world_plots), 'slots are consecutive, no gaps';
  assert (select house->>'style' from public.world_plots where user_id='a1000000-0000-0000-0000-0000000000a1') = 'standard', 'a starter house';
end $$;
insert into auth.users values ('e1000000-0000-0000-0000-0000000000e1');
insert into public.user_profiles (id, nickname) values ('e1000000-0000-0000-0000-0000000000e1', 'Newbie');
do $$ declare s1 int; begin
  select slot_index into s1 from public.world_plots where user_id='e1000000-0000-0000-0000-0000000000e1';
  assert s1 is not null, 'a new sign-up is housed straight away';
  assert s1 = (select max(slot_index) from public.world_plots), 'new houses go on the end of the street';
  assert public.ensure_world_plot('e1000000-0000-0000-0000-0000000000e1') = s1, 'asking again changes nothing';
  assert (select count(*) from public.world_plots where user_id='e1000000-0000-0000-0000-0000000000e1') = 1, 'one house each';
end $$;
delete from public.world_plots where user_id='e1000000-0000-0000-0000-0000000000e1';
delete from public.member_profiles where user_id='e1000000-0000-0000-0000-0000000000e1';
delete from public.user_profiles where id='e1000000-0000-0000-0000-0000000000e1';
delete from auth.users where id='e1000000-0000-0000-0000-0000000000e1';

\echo == every new member gets a profile
insert into auth.users values ('e0000000-0000-0000-0000-00000000000e');
insert into public.user_profiles (id, nickname, name) values ('e0000000-0000-0000-0000-00000000000e', 'Eli', 'Eliot Real');
do $$ begin
  assert (select display_name from public.member_profiles where user_id='e0000000-0000-0000-0000-00000000000e') = 'Eli', 'new member gets a profile named by their nickname';
  assert not exists (select 1 from public.member_profiles where display_name like '%Eliot%'), 'real name must not be used';
  assert (select is_public and profile_mode = 'friends' and share_accomplishments from public.member_profiles where user_id='e0000000-0000-0000-0000-00000000000e'), 'new profile defaults';
end $$;
delete from public.member_profiles where user_id='e0000000-0000-0000-0000-00000000000e';
delete from public.user_profiles where id='e0000000-0000-0000-0000-00000000000e';
delete from public.world_plots where user_id='e0000000-0000-0000-0000-00000000000e';
delete from auth.users where id='e0000000-0000-0000-0000-00000000000e';

\echo == nicknames are the name people see
insert into auth.users values ('f0000000-0000-0000-0000-00000000000f');
insert into public.user_profiles (id, nickname, name) values ('f0000000-0000-0000-0000-00000000000f', '', 'Frankie Real');
do $$ begin assert (select display_name from public.member_profiles where user_id='f0000000-0000-0000-0000-00000000000f') = 'Member', 'no nickname yet: a placeholder, never the real name'; end $$;
update public.user_profiles set nickname = 'Fizz' where id='f0000000-0000-0000-0000-00000000000f';
do $$ begin assert (select display_name from public.member_profiles where user_id='f0000000-0000-0000-0000-00000000000f') = 'Fizz', 'picking a nickname sets the display name'; end $$;
update public.user_profiles set nickname = 'Fizzy' where id='f0000000-0000-0000-0000-00000000000f';
do $$ begin assert (select display_name from public.member_profiles where user_id='f0000000-0000-0000-0000-00000000000f') = 'Fizzy', 'changing it follows'; end $$;
update public.member_profiles set display_name = 'Custom Name' where user_id='f0000000-0000-0000-0000-00000000000f';
update public.user_profiles set nickname = 'Other' where id='f0000000-0000-0000-0000-00000000000f';
do $$ begin assert (select display_name from public.member_profiles where user_id='f0000000-0000-0000-0000-00000000000f') = 'Custom Name', 'a display name they set themselves is left alone'; end $$;
delete from public.member_profiles where user_id='f0000000-0000-0000-0000-00000000000f';
delete from public.user_profiles where id='f0000000-0000-0000-0000-00000000000f';
delete from public.world_plots where user_id='f0000000-0000-0000-0000-00000000000f';
delete from auth.users where id='f0000000-0000-0000-0000-00000000000f';

\echo == defaults
do $$ begin
  assert (select profile_mode from public.member_profiles where user_id='a0000000-0000-0000-0000-00000000000a') = 'friends', 'profiles start friends-only (full page needs a friend)';
  assert (select share_accomplishments from public.member_profiles where user_id='a0000000-0000-0000-0000-00000000000a'), 'wins are shared by default';
  assert (select is_public from public.member_profiles where user_id='a0000000-0000-0000-0000-00000000000a'), 'existence is always public';
end $$;

\echo == messages
update public.member_profiles set who_can_message='friends' where user_id='b0000000-0000-0000-0000-00000000000b';
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
insert into public.im_messages (conversation_id, sender_id, body) values ('11111111-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a','hi from a friend');
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select pg_temp.expect_error($$insert into public.im_messages (conversation_id, sender_id, body) values ('11111111-0000-0000-0000-000000000002','c0000000-0000-0000-0000-00000000000c','hi stranger')$$, 'not taking messages');
update public.member_profiles set who_can_message='nobody' where user_id='b0000000-0000-0000-0000-00000000000b';
select pg_temp.expect_error($$insert into public.im_messages (conversation_id, sender_id, body) values ('11111111-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a','friend, but nobody')$$, 'not taking messages');
update public.member_profiles set who_can_message='everyone' where user_id='b0000000-0000-0000-0000-00000000000b';
insert into public.im_messages (conversation_id, sender_id, body) values ('11111111-0000-0000-0000-000000000002','c0000000-0000-0000-0000-00000000000c','now everyone is allowed');

\echo == friend requests
update public.member_profiles set accepts_friend_requests=false where user_id='b0000000-0000-0000-0000-00000000000b';
select pg_temp.expect_error($$insert into public.im_friendships (requester_id, addressee_id) values ('c0000000-0000-0000-0000-00000000000c','b0000000-0000-0000-0000-00000000000b')$$, 'not accepting friend requests');
update public.member_profiles set accepts_friend_requests=true where user_id='b0000000-0000-0000-0000-00000000000b';
insert into public.im_friendships (requester_id, addressee_id) values ('c0000000-0000-0000-0000-00000000000c','b0000000-0000-0000-0000-00000000000b');

\echo == statuses: friends-only profile vs public-facing profile
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select (public.create_status_post('public note')->>'success') = 'true' as ok \gset
\if :ok \else \echo FAIL create status \quit \endif
select (public.create_status_post('friends note','friends')->>'success') = 'true' as ok2 \gset
\if :ok2 \else \echo FAIL create friends status \quit \endif
select (public.create_status_post('x','everybody')->>'error') = 'bad_audience' as ok3 \gset
\if :ok3 \else \echo FAIL bad audience \quit \endif
create function pg_temp.visible(viewer uuid) returns text language sql as $$
  select coalesce(string_agg(p->>'body', ',' order by p->>'body'), '') from jsonb_array_elements(public.get_member_posts_inner(array['a0000000-0000-0000-0000-00000000000a'::uuid], viewer, 50, 0)->'posts') p where p->>'post_type' = 'status' $$;
do $$ begin
  assert pg_temp.visible('a0000000-0000-0000-0000-00000000000a') = 'friends note,public note', 'author sees both';
  assert pg_temp.visible('b0000000-0000-0000-0000-00000000000b') = 'friends note,public note', 'friend sees both';
  assert pg_temp.visible('c0000000-0000-0000-0000-00000000000c') = '', 'stranger sees no statuses from a friends-only profile';
end $$;
update public.member_profiles set profile_mode='open' where user_id='a0000000-0000-0000-0000-00000000000a';
do $$ begin
  assert pg_temp.visible('c0000000-0000-0000-0000-00000000000c') = 'public note', 'stranger sees only the everyone status on a public-facing profile';
end $$;
select (public.get_trending_posts_inner(array['a0000000-0000-0000-0000-00000000000a'::uuid],'c0000000-0000-0000-0000-00000000000c',10, now() - interval '1 day')::text like '%friends note%') as trending_leaks;
update public.member_profiles set profile_mode='friends' where user_id='a0000000-0000-0000-0000-00000000000a';

\echo == accomplishments post for everyone, and say what was done
insert into public.user_goals (id, user_id, title, goal_type) values ('90000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a','Run a 5K','fitness'),('90000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-00000000000a','Learn guitar','creative');
update public.user_goals set status='completed' where id='90000000-0000-0000-0000-000000000001';
do $$ begin
  assert (select count(*) from public.progress_posts where post_type='goal_completed') = 1, 'finishing a goal posts a win even though is_public is false';
end $$;
insert into public.coaching_commitments (id, user_id, goal_id, description) values ('91000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a','90000000-0000-0000-0000-000000000002','Practice 20 minutes');
update public.coaching_commitments set status='completed' where id='91000000-0000-0000-0000-000000000001';
insert into public.coach_plans (id, user_id) values ('92000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-00000000000a');
insert into public.coach_plan_steps (id, plan_id, commitment_id, title) values ('93000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','First chords');
update public.coach_plan_steps set status='completed' where id='93000000-0000-0000-0000-000000000001';
insert into public.milestone_achievements (user_id, achievement_name) values ('a0000000-0000-0000-0000-00000000000a','First week');
create function pg_temp.wins(viewer uuid) returns text language sql as $$
  select coalesce(string_agg(p->>'title', ' | ' order by p->>'title'), '') from jsonb_array_elements(public.get_member_posts_inner(array['a0000000-0000-0000-0000-00000000000a'::uuid], viewer, 50, 0)->'posts') p where p->>'post_type' <> 'status' $$;
select 'stranger sees wins: ' || pg_temp.wins('c0000000-0000-0000-0000-00000000000c');
do $$ begin
  assert pg_temp.wins('c0000000-0000-0000-0000-00000000000c') = 'Completed: First chords (toward Learn guitar) | Finished Run a 5K 🏆 | Kept a commitment: Practice 20 minutes | Milestone unlocked: First week', 'a stranger sees every win, with what was done';
  assert pg_temp.wins('b0000000-0000-0000-0000-00000000000b') = pg_temp.wins('c0000000-0000-0000-0000-00000000000c'), 'a friend sees the same wins';
end $$;

\echo == discover
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
do $$ declare r jsonb; begin
  r := public.get_discover_accomplishments(30, 0);
  assert jsonb_array_length(r->'posts') = 4, 'discover lists all four wins for a stranger, got ' || jsonb_array_length(r->'posts');
  assert (select bool_and(p->>'author_name' = 'Ace') from jsonb_array_elements(r->'posts') p), 'discover shows the nickname, not the real name';
  assert not (r::text like '%Alex Real%'), 'real name leaked into discover';
  assert not (r::text like '%friends note%' or r::text like '%public note%'), 'statuses are not in discover';
end $$;
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin assert jsonb_array_length(public.get_discover_accomplishments(30,0)->'posts') = 0, 'you do not see your own wins in discover'; end $$;
update public.member_profiles set share_accomplishments=false where user_id='a0000000-0000-0000-0000-00000000000a';
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
do $$ begin
  assert jsonb_array_length(public.get_discover_accomplishments(30,0)->'posts') = 0, 'turned off: nothing in discover';
  assert pg_temp.wins('c0000000-0000-0000-0000-00000000000c') = '', 'turned off: a stranger sees no wins';
  assert pg_temp.wins('b0000000-0000-0000-0000-00000000000b') <> '', 'turned off: friends still see wins';
end $$;
update public.member_profiles set share_accomplishments=true where user_id='a0000000-0000-0000-0000-00000000000a';
insert into public.im_blocks values ('a0000000-0000-0000-0000-00000000000a','d0000000-0000-0000-0000-00000000000d');
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
do $$ begin assert jsonb_array_length(public.get_discover_accomplishments(30,0)->'posts') = 0, 'a blocked member sees nothing from the blocker'; end $$;

\echo == reacting and commenting on wins (row level security)
create temp table ids as select (select id from public.progress_posts where post_type='goal_completed') as win, (select id from public.progress_posts where body='friends note') as friends_post;
grant select on ids to authenticated;
set role authenticated;
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
insert into public.progress_post_likes (post_id, user_id) select win, 'c0000000-0000-0000-0000-00000000000c' from ids;
insert into public.progress_post_comments (post_id, user_id, body) select win, 'c0000000-0000-0000-0000-00000000000c', 'Congrats!' from ids;
select pg_temp.expect_error($$insert into public.progress_post_comments (post_id, user_id, body) select friends_post, 'c0000000-0000-0000-0000-00000000000c', 'sneaky' from ids$$, 'row-level security');
select pg_temp.expect_error($$insert into public.progress_post_likes (post_id, user_id) select friends_post, 'c0000000-0000-0000-0000-00000000000c' from ids$$, 'row-level security');
do $$ begin assert (select count(*) from public.progress_post_comments c join ids on c.post_id = ids.friends_post) = 0, 'stranger reads friends-post comments'; end $$;
reset role;
update public.member_profiles set comments_from='friends' where user_id='a0000000-0000-0000-0000-00000000000a';
select pg_temp.expect_error($$insert into public.progress_post_comments (post_id, user_id, body) select win, 'c0000000-0000-0000-0000-00000000000c', 'second' from ids$$, 'Only friends can comment');
insert into public.progress_post_comments (post_id, user_id, body) select win, 'b0000000-0000-0000-0000-00000000000b', 'friend comment' from ids;
update public.member_profiles set comments_from='everyone' where user_id='a0000000-0000-0000-0000-00000000000a';

\echo == the front card
update public.user_profiles set favorite_color='teal', birthday='1990-07-30', interests=array['Running','Jazz','running'], hobbies=array['Cooking'], music_genre='Lo-fi' where id='a0000000-0000-0000-0000-00000000000a';
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
do $$ declare r jsonb; begin
  r := public.get_profile_card('a0000000-0000-0000-0000-00000000000a');
  assert (r->>'success')::boolean, 'card for a stranger';
  assert r->'card'->>'display_name' = 'Ace', 'nickname, not real name';
  assert not (r::text like '%Alex Real%'), 'real name must not appear when a nickname exists';
  assert r->'card'->>'favorite_color' = 'teal', 'favorite color';
  assert r->'card'->>'zodiac_sign' = 'Leo', 'zodiac derived from birthday';
  assert (r->'card'->'interests') ?| array['Running'] and jsonb_array_length(r->'card'->'interests') = 4, 'interests merged and de-duplicated: ' || (r->'card'->'interests')::text;
  assert r->'card'->'goal_areas' = '["creative"]'::jsonb or r->'card'->'goal_areas' = '["creative"]', 'only active goal areas, never titles: ' || (r->'card'->'goal_areas')::text;
  assert not (r::text like '%Learn guitar%' or r::text like '%Run a 5K%'), 'goal titles must not be on the card';
  assert (r->'relation'->>'has_full_access')::boolean = false, 'a stranger does not have the full page';
  assert r->'relation'->>'friend_request' = 'none', 'no request yet';
  r := public.get_profile_card('b0000000-0000-0000-0000-00000000000b');
  assert r->'card'->>'display_name' = 'Member', 'a real name is never shown, even when it is all they gave';
  assert not (r::text like '%Bea Real%'), 'real name must not appear on the card';
  assert r->'relation'->>'friend_request' = 'sent', 'pending request is reported';
  r := public.get_profile_card('c0000000-0000-0000-0000-00000000000c');
  assert r->'card'->>'display_name' = 'Member', 'placeholder name never shows a made-up real name';
end $$;
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
do $$ begin assert not (public.get_profile_card('d0000000-0000-0000-0000-00000000000d')->>'success')::boolean, 'a blocked member has no card'; end $$;
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
do $$ begin assert (public.get_profile_card('a0000000-0000-0000-0000-00000000000a')->'relation'->>'has_full_access')::boolean, 'a friend has the full page'; end $$;

\echo == the full page
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
do $$ declare r jsonb; begin
  r := public.get_public_profile('a0000000-0000-0000-0000-00000000000a');
  assert (r->>'success')::boolean, 'profile page exists even with is_public false';
  assert r->'profile'->>'bio' is null, 'no bio for a stranger';
  assert jsonb_array_length(r->'goals') = 0, 'no goals for a stranger';
  assert not (r->>'has_full_access')::boolean, 'stranger has no full access';
end $$;
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
do $$ declare r jsonb; begin
  r := public.get_public_profile('a0000000-0000-0000-0000-00000000000a');
  assert r->'profile'->>'bio' = 'secret bio', 'a friend sees the bio';
  assert (r->>'has_full_access')::boolean, 'a friend has full access';
end $$;
update public.member_profiles set profile_mode='open' where user_id='a0000000-0000-0000-0000-00000000000a';
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
do $$ begin assert (public.get_public_profile('a0000000-0000-0000-0000-00000000000a')->>'has_full_access')::boolean, 'public-facing: everyone has the full page'; end $$;
update public.member_profiles set profile_mode='friends' where user_id='a0000000-0000-0000-0000-00000000000a';

\echo == mail
update public.member_profiles set accepts_mail=false where user_id='b0000000-0000-0000-0000-00000000000b';
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select set_config('test.admin','1',false);
select 'letters sent: ' || public.send_town_letter('Hello','body');
do $$ begin
  assert (select count(*) from public.town_letters) = 4, 'expected 4 letters (everyone with a house except B, who opted out)';
  assert not exists (select 1 from public.town_letters where user_id='b0000000-0000-0000-0000-00000000000b'), 'B opted out but got a letter';
end $$;
select set_config('test.admin','0',false);
select pg_temp.expect_error($$select public.send_town_letter('Nope','not admin')$$, 'Only an admin');

\echo == ALL PASSED
