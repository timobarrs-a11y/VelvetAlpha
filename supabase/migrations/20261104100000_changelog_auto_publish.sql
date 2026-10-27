-- Changelog auto-publish
--
-- Entries used to be added by hand with SQL (the ten from October 15 were), so the changelog
-- stopped there. When a pull request is merged, a GitHub workflow now calls
-- ingest_changelog_entry with the PR's "What's new" text, and the entry appears in the app
-- (and is cross-posted to the community board by the existing trigger).
--
-- Nothing is written without a shared secret. The secret itself is never stored here, only
-- its sha256 hash, in a table that no signed-in user can read.
--
-- ONE-TIME SETUP (see scripts/changelog/README.md):
--   1. Pick a long random string. Add it to GitHub: Settings > Secrets and variables > Actions >
--      New repository secret, named CHANGELOG_INGEST_SECRET.
--   2. Store its hash, by running this in the Supabase SQL editor (replace the text in quotes):
--        insert into public.server_secrets (key, value)
--        values ('changelog_ingest_secret_hash', encode(sha256(convert_to('YOUR-LONG-RANDOM-STRING', 'utf8')), 'hex'))
--        on conflict (key) do update set value = excluded.value, updated_at = now();
--   3. Add two repository variables: SUPABASE_URL and SUPABASE_ANON_KEY (the same public values
--      the app uses).

ALTER TABLE public.changelog_entries ADD COLUMN IF NOT EXISTS source_ref text;
CREATE UNIQUE INDEX IF NOT EXISTS changelog_entries_source_ref_key
  ON public.changelog_entries (source_ref) WHERE source_ref IS NOT NULL;

-- A place for server-only secrets. RLS is on with no policies, and nobody but the database
-- owner has any privilege, so only the functions below can read it.
CREATE TABLE IF NOT EXISTS public.server_secrets (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.server_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.server_secrets FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION public.ingest_changelog_entry(
  p_secret text,
  p_title text,
  p_body text,
  p_category text DEFAULT 'feature',
  p_tags text[] DEFAULT '{}',
  p_source_ref text DEFAULT NULL,
  p_published_at timestamptz DEFAULT now(),
  p_version text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_title text := btrim(COALESCE(p_title, ''));
  v_body text := btrim(COALESCE(p_body, ''));
  v_category text := lower(btrim(COALESCE(p_category, '')));
  v_id uuid;
BEGIN
  SELECT value INTO v_hash FROM public.server_secrets WHERE key = 'changelog_ingest_secret_hash';

  -- Not set up, or the wrong secret. Slow guessing down.
  IF v_hash IS NULL OR v_hash = '' OR p_secret IS NULL
     OR encode(sha256(convert_to(p_secret, 'utf8')), 'hex') <> v_hash THEN
    PERFORM pg_sleep(1);
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  IF char_length(v_title) = 0 OR char_length(v_body) = 0 THEN
    RAISE EXCEPTION 'A changelog entry needs a title and some words';
  END IF;
  IF v_category NOT IN ('feature', 'improvement', 'fix', 'design', 'game', 'infra') THEN
    v_category := 'feature';
  END IF;

  -- The same pull request twice (a re-run) changes nothing.
  IF p_source_ref IS NOT NULL THEN
    SELECT id INTO v_id FROM public.changelog_entries WHERE source_ref = p_source_ref;
    IF FOUND THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'id', v_id);
    END IF;
  END IF;

  INSERT INTO public.changelog_entries (title, body, version, category, tags, source_ref, published_at)
  VALUES (left(v_title, 120), left(v_body, 4000), NULLIF(btrim(p_version), ''), v_category,
          COALESCE(p_tags, '{}'), p_source_ref, COALESCE(p_published_at, now()))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.ingest_changelog_entry(text, text, text, text, text[], text, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingest_changelog_entry(text, text, text, text, text[], text, timestamptz, text) TO anon, authenticated;
