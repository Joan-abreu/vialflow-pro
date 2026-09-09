-- ==============================================================================
-- Migration: Create Storage Bucket & Policies for Blog Images
-- ==============================================================================

-- Create storage bucket for blog images (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'blog-images',
    'blog-images',
    true,
    10485760, -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 1. Public can view blog images
DROP POLICY IF EXISTS "Public can view blog images" ON storage.objects;
CREATE POLICY "Public can view blog images"
ON storage.objects FOR SELECT
USING (bucket_id = 'blog-images');

-- 2. Users & Admins can upload blog images
DROP POLICY IF EXISTS "Users can upload blog images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload blog images" ON storage.objects;
CREATE POLICY "Users can upload blog images"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'blog-images');

-- 3. Users & Admins can update blog images
DROP POLICY IF EXISTS "Users can update blog images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update blog images" ON storage.objects;
CREATE POLICY "Users can update blog images"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'blog-images');

-- 4. Users & Admins can delete blog images
DROP POLICY IF EXISTS "Users can delete blog images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete blog images" ON storage.objects;
CREATE POLICY "Users can delete blog images"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'blog-images');
