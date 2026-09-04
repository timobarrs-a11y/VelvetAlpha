/*
# Install pg_cron and schedule coaching background jobs

1. Extensions
- Install `pg_cron` (v1.6.4) in the `cron` schema.
- Install `pg_net` (v0.19.5) for HTTP requests from cron jobs.

2. Scheduled jobs
- `sweep-overdue-commitments`: runs every hour. Calls the edge function
  which marks coaching commitments as overdue when their due date passes
  and sends a reconciliation prompt to the coach.
- `proactive-check-in-scheduler`: runs every 6 hours. Calls the edge function
  which sends a check-in message from a coach if the user hasn't chatted
  in 24+ hours.

3. Security
- Both jobs call the edge functions with the CRON_SECRET header.
- The edge functions verify this secret and reject unauthenticated requests
  when the secret is configured. If CRON_SECRET is not set, the functions
  fail open (accept all) — set the secret in Supabase project secrets.

4. Important notes
- The CRON_SECRET must be set as an edge function secret in the Supabase
  dashboard for the auth check to work.
- pg_cron requires `shared_preload_libraries = 'pg_cron'` which is
  pre-configured on Supabase. The extension just needs enabling.
- Job times are in UTC.
*/

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Helper function to get the project URL dynamically
DO $$
BEGIN
  -- Schedule the overdue commitment sweep (every hour at minute 0)
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-overdue-commitments') THEN
    PERFORM cron.schedule(
      'sweep-overdue-commitments',
      '0 * * * *',
      $cron$
        SELECT net.http_post(
          url := current_setting('app.project_url', true) || '/functions/v1/sweep-overdue-commitments',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'X-Cron-Secret', current_setting('app.cron_secret', true)
          ),
          body := '{}'::jsonb
        );
      $cron$
    );
  END IF;

  -- Schedule the proactive check-in sweep (every 6 hours at minute 30)
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'proactive-check-in-scheduler') THEN
    PERFORM cron.schedule(
      'proactive-check-in-scheduler',
      '30 */6 * * *',
      $cron$
        SELECT net.http_post(
          url := current_setting('app.project_url', true) || '/functions/v1/proactive-check-in-scheduler',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'X-Cron-Secret', current_setting('app.cron_secret', true)
          ),
          body := '{}'::jsonb
        );
      $cron$
    );
  END IF;
END $$;
