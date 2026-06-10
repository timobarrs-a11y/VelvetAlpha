/*
  # Add Subscription Tier to User Profiles

  1. Changes
    - Add `subscription_tier` column to `user_profiles` table
      - Type: text with check constraint
      - Values: 'free', 'basic', 'premium'
      - Default: 'premium' (for testing purposes)
    
  2. Security
    - No RLS changes needed (existing policies cover new column)
*/

-- Add subscription_tier column to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'subscription_tier'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN subscription_tier text DEFAULT 'premium' 
    CHECK (subscription_tier IN ('free', 'basic', 'premium'));
  END IF;
END $$;