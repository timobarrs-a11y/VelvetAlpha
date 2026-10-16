-- Add a v2 save_data column for dual-write during the schema migration.
-- v1 stays in save_data (for rollback safety); v2 goes in save_data_v2.
-- After full migration is verified, a future migration drops save_data_v2's
-- dependency and makes it the primary column.

ALTER TABLE velvet_house_saves ADD COLUMN IF NOT EXISTS save_data_v2 jsonb;