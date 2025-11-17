-- Add units_in_progress column to production_batches table
ALTER TABLE public.production_batches
ADD COLUMN units_in_progress integer DEFAULT 0;