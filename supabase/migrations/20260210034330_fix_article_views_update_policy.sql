/*
  # Fix Article Views Update Policy

  1. Changes
    - Add UPDATE policy for article_views table to support upsert operations
    
  2. Security
    - Users can only update their own article views
    - Maintains authentication and ownership checks
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'article_views' 
    AND policyname = 'Users can update own article views'
  ) THEN
    CREATE POLICY "Users can update own article views"
      ON article_views
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
