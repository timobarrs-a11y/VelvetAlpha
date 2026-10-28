/*
# Visiting a friend's house

Velvet Sims players can walk round a friend's house: what they built, how they decorated it, their pets and the two
people who live there. The director: "we do need to be able to let friends go into friends houses and see what they've
done."

A visit is read-only and shows the house only. Saves stay owner-only (their policies are unchanged); these functions
read them for a friend and hand back the house's part of the save, never memories, chats, story, money or bills.

- Friends means an accepted friendship with neither blocking the other (`velvet_designs_are_friends`, as for designs).
- A house is open to friends unless its owner closes it (`velvet_house_visits_closed`, one row per closed account).
- The house shown is the owner's most recently saved one (a player has one per companion).

1. `velvet_house_visits_closed`: accounts whose house friends cannot visit. Read and written by the functions only.
2. `velvet_house_friend_houses()`: the caller's friends with a house open to visit, most recently played first.
3. `velvet_house_visit(owner)`: that friend's house, or null when it is not open to the caller.
4. `velvet_house_visits_open()` / `velvet_house_set_visits_open(open)`: whether the caller's own house is open.
Safe to run more than once.
*/

create table if not exists public.velvet_house_visits_closed (
  user_id uuid primary key references auth.users(id) on delete cascade,
  closed_at timestamptz not null default now()
);
alter table public.velvet_house_visits_closed enable row level security;
revoke all on public.velvet_house_visits_closed from anon, authenticated;

-- The owner's newest save that has a live-game (v2+) house in it.
create or replace function public.velvet_house_latest_save(p_owner uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select s.save_data_v2 from public.velvet_house_saves s
  where s.user_id = p_owner and s.save_data_v2 is not null and jsonb_typeof(s.save_data_v2->'objs') = 'array'
  order by s.updated_at desc nulls last
  limit 1;
$$;
revoke all on function public.velvet_house_latest_save(uuid) from public, anon, authenticated;

create or replace function public.velvet_house_friend_houses()
returns table (owner_id uuid, owner_name text, day integer, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select h.user_id, public.im_member_display_name(h.user_id), h.day, h.updated_at
  from (
    select distinct on (s.user_id) s.user_id, (s.save_data_v2->>'day')::integer as day, s.updated_at
    from public.velvet_house_saves s
    where (select auth.uid()) is not null
      and s.user_id <> (select auth.uid())
      and s.save_data_v2 is not null and jsonb_typeof(s.save_data_v2->'objs') = 'array'
      and not exists (select 1 from public.velvet_house_visits_closed c where c.user_id = s.user_id)
      and public.velvet_designs_are_friends((select auth.uid()), s.user_id)
    order by s.user_id, s.updated_at desc nulls last
  ) h
  order by h.updated_at desc nulls last
  limit 50;
$$;

create or replace function public.velvet_house_visit(p_owner uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := (select auth.uid());
  s jsonb;
  house jsonb;
begin
  if me is null or p_owner is null or p_owner = me then return null; end if;
  if exists (select 1 from public.velvet_house_visits_closed c where c.user_id = p_owner) then return null; end if;
  if not public.velvet_designs_are_friends(me, p_owner) then return null; end if;
  s := public.velvet_house_latest_save(p_owner);
  if s is null then return null; end if;
  -- Only the house: what it looks like, what is in it, and who lives there (names and looks). Nothing else of the save.
  house := jsonb_build_object(
    'v', s->'v', 'rev', s->'rev', 'contentVersion', s->'contentVersion',
    'day', s->'day', 'minutes', s->'minutes', 'power', s->'power', 'wallMode', s->'wallMode', 'townName', s->'townName',
    'fridge', s->'fridge', 'dishes', s->'dishes', 'laundryPile', s->'laundryPile', 'owned', s->'owned',
    'LOOKS', s->'LOOKS', 'ROOMLOOK', s->'ROOMLOOK', 'WALLOBJS', s->'WALLOBJS', 'yard', s->'yard',
    'objs', s->'objs', 'pets', s->'pets', 'petSeq', s->'petSeq',
    'simName', s->'simName', 'look', s->'look', 'mayaLook', s->'mayaLook',
    'player', jsonb_build_object('name', s->'player'->'name'),
    'partner', jsonb_build_object('name', s->'partner'->'name'),
    -- So the game does not hand the house its starting rugs and TV again.
    'flags', jsonb_build_object('rugObjects', coalesce(s->'flags'->'rugObjects', 'true'::jsonb), 'tvObject', coalesce(s->'flags'->'tvObject', 'true'::jsonb)),
    'ownerName', to_jsonb(public.im_member_display_name(p_owner))
  );
  -- Keys the save does not have are left out (nulls inside the house, a painted room's paper for one, are kept).
  return (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(house) as e(k, v) where v is not null and v <> 'null'::jsonb);
end;
$$;

create or replace function public.velvet_house_visits_open()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select auth.uid()) is not null
    and not exists (select 1 from public.velvet_house_visits_closed c where c.user_id = (select auth.uid()));
$$;

create or replace function public.velvet_house_set_visits_open(p_open boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if p_open then
    delete from public.velvet_house_visits_closed where user_id = me;
  else
    insert into public.velvet_house_visits_closed (user_id) values (me) on conflict (user_id) do nothing;
  end if;
  return p_open;
end;
$$;

revoke all on function public.velvet_house_friend_houses() from public, anon;
revoke all on function public.velvet_house_visit(uuid) from public, anon;
revoke all on function public.velvet_house_visits_open() from public, anon;
revoke all on function public.velvet_house_set_visits_open(boolean) from public, anon;
grant execute on function public.velvet_house_friend_houses() to authenticated;
grant execute on function public.velvet_house_visit(uuid) to authenticated;
grant execute on function public.velvet_house_visits_open() to authenticated;
grant execute on function public.velvet_house_set_visits_open(boolean) to authenticated;
