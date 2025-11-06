-- Add application_type field to vial_type_materials table
-- This indicates whether the material is consumed per unit or per pack
ALTER TABLE public.vial_type_materials
ADD COLUMN application_type text NOT NULL DEFAULT 'per_unit' CHECK (application_type IN ('per_unit', 'per_pack'));

COMMENT ON COLUMN public.vial_type_materials.application_type IS 'Indicates how the material is consumed: per_unit (each individual product) or per_pack (one per pack regardless of pack size)';