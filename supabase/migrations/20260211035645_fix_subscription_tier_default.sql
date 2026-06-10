/*
  # Fix Subscription Tier Default Value

  1. Problem
    - The subscription_tier column has default 'premium'
    - But the constraint only allows: 'free', 'unlimited', 'starter', 'plus', 'elite'
    - This causes new user inserts to fail

  2. Solution
    - Change the default value to 'free' for new users
*/

-- Update the default value for subscription_tier column
ALTER TABLE user_profiles 
ALTER COLUMN subscription_tier SET DEFAULT 'free';
