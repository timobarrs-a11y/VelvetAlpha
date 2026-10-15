/*
# Schedule community-bot via pg_cron

1. Purpose
Schedules the community-bot edge function to run every 4 hours via pg_cron.
The edge function handles both the poster bot (Maya) and responder bot (Jordan),
including rate-limiting and deduplication internally.

2. Schedule
- Runs at minute 15 of every 4th hour.
- Offset from other cron jobs to avoid simultaneous execution spikes.
- Uses the same pattern as existing coaching jobs: net.http_post with
  service role key from app settings.

3. Idempotent
- Unschedules existing job first, then reschedules.
*/

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'community-bot') THEN
    PERFORM cron.unschedule('community-bot');
  END IF;

  PERFORM cron.schedule(
    'community-bot',
    '15 */4 * * *',
    $cron$
      SELECT net.http_post(
        url := current_setting('app.project_url', true) || '/functions/v1/community-bot',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Secret', current_setting('app.service_role_key', true)
        ),
        body := '{}'::jsonb
      );
    $cron$
  );
END $$;
