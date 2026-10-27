-- Objective XP
--
-- The leaderboard is ranked by XP, and every objective is worth the same flat amount of XP, easy or
-- hard, core or daily (10 each; change objective_xp() to change it for everything, past and future).
-- This replaces the earlier scheme where hard objectives counted double.
--
-- - objective_xp()             XP per objective
-- - objective_days.points      renamed xp, and recalculated as done objectives x objective_xp()
-- - objective_catalog()        no longer has a points column (a hard objective is just a challenge)
-- - get_daily_objectives()     no longer returns points
-- - get_objective_leaderboard  returns xp instead of points; core objectives count too

CREATE OR REPLACE FUNCTION public.objective_xp()
RETURNS int
LANGUAGE sql IMMUTABLE
AS $$ SELECT 10 $$;
REVOKE EXECUTE ON FUNCTION public.objective_xp() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.objective_xp() TO authenticated;

ALTER TABLE public.objective_days RENAME COLUMN points TO xp;
UPDATE public.objective_days SET xp = done_count * public.objective_xp();

DROP FUNCTION IF EXISTS public.get_daily_objectives(timestamptz);
DROP FUNCTION IF EXISTS public.get_objective_leaderboard(text, int);
DROP FUNCTION IF EXISTS public.objective_catalog();

-- The catalogue: at least one objective for every feature.
--   core_target   how many it takes, once ever; not null means it is one of the five core objectives
--   daily_target  how many it takes on every day after; null means it is not offered then
--   hard          a challenge: every daily set after the core five includes exactly one (it earns the
--                 same XP as any other)
--   reported      true: the app reports it with report_activity (a page or game visit);
--                 false: it is counted from what the person did (see objective_counts)
--   needs         something the person must have, or the objective is not offered to them:
--                 'friend' (an accepted friend), 'plan' (an open commitment), 'companion'
CREATE OR REPLACE FUNCTION public.objective_catalog()
RETURNS TABLE (key text, core_target int, daily_target int, hard boolean, reported boolean, needs text)
LANGUAGE sql IMMUTABLE
AS $$
  SELECT * FROM (VALUES
    -- The core five
    ('visit_town',          1,    1,    false, true,  NULL),   -- stroll down your street
    ('comment_in_space',    1,    2,    false, false, NULL),   -- leave a comment in a Space
    ('create_companion',    1,    NULL, false, false, NULL),   -- make a companion
    ('play_velvet_sims',    1,    1,    false, true,  NULL),   -- play Velvet Sims
    ('read_feed',           1,    1,    false, true,  NULL),   -- open your Daily Feed
    -- Town, mail, profile
    ('open_mailbox',        NULL, 1,    false, true,  NULL),
    ('visit_neighbor',      NULL, 1,    false, true,  NULL),   -- open a neighbour's profile
    ('edit_profile',        NULL, 1,    false, true,  NULL),
    ('check_leaderboard',   NULL, 1,    false, true,  NULL),
    ('view_medals',         NULL, 1,    false, true,  NULL),
    -- Spaces and Discover
    ('browse_spaces',       NULL, 1,    false, true,  NULL),
    ('join_a_space',        NULL, 1,    false, false, NULL),
    ('react_in_space',      NULL, 3,    false, false, NULL),
    ('post_in_space',       NULL, 1,    true, false, NULL),
    ('discover_people',     NULL, 1,    false, true,  NULL),
    ('cheer_a_win',         NULL, 3,    false, false, NULL),
    ('comment_on_wins',     NULL, 3,    true, false, NULL),   -- comment on neighbours' progress and statuses
    -- Friends
    ('add_friend',          NULL, 1,    false, false, NULL),
    ('message_friend',      NULL, 3,    true, false, 'friend'),
    -- Coaches, companions, Atlas, Navi
    ('chat_with_helper',    NULL, 3,    false, false, 'companion'),
    ('ask_atlas',           NULL, 1,    false, false, NULL),
    ('explore_navi',        NULL, 1,    false, false, NULL),
    ('use_co_author',       NULL, 1,    false, true,  NULL),
    -- Goals and plans
    ('set_a_goal',          NULL, 1,    true, false, NULL),
    ('make_commitment',     NULL, 1,    true, false, NULL),
    ('complete_step',       NULL, 1,    true, false, 'plan'),
    ('view_progress',       NULL, 1,    false, true,  NULL),
    ('coaching_library',    NULL, 1,    false, true,  NULL),
    ('check_insights',      NULL, 1,    false, true,  NULL),
    -- Calendar, journal, feed, videos
    ('view_calendar',       NULL, 1,    false, true,  NULL),
    ('add_to_calendar',     NULL, 1,    false, false, NULL),
    ('morning_journal',     NULL, 1,    false, false, NULL),
    ('watch_videos',        NULL, 1,    false, true,  NULL),
    -- Games
    ('play_game',           NULL, 1,    false, true,  NULL),   -- any game
    ('play_shootout',       NULL, 1,    false, true,  NULL),
    ('play_checkers',       NULL, 1,    false, true,  NULL),
    ('play_momentum',       NULL, 1,    false, true,  NULL),
    ('play_slime_soccer',   NULL, 1,    false, true,  NULL),
    ('play_stellar',        NULL, 1,    false, true,  NULL),
    ('play_social_combat',  NULL, 1,    false, true,  NULL),
    ('play_pacman',         NULL, 1,    false, true,  NULL),
    ('real_or_not',         NULL, 1,    false, true,  NULL),
    ('memory_training',     NULL, 1,    false, true,  NULL),
    -- Around the site
    ('change_background',   NULL, 1,    false, true,  NULL),
    ('see_whats_new',       NULL, 1,    false, true,  NULL)
  ) AS c(key, core_target, daily_target, hard, reported, needs);
$$;
REVOKE EXECUTE ON FUNCTION public.objective_catalog() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.objective_catalog() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_daily_objectives(p_day_start timestamptz)
RETURNS TABLE (key text, progress int, target int, done boolean, hard boolean, core boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_start timestamptz := p_day_start;
  v_end timestamptz;
  v_day date;
  v_counts jsonb;
  v_lifetime jsonb;
  v_keys text[];
  v_core_done int;
  v_done int;
  v_total int;
  v_xp int;
  v_has_friend boolean;
  v_has_plan boolean;
  v_has_companion boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  -- Local midnight can only be within the last day and a half; anything else is treated as UTC midnight.
  IF v_start IS NULL OR v_start > now() OR v_start < now() - interval '36 hours' THEN
    v_start := date_trunc('day', now());
  END IF;
  v_end := v_start + interval '1 day';
  -- Keyed by the middle of their day, so it is the same date whatever the time zone.
  v_day := ((v_start + interval '12 hours') AT TIME ZONE 'UTC')::date;

  -- The core five: judged over everything they have ever done, and remembered once done.
  v_lifetime := public.objective_counts(v_uid, '-infinity'::timestamptz, 'infinity'::timestamptz);
  INSERT INTO public.objective_core_done (user_id, key)
  SELECT v_uid, c.key FROM public.objective_catalog() c
  WHERE c.core_target IS NOT NULL AND COALESCE((v_lifetime ->> c.key)::int, 0) >= c.core_target
  ON CONFLICT DO NOTHING;
  SELECT count(*) INTO v_core_done FROM public.objective_core_done d WHERE d.user_id = v_uid;

  IF v_core_done < (SELECT count(*) FROM public.objective_catalog() c WHERE c.core_target IS NOT NULL) THEN
    RETURN QUERY
    SELECT c.key,
           CASE WHEN d.key IS NOT NULL THEN c.core_target ELSE LEAST(COALESCE((v_lifetime ->> c.key)::int, 0), c.core_target) END,
           c.core_target,
           d.key IS NOT NULL,
           c.hard, true
    FROM public.objective_catalog() c
    LEFT JOIN public.objective_core_done d ON d.user_id = v_uid AND d.key = c.key
    WHERE c.core_target IS NOT NULL
    ORDER BY array_position(ARRAY['visit_town', 'comment_in_space', 'create_companion', 'play_velvet_sims', 'read_feed'], c.key);
    RETURN;
  END IF;

  v_has_friend := EXISTS (SELECT 1 FROM public.im_friendships f WHERE f.status = 'accepted' AND v_uid IN (f.requester_id, f.addressee_id));
  v_has_plan := EXISTS (SELECT 1 FROM public.coaching_commitments m WHERE m.user_id = v_uid AND m.status NOT IN ('completed', 'abandoned', 'cancelled', 'dismissed'));
  v_has_companion := EXISTS (SELECT 1 FROM public.companions c WHERE c.user_id = v_uid AND COALESCE(c.is_active, true));
  -- Four easy ones and one hard one, picked for this person and this day.
  SELECT array_agg(s.key ORDER BY s.grp, s.h) INTO v_keys FROM (
    (SELECT c.key, 1 AS grp, md5(v_uid::text || v_day::text || c.key) AS h
       FROM public.objective_catalog() c
       WHERE NOT c.hard AND c.daily_target IS NOT NULL
         AND (c.needs IS NULL OR (c.needs = 'friend' AND v_has_friend) OR (c.needs = 'plan' AND v_has_plan) OR (c.needs = 'companion' AND v_has_companion))
       ORDER BY 3 LIMIT 4)
    UNION ALL
    (SELECT c.key, 2 AS grp, md5(v_uid::text || v_day::text || c.key) AS h
       FROM public.objective_catalog() c
       WHERE c.hard AND c.daily_target IS NOT NULL
         AND (c.needs IS NULL OR (c.needs = 'friend' AND v_has_friend) OR (c.needs = 'plan' AND v_has_plan) OR (c.needs = 'companion' AND v_has_companion))
       ORDER BY 3 LIMIT 1)
  ) s;

  v_counts := public.objective_counts(v_uid, v_start, v_end);

  SELECT count(*) FILTER (WHERE COALESCE((v_counts ->> c.key)::int, 0) >= c.daily_target),
         count(*)
    INTO v_done, v_total
  FROM public.objective_catalog() c WHERE c.key = ANY (v_keys);

  IF v_done > 0 THEN
    v_xp := v_done * public.objective_xp();
    -- A day only ever goes up: undoing something later does not take XP back.
    INSERT INTO public.objective_days (user_id, day, done_count, total, xp)
    VALUES (v_uid, v_day, v_done, v_total, v_xp)
    ON CONFLICT (user_id, day) DO UPDATE
      SET done_count = EXCLUDED.done_count, total = EXCLUDED.total, xp = EXCLUDED.xp, updated_at = now()
      WHERE public.objective_days.xp < EXCLUDED.xp OR public.objective_days.total <> EXCLUDED.total;
  END IF;

  RETURN QUERY
  SELECT c.key,
         LEAST(COALESCE((v_counts ->> c.key)::int, 0), c.daily_target),
         c.daily_target,
         COALESCE((v_counts ->> c.key)::int, 0) >= c.daily_target,
         c.hard, false
  FROM public.objective_catalog() c
  WHERE c.key = ANY (v_keys)
  ORDER BY array_position(v_keys, c.key);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_daily_objectives(timestamptz) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_daily_objectives(timestamptz) TO authenticated;

-- The leaderboard. People only: bots, seeded and banned profiles are left out, and so is anyone
-- who has blocked you or been blocked by you. Names are nicknames, never real names.
-- p_period: 'week' (the last seven days) or 'all'. Returns the top p_limit and, if you are not in
-- them, your own row with your true rank.
CREATE OR REPLACE FUNCTION public.get_objective_leaderboard(p_period text DEFAULT 'week', p_limit int DEFAULT 50)
RETURNS TABLE (rank int, user_id uuid, nickname text, xp int, full_days int, is_you boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_since date;
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  v_since := CASE WHEN p_period = 'all' THEN date '1900-01-01' ELSE current_date - 6 END;

  RETURN QUERY
  WITH scored AS (
    SELECT u.uid, sum(u.pts)::int AS pts, sum(u.full)::int AS full FROM (
      SELECT d.user_id AS uid, d.xp AS pts, (d.done_count = d.total)::int AS full
      FROM public.objective_days d WHERE d.day >= v_since
      UNION ALL
      -- Each core objective is worth the same XP, the day it was finished.
      SELECT c.user_id, public.objective_xp(), 0 FROM public.objective_core_done c WHERE c.done_at::date >= v_since
    ) u
    GROUP BY u.uid
  ),
  people AS (
    SELECT s.uid, s.pts, s.full,
           COALESCE(NULLIF(btrim(up.nickname), ''), NULLIF(btrim(mp.display_name), ''), 'Neighbor') AS nick
    FROM scored s
    JOIN public.user_profiles up ON up.id = s.uid
    LEFT JOIN public.member_profiles mp ON mp.user_id = s.uid
    WHERE COALESCE(up.is_bot, false) = false
      AND COALESCE(mp.is_bot, false) = false
      AND COALESCE(up.is_banned, false) = false
      AND (s.uid = v_uid OR NOT public.users_blocked(v_uid, s.uid))
  ),
  ranked AS (
    SELECT p.*, (rank() OVER (ORDER BY p.pts DESC, p.full DESC))::int AS rk FROM people p
  )
  SELECT r.rk, r.uid, r.nick, r.pts, r.full, (r.uid = v_uid)
  FROM ranked r
  WHERE r.rk <= v_limit OR r.uid = v_uid
  ORDER BY r.rk, r.nick
  LIMIT v_limit + 1;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_objective_leaderboard(text, int) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_objective_leaderboard(text, int) TO authenticated;

