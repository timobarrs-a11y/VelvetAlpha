-- Behaviour checks for 20261111100000_velvet_house_visits.sql (see velvet_house_visits_stub.sql for how to run them).
-- Every line prints PASS or stops with FAILED.
\set ON_ERROR_STOP 1
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000b'),('00000000-0000-0000-0000-00000000000c'),('00000000-0000-0000-0000-00000000000e');
insert into public.user_profiles (id, name) values ('00000000-0000-0000-0000-00000000000a','Ann'),('00000000-0000-0000-0000-00000000000b','Bo'),('00000000-0000-0000-0000-00000000000c','Cy'),('00000000-0000-0000-0000-00000000000e','Eve');
-- A and B are friends; A and E are friends but A blocked E; C is a stranger.
insert into public.im_friendships (requester_id, addressee_id, status) values
 ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b','accepted'),
 ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000e','accepted');
insert into public.im_blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000e');
insert into public.companions (id) values ('00000000-0000-0000-0000-0000000000c1'),('00000000-0000-0000-0000-0000000000c2');
-- B has two houses (one per companion); the newer is the one shown. Everyone else has one.
insert into public.velvet_house_saves (user_id, companion_id, save_data_v2, updated_at) values
 ('00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-0000000000c1', '{"v":3,"day":4,"objs":[{"id":"old"}]}', now() - interval '2 days'),
 ('00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-0000000000c2',
  '{"v":3,"contentVersion":5,"day":12,"minutes":600,"objs":[{"id":"sofa","type":"sofa","col":null}],"LOOKS":[{"paint":"#fff","paper":null,"floor":"wood"}],"ROOMLOOK":[{},{"Kitchen":{"paint":"#C9D7E8","paper":null}}],"pets":[{"id":"p1","kind":"cat"}],"simName":"Bo","player":{"name":"Bo","look":{"x":1}},"partner":{"name":"Maya","look":{}},"memories":["secret"],"coreMem":["secret"],"turns":[{"text":"hello"}],"money":900,"bill":{"due":3},"flags":{"story":{"done":1},"concerns":{"bills":3},"rugObjects":true},"closet":[1],"companion":{"humor":"dry"}}', now()),
 ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-0000000000c1', '{"v":3,"day":2,"objs":[]}', now()),
 ('00000000-0000-0000-0000-00000000000e','00000000-0000-0000-0000-0000000000c1', '{"v":3,"day":7,"objs":[]}', now()),
 ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000c1', '{"v":3,"day":9,"objs":[]}', now());

create or replace function t_check(label text, ok boolean) returns void language plpgsql as $$ begin raise notice '% %', case when ok then 'PASS' else 'FAIL' end, label; if not ok then raise exception 'FAILED: %', label; end if; end $$;
create or replace function t_as(uid text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', uid, false); end $$;

set role authenticated;
select t_as('00000000-0000-0000-0000-00000000000a');
-- Saves stay owner-only.
select t_check('a member still reads only their own saves', (select count(*) from public.velvet_house_saves) = 1);
select t_check('the closed list is not readable', not has_table_privilege('authenticated', 'public.velvet_house_visits_closed', 'select'));
-- The friends list: B only (C is a stranger, E is blocked), once, with the newer house's day.
select t_check('friends with a house: B only', (select array_agg(owner_name) from public.velvet_house_friend_houses()) = array['Bo']);
select t_check('the newest house is the one listed', (select day from public.velvet_house_friend_houses()) = 12);
-- The visit: the house, and nothing private.
create temp table v as select public.velvet_house_visit('00000000-0000-0000-0000-00000000000b') as h;
select t_check('a friend can visit', (select h is not null from v));
select t_check('it is the newer house', (select (h->>'day')::int = 12 and h->'objs'->0->>'id' = 'sofa' from v));
select t_check('the owner is named', (select h->>'ownerName' = 'Bo' from v));
select t_check('looks, rooms and pets come with it', (select h ? 'LOOKS' and h ? 'ROOMLOOK' and h ? 'pets' from v));
select t_check('a painted room keeps its paper null', (select h->'ROOMLOOK'->1->'Kitchen' ? 'paper' and h->'ROOMLOOK'->1->'Kitchen'->'paper' = 'null'::jsonb from v));
select t_check('a piece keeps its null colour', (select h->'objs'->0 ? 'col' from v));
select t_check('no memories, chats, money, bills, closet or companion', (select not (h ?| array['memories','coreMem','pastMem','turns','money','bill','closet','companion','style','TASTE','life','jordan','maya']) from v));
select t_check('only names of the people, not their app looks', (select h->'player' = '{"name":"Bo"}'::jsonb and h->'partner' = '{"name":"Maya"}'::jsonb from v));
select t_check('no story or concerns from the flags', (select h->'flags' = '{"rugObjects":true,"tvObject":true}'::jsonb from v));
select t_check('keys the save lacks are left out', (select not (h ? 'yard') from v));
select t_check('a stranger cannot visit', public.velvet_house_visit('00000000-0000-0000-0000-00000000000c') is null);
select t_check('a blocked friend cannot visit', public.velvet_house_visit('00000000-0000-0000-0000-00000000000e') is null);
select t_check('nobody visits their own house this way', public.velvet_house_visit('00000000-0000-0000-0000-00000000000a') is null);
select t_check('my own house is open by default', public.velvet_house_visits_open());

-- B closes the house: A can no longer see it or visit; B opens it again.
select t_as('00000000-0000-0000-0000-00000000000b');
select t_check('the owner closes the house', public.velvet_house_set_visits_open(false) = false);
select t_check('and it reads as closed', not public.velvet_house_visits_open());
select t_check('closing twice is fine', public.velvet_house_set_visits_open(false) = false);
select t_as('00000000-0000-0000-0000-00000000000a');
select t_check('a closed house is not listed', (select count(*) from public.velvet_house_friend_houses()) = 0);
select t_check('a closed house cannot be visited', public.velvet_house_visit('00000000-0000-0000-0000-00000000000b') is null);
select t_as('00000000-0000-0000-0000-00000000000b');
select t_check('the owner opens it again', public.velvet_house_set_visits_open(true));
select t_check('and it reads as open', public.velvet_house_visits_open());
select t_as('00000000-0000-0000-0000-00000000000a');
select t_check('open again: listed and visitable', (select count(*) from public.velvet_house_friend_houses()) = 1 and public.velvet_house_visit('00000000-0000-0000-0000-00000000000b') is not null);
-- E (blocked by A) cannot see A's house either.
select t_as('00000000-0000-0000-0000-00000000000e');
select t_check('the block works both ways', public.velvet_house_visit('00000000-0000-0000-0000-00000000000a') is null and (select count(*) from public.velvet_house_friend_houses()) = 0);
reset role;

-- Signed out: nothing.
set role anon;
do $$ begin
  begin perform public.velvet_house_visit('00000000-0000-0000-0000-00000000000b'); perform t_check('anon cannot call visit', false);
  exception when insufficient_privilege then perform t_check('anon cannot call visit', true); end;
end $$;
reset role;
