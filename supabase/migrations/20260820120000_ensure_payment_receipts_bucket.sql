-- Ensure payment-receipts storage bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('payment-receipts', 'payment-receipts', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage Policies
DROP POLICY IF EXISTS "Authenticated users can upload payment receipts" ON storage.objects;
CREATE POLICY "Authenticated users can upload payment receipts" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'payment-receipts');

DROP POLICY IF EXISTS "Anon users can upload payment receipts" ON storage.objects;
CREATE POLICY "Anon users can upload payment receipts" ON storage.objects
    FOR INSERT TO anon
    WITH CHECK (bucket_id = 'payment-receipts');

DROP POLICY IF EXISTS "Admins can view payment receipts" ON storage.objects;
CREATE POLICY "Admins can view payment receipts" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'payment-receipts');
