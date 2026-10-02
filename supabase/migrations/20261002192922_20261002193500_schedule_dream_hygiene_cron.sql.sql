/*
# Schedule nightly dream-hygiene job via pg_cron

1. Purpose
- Schedules the dream-hygiene edge function to run nightly at 03:00 UTC.
- Uses the same pattern as the canonical cron migrations: hardcoded project URL,
  no auth header (the function performs read + insert using the service role key
  and is not callable from the app UI).

2. Scheduling
- Job name: 'dream-hygiene'
- Schedule: '0 3 * * *' (daily at 03:00 UTC)
- Endpoint: /functions/v1/dream-hygiene
- Body: '{}' (the function self-discovers pairs with recent activity)

3. Idempotency
- Unschedules existing 'dream-hygiene' job before scheduling to avoid duplicates.
*/

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dream-hygiene') THEN
    PERFORM cron.unschedule('dream-hygiene');
  END IF;

  PERFORM cron.schedule(
    'dream-hygiene',
    '0 3 * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://lcygiskxwxomytglkwnt.supabase.co/functions/v1/dream-hygiene',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := '{}'::jsonb
      );
    $cron$
  );
END $$;
