-- ==============================================================================
-- Migration: Update Storage Policies for blog-images bucket
-- ==============================================================================

DROP POLICY IF EXISTS "Users can upload blog images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload blog images" ON storage.objects;
CREATE POLICY "Users can upload blog images"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'blog-images');

DROP POLICY IF EXISTS "Users can update blog images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update blog images" ON storage.objects;
CREATE POLICY "Users can update blog images"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'blog-images');

DROP POLICY IF EXISTS "Users can delete blog images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete blog images" ON storage.objects;
CREATE POLICY "Users can delete blog images"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'blog-images');
