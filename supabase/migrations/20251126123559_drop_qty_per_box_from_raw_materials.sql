-- Drop qty_per_box column from raw_materials table
ALTER TABLE raw_materials
DROP COLUMN IF EXISTS qty_per_box;
