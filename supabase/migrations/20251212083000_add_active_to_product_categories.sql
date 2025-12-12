-- Add active column to product_categories
ALTER TABLE public.product_categories ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Update existing categories to be active
UPDATE public.product_categories SET active = true WHERE active IS NULL;
