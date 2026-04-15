-- Add is_private flag to product_categories
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;

-- Add is_private flag to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;

-- Add can_view_private_products flag to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS can_view_private_products BOOLEAN DEFAULT FALSE;

-- Optional: You may want to drop existing RLS policies on products/categories if they conflict
-- For now, we rely on the application layer, but adding strict RLS is recommended for full security.

-- Example RLS addition for strict security (if public access was previously entirely open)
-- Assuming you have a policy like "Allow public read access" on products.
-- To make it bulletproof:
-- CREATE POLICY "Allow read access for public if not private or user has permission" ON products
--     FOR SELECT USING (
--         is_private = false OR 
--         (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND can_view_private_products = true))
--     );
