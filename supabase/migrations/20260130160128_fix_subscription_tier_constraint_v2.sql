/*
  # Fix Subscription Tier Constraint
  
  1. Changes
    - Remove old constraint that only allows 'free', 'basic', 'premium'
    - Update all existing tier values to new naming scheme
    - Add new constraint that allows current tiers: 'free', 'unlimited', 'starter', 'plus', 'elite'
  
  2. Migration Strategy
    - Temporarily drop constraint
    - Migrate data: premium -> unlimited, basic -> free
    - Add new constraint with correct values
*/

-- Step 1: Drop the old constraint
ALTER TABLE user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_subscription_tier_check;

-- Step 2: Migrate old tier names to new tier names
-- premium -> unlimited (closest equivalent: haiku model, unlimited messages)
UPDATE user_profiles
SET subscription_tier = 'unlimited',
    messages_remaining = -1,
    haiku_model_enabled = true,
    sonnet_model_enabled = false
WHERE subscription_tier = 'premium';

-- basic -> free (if any exist)
UPDATE user_profiles
SET subscription_tier = 'free'
WHERE subscription_tier = 'basic';

-- Step 3: Add the new constraint with current tier names
ALTER TABLE user_profiles 
ADD CONSTRAINT user_profiles_subscription_tier_check 
CHECK (subscription_tier IN ('free', 'unlimited', 'starter', 'plus', 'elite'));
