/*
# Add Velvet Correspondents relationship type

## Overview
This migration enables a new companion relationship type — "correspondent" —
for Velvet Correspondents: AI pen-pals who write about real news in a
distinctive voice. This is a fourth relationship type alongside friend,
romantic, and mentor (coach).

## Changes

### 1. companions table — CHECK constraint
- Drop the existing `companions_relationship_type_check` constraint.
- Recreate it to allow four values: 'friend', 'romantic', 'mentor', 'correspondent'.

### 2. companions table — new columns
- `correspondent_id` (text, nullable) — links a companion row to a curated
  correspondent config entry (e.g. 'the_insider', 'the_sideline'). NULL for
  non-correspondent companions.
- `beat` (text, nullable) — the correspondent's editorial beat / topic focus
  (e.g. 'gossip', 'sports'). Used to drive news-grounding queries.
- `voice_key` (text, nullable) — the signature-voice key the correspondent
  writes in (e.g. 'homie', 'jock'). Distinct from `signature_voice` because
  it keys into the voice-news-category lookup used for grounding.

## Security
- No RLS policy changes. Correspondent companions are still user-owned rows
  in the companions table and inherit the existing ownership policies.
- No new tables.

## Notes
1. Existing companions are unaffected — the new columns are nullable and the
   expanded CHECK constraint is a superset of the old one.
2. `article_ids` are NOT stored in a new column. They ride inside the existing
   JSONB `metadata` column on the `conversations` table, so no schema change
   is needed for source citations.
3. The migration is idempotent: it drops the constraint IF EXISTS and uses
   IF NOT EXISTS for each column addition.
*/

ALTER TABLE companions
  DROP CONSTRAINT IF EXISTS companions_relationship_type_check;

ALTER TABLE companions
  ADD CONSTRAINT companions_relationship_type_check
  CHECK (relationship_type IN ('friend', 'romantic', 'mentor', 'correspondent'));

ALTER TABLE companions ADD COLUMN IF NOT EXISTS correspondent_id text;
ALTER TABLE companions ADD COLUMN IF NOT EXISTS beat text;
ALTER TABLE companions ADD COLUMN IF NOT EXISTS voice_key text;