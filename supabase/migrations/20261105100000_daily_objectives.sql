-- Daily objectives
--
-- Five small things to do on the site each day (visit the Town, post or comment in a Space, cheer a
-- neighbour's win, finish a step of your plan, play a game). The toolbar shows "2/5 today" and a
-- dropdown of what's left. Finishing all five in a day counts toward three new medals.
--
-- Most objectives are read straight from what people already did (posts, comments, likes,
-- reactions, finished commitments), so they cannot be ticked without doing them and they check
-- themselves off the moment the action is saved. Two have no table of their own (visiting the Town,
-- playing a game), so the app reports them with report_activity().
--
-- Everyone who is a person (not a bot or a seeded profile) is on one site-wide leaderboard, by
-- nickname only: a point for every objective finished, this week or all time.
--
-- Tables (no direct access for anyone; everything goes through the functions below)
-- - daily_activity   "visit_town" and "play_game" events, stamped by the server
-- - objective_days   how many of the five each person finished each day (a full day is 5)
--
-- RPCs
-- - report_activity(p_key)                   record a visit_town or play_game
-- - get_daily_objectives(p_day_start)        today's five and which are done; p_day_start is the
--                                            user's local midnight, so "today" follows their clock
-- - get_objective_leaderboard(p_period, p_limit)  the top people, plus you wherever you are
--
-- Also: medal_stats() gains objective_days, and the medals Daily Driver, On a Roll and Town Regular.

CREATE TABLE IF NOT EXISTS public.daily_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity text NOT NULL CHECK (activity IN ('visit_town', 'play_game')),
  happened_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS daily_activity_user_time_idx ON public.daily_activity (user_id, activity, happened_at DESC);
ALTER TABLE public.daily_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.daily_activity FROM anon, authenticated, public;

CREATE TABLE IF NOT EXISTS public.objective_days (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  done_count smallint NOT NULL CHECK (done_count BETWEEN 1 AND 5),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
CREATE INDEX IF NOT EXISTS objective_days_day_idx ON public.objective_days (day DESC);
ALTER TABLE public.objective_days ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.objective_days FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION public.report_activity(p_key text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_key NOT IN ('visit_town', 'play_game') THEN RAISE EXCEPTION 'Unknown activity'; END IF;
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

CREATE OR REPLACE FUNCTION public.get_daily_objectives(p_day_start timestamptz)
RETURNS TABLE (key text, done boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_start timestamptz := p_day_start;
  v_end timestamptz;
  v_town boolean;
  v_game boolean;
  v_post boolean;
  v_cheer boolean;
  v_step boolean;
  v_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  -- Local midnight can only be within the last day and a half; anything else is treated as UTC midnight.
  IF v_start IS NULL OR v_start > now() OR v_start < now() - interval '36 hours' THEN
    v_start := date_trunc('day', now());
  END IF;
  v_end := v_start + interval '1 day';

  v_town := EXISTS (SELECT 1 FROM public.daily_activity a WHERE a.user_id = v_uid AND a.activity = 'visit_town' AND a.happened_at >= v_start AND a.happened_at < v_end);
  v_game := EXISTS (SELECT 1 FROM public.daily_activity a WHERE a.user_id = v_uid AND a.activity = 'play_game' AND a.happened_at >= v_start AND a.happened_at < v_end);
  v_post := EXISTS (SELECT 1 FROM public.community_posts p WHERE p.author_id = v_uid AND p.created_at >= v_start AND p.created_at < v_end)
         OR EXISTS (SELECT 1 FROM public.community_comments c WHERE c.author_id = v_uid AND c.created_at >= v_start AND c.created_at < v_end);
  v_cheer := EXISTS (SELECT 1 FROM public.progress_post_likes l WHERE l.user_id = v_uid AND l.created_at >= v_start AND l.created_at < v_end)
          OR EXISTS (SELECT 1 FROM public.community_reactions r WHERE r.user_id = v_uid AND r.created_at >= v_start AND r.created_at < v_end);
  v_step := EXISTS (SELECT 1 FROM public.coaching_commitments m WHERE m.user_id = v_uid AND m.status = 'completed' AND m.completed_at >= v_start AND m.completed_at < v_end);

  v_count := v_town::int + v_game::int + v_post::int + v_cheer::int + v_step::int;
  IF v_count > 0 THEN
    -- Keyed by the middle of their day, so it is the same date whatever the time zone. A day's count
    -- only goes up: undoing something later does not take a point back.
    INSERT INTO public.objective_days (user_id, day, done_count)
    VALUES (v_uid, ((v_start + interval '12 hours') AT TIME ZONE 'UTC')::date, v_count)
    ON CONFLICT (user_id, day) DO UPDATE
      SET done_count = EXCLUDED.done_count, updated_at = now()
      WHERE public.objective_days.done_count < EXCLUDED.done_count;
  END IF;

  RETURN QUERY VALUES
    ('visit_town'::text, v_town),
    ('post_in_space'::text, v_post),
    ('cheer_a_win'::text, v_cheer),
    ('complete_step'::text, v_step),
    ('play_game'::text, v_game);
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
    SELECT d.user_id AS uid, sum(d.done_count)::int AS pts, count(*) FILTER (WHERE d.done_count = 5)::int AS full
    FROM public.objective_days d
    WHERE d.day >= v_since
    GROUP BY d.user_id
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
      (SELECT count(*) FROM public.objective_days WHERE user_id = p_user_id AND done_count = 5)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.medal_stats(uuid) FROM anon, authenticated, public;

-- Reaching a full day recalculates that person's medals, like any other medal-earning action.
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
DROP TRIGGER IF EXISTS trg_objective_days_medals ON public.objective_days;
CREATE TRIGGER trg_objective_days_medals AFTER INSERT OR UPDATE ON public.objective_days
  FOR EACH ROW WHEN (NEW.done_count = 5) EXECUTE FUNCTION public.objective_days_medals();

INSERT INTO public.medals (slug, name, description, category, tier, icon, metric, threshold, is_hidden, sort_order)
VALUES
  ('daily-driver', 'Daily Driver', 'Finish all five of a day''s objectives.',        'streaks', 'bronze', 'CalendarCheck', 'objective_days', 1,  false, 24),
  ('on-a-roll',    'On a Roll',    'Finish a full day of objectives 7 times.',        'streaks', 'silver', 'Repeat',        'objective_days', 7,  false, 25),
  ('town-regular', 'Town Regular', 'Finish a full day of objectives 30 times.',       'streaks', 'gold',   'Trophy',        'objective_days', 30, false, 26)
ON CONFLICT (slug) DO NOTHING;
