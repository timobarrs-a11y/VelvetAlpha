-- Remove the Velvet Correspondents framework.
-- The correspondent relationship type and its columns (correspondent_id, beat)
-- are no longer used. voice_key is also removed — it was only used by correspondents.
-- All companion rows with relationship_type='correspondent' have already been
-- migrated to 'friend' or deleted.

-- 1. Tighten the CHECK constraint to the three remaining types
ALTER TABLE companions
  DROP CONSTRAINT IF EXISTS companions_relationship_type_check;

ALTER TABLE companions
  ADD CONSTRAINT companions_relationship_type_check
  CHECK (relationship_type IN ('friend', 'romantic', 'mentor'));

-- 2. Drop correspondent-specific columns (nullable, safe to remove)
ALTER TABLE companions DROP COLUMN IF EXISTS correspondent_id;
ALTER TABLE companions DROP COLUMN IF EXISTS beat;
ALTER TABLE companions DROP COLUMN IF EXISTS voice_key;