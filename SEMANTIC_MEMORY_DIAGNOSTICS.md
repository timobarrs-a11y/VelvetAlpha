# Semantic Memory Diagnostics Guide

## How to Use

Navigate to `/debug-semantic` to access the diagnostic tool.

This tool runs 6 comprehensive tests to verify the semantic memory system is working correctly.

## Tests Performed

### 1. Authentication ✓
- Verifies you're logged in
- Shows current user email

### 2. Embedding Generation 🧠
**What it tests:** Can the system generate vector embeddings from text?

**Success** = Shows actual numeric values (dimensions: 1536)
```json
{
  "dimensions": 1536,
  "sampleValues": ["0.0234", "-0.1567", "0.0891", ...],
  "duration": "234ms"
}
```

**Warning** = Returns zero vectors (OpenAI API key not configured)
```json
{
  "dimensions": 1536,
  "note": "System will fall back to keyword search"
}
```
This is SAFE — the app still works, just uses keyword matching instead of semantic similarity.

**Error** = Edge function failed completely

### 3. Memory Storage 📁
**What it tests:** Are memories being saved to the database?

Shows:
- Total memory count
- Breakdown by type (user_fact, emotional_context, etc.)
- Lists your actual stored memories

If you see "No memories stored yet", chat with your companion to generate some!

### 4. Semantic Search 🔍
**What it tests:** Can the system find relevant memories using AI similarity?

**Success** = Found matches with similarity scores (0.0-1.0)
```json
{
  "matches": [
    {
      "similarity": "0.847",
      "content": "I work as a software engineer at...",
      "type": "user_fact"
    }
  ]
}
```

**Warning** = No matches found (will use keyword search instead)

### 5. Keyword Fallback 🎯
**What it tests:** Does the backup keyword search work?

This ALWAYS needs to work — it's the safety net when semantic search is unavailable.

### 6. RPC Function 🔧
**What it tests:** Is the database function `search_memories_by_similarity` accessible?

Verifies the Postgres RPC call works correctly.

---

## Interpreting Results

### ✅ All Green (Success)
**Semantic memory is fully operational!**

Embeddings are being generated correctly, semantic search is working, and the system is using AI-powered memory retrieval.

### ⚠️ Yellow Warnings
**App is working, using fallbacks**

The most common scenario:
- Embeddings return zero vectors (OpenAI API key not set)
- Semantic search finds no matches
- System automatically uses keyword-based search instead

**This is perfectly fine for development/testing.** The app functions identically from the user's perspective.

### ❌ Red Errors
**Something is broken**

If you see errors in:
- **Memory Storage**: Database RLS policies may be blocking writes
- **Keyword Fallback**: Critical issue — memories can't be retrieved at all
- **RPC Function**: Database migration may not have been applied

---

## How to Fix Common Issues

### Zero Vector Embeddings

**Cause:** `OPENAI_API_KEY` not configured in Supabase Edge Function secrets

**To Enable Semantic Memory:**
1. Get an OpenAI API key from https://platform.openai.com/api-keys
2. In Supabase Dashboard → Edge Functions → Secrets
3. Add `OPENAI_API_KEY` = `sk-...your key...`
4. Redeploy the `generate-embedding` function

**Cost:** ~$0.0001 per embedding (extremely cheap)

### No Memories Found

**Cause:** You haven't chatted with your companion yet

**Solution:** Have a conversation! The system automatically extracts memories when you mention:
- Personal facts ("My name is...", "I work at...")
- Emotions ("I'm feeling happy", "I'm worried about...")
- Preferences ("I love pizza", "I hate mornings")
- Milestones ("I got the job!", "Finally graduated")

### RPC Function Fails

**Cause:** Database migration not applied

**Solution:** Run the semantic memory migration:
```sql
-- Ensure the search function exists
SELECT * FROM pg_proc WHERE proname = 'search_memories_by_similarity';
```

---

## Testing Workflow

1. **First Visit** (No Memories Yet)
   - ✅ Authentication works
   - ⚠️ Embeddings: zero vectors (no OpenAI key)
   - ⚠️ Memory Storage: 0 memories
   - ⚠️ Semantic Search: no matches
   - ✅ Keyword Fallback: ready
   - ✅ RPC Function: accessible

2. **After Chatting** (Memories Created)
   - ✅ Authentication works
   - ⚠️ Embeddings: still zero vectors
   - ✅ Memory Storage: 5-10+ memories
   - ⚠️ Semantic Search: no semantic matches (falls back to keyword)
   - ✅ Keyword Fallback: finds relevant memories
   - ✅ RPC Function: accessible

3. **After Adding OpenAI Key** (Full Semantic)
   - ✅ Authentication works
   - ✅ Embeddings: real vectors generated
   - ✅ Memory Storage: memories with embeddings
   - ✅ Semantic Search: finds matches with 0.7+ similarity
   - ✅ Keyword Fallback: still works as backup
   - ✅ RPC Function: accessible

---

## Understanding the Query Test

Change the test query to match things you've told your companion:

**Example Queries:**
- "Tell me about my job" → Should match work-related memories
- "How am I feeling today?" → Should match emotional memories
- "What do I like?" → Should match preference memories
- "My name" → Should match name/personal facts

The similarity scores (0.0-1.0) show how relevant each memory is:
- **0.9-1.0**: Nearly identical
- **0.7-0.9**: Highly relevant
- **0.5-0.7**: Somewhat related
- **<0.5**: Not very relevant (filtered out)

---

## Quick Health Check

**Is semantic memory working?**

✅ **YES** if:
- Embedding test shows real numbers (not all zeros)
- Semantic search returns matches with similarity scores
- Duration < 500ms for searches

⚠️ **FALLBACK MODE** if:
- Embeddings return zero vectors
- Semantic search finds no matches
- Keyword fallback returns results

❌ **BROKEN** if:
- Keyword fallback fails
- RPC function errors
- Can't store/retrieve memories at all

---

## Pro Tips

1. **Run this after every new conversation** to see new memories appear
2. **Try different queries** to understand what memories are stored
3. **Check similarity scores** to see if semantic matching is working
4. **Watch the duration** — semantic search should be fast (<500ms)
5. **Compare results** before/after adding OpenAI API key to see the difference

The diagnostic page updates in real-time and shows exactly what's happening under the hood!
