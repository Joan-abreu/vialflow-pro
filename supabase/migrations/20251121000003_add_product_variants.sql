-- Create product_variants table
CREATE TABLE public.product_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  vial_type_id UUID NOT NULL REFERENCES public.vial_types(id) ON DELETE CASCADE,
  sku TEXT UNIQUE,
  price DECIMAL(10, 2) NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, vial_type_id)
);

-- Enable RLS
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- Create policies for product_variants
CREATE POLICY "Product variants are viewable by everyone"
ON public.product_variants
FOR SELECT
USING (true);

CREATE POLICY "Product variants can be created by authenticated users"
ON public.product_variants
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Product variants can be updated by authenticated users"
ON public.product_variants
FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Product variants can be deleted by authenticated users"
ON public.product_variants
FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_product_variants_updated_at
BEFORE UPDATE ON public.product_variants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add image_url to products table (if not exists)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS category TEXT;

-- Migrate existing product data to variants (if products have price/stock)
-- This will create variants for products that have price and stock_quantity
DO $$
DECLARE
  product_record RECORD;
  vial_10ml_id UUID;
  vial_30ml_id UUID;
BEGIN
  -- Get vial type IDs
  SELECT id INTO vial_10ml_id FROM public.vial_types WHERE size_ml = 10 LIMIT 1;
  SELECT id INTO vial_30ml_id FROM public.vial_types WHERE size_ml = 30 LIMIT 1;
  
  -- Only migrate if columns exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'price'
  ) THEN
    FOR product_record IN 
      SELECT id, price, stock_quantity, is_published 
      FROM public.products 
      WHERE price IS NOT NULL
    LOOP
      -- Create a default variant (10ml) for each existing product
      IF vial_10ml_id IS NOT NULL THEN
        INSERT INTO public.product_variants (product_id, vial_type_id, price, stock_quantity, is_published, sku)
        VALUES (
          product_record.id, 
          vial_10ml_id, 
          product_record.price, 
          COALESCE(product_record.stock_quantity, 0),
          COALESCE(product_record.is_published, false),
          'SKU-' || substring(product_record.id::text, 1, 8) || '-10ML'
        )
        ON CONFLICT (product_id, vial_type_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;
END $$;

-- Add variant_id to order_items (for future orders)
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.product_variants(id);

-- Add comment
COMMENT ON TABLE public.product_variants IS 'Product variants combining products with vial types for e-commerce';
COMMENT ON COLUMN public.product_variants.sku IS 'Stock Keeping Unit - unique identifier for this variant';
