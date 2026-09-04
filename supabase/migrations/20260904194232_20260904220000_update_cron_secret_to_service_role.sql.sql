/*
# Update cron job secrets to use service role key

The coaching cron jobs need a shared secret to authenticate with the edge
functions. Since CRON_SECRET is not configured, we use the service role key
from the current_setting('app.service_role_key', true) as the secret.

This reschedules the jobs with the correct secret header.
*/

DO $$
BEGIN
  -- Drop existing jobs
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-overdue-commitments') THEN
    PERFORM cron.unschedule('sweep-overdue-commitments');
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'proactive-check-in-scheduler') THEN
    PERFORM cron.unschedule('proactive-check-in-scheduler');
  END IF;

  -- Reschedule with service role key as secret
  PERFORM cron.schedule(
    'sweep-overdue-commitments',
    '0 * * * *',
    $cron$
      SELECT net.http_post(
        url := current_setting('app.project_url', true) || '/functions/v1/sweep-overdue-commitments',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Secret', current_setting('app.service_role_key', true)
        ),
        body := '{}'::jsonb
      );
    $cron$
  );

  PERFORM cron.schedule(
    'proactive-check-in-scheduler',
    '30 */6 * * *',
    $cron$
      SELECT net.http_post(
        url := current_setting('app.project_url', true) || '/functions/v1/proactive-check-in-scheduler',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Secret', current_setting('app.service_role_key', true)
        ),
        body := '{}'::jsonb
      );
    $cron$
  );
END $$;
