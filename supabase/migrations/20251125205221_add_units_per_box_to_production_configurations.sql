-- Add units_per_box column to production_configurations table
ALTER TABLE production_configurations
ADD COLUMN units_per_box INTEGER;

-- Add comment to explain the column
COMMENT ON COLUMN production_configurations.units_per_box IS 'Number of units that fit in this box (only applicable when raw_material unit is box)';
