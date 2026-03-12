-- Make the cvs bucket private (remove public access)
UPDATE storage.buckets SET public = false WHERE id = 'cvs';

-- Drop the dangerous public read policy
DROP POLICY IF EXISTS "Public read access for CVs" ON storage.objects;

-- Note: The existing authenticated policies remain intact:
-- - "Users can upload their own CVs"
-- - "Users can read their own CVs"  
-- - "Users can delete their own CVs"