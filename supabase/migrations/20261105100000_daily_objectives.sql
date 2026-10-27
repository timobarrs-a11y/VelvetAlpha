-- Daily objectives
--
-- Things to do on the site each day, one or more for every feature. The toolbar shows "2/5 today"
-- and a dropdown of what's left; tapping one takes you there. Finishing every objective in a day
-- counts toward three new medals, and every objective finished is a point on a site-wide
-- leaderboard.
--
-- Two stages:
-- - Core objectives: five that walk a new member through the site, once each, in any order: visit
--   the Town, leave a comment in a Space, make a companion, play Velvet Sims, open the Daily Feed.
--   Nothing else is offered until all five are done, and they stay done. Anyone who did one before
--   (a comment, a companion) is credited for it.
-- - Daily objectives, once the core five are done: five picked from the catalogue of about forty
--   for that person and that day (four easy ones and one hard one), so no two days are the same.
--   Hard ones count double.
--
-- Most objectives are read straight from what people already did (posts, comments, likes, chats,
-- finished steps), so they cannot be ticked without doing them and they check themselves off the
-- moment the action is saved. Pages that leave no record of a visit (the Town, the mailbox, the
-- feed, insights, a game) report it with report_activity().
--
-- Tables (no direct access for anyone; everything goes through the functions below)
-- - daily_activity       page and game visits, stamped by the server
-- - objective_core_done  which core objectives each person has finished, and when
-- - objective_days       how each person did each daily set: objectives done, how many there were, points
--
-- RPCs
-- - report_activity(p_key)                       record a page or game visit (only keys the catalogue lists)
-- - get_daily_objectives(p_day_start)            today's objectives and progress; p_day_start is the
--                                                user's local midnight, so "today" follows their clock
-- - objective_catalog()                          every objective and its targets
-- - get_objective_leaderboard(p_period, p_limit) the top people, plus you wherever you are
--
-- Everyone who is a person (not a bot or a seeded profile) is on the leaderboard, by nickname only.
-- Also: medal_stats() gains objective_days and core_objectives, and there are four new medals:
-- Settled In (the core five), Daily Driver, On a Roll and Town Regular.

CREATE TABLE IF NOT EXISTS public.daily_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity text NOT NULL,
  happened_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS daily_activity_user_time_idx ON public.daily_activity (user_id, activity, happened_at DESC);
ALTER TABLE public.daily_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.daily_activity FROM anon, authenticated, public;

CREATE TABLE IF NOT EXISTS public.objective_days (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  done_count smallint NOT NULL CHECK (done_count >= 1),
  total smallint NOT NULL CHECK (total >= 1),
  points int NOT NULL CHECK (points >= 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
CREATE INDEX IF NOT EXISTS objective_days_day_idx ON public.objective_days (day DESC);
ALTER TABLE public.objective_days ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.objective_days FROM anon, authenticated, public;

CREATE TABLE IF NOT EXISTS public.objective_core_done (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  done_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);
CREATE INDEX IF NOT EXISTS objective_core_done_at_idx ON public.objective_core_done (done_at DESC);
ALTER TABLE public.objective_core_done ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.objective_core_done FROM anon, authenticated, public;

-- The catalogue: at least one objective for every feature.
--   core_target   how many it takes, once ever; not null means it is one of the five core objectives
--   daily_target  how many it takes on every day after; null means it is not offered then
--   hard          hard ones count double, and every day after day one includes exactly one
--   reported      true: the app reports it with report_activity (a page or game visit);
--                 false: it is counted from what the person did (see objective_counts)
--   needs         something the person must have, or the objective is not offered to them:
--                 'friend' (an accepted friend), 'plan' (an open commitment), 'companion'
CREATE OR REPLACE FUNCTION public.objective_catalog()
RETURNS TABLE (key text, core_target int, daily_target int, hard boolean, points int, reported boolean, needs text)
LANGUAGE sql IMMUTABLE
AS $$
  SELECT * FROM (VALUES
    -- The core five
    ('visit_town',          1,    1,    false, 1, true,  NULL),   -- stroll down your street
    ('comment_in_space',    1,    2,    false, 1, false, NULL),   -- leave a comment in a Space
    ('create_companion',    1,    NULL, false, 1, false, NULL),   -- make a companion
    ('play_velvet_sims',    1,    1,    false, 1, true,  NULL),   -- play Velvet Sims
    ('read_feed',           1,    1,    false, 1, true,  NULL),   -- open your Daily Feed
    -- Town, mail, profile
    ('open_mailbox',        NULL, 1,    false, 1, true,  NULL),
    ('visit_neighbor',      NULL, 1,    false, 1, true,  NULL),   -- open a neighbour's profile
    ('edit_profile',        NULL, 1,    false, 1, true,  NULL),
    ('check_leaderboard',   NULL, 1,    false, 1, true,  NULL),
    ('view_medals',         NULL, 1,    false, 1, true,  NULL),
    -- Spaces and Discover
    ('browse_spaces',       NULL, 1,    false, 1, true,  NULL),
    ('join_a_space',        NULL, 1,    false, 1, false, NULL),
    ('react_in_space',      NULL, 3,    false, 1, false, NULL),
    ('post_in_space',       NULL, 1,    true,  2, false, NULL),
    ('discover_people',     NULL, 1,    false, 1, true,  NULL),
    ('cheer_a_win',         NULL, 3,    false, 1, false, NULL),
    ('comment_on_wins',     NULL, 3,    true,  2, false, NULL),   -- comment on neighbours' progress and statuses
    -- Friends
    ('add_friend',          NULL, 1,    false, 1, false, NULL),
    ('message_friend',      NULL, 3,    true,  2, false, 'friend'),
    -- Coaches, companions, Atlas, Navi
    ('chat_with_helper',    NULL, 3,    false, 1, false, 'companion'),
    ('ask_atlas',           NULL, 1,    false, 1, false, NULL),
    ('explore_navi',        NULL, 1,    false, 1, false, NULL),
    ('use_co_author',       NULL, 1,    false, 1, true,  NULL),
    -- Goals and plans
    ('set_a_goal',          NULL, 1,    true,  2, false, NULL),
    ('make_commitment',     NULL, 1,    true,  2, false, NULL),
    ('complete_step',       NULL, 1,    true,  2, false, 'plan'),
    ('view_progress',       NULL, 1,    false, 1, true,  NULL),
    ('coaching_library',    NULL, 1,    false, 1, true,  NULL),
    ('check_insights',      NULL, 1,    false, 1, true,  NULL),
    -- Calendar, journal, feed, videos
    ('view_calendar',       NULL, 1,    false, 1, true,  NULL),
    ('add_to_calendar',     NULL, 1,    false, 1, false, NULL),
    ('morning_journal',     NULL, 1,    false, 1, false, NULL),
    ('watch_videos',        NULL, 1,    false, 1, true,  NULL),
    -- Games
    ('play_game',           NULL, 1,    false, 1, true,  NULL),   -- any game
    ('play_shootout',       NULL, 1,    false, 1, true,  NULL),
    ('play_checkers',       NULL, 1,    false, 1, true,  NULL),
    ('play_momentum',       NULL, 1,    false, 1, true,  NULL),
    ('play_slime_soccer',   NULL, 1,    false, 1, true,  NULL),
    ('play_stellar',        NULL, 1,    false, 1, true,  NULL),
    ('play_social_combat',  NULL, 1,    false, 1, true,  NULL),
    ('play_pacman',         NULL, 1,    false, 1, true,  NULL),
    ('real_or_not',         NULL, 1,    false, 1, true,  NULL),
    ('memory_training',     NULL, 1,    false, 1, true,  NULL),
    -- Around the site
    ('change_background',   NULL, 1,    false, 1, true,  NULL),
    ('see_whats_new',       NULL, 1,    false, 1, true,  NULL)
  ) AS c(key, core_target, daily_target, hard, points, reported, needs);
$$;
REVOKE EXECUTE ON FUNCTION public.objective_catalog() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.objective_catalog() TO authenticated;

CREATE OR REPLACE FUNCTION public.report_activity(p_key text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.objective_catalog() c WHERE c.key = p_key AND c.reported) THEN
    RAISE EXCEPTION 'Unknown activity';
  END IF;
  -- One a minute is plenty; a held-down refresh does not fill the table.
  IF EXISTS (
    SELECT 1 FROM public.daily_activity
    WHERE user_id = auth.uid() AND activity = p_key AND happened_at > now() - interval '1 minute'
  ) THEN RETURN; END IF;
  INSERT INTO public.daily_activity (user_id, activity) VALUES (auth.uid(), p_key);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.report_activity(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.report_activity(text) TO authenticated;

-- How far someone got within [p_start, p_end): what they did, plus the visits they reported.
CREATE OR REPLACE FUNCTION public.objective_counts(p_uid uuid, p_start timestamptz, p_end timestamptz)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT jsonb_object_agg(a.activity, a.n)
    FROM (SELECT activity, count(*) AS n FROM public.daily_activity
          WHERE user_id = p_uid AND happened_at >= p_start AND happened_at < p_end GROUP BY activity) a
  ), '{}'::jsonb) || jsonb_build_object(
    'chat_with_helper',  (SELECT count(*) FROM public.conversations c WHERE c.user_id = p_uid AND c.role = 'user' AND c.created_at >= p_start AND c.created_at < p_end),
    'comment_in_space',  (SELECT count(*) FROM public.community_comments c WHERE c.author_id = p_uid AND c.created_at >= p_start AND c.created_at < p_end),
    'post_in_space',     (SELECT count(*) FROM public.community_posts p WHERE p.author_id = p_uid AND p.created_at >= p_start AND p.created_at < p_end),
    'react_in_space',    (SELECT count(*) FROM public.community_reactions r WHERE r.user_id = p_uid AND r.created_at >= p_start AND r.created_at < p_end),
    'join_a_space',      (SELECT count(*) FROM public.community_board_members m WHERE m.user_id = p_uid AND m.source = 'manual' AND m.joined_at >= p_start AND m.joined_at < p_end),
    'comment_on_wins',   (SELECT count(*) FROM public.progress_post_comments c WHERE c.user_id = p_uid AND COALESCE(c.is_bot, false) = false AND c.created_at >= p_start AND c.created_at < p_end),
    'cheer_a_win',       (SELECT count(*) FROM public.progress_post_likes l WHERE l.user_id = p_uid AND l.created_at >= p_start AND l.created_at < p_end),
    'complete_step',     (SELECT count(*) FROM public.coaching_commitments m WHERE m.user_id = p_uid AND m.status = 'completed' AND m.completed_at >= p_start AND m.completed_at < p_end),
    'make_commitment',   (SELECT count(*) FROM public.coaching_commitments m WHERE m.user_id = p_uid AND m.is_user_created AND m.created_at >= p_start AND m.created_at < p_end),
    'set_a_goal',        (SELECT count(*) FROM public.user_goals g WHERE g.user_id = p_uid AND COALESCE(g.source, '') <> 'atlas' AND g.created_at >= p_start AND g.created_at < p_end),
    'add_friend',        (SELECT count(*) FROM public.im_friendships f WHERE f.requester_id = p_uid AND f.created_at >= p_start AND f.created_at < p_end),
    'message_friend',    (SELECT count(*) FROM public.im_messages m WHERE m.sender_id = p_uid AND m.created_at >= p_start AND m.created_at < p_end),
    -- Helpers made for them by the arrival are not something they did.
    'create_companion',  (SELECT count(*) FROM public.companions c WHERE c.user_id = p_uid AND c.relationship_type NOT IN ('mentor', 'assistant') AND c.created_at >= p_start AND c.created_at < p_end),
    -- Events the arrival wrote for them (their plan's weekly rhythm) are not something they did.
    'add_to_calendar',   (SELECT count(*) FROM public.user_events e WHERE e.user_id = p_uid AND COALESCE(e.metadata ->> 'source', '') NOT IN ('atlas', 'coach', 'assistant') AND e.created_at >= p_start AND e.created_at < p_end),
    'morning_journal',   (SELECT count(*) FROM public.journal_sessions j WHERE j.user_id = p_uid AND j.completed_at >= p_start AND j.completed_at < p_end),
    'ask_atlas',         (SELECT count(*) FROM public.atlas_messages m WHERE m.user_id = p_uid AND m.role = 'user' AND m.created_at >= p_start AND m.created_at < p_end),
    'explore_navi',      (SELECT count(*) FROM public.local_explorer_messages m WHERE m.user_id = p_uid AND m.role = 'user' AND m.created_at >= p_start AND m.created_at < p_end)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.objective_counts(uuid, timestamptz, timestamptz) FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION public.get_daily_objectives(p_day_start timestamptz)
RETURNS TABLE (key text, progress int, target int, done boolean, hard boolean, points int, core boolean)
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
  v_points int;
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
           c.hard, c.points, true
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
         count(*),
         COALESCE(sum(c.points) FILTER (WHERE COALESCE((v_counts ->> c.key)::int, 0) >= c.daily_target), 0)
    INTO v_done, v_total, v_points
  FROM public.objective_catalog() c WHERE c.key = ANY (v_keys);

  IF v_done > 0 THEN
    -- A day only ever goes up: undoing something later does not take a point back.
    INSERT INTO public.objective_days (user_id, day, done_count, total, points)
    VALUES (v_uid, v_day, v_done, v_total, v_points)
    ON CONFLICT (user_id, day) DO UPDATE
      SET done_count = EXCLUDED.done_count, total = EXCLUDED.total, points = EXCLUDED.points, updated_at = now()
      WHERE public.objective_days.points < EXCLUDED.points OR public.objective_days.total <> EXCLUDED.total;
  END IF;

  RETURN QUERY
  SELECT c.key,
         LEAST(COALESCE((v_counts ->> c.key)::int, 0), c.daily_target),
         c.daily_target,
         COALESCE((v_counts ->> c.key)::int, 0) >= c.daily_target,
         c.hard, c.points, false
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
RETURNS TABLE (rank int, user_id uuid, nickname text, points int, full_days int, is_you boolean)
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
      SELECT d.user_id AS uid, d.points AS pts, (d.done_count = d.total)::int AS full
      FROM public.objective_days d WHERE d.day >= v_since
      UNION ALL
      -- Each core objective is a point, the day it was finished.
      SELECT c.user_id, 1, 0 FROM public.objective_core_done c WHERE c.done_at::date >= v_since
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

-- Medals: a full day is a stat like any other.
CREATE OR REPLACE FUNCTION public.medal_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH days AS (
    SELECT checkin_date,
           checkin_date - (row_number() OVER (ORDER BY checkin_date))::int AS grp,
           checkin_date - lag(checkin_date) OVER (ORDER BY checkin_date) AS gap
    FROM public.user_daily_checkins
    WHERE user_id = p_user_id
  ),
  runs AS (
    SELECT count(*) AS len FROM days GROUP BY grp
  )
  SELECT jsonb_build_object(
    'commitments_completed',
      (SELECT count(*) FROM public.coaching_commitments WHERE user_id = p_user_id AND status = 'completed'),
    'coach_commitments_completed',
      (SELECT count(*) FROM public.coaching_commitments WHERE user_id = p_user_id AND status = 'completed' AND is_user_created = false),
    'goals_completed',
      (SELECT count(*) FROM public.user_goals WHERE user_id = p_user_id AND status = 'completed'),
    'best_goal_percent',
      (SELECT COALESCE(max(floor(LEAST(current_value / target_value, 1) * 100)), 0)::int
       FROM public.user_goals
       WHERE user_id = p_user_id AND target_value > 0 AND current_value IS NOT NULL AND status <> 'abandoned'),
    'longest_streak',
      (SELECT COALESCE(max(longest_streak), 0) FROM public.user_customization WHERE user_id = p_user_id),
    'seven_day_streaks',
      (SELECT count(*) FROM runs WHERE len >= 7),
    'comeback',
      (SELECT CASE WHEN EXISTS (SELECT 1 FROM days WHERE gap >= 15) THEN 1 ELSE 0 END),
    'friends',
      (SELECT count(*) FROM public.im_friendships
       WHERE status = 'accepted' AND (requester_id = p_user_id OR addressee_id = p_user_id)),
    'likes_given',
      (SELECT count(*) FROM public.community_reactions WHERE user_id = p_user_id)
      + (SELECT count(*) FROM public.progress_post_likes WHERE user_id = p_user_id),
    'reactions_received',
      (SELECT count(*) FROM public.community_reactions r
       WHERE r.user_id <> p_user_id AND (
         (r.target_type = 'post' AND EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = r.target_id AND p.author_id = p_user_id))
         OR (r.target_type = 'comment' AND EXISTS (SELECT 1 FROM public.community_comments c WHERE c.id = r.target_id AND c.author_id = p_user_id))
       )),
    'referrals',
      (SELECT count(*) FROM public.referrals WHERE referrer_id = p_user_id AND status = 'qualified'),
    'posts_created',
      (SELECT count(*) FROM public.community_posts WHERE author_id = p_user_id),
    'comments_created',
      (SELECT count(*) FROM public.community_comments WHERE author_id = p_user_id),
    'spaces_joined_manually',
      (SELECT count(*) FROM public.community_board_members WHERE user_id = p_user_id AND source = 'manual'),
    'room_messages',
      (SELECT count(*) FROM public.community_room_messages WHERE author_id = p_user_id AND deleted_at IS NULL),
    'alpha_member',
      (SELECT count(*) FROM public.community_board_members
       WHERE user_id = p_user_id AND board_id = 'b0000000-0000-0000-0000-000000000100'),
    'objective_days',
      (SELECT count(*) FROM public.objective_days WHERE user_id = p_user_id AND done_count = total),
    'core_objectives',
      (SELECT count(*) FROM public.objective_core_done WHERE user_id = p_user_id)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.medal_stats(uuid) FROM anon, authenticated, public;

-- Reaching a full day, or finishing a core objective, recalculates that person's medals, like any other medal-earning action.
CREATE OR REPLACE FUNCTION public.objective_days_medals()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.refresh_user_medals(NEW.user_id, true);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'refresh_user_medals failed for %: %', NEW.user_id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.objective_days_medals() FROM anon, authenticated, public;
DROP TRIGGER IF EXISTS trg_objective_core_medals ON public.objective_core_done;
CREATE TRIGGER trg_objective_core_medals AFTER INSERT ON public.objective_core_done
  FOR EACH ROW EXECUTE FUNCTION public.objective_days_medals();
DROP TRIGGER IF EXISTS trg_objective_days_medals ON public.objective_days;
CREATE TRIGGER trg_objective_days_medals AFTER INSERT OR UPDATE ON public.objective_days
  FOR EACH ROW WHEN (NEW.done_count = NEW.total) EXECUTE FUNCTION public.objective_days_medals();

INSERT INTO public.medals (slug, name, description, category, tier, icon, metric, threshold, is_hidden, sort_order)
VALUES
  ('settled-in',   'Settled In',   'Finish the five core objectives.',                'streaks', 'bronze', 'Flag',          'core_objectives', 5,  false, 23),
  ('daily-driver', 'Daily Driver', 'Finish every objective in a day.',        'streaks', 'bronze', 'CalendarCheck', 'objective_days', 1,  false, 24),
  ('on-a-roll',    'On a Roll',    'Finish a full day of objectives 7 times.',        'streaks', 'silver', 'Repeat',        'objective_days', 7,  false, 25),
  ('town-regular', 'Town Regular', 'Finish a full day of objectives 30 times.',       'streaks', 'gold',   'Trophy',        'objective_days', 30, false, 26)
ON CONFLICT (slug) DO NOTHING;
