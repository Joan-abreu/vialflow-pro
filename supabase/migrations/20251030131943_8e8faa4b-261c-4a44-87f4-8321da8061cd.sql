-- Add qty_per_box field to raw_materials table
ALTER TABLE raw_materials 
ADD COLUMN qty_per_box integer;

COMMENT ON COLUMN raw_materials.qty_per_box IS 'Quantity of units per box (only applicable when unit is box)';