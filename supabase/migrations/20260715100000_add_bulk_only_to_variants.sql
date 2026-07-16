-- Add bulk_only column to product_variants
ALTER TABLE public.product_variants
ADD COLUMN IF NOT EXISTS bulk_only BOOLEAN NOT NULL DEFAULT FALSE;
