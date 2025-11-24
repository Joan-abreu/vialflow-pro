-- Add image_url column to product_variants table
ALTER TABLE public.product_variants 
ADD COLUMN image_url TEXT;

-- Add comment
COMMENT ON COLUMN public.product_variants.image_url IS 'Optional image URL specific to this variant';