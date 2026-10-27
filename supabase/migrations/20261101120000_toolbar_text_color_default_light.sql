/*
  # Toolbar text defaults to white

  The toolbar_text_color column defaulted to 'dark', so every customization row
  created without an explicit choice stored 'dark' and overrode the app's 'light'
  default. New rows now default to 'light'. Existing rows are left alone.
*/

ALTER TABLE user_customization
  ALTER COLUMN toolbar_text_color SET DEFAULT 'light';
