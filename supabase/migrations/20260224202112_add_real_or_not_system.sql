/*
  # Real or Not (RoN) Messaging System

  ## Overview
  A 1-on-1 anonymous messaging feature where users chat with either a real person
  or an AI persona without knowing which. Both parties are trying to figure out
  if the other is human or AI — creating a focused, curious form of connection.

  ## New Tables

  ### ron_sessions
  - Tracks each pairing session (human-human or human-AI)
  - `participant_a_id` — first user (always the one who initiated)
  - `participant_b_id` — second user (null if matched with AI)
  - `is_b_ai` — true if participant B is an AI persona
  - `gender_filter` — gender the initiator requested ('male'|'female'|'any')
  - `status` — 'waiting'|'active'|'ended'
  - `ai_persona_name` — generated name for AI participant
  - `ai_persona_seed` — json blob with personality traits for AI
  - `ended_at` — when the session closed
  - `a_verdict` — what participant A guessed ('human'|'ai'|null)
  - `b_verdict` — what participant B guessed (null if B is AI)
  - `a_revealed` — did A reveal they're human
  - `b_revealed` — did B reveal (only meaningful if B is human)

  ### ron_messages
  - Individual messages within a session
  - `session_id` — references ron_sessions
  - `sender_role` — 'a'|'b' (not user IDs, to maintain anonymity)
  - `content` — message text
  - `is_ai_generated` — true if this was written by AI engine

  ## Security
  - RLS enabled on both tables
  - Users can only see sessions they participate in
  - Messages only visible if user is in the session
*/

CREATE TABLE IF NOT EXISTS ron_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_a_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_b_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_b_ai boolean NOT NULL DEFAULT true,
  gender_filter text NOT NULL DEFAULT 'any',
  status text NOT NULL DEFAULT 'waiting',
  ai_persona_name text,
  ai_persona_seed jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  matched_at timestamptz,
  ended_at timestamptz,
  a_verdict text DEFAULT null,
  b_verdict text DEFAULT null,
  a_revealed boolean NOT NULL DEFAULT false,
  b_revealed boolean NOT NULL DEFAULT false,
  CONSTRAINT ron_sessions_status_check CHECK (status IN ('waiting', 'active', 'ended')),
  CONSTRAINT ron_sessions_gender_check CHECK (gender_filter IN ('male', 'female', 'any')),
  CONSTRAINT ron_sessions_a_verdict_check CHECK (a_verdict IS NULL OR a_verdict IN ('human', 'ai')),
  CONSTRAINT ron_sessions_b_verdict_check CHECK (b_verdict IS NULL OR b_verdict IN ('human', 'ai'))
);

CREATE TABLE IF NOT EXISTS ron_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES ron_sessions(id) ON DELETE CASCADE,
  sender_role text NOT NULL,
  content text NOT NULL,
  is_ai_generated boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT ron_messages_sender_check CHECK (sender_role IN ('a', 'b'))
);

ALTER TABLE ron_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ron_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ron_sessions_participant_a ON ron_sessions(participant_a_id);
CREATE INDEX IF NOT EXISTS ron_sessions_participant_b ON ron_sessions(participant_b_id);
CREATE INDEX IF NOT EXISTS ron_sessions_status ON ron_sessions(status);
CREATE INDEX IF NOT EXISTS ron_messages_session_id ON ron_messages(session_id);
CREATE INDEX IF NOT EXISTS ron_messages_created_at ON ron_messages(session_id, created_at);

CREATE POLICY "Participant A can view their sessions"
  ON ron_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = participant_a_id);

CREATE POLICY "Participant B can view their sessions"
  ON ron_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = participant_b_id);

CREATE POLICY "Users can create sessions as participant A"
  ON ron_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = participant_a_id);

CREATE POLICY "Participant A can update their sessions"
  ON ron_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = participant_a_id OR auth.uid() = participant_b_id)
  WITH CHECK (auth.uid() = participant_a_id OR auth.uid() = participant_b_id);

CREATE POLICY "Session participants can view messages"
  ON ron_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ron_sessions s
      WHERE s.id = ron_messages.session_id
      AND (s.participant_a_id = auth.uid() OR s.participant_b_id = auth.uid())
    )
  );

CREATE POLICY "Participant A can send messages"
  ON ron_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ron_sessions s
      WHERE s.id = ron_messages.session_id
      AND s.participant_a_id = auth.uid()
      AND sender_role = 'a'
      AND s.status = 'active'
    )
  );

CREATE POLICY "Participant B can send messages"
  ON ron_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ron_sessions s
      WHERE s.id = ron_messages.session_id
      AND s.participant_b_id = auth.uid()
      AND sender_role = 'b'
      AND s.status = 'active'
    )
  );
