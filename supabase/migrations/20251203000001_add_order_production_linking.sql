-- Add order-production linking and email support
-- This migration adds columns to support order workflow with email notifications and production batch creation

-- Add order_id to production_batches to link batches to customer orders
ALTER TABLE public.production_batches
ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;

-- Add variant_id to production_batches to support variant-based production
ALTER TABLE public.production_batches
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL;

-- Add customer_email to orders for email notifications
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS customer_email TEXT;

-- Add sent_to_production flag to track if order has been converted to production
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS sent_to_production BOOLEAN NOT NULL DEFAULT false;

-- Add timestamp for when order was sent to production
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS sent_to_production_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster queries on order_id in production_batches
CREATE INDEX IF NOT EXISTS idx_production_batches_order_id ON public.production_batches(order_id);

-- Add index for faster queries on variant_id in production_batches
CREATE INDEX IF NOT EXISTS idx_production_batches_variant_id ON public.production_batches(variant_id);

-- Add index for faster queries on sent_to_production status
CREATE INDEX IF NOT EXISTS idx_orders_sent_to_production ON public.orders(sent_to_production);

-- Add index for faster queries on order status
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- Add comment
COMMENT ON COLUMN public.production_batches.order_id IS 'Links production batch to customer order (NULL for internal production)';
COMMENT ON COLUMN public.production_batches.variant_id IS 'Product variant being produced in this batch';
COMMENT ON COLUMN public.orders.customer_email IS 'Customer email for order notifications';
COMMENT ON COLUMN public.orders.sent_to_production IS 'Whether this order has been converted to production batches';
COMMENT ON COLUMN public.orders.sent_to_production_at IS 'Timestamp when order was sent to production';
