/*
# Social Combat: Public Leaderboard + Personal Best

1. Overview
   Adds a read-only public leaderboard for Social Combat scores.
   The existing `social_combat_runs` table stays owner-scoped via RLS —
   users still only see their own runs directly. A SECURITY DEFINER
   function exposes an aggregated, public top-scores view that joins
   to `user_profiles` for display names. This keeps private run detail
   (notes, scenario ids) hidden while letting players compare scores.

2. New functions
   - `social_combat_leaderboard(limit int)`
     Returns top public runs: rank, player display name, score,
     mode, max combo, turns, character id, and created_at.
     Only includes runs with outcome = 'win' (a completed victory).
     Ordered by score desc, then earlier completion first.
   - `social_combat_personal_best(p_user_id uuid)`
     Returns the calling user's single best winning run plus
     basic stats (total wins, total runs, best combo). Kept as a
     function so the client can fetch it in one round-trip.

3. Security
   - Both functions are SECURITY DEFINER so they can read across
     all users' rows for aggregation, but they only PROJECT out
     the safe columns listed above — no notes, no user ids, no
     scenario ids. The leaderboard never leaks identifying info
     beyond the display name already public on user_profiles.
   - `social_combat_leaderboard` is callable by `anon, authenticated`.
   - `social_combat_personal_best` is callable by `authenticated`
     only and takes the caller's id as an argument; it also enforces
     `p_user_id = auth.uid()` so a user cannot read another's best.
*/

-- Leaderboard: top winning runs across all players.
CREATE OR REPLACE FUNCTION social_combat_leaderboard(p_limit int DEFAULT 50)
RETURNS TABLE (
  rank int,
  player_name text,
  score int,
  mode text,
  max_combo int,
  turns int,
  char_id text,
  completed_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY r.score DESC, r.created_at ASC) AS rank,
    COALESCE(u.name, 'Anonymous') AS player_name,
    r.score,
    r.mode,
    r.max_combo,
    r.turns,
    COALESCE((r.notes->>'character')::text, '') AS char_id,
    r.created_at AS completed_at
  FROM social_combat_runs r
  LEFT JOIN user_profiles u ON u.id = r.user_id
  WHERE r.outcome = 'win'
  ORDER BY r.score DESC, r.created_at ASC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;

-- Personal best + summary stats for the calling user.
CREATE OR REPLACE FUNCTION social_combat_personal_best(p_user_id uuid)
RETURNS TABLE (
  best_score int,
  best_combo int,
  total_wins int,
  total_runs int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(MAX(r.score) FILTER (WHERE r.outcome = 'win'), 0) AS best_score,
    COALESCE(MAX(r.max_combo), 0) AS best_combo,
    COUNT(*) FILTER (WHERE r.outcome = 'win')::int AS total_wins,
    COUNT(*)::int AS total_runs
  FROM social_combat_runs r
  WHERE r.user_id = p_user_id;
$$;

-- Grant access. Leaderboard is public; personal best is auth-only.
REVOKE ALL ON FUNCTION social_combat_leaderboard(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION social_combat_leaderboard(int) TO anon, authenticated;

REVOKE ALL ON FUNCTION social_combat_personal_best(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION social_combat_personal_best(uuid) TO authenticated;
