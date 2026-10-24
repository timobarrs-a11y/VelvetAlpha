/*
  # Buddy list presence, live

  The buddy list shows who is online, away or offline from `im_presence`.
  Adding the table to the realtime publication makes friends flip to online
  the moment they open Velvet; without it the list still refreshes every 30
  seconds. Realtime applies the table's RLS, so only friends see each other.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'im_presence'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.im_presence;
  END IF;
END $$;
