/*
  # Add Companion Memory System - Phase 1

  ## Overview
  This migration creates the memory system for managing conversation history efficiently.
  It enables AI companions to maintain context across conversations while managing token limits.

  ## 1. New Tables
    - `companion_memories`
      - `id` (uuid, primary key) - Unique memory record ID
      - `user_id` (uuid, foreign key) - References auth.users
      - `companion_id` (uuid, foreign key) - References companions table
      - `memory_json` (jsonb) - Structured memory data with user facts, emotions, relationships
      - `memory_text` (text) - Natural language summary for AI context injection
      - `messages_processed` (int) - Count of messages included in this memory
      - `last_message_id` (uuid) - Last message that was summarized
      - `created_at` (timestamptz) - When memory was first created
      - `updated_at` (timestamptz) - Last update timestamp
      - UNIQUE constraint on (user_id, companion_id)

  ## 2. Changes to Existing Tables
    - `conversations`
      - Add `summarized` (boolean) - Whether this message has been processed into memory
      - Add index on unsummarized messages for efficient queries

  ## 3. Security
    - Enable RLS on `companion_memories` table
    - Users can only access their own memories
    - Memories are tied to specific user-companion pairs

  ## 4. Key Features
    - Stores both structured JSON and natural prose versions of memories
    - Tracks which messages have been summarized to prevent duplication
    - Efficient indexing for memory lookups and unsummarized message queries
    - Automatic timestamp tracking for memory updates
*/

-- Create companion_memories table
CREATE TABLE IF NOT EXISTS companion_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id UUID NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
  memory_json JSONB NOT NULL DEFAULT '{}',
  memory_text TEXT NOT NULL DEFAULT '',
  messages_processed INT NOT NULL DEFAULT 0,
  last_message_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, companion_id)
);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_companion_memories_user ON companion_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_companion_memories_lookup ON companion_memories(user_id, companion_id);

-- Enable RLS on companion_memories
ALTER TABLE companion_memories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for companion_memories
CREATE POLICY "Users can view own companion memories"
  ON companion_memories FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own companion memories"
  ON companion_memories FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own companion memories"
  ON companion_memories FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own companion memories"
  ON companion_memories FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add summarized column to conversations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'summarized'
  ) THEN
    ALTER TABLE conversations ADD COLUMN summarized BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- Add index for unsummarized messages (used frequently for memory processing)
CREATE INDEX IF NOT EXISTS idx_conversations_unsummarized 
  ON conversations(user_id, companion_id, created_at) 
  WHERE summarized = FALSE;