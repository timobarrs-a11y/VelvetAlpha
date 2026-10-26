/*
# Wardrobe: pants and personas

## Purpose
The avatar wardrobe grew from "outfit + hat" to three separate pieces: a shirt (`outfit`), pants
(`bottom`, with `bottomColor` and `bottomAccent`) and a hat (`headwear`). A persona (pirate, chef,
cop, rockstar, ...) is just a preset for all three, and any piece can be worn with any other.
This migration teaches the database about the new pieces. It mirrors `src/data/avatarItems.ts` and
`src/data/avatarCatalog.ts`, and must be kept in step with them.

## Changes
1. `avatar_inventory.item_id` may now be a `bottom:` or `bottomColor:` item, as well as the existing
   slots. (The inline check constraint is replaced by a named one.)
2. `public.sanitize_avatar_config(jsonb)` also checks the new pieces. Member-only pieces swap to a
   starter fallback, in the fallback's own colours, when the caller is not entitled to them and does
   not own them outright:
   - shirts:   pirate -> linen; rockstar, streetwear -> tee; president -> suit
   - pants:    breeches -> trousers; leather, baggy -> jeans
   - hats:     bandana, tricorn, snapback -> none (top_hat still needs the `hat-trick` medal)
   Every other new shirt (cheer, cop, scrubs), pants (jeans, trousers, shorts, skirt, chef_pants,
   cheer_skirt, cop_pants, scrub_pants) and hat (cop_cap, nurse_cap, hair_bow) is a starter item.

3. Bug fix in the function it replaces: the earlier version tested ownership with `v_owned ? v_id`, but
   `?` only exists for jsonb and `v_owned` is a text[], so Postgres rejects it ("operator does not exist:
   text[] ? text") for any avatar with a hairstyle. The app swallows that error and saves the unchecked
   config (see `sanitizeAvatarConfigForSave`), so the server-side locks were silently not applying. Both
   tests now use `value = any(array)`.

## Notes
- The saved look is never rewritten: this function only returns a sanitized copy, so earning or
  re-subscribing restores the original look (same as before).
- A saved avatar with no `bottom` is left alone: unset means "matches the shirt".
- Safe to run more than once.
*/

-- 1. Let the inventory hold pants. The old check was inline (auto-named), so find and drop it by what
--    it checks rather than by name.
do $$
declare
  c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.avatar_inventory'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%item_id%'
  loop
    execute format('alter table public.avatar_inventory drop constraint %I', c.conname);
  end loop;
end
$$;

alter table public.avatar_inventory
  add constraint avatar_inventory_item_id_check
  check (item_id ~ '^(hairStyle|hairColor|hairHighlight|outfit|outfitColor|bottom|bottomColor|headwear|faceAccessory|glasses|earrings|necklace):[#a-zA-Z0-9_-]{1,40}$');

-- 2. The save-time guard, now aware of pants and the new member-only pieces.
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
  v_bottom text;
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
  v_bottom          := v_out ->> 'bottom';
  v_headwear        := v_out ->> 'headwear';
  v_face_accessory  := v_out ->> 'faceAccessory';

  -- Hair style: a few are sims shop items; everything else is free.
  if v_hair_style is not null and v_hair_style <> 'none' then
    v_id := 'hairStyle:' || v_hair_style;
    if not (v_id = any(v_owned))
       and v_hair_style in ('bantu_knots','mohawk','top_knot')
       and v_earning_live then
      v_out := jsonb_set(v_out, '{hairStyle}', to_jsonb('short'::text));
    end if;
  end if;

  -- Hair highlight: three fashion colors are sims shop items.
  if v_hair_highlight is not null and v_hair_highlight <> 'none' then
    v_id := 'hairHighlight:' || v_hair_highlight;
    if not (v_id = any(v_owned))
       and v_hair_highlight in ('#c9933e','#e07a9f','#2f6fd6')
       and v_earning_live then
      v_out := jsonb_set(v_out, '{hairHighlight}', to_jsonb('none'::text));
    end if;
  end if;

  -- Hair color: dyed fashion colors are reward items once earning is live.
  -- Until then, they are free for everyone (mirror of the client).
  if v_hair_color is not null and v_hair_color <> 'none' then
    v_id := 'hairColor:' || v_hair_color;
    if not (v_id = any(v_owned))
       and v_hair_color in ('#e07a9f','#d63c86','#a98bd6','#6a3fa0','#2f6fd6','#1f9a96','#7fcfae','#c4642d','#c9933e','#9e1f35')
       and v_earning_live then
      v_out := jsonb_set(v_out, '{hairColor}', to_jsonb('#2a1f1a'::text));
    end if;
  end if;

  -- Outfit (the shirt): member-only shirts fall back to a starter shirt, in that shirt's own colors.
  --   pirate -> linen; rockstar, streetwear -> tee; president -> suit.
  if v_outfit is not null and v_outfit <> 'none' then
    v_id := 'outfit:' || v_outfit;
    if not (v_id = any(v_owned)) and not v_member then
      if v_outfit = 'pirate' then
        v_out := jsonb_set(v_out, '{outfit}',        to_jsonb('linen'::text));
        v_out := jsonb_set(v_out, '{outfitColor}',   to_jsonb('#efe6d2'::text));
        v_out := jsonb_set(v_out, '{outfitAccent}',  to_jsonb('#8a6a4a'::text));
      elsif v_outfit in ('rockstar','streetwear') then
        v_out := jsonb_set(v_out, '{outfit}',        to_jsonb('tee'::text));
        v_out := jsonb_set(v_out, '{outfitColor}',   to_jsonb('#1e293b'::text));
        v_out := jsonb_set(v_out, '{outfitAccent}',  to_jsonb('#2d3748'::text));
      elsif v_outfit = 'president' then
        v_out := jsonb_set(v_out, '{outfit}',        to_jsonb('suit'::text));
        v_out := jsonb_set(v_out, '{outfitColor}',   to_jsonb('#1f2a44'::text));
        v_out := jsonb_set(v_out, '{outfitAccent}',  to_jsonb('#8a2d3b'::text));
      end if;
    end if;
  end if;

  -- Bottom (the pants): breeches, leather and baggy jeans are member-only. An unset bottom means
  -- "matches the shirt" and is never locked on its own (the shirt's fallback decides what it matches).
  --   breeches -> trousers; leather, baggy -> jeans.
  if v_bottom is not null and v_bottom <> 'none' then
    v_id := 'bottom:' || v_bottom;
    if not (v_id = any(v_owned)) and not v_member and v_bottom in ('breeches','leather','baggy') then
      if v_bottom = 'breeches' then
        v_out := jsonb_set(v_out, '{bottom}',        to_jsonb('trousers'::text));
        v_out := jsonb_set(v_out, '{bottomColor}',   to_jsonb('#2b2f3a'::text));
        v_out := jsonb_set(v_out, '{bottomAccent}',  to_jsonb('#1c1f27'::text));
      else
        v_out := jsonb_set(v_out, '{bottom}',        to_jsonb('jeans'::text));
        v_out := jsonb_set(v_out, '{bottomColor}',   to_jsonb('#3D5B8A'::text));
        v_out := jsonb_set(v_out, '{bottomAccent}',  to_jsonb('#2E3F63'::text));
      end if;
    end if;
  end if;

  -- Headwear: bandana, tricorn and snapback are member-only; top_hat needs the
  -- 'hat-trick' medal. Fallback is 'none'.
  if v_headwear is not null and v_headwear <> 'none' then
    v_id := 'headwear:' || v_headwear;
    if not (v_id = any(v_owned)) then
      if (v_headwear in ('bandana','tricorn','snapback') and not v_member)
         or (v_headwear = 'top_hat' and not ('hat-trick' = any(v_earned))) then
        v_out := jsonb_set(v_out, '{headwear}', to_jsonb('none'::text));
      end if;
    end if;
  end if;

  -- Face accessory: eyepatch is member-only. Fallback is 'none'.
  if v_face_accessory is not null and v_face_accessory <> 'none' then
    v_id := 'faceAccessory:' || v_face_accessory;
    if not (v_id = any(v_owned))
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
