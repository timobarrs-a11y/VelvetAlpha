-- Behaviour checks for 20261029100001_velvet_designs.sql, run against a scratch Postgres with stand-ins for the
-- app's tables:  psql -d scratch -f velvet_designs_stub.sql -f ../migrations/20261029100001_velvet_designs.sql -f velvet_designs_behaviour.sql
-- Every line prints PASS or stops with FAILED.
\set ON_ERROR_STOP 1
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000b'),('00000000-0000-0000-0000-00000000000c'),('00000000-0000-0000-0000-00000000000d'),('00000000-0000-0000-0000-00000000000e'),('00000000-0000-0000-0000-00000000000f'),('00000000-0000-0000-0000-000000000010');
insert into public.user_profiles (id, name, is_super_user, is_banned) values
 ('00000000-0000-0000-0000-00000000000a','Ann',false,false),('00000000-0000-0000-0000-00000000000b','Bo',false,false),('00000000-0000-0000-0000-00000000000c','Cy',false,false),
 ('00000000-0000-0000-0000-00000000000d','Mod',true,false),('00000000-0000-0000-0000-00000000000e','Eve',false,false),('00000000-0000-0000-0000-00000000000f','Fay',false,false),('00000000-0000-0000-0000-000000000010','Banned',false,true);
-- A and B are friends; A and E are friends but E is blocked by A; C is a stranger.
insert into public.im_friendships (requester_id, addressee_id, status) values
 ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b','accepted'),
 ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000e','accepted'),
 ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000f','pending');
insert into public.im_blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000e');

create or replace function t_check(label text, ok boolean) returns void language plpgsql as $$ begin raise notice '% %', case when ok then 'PASS' else 'FAIL' end, label; if not ok then raise exception 'FAILED: %', label; end if; end $$;
create or replace function t_as(uid text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', uid, false); end $$;

-- publishing is for the service role only
set role authenticated;
do $$ begin
  begin perform public.velvet_design_publish('00000000-0000-0000-0000-00000000000a','x','VH-ABCD-EFGHJ-KMNPQ-RSTVW-XYZ01','friends'); perform t_check('members cannot call publish', false);
  exception when insufficient_privilege then perform t_check('members cannot call publish', true); end;
end $$;
reset role;

set role service_role;
create temp table pub (label text, id uuid, status text);
insert into pub select 'friends', * from public.velvet_design_publish('00000000-0000-0000-0000-00000000000a','Plaid Hoodie','VH-ABCD-EFGHJ-KMNPQ-RSTVW-XYZ01','friends');
insert into pub select 'public', * from public.velvet_design_publish('00000000-0000-0000-0000-00000000000a','Gallery Piece','VH-ABCD-EFGHJ-KMNPR-RSTVW-XYZ01','public');
insert into pub select 'private', * from public.velvet_design_publish('00000000-0000-0000-0000-00000000000a','Mine Only','VH-ABCD-EFGHJ-KMNPS-RSTVW-XYZ01','private');
select t_check('friends design is approved at once', (select status from pub where label='friends') = 'approved');
select t_check('public design waits for review', (select status from pub where label='public') = 'pending');
do $$ begin
  begin perform public.velvet_design_publish('00000000-0000-0000-0000-00000000000a','x','not a code','friends'); perform t_check('bad code refused', false);
  exception when others then perform t_check('bad code refused', sqlerrm like '%bad_code%'); end;
  begin perform public.velvet_design_publish('00000000-0000-0000-0000-00000000000a','','VH-ABCD-EFGHJ-KMNPQ-RSTVW-XYZ01','friends'); perform t_check('empty name refused', false);
  exception when others then perform t_check('empty name refused', sqlerrm like '%bad_name%'); end;
  begin perform public.velvet_design_publish('00000000-0000-0000-0000-000000000010','Hi','VH-ABCD-EFGHJ-KMNPQ-RSTVW-XYZ01','friends'); perform t_check('banned member refused', false);
  exception when others then perform t_check('banned member refused', sqlerrm like '%banned%'); end;
  begin perform public.velvet_design_publish('00000000-0000-0000-0000-00000000000a','Hi','VH-ABCD-EFGHJ-KMNPQ-RSTVW-XYZ01','everyone'); perform t_check('bad visibility refused', false);
  exception when others then perform t_check('bad visibility refused', sqlerrm like '%bad_visibility%'); end;
end $$;
reset role;

-- the daily limit: ten a day, we have made three
set role service_role;
do $$ declare i int; begin
  for i in 1..7 loop perform public.velvet_design_publish('00000000-0000-0000-0000-00000000000a','n'||i,'VH-ABCD-EFGHJ-KMNPQ-RSTVW-'||i||'AAAA','friends'); end loop;
  begin perform public.velvet_design_publish('00000000-0000-0000-0000-00000000000a','one too many','VH-ABCD-EFGHJ-KMNPQ-RSTVW-XYZ01','friends'); perform t_check('eleventh design in a day refused', false);
  exception when others then perform t_check('eleventh design in a day refused', sqlerrm like '%slow_down%'); end;
end $$;
reset role;
-- remove the filler so later checks are clean
delete from public.velvet_designs where name ~ '^n[0-9]$';

-- who sees what
set role authenticated;
select t_as('00000000-0000-0000-0000-00000000000b');
select t_check('a friend sees the friends-only design', exists (select 1 from public.velvet_designs_from_friends() where name = 'Plaid Hoodie'));
select t_check('a friend does not see the pending public design', not exists (select 1 from public.velvet_designs_from_friends() where name = 'Gallery Piece'));
select t_check('a friend does not see a private design', not exists (select 1 from public.velvet_designs_from_friends() where name = 'Mine Only'));
select t_as('00000000-0000-0000-0000-00000000000c');
select t_check('a stranger sees no friends designs', (select count(*) from public.velvet_designs_from_friends()) = 0);
select t_check('the gallery is empty until approval', (select count(*) from public.velvet_designs_gallery()) = 0);
select t_as('00000000-0000-0000-0000-00000000000e');
select t_check('someone the owner blocked sees nothing', (select count(*) from public.velvet_designs_from_friends()) = 0);
select t_as('00000000-0000-0000-0000-00000000000f');
select t_check('a pending friend request is not a friend', (select count(*) from public.velvet_designs_from_friends()) = 0);
select t_as('00000000-0000-0000-0000-00000000000a');
select t_check('the owner does not see their own in the friends list', (select count(*) from public.velvet_designs_from_friends()) = 0);
select t_check('mine lists all three', (select count(*) from public.velvet_designs_mine()) = 3);
reset role;

-- members cannot read the tables or review
set role authenticated;
do $$ begin
  begin perform count(*) from public.velvet_designs; perform t_check('table closed to members', false); exception when insufficient_privilege then perform t_check('table closed to members', true); end;
end $$;
select t_as('00000000-0000-0000-0000-00000000000a');
select t_check('a member is not a moderator', not public.velvet_designs_is_moderator());
select t_check('a member sees an empty review queue', (select count(*) from public.velvet_designs_pending()) = 0);
do $$ begin
  begin perform public.velvet_design_review((select id from public.velvet_designs_mine() where name='Gallery Piece'), true); perform t_check('a member cannot approve their own', false);
  exception when others then perform t_check('a member cannot approve their own', sqlerrm like '%not_allowed%'); end;
end $$;
reset role;

-- moderator approves the public design
set role authenticated;
select t_as('00000000-0000-0000-0000-00000000000d');
select t_check('the moderator is a moderator', public.velvet_designs_is_moderator());
select t_check('the moderator sees the pending design', exists (select 1 from public.velvet_designs_pending() where name = 'Gallery Piece'));
select public.velvet_design_review((select id from public.velvet_designs_pending() where name='Gallery Piece'), true);
select t_as('00000000-0000-0000-0000-00000000000c');
select t_check('the stranger sees the approved design in the gallery', exists (select 1 from public.velvet_designs_gallery() where name = 'Gallery Piece' and owner_name = 'Ann'));
select t_as('00000000-0000-0000-0000-00000000000b');
select t_check('the friend now sees the public design too', exists (select 1 from public.velvet_designs_from_friends() where name = 'Gallery Piece'));
select t_as('00000000-0000-0000-0000-00000000000e');
select t_check('a blocked member does not see the gallery piece', not exists (select 1 from public.velvet_designs_gallery() where name = 'Gallery Piece'));

-- reports
select t_as('00000000-0000-0000-0000-00000000000a');
create temp table gid as select id from public.velvet_designs_mine() where name = 'Gallery Piece';
select t_check('an owner cannot report their own', (select public.velvet_design_report((select id from gid), 'x')) = 'unavailable');
select t_as('00000000-0000-0000-0000-00000000000c');
select t_check('first report keeps it up', (select public.velvet_design_report((select id from gid), 'rude')) = 'approved');
select t_check('the same reporter twice counts once', (select public.velvet_design_report((select id from gid), 'rude again')) = 'approved');
select t_as('00000000-0000-0000-0000-00000000000b');
select t_check('second reporter keeps it up', (select public.velvet_design_report((select id from gid), 'bad')) = 'approved');
select t_as('00000000-0000-0000-0000-00000000000d');
select t_check('third reporter hides it', (select public.velvet_design_report((select id from gid), 'bad')) = 'hidden');
select t_as('00000000-0000-0000-0000-00000000000c');
select t_check('hidden design is gone from the gallery', not exists (select 1 from public.velvet_designs_gallery() where name = 'Gallery Piece'));
select t_check('a hidden design cannot be reported again', (select public.velvet_design_report((select id from gid), 'x')) = 'unavailable');
reset role;
create temp table fid as select id from public.velvet_designs where name = 'Plaid Hoodie';
grant select on fid to authenticated;
set role authenticated;
select t_as('00000000-0000-0000-0000-00000000000c');
select t_check('a stranger cannot report a friends-only design', (select public.velvet_design_report((select id from fid), 'x')) = 'unavailable');
select t_as('00000000-0000-0000-0000-00000000000b');
select t_check('a friend can report a friends-only design', (select public.velvet_design_report((select id from fid), 'x')) = 'approved');
select t_as('00000000-0000-0000-0000-00000000000d');
select t_check('the moderator sees it with its reports', exists (select 1 from public.velvet_designs_pending() where name = 'Gallery Piece' and report_count = 3 and status = 'hidden'));
select public.velvet_design_review((select id from gid), false);
select t_check('rejecting takes it out of the queue', not exists (select 1 from public.velvet_designs_pending() where name = 'Gallery Piece'));

-- delete
select t_as('00000000-0000-0000-0000-00000000000b');
select t_check('someone else cannot delete', not (select public.velvet_design_delete((select id from gid))));
select t_as('00000000-0000-0000-0000-00000000000a');
select t_check('the owner can delete', (select public.velvet_design_delete((select id from gid))));
select t_check('and it is gone', (select count(*) from public.velvet_designs_mine()) = 2);
-- anon gets nothing
reset role;
set role anon;
do $$ begin
  begin perform public.velvet_designs_gallery(); perform t_check('anon cannot call the gallery', false); exception when insufficient_privilege then perform t_check('anon cannot call the gallery', true); end;
end $$;
