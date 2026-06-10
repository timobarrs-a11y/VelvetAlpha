/*
  # Add Avatar System

  1. Changes
    - Add `avatar_config` column to `user_profiles` table
      - Stores user's custom avatar configuration (JSON)
      - Includes: gender, skinTone, eyeColor, hairColor, hairStyle, lipShape, lipColor, eyebrowShape, facialHair, eyelashes, freckles, glasses, earrings, nosePiercing, lipPiercing, necklace
    
    - Add `avatar_config` column to `companions` table
      - Stores companion's custom avatar configuration (JSON)
      - Same structure as user avatar config
    
  2. Notes
    - If avatar_config is null, system will fall back to default static images
    - This allows gradual migration of existing users and companions
    - Avatar configs are stored as JSONB for flexibility and indexing
*/

-- Add avatar_config to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'avatar_config'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN avatar_config jsonb DEFAULT NULL;
  END IF;
END $$;

-- Add avatar_config to companions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'avatar_config'
  ) THEN
    ALTER TABLE companions ADD COLUMN avatar_config jsonb DEFAULT NULL;
  END IF;
END $$;

-- Create index for faster avatar config queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_avatar_config ON user_profiles USING gin(avatar_config);
CREATE INDEX IF NOT EXISTS idx_companions_avatar_config ON companions USING gin(avatar_config);