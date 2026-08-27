-- ==============================================================================
-- Migration: Affiliate & Promoter Management System
-- ==============================================================================

-- 1. Create Affiliates Table (Promoters / Influencers)
CREATE TABLE IF NOT EXISTS public.affiliates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    social_handle TEXT,
    promo_code TEXT UNIQUE NOT NULL,
    is_custom_rates BOOLEAN DEFAULT false,
    customer_discount_type TEXT DEFAULT 'percentage' CHECK (customer_discount_type IN ('percentage', 'fixed_amount')),
    customer_discount_value NUMERIC DEFAULT 10.00,
    commission_type TEXT DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed_per_order')),
    commission_rate NUMERIC DEFAULT 10.00,
    commission_basis TEXT DEFAULT 'net_subtotal' CHECK (commission_basis IN ('net_subtotal', 'gross_subtotal')),
    payout_method TEXT DEFAULT 'zelle',
    payout_details JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    max_uses INTEGER,
    expires_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Affiliate Payouts Table
CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL,
    transaction_reference TEXT,
    receipt_url TEXT,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Affiliate Commissions Table (Order Attribution)
CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE NOT NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    coupon_code TEXT NOT NULL,
    customer_email TEXT,
    order_subtotal NUMERIC DEFAULT 0,
    customer_discount_amount NUMERIC DEFAULT 0,
    commission_rate NUMERIC DEFAULT 0,
    commission_amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
    payout_id UUID REFERENCES public.affiliate_payouts(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(affiliate_id, order_id)
);

-- Indexes for lightning fast queries & dashboard aggregation
CREATE INDEX IF NOT EXISTS idx_affiliates_promo_code ON public.affiliates(promo_code);
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON public.affiliates(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate_id ON public.affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_order_id ON public.affiliate_commissions(order_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_status ON public.affiliate_commissions(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_affiliate_id ON public.affiliate_payouts(affiliate_id);

-- Enable RLS
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

-- Admins & Promoters RLS Policies
DO $$ 
BEGIN
    -- Admin full access
    DROP POLICY IF EXISTS "Admin full access on affiliates" ON public.affiliates;
    CREATE POLICY "Admin full access on affiliates" ON public.affiliates
        FOR ALL USING (
            EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
            OR auth.jwt() ->> 'role' = 'service_role'
        );

    DROP POLICY IF EXISTS "Admin full access on affiliate_commissions" ON public.affiliate_commissions;
    CREATE POLICY "Admin full access on affiliate_commissions" ON public.affiliate_commissions
        FOR ALL USING (
            EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
            OR auth.jwt() ->> 'role' = 'service_role'
        );

    DROP POLICY IF EXISTS "Admin full access on affiliate_payouts" ON public.affiliate_payouts;
    CREATE POLICY "Admin full access on affiliate_payouts" ON public.affiliate_payouts
        FOR ALL USING (
            EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
            OR auth.jwt() ->> 'role' = 'service_role'
        );
        
    -- Allow reading active affiliates for coupon validation & checkout
    DROP POLICY IF EXISTS "Allow reading active affiliates for validation" ON public.affiliates;
    CREATE POLICY "Allow reading active affiliates for validation" ON public.affiliates
        FOR SELECT USING (status = 'active');

    -- Promoter portal self-service access
    DROP POLICY IF EXISTS "Promoter read own affiliate profile" ON public.affiliates;
    CREATE POLICY "Promoter read own affiliate profile" ON public.affiliates
        FOR SELECT USING (
            user_id = auth.uid() 
            OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
        );

    DROP POLICY IF EXISTS "Promoter update own payout details" ON public.affiliates;
    CREATE POLICY "Promoter update own payout details" ON public.affiliates
        FOR UPDATE USING (
            user_id = auth.uid() 
            OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
        ) WITH CHECK (
            user_id = auth.uid() 
            OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
        );

    DROP POLICY IF EXISTS "Promoter read own commissions" ON public.affiliate_commissions;
    CREATE POLICY "Promoter read own commissions" ON public.affiliate_commissions
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.affiliates a
                WHERE a.id = affiliate_commissions.affiliate_id 
                AND (a.user_id = auth.uid() OR a.email = (SELECT email FROM auth.users WHERE id = auth.uid()))
            )
        );

    DROP POLICY IF EXISTS "Promoter read own payouts" ON public.affiliate_payouts;
    CREATE POLICY "Promoter read own payouts" ON public.affiliate_payouts
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.affiliates a
                WHERE a.id = affiliate_payouts.affiliate_id 
                AND (a.user_id = auth.uid() OR a.email = (SELECT email FROM auth.users WHERE id = auth.uid()))
            )
        );
END $$;

-- 4. Seed Default Affiliate App Settings if they don't exist
INSERT INTO public.app_settings (key, value)
VALUES
    ('affiliate_program_enabled', 'true'),
    ('affiliate_default_customer_discount_type', 'percentage'),
    ('affiliate_default_customer_discount_value', '10'),
    ('affiliate_default_commission_type', 'percentage'),
    ('affiliate_default_commission_rate', '10'),
    ('affiliate_min_payout_threshold', '0'),
    ('affiliate_commission_basis', 'net_subtotal')
ON CONFLICT (key) DO NOTHING;

-- 5. RPC Helper: Record Affiliate Payout
CREATE OR REPLACE FUNCTION public.record_affiliate_payout(
    p_affiliate_id UUID,
    p_amount NUMERIC,
    p_payment_method TEXT,
    p_transaction_reference TEXT DEFAULT NULL,
    p_receipt_url TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_payout_id UUID;
    v_commission RECORD;
    v_remaining_amount NUMERIC := p_amount;
BEGIN
    -- Create payout record
    INSERT INTO public.affiliate_payouts (
        affiliate_id,
        amount,
        payment_method,
        transaction_reference,
        receipt_url,
        notes,
        created_by
    ) VALUES (
        p_affiliate_id,
        p_amount,
        p_payment_method,
        p_transaction_reference,
        p_receipt_url,
        p_notes,
        p_created_by
    ) RETURNING id INTO v_payout_id;

    -- Mark approved commissions as paid up to the payout amount
    FOR v_commission IN 
        SELECT id, commission_amount 
        FROM public.affiliate_commissions 
        WHERE affiliate_id = p_affiliate_id AND status = 'approved'
        ORDER BY created_at ASC
    LOOP
        IF v_remaining_amount >= v_commission.commission_amount THEN
            UPDATE public.affiliate_commissions
            SET status = 'paid', payout_id = v_payout_id, updated_at = now()
            WHERE id = v_commission.id;
            v_remaining_amount := v_remaining_amount - v_commission.commission_amount;
        ELSE
            -- Partial commission coverage if amount is smaller, still mark linked
            UPDATE public.affiliate_commissions
            SET status = 'paid', payout_id = v_payout_id, updated_at = now()
            WHERE id = v_commission.id;
            v_remaining_amount := 0;
            EXIT;
        END IF;
    END LOOP;

    RETURN v_payout_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC Helper: Process Order Affiliate Commission Automatically
CREATE OR REPLACE FUNCTION public.process_order_affiliate_commission(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_coupon_code TEXT;
    v_affiliate RECORD;
    v_program_enabled TEXT := 'true';
    v_commission_basis TEXT := 'net_subtotal';
    v_comm_type TEXT;
    v_comm_rate NUMERIC;
    v_base_amount NUMERIC;
    v_calculated_commission NUMERIC;
    v_existing_id UUID;
    v_coupon_item JSONB;
BEGIN
    -- Fetch order
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Order not found');
    END IF;

    -- Check if order status is cancelled/failed/refunded
    IF v_order.status IN ('cancelled', 'failed', 'refunded') THEN
        UPDATE public.affiliate_commissions
        SET status = 'rejected', updated_at = now()
        WHERE order_id = p_order_id AND status IN ('pending', 'approved');
        RETURN jsonb_build_object('success', true, 'action', 'rejected_due_to_order_status');
    END IF;

    -- Check program enabled in app_settings
    SELECT value INTO v_program_enabled FROM public.app_settings WHERE key = 'affiliate_program_enabled';
    IF v_program_enabled IS NOT NULL AND v_program_enabled = 'false' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Affiliate program is globally disabled');
    END IF;

    -- Extract coupon codes from order
    IF v_order.applied_coupons IS NULL OR jsonb_array_length(v_order.applied_coupons) = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'No coupons applied on order');
    END IF;

    -- Find matching affiliate for any applied coupon
    FOR v_coupon_item IN SELECT * FROM jsonb_array_elements(v_order.applied_coupons)
    LOOP
        IF jsonb_typeof(v_coupon_item) = 'string' THEN
            v_coupon_code := upper(trim(both '"' from v_coupon_item::text));
        ELSIF jsonb_typeof(v_coupon_item) = 'object' AND v_coupon_item->>'code' IS NOT NULL THEN
            v_coupon_code := upper(trim(v_coupon_item->>'code'));
        END IF;

        IF v_coupon_code IS NOT NULL AND length(v_coupon_code) > 0 THEN
            SELECT * INTO v_affiliate FROM public.affiliates WHERE upper(promo_code) = v_coupon_code;
            IF FOUND THEN
                EXIT; -- Found affiliate
            END IF;
        END IF;
    END LOOP;

    IF v_affiliate IS NULL OR v_affiliate.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No matching affiliate found for applied coupon(s)');
    END IF;

    -- Check if affiliate is active
    IF v_affiliate.status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Affiliate is not active');
    END IF;

    -- Check if already processed
    SELECT id INTO v_existing_id FROM public.affiliate_commissions WHERE affiliate_id = v_affiliate.id AND order_id = p_order_id;
    IF v_existing_id IS NOT NULL THEN
        IF v_order.status IN ('paid', 'processing', 'completed', 'shipped', 'delivered') THEN
            UPDATE public.affiliate_commissions SET status = 'approved', updated_at = now() WHERE id = v_existing_id AND status = 'pending';
        END IF;
        RETURN jsonb_build_object('success', true, 'commission_id', v_existing_id, 'status', 'already_exists');
    END IF;

    -- Determine commission rules (custom vs default)
    IF v_affiliate.is_custom_rates THEN
        v_comm_type := COALESCE(v_affiliate.commission_type, 'percentage');
        v_comm_rate := COALESCE(v_affiliate.commission_rate, 10.00);
        v_commission_basis := COALESCE(v_affiliate.commission_basis, 'net_subtotal');
    ELSE
        SELECT value INTO v_comm_type FROM public.app_settings WHERE key = 'affiliate_default_commission_type';
        SELECT value::numeric INTO v_comm_rate FROM public.app_settings WHERE key = 'affiliate_default_commission_rate';
        SELECT value INTO v_commission_basis FROM public.app_settings WHERE key = 'affiliate_commission_basis';
        
        v_comm_type := COALESCE(v_comm_type, 'percentage');
        v_comm_rate := COALESCE(v_comm_rate, 10.00);
        v_commission_basis := COALESCE(v_commission_basis, 'net_subtotal');
    END IF;

    -- Calculate base amount
    IF v_commission_basis = 'gross_subtotal' THEN
        v_base_amount := COALESCE(v_order.subtotal, v_order.total_amount, 0);
    ELSE
        v_base_amount := GREATEST(0, COALESCE(v_order.subtotal, v_order.total_amount, 0) - COALESCE(v_order.product_discount, 0));
    END IF;

    -- Calculate commission amount
    IF v_comm_type = 'fixed_per_order' THEN
        v_calculated_commission := v_comm_rate;
    ELSE
        v_calculated_commission := ROUND((v_base_amount * (v_comm_rate / 100.0)), 2);
    END IF;

    -- Insert commission record
    INSERT INTO public.affiliate_commissions (
        affiliate_id,
        order_id,
        coupon_code,
        customer_email,
        order_subtotal,
        customer_discount_amount,
        commission_rate,
        commission_amount,
        status
    ) VALUES (
        v_affiliate.id,
        p_order_id,
        v_coupon_code,
        v_order.customer_email,
        v_base_amount,
        COALESCE(v_order.product_discount, 0),
        v_comm_rate,
        v_calculated_commission,
        CASE WHEN v_order.status IN ('paid', 'processing', 'completed', 'shipped', 'delivered') THEN 'approved' ELSE 'pending' END
    ) RETURNING id INTO v_existing_id;

    RETURN jsonb_build_object(
        'success', true,
        'commission_id', v_existing_id,
        'affiliate_id', v_affiliate.id,
        'commission_amount', v_calculated_commission,
        'status', CASE WHEN v_order.status IN ('paid', 'processing', 'completed', 'shipped', 'delivered') THEN 'approved' ELSE 'pending' END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
