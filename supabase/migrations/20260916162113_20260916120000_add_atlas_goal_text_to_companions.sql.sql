/*
# Add atlas_goal_text to companions

1. Modified Tables
- `companions`: adds `atlas_goal_text` (text, nullable) — stores the goal text
  extracted by the Atlas onboarding conversation so the coach's first message
  can reference it ("Atlas told me you want to...").
2. Security
- No RLS changes. Existing companion policies already cover SELECT/INSERT/UPDATE
  for authenticated users on their own rows.
3. Notes
- Column is nullable so existing companions are unaffected.
- The Atlas onboarding edge function writes this column during provisioning.
- The frontend reads it when generating the coach's first message.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'atlas_goal_text'
  ) THEN
    ALTER TABLE companions ADD COLUMN atlas_goal_text text;
  END IF;
END $$;
