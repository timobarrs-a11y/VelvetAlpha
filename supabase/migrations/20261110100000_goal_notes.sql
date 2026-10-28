/*
# Notes: what was uncovered while working toward a goal

When a coach or assistant gives real supplemental information tied to a goal (what the trademark office needs,
the steps and fees, a deadline, where to apply), it used to stay in the chat. The `chat-turn` function now
spots it and saves a short review here, with the key points, so it can be found and reread without scrolling
back through a conversation.

## New table: `goal_notes`
- One row per note: a title, a short review (`summary`), `key_points` (the concrete steps, numbers and names),
  an optional `next_step`, and which goal, task (commitment) and coach or assistant it came from.
- `pinned` keeps a note at the top.

## Security
- RLS: the owner can read, delete and pin their own notes. Nothing else can be written from the client; notes
  are created by the `chat-turn` function with the service role, so what lands here can't be made up from the app.
- Rows go when the member or the goal is deleted.
*/

CREATE TABLE IF NOT EXISTS public.goal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id uuid REFERENCES public.user_goals(id) ON DELETE CASCADE,
  companion_id uuid REFERENCES public.companions(id) ON DELETE SET NULL,
  commitment_id uuid REFERENCES public.coaching_commitments(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 10 AND 1500),
  key_points jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(key_points) = 'array'),
  next_step text CHECK (next_step IS NULL OR char_length(next_step) <= 300),
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goal_notes_user_created ON public.goal_notes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_goal_notes_goal ON public.goal_notes (goal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_goal_notes_commitment ON public.goal_notes (commitment_id) WHERE commitment_id IS NOT NULL;

ALTER TABLE public.goal_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_goal_notes" ON public.goal_notes;
CREATE POLICY "select_own_goal_notes" ON public.goal_notes FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "pin_own_goal_notes" ON public.goal_notes;
CREATE POLICY "pin_own_goal_notes" ON public.goal_notes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_goal_notes" ON public.goal_notes;
CREATE POLICY "delete_own_goal_notes" ON public.goal_notes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Only the pin can be changed from the app; the content is whatever the coach said.
REVOKE ALL ON public.goal_notes FROM anon, authenticated;
GRANT SELECT, DELETE ON public.goal_notes TO authenticated;
GRANT UPDATE (pinned) ON public.goal_notes TO authenticated;

-- Notes show up on their own (the "saved to your notes" pill) as they are written.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'goal_notes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.goal_notes;
  END IF;
END $$;
