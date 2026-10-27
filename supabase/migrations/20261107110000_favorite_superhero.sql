-- Favorite superhero
--
-- A new questionnaire answer that shows on a member's profile card and on the billboard outside
-- their house, another thing for neighbours to bond over. It is as public as the rest of the front
-- card (interests, favorite color, zodiac), and they can change or clear it any time.
--
-- - user_profiles.favorite_superhero      the answer, up to 60 characters
-- - get_profile_card                      returns it as card.favorite_hero
-- - world_cards                           returns it as hero, for the billboard
-- Seeded and bot profiles get one too, so the street reads as lived in.

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS favorite_superhero text;
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_favorite_superhero_len;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_favorite_superhero_len
  CHECK (favorite_superhero IS NULL OR char_length(favorite_superhero) <= 60);

-- This table is written through column grants, so the new column needs its own.
GRANT SELECT (favorite_superhero), UPDATE (favorite_superhero) ON public.user_profiles TO authenticated;

UPDATE public.user_profiles
SET favorite_superhero = (ARRAY['Spider-Man', 'Batman', 'Wonder Woman', 'Iron Man', 'Black Panther', 'Captain America', 'Superman', 'Storm', 'Wolverine', 'Ms. Marvel', 'The Flash', 'Hulk'])[1 + abs(hashtext(id::text)) % 12]
WHERE COALESCE(is_bot, false) AND favorite_superhero IS NULL;

CREATE OR REPLACE FUNCTION public.get_profile_card(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row record;
  v_friend boolean;
  v_access boolean;
  v_request text := 'none';
  v_interests jsonb;
  v_areas jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false); END IF;
  IF v_uid <> p_user_id AND public.users_blocked(v_uid, p_user_id) THEN RETURN jsonb_build_object('success', false); END IF;

  SELECT mp.user_id, mp.display_name, mp.headline, mp.profile_image_type, mp.profile_smilie_code, mp.is_bot,
         mp.profile_mode, mp.who_can_message, mp.accepts_friend_requests, mp.share_accomplishments,
         up.nickname, up.favorite_color, up.favorite_superhero, up.zodiac_sign, up.birthday, up.interests, up.hobbies,
         up.sports_interests, up.entertainment_interests, up.tech_interests, up.lifestyle_interests, up.music_genre
    INTO v_row
  FROM public.member_profiles mp
  LEFT JOIN public.user_profiles up ON up.id = mp.user_id
  WHERE mp.user_id = p_user_id;

  IF v_row.user_id IS NULL THEN RETURN jsonb_build_object('success', false); END IF;

  v_friend := public.members_are_friends(v_uid, p_user_id);
  v_access := v_uid = p_user_id OR v_friend OR v_row.profile_mode = 'open';

  SELECT COALESCE(jsonb_agg(i), '[]'::jsonb) INTO v_interests
  FROM (
    SELECT i FROM (
      SELECT DISTINCT ON (lower(btrim(x))) btrim(x) AS i
      FROM unnest(
        COALESCE(v_row.interests, '{}'::text[]) || COALESCE(v_row.hobbies, '{}'::text[])
        || COALESCE(v_row.sports_interests, '{}'::text[]) || COALESCE(v_row.entertainment_interests, '{}'::text[])
        || COALESCE(v_row.tech_interests, '{}'::text[]) || COALESCE(v_row.lifestyle_interests, '{}'::text[])
        || CASE WHEN v_row.music_genre IS NULL OR btrim(v_row.music_genre) = '' THEN '{}'::text[] ELSE ARRAY[v_row.music_genre] END
      ) AS x
      WHERE btrim(x) <> ''
    ) d LIMIT 12
  ) l;

  -- A broad outline only: the areas they are working on, never the goals themselves.
  SELECT COALESCE(jsonb_agg(g), '[]'::jsonb) INTO v_areas
  FROM (
    SELECT DISTINCT ug.goal_type AS g FROM public.user_goals ug
    WHERE ug.user_id = p_user_id AND ug.status = 'active' AND ug.goal_type IS NOT NULL AND btrim(ug.goal_type) <> ''
    LIMIT 4
  ) a;

  IF v_uid <> p_user_id AND NOT v_friend THEN
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM public.im_friendships f WHERE f.status = 'pending' AND f.requester_id = v_uid AND f.addressee_id = p_user_id) THEN 'sent'
      WHEN EXISTS (SELECT 1 FROM public.im_friendships f WHERE f.status = 'pending' AND f.requester_id = p_user_id AND f.addressee_id = v_uid) THEN 'received'
      ELSE 'none' END INTO v_request;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'card', jsonb_build_object(
      'user_id', v_row.user_id,
      -- the name they chose: never their real name
      'display_name', COALESCE(NULLIF(NULLIF(btrim(v_row.display_name), ''), 'Member'), NULLIF(btrim(v_row.nickname), ''), 'Member'),
      'headline', v_row.headline,
      'profile_image_type', COALESCE(v_row.profile_image_type, 'avatar'),
      'profile_smilie_code', v_row.profile_smilie_code,
      'is_bot', v_row.is_bot,
      'interests', v_interests,
      'favorite_color', NULLIF(btrim(v_row.favorite_color), ''),
      'favorite_hero', NULLIF(btrim(v_row.favorite_superhero), ''),
      'zodiac_sign', COALESCE(NULLIF(btrim(v_row.zodiac_sign), ''), public.zodiac_for(v_row.birthday)),
      'goal_areas', v_areas
    ),
    'relation', jsonb_build_object(
      'is_self', v_uid = p_user_id,
      'is_friend', v_friend,
      'has_full_access', v_access,
      'friend_request', v_request
    ),
    'reach', jsonb_build_object(
      'who_can_message', v_row.who_can_message,
      'accepts_friend_requests', v_row.accepts_friend_requests,
      'shares_accomplishments', v_row.share_accomplishments
    )
  );
END;
$function$;

DROP FUNCTION IF EXISTS public.world_cards(uuid[]);

CREATE FUNCTION public.world_cards(p_user_ids uuid[])
RETURNS TABLE (
  user_id uuid, slot_index int, house jsonb, sign jsonb, yard jsonb, is_member boolean, earned text[],
  is_public boolean, display_name text, headline text, goal_label text, goal_pct int,
  medals text[], medal_count int, spaces text[], new_neighbor boolean, is_live boolean, hero text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    p.user_id, p.slot_index, p.house, p.sign, p.yard,
    public.is_paid_member(p.user_id) OR public.world_is_bot(p.user_id),
    CASE WHEN public.world_is_bot(p.user_id) THEN ARRAY['iron-will','the-closer','hat-trick','coachable','unbreakable'] ELSE public.world_earned_medals(p.user_id) END,
    v.shown,
    CASE WHEN v.shown THEN COALESCE(NULLIF(btrim(mp.display_name), ''), up.nickname, up.name, 'Neighbor') ELSE 'A neighbor' END,
    CASE WHEN v.shown THEN mp.headline END,
    g.title,
    g.pct,
    CASE WHEN v.shown THEN COALESCE((
      SELECT array_agg(x.medal_slug ORDER BY x.ord)
      FROM (
        SELECT um.medal_slug, COALESCE(um.showcase_slot, 10) * 1000 + row_number() OVER (ORDER BY um.earned_at DESC) AS ord
        FROM public.user_medals um
        WHERE um.user_id = p.user_id AND um.earned_at IS NOT NULL
        ORDER BY COALESCE(um.showcase_slot, 10), um.earned_at DESC
        LIMIT 3
      ) x), '{}') ELSE '{}' END,
    CASE WHEN v.shown THEN (SELECT count(*)::int FROM public.user_medals um WHERE um.user_id = p.user_id AND um.earned_at IS NOT NULL) ELSE 0 END,
    CASE WHEN v.shown THEN COALESCE((
      SELECT array_agg(b.name ORDER BY m.joined_at)
      FROM (SELECT * FROM public.community_board_members m0 WHERE m0.user_id = p.user_id ORDER BY m0.joined_at LIMIT 2) m
      JOIN public.community_boards b ON b.id = m.board_id AND b.visibility = 'open'), '{}') ELSE '{}' END,
    p.moved_in_at > now() - interval '7 days',
    -- a real person with a visible profile: the town marks their house "live"
    v.shown AND NOT COALESCE(mp.is_bot, false),
    -- the favorite superhero, for the billboard
    CASE WHEN v.shown THEN NULLIF(btrim(up.favorite_superhero), '') END
  FROM unnest(p_user_ids) AS ids(id)
  JOIN public.world_plots p ON p.user_id = ids.id
  LEFT JOIN public.member_profiles mp ON mp.user_id = p.user_id
  LEFT JOIN public.user_profiles up ON up.id = p.user_id
  -- shown = a public profile, and neither of you has blocked the other (you always see your own)
  CROSS JOIN LATERAL (SELECT (p.user_id = auth.uid()) OR (COALESCE(mp.is_public, false) AND NOT public.world_blocked(auth.uid(), p.user_id)) AS shown) v
  LEFT JOIN LATERAL (
    -- one goal they turned on "show on profile" for: an active one first, newest first
    SELECT ug.title, LEAST(100, GREATEST(0, round(100 * ug.current_value / NULLIF(ug.target_value, 0))))::int AS pct
    FROM public.user_goals ug
    WHERE v.shown AND ug.user_id = p.user_id AND ug.show_on_profile
    ORDER BY (ug.status = 'completed'), ug.created_at DESC
    LIMIT 1
  ) g ON true;
$$;

REVOKE EXECUTE ON FUNCTION public.world_cards(uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.world_cards(uuid[]) TO authenticated;
