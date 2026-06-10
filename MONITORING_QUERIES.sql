-- COMPANION MEMORY SYSTEM MONITORING QUERIES

-- ============================================
-- 1. CHECK MESSAGE SUMMARIZATION STATUS
-- ============================================

-- Count of summarized vs unsummarized messages per companion
SELECT
  c.custom_name as companion_name,
  c.character_type,
  COUNT(CASE WHEN conv.summarized = false THEN 1 END) as unsummarized,
  COUNT(CASE WHEN conv.summarized = true THEN 1 END) as summarized,
  COUNT(*) as total_messages
FROM companions c
LEFT JOIN conversations conv ON conv.companion_id = c.id
GROUP BY c.id, c.custom_name, c.character_type
ORDER BY unsummarized DESC;

-- ============================================
-- 2. VIEW COMPANION MEMORIES
-- ============================================

-- List all companion memories with details
SELECT
  cm.user_id,
  c.custom_name as companion_name,
  c.character_type,
  cm.messages_processed,
  LENGTH(cm.memory_text) as memory_length_chars,
  SUBSTRING(cm.memory_text, 1, 100) || '...' as memory_preview,
  cm.created_at,
  cm.updated_at
FROM companion_memories cm
JOIN companions c ON c.id = cm.companion_id
ORDER BY cm.updated_at DESC;

-- ============================================
-- 3. COMPANIONS NEEDING SUMMARIZATION
-- ============================================

-- Find companions with 75+ unsummarized messages
SELECT
  c.id,
  c.custom_name as companion_name,
  c.character_type,
  COUNT(*) as unsummarized_count
FROM companions c
JOIN conversations conv ON conv.companion_id = c.id
WHERE conv.summarized = false
GROUP BY c.id, c.custom_name, c.character_type
HAVING COUNT(*) >= 75
ORDER BY COUNT(*) DESC;

-- ============================================
-- 4. RECENT CONVERSATION ACTIVITY
-- ============================================

-- Last 10 messages per companion with summarization status
SELECT
  c.custom_name as companion,
  conv.role,
  SUBSTRING(conv.content, 1, 50) || '...' as message_preview,
  conv.summarized,
  conv.created_at
FROM conversations conv
JOIN companions c ON c.id = conv.companion_id
WHERE conv.companion_id IS NOT NULL
ORDER BY conv.created_at DESC
LIMIT 10;

-- ============================================
-- 5. MEMORY SYSTEM HEALTH CHECK
-- ============================================

-- Overall system stats
SELECT
  (SELECT COUNT(*) FROM companions WHERE is_active = true) as active_companions,
  (SELECT COUNT(*) FROM conversations WHERE companion_id IS NOT NULL) as total_messages,
  (SELECT COUNT(*) FROM conversations WHERE companion_id IS NOT NULL AND summarized = false) as unsummarized_messages,
  (SELECT COUNT(*) FROM conversations WHERE companion_id IS NOT NULL AND summarized = true) as summarized_messages,
  (SELECT COUNT(*) FROM companion_memories) as total_memories,
  (SELECT SUM(messages_processed) FROM companion_memories) as total_messages_processed,
  (SELECT AVG(messages_processed) FROM companion_memories) as avg_messages_per_memory;

-- ============================================
-- 6. FIND SPECIFIC COMPANION'S MEMORY
-- ============================================

-- Replace COMPANION_ID with actual UUID
-- SELECT
--   cm.memory_text,
--   cm.memory_json,
--   cm.messages_processed,
--   cm.updated_at
-- FROM companion_memories cm
-- WHERE cm.companion_id = 'COMPANION_ID';

-- ============================================
-- 7. AUDIT: MESSAGES NOT LINKED TO COMPANION
-- ============================================

-- Find messages that might be missing companion_id
SELECT
  COUNT(*) as messages_without_companion,
  MIN(created_at) as oldest_message,
  MAX(created_at) as newest_message
FROM conversations
WHERE companion_id IS NULL;

-- ============================================
-- 8. MEMORY CREATION TIMELINE
-- ============================================

-- When were memories created/updated
SELECT
  DATE(updated_at) as date,
  COUNT(*) as memories_updated,
  SUM(messages_processed) as messages_processed_that_day
FROM companion_memories
GROUP BY DATE(updated_at)
ORDER BY date DESC;

-- ============================================
-- 9. VERIFY INDEXES ARE BEING USED
-- ============================================

-- Check if unsummarized index is being used
EXPLAIN ANALYZE
SELECT *
FROM conversations
WHERE user_id = (SELECT id FROM user_profiles LIMIT 1)
  AND companion_id = (SELECT id FROM companions LIMIT 1)
  AND summarized = false
ORDER BY created_at;

-- ============================================
-- 10. CLEANUP: RESET SUMMARIZATION FOR TESTING
-- ============================================

-- CAUTION: Only use for testing! This resets all messages to unsummarized
-- Uncomment to use:
--
-- UPDATE conversations
-- SET summarized = false
-- WHERE companion_id IS NOT NULL;
--
-- DELETE FROM companion_memories;
