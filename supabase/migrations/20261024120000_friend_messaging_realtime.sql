/*
  # Real-time friend messaging

  The friend chat (Messages window in the dock) already subscribes to new
  messages, typing indicators and Velvet Rope messages, but none of these
  tables were in the `supabase_realtime` publication, so nothing arrived
  until a reload or the dock's 20-second poll. Adding them makes chats,
  typing and friend requests live.

  Privacy: realtime applies each table's RLS, which already limits rows to
  the two people in a conversation (or the two people in a friendship).
*/

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['im_messages', 'im_typing', 'im_friendships', 'vr_messages']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
