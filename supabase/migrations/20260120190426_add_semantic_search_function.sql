/*
  # Add Semantic Search Database Function

  1. New Functions
    - `search_memories_by_similarity` - Performs vector similarity search
      Uses pgvector's cosine distance operator (<=>)
      Returns memories ranked by semantic similarity
  
  2. Performance
    - Uses the vector index created in previous migration
    - Efficient approximate nearest neighbor search
*/

-- Function to search memories by semantic similarity
CREATE OR REPLACE FUNCTION search_memories_by_similarity(
  query_embedding vector(1536),
  query_user_id uuid,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  memory_type text,
  content text,
  emotional_valence text,
  importance_score int,
  context_tags text[],
  related_messages text[],
  last_referenced timestamptz,
  reference_count int,
  created_at timestamptz,
  updated_at timestamptz,
  embedding vector(1536),
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rm.id,
    rm.user_id,
    rm.memory_type,
    rm.content,
    rm.emotional_valence,
    rm.importance_score,
    rm.context_tags,
    rm.related_messages,
    rm.last_referenced,
    rm.reference_count,
    rm.created_at,
    rm.updated_at,
    rm.embedding,
    1 - (rm.embedding <=> query_embedding) AS similarity
  FROM relationship_memories rm
  WHERE rm.user_id = query_user_id
    AND rm.embedding IS NOT NULL
    AND 1 - (rm.embedding <=> query_embedding) > match_threshold
  ORDER BY rm.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
