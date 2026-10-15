/*
# Drop stale goal_type check constraint

1. Why
   - A prior migration added a new CHECK allowing 'skill' and 'project' as goal_type values.
   - The old CHECK constraint `valid_goal_type` was never dropped, so it still rejects those values.
   - With both constraints active, any INSERT/UPDATE with goal_type = 'skill' or 'project' fails on the old constraint.

2. Changes
   - Drop the `valid_goal_type` constraint on `user_goals`.
   - The remaining `user_goals_goal_type_check` constraint already allows: health_fitness, reading, creative, habit, deadline, skill, project.

3. Security
   - No RLS or policy changes.
*/

ALTER TABLE user_goals DROP CONSTRAINT IF EXISTS valid_goal_type;
