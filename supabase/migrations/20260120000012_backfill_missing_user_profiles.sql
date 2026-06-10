/*
  # Backfill missing user profiles

  1. Changes
    - Create user_profiles entries for any existing auth.users that don't have profiles
    - This fixes the issue for users created before the auto-create trigger was added
  
  2. Security
    - No security changes, just data backfill
*/

-- Create profiles for any auth users that don't have one yet
INSERT INTO public.user_profiles (id, name)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'user_name', 'there')
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_profiles WHERE user_profiles.id = users.id
)
ON CONFLICT (id) DO NOTHING;