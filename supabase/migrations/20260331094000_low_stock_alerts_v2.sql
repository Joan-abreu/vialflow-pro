-- Migration: Add low stock alerts tracking
-- Description: Adds threshold and last alert timestamp to variants, and a trigger to detect low stock.

-- 1. Add columns to product_variants
ALTER TABLE public.product_variants 
ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS last_low_stock_alert_at TIMESTAMP WITH TIME ZONE;

-- 2. Create function to check alert condition
CREATE OR REPLACE FUNCTION public.should_trigger_low_stock_alert(variant_row JSONB)
RETURNS BOOLEAN AS $$
DECLARE
    v_stock INTEGER;
    v_threshold INTEGER;
    v_last_alert TIMESTAMP WITH TIME ZONE;
    v_id UUID;
BEGIN
    v_id := (variant_row->>'id')::UUID;
    v_stock := (variant_row->>'stock_quantity')::INTEGER;
    v_threshold := (variant_row->>'low_stock_threshold')::INTEGER;
    
    -- Fetch the last alert to avoid stale data
    SELECT last_low_stock_alert_at INTO v_last_alert 
    FROM public.product_variants 
    WHERE id = v_id;

    -- Return true ONLY if stock is low AND (never alerted OR last alert was > 24h ago)
    IF v_stock < v_threshold AND (v_last_alert IS NULL OR v_last_alert < NOW() - INTERVAL '24 hours') THEN
        -- Mark as alerted to prevent spam
        UPDATE public.product_variants SET last_low_stock_alert_at = NOW() WHERE id = v_id;
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
