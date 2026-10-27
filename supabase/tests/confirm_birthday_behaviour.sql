-- Behaviour checks for 20261108100000_confirm_birthday.sql on a scratch Postgres:
--   psql -d scratch -f confirm_birthday_stub.sql -f ../migrations/20261108100000_confirm_birthday.sql -f confirm_birthday_behaviour.sql
\set ON_ERROR_STOP on
create function pg_temp.as_user(u text) returns void language sql as $$ select set_config('test.uid', u, false) $$;
create function pg_temp.must(cond boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(cond, false) then raise exception 'FAILED: %', msg; end if; end $$;
set role authenticated;

-- an older account with no age check gets verified, and the birthday is saved
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select pg_temp.must((select (public.confirm_birthday(date '1990-10-29') ->> 'success')::boolean), 'adult verified');
select pg_temp.must((select birthday from public.user_profiles where id = 'c0000000-0000-0000-0000-00000000000c') = date '1990-10-29', 'birthday saved');
select pg_temp.must((select age_verified_at is not null from public.user_profiles where id = 'c0000000-0000-0000-0000-00000000000c'), 'age_verified_at set');

-- a mistake can be corrected, and the first verification date stays
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
select pg_temp.must((select public.confirm_birthday(date '1985-01-02') ->> 'success')::boolean, 'correction ok');
select pg_temp.must((select birthday from public.user_profiles where id = 'd0000000-0000-0000-0000-00000000000d') = date '1985-01-02', 'corrected');

-- minors, nonsense and signed-out callers are refused and nothing changes
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select pg_temp.must((select public.confirm_birthday((current_date - interval '17 years')::date) ->> 'reason') = 'underage', 'minor refused');
select pg_temp.must((select public.confirm_birthday(current_date + 1) ->> 'reason') = 'birthday_invalid', 'future refused');
select pg_temp.must((select public.confirm_birthday(null) ->> 'reason') = 'birthday_invalid', 'null refused');
select pg_temp.must((select birthday from public.user_profiles where id = 'c0000000-0000-0000-0000-00000000000c') = date '1990-10-29', 'unchanged after refusals');
select pg_temp.as_user('');
select pg_temp.must((select public.confirm_birthday(date '1990-01-01') ->> 'reason') = 'not_signed_in', 'signed out refused');
select 'ALL PASSED';
