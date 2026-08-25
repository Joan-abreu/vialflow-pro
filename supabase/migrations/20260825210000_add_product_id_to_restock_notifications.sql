-- Add product_id and user_id columns to restock_notifications and change discount_offered to text

ALTER TABLE public.restock_notifications 
    ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.restock_notifications 
    ALTER COLUMN discount_offered TYPE TEXT USING discount_offered::text;
