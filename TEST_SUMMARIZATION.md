# Summarization System Test Guide

## Test Setup

To test the summarization system without sending 75 messages, temporarily lower the threshold:

### Step 1: Modify threshold for testing

Edit `src/services/memoryService.ts` line 117:

```typescript
// BEFORE (production):
const unsummarized = await getUnsummarizedMessages(userId, companionId, 75);

// AFTER (for testing):
const unsummarized = await getUnsummarizedMessages(userId, companionId, 5);
```

### Step 2: Send test messages

1. Open the app and go to a companion chat
2. Send 6 messages back and forth (3 user messages, 3 assistant responses)
3. Wait ~5 seconds for background job to complete

### Step 3: Verify summarization

Run these SQL queries:

```sql
-- Check if messages were marked as summarized
SELECT COUNT(*), summarized
FROM conversations
WHERE companion_id IS NOT NULL
GROUP BY summarized;

-- Check if memory was created
SELECT
  user_id,
  companion_id,
  messages_processed,
  LENGTH(memory_text) as memory_length,
  created_at,
  updated_at
FROM companion_memories
ORDER BY updated_at DESC
LIMIT 1;

-- View the actual memory text
SELECT
  memory_text,
  memory_json
FROM companion_memories
ORDER BY updated_at DESC
LIMIT 1;
```

### Step 4: Test memory injection

1. Send another message in the same chat
2. Check browser console for log line:
   ```
   Loaded companion memory: X messages processed
   ```
3. The AI's response should show awareness of conversation history

### Step 5: Restore production threshold

Change line 117 back to:

```typescript
const unsummarized = await getUnsummarizedMessages(userId, companionId, 75);
```

## Expected Results

✅ After 6 messages:
- `summarized` column = true for those messages
- New row in `companion_memories` table
- `messages_processed` = 6 (or however many were summarized)
- `memory_text` contains prose summary (200-400 words)
- `memory_json` contains structured data

✅ On next message:
- Console shows memory loaded
- AI maintains context from previous conversation
- No duplicate summarization (only new unsummarized messages)

## Troubleshooting

### If summarization doesn't trigger:
- Check browser console for errors
- Check Supabase Edge Functions logs for `summarize-memory`
- Verify ANTHROPIC_API_KEY is set in Supabase Edge Function secrets

### If memory isn't injected:
- Check that `getCompanionMemory()` returns data
- Verify console shows "Loaded companion memory"
- Check system prompt includes `[COMPANION MEMORY]` section

### If messages aren't marked as summarized:
- Check the `markMessagesSummarized()` function
- Verify the edge function completes successfully
- Check for SQL errors in edge function logs
