/*
  # Add chat bubble and text color customization to companions

  ## Summary
  Adds two new per-companion customization columns to the companions table so each
  companion can have its own unique chat bubble color and message text color, giving
  users full control over chat presentation.

  ## New Columns
  - `chat_bubble_color` (text, nullable) — key identifying the user bubble color preset
    (e.g. 'rose', 'sky', 'midnight', 'coral'). NULL means use the default rose gradient.
  - `chat_text_color` (text, nullable) — key identifying the text color inside user bubbles
    (e.g. 'white', 'black', 'gold'). NULL means use the default white.

  ## No RLS changes needed
  These columns are on the existing companions table which already has RLS policies.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'chat_bubble_color'
  ) THEN
    ALTER TABLE companions ADD COLUMN chat_bubble_color text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'chat_text_color'
  ) THEN
    ALTER TABLE companions ADD COLUMN chat_text_color text DEFAULT NULL;
  END IF;
END $$;
