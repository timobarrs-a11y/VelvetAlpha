/*
  # Add political_leaning to user_profiles

  ## Summary
  Adds an optional political_leaning column so users can opt-in to receiving
  politically-tailored news in their morning brief and daily feed.

  ## Changes
  - `user_profiles.political_leaning` (text, nullable)
    Values: 'democrat' | 'republican' | 'independent' | null (not set / prefer not to say)

  ## Notes
  - Entirely optional — null means no political content targeting
  - No RLS changes needed; existing policies already cover this column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'political_leaning'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN political_leaning text CHECK (
      political_leaning IN ('democrat', 'republican', 'independent')
    );
  END IF;
END $$;
