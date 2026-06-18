ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS age_verified_at timestamptz;

COMMENT ON COLUMN user_profiles.terms_accepted_at IS 'Timestamp when user accepted Terms of Service';
COMMENT ON COLUMN user_profiles.terms_version IS 'Version of Terms of Service accepted (e.g. 2026-01-28)';
COMMENT ON COLUMN user_profiles.age_verified_at IS 'Timestamp when user confirmed 18+ age at signup';
