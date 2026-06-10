/*
  # Add Semantic Memory System with Vector Embeddings

  1. Changes
    - Enable pgvector extension for semantic similarity search
    - Add embedding column to relationship_memories table (1536 dimensions for OpenAI embeddings)
    - Create index for fast vector similarity searches
    - Add memory_clusters table for grouping related memories
    - Add temporal_chains table for tracking sequences of events

  2. New Tables
    - `memory_clusters`
      - Groups semantically similar memories together
      - Tracks cluster themes and summaries
    
    - `temporal_chains`
      - Tracks sequences of related events over time
      - Links memories in chronological narrative chains

  3. Performance
    - Vector index using ivfflat for fast approximate nearest neighbor search
    - Indexes on foreign keys for efficient joins

  4. Security
    - RLS enabled on all new tables
    - Users can only access their own memory data
*/

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to existing relationship_memories table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'relationship_memories' AND column_name = 'embedding'
  ) THEN
    ALTER TABLE relationship_memories ADD COLUMN embedding vector(1536);
  END IF;
END $$;

-- Create vector similarity index for fast searches
DROP INDEX IF EXISTS relationship_memories_embedding_idx;
CREATE INDEX relationship_memories_embedding_idx ON relationship_memories 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create memory clusters table
CREATE TABLE IF NOT EXISTS memory_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cluster_theme text NOT NULL,
  cluster_summary text NOT NULL,
  memory_ids uuid[] DEFAULT '{}',
  emotional_tone text,
  importance_score integer DEFAULT 5,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE memory_clusters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memory clusters"
  ON memory_clusters FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memory clusters"
  ON memory_clusters FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own memory clusters"
  ON memory_clusters FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own memory clusters"
  ON memory_clusters FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create temporal chains table
CREATE TABLE IF NOT EXISTS temporal_chains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  chain_topic text NOT NULL,
  memory_sequence uuid[] DEFAULT '{}',
  narrative_summary text,
  start_date timestamptz NOT NULL,
  last_updated timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE temporal_chains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own temporal chains"
  ON temporal_chains FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own temporal chains"
  ON temporal_chains FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own temporal chains"
  ON temporal_chains FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own temporal chains"
  ON temporal_chains FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS memory_clusters_user_id_idx ON memory_clusters(user_id);
CREATE INDEX IF NOT EXISTS temporal_chains_user_id_idx ON temporal_chains(user_id);
CREATE INDEX IF NOT EXISTS temporal_chains_active_idx ON temporal_chains(user_id, is_active) WHERE is_active = true;
