/*
# Add Relationship Brief Helper Functions

## Overview
Creates SQL helper functions used by the relationship brief engine:
1. get_latest_briefs_per_person — returns only the most recent brief per person
2. compute_relationship_health_for_user — computes health scores across all people

## Security
- Both functions use auth.uid() to scope results to the authenticated user
- Functions are NOT SECURITY DEFINER — they run with the caller's privileges
*/

-- Drop existing if any for idempotency
DROP FUNCTION IF EXISTS get_latest_briefs_per_person();

-- Returns the most recent brief per person for the authenticated user
CREATE OR REPLACE FUNCTION get_latest_briefs_per_person()
RETURNS SETOF relationship_briefs
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT ON (person_id) *
  FROM relationship_briefs
  WHERE user_id = auth.uid()
  ORDER BY person_id, brief_week DESC;
$$;

-- Drop existing if any for idempotency
DROP FUNCTION IF EXISTS compute_relationship_health_for_user();

-- Computes relationship health score for all of the user's people
-- Health score formula:
--   Start at 100
--   Subtract min(contact_gap_days * 3, 60) — longer gaps reduce score
--   Add bonus for recent contacts: +5 per contact in last 7 days (max +15)
--   Add bonus for consistency: +10 if 3+ contacts in last 30 days
--   Clamp to 0-100
CREATE OR REPLACE FUNCTION compute_relationship_health_for_user()
RETURNS TABLE (
  person_id uuid,
  health_score integer,
  contact_gap_days integer,
  total_contacts bigint,
  contacts_last_30_days bigint,
  avg_gap_days numeric
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  p_record RECORD;
  p_gap_days integer;
  p_total bigint;
  p_30_day bigint;
  p_score integer;
  p_avg_gap numeric;
  p_last_date date;
  p_prev_date date;
BEGIN
  FOR p_record IN
    SELECT id FROM real_people WHERE user_id = auth.uid()
  LOOP
    -- Total contacts
    SELECT count(*) INTO p_total
    FROM relationship_contact_log
    WHERE person_id = p_record.id;

    -- Contacts in last 30 days
    SELECT count(*) INTO p_30_day
    FROM relationship_contact_log
    WHERE person_id = p_record.id
      AND contact_date >= CURRENT_DATE - INTERVAL '30 days';

    -- Contact gap (days since last contact)
    SELECT contact_date INTO p_last_date
    FROM relationship_contact_log
    WHERE person_id = p_record.id
    ORDER BY contact_date DESC
    LIMIT 1;

    p_gap_days := CASE WHEN p_last_date IS NULL THEN 999
                       ELSE EXTRACT(DAY FROM now() - p_last_date)::integer
                  END;

    -- Average gap between contacts
    p_avg_gap := 0;
    IF p_total > 1 THEN
      SELECT avg(gap) INTO p_avg_gap FROM (
        SELECT contact_date - lag(contact_date) OVER (ORDER BY contact_date ASC) AS gap
        FROM relationship_contact_log
        WHERE person_id = p_record.id
      ) t WHERE gap IS NOT NULL;
    END IF;

    -- Compute health score
    p_score := 100;
    p_score := p_score - LEAST(p_gap_days * 3, 60);

    -- Bonus for recent contact (last 7 days)
    IF p_30_day >= 3 THEN
      p_score := p_score + 15;
    ELSIF p_30_day >= 1 THEN
      p_score := p_score + 5;
    END IF;

    -- Bonus for consistency
    IF p_30_day >= 3 THEN
      p_score := p_score + 10;
    END IF;

    p_score := GREATEST(0, LEAST(100, p_score));

    RETURN QUERY SELECT
      p_record.id,
      p_score,
      p_gap_days,
      p_total,
      p_30_day,
      COALESCE(p_avg_gap, 0);
  END LOOP;
END;
$$;