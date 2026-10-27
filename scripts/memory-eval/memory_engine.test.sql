-- Regression tests for the memory engine migrations
-- (20261030100000_memory_engine_v2.sql, 20261031100000_memory_engine_v3.sql).
--
-- Runs against a scratch Postgres (16+) with pgvector, never a real project:
--   psql -d scratch -v ON_ERROR_STOP=1 -f scripts/memory-eval/memory_engine.test.sql
-- The preamble stubs the bits of Supabase the memory migrations need, applies
-- them in order, then asserts. Any failed assertion raises and stops the run.

\set ON_ERROR_STOP 1
\set QUIET 1

-- Supabase stubs -------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);
-- auth.uid() reads a test setting; unset = service-role caller.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('test.uid', true), '')::uuid $$;
CREATE TABLE IF NOT EXISTS companions (id uuid PRIMARY KEY);
CREATE TABLE IF NOT EXISTS user_profiles (id uuid PRIMARY KEY, is_super_user boolean DEFAULT false);
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, companion_id uuid NOT NULL,
  role text NOT NULL, content text NOT NULL, created_at timestamptz DEFAULT now(), summarized boolean NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS user_insights (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, facts_learned jsonb);
CREATE TABLE IF NOT EXISTS companion_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, companion_id uuid NOT NULL,
  memory_json jsonb NOT NULL DEFAULT '{}', memory_text text NOT NULL DEFAULT '');

-- Migrations under test --------------------------------------------------------
\ir ../../supabase/migrations/20261002184116_20261002200000_create_memory_items_store.sql.sql
\ir ../../supabase/migrations/20261002184657_20261002202000_add_memory_history_and_versioning.sql.sql
\ir ../../supabase/migrations/20261002184728_20261002202500_fix_memory_history_fk.sql.sql
\ir ../../supabase/migrations/20261002203706_20261002220000_fix_memory_rpc_security.sql.sql
\ir ../../supabase/migrations/20261002203741_20261002221000_add_service_role_fallback_to_memory_rpcs.sql.sql
\ir ../../supabase/migrations/20261002191308_20261002191000_add_memory_trace_and_events.sql.sql
\ir ../../supabase/migrations/20261002192805_20261002193000_add_memory_proposals.sql.sql
ALTER TABLE memory_items ADD COLUMN IF NOT EXISTS shared_origin_companion_id uuid REFERENCES companions(id) ON DELETE SET NULL;
\ir ../../supabase/migrations/20261030100000_memory_engine_v2.sql
\ir ../../supabase/migrations/20261031100000_memory_engine_v3.sql
-- Idempotent: applying twice must not fail.
\ir ../../supabase/migrations/20261030100000_memory_engine_v2.sql
\ir ../../supabase/migrations/20261031100000_memory_engine_v3.sql

-- Fixtures ---------------------------------------------------------------------
INSERT INTO auth.users VALUES ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');
INSERT INTO companions VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

CREATE OR REPLACE FUNCTION pg_temp.add(p_content text, p_extra jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql AS $$
  SELECT upsert_memory_item(jsonb_build_object(
    'user_id', '11111111-1111-1111-1111-111111111111',
    'companion_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'kind', 'fact', 'content', p_content) || p_extra);
$$;

CREATE OR REPLACE FUNCTION pg_temp.check(p_ok boolean, p_what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', p_what; END IF;
  RAISE NOTICE 'ok - %', p_what;
END $$;

\set QUIET 0

-- Dedup and reinforcement --------------------------------------------------------
SELECT pg_temp.add('User is an author');
SELECT pg_temp.add('user is an AUTHOR.', '{"confidence": 0.5}');
SELECT pg_temp.check((SELECT count(*) FROM memory_items) = 1, 'case/punctuation variants dedupe to one row');
SELECT pg_temp.check((SELECT confirm_count FROM memory_items) = 2, 're-observing a memory confirms it');
SELECT pg_temp.check((SELECT abs(confidence - 0.7) < 1e-6 FROM memory_items), 're-observing never lowers confidence');
SELECT pg_temp.check((SELECT count(*) FROM memory_history) = 1, 'confirmation is not a new version');

SELECT pg_temp.add(c) FROM unnest(ARRAY[
  'User has a dog named Biscuit', 'User works as a nurse at the hospital', 'User loves spicy ramen',
  'User lives in Denver', 'User prefers mornings', 'User plays guitar', 'User hates cilantro',
  'User drives a blue Subaru', 'User studied biology', 'User is allergic to cats', 'User reads mystery novels',
  'User sister is named Clara', 'User is training for a marathon in March']) c;
SELECT pg_temp.add('User has a girl over tonight', '{"valid_until": "2000-01-01T00:00:00Z"}');
SELECT pg_temp.add('User private marathon fear', '{"scope": "private"}');
SELECT pg_temp.add('User told B about a marathon secret', '{"companion_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}');
SELECT upsert_memory_item('{"user_id":"11111111-1111-1111-1111-111111111111","scope":"global","kind":"fact","content":"User got a new job as a marathon coach"}');

-- Recall tracking (service role) -------------------------------------------------
SELECT update_memory_recall(ARRAY(SELECT id FROM memory_items WHERE content LIKE '%Biscuit%'));
SELECT pg_temp.check((SELECT recall_count = 1 AND version = 1 FROM memory_items WHERE content LIKE '%Biscuit%'),
  'service-role recall is recorded without bumping version');

-- Retrieval --------------------------------------------------------------------
SELECT pg_temp.check((
  SELECT content FROM fetch_memories_for_turn('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'romantic', 1200, 'how is the marathon training going?') LIMIT 1
) = 'User is training for a marathon in March', 'the relevant fact ranks first even when it was stored last of 13');
SELECT pg_temp.check(NOT EXISTS (
  SELECT 1 FROM fetch_memories_for_turn('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'romantic', 1200, 'girl')
  WHERE content LIKE '%girl over%'), 'expired temporary memories are not retrieved');
SELECT pg_temp.check(NOT EXISTS (
  SELECT 1 FROM fetch_memories_for_turn('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'romantic', 1200, 'marathon secret')
  WHERE content LIKE '%told B%'), 'another companion''s memories do not leak');
SELECT pg_temp.check(NOT EXISTS (
  SELECT 1 FROM fetch_memories_for_turn('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'mentor', 1200, 'marathon fear')
  WHERE content LIKE '%private%'), 'private memories are hidden from mentors');
SELECT pg_temp.check(EXISTS (
  SELECT 1 FROM fetch_memories_for_turn('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'mentor', 1200, 'job')
  WHERE content LIKE '%marathon coach%'), 'global memories reach every companion');
SELECT pg_temp.check((SELECT count(*) FROM fetch_memories_for_turn('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'romantic', 1200, 'and the of it''s')) > 0,
  'a stopword-only message still returns background memories');

-- Supersession -------------------------------------------------------------------
SELECT supersede_memory_item(id, version, '{"content": "User reads the Ice Cream Social series but is not its author"}', 'user')
FROM memory_items WHERE content = 'User is an author';
SELECT pg_temp.check((SELECT status = 'superseded' AND superseded_by IS NOT NULL FROM memory_items WHERE content = 'User is an author'),
  'a corrected memory is kept as superseded history');
SELECT pg_temp.check((SELECT status = 'active' AND source = 'user_stated' FROM memory_items WHERE content LIKE '%not its author'),
  'the correction is a new active, user-stated row');
SELECT pg_temp.check((SELECT supersede_memory_item(id, version - 1, '{"content": "x"}') IS NULL FROM memory_items WHERE content LIKE '%Denver%'),
  'a stale base_version is a conflict (NULL), not a write');
SELECT supersede_memory_item(id, version, '{"content": "User plays GUITAR!"}') FROM memory_items WHERE content = 'User prefers mornings';
SELECT pg_temp.check((SELECT count(*) FROM memory_items WHERE status = 'active' AND content ILIKE '%guitar%') = 1,
  'superseding into existing text points at that row instead of duplicating it');

-- Embedding hygiene ------------------------------------------------------------------
UPDATE memory_items SET embedding = array_fill(0.1, ARRAY[1536])::vector, embedding_model = 'm1' WHERE content LIKE '%Denver%';
SELECT pg_temp.check((SELECT version = 1 FROM memory_items WHERE content LIKE '%Denver%'), 'adding an embedding is not a new version');
SELECT update_memory_item(id, version, '{"content": "User lives in Boulder", "source": "user_edited"}', 'user') FROM memory_items WHERE content LIKE '%Denver%';
SELECT pg_temp.check((SELECT embedding IS NULL AND source = 'user_edited' AND version = 2 FROM memory_items WHERE content LIKE '%Boulder%'),
  'editing content clears the stale embedding');
SELECT pg_temp.add('User is vegan', '{"evidence": "I am vegan"}');
SELECT update_memory_item(id, version, '{"content": "[forgotten by user]", "status": "retired"}', 'user') FROM memory_items WHERE content = 'User is vegan';
SELECT pg_temp.check((SELECT evidence IS NULL FROM memory_items WHERE content = '[forgotten by user]'),
  'forgetting a memory also drops the user''s quoted words');

UPDATE memory_items SET embedding = array_fill(0.1, ARRAY[1536])::vector, embedding_model = 'm1' WHERE content LIKE '%Biscuit%';
SELECT pg_temp.check((
  SELECT content FROM fetch_memories_for_turn('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'romantic', 1200, 'puppy', array_fill(0.1, ARRAY[1536])::vector, 'm1') LIMIT 1
) LIKE '%Biscuit%', 'vector search finds a memory with no shared words');
SELECT pg_temp.check(NOT EXISTS (
  SELECT 1 FROM fetch_memories_for_turn('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'romantic', 1200, 'puppy', array_fill(0.1, ARRAY[1536])::vector, 'm2')
  WHERE relevance > 0), 'vectors from a different embedding model are never compared');

-- Authorization ------------------------------------------------------------------------
SET test.uid = '22222222-2222-2222-2222-222222222222';
SELECT pg_temp.check((SELECT count(*) FROM fetch_memories_for_turn('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'romantic', 1200, 'marathon')) = 0,
  'a signed-in user cannot read another user''s memories');
DO $$
BEGIN
  PERFORM supersede_memory_item(id, version, '{"content": "hacked"}') FROM memory_items WHERE content LIKE '%Biscuit%';
  RAISE EXCEPTION 'FAILED: cross-user supersede was allowed';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FAILED%' THEN RAISE; END IF;
  RAISE NOTICE 'ok - a signed-in user cannot supersede another user''s memory';
END $$;
SELECT update_memory_recall(ARRAY(SELECT id FROM memory_items));
RESET test.uid;
SELECT pg_temp.check((SELECT recall_count = 1 FROM memory_items WHERE content LIKE '%Biscuit%'),
  'a signed-in user cannot touch another user''s recall stats');

-- v3: grants ---------------------------------------------------------------------------
SELECT pg_temp.check(NOT has_function_privilege('authenticated', 'upsert_memory_item(jsonb)', 'execute')
  AND NOT has_function_privilege('authenticated', 'supersede_memory_item(uuid, int, jsonb, text)', 'execute')
  AND NOT has_function_privilege('authenticated', 'update_memory_item(uuid, int, jsonb, text)', 'execute')
  AND NOT has_function_privilege('authenticated', 'forget_memory_item(uuid, uuid)', 'execute')
  AND NOT has_function_privilege('anon', 'clear_user_memory(uuid)', 'execute'),
  'browsers cannot call memory write RPCs directly');

-- v3: calibrated relevance -----------------------------------------------------------
SELECT pg_temp.check((
  SELECT relevance < 0.2 FROM fetch_memories_for_turn('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'romantic', 1200, 'I love you')
  WHERE content = 'User loves spicy ramen'), 'one shared common word is not "relevant"');
SELECT pg_temp.check((
  SELECT relevance >= 0.5 FROM fetch_memories_for_turn('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'romantic', 1200, 'want some spicy ramen tonight?')
  WHERE content = 'User loves spicy ramen'), 'a real topical match is relevant');

-- v3: duplicate race closed ------------------------------------------------------------
DO $$
BEGIN
  INSERT INTO memory_items (user_id, companion_id, kind, content)
  VALUES ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'fact', 'USER HATES CILANTRO!');
  RAISE EXCEPTION 'FAILED: a normalized duplicate was inserted';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'ok - the unique index rejects a racing duplicate insert';
END $$;

-- v3: expiry ---------------------------------------------------------------------------
SELECT pg_temp.add('User has a cold', '{"valid_until": "2000-01-01T00:00:00Z"}');
SELECT pg_temp.add('User has a cold');
SELECT pg_temp.check((SELECT count(*) FROM memory_items WHERE content = 'User has a cold' AND status = 'active' AND valid_until IS NULL) = 1
  AND (SELECT count(*) FROM memory_items WHERE content = 'User has a cold' AND status = 'retired') = 1,
  'restating an expired temporary memory starts a fresh one');
SELECT pg_temp.add('User is in Paris', format('{"valid_until": "%s"}', now() + interval '2 days')::jsonb);
SELECT pg_temp.add('User is in Paris', '{"durable": true}');
SELECT pg_temp.check((SELECT valid_until IS NULL FROM memory_items WHERE content = 'User is in Paris' AND status = 'active'),
  'a durable restatement clears the old expiry');
SELECT pg_temp.add('User has the flu', '{"valid_until": "2000-01-01T00:00:00Z"}');
SELECT pg_temp.check(retire_expired_memories() >= 1, 'expired memories are retired fleet-wide');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM memory_items WHERE status = 'active' AND valid_until <= now()), 'no expired memory stays active');

-- v3: forgetting reaches every copy ------------------------------------------------------
SELECT pg_temp.add('User has diabetes', '{"evidence": "I have diabetes"}');
SELECT supersede_memory_item(id, version, '{"content": "User has type 1 diabetes", "evidence": "type 1 diabetes"}', 'extractor')
FROM memory_items WHERE content = 'User has diabetes';
INSERT INTO memory_events (user_id, companion_id, memory_item_id, event_type, payload)
SELECT user_id, companion_id, id, 'correction', '{"old_content": "User has diabetes"}' FROM memory_items WHERE content = 'User has type 1 diabetes';
INSERT INTO memory_proposals (proposal_id, pass, target, target_id, user_id, action, before, risk, status)
SELECT gen_random_uuid(), 'hygiene', 'memory_item', id::text, user_id, 'retire', content, 'low', 'pending' FROM memory_items WHERE content = 'User has type 1 diabetes';
SELECT pg_temp.add('Summary: they manage their diabetes carefully', '{"kind": "moment"}');
INSERT INTO companion_memories (user_id, companion_id, memory_json, memory_text)
VALUES ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{"x": "diabetes"}', 'diabetes');
SELECT pg_temp.check(forget_memory_item(id, user_id), 'forget reports success') FROM memory_items WHERE content = 'User has type 1 diabetes';
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM memory_items WHERE content ILIKE '%diabetes%'), 'forget scrubs the memory and the versions it replaced');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM memory_history WHERE before::text ILIKE '%diabetes%' OR after::text ILIKE '%diabetes%'), 'forget scrubs memory_history');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM memory_events WHERE payload::text ILIKE '%diabetes%'), 'forget scrubs memory_events');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM memory_proposals WHERE before ILIKE '%diabetes%'), 'forget scrubs memory_proposals');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM companion_memories), 'forget resets the summary it fed');
SELECT pg_temp.check(forget_memory_item(id, '22222222-2222-2222-2222-222222222222') = false, 'forget refuses another user''s memory')
FROM memory_items WHERE content LIKE '%Biscuit%';

-- v3: atomic summarization claim -----------------------------------------------------------
INSERT INTO conversations (user_id, companion_id, role, content)
SELECT '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'user', 'msg ' || g FROM generate_series(1, 3) g;
SELECT pg_temp.check((SELECT count(*) FROM claim_unsummarized_messages('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 5, 100)) = 0
  AND NOT EXISTS (SELECT 1 FROM conversations WHERE summarized), 'below the minimum nothing is claimed');
SELECT pg_temp.check((SELECT count(*) FROM claim_unsummarized_messages('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2, 100)) = 3,
  'a claim returns the unsummarized messages');
SELECT pg_temp.check((SELECT count(*) FROM claim_unsummarized_messages('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 100)) = 0,
  'claimed messages are not claimed twice');

-- v3: clear everything, then account deletion erases history ------------------------------
INSERT INTO companion_memories (user_id, companion_id) VALUES ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
INSERT INTO user_insights (user_id, facts_learned) VALUES ('11111111-1111-1111-1111-111111111111', '[{"fact": "old"}]');
SELECT pg_temp.check(clear_user_memory('11111111-1111-1111-1111-111111111111') > 0, 'clearing memory reports what it cleared');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM companion_memories) AND NOT EXISTS (SELECT 1 FROM user_insights WHERE facts_learned <> '[]'),
  'clearing memory resets every summary and the legacy fact list');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM memory_items WHERE user_id = '11111111-1111-1111-1111-111111111111' AND status = 'active')
  AND NOT EXISTS (SELECT 1 FROM memory_items WHERE user_id = '11111111-1111-1111-1111-111111111111' AND content NOT LIKE '[%by user]'),
  'clearing memory retires and scrubs every row');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM memory_history h JOIN memory_items m ON m.id = h.memory_id
  WHERE m.user_id = '11111111-1111-1111-1111-111111111111' AND (h.before::text ILIKE '%marathon%' OR h.after::text ILIKE '%marathon%')),
  'clearing memory scrubs history');
SELECT upsert_memory_item('{"user_id":"22222222-2222-2222-2222-222222222222","kind":"fact","content":"User two secret"}');
DELETE FROM auth.users WHERE id = '22222222-2222-2222-2222-222222222222';
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM memory_history WHERE before::text ILIKE '%User two secret%' OR after::text ILIKE '%User two secret%'),
  'deleting an account erases its memory history');

\echo 'memory engine: all checks passed'
