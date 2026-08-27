-- Add payment_intent_id to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;
