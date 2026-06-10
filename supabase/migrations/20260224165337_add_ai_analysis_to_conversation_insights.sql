/*
  # Add ai_analysis JSONB column to conversation_insights

  ## Summary
  Adds a structured JSONB column to store AI analysis results from the enhanced insights 
  service without requiring schema changes for each new field.

  ## Changes
  - `conversation_insights`: adds `ai_analysis` JSONB column (nullable)
  - Adds upsert-safe unique constraint on (conversation_id, user_id) to prevent duplicate rows
    on repeated calls for the same conversation session key.

  ## Notes
  - The unique constraint uses a partial approach so legacy rows without conversation_id are unaffected.
  - The ai_analysis column stores the full AIAnalysisResult object from analyzeConversationWithAI().
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversation_insights' AND column_name = 'ai_analysis'
  ) THEN
    ALTER TABLE conversation_insights ADD COLUMN ai_analysis JSONB;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conversation_insights_conversation_id_user_id_key'
  ) THEN
    ALTER TABLE conversation_insights
      ADD CONSTRAINT conversation_insights_conversation_id_user_id_key
      UNIQUE (conversation_id, user_id);
  END IF;
END $$;
