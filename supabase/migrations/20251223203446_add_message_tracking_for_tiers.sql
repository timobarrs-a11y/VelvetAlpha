/*
  # Add Message Tracking for Subscription Tiers

  ## Overview
  Adds message tracking to support the new tier system:
  - Unlimited tier: Infinite Haiku messages
  - Pro tiers: Message packs (Starter/Plus/Elite) with Sonnet model

  ## Changes

  1. New Columns in user_profiles
    - `messages_remaining` (integer) - Tracks remaining messages for Pro pack users
    - `haiku_model_enabled` (boolean) - Whether user has Haiku (Unlimited) access
    - `sonnet_model_enabled` (boolean) - Whether user has Sonnet (Pro) access
    - `last_message_reset` (timestamptz) - For potential future daily limits

  2. Update Existing Data
    - Set appropriate defaults based on current subscription_tier

  3. Indexes
    - Index on messages_remaining for quick lookups

  ## Notes
  - Free users start with 15 messages (Haiku)
  - Unlimited tier: -1 messages (infinite Haiku)
  - Pro packs: 200/1000/3000 messages (Sonnet)
  - Messages never expire for Pro users
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'messages_remaining'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN messages_remaining integer DEFAULT 15;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'haiku_model_enabled'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN haiku_model_enabled boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'sonnet_model_enabled'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN sonnet_model_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'last_message_reset'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN last_message_reset timestamptz DEFAULT now();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_profiles_messages_remaining 
  ON user_profiles(messages_remaining);

UPDATE user_profiles
SET
  messages_remaining = CASE
    WHEN subscription_tier = 'free' THEN 15
    WHEN subscription_tier = 'unlimited' THEN -1
    WHEN subscription_tier = 'starter' THEN 200
    WHEN subscription_tier = 'plus' THEN 1000
    WHEN subscription_tier = 'elite' THEN 3000
    ELSE 15
  END,
  haiku_model_enabled = CASE
    WHEN subscription_tier IN ('free', 'unlimited') THEN true
    ELSE false
  END,
  sonnet_model_enabled = CASE
    WHEN subscription_tier IN ('starter', 'plus', 'elite') THEN true
    ELSE false
  END
WHERE messages_remaining IS NULL
  OR messages_remaining = 15
  OR messages_remaining = 50;
