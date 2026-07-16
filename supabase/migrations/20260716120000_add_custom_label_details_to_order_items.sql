-- Add custom label columns to order_items
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS custom_label_image_url TEXT,
ADD COLUMN IF NOT EXISTS custom_label_instructions TEXT;
