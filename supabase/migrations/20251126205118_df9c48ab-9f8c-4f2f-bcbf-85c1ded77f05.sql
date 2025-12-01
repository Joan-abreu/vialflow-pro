-- Add production materials enhancements
-- Add new columns to production_configurations
ALTER TABLE production_configurations
ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'fixed' CHECK (calculation_type IN ('fixed', 'percentage', 'per_box')),
ADD COLUMN IF NOT EXISTS percentage_of_material_id UUID REFERENCES raw_materials(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS percentage_value NUMERIC;

COMMENT ON COLUMN production_configurations.calculation_type IS 'How to calculate quantity: fixed (direct quantity), percentage (% of another material), per_box (one per box)';
COMMENT ON COLUMN production_configurations.percentage_of_material_id IS 'For percentage type: which material to calculate percentage from';
COMMENT ON COLUMN production_configurations.percentage_value IS 'For percentage type: the percentage value (e.g., 70 for 70%)';