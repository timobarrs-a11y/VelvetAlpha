/*
# Add model_id and prompt_version to memory_turn_trace

## Purpose
Without knowing which model and prompt version produced a given turn,
drift can't be traced to its source. This adds two nullable columns so
chat-turn can log what it used without breaking existing rows.
*/

ALTER TABLE memory_turn_trace
  ADD COLUMN IF NOT EXISTS model_id text,
  ADD COLUMN IF NOT EXISTS prompt_version text;

CREATE INDEX IF NOT EXISTS idx_memory_turn_trace_model
ON memory_turn_trace (model_id, created_at DESC);
