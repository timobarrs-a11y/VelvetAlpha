/*
  # Add button_hover_style to user_customization

  ## Summary
  Adds a new column to store the user's chosen button hover animation style.

  ## Changes
  - `user_customization` — new column `button_hover_style` (text, DEFAULT 'none')
    - Stores the key of the active button hover effect
    - 'none' = no effect (default, safe fallback)
    - Other values: 'portal', 'ripple', 'aurora', 'sparks'

  ## Notes
  - Non-destructive addition — existing rows receive the default value 'none'
  - No RLS changes needed; existing policies already cover this table
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_customization' AND column_name = 'button_hover_style'
  ) THEN
    ALTER TABLE user_customization ADD COLUMN button_hover_style text DEFAULT 'none';
  END IF;
END $$;
