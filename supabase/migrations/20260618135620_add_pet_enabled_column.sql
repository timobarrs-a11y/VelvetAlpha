ALTER TABLE pet_state
  ADD COLUMN IF NOT EXISTS pet_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN pet_state.pet_enabled IS 'Whether the pet is actively visible on screen';
