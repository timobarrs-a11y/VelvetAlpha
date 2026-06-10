/*
  # Add Premium Trial Tier System

  ## Overview
  Adds support for a 3-day free premium trial that automatically expires and downgrades to 'free'.

  ## Changes

  ### 1. Modified Tables
  - `user_profiles`
    - `trial_expires_at` (timestamptz, nullable) — when set, marks this user as on a trial that expires at this time
    - `trial_used` (boolean, default false) — prevents users from claiming multiple trials

  ### 2. Subscription Tier Constraint Update
  - Adds 'trial' as a valid subscription_tier value

  ### 3. Auto-Expiry Function
  - `expire_trials()` — SQL function that downgrades expired trial users back to 'free'
  - Called by pg_cron every hour

  ### Security
  - No new RLS policies needed; existing user_profiles policies cover the new columns
  - Only service role can set trial_expires_at directly (via webhook/admin)

  ### Notes
  - trial_used flag ensures one trial per account lifetime
  - pg_cron job 'expire-trials' runs hourly at :00
*/

-- Add trial_expires_at and trial_used columns to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'trial_expires_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN trial_expires_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'trial_used'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN trial_used boolean DEFAULT false;
  END IF;
END $$;

-- Update subscription_tier constraint to allow 'trial'
DO $$
BEGIN
  ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_subscription_tier_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'trial', 'unlimited', 'starter', 'plus', 'elite'));

-- Create the trial expiry function
CREATE OR REPLACE FUNCTION expire_trials()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_profiles
  SET
    subscription_tier = 'free',
    messages_remaining = 15,
    haiku_model_enabled = true,
    sonnet_model_enabled = false,
    trial_expires_at = NULL
  WHERE
    subscription_tier = 'trial'
    AND trial_expires_at IS NOT NULL
    AND trial_expires_at < now();
END;
$$;

-- Schedule pg_cron job to run expire_trials every hour (if pg_cron is available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('expire-trials');
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'expire-trials',
      '0 * * * *',
      'SELECT expire_trials()'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;
