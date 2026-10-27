-- Behaviour checks for 20261107100000_open_statuses.sql and 20261107110000_favorite_superhero.sql, run
-- against a scratch Postgres with the stand-ins in open_statuses_hero_stub.sql:
--   psql -d scratch -f open_statuses_hero_stub.sql -f ../migrations/20261107100000_open_statuses.sql \
--        -f ../migrations/20261107110000_favorite_superhero.sql -f open_statuses_hero_behaviour.sql
-- Stops at the first failure and prints "ALL PASSED" at the end.
\set ON_ERROR_STOP on
create function pg_temp.as_user(u text) returns void language sql as $$ select set_config('test.uid', u, false) $$;
create function pg_temp.must(cond boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(cond, false) then raise exception 'FAILED: %', msg; end if; end $$;

-- (the users are inserted by the stub, before the migrations run, so the seeding is exercised)

set role authenticated;

-- a free member can post a status
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000f');
select pg_temp.must((select (public.create_status_post('Hello town') ->> 'success')::boolean), 'free member can post');
select pg_temp.must((select (public.create_status_post('Just for friends', 'friends') ->> 'success')::boolean), 'friends-only still works');
select pg_temp.must((select public.create_status_post('x', 'nobody') ->> 'error') = 'bad_audience', 'audience still checked');
select pg_temp.must((select public.create_status_post('   ') ->> 'error') = 'empty', 'empty refused');
select pg_temp.must((select public.create_status_post(repeat('a', 501)) ->> 'error') = 'too_long', 'too long refused');

-- the rest of the gate still holds
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select pg_temp.must((select public.create_status_post('hi') ->> 'error') = 'banned', 'banned cannot post');
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select pg_temp.must((select public.create_status_post('hi') ->> 'error') = 'no_access', 'unverified cannot post');
select pg_temp.as_user('');
select pg_temp.must((select public.create_status_post('hi') ->> 'error') = 'not_signed_in', 'signed out cannot post');

-- the ten an hour limit
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
do $$ declare i int; begin for i in 1..10 loop perform public.create_status_post('post ' || i); end loop; end $$;
select pg_temp.must((select public.create_status_post('one too many') ->> 'error') = 'rate_limited', 'eleventh post in an hour is refused');

-- favorite superhero: members write their own, and it shows on the card and the billboard
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000f');
update public.user_profiles set favorite_superhero = 'Storm' where id = 'f0000000-0000-0000-0000-00000000000f';
do $$ begin begin update public.user_profiles set favorite_superhero = repeat('x', 61) where id = 'f0000000-0000-0000-0000-00000000000f'; raise exception 'too long allowed'; exception when check_violation then null; end; end $$;
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
select pg_temp.must((select public.get_profile_card('f0000000-0000-0000-0000-00000000000f') -> 'card' ->> 'favorite_hero') = 'Storm', 'hero on the profile card');
select pg_temp.must((select hero = 'Storm' from public.world_cards(array['f0000000-0000-0000-0000-00000000000f'::uuid])), 'hero on the billboard');
select pg_temp.must((select public.get_profile_card('d0000000-0000-0000-0000-00000000000d') -> 'card' ->> 'favorite_hero') is null, 'no hero is null, not blank');

-- a private profile does not leak its hero onto the billboard
reset role;
update public.member_profiles set is_public = false where user_id = 'f0000000-0000-0000-0000-00000000000f';
set role authenticated;
select pg_temp.must((select hero is null from public.world_cards(array['f0000000-0000-0000-0000-00000000000f'::uuid])), 'hidden profiles show no hero');

-- seeded profiles got one
select pg_temp.must((select favorite_superhero is not null from public.user_profiles where id = 'a0000000-0000-0000-0000-00000000000a'), 'seeded profile has a hero');

select 'ALL PASSED';
