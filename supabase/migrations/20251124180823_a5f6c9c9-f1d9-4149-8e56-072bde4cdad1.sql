-- Drop the existing unique constraint on SKU
ALTER TABLE public.product_variants DROP CONSTRAINT IF EXISTS product_variants_sku_key;

-- Create a unique partial index that allows multiple NULLs but prevents duplicate non-NULL SKUs
CREATE UNIQUE INDEX product_variants_sku_unique_idx 
ON public.product_variants (sku) 
WHERE sku IS NOT NULL;

COMMENT ON INDEX product_variants_sku_unique_idx IS 'Ensures SKU uniqueness while allowing multiple NULL values';