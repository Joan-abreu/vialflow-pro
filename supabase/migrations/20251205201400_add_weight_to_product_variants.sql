-- Add weight column to product_variants table
ALTER TABLE product_variants
ADD COLUMN weight numeric DEFAULT 0;

COMMENT ON COLUMN product_variants.weight IS 'Weight of the product variant in lbs';
