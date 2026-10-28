/*
# Hate-speech word bank

Stops slurs and hate speech from being posted anywhere public, with no API
calls: the check runs inside the database on every insert or edit, so the app,
edge functions and direct API calls all go through it. Swearing is allowed.
The goal is hate, not adult language.

## Tables

- `moderation_terms`: the word bank. Admins edit it (RLS); members can't read it.
  - `term`: a word or phrase, lowercase letters, digits and single spaces.
  - `tier`: `block` refuses the text; `flag` lets it through and logs it to
    `moderation_hits` for an admin to look at (for words with innocent uses,
    or that some groups reclaim).
  - `match_anywhere`: also match inside other words ("xslurx"). Off by default,
    so "spic" doesn't hit "spicy" and "coon" doesn't hit "raccoon".
  - `pattern` (generated): the regex. Each letter may repeat ("fagggot"),
    phrases may drop their spaces, and plurals ending in s/z/es match.
- `moderation_hits`: flagged text that was allowed through. Admin-only.

## Matching

`moderation_forms()` makes two versions of the text and both are checked:
lowercased with accents, fullwidth letters and look-alike Cyrillic/Greek
letters mapped to plain letters, zero-width characters removed, punctuation turned into spaces, and
runs of 3+ single letters joined ("n.i.g.g.e.r" and "n i g g e r"); and the
same with leetspeak undone (@ 4 → a, 3 → e, 1 ! | → i, 0 → o, $ 5 → s, ...).

## Where it runs

BEFORE INSERT or UPDATE of the text columns on: statuses
(`progress_posts.body`, status rows only), comments on posts, Community Board
posts, comments and live-room messages, space and crew names and
descriptions, and public profile name, headline and bio. Updates only check
when the text itself changed, so old rows never block unrelated updates.

A blocked write fails with SQLSTATE `VM001` and a message that can be shown to
the user as is. Private messages (`im_messages`) are not checked.
*/

-- The word bank
CREATE TABLE IF NOT EXISTS public.moderation_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL UNIQUE CHECK (term ~ '^[a-z0-9]+( [a-z0-9]+)*$'),
  tier text NOT NULL CHECK (tier IN ('block', 'flag')),
  category text NOT NULL,
  match_anywhere boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  pattern text GENERATED ALWAYS AS (
    CASE WHEN match_anywhere THEN '' ELSE '\m' END
    || regexp_replace(regexp_replace(term, '([a-z0-9])', '\1+', 'g'), ' ', '\\s*', 'g')
    || CASE WHEN match_anywhere THEN '' ELSE '(s|z|es)?\M' END
  ) STORED
);

ALTER TABLE public.moderation_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_moderation_terms" ON public.moderation_terms;
CREATE POLICY "admins_manage_moderation_terms" ON public.moderation_terms
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON public.moderation_terms FROM anon;

-- Flagged text that was allowed through
CREATE TABLE IF NOT EXISTS public.moderation_hits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text NOT NULL,
  term text NOT NULL,
  category text NOT NULL,
  excerpt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moderation_hits_created ON public.moderation_hits (created_at DESC);

ALTER TABLE public.moderation_hits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_read_moderation_hits" ON public.moderation_hits;
CREATE POLICY "admins_read_moderation_hits" ON public.moderation_hits
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "admins_delete_moderation_hits" ON public.moderation_hits;
CREATE POLICY "admins_delete_moderation_hits" ON public.moderation_hits
  FOR DELETE TO authenticated USING (public.is_admin());

REVOKE ALL ON public.moderation_hits FROM anon;
REVOKE INSERT, UPDATE ON public.moderation_hits FROM authenticated;

-- Join runs of 3+ single-character tokens: "n i g g e r" -> "nigger".
CREATE OR REPLACE FUNCTION public.moderation_join_letters(p text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  tok text;
  out text := '';
  run text := '';
BEGIN
  FOREACH tok IN ARRAY regexp_split_to_array(btrim(p), '\s+') || ARRAY['']::text[] LOOP
    IF char_length(tok) = 1 THEN
      run := run || tok;
    ELSE
      IF char_length(run) >= 3 THEN
        out := out || ' ' || run;
      ELSIF run <> '' THEN
        out := out || ' ' || regexp_replace(run, '(.)', '\1 ', 'g');
      END IF;
      run := '';
      out := out || ' ' || tok;
    END IF;
  END LOOP;
  RETURN btrim(regexp_replace(out, '\s+', ' ', 'g'));
END;
$$;

-- The two versions of a text that get matched against the bank.
CREATE OR REPLACE FUNCTION public.moderation_forms(p_text text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  base text;
BEGIN
  -- NFKD splits accents off their letters and maps fullwidth and styled
  -- letters to plain ones; the accents and zero-width characters are dropped.
  base := normalize(lower(COALESCE(p_text, '')), NFKD);
  base := regexp_replace(base, '[\u0300-\u036f\u200b-\u200f\u2060\ufeff\u00ad]', '', 'g');
  base := translate(base,
    'àáâãäåāăąçćčĉċďđèéêëēėęěĕğĝġģìíîïīįıĭñńňņòóôõöøōőŏùúûüūůűųŭýÿŷžźżšśşŝșťţțłřŕаеорсхуіјѕԁкмтвнɡαεικνορτυχ',
    'aaaaaaaaacccccddeeeeeeeeeggggiiiiiiiinnnnooooooooouuuuuuuuuyyyzzzssssstttlrraeopcxyijsdkmtbhgaeikvoptux');
  RETURN ARRAY[
    public.moderation_join_letters(regexp_replace(base, '[^a-z0-9]+', ' ', 'g')),
    public.moderation_join_letters(regexp_replace(translate(base, '@48391!|0$57+', 'aabegiiiosstt'), '[^a-z0-9]+', ' ', 'g'))
  ];
END;
$$;

-- The most serious match for a text (block before flag), or no row.
CREATE OR REPLACE FUNCTION public.moderation_screen(p_text text)
RETURNS TABLE (term text, tier text, category text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT t.term, t.tier, t.category
  FROM public.moderation_terms t
  CROSS JOIN unnest(public.moderation_forms(p_text)) AS f(form)
  WHERE t.active AND f.form ~ t.pattern
  ORDER BY (t.tier = 'block') DESC, char_length(t.term) DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.moderation_screen(text) FROM PUBLIC, anon, authenticated;

-- Admin console: try a phrase against the bank.
CREATE OR REPLACE FUNCTION public.moderation_test(p_text text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  hit record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  SELECT * INTO hit FROM public.moderation_screen(p_text);
  RETURN jsonb_build_object(
    'action', COALESCE(hit.tier, 'allow'),
    'term', hit.term,
    'category', hit.category,
    'forms', to_jsonb(public.moderation_forms(p_text))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.moderation_test(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderation_test(text) TO authenticated;

-- Trigger: TG_ARGV lists the text columns to check.
CREATE OR REPLACE FUNCTION public.moderation_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) END;
  v_text text := '';
  v_changed boolean := TG_OP = 'INSERT';
  col text;
  hit record;
BEGIN
  FOREACH col IN ARRAY TG_ARGV LOOP
    v_text := v_text || ' ' || COALESCE(v_new->>col, '');
    IF TG_OP = 'UPDATE' AND (v_new->col) IS DISTINCT FROM (v_old->col) THEN
      v_changed := true;
    END IF;
  END LOOP;

  IF NOT v_changed OR btrim(v_text) = '' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO hit FROM public.moderation_screen(v_text);

  IF hit.tier = 'block' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'VM001',
      MESSAGE = 'That includes a slur or hate speech, which Velvet doesn''t allow. Swearing is fine. Please rephrase.',
      HINT = 'moderation_blocked';
  ELSIF hit.tier = 'flag' THEN
    INSERT INTO public.moderation_hits (user_id, source, term, category, excerpt)
    VALUES (
      COALESCE(auth.uid(), (v_new->>'user_id')::uuid, (v_new->>'author_id')::uuid, (v_new->>'owner_id')::uuid),
      TG_TABLE_NAME, hit.term, hit.category, left(btrim(v_text), 280)
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.moderation_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_moderation_guard ON public.progress_posts;
CREATE TRIGGER trg_moderation_guard
  BEFORE INSERT OR UPDATE OF body ON public.progress_posts
  FOR EACH ROW WHEN (NEW.post_type = 'status')
  EXECUTE FUNCTION public.moderation_guard('body');

DROP TRIGGER IF EXISTS trg_moderation_guard ON public.progress_post_comments;
CREATE TRIGGER trg_moderation_guard
  BEFORE INSERT OR UPDATE OF body ON public.progress_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.moderation_guard('body');

DROP TRIGGER IF EXISTS trg_moderation_guard ON public.community_posts;
CREATE TRIGGER trg_moderation_guard
  BEFORE INSERT OR UPDATE OF title, body ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.moderation_guard('title', 'body');

DROP TRIGGER IF EXISTS trg_moderation_guard ON public.community_comments;
CREATE TRIGGER trg_moderation_guard
  BEFORE INSERT OR UPDATE OF body ON public.community_comments
  FOR EACH ROW EXECUTE FUNCTION public.moderation_guard('body');

DROP TRIGGER IF EXISTS trg_moderation_guard ON public.community_room_messages;
CREATE TRIGGER trg_moderation_guard
  BEFORE INSERT OR UPDATE OF body ON public.community_room_messages
  FOR EACH ROW EXECUTE FUNCTION public.moderation_guard('body');

DROP TRIGGER IF EXISTS trg_moderation_guard ON public.community_boards;
CREATE TRIGGER trg_moderation_guard
  BEFORE INSERT OR UPDATE OF name, description ON public.community_boards
  FOR EACH ROW EXECUTE FUNCTION public.moderation_guard('name', 'description');

DROP TRIGGER IF EXISTS trg_moderation_guard ON public.member_profiles;
CREATE TRIGGER trg_moderation_guard
  BEFORE INSERT OR UPDATE OF display_name, headline, bio ON public.member_profiles
  FOR EACH ROW EXECUTE FUNCTION public.moderation_guard('display_name', 'headline', 'bio');

-- Starter bank. Block: slurs and calls for violence with no innocent use.
-- Flag: words with innocent or reclaimed uses; logged for review, not refused.
INSERT INTO public.moderation_terms (term, tier, category, match_anywhere, note) VALUES
  -- Racial and ethnic slurs
  ('nigger', 'block', 'racial', true, 'Also matches inside other words.'),
  ('nigra', 'block', 'racial', false, null),
  ('jigaboo', 'block', 'racial', false, null),
  ('porch monkey', 'block', 'racial', false, null),
  ('jungle bunny', 'block', 'racial', false, null),
  ('golliwog', 'block', 'racial', false, null),
  ('spic', 'block', 'racial', false, null),
  ('wetback', 'block', 'racial', false, null),
  ('beaner', 'block', 'racial', false, null),
  ('gook', 'block', 'racial', false, null),
  ('zipperhead', 'block', 'racial', false, null),
  ('slant eye', 'block', 'racial', false, null),
  ('raghead', 'block', 'racial', false, null),
  ('towelhead', 'block', 'racial', false, null),
  ('sand monkey', 'block', 'racial', false, null),
  ('camel jockey', 'block', 'racial', false, null),
  ('paki', 'block', 'racial', false, null),
  ('nigga', 'flag', 'racial', false, 'Common in-group and in lyrics; logged, not refused.'),
  ('coon', 'flag', 'racial', false, 'Also a nickname and short for raccoon.'),
  ('chink', 'flag', 'racial', false, 'Also "a chink in the armor".'),
  ('chinaman', 'flag', 'racial', false, null),
  ('redskin', 'flag', 'racial', false, null),
  ('squaw', 'flag', 'racial', false, null),
  ('half breed', 'flag', 'racial', false, null),
  ('tar baby', 'flag', 'racial', false, null),
  ('wop', 'flag', 'racial', false, null),
  ('dago', 'flag', 'racial', false, null),
  -- Antisemitic
  ('kike', 'block', 'antisemitic', false, null),
  ('christ killer', 'block', 'antisemitic', false, null),
  ('oven dodger', 'block', 'antisemitic', false, null),
  ('gas the jews', 'block', 'antisemitic', false, null),
  ('hymie', 'flag', 'antisemitic', false, null),
  ('heeb', 'flag', 'antisemitic', false, null),
  -- Homophobic
  ('faggot', 'block', 'homophobic', true, 'Also matches inside other words.'),
  ('fag', 'block', 'homophobic', false, null),
  ('batty boy', 'block', 'homophobic', false, null),
  ('fudge packer', 'block', 'homophobic', false, null),
  ('carpet muncher', 'block', 'homophobic', false, null),
  ('dyke', 'flag', 'homophobic', false, 'Reclaimed by some; also a spelling of dike.'),
  ('lesbo', 'flag', 'homophobic', false, null),
  ('homo', 'flag', 'homophobic', false, null),
  ('poof', 'flag', 'homophobic', false, null),
  ('pillow biter', 'flag', 'homophobic', false, null),
  -- Transphobic
  ('tranny', 'block', 'transphobic', false, null),
  ('shemale', 'block', 'transphobic', false, null),
  ('troon', 'block', 'transphobic', false, null),
  -- Ableist
  ('retard', 'flag', 'ableist', false, null),
  ('mongoloid', 'flag', 'ableist', false, null),
  -- Harassment and extremism
  ('kill yourself', 'block', 'harassment', false, null),
  ('kys', 'block', 'harassment', false, null),
  ('heil hitler', 'block', 'extremist', false, null),
  ('sieg heil', 'block', 'extremist', false, null),
  ('white power', 'flag', 'extremist', false, null),
  ('1488', 'flag', 'extremist', false, null),
  ('14 88', 'flag', 'extremist', false, null)
ON CONFLICT (term) DO NOTHING;
