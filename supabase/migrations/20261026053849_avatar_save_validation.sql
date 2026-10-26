/*
# Avatar save validation and entitlement enforcement

## Purpose
Before this change, a signed-in user could save any avatar configuration
they submitted to `user_profiles.avatar_config` or `companions.avatar_config`,
as long as they owned the row. The editor visually blocks locked wardrobe
items (hairstyles, hair colors, outfits, headwear, face accessories), but
nothing on the server checked whether the person was actually entitled to
those items. A user could bypass the visible locks and save premium or
earned-only items directly.

This migration adds server-side enforcement: a SECURITY DEFINER function
that inspects an avatar config JSON, checks the caller's membership, medals,
and owned avatar_inventory items, and returns a *sanitized* config with any
locked items replaced by their starter fallbacks. The saved look itself is
preserved when the caller is entitled, and locked items are swapped for
fallbacks when they are not — so a lapsed plan no longer silently leaves a
premium outfit on someone's avatar, and a person who later earns the item
back sees their original look restored.

## New functions
- `public.sanitize_avatar_config(p_config jsonb)`
  - SECURITY DEFINER, search_path set to 'public'.
  - Callable only by `authenticated` (EXECUTE revoked from PUBLIC and anon).
  - Reads the caller's `subscription_tier`, earned `user_medals` slugs, and
    owned `avatar_inventory` item ids in one pass.
  - Mirrors the TypeScript `resolveLookForDisplay` rules: anything in the
    wardrobe or hair slots that the caller is not entitled to is replaced
    with its starter fallback. Identity features (skin, face, eyes, nose,
    lips, body, natural hair colors) are never touched.
  - Returns the sanitized `jsonb` config. The caller writes that result to
    `avatar_config`, so the database is the final authority on what a saved
    avatar may wear.

## Notes
1. This function does NOT mutate any table. It is a pure read-and-return
   guard. The frontend is expected to call it immediately before saving and
   store the returned config. A follow-up can add a CHECK trigger if raw
   writes that skip the function should be rejected outright; for now the
   single save path (the avatar editor modal) is being updated to call this.
2. `EARNING_LIVE` is mirrored as a constant here. While it is false, shop
   ("sims") and "reward" items are treated as usable by everyone, matching
   the client. When it goes true, the function already knows how to gate
   them, because owned items are read from `avatar_inventory` and a
   non-owned sims/reward item is rejected.
3. Item ids follow `slot:value` (see `avatar_inventory.item_id_check`).
   The fallback table below is the server-side copy of the starter fallbacks
   in `src/data/avatarItems.ts`. It must be kept in sync if those change.
*/

CREATE OR REPLACE FUNCTION public.sanitize_avatar_config(p_config jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_tier text;
  v_member boolean;
  v_earned text[];
  v_owned text[];
  v_hair_style text;
  v_hair_color text;
  v_hair_highlight text;
  v_outfit text;
  v_headwear text;
  v_face_accessory text;
  v_out jsonb;
  v_id text;
  v_earning_live boolean := false;  -- mirror of EARNING_LIVE in src/data/avatarCatalog.ts
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;

  if p_config is null or jsonb_typeof(p_config) <> 'object' then
    return p_config;
  end if;

  -- Load entitlements in one pass.
  select subscription_tier into v_tier
    from public.user_profiles where id = v_user;
  v_member := v_tier in ('trial','essential','plus','elite');

  select coalesce(array_agg(medal_slug), array[]::text[]) into v_earned
    from public.user_medals where user_id = v_user and earned_at is not null;

  select coalesce(array_agg(item_id), array[]::text[]) into v_owned
    from public.avatar_inventory where user_id = v_user;

  v_out := p_config;

  v_hair_style      := v_out ->> 'hairStyle';
  v_hair_color      := v_out ->> 'hairColor';
  v_hair_highlight  := v_out ->> 'hairHighlight';
  v_outfit          := v_out ->> 'outfit';
  v_headwear        := v_out ->> 'headwear';
  v_face_accessory  := v_out ->> 'faceAccessory';

  -- Hair style: a few are sims shop items; everything else is free.
  if v_hair_style is not null and v_hair_style <> 'none' then
    v_id := 'hairStyle:' || v_hair_style;
    if not (v_owned ? v_id)
       and v_hair_style in ('bantu_knots','mohawk','top_knot')
       and v_earning_live then
      v_out := jsonb_set(v_out, '{hairStyle}', to_jsonb('short'::text));
    end if;
  end if;

  -- Hair highlight: three fashion colors are sims shop items.
  if v_hair_highlight is not null and v_hair_highlight <> 'none' then
    v_id := 'hairHighlight:' || v_hair_highlight;
    if not (v_owned ? v_id)
       and v_hair_highlight in ('#c9933e','#e07a9f','#2f6fd6')
       and v_earning_live then
      v_out := jsonb_set(v_out, '{hairHighlight}', to_jsonb('none'::text));
    end if;
  end if;

  -- Hair color: dyed fashion colors are reward items once earning is live.
  -- Until then, they are free for everyone (mirror of the client).
  if v_hair_color is not null and v_hair_color <> 'none' then
    v_id := 'hairColor:' || v_hair_color;
    if not (v_owned ? v_id)
       and v_hair_color in ('#e07a9f','#d63c86','#a98bd6','#6a3fa0','#2f6fd6','#1f9a96','#7fcfae','#c4642d','#c9933e','#9e1f35')
       and v_earning_live then
      v_out := jsonb_set(v_out, '{hairColor}', to_jsonb('#2a1f1a'::text));
    end if;
  end if;

  -- Outfit: 'pirate' is member-only; fallback to 'linen' with linen colors.
  if v_outfit is not null and v_outfit <> 'none' then
    v_id := 'outfit:' || v_outfit;
    if not (v_owned ? v_id)
       and v_outfit = 'pirate'
       and not v_member then
      v_out := jsonb_set(v_out, '{outfit}',        to_jsonb('linen'::text));
      v_out := jsonb_set(v_out, '{outfitColor}',   to_jsonb('#efe6d2'::text));
      v_out := jsonb_set(v_out, '{outfitAccent}',  to_jsonb('#8a6a4a'::text));
    end if;
  end if;

  -- Headwear: bandana and tricorn are member-only; top_hat needs the
  -- 'hat-trick' medal. Fallback is 'none'.
  if v_headwear is not null and v_headwear <> 'none' then
    v_id := 'headwear:' || v_headwear;
    if not (v_owned ? v_id) then
      if (v_headwear in ('bandana','tricorn') and not v_member)
         or (v_headwear = 'top_hat' and not (v_earned ? 'hat-trick')) then
        v_out := jsonb_set(v_out, '{headwear}', to_jsonb('none'::text));
      end if;
    end if;
  end if;

  -- Face accessory: eyepatch is member-only. Fallback is 'none'.
  if v_face_accessory is not null and v_face_accessory <> 'none' then
    v_id := 'faceAccessory:' || v_face_accessory;
    if not (v_owned ? v_id)
       and v_face_accessory = 'eyepatch'
       and not v_member then
      v_out := jsonb_set(v_out, '{faceAccessory}', to_jsonb('none'::text));
    end if;
  end if;

  return v_out;
end;
$function$;

-- Lock the function down: only signed-in users may call it.
REVOKE EXECUTE ON FUNCTION public.sanitize_avatar_config(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sanitize_avatar_config(jsonb) TO authenticated;
