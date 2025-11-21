-- Add new columns to products table
ALTER TABLE public.products if not exists
ADD COLUMN price numeric DEFAULT 0,
ADD COLUMN image_url text,
ADD COLUMN category text,
ADD COLUMN stock_quantity integer DEFAULT 0;