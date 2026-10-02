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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'conversation_threads'
    AND column_name = 'companion_id'
  ) THEN
    ALTER TABLE public.conversation_threads
      ADD COLUMN companion_id uuid REFERENCES public.companions(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_conversation_threads_user_companion_status
  ON public.conversation_threads (user_id, companion_id, status);