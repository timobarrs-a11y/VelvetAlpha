/*
  # Unread counts for AI companions and coaches, delivered live

  1. `companions.last_read_at`
    - When the user last read this companion's chat (dock window or chat
      screen). Existing companions start "read as of now", so past history
      does not light up as unread.

  2. `get_companion_unread_counts()`
    - Assistant messages newer than `last_read_at`, per companion, for the
      calling user only (SECURITY INVOKER, so RLS applies as well).

  3. Realtime
    - Adds `conversations` to the `supabase_realtime` publication so a message
      from a companion or coach (including proactive ones) reaches the dock
      while the user is elsewhere. RLS limits each subscriber to their own rows.
*/

ALTER TABLE public.companions ADD COLUMN IF NOT EXISTS last_read_at timestamptz;
UPDATE public.companions SET last_read_at = now() WHERE last_read_at IS NULL;
ALTER TABLE public.companions ALTER COLUMN last_read_at SET DEFAULT now();

CREATE OR REPLACE FUNCTION public.get_companion_unread_counts()
RETURNS TABLE (companion_id uuid, unread integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT c.id, count(m.id)::int
  FROM public.companions c
  JOIN public.conversations m
    ON m.companion_id = c.id
   AND m.user_id = c.user_id
   AND m.role = 'assistant'
   AND m.created_at > coalesce(c.last_read_at, c.created_at)
  WHERE c.user_id = (SELECT auth.uid())
  GROUP BY c.id;
$$;

REVOKE ALL ON FUNCTION public.get_companion_unread_counts() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_companion_unread_counts() TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
END $$;
