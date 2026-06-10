# OpenAI Embedding API Setup Guide

## The Problem

Your chat is failing because the `generate-embedding` edge function returns a 500 error. This edge function uses OpenAI's API to generate embeddings for semantic memory search.

## Root Cause

The `OPENAI_API_KEY` environment variable is not set in your Supabase project, causing the edge function to fail.

## How to Fix

### Step 1: Get an OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (it starts with `sk-`)

### Step 2: Add the Key to Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Project Settings** → **Edge Functions** → **Secrets**
3. Add a new secret:
   - Name: `OPENAI_API_KEY`
   - Value: `sk-your-actual-key-here`
4. Click "Add"

### Step 3: Redeploy the Edge Function

The edge function needs to be redeployed to pick up the new environment variable. You can do this via the Supabase CLI:

```bash
# If you have Supabase CLI installed locally
supabase functions deploy generate-embedding
```

Or through the Supabase dashboard:
1. Go to **Edge Functions** in your Supabase dashboard
2. Find `generate-embedding` function
3. Click the three dots menu → "Redeploy"

### Step 4: Clear Rate Limits (If Needed)

If you're still seeing "Too many requests" errors, run the SQL in `CLEAR_RATE_LIMITS.sql` in your Supabase SQL Editor.

## Alternative: Disable Semantic Memory (Quick Fix)

If you don't want to set up OpenAI, the app will now continue working without semantic memory. The try/catch blocks I added will gracefully handle the failure and your chat will work, just without semantic search of memories.

## What I Fixed

1. **Made embedding failures non-blocking** - Chat no longer stops if embeddings fail
2. **Fixed Co-Author response parsing** - Now handles all response formats
3. **Added better error logging** - Edge function now tells you exactly what's wrong
4. **Created SQL cleanup script** - Easy way to clear rate limits when needed

## Testing

After setting up the OpenAI key:
1. Send a message in chat
2. Check browser console - you should no longer see 500 errors for generate-embedding
3. Chat should work smoothly

Without the OpenAI key:
1. Chat will still work
2. You'll see warnings about semantic memory failing
3. Everything else works normally
