/*
# Update cron jobs to send CRON_SECRET auth header

## Problem
The dream-hygiene and dream-fleet edge functions now require a CRON_SECRET
Bearer token. The existing cron jobs send no auth header, so they would be
rejected with 401.

## Fix
Re-schedule both cron jobs with an Authorization header containing the
service role key (which acts as the CRON_SECRET since it's a secret value
only the database and edge function runtime can access).

## Note
We use the service_role key as the CRON_SECRET because:
1. It's already available in the environment
2. The edge function checks `authHeader === Bearer ${CRON_SECRET}`
3. We set CRON_SECRET = service role key in the edge function env
4. The cron job can read the service role key from the database settings
*/

DO $$
BEGIN
  -- Update dream-hygiene cron
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dream-hygiene') THEN
    PERFORM cron.unschedule('dream-hygiene');
  END IF;

  PERFORM cron.schedule(
    'dream-hygiene',
    '0 3 * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://lcygiskxwxomytglkwnt.supabase.co/functions/v1/dream-hygiene',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body := '{}'::jsonb
      );
    $cron$
  );

  -- Update dream-fleet cron
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dream-fleet') THEN
    PERFORM cron.unschedule('dream-fleet');
  END IF;

  PERFORM cron.schedule(
    'dream-fleet',
    '0 4 * * 0',
    $cron$
      SELECT net.http_post(
        url := 'https://lcygiskxwxomytglkwnt.supabase.co/functions/v1/dream-fleet',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body := '{}'::jsonb
      );
    $cron$
  );
END $$;
