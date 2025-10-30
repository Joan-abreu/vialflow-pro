-- Add sale_type column to production_batches
ALTER TABLE public.production_batches 
ADD COLUMN sale_type text NOT NULL DEFAULT 'individual' CHECK (sale_type IN ('pack', 'individual'));