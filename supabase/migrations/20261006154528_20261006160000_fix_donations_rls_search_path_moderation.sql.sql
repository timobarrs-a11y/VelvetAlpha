/*
# Fix Donations RLS, Function Search Paths, and Moderation Events Policy

## Summary
Three security fixes based on Supabase security advisor findings:
1. Tightens donations UPDATE policy from USING(true) to ownership-scoped.
2. Adds SET search_path = public to 9 SECURITY DEFINER functions with mutable search paths.
3. Adds INSERT policy for moderation_events (RLS enabled but zero policies).

## 1. Donations UPDATE policy
- OLD: USING(true) WITH CHECK(true) — any authenticated user could UPDATE any row.
- NEW: USING(auth.uid() = user_id) WITH CHECK(auth.uid() = user_id) — own donations only.
- Guest donations (user_id IS NULL) are claimable only via claim_guest_donations (SECURITY DEFINER).

## 2. Function search_path
9 functions recreated with SET search_path = public. match_memories requires DROP+CREATE
because it has parameter defaults that can't be changed via CREATE OR REPLACE.
All function bodies are preserved exactly from their current database definitions.

## 3. moderation_events INSERT policy
Allows authenticated INSERT with WITH CHECK(true). No SELECT/UPDATE/DELETE — admin-only reads.
*/

-- ---------------------------------------------------------------------------
-- 1. Tighten donations UPDATE policy
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "update_service_role_donations" ON donations;
CREATE POLICY "update_service_role_donations"
ON donations FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. Fix function search_path for SECURITY DEFINER functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION claim_first_message(p_companion_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
did_claim boolean;
BEGIN
UPDATE companions
SET first_message_claimed_at = now()
WHERE id = p_companion_id
AND user_id = auth.uid()
AND first_message_sent = false
AND (
first_message_claimed_at IS NULL
OR first_message_claimed_at < now() - interval '5 minutes'
)
RETURNING true INTO did_claim;

RETURN coalesce(did_claim, false);
END;
$function$;

CREATE OR REPLACE FUNCTION compute_relationship_health_for_user()
RETURNS TABLE(person_id uuid, health_score integer, contact_gap_days integer, total_contacts bigint, contacts_last_30_days bigint, avg_gap_days numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
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
SELECT count(*) INTO p_total
FROM relationship_contact_log
WHERE person_id = p_record.id;

SELECT count(*) INTO p_30_day
FROM relationship_contact_log
WHERE person_id = p_record.id
AND contact_date >= CURRENT_DATE - INTERVAL '30 days';

SELECT contact_date INTO p_last_date
FROM relationship_contact_log
WHERE person_id = p_record.id
ORDER BY contact_date DESC
LIMIT 1;

p_gap_days := CASE WHEN p_last_date IS NULL THEN 999
ELSE EXTRACT(DAY FROM now() - p_last_date)::integer
END;

p_avg_gap := 0;
IF p_total > 1 THEN
SELECT avg(gap) INTO p_avg_gap FROM (
SELECT contact_date - lag(contact_date) OVER (ORDER BY contact_date ASC) AS gap
FROM relationship_contact_log
WHERE person_id = p_record.id
) t WHERE gap IS NOT NULL;
END IF;

p_score := 100;
p_score := p_score - LEAST(p_gap_days * 3, 60);

IF p_30_day >= 3 THEN
p_score := p_score + 15;
ELSIF p_30_day >= 1 THEN
p_score := p_score + 5;
END IF;

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
$function$;

CREATE OR REPLACE FUNCTION get_latest_briefs_per_person()
RETURNS SETOF relationship_briefs
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
SELECT DISTINCT ON (person_id) *
FROM relationship_briefs
WHERE user_id = auth.uid()
ORDER BY person_id, brief_week DESC;
$function$;

CREATE OR REPLACE FUNCTION increment_memory_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
IF NEW.version = OLD.version THEN
NEW.version := OLD.version + 1;
END IF;
NEW.updated_at := now();
RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION log_memory_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
v_actor_type text := COALESCE(current_setting('app.actor_type', true), 'extractor');
v_actor_id text := current_setting('app.actor_id', true);
v_session_id text := current_setting('app.session_id', true);
v_message_id text := current_setting('app.message_id', true);
v_proposal_id text := current_setting('app.proposal_id', true);
v_version int;
BEGIN
IF TG_OP = 'DELETE' THEN
v_version := OLD.version;
INSERT INTO memory_history (memory_id, version, op, before, after, actor_type, actor_id, triggering_session_id, triggering_message_id, proposal_id)
VALUES (
OLD.id,
v_version,
'DELETE',
to_jsonb(OLD),
NULL,
v_actor_type,
CASE WHEN v_actor_id IS NOT NULL AND v_actor_id != '' THEN v_actor_id::uuid ELSE NULL END,
CASE WHEN v_session_id IS NOT NULL AND v_session_id != '' THEN v_session_id::uuid ELSE NULL END,
CASE WHEN v_message_id IS NOT NULL AND v_message_id != '' THEN v_message_id::uuid ELSE NULL END,
CASE WHEN v_proposal_id IS NOT NULL AND v_proposal_id != '' THEN v_proposal_id::uuid ELSE NULL END
);
RETURN OLD;
ELSIF TG_OP = 'UPDATE' THEN
v_version := NEW.version;
INSERT INTO memory_history (memory_id, version, op, before, after, actor_type, actor_id, triggering_session_id, triggering_message_id, proposal_id)
VALUES (
NEW.id,
v_version,
'UPDATE',
to_jsonb(OLD),
to_jsonb(NEW),
v_actor_type,
CASE WHEN v_actor_id IS NOT NULL AND v_actor_id != '' THEN v_actor_id::uuid ELSE NULL END,
CASE WHEN v_session_id IS NOT NULL AND v_session_id != '' THEN v_session_id::uuid ELSE NULL END,
CASE WHEN v_message_id IS NOT NULL AND v_message_id != '' THEN v_message_id::uuid ELSE NULL END,
CASE WHEN v_proposal_id IS NOT NULL AND v_proposal_id != '' THEN v_proposal_id::uuid ELSE NULL END
);
RETURN NEW;
ELSIF TG_OP = 'INSERT' THEN
v_version := NEW.version;
INSERT INTO memory_history (memory_id, version, op, before, after, actor_type, actor_id, triggering_session_id, triggering_message_id, proposal_id)
VALUES (
NEW.id,
v_version,
'INSERT',
NULL,
to_jsonb(NEW),
v_actor_type,
CASE WHEN v_actor_id IS NOT NULL AND v_actor_id != '' THEN v_actor_id::uuid ELSE NULL END,
CASE WHEN v_session_id IS NOT NULL AND v_session_id != '' THEN v_session_id::uuid ELSE NULL END,
CASE WHEN v_message_id IS NOT NULL AND v_message_id != '' THEN v_message_id::uuid ELSE NULL END,
CASE WHEN v_proposal_id IS NOT NULL AND v_proposal_id != '' THEN v_proposal_id::uuid ELSE NULL END
);
RETURN NEW;
END IF;
RETURN NULL;
END;
$function$;

-- match_memories requires DROP+CREATE due to parameter defaults
DROP FUNCTION IF EXISTS match_memories(vector, uuid, uuid, double precision, integer);
CREATE FUNCTION match_memories(query_embedding vector, match_user_id uuid, match_companion_id uuid, match_threshold double precision DEFAULT 0.70, match_count integer DEFAULT 8)
RETURNS TABLE(id uuid, summary text, key_facts text[], emotional_tone text, importance_score double precision, session_key timestamp with time zone, similarity double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
SELECT
ss.id,
ss.summary,
ss.key_facts,
ss.emotional_tone,
ss.importance_score,
ss.session_key,
1 - (ss.embedding <=> query_embedding) AS similarity
FROM session_summaries ss
WHERE
ss.user_id       = match_user_id
AND ss.companion_id = match_companion_id
AND ss.embedding  IS NOT NULL
AND 1 - (ss.embedding <=> query_embedding) >= match_threshold
ORDER BY
(0.6 * (1 - (ss.embedding <=> query_embedding))
+ 0.3 * ss.importance_score
+ 0.1 * (1.0 / (1.0 + EXTRACT(EPOCH FROM (now() - ss.session_key)) / 86400.0))
) DESC
LIMIT match_count;
$function$;

CREATE OR REPLACE FUNCTION rollback_memory(p_memory_id uuid, p_to_version integer)
RETURNS memory_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
v_user_id uuid;
v_is_super boolean;
v_history record;
BEGIN
SELECT user_id INTO v_user_id FROM memory_items WHERE id = p_memory_id;
IF NOT FOUND THEN
RAISE EXCEPTION 'Memory item not found';
END IF;

SELECT is_super_user INTO v_is_super
FROM user_profiles
WHERE id = auth.uid();

IF auth.uid() IS NULL OR (auth.uid() != v_user_id AND COALESCE(v_is_super, false) = false) THEN
RAISE EXCEPTION 'Not authorized to rollback this memory item';
END IF;

SELECT * INTO v_history
FROM memory_history
WHERE memory_id = p_memory_id
AND version = p_to_version
ORDER BY created_at DESC
LIMIT 1;

IF NOT FOUND THEN
RAISE EXCEPTION 'Version % not found in history', p_to_version;
END IF;

IF v_history.after IS NOT NULL THEN
UPDATE memory_items
SET
content = (v_history.after->>'content'),
status = (v_history.after->>'status'),
scope = (v_history.after->>'scope'),
kind = (v_history.after->>'kind'),
confidence = (v_history.after->>'confidence')::real,
importance = (v_history.after->>'importance')::int,
source = (v_history.after->>'source'),
due_at = NULLIF(v_history.after->>'due_at', '')::timestamptz,
superseded_by = NULLIF(v_history.after->>'superseded_by', '')::uuid
WHERE id = p_memory_id;
ELSE
INSERT INTO memory_items (id, user_id, companion_id, scope, kind, content, status, confidence, importance, source, version)
SELECT
(v_history.before->>'id')::uuid,
(v_history.before->>'user_id')::uuid,
NULLIF(v_history.before->>'companion_id', '')::uuid,
v_history.before->>'scope',
v_history.before->>'kind',
v_history.before->>'content',
v_history.before->>'status',
(v_history.before->>'confidence')::real,
(v_history.before->>'importance')::int,
v_history.before->>'source',
p_to_version
ON CONFLICT (id) DO UPDATE SET
content = EXCLUDED.content,
status = EXCLUDED.status,
scope = EXCLUDED.scope,
kind = EXCLUDED.kind;
END IF;

RETURN (SELECT * FROM memory_items WHERE id = p_memory_id);
END;
$function$;

CREATE OR REPLACE FUNCTION update_onboarding_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION update_user_goals_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Add INSERT policy for moderation_events
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "insert_service_role_moderation_events" ON moderation_events;
CREATE POLICY "insert_service_role_moderation_events"
ON moderation_events FOR INSERT
TO authenticated
WITH CHECK (true);
