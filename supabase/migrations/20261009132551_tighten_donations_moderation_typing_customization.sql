-- F29: donors could rewrite their own donation amount and star appearance, which the
-- verify-donation function derives from the verified Stripe charge.
REVOKE UPDATE ON public.donations FROM authenticated;
REVOKE UPDATE ON public.donations FROM anon;
GRANT UPDATE (message) ON public.donations TO authenticated;

-- F30: the insert policy was named for the service role but granted to every signed-in
-- user with an unconditional check.
DROP POLICY IF EXISTS "insert_service_role_moderation_events" ON public.moderation_events;
CREATE POLICY "insert_own_moderation_events" ON public.moderation_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- F42: typing indicators were readable, writable and deletable by unauthenticated callers.
DROP POLICY IF EXISTS "Anyone can read typing status" ON public.typing_status;
DROP POLICY IF EXISTS "Anyone can insert typing status" ON public.typing_status;
DROP POLICY IF EXISTS "Anyone can update typing status" ON public.typing_status;
DROP POLICY IF EXISTS "Anyone can delete typing status" ON public.typing_status;

CREATE POLICY "select_typing_status" ON public.typing_status
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_typing_status" ON public.typing_status
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_typing_status" ON public.typing_status
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_typing_status" ON public.typing_status
  FOR DELETE TO authenticated USING (true);

-- F43: streaks and cosmetic unlocks were written by the browser, so the reward could be
-- granted without earning it. Compute them server side from the check-in table.
REVOKE UPDATE ON public.user_customization FROM authenticated;
REVOKE INSERT ON public.user_customization FROM authenticated;
GRANT UPDATE (
  active_pointer, tile_colors, show_trail, animation_style, cursor_color,
  trail_style, button_hover_style, translucent_ui, left_rail_collapsed,
  toolbar_theme, updated_at
) ON public.user_customization TO authenticated;
GRANT INSERT (
  user_id, active_pointer, tile_colors, show_trail, animation_style, cursor_color,
  trail_style, button_hover_style, translucent_ui, left_rail_collapsed,
  toolbar_theme, updated_at
) ON public.user_customization TO authenticated;

CREATE OR REPLACE FUNCTION public.perform_daily_checkin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_yesterday date := ((now() at time zone 'utc')::date - 1);
  v_had_yesterday boolean;
  v_row public.user_customization%ROWTYPE;
  v_prev_streak int;
  v_new_streak int;
  v_new_longest int;
  v_new_total int;
  v_unlocked text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.user_daily_checkins (user_id, checkin_date)
  VALUES (v_uid, v_today)
  ON CONFLICT DO NOTHING;

  SELECT EXISTS (
    SELECT 1 FROM public.user_daily_checkins
    WHERE user_id = v_uid AND checkin_date = v_yesterday
  ) INTO v_had_yesterday;

  SELECT * INTO v_row FROM public.user_customization WHERE user_id = v_uid;

  v_prev_streak := COALESCE(v_row.current_streak, 0);
  v_new_streak := CASE WHEN v_had_yesterday THEN v_prev_streak + 1 ELSE 1 END;
  v_new_longest := GREATEST(COALESCE(v_row.longest_streak, 0), v_new_streak);
  v_new_total := COALESCE(v_row.total_checkins, 0) + 1;
  v_unlocked := COALESCE(v_row.unlocked_pointers, ARRAY['star']::text[]);

  IF v_row.user_id IS NULL THEN
    INSERT INTO public.user_customization (
      user_id, active_pointer, unlocked_pointers, tile_colors,
      current_streak, longest_streak, total_checkins,
      font_customization_unlocked, show_trail, trail_style,
      animation_style, cursor_color, updated_at
    ) VALUES (
      v_uid, 'star', v_unlocked, '{}'::jsonb,
      v_new_streak, v_new_longest, v_new_total,
      true, false, 'solid', 'stars', 'rose', now()
    );
  ELSE
    UPDATE public.user_customization
    SET current_streak = v_new_streak,
        longest_streak = v_new_longest,
        total_checkins = v_new_total,
        font_customization_unlocked = true,
        updated_at = now()
    WHERE user_id = v_uid;
  END IF;

  RETURN jsonb_build_object(
    'current_streak', v_new_streak,
    'longest_streak', v_new_longest,
    'total_checkins', v_new_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.perform_daily_checkin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.perform_daily_checkin() TO authenticated;

-- The server now grants pointer unlocks; expose the unlock rule to it.
CREATE OR REPLACE FUNCTION public.grant_streak_unlocks(p_keys text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Deprecated';
END;
$$;
REVOKE ALL ON FUNCTION public.grant_streak_unlocks(text[]) FROM PUBLIC, anon, authenticated;
