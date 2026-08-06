/*
# Add Relationship Brief Engine System

## Overview
This migration creates the database infrastructure for an Autonomous Relationship Engine —
a system that cross-references real people's preference data against upcoming dates,
contact gaps, and live web search results to proactively deliver actionable
relationship-maintenance opportunities to users.

## New Tables

### 1. relationship_contact_log
Tracks every time a user logs contact with a real person (call, text, visit, gift sent).
This powers the "contact gap" detection and relationship health scoring.
- id (uuid PK)
- user_id (uuid, owner, defaults to auth.uid())
- person_id (uuid FK -> real_people.id ON DELETE CASCADE)
- contact_type (text: call, text, visit, gift, social_media, other)
- contact_date (date, when the contact happened)
- notes (text, optional)
- created_at (timestamptz)

### 2. relationship_briefs
Stores generated briefs — one per person per week. Each brief contains structured
JSON with opportunities (gifts, events, restaurants, etc.), contact gap info,
upcoming birthdays/anniversaries, and a health score.
- id (uuid PK)
- user_id (uuid, owner, defaults to auth.uid())
- person_id (uuid FK -> real_people.id ON DELETE CASCADE)
- brief_week (date, the Monday of the week this brief covers)
- health_score (integer 0-100, relationship health based on contact frequency + recency)
- contact_gap_days (integer, days since last logged contact)
- upcoming_event_type (text: birthday, anniversary, holiday, none)
- upcoming_event_date (date, nullable)
- days_until_event (integer, nullable)
- opportunities (jsonb, array of opportunity objects with type/title/url/description/relevance)
- insights (jsonb, array of insight strings)
- brief_summary (text, plain-text summary)
- is_read (boolean, default false)
- created_at (timestamptz)

### 3. relationship_brief_actions
Tracks which opportunities the user acted on (saved, dismissed, completed).
- id (uuid PK)
- user_id (uuid, owner, defaults to auth.uid())
- brief_id (uuid FK -> relationship_briefs.id ON DELETE CASCADE)
- opportunity_index (integer, index into the brief's opportunities array)
- action_type (text: saved, dismissed, completed)
- created_at (timestamptz)

## Security
- RLS enabled on all three tables.
- Owner-scoped CRUD policies (TO authenticated, auth.uid() = user_id) on all tables.
- SELECT on relationship_briefs also checks ownership.
- No public/anon access — these tables contain personal relationship data.

## Indexes
- relationship_contact_log: (user_id, person_id, contact_date DESC) for gap queries
- relationship_briefs: (user_id, brief_week DESC) for weekly listing
- relationship_briefs: (user_id, person_id, brief_week DESC) UNIQUE for dedup
- relationship_brief_actions: (brief_id) for action lookups
*/

-- ============================================================
-- 1. relationship_contact_log
-- ============================================================
CREATE TABLE IF NOT EXISTS relationship_contact_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES real_people(id) ON DELETE CASCADE,
  contact_type text NOT NULL DEFAULT 'text' CHECK (contact_type IN ('call','text','visit','gift','social_media','other')),
  contact_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE relationship_contact_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_contact_log" ON relationship_contact_log;
CREATE POLICY "select_own_contact_log" ON relationship_contact_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_contact_log" ON relationship_contact_log;
CREATE POLICY "insert_own_contact_log" ON relationship_contact_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_contact_log" ON relationship_contact_log;
CREATE POLICY "update_own_contact_log" ON relationship_contact_log
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_contact_log" ON relationship_contact_log;
CREATE POLICY "delete_own_contact_log" ON relationship_contact_log
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_contact_log_user_person_date
  ON relationship_contact_log (user_id, person_id, contact_date DESC);

-- ============================================================
-- 2. relationship_briefs
-- ============================================================
CREATE TABLE IF NOT EXISTS relationship_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES real_people(id) ON DELETE CASCADE,
  brief_week date NOT NULL DEFAULT date_trunc('week', now())::date,
  health_score integer NOT NULL DEFAULT 50 CHECK (health_score >= 0 AND health_score <= 100),
  contact_gap_days integer NOT NULL DEFAULT 0,
  upcoming_event_type text NOT NULL DEFAULT 'none',
  upcoming_event_date date,
  days_until_event integer,
  opportunities jsonb NOT NULL DEFAULT '[]'::jsonb,
  insights jsonb NOT NULL DEFAULT '[]'::jsonb,
  brief_summary text NOT NULL DEFAULT '',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE relationship_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_briefs" ON relationship_briefs;
CREATE POLICY "select_own_briefs" ON relationship_briefs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_briefs" ON relationship_briefs;
CREATE POLICY "insert_own_briefs" ON relationship_briefs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_briefs" ON relationship_briefs;
CREATE POLICY "update_own_briefs" ON relationship_briefs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_briefs" ON relationship_briefs;
CREATE POLICY "delete_own_briefs" ON relationship_briefs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_briefs_user_person_week
  ON relationship_briefs (user_id, person_id, brief_week);

CREATE INDEX IF NOT EXISTS idx_briefs_user_week
  ON relationship_briefs (user_id, brief_week DESC);

-- ============================================================
-- 3. relationship_brief_actions
-- ============================================================
CREATE TABLE IF NOT EXISTS relationship_brief_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  brief_id uuid NOT NULL REFERENCES relationship_briefs(id) ON DELETE CASCADE,
  opportunity_index integer NOT NULL DEFAULT 0,
  action_type text NOT NULL DEFAULT 'saved' CHECK (action_type IN ('saved','dismissed','completed')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE relationship_brief_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_brief_actions" ON relationship_brief_actions;
CREATE POLICY "select_own_brief_actions" ON relationship_brief_actions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_brief_actions" ON relationship_brief_actions;
CREATE POLICY "insert_own_brief_actions" ON relationship_brief_actions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_brief_actions" ON relationship_brief_actions;
CREATE POLICY "delete_own_brief_actions" ON relationship_brief_actions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_brief_actions_brief
  ON relationship_brief_actions (brief_id);