-- Update application_type to support 'per_box' option
ALTER TABLE public.vial_type_materials
DROP CONSTRAINT IF EXISTS vial_type_materials_application_type_check;

ALTER TABLE public.vial_type_materials
ADD CONSTRAINT vial_type_materials_application_type_check 
CHECK (application_type IN ('per_unit', 'per_pack', 'per_box'));

COMMENT ON COLUMN public.vial_type_materials.application_type IS 'Indicates how the material is consumed: per_unit (each individual product), per_pack (one per pack), or per_box (one per shipment box)';