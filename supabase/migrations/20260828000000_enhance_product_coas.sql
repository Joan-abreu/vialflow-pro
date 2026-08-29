-- Enhance product_coas table with lab_name and is_featured
ALTER TABLE public.product_coas 
ADD COLUMN IF NOT EXISTS lab_name TEXT DEFAULT '3rd Party Accredited US Lab',
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

-- Create indices for performant queries
CREATE INDEX IF NOT EXISTS idx_product_coas_product_active ON public.product_coas(product_id, is_active);
CREATE INDEX IF NOT EXISTS idx_product_coas_batch_number ON public.product_coas(batch_number);
