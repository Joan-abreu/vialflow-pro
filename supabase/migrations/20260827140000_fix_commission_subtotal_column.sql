-- Fix process_order_affiliate_commission to compute base amount without assuming non-existent 'subtotal' column on orders

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

    -- Calculate base amount using available order columns: total_amount, product_discount, shipping_cost
    IF v_commission_basis = 'gross_subtotal' THEN
        v_base_amount := GREATEST(0, COALESCE(v_order.total_amount, 0) + COALESCE(v_order.product_discount, 0) - COALESCE(v_order.shipping_cost, 0));
    ELSE
        v_base_amount := GREATEST(0, COALESCE(v_order.total_amount, 0) - COALESCE(v_order.shipping_cost, 0));
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
