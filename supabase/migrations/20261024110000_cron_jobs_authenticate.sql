/*
  # Scheduled edge functions: send credentials

  Every pg_cron job that calls an edge function has been getting 401
  Unauthorized: the jobs send no Authorization header (or read
  `app.service_role_key`, which is not set), while `requireCronAuth` accepts
  only the service role key or CRON_SECRET. So overdue sweeps, memory hygiene,
  weekly reviews and proactive check-ins have not been running.

  Prerequisite (once, outside this migration, so the value never lands in git):
    1. Generate a random secret.
    2. Store it as the edge function secret CRON_SECRET.
    3. Store the same value in Vault:
         select vault.create_secret('<value>', 'cron_secret');

  This migration points every such job at that Vault secret, and runs the
  proactive check-ins hourly (the scheduler itself limits each person to one
  message every 6 hours and each companion to one a day, and only sends when
  there is a reason).
*/

DO $$
DECLARE
  j record;
BEGIN
  FOR j IN SELECT jobid, jobname FROM cron.job WHERE command LIKE '%/functions/v1/%' LOOP
    PERFORM cron.alter_job(
      j.jobid,
      command := format(
        $cmd$
SELECT net.http_post(
  url := 'https://lcygiskxwxomytglkwnt.supabase.co/functions/v1/%s',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
  ),
  body := '{}'::jsonb
);
$cmd$,
        j.jobname
      )
    );
  END LOOP;

  PERFORM cron.alter_job(jobid, schedule := '20 * * * *')
  FROM cron.job WHERE jobname = 'proactive-check-in-scheduler';
END $$;
