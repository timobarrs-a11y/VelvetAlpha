/*
# Real People Profiles System

## Purpose
Allows users to create rich preference profiles for real people in their lives
(friends, family, partners) and share a friction-free survey link so those people
can fill in their own preferences without creating an account. The profile data
powers Navi's gift and event recommendations.

## New Tables

### 1. real_people
Stores rich preference profiles for real people.
- id (uuid, PK)
- user_id (uuid, FK -> auth.users, owner of this profile)
- name (text, the person's name)
- relationship (text, e.g. "girlfriend", "mom", "friend")
- birthday (date, nullable)
- city (text, nullable — person's city for local event/gift search)
- state (text, nullable — person's state for metro detection)
- favorite_color (text, nullable)
- hobbies (text[], array of hobby strings)
- favorite_foods (text[], array of food strings)
- dietary_restrictions (text[], array of restriction strings)
- favorite_tv_shows (text[], array of show names)
- movie_genres (text[], array of genre strings)
- sports_teams (text[], array of team names)
- music_genres (text[], array of genre strings)
- travel_destinations (text[], places they want to visit)
- clothing_size_shirt (text, nullable)
- clothing_size_shoe (text, nullable)
- clothing_size_dress (text, nullable)
- ring_size (text, nullable)
- things_mentioned_wanting (text, nullable free-text)
- survey_completed (boolean, default false — true when the person fills out the survey)
- survey_completed_at (timestamptz, nullable)
- avatar_color (text, nullable — auto-assigned color for UI avatar)
- created_at (timestamptz)
- updated_at (timestamptz)

### 2. person_survey_tokens
Stores unique, unguessable tokens that link a survey response to a person profile.
- id (uuid, PK)
- person_id (uuid, FK -> real_people.id ON DELETE CASCADE)
- user_id (uuid, FK -> auth.users — denormalized for RLS scoping)
- token (text, unique, unguessable — used in the survey URL)
- created_at (timestamptz)
- expires_at (timestamptz, nullable — can expire tokens if desired)

## Security

### real_people
- RLS enabled.
- Owner (authenticated user who created the profile) has full CRUD.
- Survey respondents can update a profile if they have a valid token — handled via
  a SECURITY DEFINER function `update_person_via_survey_token` that validates the
  token and updates the profile, so the anon-key client never needs direct UPDATE
  access to the table.

### person_survey_tokens
- RLS enabled.
- Owner can SELECT and DELETE their own tokens (to view/revoke share links).
- No INSERT via anon — tokens are created via the SECURITY DEFINER function
  `create_survey_token` so only the profile owner can mint them.
- No UPDATE needed.

## Functions

### create_survey_token(p_person_id uuid)
SECURITY DEFINER. Called by an authenticated user. Verifies the caller owns the
person profile, generates a cryptographically random token, inserts it into
person_survey_tokens, and returns the token string. This avoids giving the
anon role INSERT on person_survey_tokens.

### update_person_via_survey_token(p_token text, p_updates jsonb)
SECURITY DEFINER. Called by anyone (including anon, via the survey page). Looks
up the token, verifies it is not expired, updates the corresponding real_people
row with the provided fields, and sets survey_completed = true. Returns the
updated row (excluding user_id for privacy). This is the ONLY way the survey
page can write person data — no direct table access from anon.

### get_person_via_survey_token(p_token text)
SECURITY DEFINER. Returns a limited view of the person profile (name only) so
the survey page can show "Hi [Name]!" without exposing the owner's identity or
other sensitive fields.
*/

-- ============================================================
-- real_people table
-- ============================================================

CREATE TABLE IF NOT EXISTS real_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  relationship text NOT NULL DEFAULT 'friend',
  birthday date,
  city text,
  state text,
  favorite_color text,
  hobbies text[] DEFAULT '{}',
  favorite_foods text[] DEFAULT '{}',
  dietary_restrictions text[] DEFAULT '{}',
  favorite_tv_shows text[] DEFAULT '{}',
  movie_genres text[] DEFAULT '{}',
  sports_teams text[] DEFAULT '{}',
  music_genres text[] DEFAULT '{}',
  travel_destinations text[] DEFAULT '{}',
  clothing_size_shirt text,
  clothing_size_shoe text,
  clothing_size_dress text,
  ring_size text,
  things_mentioned_wanting text,
  survey_completed boolean NOT NULL DEFAULT false,
  survey_completed_at timestamptz,
  avatar_color text DEFAULT 'emerald',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE real_people ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_people" ON real_people;
CREATE POLICY "select_own_people"
  ON real_people FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_people" ON real_people;
CREATE POLICY "insert_own_people"
  ON real_people FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_people" ON real_people;
CREATE POLICY "update_own_people"
  ON real_people FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_people" ON real_people;
CREATE POLICY "delete_own_people"
  ON real_people FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_real_people_user_id ON real_people(user_id);

-- ============================================================
-- person_survey_tokens table
-- ============================================================

CREATE TABLE IF NOT EXISTS person_survey_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES real_people(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE person_survey_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_survey_tokens" ON person_survey_tokens;
CREATE POLICY "select_own_survey_tokens"
  ON person_survey_tokens FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_survey_tokens" ON person_survey_tokens;
CREATE POLICY "delete_own_survey_tokens"
  ON person_survey_tokens FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_person_survey_tokens_token ON person_survey_tokens(token);
CREATE INDEX IF NOT EXISTS idx_person_survey_tokens_user_id ON person_survey_tokens(user_id);

-- ============================================================
-- Functions
-- ============================================================

-- Grants needed for SECURITY DEFINER functions to work
-- (the function runs as the table owner, which already has access,
--  but we make sure the function can be called by the right roles)

-- create_survey_token: owner-only, creates a survey token for a person
CREATE OR REPLACE FUNCTION create_survey_token(p_person_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_person real_people%ROWTYPE;
  v_token text;
BEGIN
  -- Verify the caller owns this person profile
  SELECT * INTO v_person FROM real_people WHERE id = p_person_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Person not found or not owned by caller';
  END IF;

  -- Generate a cryptographically random token
  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO person_survey_tokens (person_id, user_id, token)
  VALUES (p_person_id, auth.uid(), v_token);

  RETURN v_token;
END;
$$;

-- get_person_via_survey_token: public, returns limited profile for survey page
CREATE OR REPLACE FUNCTION get_person_via_survey_token(p_token text)
RETURNS TABLE(name text, relationship text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_row person_survey_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v_token_row FROM person_survey_tokens WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  IF v_token_row.expires_at IS NOT NULL AND v_token_row.expires_at < now() THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT rp.name, rp.relationship FROM real_people rp
    WHERE rp.id = v_token_row.person_id;
END;
$$;

-- update_person_via_survey_token: public (anon), updates profile from survey
CREATE OR REPLACE FUNCTION update_person_via_survey_token(
  p_token text,
  p_name text DEFAULT NULL,
  p_relationship text DEFAULT NULL,
  p_birthday date DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_favorite_color text DEFAULT NULL,
  p_hobbies text[] DEFAULT NULL,
  p_favorite_foods text[] DEFAULT NULL,
  p_dietary_restrictions text[] DEFAULT NULL,
  p_favorite_tv_shows text[] DEFAULT NULL,
  p_movie_genres text[] DEFAULT NULL,
  p_sports_teams text[] DEFAULT NULL,
  p_music_genres text[] DEFAULT NULL,
  p_travel_destinations text[] DEFAULT NULL,
  p_clothing_size_shirt text DEFAULT NULL,
  p_clothing_size_shoe text DEFAULT NULL,
  p_clothing_size_dress text DEFAULT NULL,
  p_ring_size text DEFAULT NULL,
  p_things_mentioned_wanting text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_row person_survey_tokens%ROWTYPE;
  v_person_id uuid;
BEGIN
  SELECT * INTO v_token_row FROM person_survey_tokens WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF v_token_row.expires_at IS NOT NULL AND v_token_row.expires_at < now() THEN
    RETURN false;
  END IF;

  v_person_id := v_token_row.person_id;

  UPDATE real_people SET
    name = COALESCE(p_name, name),
    relationship = COALESCE(p_relationship, relationship),
    birthday = COALESCE(p_birthday, birthday),
    city = COALESCE(p_city, city),
    state = COALESCE(p_state, state),
    favorite_color = COALESCE(p_favorite_color, favorite_color),
    hobbies = COALESCE(p_hobbies, hobbies),
    favorite_foods = COALESCE(p_favorite_foods, favorite_foods),
    dietary_restrictions = COALESCE(p_dietary_restrictions, dietary_restrictions),
    favorite_tv_shows = COALESCE(p_favorite_tv_shows, favorite_tv_shows),
    movie_genres = COALESCE(p_movie_genres, movie_genres),
    sports_teams = COALESCE(p_sports_teams, sports_teams),
    music_genres = COALESCE(p_music_genres, music_genres),
    travel_destinations = COALESCE(p_travel_destinations, travel_destinations),
    clothing_size_shirt = COALESCE(p_clothing_size_shirt, clothing_size_shirt),
    clothing_size_shoe = COALESCE(p_clothing_size_shoe, clothing_size_shoe),
    clothing_size_dress = COALESCE(p_clothing_size_dress, clothing_size_dress),
    ring_size = COALESCE(p_ring_size, ring_size),
    things_mentioned_wanting = COALESCE(p_things_mentioned_wanting, things_mentioned_wanting),
    survey_completed = true,
    survey_completed_at = now(),
    updated_at = now()
  WHERE id = v_person_id;

  RETURN true;
END;
$$;

-- Grant execute to both authenticated and anon (survey page is public)
GRANT EXECUTE ON FUNCTION create_survey_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_person_via_survey_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_person_via_survey_token TO anon, authenticated;
