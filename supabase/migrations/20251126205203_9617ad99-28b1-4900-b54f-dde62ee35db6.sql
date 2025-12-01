-- Add application_basis and usage_uom_id to production_configurations
ALTER TABLE production_configurations
ADD COLUMN IF NOT EXISTS application_basis TEXT CHECK (application_basis IN ('per_pack', 'per_inner_unit', 'per_batch', 'per_volume_of_inner_unit', 'per_weight_of_inner_unit')),
ADD COLUMN IF NOT EXISTS usage_uom_id UUID REFERENCES units_of_measurement(id),
ADD COLUMN IF NOT EXISTS quantity_usage NUMERIC;

COMMENT ON COLUMN production_configurations.application_basis IS 'Defines how the material is consumed: per_pack, per_inner_unit, per_batch, etc.';
COMMENT ON COLUMN production_configurations.usage_uom_id IS 'The unit of measurement used for consumption (e.g. mL, grams)';
COMMENT ON COLUMN production_configurations.quantity_usage IS 'The quantity consumed in the Usage UOM';

-- Migrate existing data
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