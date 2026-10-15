/*
# Seed additional community boards + add sort_order column

1. Schema Changes
- Adds `sort_order` integer column to `community_boards` (default 0) so boards
  can be arranged intentionally rather than only by creation date.
- Adds an index on (is_pinned DESC, sort_order, created_at) for the board listing query.

2. New Boards Seeded
All owned by the super user (Tim, 3a195a32-ee68-4164-9bd5-40499627a378).
Each is is_approved=true and has a distinct color + icon:
  - Moms (pinned)
  - Dads (pinned)
  - Cooking & Recipes (pinned)
  - Career & Money
  - Fitness & Motivation
  - Gaming Lounge
  - Movies, Music & Pop Culture
  - Tech & Gadgets
  - Sports Talk
  - Travel & Adventure
  - Daily Check-In
  - Spirituality & Reflection

3. Re-indexes existing pinned boards so the ordering is intentional:
   Welcome (0), Updates (1), Relationship Advice (2), Mental Health (3),
   Moms (4), Dads (5), Cooking & Recipes (6).

4. Security
- No RLS policy changes. All new rows are inserted by the migration (service role),
  and existing SELECT policies already allow authenticated users to see approved boards.

5. Idempotent
- Uses ON CONFLICT (id) DO NOTHING so re-running is safe.
- sort_order column uses ADD COLUMN IF NOT EXISTS.
*/

ALTER TABLE community_boards
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_community_boards_listing
  ON community_boards (is_pinned DESC, sort_order ASC, created_at ASC);

-- Re-index existing boards so ordering is predictable
UPDATE community_boards SET sort_order = 0  WHERE id = 'b0000000-0000-0000-0000-000000000001'; -- Welcome
UPDATE community_boards SET sort_order = 10 WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'; -- Updates
UPDATE community_boards SET sort_order = 20 WHERE id = 'b0000000-0000-0000-0000-000000000002'; -- Relationship Advice
UPDATE community_boards SET sort_order = 30 WHERE id = 'b0000000-0000-0000-0000-000000000003'; -- Mental Health

-- Bespoke / priority boards
INSERT INTO community_boards (id, name, description, color, icon, owner_id, is_pinned, is_approved, sort_order)
VALUES
  ('b0000000-0000-0000-0000-000000000007',
   'Moms',
   'A space for moms to vent, celebrate, ask for advice, and share the beautiful chaos of raising kids.',
   'pink', 'Heart', '3a195a32-ee68-4164-9bd5-40499627a378', true, true, 40)
ON CONFLICT (id) DO NOTHING;

INSERT INTO community_boards (id, name, description, color, icon, owner_id, is_pinned, is_approved, sort_order)
VALUES
  ('b0000000-0000-0000-0000-000000000008',
   'Dads',
   'From dad jokes to deep talks — fatherhood, co-parenting, work-life balance, and everything in between.',
   'teal', 'Coffee', '3a195a32-ee68-4164-9bd5-40499627a378', true, true, 50)
ON CONFLICT (id) DO NOTHING;

INSERT INTO community_boards (id, name, description, color, icon, owner_id, is_pinned, is_approved, sort_order)
VALUES
  ('b0000000-0000-0000-0000-000000000009',
   'Cooking & Recipes',
   'Share recipes, weeknight dinners, slow-cooker saves, baking wins (and fails), and kitchen tips. New recipes posted regularly!',
   'amber', 'ChefHat', '3a195a32-ee68-4164-9bd5-40499627a378', true, true, 60)
ON CONFLICT (id) DO NOTHING;

-- Regular (non-pinned) boards
INSERT INTO community_boards (id, name, description, color, icon, owner_id, is_pinned, is_approved, sort_order)
VALUES
  ('b0000000-0000-0000-0000-000000000010',
   'Career & Money',
   'Jobs, side hustles, negotiating salary, debt payoff strategies, and navigating workplace challenges.',
   'emerald', 'Briefcase', '3a195a32-ee68-4164-9bd5-40499627a378', false, true, 100)
ON CONFLICT (id) DO NOTHING;

INSERT INTO community_boards (id, name, description, color, icon, owner_id, is_pinned, is_approved, sort_order)
VALUES
  ('b0000000-0000-0000-0000-000000000011',
   'Fitness & Motivation',
   'Workout routines, running milestones, accountability check-ins, and the motivation to keep showing up.',
   'rose', 'Dumbbell', '3a195a32-ee68-4164-9bd5-40499627a378', false, true, 110)
ON CONFLICT (id) DO NOTHING;

INSERT INTO community_boards (id, name, description, color, icon, owner_id, is_pinned, is_approved, sort_order)
VALUES
  ('b0000000-0000-0000-0000-000000000012',
   'Gaming Lounge',
   'All platforms welcome — new releases, retro favorites, multiplayer meetups, and what you are playing right now.',
   'violet', 'Gamepad2', '3a195a32-ee68-4164-9bd5-40499627a378', false, true, 120)
ON CONFLICT (id) DO NOTHING;

INSERT INTO community_boards (id, name, description, color, icon, owner_id, is_pinned, is_approved, sort_order)
VALUES
  ('b0000000-0000-0000-0000-000000000013',
   'Movies, Music & Pop Culture',
   'What you are watching, what you are listening to, and the pop culture moments everyone is talking about.',
   'rose', 'Film', '3a195a32-ee68-4164-9bd5-40499627a378', false, true, 130)
ON CONFLICT (id) DO NOTHING;

INSERT INTO community_boards (id, name, description, color, icon, owner_id, is_pinned, is_approved, sort_order)
VALUES
  ('b0000000-0000-0000-0000-000000000014',
   'Tech & Gadgets',
   'New releases, apps that actually help, privacy tips, and honest takes on the latest tech.',
   'blue', 'Cpu', '3a195a32-ee68-4164-9bd5-40499627a378', false, true, 140)
ON CONFLICT (id) DO NOTHING;

INSERT INTO community_boards (id, name, description, color, icon, owner_id, is_pinned, is_approved, sort_order)
VALUES
  ('b0000000-0000-0000-0000-000000000015',
   'Sports Talk',
   'Scores, hot takes, fantasy lineups, and game-day reactions across every sport.',
   'emerald', 'Trophy', '3a195a32-ee68-4164-9bd5-40499627a378', false, true, 150)
ON CONFLICT (id) DO NOTHING;

INSERT INTO community_boards (id, name, description, color, icon, owner_id, is_pinned, is_approved, sort_order)
VALUES
  ('b0000000-0000-0000-0000-000000000016',
   'Travel & Adventure',
   'Trip reports, hidden gems, budget travel hacks, and bucket-list destinations.',
   'teal', 'Plane', '3a195a32-ee68-4164-9bd5-40499627a378', false, true, 160)
ON CONFLICT (id) DO NOTHING;

INSERT INTO community_boards (id, name, description, color, icon, owner_id, is_pinned, is_approved, sort_order)
VALUES
  ('b0000000-0000-0000-0000-000000000017',
   'Daily Check-In',
   'How is your day going? Drop in, say hi, share a win or a struggle. Open every day.',
   'blue', 'Sun', '3a195a32-ee68-4164-9bd5-40499627a378', false, true, 170)
ON CONFLICT (id) DO NOTHING;

INSERT INTO community_boards (id, name, description, color, icon, owner_id, is_pinned, is_approved, sort_order)
VALUES
  ('b0000000-0000-0000-0000-000000000018',
   'Spirituality & Reflection',
   'Faith, mindfulness, big questions, and the quiet moments that make life meaningful.',
   'violet', 'Sparkles', '3a195a32-ee68-4164-9bd5-40499627a378', false, true, 180)
ON CONFLICT (id) DO NOTHING;

-- Also set sort_order on the older non-pinned boards so they order cleanly
UPDATE community_boards SET sort_order = 200 WHERE id = 'b0000000-0000-0000-0000-000000000004'; -- Companion Stories
UPDATE community_boards SET sort_order = 210 WHERE id = 'b0000000-0000-0000-0000-000000000005'; -- Loneliness & Connection
UPDATE community_boards SET sort_order = 220 WHERE id = 'b0000000-0000-0000-0000-000000000006'; -- General Discussion
