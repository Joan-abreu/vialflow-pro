-- Allow public access to products and vial_types for e-commerce
-- This migration fixes the issue where products are not visible without authentication

-- Drop existing restrictive policy on products
DROP POLICY IF EXISTS "Products are viewable by authenticated users" ON public.products;

-- Create new policy allowing everyone to view published products
CREATE POLICY "Products are viewable by everyone"
ON public.products
FOR SELECT
USING (true);

-- Drop existing restrictive policy on vial_types
DROP POLICY IF EXISTS "Authenticated users can view vial types" ON public.vial_types;

-- Create new policy allowing everyone to view vial types
CREATE POLICY "Vial types are viewable by everyone"
ON public.vial_types
FOR SELECT
USING (true);

-- Note: product_variants already has a public read policy from migration 20251121000003
-- Note: Write/Update/Delete policies remain restricted to authenticated users for security
