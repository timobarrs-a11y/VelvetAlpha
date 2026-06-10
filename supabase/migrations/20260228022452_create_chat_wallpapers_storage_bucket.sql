/*
  # Create Chat Wallpapers Storage Bucket

  ## Summary
  Creates a public Supabase Storage bucket for storing user-uploaded and
  AI-generated chat wallpaper images.

  ## Bucket
  - Name: `chat-wallpapers`
  - Public: true (images are served publicly via URL)
  - File size limit: 10MB per file
  - Allowed MIME types: image/jpeg, image/png, image/webp, image/gif

  ## Security
  - Users can only upload to their own folder (path: wallpapers/{user_id}/...)
  - Users can read all wallpapers (public bucket)
  - Users can delete only their own wallpapers
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-wallpapers',
  'chat-wallpapers',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload their own wallpapers"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-wallpapers'
    AND (storage.foldername(name))[1] = 'wallpapers'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "Anyone can view wallpapers"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'chat-wallpapers');

CREATE POLICY "Users can delete their own wallpapers"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-wallpapers'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
