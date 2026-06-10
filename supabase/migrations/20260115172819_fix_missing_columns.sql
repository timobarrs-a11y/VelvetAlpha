/*
  # Fix missing database columns

  1. Add message_count_at_creation to companion_memories
  2. Add subscription_status to user_profiles
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companion_memories' AND column_name = 'message_count_at_creation'
  ) THEN
    ALTER TABLE companion_memories ADD COLUMN message_count_at_creation INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'basic', 'premium'));
  END IF;
END $$;