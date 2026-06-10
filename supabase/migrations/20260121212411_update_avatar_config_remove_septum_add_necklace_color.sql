/*
  # Update Avatar Config - Remove Septum, Add Necklace Color

  1. Changes
    - Update all avatar configs with 'septum' nose piercing to 'none'
    - Add 'necklaceColor' field with default '#C0C0C0' (silver) to existing configs

  2. Details
    - Updates both user_profiles.avatar_config and companions.avatar_config
    - Only modifies existing JSONB configs (leaves NULL values untouched)
    - Sets default necklaceColor to match the default in code
*/

-- Update user_profiles: remove septum and add necklaceColor
UPDATE user_profiles
SET avatar_config = avatar_config
  || jsonb_build_object('necklaceColor', COALESCE(avatar_config->>'necklaceColor', '#C0C0C0'))
  || CASE
      WHEN avatar_config->>'nosePiercing' = 'septum'
      THEN jsonb_build_object('nosePiercing', 'none')
      ELSE '{}'::jsonb
    END
WHERE avatar_config IS NOT NULL;

-- Update companions: remove septum and add necklaceColor
UPDATE companions
SET avatar_config = avatar_config
  || jsonb_build_object('necklaceColor', COALESCE(avatar_config->>'necklaceColor', '#C0C0C0'))
  || CASE
      WHEN avatar_config->>'nosePiercing' = 'septum'
      THEN jsonb_build_object('nosePiercing', 'none')
      ELSE '{}'::jsonb
    END
WHERE avatar_config IS NOT NULL;
