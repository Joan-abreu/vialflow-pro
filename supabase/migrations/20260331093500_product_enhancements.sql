-- Add images text array for product carousel
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

-- Add dimensions to product_variants for shipping calculation
ALTER TABLE public.product_variants
ADD COLUMN IF NOT EXISTS dimension_length NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS dimension_width NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS dimension_height NUMERIC DEFAULT 0;

-- Comment for clarity
COMMENT ON COLUMN public.products.images IS 'List of image URLs for the product carousel.';
COMMENT ON COLUMN public.product_variants.dimension_length IS 'Length of the product variant in inches.';
COMMENT ON COLUMN public.product_variants.dimension_width IS 'Width of the product variant in inches.';
COMMENT ON COLUMN public.product_variants.dimension_height IS 'Height of the product variant in inches.';
