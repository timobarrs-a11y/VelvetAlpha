/*
  # Auto-create user profile on signup

  1. Changes
    - Add trigger function to automatically create user_profiles entry when auth.users is created
    - This ensures every authenticated user has a corresponding profile
  
  2. Security
    - Uses security definer to bypass RLS during automatic creation
    - Only creates profile if it doesn't already exist
*/

-- Function to automatically create user profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'user_name', 'there'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger to call the function when a new user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();