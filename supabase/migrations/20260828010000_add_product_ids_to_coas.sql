-- Add product_ids array to product_coas to allow associating a single COA with multiple products
ALTER TABLE public.product_coas 
ADD COLUMN IF NOT EXISTS product_ids uuid[] DEFAULT '{}';

-- Migrate existing single product_id into product_ids array
UPDATE public.product_coas 
SET product_ids = ARRAY[product_id] 
WHERE product_id IS NOT NULL AND (product_ids IS NULL OR cardinality(product_ids) = 0);

-- Create GIN index for fast containment queries: product_ids @> ARRAY[target_product_id]
CREATE INDEX IF NOT EXISTS idx_product_coas_product_ids ON public.product_coas USING GIN (product_ids);
