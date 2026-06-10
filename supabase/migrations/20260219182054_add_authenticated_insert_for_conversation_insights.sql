/*
  # Allow authenticated users to insert their own conversation insights

  Previously only service_role could insert into conversation_insights.
  The insights processing happens client-side after each AI response, so
  authenticated users need INSERT permission for their own rows.

  Changes:
  - Add INSERT policy for authenticated users (can only insert rows where user_id = auth.uid())
*/

CREATE POLICY "Users can insert their own conversation insights"
  ON conversation_insights
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
