-- Add pack_size column to product_variants table
ALTER TABLE public.product_variants 
ADD COLUMN pack_size INTEGER NOT NULL DEFAULT 1;

-- Add comment
COMMENT ON COLUMN public.product_variants.pack_size IS 'Number of units in this variant pack (default: 1 for individual)';