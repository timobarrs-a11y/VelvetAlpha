/*
# Add post_smilie column to community_posts

1. Changes
- Adds `post_smilie` text column to `community_posts` table (nullable)
- This stores a smilie code that represents the mood/tone of the post
- Posts with no smilie selected will have NULL — the feature is opt-in
- No RLS policy changes needed — the column is user-writable like title/body

2. Important Notes
- The column is nullable so existing posts are unaffected
- The smilie code corresponds to an entry in the frontend smilieRegistry
- The bot will also set this field when generating posts
*/
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS post_smilie text;