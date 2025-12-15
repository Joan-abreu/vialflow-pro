-- Add pricing breakdown columns to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_cost numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tax numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_service text;

-- Update RLS policies if needed (usually not needed for new columns if row access is already defined)
