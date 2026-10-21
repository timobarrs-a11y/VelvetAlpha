/*
# Phase 3: Medals

## Plain-English summary
One medal system for the whole site. Each medal names a stat ("metric") and
a number to hit ("threshold"). Progress is calculated from tables that
already exist (commitments, goals, check-ins, friends, likes, referrals,
community activity) and refreshed by triggers the moment something happens,
so medals pop instantly. Earned medals are permanent.

When a medal is earned:
- a 'badge' notification goes to the user (community_notifications, with the
  medal in the new `meta` column), and
- a 'medal_earned' progress post goes to the Feed if their profile is public.

The old get_community_badges() RPC keeps its JSON shape but now reads from
the new tables, so the existing BadgeRow on posts keeps working.

## Tables
- medals       catalog (slug, name, description, category, tier, icon, metric, threshold, ...)
- user_medals  per-user progress and earned_at, plus up to 3 showcase slots

## Editing the catalog
Add or change rows in `medals` (no code changes). `metric` must be one of the
keys returned by medal_stats(). Set `available_until` on an exclusive medal
to close it forever (Day One: set it the day the alpha ends).

## Performance note
Each triggering write recalculates one user's stats (about 15 indexed
counts). That's fine for alpha and beta. If room chat gets very busy, move
the room-message trigger to a queue.

Requires Phase 2. Idempotent.
*/

-- ============================================================
-- 1. Catalog
-- ============================================================
CREATE TABLE IF NOT EXISTS public.medals (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL CHECK (category IN ('goals', 'streaks', 'social', 'community', 'coach', 'hidden', 'exclusive')),
  tier text NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'legendary')),
  icon text NOT NULL DEFAULT 'Award',
  metric text NOT NULL,
  threshold int NOT NULL DEFAULT 1 CHECK (threshold > 0),
  is_hidden boolean NOT NULL DEFAULT false,
  available_until timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medals_select" ON public.medals;
CREATE POLICY "medals_select" ON public.medals FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "medals_admin" ON public.medals;
CREATE POLICY "medals_admin" ON public.medals
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.user_medals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medal_slug text NOT NULL REFERENCES public.medals(slug) ON DELETE CASCADE ON UPDATE CASCADE,
  progress int NOT NULL DEFAULT 0,
  earned_at timestamptz,
  showcase_slot smallint CHECK (showcase_slot BETWEEN 1 AND 3),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, medal_slug),
  UNIQUE (user_id, showcase_slot)
);
CREATE INDEX IF NOT EXISTS idx_user_medals_slug_earned ON public.user_medals (medal_slug) WHERE earned_at IS NOT NULL;
ALTER TABLE public.user_medals ENABLE ROW LEVEL SECURITY;

-- Own rows, or other people's EARNED medals when their profile is public.
-- No client writes: refresh_user_medals() and set_medal_showcase() do that.
DROP POLICY IF EXISTS "user_medals_select" ON public.user_medals;
CREATE POLICY "user_medals_select" ON public.user_medals
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (earned_at IS NOT NULL AND public.has_public_profile(user_id)));

-- Notifications carry the medal, and stream live so the client can pop a toast.
ALTER TABLE public.community_notifications ADD COLUMN IF NOT EXISTS meta jsonb;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'community_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_notifications;
  END IF;
END $$;

-- ============================================================
-- 2. Stats: one jsonb of every metric for a user
-- ============================================================
CREATE OR REPLACE FUNCTION public.medal_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH days AS (
    SELECT checkin_date,
           checkin_date - (row_number() OVER (ORDER BY checkin_date))::int AS grp,
           checkin_date - lag(checkin_date) OVER (ORDER BY checkin_date) AS gap
    FROM public.user_daily_checkins
    WHERE user_id = p_user_id
  ),
  runs AS (
    SELECT count(*) AS len FROM days GROUP BY grp
  )
  SELECT jsonb_build_object(
    'commitments_completed',
      (SELECT count(*) FROM public.coaching_commitments WHERE user_id = p_user_id AND status = 'completed'),
    'coach_commitments_completed',
      (SELECT count(*) FROM public.coaching_commitments WHERE user_id = p_user_id AND status = 'completed' AND is_user_created = false),
    'goals_completed',
      (SELECT count(*) FROM public.user_goals WHERE user_id = p_user_id AND status = 'completed'),
    'best_goal_percent',
      (SELECT COALESCE(max(floor(LEAST(current_value / target_value, 1) * 100)), 0)::int
       FROM public.user_goals
       WHERE user_id = p_user_id AND target_value > 0 AND current_value IS NOT NULL AND status <> 'abandoned'),
    'longest_streak',
      (SELECT COALESCE(max(longest_streak), 0) FROM public.user_customization WHERE user_id = p_user_id),
    'seven_day_streaks',
      (SELECT count(*) FROM runs WHERE len >= 7),
    'comeback',
      (SELECT CASE WHEN EXISTS (SELECT 1 FROM days WHERE gap >= 15) THEN 1 ELSE 0 END),
    'friends',
      (SELECT count(*) FROM public.im_friendships
       WHERE status = 'accepted' AND (requester_id = p_user_id OR addressee_id = p_user_id)),
    'likes_given',
      (SELECT count(*) FROM public.community_reactions WHERE user_id = p_user_id)
      + (SELECT count(*) FROM public.progress_post_likes WHERE user_id = p_user_id),
    'reactions_received',
      (SELECT count(*) FROM public.community_reactions r
       WHERE r.user_id <> p_user_id AND (
         (r.target_type = 'post' AND EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = r.target_id AND p.author_id = p_user_id))
         OR (r.target_type = 'comment' AND EXISTS (SELECT 1 FROM public.community_comments c WHERE c.id = r.target_id AND c.author_id = p_user_id))
       )),
    'referrals',
      (SELECT count(*) FROM public.referrals WHERE referrer_id = p_user_id AND status = 'qualified'),
    'posts_created',
      (SELECT count(*) FROM public.community_posts WHERE author_id = p_user_id),
    'comments_created',
      (SELECT count(*) FROM public.community_comments WHERE author_id = p_user_id),
    'spaces_joined_manually',
      (SELECT count(*) FROM public.community_board_members WHERE user_id = p_user_id AND source = 'manual'),
    'room_messages',
      (SELECT count(*) FROM public.community_room_messages WHERE author_id = p_user_id AND deleted_at IS NULL),
    'alpha_member',
      (SELECT count(*) FROM public.community_board_members
       WHERE user_id = p_user_id AND board_id = 'b0000000-0000-0000-0000-000000000100')
  );
$$;
REVOKE EXECUTE ON FUNCTION public.medal_stats(uuid) FROM anon, authenticated, public;

-- ============================================================
-- 3. Refresh one user's medals (internal)
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_user_medals(p_user_id uuid, p_announce boolean DEFAULT true)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_stats jsonb;
  m record;
  v_progress int;
  v_was_earned boolean;
  v_row public.user_medals%ROWTYPE;
  v_new int := 0;
BEGIN
  IF p_user_id IS NULL THEN RETURN 0; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_user_id AND COALESCE(is_bot, false) = false) THEN
    RETURN 0;
  END IF;

  v_stats := public.medal_stats(p_user_id);

  FOR m IN SELECT * FROM public.medals WHERE is_active LOOP
    v_progress := COALESCE((v_stats ->> m.metric)::int, 0);

    SELECT earned_at IS NOT NULL INTO v_was_earned
    FROM public.user_medals WHERE user_id = p_user_id AND medal_slug = m.slug;
    v_was_earned := COALESCE(v_was_earned, false);

    INSERT INTO public.user_medals (user_id, medal_slug, progress, earned_at, updated_at)
    VALUES (
      p_user_id, m.slug, v_progress,
      CASE WHEN v_progress >= m.threshold AND (m.available_until IS NULL OR now() <= m.available_until)
           THEN now() END,
      now()
    )
    ON CONFLICT (user_id, medal_slug) DO UPDATE
      SET progress = EXCLUDED.progress,
          earned_at = COALESCE(public.user_medals.earned_at, EXCLUDED.earned_at),
          updated_at = now()
      WHERE public.user_medals.progress IS DISTINCT FROM EXCLUDED.progress
         OR (public.user_medals.earned_at IS NULL AND EXCLUDED.earned_at IS NOT NULL)
    RETURNING * INTO v_row;

    IF NOT v_was_earned AND v_row.earned_at IS NOT NULL THEN
      v_new := v_new + 1;
      IF p_announce THEN
        INSERT INTO public.community_notifications (user_id, type, meta)
        VALUES (p_user_id, 'badge', jsonb_build_object(
          'medal_slug', m.slug, 'name', m.name, 'tier', m.tier, 'icon', m.icon));

        IF public.has_public_profile(p_user_id)
           AND NOT public.post_exists_for_target(p_user_id, 'user_medals', v_row.id, 'medal_earned') THEN
          INSERT INTO public.progress_posts (user_id, post_type, title, body, ref_target_type, ref_target_id)
          VALUES (p_user_id, 'medal_earned', 'Earned ' || m.name, m.description, 'user_medals', v_row.id);
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN v_new;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.refresh_user_medals(uuid, boolean) FROM anon, authenticated, public;

-- ============================================================
-- 4. Triggers: recalculate the affected user(s). Never block the write.
-- ============================================================
CREATE OR REPLACE FUNCTION public.medal_touch()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_users uuid[] := '{}';
  v_author uuid;
  u uuid;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'coaching_commitments', 'user_goals', 'user_customization', 'user_daily_checkins', 'community_board_members' THEN
      v_users := ARRAY[NEW.user_id];
    WHEN 'progress_post_likes' THEN
      v_users := ARRAY[NEW.user_id];
    WHEN 'im_friendships' THEN
      v_users := ARRAY[NEW.requester_id, NEW.addressee_id];
    WHEN 'referrals' THEN
      v_users := ARRAY[NEW.referrer_id];
    WHEN 'community_posts', 'community_comments' THEN
      v_users := ARRAY[NEW.author_id];
    WHEN 'community_room_messages' THEN
      v_users := ARRAY[NEW.author_id];
    WHEN 'community_reactions' THEN
      IF NEW.target_type = 'post' THEN
        SELECT author_id INTO v_author FROM public.community_posts WHERE id = NEW.target_id;
      ELSE
        SELECT author_id INTO v_author FROM public.community_comments WHERE id = NEW.target_id;
      END IF;
      v_users := ARRAY[NEW.user_id, v_author];
    ELSE
      RETURN NEW;
  END CASE;

  FOREACH u IN ARRAY v_users LOOP
    IF u IS NOT NULL THEN
      BEGIN
        PERFORM public.refresh_user_medals(u, true);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'refresh_user_medals failed for %: %', u, SQLERRM;
      END;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'coaching_commitments', 'user_goals', 'user_daily_checkins',
    'im_friendships', 'community_reactions', 'progress_post_likes', 'referrals',
    'community_posts', 'community_comments', 'community_board_members', 'community_room_messages'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_medal_touch ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_medal_touch AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.medal_touch()',
      t);
  END LOOP;
END $$;

-- user_customization also stores UI prefs; only streak changes matter.
DROP TRIGGER IF EXISTS trg_medal_touch ON public.user_customization;
CREATE TRIGGER trg_medal_touch
  AFTER INSERT OR UPDATE OF current_streak, longest_streak ON public.user_customization
  FOR EACH ROW EXECUTE FUNCTION public.medal_touch();

-- ============================================================
-- 5. Client RPCs
-- ============================================================

-- Medal case for a profile. Own profile: every medal with progress (hidden
-- unearned ones masked). Someone else's: only earned medals, only if public.
CREATE OR REPLACE FUNCTION public.get_user_medals(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  slug text, name text, description text, category text, tier text, icon text,
  threshold int, progress int, earned_at timestamptz, showcase_slot smallint,
  is_hidden boolean, earned_percent numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_target uuid := COALESCE(p_user_id, auth.uid());
  v_is_self boolean := (COALESCE(p_user_id, auth.uid()) = auth.uid());
  v_total numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT v_is_self AND NOT public.has_public_profile(v_target) THEN
    RETURN;
  END IF;

  SELECT GREATEST(count(*), 1) INTO v_total
  FROM public.user_profiles WHERE COALESCE(is_bot, false) = false;

  RETURN QUERY
  SELECT
    md.slug,
    CASE WHEN md.is_hidden AND um.earned_at IS NULL THEN '???' ELSE md.name END,
    CASE WHEN md.is_hidden AND um.earned_at IS NULL THEN 'A secret. Keep going.' ELSE md.description END,
    md.category, md.tier, md.icon, md.threshold,
    LEAST(COALESCE(um.progress, 0), md.threshold),
    um.earned_at, um.showcase_slot, md.is_hidden,
    round(100.0 * (SELECT count(*) FROM public.user_medals x WHERE x.medal_slug = md.slug AND x.earned_at IS NOT NULL) / v_total, 1)
  FROM public.medals md
  LEFT JOIN public.user_medals um ON um.medal_slug = md.slug AND um.user_id = v_target
  WHERE md.is_active
    AND (v_is_self OR um.earned_at IS NOT NULL)
    AND (um.earned_at IS NOT NULL OR md.available_until IS NULL OR now() <= md.available_until)
  ORDER BY (um.earned_at IS NULL), um.showcase_slot NULLS LAST, md.sort_order, md.name;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_user_medals(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_user_medals(uuid) TO authenticated;

-- Pin up to 3 earned medals, in order. Pass '{}' to clear.
CREATE OR REPLACE FUNCTION public.set_medal_showcase(p_slugs text[])
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  i int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF COALESCE(array_length(p_slugs, 1), 0) > 3 THEN RAISE EXCEPTION 'Pick up to 3 medals'; END IF;

  UPDATE public.user_medals SET showcase_slot = NULL WHERE user_id = auth.uid() AND showcase_slot IS NOT NULL;

  FOR i IN 1 .. COALESCE(array_length(p_slugs, 1), 0) LOOP
    UPDATE public.user_medals SET showcase_slot = i
    WHERE user_id = auth.uid() AND medal_slug = p_slugs[i] AND earned_at IS NOT NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Medal % is not earned', p_slugs[i]; END IF;
  END LOOP;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_medal_showcase(text[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_medal_showcase(text[]) TO authenticated;

-- Keep the old badge RPC (used by BadgeRow on posts) working from the new tables.
CREATE OR REPLACE FUNCTION public.get_community_badges(p_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT COALESCE(json_agg(json_build_object('key', md.slug, 'label', md.name, 'description', md.description)
                           ORDER BY um.showcase_slot NULLS LAST, md.sort_order), '[]'::json)
  FROM public.user_medals um
  JOIN public.medals md ON md.slug = um.medal_slug
  WHERE um.user_id = p_user_id
    AND um.earned_at IS NOT NULL
    AND (um.showcase_slot IS NOT NULL OR md.category = 'community');
$$;

-- ============================================================
-- 6. Starter catalog
-- ============================================================
INSERT INTO public.medals (slug, name, description, category, tier, icon, metric, threshold, is_hidden, sort_order)
VALUES
  ('first-step',            'First Step',             'Complete your first commitment.',                  'goals',     'bronze',    'Footprints',        'commitments_completed',       1,   false, 10),
  ('halfway-there',         'Halfway There',          'Reach 50% on any goal.',                           'goals',     'bronze',    'Flag',              'best_goal_percent',           50,  false, 11),
  ('hat-trick',             'Hat Trick',              'Complete 3 goals.',                                'goals',     'silver',    'Target',            'goals_completed',             3,   false, 12),
  ('promise-keeper',        'Promise Keeper',         'Complete 25 commitments.',                         'goals',     'silver',    'Handshake',         'commitments_completed',       25,  false, 13),
  ('the-closer',            'The Closer',             'Complete 10 goals.',                               'goals',     'gold',      'Trophy',            'goals_completed',             10,  false, 14),
  ('showed-up',             'Showed Up',              'Check in 7 days in a row.',                        'streaks',   'bronze',    'CalendarCheck',     'longest_streak',              7,   false, 20),
  ('habit-forming',         'Habit Forming',          'Hit a 7-day streak 4 separate times.',             'streaks',   'silver',    'Repeat',            'seven_day_streaks',           4,   false, 21),
  ('iron-will',             'Iron Will',              'Check in 30 days in a row.',                       'streaks',   'gold',      'Flame',             'longest_streak',              30,  false, 22),
  ('unbreakable',           'Unbreakable',            'Check in 100 days in a row.',                      'streaks',   'legendary', 'Gem',               'longest_streak',              100, false, 23),
  ('a-friend-in-need',      'A Friend in Need...',    'Make 10 friends.',                                 'social',    'silver',    'Users',             'friends',                     10,  false, 30),
  ('is-a-friend-indeed',    '...Is a Friend Indeed',  'Make 20 friends.',                                 'social',    'gold',      'HeartHandshake',    'friends',                     20,  false, 31),
  ('hype-man',              'Hype Man',               'Like 25 posts or comments from other people.',     'social',    'bronze',    'ThumbsUp',          'likes_given',                 25,  false, 32),
  ('plus-one',              'Plus One',               'Invite someone who joins Velvet.',                 'social',    'silver',    'UserPlus',          'referrals',                   1,   false, 33),
  ('found-my-people',       'Found My People',        'Join a space on your own.',                        'community', 'bronze',    'DoorOpen',          'spaces_joined_manually',      1,   false, 40),
  ('first-post',            'First Post',             'Publish your first post.',                         'community', 'bronze',    'PenLine',           'posts_created',               1,   false, 41),
  ('conversation-starter',  'Conversation Starter',   'Publish 5 posts.',                                 'community', 'silver',    'MessageSquarePlus', 'posts_created',               5,   false, 42),
  ('community-helper',      'Community Helper',       'Leave 10 comments.',                               'community', 'bronze',    'MessageCircle',     'comments_created',            10,  false, 43),
  ('rising-star',           'Rising Star',            'Get 10 reactions from other people.',              'community', 'bronze',    'Star',              'reactions_received',          10,  false, 44),
  ('crowd-favorite',        'Crowd Favorite',         'Get 25 reactions from other people.',              'community', 'silver',    'Sparkles',          'reactions_received',          25,  false, 45),
  ('life-of-the-party',     'Life of the Party',      'Send 100 messages in live rooms.',                 'community', 'silver',    'PartyPopper',       'room_messages',               100, false, 46),
  ('coachable',             'Coachable',              'Complete 10 commitments your coach set.',          'coach',     'silver',    'GraduationCap',     'coach_commitments_completed', 10,  false, 50),
  ('comeback-kid',          'Comeback Kid',           'Come back after 14+ days away.',                   'hidden',    'silver',    'RotateCcw',         'comeback',                    1,   true,  60),
  ('day-one',               'Day One',                'Founding member of the Velvet Alpha. Never earnable again.', 'exclusive', 'legendary', 'Crown', 'alpha_member',            1,   false, 0)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 7. Backfill quietly (no notifications or feed posts for old activity)
-- ============================================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.user_profiles WHERE COALESCE(is_bot, false) = false LOOP
    PERFORM public.refresh_user_medals(r.id, false);
  END LOOP;
END $$;
