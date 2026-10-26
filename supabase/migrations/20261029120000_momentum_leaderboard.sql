/*
  # Momentum leaderboards (Daily Climb + Endless)

  ## New table `momentum_leaderboard`
  One row per user per mode per period (UTC day), holding their best run:
  - `mode` ('daily' | 'endless'), `period` (date)
  - `score` (integer), `time` (numeric seconds)
  - `ghost` (jsonb) - flat [x, y, ...] path so others can race the run
  - `display_name` copied from member_profiles when available

  ## Security
  - RLS: any authenticated user can read; rows are only written through
    `submit_momentum_run`, which keeps the caller's best run (fastest daily
    time, highest endless score).
*/

CREATE TABLE IF NOT EXISTS momentum_leaderboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('daily', 'endless')),
  period date NOT NULL,
  display_name text NOT NULL DEFAULT 'Player',
  score integer NOT NULL DEFAULT 0,
  time numeric NOT NULL DEFAULT 0,
  ghost jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mode, period)
);

CREATE INDEX IF NOT EXISTS momentum_leaderboard_daily_idx ON momentum_leaderboard (mode, period, time);
CREATE INDEX IF NOT EXISTS momentum_leaderboard_score_idx ON momentum_leaderboard (mode, period, score DESC);

ALTER TABLE momentum_leaderboard ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read momentum leaderboard" ON momentum_leaderboard;
CREATE POLICY "Authenticated users can read momentum leaderboard"
  ON momentum_leaderboard FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION submit_momentum_run(
  p_mode text,
  p_period date,
  p_score integer,
  p_time numeric,
  p_ghost jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_name text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_mode NOT IN ('daily', 'endless') THEN
    RAISE EXCEPTION 'invalid mode';
  END IF;
  -- Only today's (or yesterday's, for timezone edges) board accepts runs
  IF p_period < (now() AT TIME ZONE 'utc')::date - 1 OR p_period > (now() AT TIME ZONE 'utc')::date + 1 THEN
    RAISE EXCEPTION 'invalid period';
  END IF;
  IF p_time < 0 OR p_score < 0 OR (p_ghost IS NOT NULL AND jsonb_array_length(p_ghost) > 20000) THEN
    RAISE EXCEPTION 'invalid run';
  END IF;

  SELECT COALESCE(NULLIF(display_name, ''), 'Player') INTO v_name
  FROM member_profiles WHERE user_id = v_user;

  INSERT INTO momentum_leaderboard (user_id, mode, period, display_name, score, time, ghost)
  VALUES (v_user, p_mode, p_period, COALESCE(v_name, 'Player'), p_score, p_time, p_ghost)
  ON CONFLICT (user_id, mode, period) DO UPDATE
  SET score = EXCLUDED.score,
      time = EXCLUDED.time,
      ghost = EXCLUDED.ghost,
      display_name = EXCLUDED.display_name,
      updated_at = now()
  WHERE (p_mode = 'daily' AND EXCLUDED.time < momentum_leaderboard.time)
     OR (p_mode = 'endless' AND EXCLUDED.score > momentum_leaderboard.score);
END;
$$;

REVOKE ALL ON FUNCTION submit_momentum_run(text, date, integer, numeric, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION submit_momentum_run(text, date, integer, numeric, jsonb) TO authenticated;
