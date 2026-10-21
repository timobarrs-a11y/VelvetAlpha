/*
# Allow signed-in users to save customization changes

1. Purpose
- Restore the ability for signed-in users to save their own workspace customization settings.

2. Modified Tables
- `public.user_customization`
- No columns or stored data are changed.

3. Security
- Grant only the `UPDATE` table privilege to the `authenticated` role.
- Existing row-level security policies continue to restrict updates to rows owned by the signed-in user.

4. Important Notes
- This is a permission repair only; it does not broaden access to other users' customization rows.
*/

GRANT UPDATE ON TABLE public.user_customization TO authenticated;