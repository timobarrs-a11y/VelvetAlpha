/*
# Add communication profile to user profiles

1. New Columns
- `user_profiles.communication_profile` (jsonb, nullable)
  Stores the user's behavioral calibration answers from onboarding.
  Shape: { recharge: 'alone'|'people', conflict: 'solutions'|'empathy', structure: 'planned'|'spontaneous', connection: 'deep'|'lively' }
  Used by the AI system prompt builder to adapt how companions and coaches talk to the user.

2. Modified Tables
- `user_profiles` — added one nullable jsonb column. No data loss, no type changes.

3. Security
- No new tables. Existing RLS policies on user_profiles already cover SELECT/INSERT/UPDATE/DELETE for authenticated users on their own row.
- The new column is covered by the existing UPDATE policy since it's on the same table.

4. Notes
- Column is nullable so existing users are unaffected.
- Frontend will save answers as a JSON object during onboarding.
*/
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS communication_profile jsonb;