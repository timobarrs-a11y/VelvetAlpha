-- Town mail
--
-- One-way letters that land in a mailbox on every house. Members can read their own
-- mail and nothing else; they cannot reply or send. Only an admin can send, to
-- everyone with a house or to chosen people. The town lights up the mailbox
-- when there is unread mail.
--
-- Table
-- - town_letters   one row per letter per recipient
--
-- RPCs
-- - get_my_mail(p_limit)            my letters, unread first, then newest
-- - get_my_unread_mail_count()      how many unread
-- - mark_letter_read(p_id)          mark one of mine read
-- - mark_all_mail_read()            mark all of mine read
-- - send_town_letter(...)           admin only; to everyone with a house, or to p_user_ids
--
-- Letters are private: RLS lets a person select their own rows, and there are no
-- insert, update or delete policies, so every change goes through the RPCs above.

CREATE TABLE IF NOT EXISTS public.town_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_label text NOT NULL DEFAULT 'Velvet' CHECK (char_length(btrim(sender_label)) BETWEEN 1 AND 40),
  subject text NOT NULL DEFAULT '' CHECK (char_length(subject) <= 120),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS town_letters_user_created_idx ON public.town_letters (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS town_letters_user_unread_idx ON public.town_letters (user_id) WHERE read_at IS NULL;

ALTER TABLE public.town_letters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "town_letters_select_own" ON public.town_letters;
CREATE POLICY "town_letters_select_own" ON public.town_letters
  FOR SELECT TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON public.town_letters FROM anon, authenticated;
GRANT SELECT ON public.town_letters TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_mail(p_limit int DEFAULT 50)
RETURNS TABLE (id uuid, sender_label text, subject text, body text, created_at timestamptz, read_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT l.id, l.sender_label, l.subject, l.body, l.created_at, l.read_at
  FROM public.town_letters l
  WHERE l.user_id = auth.uid()
  ORDER BY (l.read_at IS NOT NULL), l.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_mail(int) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_mail(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_unread_mail_count()
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT count(*)::int FROM public.town_letters WHERE user_id = auth.uid() AND read_at IS NULL;
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_unread_mail_count() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_unread_mail_count() TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_letter_read(p_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.town_letters SET read_at = now()
  WHERE id = p_id AND user_id = auth.uid() AND read_at IS NULL;
$$;
REVOKE EXECUTE ON FUNCTION public.mark_letter_read(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mark_letter_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_all_mail_read()
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.town_letters SET read_at = now() WHERE user_id = auth.uid() AND read_at IS NULL;
$$;
REVOKE EXECUTE ON FUNCTION public.mark_all_mail_read() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mark_all_mail_read() TO authenticated;

-- Admin only. p_user_ids NULL means everyone with a house. Returns how many letters were sent.
CREATE OR REPLACE FUNCTION public.send_town_letter(p_subject text, p_body text, p_user_ids uuid[] DEFAULT NULL, p_sender text DEFAULT 'Velvet')
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  sent int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an admin can send letters' USING ERRCODE = '42501';
  END IF;
  IF p_body IS NULL OR char_length(btrim(p_body)) = 0 THEN
    RAISE EXCEPTION 'A letter needs some words';
  END IF;

  INSERT INTO public.town_letters (user_id, sender_label, subject, body)
  SELECT wp.user_id, COALESCE(NULLIF(btrim(p_sender), ''), 'Velvet'), COALESCE(btrim(p_subject), ''), btrim(p_body)
  FROM public.world_plots wp
  WHERE (p_user_ids IS NULL OR wp.user_id = ANY (p_user_ids))
    AND NOT COALESCE((SELECT mp.is_bot FROM public.member_profiles mp WHERE mp.user_id = wp.user_id), false);

  GET DIAGNOSTICS sent = ROW_COUNT;
  RETURN sent;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.send_town_letter(text, text, uuid[], text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.send_town_letter(text, text, uuid[], text) TO authenticated;
