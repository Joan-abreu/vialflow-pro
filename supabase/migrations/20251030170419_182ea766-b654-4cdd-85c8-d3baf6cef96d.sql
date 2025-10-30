-- Add dimension columns to raw_materials table for boxes
ALTER TABLE raw_materials
ADD COLUMN dimension_length_in numeric,
ADD COLUMN dimension_width_in numeric,
ADD COLUMN dimension_height_in numeric;