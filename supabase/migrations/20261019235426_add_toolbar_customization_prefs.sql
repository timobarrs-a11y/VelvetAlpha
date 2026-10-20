/*
# Add toolbar appearance and right-rail collapse preferences

1. New Columns on `user_customization`
- `right_rail_collapsed` (boolean, default false) — remembers whether the
  companion-chat right rail (Daily Feed / Your Lens) is tucked away.
- `toolbar_background_mode` (text, default 'glass') — controls the sticky
  workspace toolbar background. Values: 'glass' (frosted default),
  'companion' (match the active companion chat wallpaper), 'coaching'
  (match the coaching chat wallpaper).
- `toolbar_text_color` (text, default 'dark') — preset palette key for the
  sticky toolbar text color, so it stays readable over any background.
  Presets: 'dark', 'light', 'rose', 'sky', 'amber'.

2. Security
- No new tables. Existing RLS policies on `user_customization` continue to
  govern access; no policy changes needed.

3. Notes
- All additions are additive with safe defaults, so existing rows and any
  code that does not yet reference these columns keep working unchanged.
*/

ALTER TABLE user_customization
  ADD COLUMN IF NOT EXISTS right_rail_collapsed boolean NOT NULL DEFAULT false;

ALTER TABLE user_customization
  ADD COLUMN IF NOT EXISTS toolbar_background_mode text NOT NULL DEFAULT 'glass';

ALTER TABLE user_customization
  ADD COLUMN IF NOT EXISTS toolbar_text_color text NOT NULL DEFAULT 'dark';
