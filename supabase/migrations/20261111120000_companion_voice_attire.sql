/*
# A companion keeps the attire its signature voice comes dressed in

## Purpose
Every signature voice comes dressed in a matching outfit (src/config/voiceAttire.ts, docs/onboarding/voice-attire.md).
A person without a membership wears it and cannot change it; members can edit anything. Some of that attire uses
member-only pieces (rockstar jacket, streetwear hoodie, leather pants, breeches, baggy jeans, snapback), and
`sanitize_avatar_config` swaps those for a starter fallback on save when the caller is not entitled to them.
So a free person's Bad Boy would have lost his jacket on the way into the database.

## Changes
1. `companion_voice_attire(voice)`: the shirt, pants and hat each voice comes in. It mirrors voiceAttire.ts, and a test
   (src/config/__tests__/voiceAttire.test.ts) fails if the two drift apart.
2. `sanitize_companion_avatar_config(config, companion_id)`: sanitizes as before, then gives back the voice's own
   shirt, pants and hat (with their colours) if that is what the look is wearing, for a companion the caller owns.
   Anything else locked is still swapped. The caller can only pick their own companion's voice.

## Notes
- The saved look is never rewritten beyond what `sanitize_avatar_config` already does.
- Safe to run more than once.
*/

CREATE OR REPLACE FUNCTION public.companion_voice_attire(p_voice text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $function$
  select jsonb_build_object('outfit', outfit, 'bottom', bottom, 'headwear', headwear)
    from (values
    ('cheerleader', 'cheer', 'cheer_skirt', 'hair_bow'),
    ('french_romantic', 'linen', 'trousers', 'beret'),
    ('cool_beauty', 'suit', 'trousers', 'none'),
    ('homie', 'streetwear', 'baggy', 'snapback'),
    ('brooklyn_native', 'streetwear', 'baggy', 'beanie'),
    ('bad_boy', 'rockstar', 'leather', 'none'),
    ('cold_prince', 'suit', 'trousers', 'none'),
    ('surfer_dude', 'tee', 'shorts', 'bucket_hat'),
    ('goth_girl', 'tee', 'skirt', 'none'),
    ('british_gentleman', 'suit', 'trousers', 'none'),
    ('therapist', 'linen', 'trousers', 'none'),
    ('big_sister', 'tee', 'jeans', 'none'),
    ('rnb_lover', 'tee', 'trousers', 'none'),
    ('gentle_protector', 'linen', 'jeans', 'beanie'),
    ('shy_sweetheart', 'tee', 'skirt', 'headband'),
    ('genki_girl', 'tee', 'shorts', 'headband'),
    ('valley_girl', 'tee', 'skirt', 'headband'),
    ('bookworm', 'linen', 'skirt', 'beret'),
    ('southern_gentleman', 'linen', 'trousers', 'cowboy_hat'),
    ('jock', 'letterman', 'jeans', 'baseball_cap'),
    ('determined_hero', 'hero', 'jeans', 'headband'),
    ('playful_trickster', 'streetwear', 'jeans', 'none'),
    ('nerd', 'cardigan', 'trousers', 'none'),
    ('tsundere', 'uniform', 'plaid_skirt', 'hair_bow'),
    ('shakespearean', 'doublet', 'breeches', 'none'),
    ('southern_belle', 'sundress', 'skirt', 'hair_bow')
    ) as t(voice, outfit, bottom, headwear)
   where voice = p_voice
$function$;

CREATE OR REPLACE FUNCTION public.sanitize_companion_avatar_config(p_config jsonb, p_companion_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_voice text;
  v_attire jsonb;
  v_out jsonb;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;

  v_out := public.sanitize_avatar_config(p_config);
  if p_config is null or jsonb_typeof(p_config) <> 'object' then
    return v_out;
  end if;

  select signature_voice into v_voice
    from public.companions
   where id = p_companion_id and user_id = v_user;
  v_attire := public.companion_voice_attire(v_voice);
  if v_attire is null then
    return v_out;
  end if;

  if p_config ->> 'outfit' = v_attire ->> 'outfit' then
    v_out := v_out || jsonb_strip_nulls(jsonb_build_object(
      'outfit', p_config -> 'outfit', 'outfitColor', p_config -> 'outfitColor', 'outfitAccent', p_config -> 'outfitAccent'));
  end if;
  if p_config ->> 'bottom' = v_attire ->> 'bottom' then
    v_out := v_out || jsonb_strip_nulls(jsonb_build_object(
      'bottom', p_config -> 'bottom', 'bottomColor', p_config -> 'bottomColor', 'bottomAccent', p_config -> 'bottomAccent'));
  end if;
  if p_config ->> 'headwear' = v_attire ->> 'headwear' then
    v_out := v_out || jsonb_strip_nulls(jsonb_build_object('headwear', p_config -> 'headwear'));
  end if;
  return v_out;
end
$function$;

-- Lock the function down like sanitize_avatar_config: only signed-in users may call it.
REVOKE EXECUTE ON FUNCTION public.sanitize_companion_avatar_config(jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sanitize_companion_avatar_config(jsonb, uuid) TO authenticated;
