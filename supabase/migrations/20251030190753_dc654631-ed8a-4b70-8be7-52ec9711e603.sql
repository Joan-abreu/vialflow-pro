-- Drop existing foreign key constraint
ALTER TABLE public.shipments 
DROP CONSTRAINT IF EXISTS shipments_batch_id_fkey;

-- Add foreign key constraint with CASCADE delete
ALTER TABLE public.shipments
ADD CONSTRAINT shipments_batch_id_fkey 
FOREIGN KEY (batch_id) 
REFERENCES public.production_batches(id) 
ON DELETE CASCADE;