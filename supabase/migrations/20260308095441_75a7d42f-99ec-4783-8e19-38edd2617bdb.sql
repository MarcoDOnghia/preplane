
-- Make the CVs bucket private (no public CDN access)
UPDATE storage.buckets SET public = false WHERE id = 'cvs';

-- Drop the blanket public-read policy
DROP POLICY IF EXISTS "Public read access for CVs" ON storage.objects;
