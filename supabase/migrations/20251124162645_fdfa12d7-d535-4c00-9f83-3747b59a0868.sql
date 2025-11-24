-- Add sale_type and default_pack_size to products table
ALTER TABLE public.products 
ADD COLUMN sale_type TEXT NOT NULL DEFAULT 'individual',
ADD COLUMN default_pack_size INTEGER;

-- Add constraint to ensure pack_size is set when sale_type is 'pack'
ALTER TABLE public.products 
ADD CONSTRAINT check_pack_size 
CHECK (
  (sale_type = 'individual' AND default_pack_size IS NULL) OR 
  (sale_type = 'pack' AND default_pack_size > 0)
);

-- Add comment for clarity
COMMENT ON COLUMN public.products.sale_type IS 'Type of sale: individual or pack';
COMMENT ON COLUMN public.products.default_pack_size IS 'Number of units in pack if sale_type is pack';