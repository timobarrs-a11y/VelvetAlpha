-- Velvet Sims: shared clothing designs.
--
-- A design is a garment recipe in its share code (src/games/velvet-house/state/garment.ts): a few hundred characters,
-- no images. Players can keep one private, show it to friends, or offer it to the public gallery.
--
--   friends  visible to accepted friends straight away (a design is text, and its name is checked by the
--            edge function that publishes it)
--   public   goes to a review queue first. A moderator approves it before it shows in the gallery, because a pixel
--            design is a picture and a picture needs eyes on it
--
-- Anyone who can see a design can report it; three different reporters hide it until a moderator looks.
--
-- Nobody reads or writes the tables directly. Publishing goes through the `velvet-design-share` edge function (it checks
-- the name with the app's moderation, then calls velvet_design_publish with the service role); reading, reporting,
-- deleting and reviewing are functions that check who is asking.

create table if not exists public.velvet_designs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  code text not null check (char_length(code) between 20 and 700),
  visibility text not null default 'friends' check (visibility in ('private', 'friends', 'public')),
  status text not null default 'approved' check (status in ('approved', 'pending', 'hidden', 'rejected')),
  report_count integer not null default 0 check (report_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists velvet_designs_owner_idx on public.velvet_designs (owner_id, created_at desc);
create index if not exists velvet_designs_listing_idx on public.velvet_designs (visibility, status, created_at desc);

create table if not exists public.velvet_design_reports (
  design_id uuid not null references public.velvet_designs(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  primary key (design_id, reporter_id)
);

alter table public.velvet_designs enable row level security;
alter table public.velvet_design_reports enable row level security;
revoke all on public.velvet_designs from anon, authenticated;
revoke all on public.velvet_design_reports from anon, authenticated;

-- Friends, and not blocked either way. Used by the functions below only.
create or replace function public.velvet_designs_are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.im_friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b) or (f.requester_id = b and f.addressee_id = a))
  ) and not exists (
    select 1 from public.im_blocks k
    where (k.blocker_id = a and k.blocked_id = b) or (k.blocker_id = b and k.blocked_id = a)
  );
$$;
revoke all on function public.velvet_designs_are_friends(uuid, uuid) from public, anon, authenticated;

-- Blocked either way (for the public gallery, where the two need not be friends).
create or replace function public.velvet_designs_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.im_blocks k
    where (k.blocker_id = a and k.blocked_id = b) or (k.blocker_id = b and k.blocked_id = a)
  );
$$;
revoke all on function public.velvet_designs_blocked(uuid, uuid) from public, anon, authenticated;

create or replace function public.velvet_designs_is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select up.is_super_user from public.user_profiles up where up.id = (select auth.uid())), false);
$$;

-- Edge function only: add a design. Limits keep one account from filling the gallery.
create or replace function public.velvet_design_publish(p_owner uuid, p_name text, p_code text, p_visibility text)
returns table (id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_status text;
  v_id uuid;
begin
  if p_visibility not in ('private', 'friends', 'public') then raise exception 'bad_visibility'; end if;
  if char_length(v_name) not between 1 and 24 then raise exception 'bad_name'; end if;
  if p_code is null or p_code !~ '^VH-[0-9A-Z]{4}(-[0-9A-Z]{1,5})+$' or char_length(p_code) > 700 then raise exception 'bad_code'; end if;
  if exists (select 1 from public.user_profiles up where up.id = p_owner and up.is_banned) then raise exception 'banned'; end if;
  if (select count(*) from public.velvet_designs d where d.owner_id = p_owner) >= 40 then raise exception 'too_many'; end if;
  if (select count(*) from public.velvet_designs d where d.owner_id = p_owner and d.created_at > now() - interval '1 day') >= 10 then raise exception 'slow_down'; end if;

  v_status := case when p_visibility = 'public' then 'pending' else 'approved' end;
  insert into public.velvet_designs (owner_id, name, code, visibility, status)
  values (p_owner, v_name, p_code, p_visibility, v_status)
  returning velvet_designs.id into v_id;
  return query select v_id, v_status;
end;
$$;
revoke all on function public.velvet_design_publish(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.velvet_design_publish(uuid, text, text, text) to service_role;

-- What friends have shared (their friends-only and approved public designs).
create or replace function public.velvet_designs_from_friends()
returns table (id uuid, owner_id uuid, owner_name text, name text, code text, visibility text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.owner_id, public.im_member_display_name(d.owner_id), d.name, d.code, d.visibility, d.created_at
  from public.velvet_designs d
  where (select auth.uid()) is not null
    and d.owner_id <> (select auth.uid())
    and d.status = 'approved'
    and d.visibility in ('friends', 'public')
    and public.velvet_designs_are_friends((select auth.uid()), d.owner_id)
  order by d.created_at desc
  limit 60;
$$;

-- The public gallery: approved designs, newest first.
create or replace function public.velvet_designs_gallery(p_limit integer default 40, p_offset integer default 0)
returns table (id uuid, owner_id uuid, owner_name text, name text, code text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.owner_id, public.im_member_display_name(d.owner_id), d.name, d.code, d.created_at
  from public.velvet_designs d
  where (select auth.uid()) is not null
    and d.visibility = 'public'
    and d.status = 'approved'
    and not public.velvet_designs_blocked((select auth.uid()), d.owner_id)
  order by d.created_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 60))
  offset greatest(0, coalesce(p_offset, 0));
$$;

create or replace function public.velvet_designs_mine()
returns table (id uuid, name text, code text, visibility text, status text, report_count integer, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.name, d.code, d.visibility, d.status, d.report_count, d.created_at
  from public.velvet_designs d
  where d.owner_id = (select auth.uid())
  order by d.created_at desc
  limit 60;
$$;

create or replace function public.velvet_design_delete(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from public.velvet_designs d where d.id = p_id and d.owner_id = (select auth.uid());
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

-- Report a design you can see. Three different reporters hide it until a moderator has looked.
create or replace function public.velvet_design_report(p_id uuid, p_reason text default '')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := (select auth.uid());
  d public.velvet_designs;
  n integer;
  v_status text;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  select * into d from public.velvet_designs where id = p_id;
  if not found or d.owner_id = me or d.status <> 'approved' then return 'unavailable'; end if;
  if not ((d.visibility = 'public' and not public.velvet_designs_blocked(me, d.owner_id))
          or (d.visibility = 'friends' and public.velvet_designs_are_friends(me, d.owner_id))) then
    return 'unavailable';
  end if;
  insert into public.velvet_design_reports (design_id, reporter_id, reason)
  values (p_id, me, left(coalesce(p_reason, ''), 200))
  on conflict (design_id, reporter_id) do nothing;
  select count(*) into n from public.velvet_design_reports where design_id = p_id;
  update public.velvet_designs
     set report_count = n, status = case when n >= 3 then 'hidden' else status end
   where id = p_id
  returning status into v_status;
  return v_status;
end;
$$;

-- Moderators only: what is waiting (new public designs, and ones hidden by reports).
create or replace function public.velvet_designs_pending()
returns table (id uuid, owner_id uuid, owner_name text, name text, code text, visibility text, status text, report_count integer, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.owner_id, public.im_member_display_name(d.owner_id), d.name, d.code, d.visibility, d.status, d.report_count, d.created_at
  from public.velvet_designs d
  where public.velvet_designs_is_moderator() and d.status in ('pending', 'hidden')
  order by d.report_count desc, d.created_at asc
  limit 60;
$$;

create or replace function public.velvet_design_review(p_id uuid, p_approve boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if not public.velvet_designs_is_moderator() then raise exception 'not_allowed'; end if;
  update public.velvet_designs
     set status = case when p_approve then 'approved' else 'rejected' end,
         report_count = case when p_approve then 0 else report_count end
   where id = p_id
  returning status into v_status;
  if p_approve then delete from public.velvet_design_reports where design_id = p_id; end if;
  return v_status;
end;
$$;

revoke all on function public.velvet_designs_is_moderator() from public, anon;
revoke all on function public.velvet_designs_from_friends() from public, anon;
revoke all on function public.velvet_designs_gallery(integer, integer) from public, anon;
revoke all on function public.velvet_designs_mine() from public, anon;
revoke all on function public.velvet_design_delete(uuid) from public, anon;
revoke all on function public.velvet_design_report(uuid, text) from public, anon;
revoke all on function public.velvet_designs_pending() from public, anon;
revoke all on function public.velvet_design_review(uuid, boolean) from public, anon;
grant execute on function public.velvet_designs_is_moderator() to authenticated;
grant execute on function public.velvet_designs_from_friends() to authenticated;
grant execute on function public.velvet_designs_gallery(integer, integer) to authenticated;
grant execute on function public.velvet_designs_mine() to authenticated;
grant execute on function public.velvet_design_delete(uuid) to authenticated;
grant execute on function public.velvet_design_report(uuid, text) to authenticated;
grant execute on function public.velvet_designs_pending() to authenticated;
grant execute on function public.velvet_design_review(uuid, boolean) to authenticated;
