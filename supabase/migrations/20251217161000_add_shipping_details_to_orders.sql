ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS shipping_service_code text,
ADD COLUMN IF NOT EXISTS shipping_carrier text;
