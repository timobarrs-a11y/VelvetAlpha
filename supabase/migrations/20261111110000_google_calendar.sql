/*
  # Google Calendar connection

  Lets someone pin their tasks to their own Google Calendar.

  - google_calendar_connections holds the tokens Google gives us. They are server-only: RLS is on with no
    policies and no grants, so only the edge function (service role) can read or write them.
  - google_calendar_status() tells the signed-in person whether they're connected (and as whom) without
    exposing any token.
  - coaching_commitments.google_event_id remembers which calendar event is a task's, so it can be updated or removed.
*/

CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token text NOT NULL,
  access_token text,
  access_expires_at timestamptz,
  scope text,
  google_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_calendar_connections FROM PUBLIC, anon, authenticated;

ALTER TABLE public.coaching_commitments ADD COLUMN IF NOT EXISTS google_event_id text;

CREATE OR REPLACE FUNCTION public.google_calendar_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT jsonb_build_object('connected', true, 'email', c.google_email)
       FROM public.google_calendar_connections c
      WHERE c.user_id = auth.uid()),
    jsonb_build_object('connected', false, 'email', NULL)
  );
$$;

REVOKE ALL ON FUNCTION public.google_calendar_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.google_calendar_status() TO authenticated;
