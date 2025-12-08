-- Add max_online_quantity column to product_variants table
-- This allows setting independent limits for online sales, decoupled from physical inventory

ALTER TABLE product_variants 
ADD COLUMN IF NOT EXISTS max_online_quantity INTEGER DEFAULT 100;

-- Add comment to explain the column
COMMENT ON COLUMN product_variants.max_online_quantity IS 'Maximum quantity that can be purchased online. NULL means unlimited.';
