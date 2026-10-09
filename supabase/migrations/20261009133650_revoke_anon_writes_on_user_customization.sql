/*
  # Revoke anon write privileges on user_customization

  RLS already restricts this table to `authenticated` (no anon policies exist), but the
  `anon` role still held table-wide INSERT/UPDATE privileges, including on the columns
  that gate cosmetic unlocks and streak counters. Removing the grants makes the
  privilege set match the policy set, so a future policy change cannot accidentally
  expose these columns to anonymous callers.

  1. Changes
    - REVOKE INSERT, UPDATE on public.user_customization FROM anon
*/

REVOKE INSERT, UPDATE ON public.user_customization FROM anon;
