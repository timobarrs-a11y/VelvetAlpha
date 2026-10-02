/*
# Schedule weekly dream-fleet job via pg_cron

1. Purpose
- Schedules the dream-fleet edge function to run weekly on Sundays at 04:00 UTC.
- Uses the same pattern as the canonical cron migrations: hardcoded project URL,
  no auth header (the function performs read + insert using the service role key
  and is not callable from the app UI).

2. Scheduling
- Job name: 'dream-fleet'
- Schedule: '0 4 * * 0' (every Sunday at 04:00 UTC)
- Endpoint: /functions/v1/dream-fleet
- Body: '{}' (the function self-discovers eligible users and signals)

3. Idempotency
- Unschedules existing 'dream-fleet' job before scheduling to avoid duplicates.
*/

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dream-fleet') THEN
    PERFORM cron.unschedule('dream-fleet');
  END IF;

  PERFORM cron.schedule(
    'dream-fleet',
    '0 4 * * 0',
    $cron$
      SELECT net.http_post(
        url := 'https://lcygiskxwxomytglkwnt.supabase.co/functions/v1/dream-fleet',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := '{}'::jsonb
      );
    $cron$
  );
END $$;
