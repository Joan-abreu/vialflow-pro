-- Add is_archived to products and product_variants tables
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Ensure indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_products_is_archived ON products(is_archived);
CREATE INDEX IF NOT EXISTS idx_product_variants_is_archived ON product_variants(is_archived);
