
-- Add restriction columns to coupons table
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS one_use_per_user BOOLEAN DEFAULT true;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS restricted_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Retroactively set all existing coupons to be single-use per customer
UPDATE public.coupons SET one_use_per_user = true WHERE one_use_per_user IS NULL OR one_use_per_user = false;

-- Add index to speed up coupon lookup in orders
-- We frequently check if a user used a specific coupon in the orders table
-- The orders table already has applied_coupons JSONB
-- For performance, we can create a GIN index on applied_coupons if not already present
CREATE INDEX IF NOT EXISTS idx_orders_applied_coupons ON public.orders USING GIN (applied_coupons);
