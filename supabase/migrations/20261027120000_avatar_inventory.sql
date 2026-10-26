-- Avatar inventory: the avatar items each person owns (see src/data/avatarCatalog.ts).
-- An item is one choice in one slot, written slot:value, e.g. hairStyle:bantu_knots.
-- Owned items are usable everywhere: the avatar creator, the app, and Velvet Sims.
--
-- People can read their own inventory but never write to it directly: items
-- only arrive through the functions below.

create table if not exists public.avatar_inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null
    check (item_id ~ '^(hairStyle|hairColor|hairHighlight|outfit|outfitColor|headwear|faceAccessory|glasses|earrings|necklace):[#a-zA-Z0-9_-]{1,40}$'),
  source text not null check (source in ('sims', 'reward', 'medal', 'grant', 'purchase')),
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.avatar_inventory enable row level security;

drop policy if exists "Read own avatar inventory" on public.avatar_inventory;
create policy "Read own avatar inventory" on public.avatar_inventory
  for select to authenticated using (user_id = auth.uid());

revoke all on public.avatar_inventory from anon, authenticated;
grant select on public.avatar_inventory to authenticated;

-- Bought in the Velvet Sims shop. Velvet Sims money still lives in the
-- player's browser, so this trusts the game: before shop items are worth
-- anything, the Sims wallet should move server-side and this should check
-- and spend the balance here.
create or replace function public.record_sims_avatar_unlock(p_item_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into public.avatar_inventory (user_id, item_id, source)
  values (auth.uid(), p_item_id, 'sims')
  on conflict (user_id, item_id) do nothing;
end;
$$;

revoke all on function public.record_sims_avatar_unlock(text) from public, anon;
grant execute on function public.record_sims_avatar_unlock(text) to authenticated;

-- Rewards, medals and gifts: granted by the server only (other functions,
-- edge functions with the service role, or an admin), never by a client.
create or replace function public.grant_avatar_item(p_user_id uuid, p_item_id text, p_source text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.avatar_inventory (user_id, item_id, source)
  values (p_user_id, p_item_id, p_source)
  on conflict (user_id, item_id) do nothing;
$$;

revoke all on function public.grant_avatar_item(uuid, text, text) from public, anon, authenticated;
