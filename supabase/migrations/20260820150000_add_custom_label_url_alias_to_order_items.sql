-- Migration: Add custom_label_url and unit_price columns to order_items table
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS custom_label_url TEXT,
ADD COLUMN IF NOT EXISTS custom_label_image_url TEXT,
ADD COLUMN IF NOT EXISTS custom_label_instructions TEXT,
ADD COLUMN IF NOT EXISTS unit_price NUMERIC,
ADD COLUMN IF NOT EXISTS price_at_time NUMERIC;
