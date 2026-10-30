-- Stand-ins for 20261111100000_velvet_house_visits.sql, on top of velvet_designs_stub.sql (which it uses for friends):
--   psql -d scratch -f velvet_designs_stub.sql -f velvet_house_visits_stub.sql -f ../migrations/20261029100001_velvet_designs.sql \
--        -f ../migrations/20261111100000_velvet_house_visits.sql -f velvet_house_visits_behaviour.sql
create table public.companions (id uuid primary key default gen_random_uuid());
create table public.velvet_house_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  companion_id uuid not null references public.companions(id),
  save_data jsonb not null default '{}'::jsonb,
  save_data_v2 jsonb,
  updated_at timestamptz default now(),
  unique (user_id, companion_id)
);
alter table public.velvet_house_saves enable row level security;
create policy own on public.velvet_house_saves for all to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.velvet_house_saves to authenticated;
