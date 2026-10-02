/*
# Add companion_id to conversation_threads

1. Changes
- Adds `companion_id` column (nullable uuid, references companions) to `conversation_threads`.
- Existing rows get NULL (we don't know which companion they came from).
- Adds an index on (user_id, companion_id, status) for the chat-turn query path.
- Does NOT add a NOT NULL constraint yet — existing rows have no companion.
   A future migration can backfill and add NOT NULL once the code always sets it.

2. Security
- No RLS changes. conversation_threads already has RLS enabled.
*/