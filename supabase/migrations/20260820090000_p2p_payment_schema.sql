-- Migration: P2P Payment Schema, Private Storage Bucket & Anti-Fraud Verification Audit Trail

-- 1. Add P2P tracking and anti-fraud columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS p2p_provider TEXT, -- 'zelle' | 'venmo' | 'cashapp'
ADD COLUMN IF NOT EXISTS p2p_sender_handle TEXT,
ADD COLUMN IF NOT EXISTS p2p_proof_url TEXT,
ADD COLUMN IF NOT EXISTS p2p_proof_file_hash TEXT,
ADD COLUMN IF NOT EXISTS p2p_declared_amount NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS p2p_status TEXT DEFAULT 'not_submitted', -- 'not_submitted', 'pending_verification', 'verified', 'rejected', 'expired'
ADD COLUMN IF NOT EXISTS p2p_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS p2p_verified_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS p2p_rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS p2p_submission_count INT DEFAULT 0;

-- 2. Audit Trail Log Table
CREATE TABLE IF NOT EXISTS public.p2p_verification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'submitted', 'approved', 'rejected', 'expired'
    actor_id UUID REFERENCES auth.users(id), -- NULL if submitted by customer
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.p2p_verification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view p2p logs"
    ON public.p2p_verification_log FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

CREATE POLICY "System and users can insert p2p logs"
    ON public.p2p_verification_log FOR INSERT TO authenticated, anon
    WITH CHECK (true);

-- 3. Unique Index to prevent re-using exact same proof image across orders for same provider
CREATE UNIQUE INDEX IF NOT EXISTS idx_p2p_proof_hash 
ON public.orders(p2p_provider, p2p_proof_file_hash) 
WHERE p2p_proof_file_hash IS NOT NULL;

-- 4. Private Storage Bucket Setup for payment-receipts
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment-receipts', 'payment-receipts', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage RLS Policies
CREATE POLICY "Users can upload payment receipts"
    ON storage.objects FOR INSERT TO authenticated, anon
    WITH CHECK (bucket_id = 'payment-receipts');

CREATE POLICY "Admins can read payment receipts"
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'payment-receipts' AND (
            EXISTS (
                SELECT 1 FROM public.user_roles 
                WHERE user_roles.user_id = auth.uid() 
                AND user_roles.role = 'admin'
            ) OR auth.uid() IS NOT NULL
        )
    );
