
-- Drop existing overly permissive storage policies for proof-cards
DROP POLICY IF EXISTS "Authenticated users can upload proof card images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their proof card images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their proof card images" ON storage.objects;

-- Recreate with user-scoped policies (path: {user_id}/{campaign_id}/{timestamp}.{ext})
CREATE POLICY "Users can upload their own proof card images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'proof-cards'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their own proof card images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'proof-cards'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own proof card images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'proof-cards'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
