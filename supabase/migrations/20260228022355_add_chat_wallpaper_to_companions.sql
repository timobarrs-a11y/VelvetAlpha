/*
  # Add Chat Wallpaper to Companions

  ## Summary
  Adds wallpaper/background customization support to the companions table,
  allowing each companion to have its own unique chat background.

  ## New Columns
  - `chat_wallpaper` (text) - Stores the wallpaper identifier:
    - Preset IDs like 'sunset-beach', 'midnight-city', etc.
    - 'custom' to indicate a user-uploaded or AI-generated image
    - NULL / empty = default (no wallpaper)
  - `chat_wallpaper_url` (text) - Stores the full URL for custom/AI-generated
    wallpapers uploaded to Supabase Storage. NULL when using a preset.

  ## Notes
  - Both columns default to NULL (no wallpaper = plain default background)
  - No RLS changes needed — companions table already has RLS policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'chat_wallpaper'
  ) THEN
    ALTER TABLE companions ADD COLUMN chat_wallpaper text DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'chat_wallpaper_url'
  ) THEN
    ALTER TABLE companions ADD COLUMN chat_wallpaper_url text DEFAULT NULL;
  END IF;
END $$;
