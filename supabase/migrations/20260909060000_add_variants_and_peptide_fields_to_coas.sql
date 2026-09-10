-- Migration: Add product variant associations and peptide analytical testing fields to product_coas

ALTER TABLE public.product_coas 
ADD COLUMN IF NOT EXISTS variant_ids uuid[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS coa_type text DEFAULT 'peptide',
ADD COLUMN IF NOT EXISTS target_dosage_mg numeric(10,2),
ADD COLUMN IF NOT EXISTS measured_dosage_mg numeric(10,2),
ADD COLUMN IF NOT EXISTS task_number text,
ADD COLUMN IF NOT EXISTS verification_key text,
ADD COLUMN IF NOT EXISTS verification_url text,
ADD COLUMN IF NOT EXISTS sequence_status text DEFAULT 'Confirmed',
ADD COLUMN IF NOT EXISTS appearance text DEFAULT 'White Lyophilized Powder',
ADD COLUMN IF NOT EXISTS components jsonb DEFAULT '[]'::jsonb;

-- Modify purity_pct to numeric(6,3) to allow 3-decimal precision (e.g., 99.265%)
ALTER TABLE public.product_coas 
ALTER COLUMN purity_pct TYPE numeric(6,3);

-- Create GIN index for fast containment searches on variant_ids
CREATE INDEX IF NOT EXISTS idx_product_coas_variant_ids ON public.product_coas USING GIN (variant_ids);
CREATE INDEX IF NOT EXISTS idx_product_coas_coa_type ON public.product_coas (coa_type);
CREATE INDEX IF NOT EXISTS idx_product_coas_verification_key ON public.product_coas (verification_key);

-- Set coa_type = 'water' for existing water COAs
UPDATE public.product_coas
SET coa_type = 'water'
WHERE benzyl_alcohol_pct IS NOT NULL OR ph_level IS NOT NULL;
