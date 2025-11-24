-- Add pack_size column to product_variants table
ALTER TABLE product_variants
ADD COLUMN pack_size INTEGER NOT NULL DEFAULT 1;

-- Add check constraint to ensure pack_size is at least 1
ALTER TABLE product_variants
ADD CONSTRAINT pack_size_positive CHECK (pack_size > 0);
