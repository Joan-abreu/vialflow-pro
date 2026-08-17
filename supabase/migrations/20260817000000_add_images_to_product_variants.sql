-- Add images text array column to product_variants table for variant photo gallery
ALTER TABLE public.product_variants
ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.product_variants.images IS 'List of image URLs for the variant gallery';
