-- Add pack_quantity column to production_batches
ALTER TABLE public.production_batches 
ADD COLUMN pack_quantity integer DEFAULT 2;