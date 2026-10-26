-- Velvet Sims: a daily allowance for AI replies, enforced on the server.
--
-- The game's chat calls the `velvet-game-turn` edge function. Without a limit, one player (or an edited
-- browser) could run up AI cost without bound. This table counts credits per person per day (UTC); the
-- edge function spends one credit per reply through `velvet_game_spend`, which is atomic.
--
-- Clients can neither read nor write this table. Only the edge function (service role) calls the function.

create table if not exists public.velvet_game_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  credits integer not null default 0 check (credits >= 0),
  primary key (user_id, day)
);

alter table public.velvet_game_usage enable row level security;
revoke all on public.velvet_game_usage from anon, authenticated;

-- Spends p_cost credits if the day's total stays within p_limit.
-- Returns ok (spent or not), used (credits used today after the call), remaining (credits left).
create or replace function public.velvet_game_spend(p_user_id uuid, p_cost integer, p_limit integer)
returns table (ok boolean, used integer, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_used integer;
begin
  if p_cost < 0 or p_limit < 0 then
    raise exception 'invalid amount';
  end if;

  insert into public.velvet_game_usage (user_id, day, credits)
  values (p_user_id, v_day, 0)
  on conflict (user_id, day) do nothing;

  update public.velvet_game_usage u
     set credits = u.credits + p_cost
   where u.user_id = p_user_id and u.day = v_day and u.credits + p_cost <= p_limit
  returning u.credits into v_used;

  if found then
    return query select true, v_used, greatest(p_limit - v_used, 0);
  end if;

  select u.credits into v_used from public.velvet_game_usage u where u.user_id = p_user_id and u.day = v_day;
  return query select false, coalesce(v_used, 0), greatest(p_limit - coalesce(v_used, 0), 0);
end;
$$;

revoke all on function public.velvet_game_spend(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.velvet_game_spend(uuid, integer, integer) to service_role;

-- Old rows are not needed after a few days.
create index if not exists velvet_game_usage_day_idx on public.velvet_game_usage (day);
