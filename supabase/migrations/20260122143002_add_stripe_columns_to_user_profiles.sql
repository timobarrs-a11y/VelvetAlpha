/*
  # Add Stripe Integration Columns

  1. Changes
    - Add `stripe_customer_id` column to store Stripe customer ID
    - Add `stripe_subscription_id` column to store Stripe subscription ID
    
  2. Purpose
    - Enable proper Stripe payment integration
    - Track customer and subscription data for billing management
*/

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer 
ON user_profiles(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_subscription 
ON user_profiles(stripe_subscription_id);
