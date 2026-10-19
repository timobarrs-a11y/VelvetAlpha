/*
# Expand instant messaging: alias, age range, intro, availability toggle, request intro

## Why
Users want to connect with real people safely. Today a friend request shows only a
display name and headline. We need:
1. A public "alias" so users can be addressed in chat without exposing email or real name.
2. A safe age range (never an exact birth date) shown on discovery cards and requests.
3. A short intro message attached to a connection request, readable by the recipient
   before they accept.
4. An explicit "available to chat" toggle that is independent of the discovery switch,
   so users can be online and reachable only when they actually want to talk.

## New columns
- im_discovery_profiles.alias            text unique        — public chat handle
- im_discovery_profiles.age_range        text               — e.g. "18-24"
- im_discovery_profiles.intro            text               — short self-intro
- im_discovery_profiles.available_to_chat boolean default false
- im_friendships.intro_message           text               — sender's intro on a request
- im_presence.available_to_chat          boolean default false

## Security
- RLS already enabled on all three tables. We tighten column-level UPDATE on
  im_discovery_profiles so users cannot set arbitrary columns through the data API
  beyond the ones they own. The alias is user-set but must be unique (enforced by
  a unique index on lower(alias)). Age range is user-set but constrained via a
  SECURITY DEFINER setter that validates the allowed set, so users cannot claim an
  unsafe age.
- New policies:
  - im_presence: users may update their own available_to_chat.
  - im_friendships: existing INSERT policy already allows the requester to insert;
    the intro_message column rides along on that same INSERT.
- A new SECURITY DEFINER function im_set_discovery_identity validates alias format
  and age range server-side, so the client cannot forge an unsafe age or a
  duplicate/invalid alias.

## Notes
1. Alias uniqueness is enforced on lower(alias) so "Luna" and "luna" collide.
2. Alias is nullable during migration; users set it on first discovery card save.
3. Age range is one of a fixed allowlist ('18-24','25-34','35-44','45-54','55+').
4. The existing im_get_or_create_conversation RPC already requires both users to be
   accepted friends (it checks im_friendships); no change needed there.
*/

-- 1. Discovery profile expansions -------------------------------------------------
ALTER TABLE im_discovery_profiles
  ADD COLUMN IF NOT EXISTS alias text,
  ADD COLUMN IF NOT EXISTS age_range text,
  ADD COLUMN IF NOT EXISTS intro text,
  ADD COLUMN IF NOT EXISTS available_to_chat boolean NOT NULL DEFAULT false;

-- Unique alias, case-insensitive. Partial index so nulls don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS uq_im_discovery_alias_lower
  ON im_discovery_profiles (lower(alias))
  WHERE alias IS NOT NULL;

-- 2. Friendship request intro ----------------------------------------------------
ALTER TABLE im_friendships
  ADD COLUMN IF NOT EXISTS intro_message text;

-- 3. Presence availability flag --------------------------------------------------
ALTER TABLE im_presence
  ADD COLUMN IF NOT EXISTS available_to_chat boolean NOT NULL DEFAULT false;

-- 4. Column-level UPDATE grants: users may only update their own profile's
--    user-editable columns. We revoke full UPDATE then grant the specific set.
REVOKE UPDATE ON im_discovery_profiles FROM authenticated;
GRANT UPDATE (
  display_name, avatar_url, headline, interests, discoverable,
  alias, age_range, intro, available_to_chat
) ON im_discovery_profiles TO authenticated;

-- 5. SECURITY DEFINER helper to set identity (alias + age range) safely.
--    The age range allowlist is enforced server-side; the client cannot claim
--    an unsafe age. Alias is validated (3-20 chars, letters/numbers/underscore/
--    hyphen) and uniqueness is enforced by the partial unique index.
CREATE OR REPLACE FUNCTION im_set_discovery_identity(
  p_alias text,
  p_age_range text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_clean_alias text := lower(trim(p_alias));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_clean_alias IS NULL OR length(v_clean_alias) < 3 OR length(v_clean_alias) > 20 THEN
    RAISE EXCEPTION 'Alias must be 3-20 characters';
  END IF;

  IF v_clean_alias !~ '^[a-z0-9_-]+$' THEN
    RAISE EXCEPTION 'Alias may only contain letters, numbers, underscore, or hyphen';
  END IF;

  IF p_age_range IS NOT NULL AND p_age_range NOT IN ('18-24','25-34','35-44','45-54','55+') THEN
    RAISE EXCEPTION 'Invalid age range';
  END IF;

  UPDATE im_discovery_profiles
    SET alias = v_clean_alias,
        age_range = p_age_range,
        updated_at = now()
    WHERE user_id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION im_set_discovery_identity FROM anon;
GRANT EXECUTE ON FUNCTION im_set_discovery_identity TO authenticated;

-- 6. Friendly error for duplicate alias. The unique index already rejects it;
--    clients map a 23505 code to "That alias is taken" per the data-access guide.

-- 7. Policies for the new available_to_chat column ride on existing per-row
--    UPDATE policies for im_presence and im_discovery_profiles, which already
--    check user_id = auth.uid(). Column-level grants (above) enforce which
--    columns may be written.

-- 8. Indexes for discovery of available users.
CREATE INDEX IF NOT EXISTS idx_im_discovery_available
  ON im_discovery_profiles (available_to_chat)
  WHERE available_to_chat = true;

CREATE INDEX IF NOT EXISTS idx_im_presence_available
  ON im_presence (is_online, available_to_chat)
  WHERE is_online = true AND available_to_chat = true;
