-- Migration: Create pending_card_vault table for offline card processing & virtual terminal

CREATE TABLE IF NOT EXISTS public.pending_card_vault (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    encrypted_payload TEXT NOT NULL,
    card_brand TEXT,
    last_4 TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'processed', 'declined', 'purged'
    decline_reason TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pending_card_vault ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins / service role can access vault
CREATE POLICY "Admins can view pending card vault"
    ON public.pending_card_vault
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );

CREATE POLICY "Admins can insert pending card vault"
    ON public.pending_card_vault
    FOR INSERT
    TO authenticated, anon
    WITH CHECK (true);

CREATE POLICY "Admins can update pending card vault"
    ON public.pending_card_vault
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );

CREATE POLICY "Admins can delete pending card vault"
    ON public.pending_card_vault
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );

-- Add index on order_id
CREATE INDEX IF NOT EXISTS idx_pending_card_vault_order_id ON public.pending_card_vault(order_id);
