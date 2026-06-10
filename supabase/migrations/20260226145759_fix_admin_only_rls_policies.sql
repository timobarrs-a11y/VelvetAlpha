/*
  # Fix Admin-Only RLS Policies

  ## Problem
  Three analytics tables had overly permissive SELECT policies using `USING (true)`,
  meaning any authenticated user could read sensitive business metrics, performance data,
  and retention cohorts directly via the Supabase client — bypassing the UI-level admin
  guard.

  ## Changes
  - Drop the permissive `USING (true)` policies on:
    - `business_metrics`
    - `performance_metrics`
    - `retention_cohorts`
  - Replace each with a policy that requires the requesting user to have user_role = 'admin'
    in their user_profiles row.

  ## Security
  After this migration, only users with `user_role = 'admin'` in user_profiles can SELECT
  from these three tables. All other authenticated users are denied at the database level,
  not just in the UI.
*/

DROP POLICY IF EXISTS "Admins can view business metrics" ON business_metrics;
DROP POLICY IF EXISTS "Admins can view performance metrics" ON performance_metrics;
DROP POLICY IF EXISTS "Admins can view retention cohorts" ON retention_cohorts;

CREATE POLICY "Admins can view business metrics"
  ON business_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.user_role = 'admin'
    )
  );

CREATE POLICY "Admins can view performance metrics"
  ON performance_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.user_role = 'admin'
    )
  );

CREATE POLICY "Admins can view retention cohorts"
  ON retention_cohorts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.user_role = 'admin'
    )
  );
