-- Make CVs bucket private
UPDATE storage.buckets SET public = false WHERE id = 'cvs';

-- Drop the public read policy
DROP POLICY IF EXISTS "Public read access for CVs" ON storage.objects;