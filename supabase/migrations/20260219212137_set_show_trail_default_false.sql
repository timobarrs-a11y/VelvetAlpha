/*
  # Set show_trail default to false

  Changes:
  - Updates the `show_trail` column default from true to false
  - Backfills all existing rows so no user has trail on by default
*/

ALTER TABLE user_customization
  ALTER COLUMN show_trail SET DEFAULT false;

UPDATE user_customization
  SET show_trail = false
  WHERE show_trail = true;
