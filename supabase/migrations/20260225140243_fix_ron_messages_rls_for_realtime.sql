/*
  # Fix RoN Messages RLS for Realtime Access

  ## Problem
  The current SELECT policy on ron_messages only allows access when
  participant_b_id matches the user — but AI sessions have participant_b_id = NULL.
  This means participant A cannot receive AI-generated messages via Realtime subscriptions.

  ## Changes
  - Drop and recreate the "Session participants can view messages" policy
  - New policy: participant A can always see messages in their session
  - participant B (real human) can also see messages if they are participant B
  - This ensures Realtime INSERT events for AI messages reach participant A's client

  ## Security
  - RLS still enforced — only authenticated session participants can read messages
  - AI-generated messages (is_b_ai=true sessions, participant_b_id=null) are readable by participant A only
*/

DROP POLICY IF EXISTS "Session participants can view messages" ON ron_messages;

CREATE POLICY "Session participants can view messages"
  ON ron_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ron_sessions s
      WHERE s.id = ron_messages.session_id
      AND (
        s.participant_a_id = auth.uid()
        OR (s.participant_b_id IS NOT NULL AND s.participant_b_id = auth.uid())
      )
    )
  );
