/*
# Create changelog system for transparent product updates

1. New Tables
- `changelog_entries`
  - `id` (uuid, primary key)
  - `title` (text, not null) — short headline for the update
  - `body` (text, not null) — markdown-compatible description of what changed
  - `version` (text) — optional version tag like "v2.4.1"
  - `category` (text, not null) — one of: feature, improvement, fix, design, game, infra
  - `tags` (text[], default '{}') — optional searchable tags like ['velvet-house', 'coaching']
  - `is_pinned` (boolean, default false) — pinned to top of list
  - `published_at` (timestamptz, default now()) — when the update went live
  - `created_at` (timestamptz, default now())
- `changelog_read_status`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null) — references auth.users
  - `entry_id` (uuid, not null) — references changelog_entries
  - `read_at` (timestamptz, default now())
  - unique constraint on (user_id, entry_id)

2. Security
- Enable RLS on both tables.
- `changelog_entries`: public read (anon + authenticated), no client-side writes.
  Updates are managed server-side via SQL migrations or admin tooling.
- `changelog_read_status`: authenticated users can read/insert only their own rows.

3. Indexes
- `changelog_entries` published_at desc for timeline ordering
- `changelog_read_status` (user_id, entry_id) for lookup
*/

CREATE TABLE IF NOT EXISTS changelog_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  version text,
  category text NOT NULL DEFAULT 'feature',
  tags text[] DEFAULT '{}',
  is_pinned boolean DEFAULT false,
  published_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE changelog_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_changelog" ON changelog_entries;
CREATE POLICY "public_read_changelog"
ON changelog_entries FOR SELECT
TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS changelog_read_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id uuid NOT NULL REFERENCES changelog_entries(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  UNIQUE(user_id, entry_id)
);

ALTER TABLE changelog_read_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_own_read_status" ON changelog_read_status;
CREATE POLICY "read_own_read_status"
ON changelog_read_status FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_read_status" ON changelog_read_status;
CREATE POLICY "insert_own_read_status"
ON changelog_read_status FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_read_status" ON changelog_read_status;
CREATE POLICY "delete_own_read_status"
ON changelog_read_status FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_changelog_published ON changelog_entries (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_changelog_pinned ON changelog_entries (is_pinned DESC);
CREATE INDEX IF NOT EXISTS idx_read_status_user_entry ON changelog_read_status (user_id, entry_id);

-- Seed initial entries covering the past month of updates
INSERT INTO changelog_entries (title, body, category, tags, is_pinned, published_at) VALUES
('Velvet House: Gender-Locked Avatars & Staged Move-In',
'Characters in Velvet House now respect gender from your Velvet profile. Male and female avatars have distinct body shapes, hairstyles, and facial hair — no more mismatched appearances. Gender is locked per save file.

The move-in sequence is now staged: a mover NPC delivers one box at a time, each teaching a placement mechanic. No more 10 boxes on the floor at once. Every furniture purchase now arrives as a box the mover carries in — tap to open with an animation, then place.',
'game', ARRAY['velvet-house', 'avatars', 'ux'], false, '2026-10-15 12:00:00+00'),

('Community Boards',
'Launched the community board system. Create boards, start discussions, react with like/support/relate, and report content. Boards are color-coded with custom icons. AI-generated content is always labeled.',
'feature', ARRAY['community', 'social'], false, '2026-10-15 06:00:00+00'),

('Coaching System Overhaul',
'Reworked the coaching pipeline: commitment tracking, progress dashboards, weekly review cron jobs, and confidence checks. Coaches can now create structured plans with resource caching.',
'improvement', ARRAY['coaching', 'cron'], false, '2026-10-14 18:00:00+00'),

('Memory System v2',
'Shipped a versioned memory store with semantic search, dream hygiene cron jobs, and a proposal system for memory consolidation. Memories are now traceable with event logs.',
'feature', ARRAY['memory', 'ai'], false, '2026-10-02 20:00:00+00'),

('Onboarding Flow Redesign',
'Streamlined the onboarding pipeline with a guided tour, setup progress tracking, and a tutorial director that highlights features contextually. New users get a smoother first-run experience.',
'design', ARRAY['onboarding', 'ux'], false, '2026-10-03 15:00:00+00'),

('Morning Journal',
'Added a morning journal feature with AI-generated journal entries. Users can reflect on their day with prompts tailored to their companion relationship and recent activity.',
'feature', ARRAY['journal', 'ai'], false, '2026-10-12 10:00:00+00'),

('Security Hardening Pass',
'Tightened RLS policies across the platform, revoked anon writes on user customization, bound SECURITY DEFINER functions to session roles, and locked down privileged columns on user profiles.',
'fix', ARRAY['security', 'rls'], false, '2026-10-09 13:00:00+00'),

('Co-Author v2 Templates',
'Upgraded the collaborative writing tool with new templates, outline support, and a markdown canvas. Co-author sessions now persist outlines between saves.',
'improvement', ARRAY['coauthor', 'writing'], false, '2026-10-08 14:00:00+00'),

('Local Explorer & Atlas Agent',
'Built the local explorer with Navi voice integration and shipped the Atlas concierge agent for contextual guidance. Atlas now supports goal text and voice preferences.',
'feature', ARRAY['atlas', 'explorer', 'voice'], false, '2026-10-04 16:00:00+00'),

('Pet Companion System',
'Introduced pet companions with level progression, daily care routines, and a tool radial. Pets have mood states and activities that respond to player interaction.',
'feature', ARRAY['pets', 'gamification'], false, '2026-05-06 13:00:00+00')
ON CONFLICT DO NOTHING;
