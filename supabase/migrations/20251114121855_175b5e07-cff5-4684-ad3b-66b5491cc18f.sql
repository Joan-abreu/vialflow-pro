-- Add waste tracking fields to production_batches table
ALTER TABLE production_batches
ADD COLUMN waste_quantity integer DEFAULT 0,
ADD COLUMN waste_notes text;

-- Add comment for clarity
COMMENT ON COLUMN production_batches.waste_quantity IS 'Number of units lost/broken during production';
COMMENT ON COLUMN production_batches.waste_notes IS 'Details about what materials were wasted (vials, bottles, caps, labels, etc.)';