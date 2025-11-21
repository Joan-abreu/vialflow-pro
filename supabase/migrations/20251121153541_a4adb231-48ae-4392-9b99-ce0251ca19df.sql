-- Add is_published column to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false;

-- Set is_published to true for currently active products
UPDATE public.products
SET is_published = true
WHERE is_active = true;

-- Add comment for documentation
COMMENT ON COLUMN public.products.is_published IS 'Whether the product is published and visible to customers';