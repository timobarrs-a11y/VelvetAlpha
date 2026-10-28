/*
# Resume where you left off

At sign-in, and when someone comes back after 30+ minutes away, the app works out where they stopped (no goal, a
goal with no plan, a plan never accepted, commitments all done or overdue) and takes them back there, with a pickup
message that continues their last conversation in their own words (src/features/resume, supabase/functions/resume-pickup).

1. `user_own_words`: the first two or three sentences someone wrote about their goals and dreams, word for word.
   Private: only they can read it (and the edge functions, which use it to pick up and to hand off to the coach).
   Written once, by the Atlas functions; never shown to anyone else.
2. `resume_pickups`: the pickup messages sent to someone, so a new one never repeats or echoes the last ten.
   Written by the resume-pickup function only.
3. `app_settings.resume_gate_snooze_per_day`: how many "Not now"s a day someone gets (0 makes the pickup absolute).
Safe to run more than once.
*/

CREATE TABLE IF NOT EXISTS public.user_own_words (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  words text NOT NULL CHECK (char_length(words) BETWEEN 1 AND 1200),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_own_words ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_words_select_own" ON public.user_own_words;
CREATE POLICY "own_words_select_own" ON public.user_own_words
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.resume_pickups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resume_pickups_user ON public.resume_pickups (user_id, created_at DESC);
ALTER TABLE public.resume_pickups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "resume_pickups_select_own" ON public.resume_pickups;
CREATE POLICY "resume_pickups_select_own" ON public.resume_pickups
  FOR SELECT TO authenticated USING (user_id = auth.uid());

INSERT INTO public.app_settings (key, value, description) VALUES
  ('resume_gate_snooze_per_day', '1'::jsonb, 'How many times a day someone may tap "Not now" on the pickup where they left off (0 = never)')
ON CONFLICT (key) DO NOTHING;
