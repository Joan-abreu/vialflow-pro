-- Create restock_notifications table for out-of-stock customer waitlists

CREATE TABLE IF NOT EXISTS public.restock_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'notified', 'cancelled'
    lead_time_days INTEGER DEFAULT 14,
    discount_offered NUMERIC DEFAULT 40,
    notified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fast querying
CREATE INDEX IF NOT EXISTS idx_restock_notifications_variant_status ON public.restock_notifications(variant_id, status);
CREATE INDEX IF NOT EXISTS idx_restock_notifications_email ON public.restock_notifications(email);

-- Enable RLS
ALTER TABLE public.restock_notifications ENABLE ROW LEVEL SECURITY;

-- Allow public insert (customers entering email for restock notification)
DROP POLICY IF EXISTS "Public can insert restock notifications" ON public.restock_notifications;
CREATE POLICY "Public can insert restock notifications" ON public.restock_notifications
    FOR INSERT TO public
    WITH CHECK (true);

-- Allow reading restock notifications
DROP POLICY IF EXISTS "Public can read restock notifications" ON public.restock_notifications;
CREATE POLICY "Public can read restock notifications" ON public.restock_notifications
    FOR SELECT TO public
    USING (true);

-- Allow updating restock notifications (when status changes to notified)
DROP POLICY IF EXISTS "Public can update restock notifications" ON public.restock_notifications;
CREATE POLICY "Public can update restock notifications" ON public.restock_notifications
    FOR UPDATE TO public
    USING (true);
