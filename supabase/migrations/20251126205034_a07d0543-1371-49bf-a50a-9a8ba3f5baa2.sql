-- Drop vial_type_id from production_batches
ALTER TABLE production_batches
DROP COLUMN IF EXISTS vial_type_id CASCADE;