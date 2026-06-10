/*
  # Update Personality Settings Structure

  1. Changes
    - Update personality_settings default value to new structure
    - New structure supports 7 personality dimensions:
      - availability: 'always_there' | 'independent'
      - dynamic: 'wants_to_be_led' | 'challenges_him'
      - affection: 'highly_affectionate' | 'subtle_affection'
      - communication: 'overshares' | 'keeps_mystery'
      - support: 'endless_encouragement' | 'real_talk'
      - energy: 'bubbly_high' | 'calm_chill'
      - lifestyle: 'homebody' | 'social_active'

  2. Migration
    - Alter table to update default value for new users
    - Update existing users to have new structure
*/

-- Update default value for new users
ALTER TABLE user_profiles 
  ALTER COLUMN personality_settings 
  SET DEFAULT '{
    "availability": "always_there",
    "dynamic": "challenges_him",
    "affection": "highly_affectionate",
    "communication": "overshares",
    "support": "endless_encouragement",
    "energy": "bubbly_high",
    "lifestyle": "social_active"
  }'::jsonb;

-- Update existing users who still have old structure
UPDATE user_profiles
SET personality_settings = '{
  "availability": "always_there",
  "dynamic": "challenges_him",
  "affection": "highly_affectionate",
  "communication": "overshares",
  "support": "endless_encouragement",
  "energy": "bubbly_high",
  "lifestyle": "social_active"
}'::jsonb
WHERE personality_settings::text LIKE '%flirtiness%';
