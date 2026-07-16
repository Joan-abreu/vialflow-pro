-- Add columns for bulk purchases to product_variants
ALTER TABLE public.product_variants
ADD COLUMN IF NOT EXISTS bulk_price DECIMAL(10, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bulk_min_qty INTEGER NOT NULL DEFAULT 100,
ADD COLUMN IF NOT EXISTS bulk_label_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.15;

-- Add box dimension columns to box_configurations
ALTER TABLE public.box_configurations
ADD COLUMN IF NOT EXISTS box_length DECIMAL(10, 2) NOT NULL DEFAULT 12.0,
ADD COLUMN IF NOT EXISTS box_width DECIMAL(10, 2) NOT NULL DEFAULT 12.0,
ADD COLUMN IF NOT EXISTS box_height DECIMAL(10, 2) NOT NULL DEFAULT 12.0,
ADD COLUMN IF NOT EXISTS box_weight DECIMAL(10, 2) NOT NULL DEFAULT 0.5;

-- Add tracking columns to order_items
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS is_bulk BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS with_labels BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS label_fee_applied DECIMAL(10, 2) NOT NULL DEFAULT 0.00;

-- Comment on new columns
COMMENT ON COLUMN public.product_variants.bulk_price IS 'Unit price when purchased in bulk';
COMMENT ON COLUMN public.product_variants.bulk_min_qty IS 'Minimum quantity to qualify for bulk pricing';
COMMENT ON COLUMN public.product_variants.bulk_label_fee IS 'Additional fee per unit to print and place labels';

COMMENT ON COLUMN public.box_configurations.box_length IS 'Box length in inches for shipping calculations';
COMMENT ON COLUMN public.box_configurations.box_width IS 'Box width in inches for shipping calculations';
COMMENT ON COLUMN public.box_configurations.box_height IS 'Box height in inches for shipping calculations';
COMMENT ON COLUMN public.box_configurations.box_weight IS 'Weight of the empty box in lbs';

COMMENT ON COLUMN public.order_items.is_bulk IS 'Whether this line item was purchased at bulk volume';
COMMENT ON COLUMN public.order_items.with_labels IS 'Whether labels were requested and applied to this bulk item';
COMMENT ON COLUMN public.order_items.label_fee_applied IS 'The label fee per unit applied to this order item';
