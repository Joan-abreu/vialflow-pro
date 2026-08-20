-- Create storage bucket for P2P QR Code images
INSERT INTO storage.buckets (id, name, public)
VALUES ('p2p-qr-codes', 'p2p-qr-codes', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies for p2p-qr-codes
CREATE POLICY "Public can view P2P QR codes"
ON storage.objects FOR SELECT
USING (bucket_id = 'p2p-qr-codes');

CREATE POLICY "Authenticated users can upload P2P QR codes"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'p2p-qr-codes' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update P2P QR codes"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'p2p-qr-codes' 
    AND auth.role() = 'authenticated'
);
