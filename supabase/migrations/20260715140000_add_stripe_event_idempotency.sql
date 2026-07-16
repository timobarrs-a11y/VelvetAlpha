/*
  # Stripe Webhook Idempotency

  ## Why
  Stripe retries webhook deliveries on any non-2xx response and can occasionally
  deliver the same event more than once. Because the webhook grants message
  credits, a duplicate delivery could double-credit a user. This table records
  every event id we've processed so repeats are ignored.

  ## Changes
    - `stripe_processed_events` — one row per handled Stripe event id.
      RLS enabled with NO client policies: only the webhook (service_role) writes.
*/

CREATE TABLE IF NOT EXISTS stripe_processed_events (
  event_id text PRIMARY KEY,
  event_type text,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stripe_processed_events ENABLE ROW LEVEL SECURITY;
-- No policies: end users get zero access. service_role bypasses RLS.
