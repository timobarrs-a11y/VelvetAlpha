/*
# Fix is_admin() to recognize super users

1. Plain-English
   The owner account (Tim) has is_super_user = true but user_role = 'user'.
   The is_admin() function only checked user_role = 'admin', so it returned
   false for the owner. This broke every RLS policy and admin function that
   relied on is_admin() — the user management page only showed the owner's
   own row, and admin updates to other users' profiles were blocked by RLS.

2. Changes
   - Updated is_admin() to return true when EITHER user_role = 'admin' OR
     is_super_user = true. This matches the frontend roleService logic which
     already treats is_super_user as admin.
   - No table changes, no policy changes, no data changes.

3. Security
   - is_admin() is SECURITY DEFINER with search_path = '' (unchanged).
   - The change only widens the check to include the super-user flag, which
     is set exclusively by the auto-flag-on-signup trigger and cannot be
     modified by users (is_super_user column is restricted to admin updates).
   - EXECUTE grants are unchanged (not revoked from anon/public since it was
     never granted to them — it's only called from within RLS policies).
*/