-- Add application_basis and usage_uom_id to production_configurations

-- Create enum-like check constraint for application_basis
ALTER TABLE production_configurations
ADD COLUMN IF NOT EXISTS application_basis TEXT CHECK (application_basis IN ('per_pack', 'per_inner_unit', 'per_batch', 'per_volume_of_inner_unit', 'per_weight_of_inner_unit')),
ADD COLUMN IF NOT EXISTS usage_uom_id UUID REFERENCES units_of_measurement(id),
ADD COLUMN IF NOT EXISTS quantity_usage NUMERIC;

COMMENT ON COLUMN production_configurations.application_basis IS 'Defines how the material is consumed: per_pack, per_inner_unit, per_batch, etc.';
COMMENT ON COLUMN production_configurations.usage_uom_id IS 'The unit of measurement used for consumption (e.g. mL, grams)';
COMMENT ON COLUMN production_configurations.quantity_usage IS 'The quantity consumed in the Usage UOM';

-- Migrate existing data (best effort)
-- If application_type was 'per_unit', map to 'per_inner_unit' (assuming unit meant inner unit usually, or per_pack? The user said "Pack quantity -> cantidad interna del pack (ejemplo: 2 viales)" and "Production unit -> lo que produces realmente (el pack)")
-- If the current system was "per unit" meaning "per vial", then it maps to 'per_inner_unit'.
-- If it meant "per pack", it maps to 'per_pack'.
-- Given the user's example: "Material 1: 30mL Vial, basis: per_inner_unit", it seems 'per_unit' likely meant 'per_inner_unit' in the old context if they were thinking about vials.
-- However, let's default to 'per_inner_unit' for 'per_unit' and 'per_batch' for 'per_batch'.

UPDATE production_configurations
SET application_basis = CASE 
    WHEN application_type = 'per_unit' THEN 'per_inner_unit'
    WHEN application_type = 'per_batch' THEN 'per_batch'
    ELSE 'per_inner_unit'
END
WHERE application_basis IS NULL;

-- Set default quantity_usage from quantity_per_unit
UPDATE production_configurations
SET quantity_usage = quantity_per_unit
WHERE quantity_usage IS NULL;
