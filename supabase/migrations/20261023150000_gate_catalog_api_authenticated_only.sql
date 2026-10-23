-- Migration: Gate catalog and public shop API to authenticated users only
-- Compliance requirement: Ensure catalogue is not readable through the public shop API without login

-- 1. Products table: Restrict SELECT to authenticated users only
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
DROP POLICY IF EXISTS "Allow public read access" ON public.products;
DROP POLICY IF EXISTS "Products are viewable by authenticated users" ON public.products;
DROP POLICY IF EXISTS "Products viewable by authenticated users only" ON public.products;

CREATE POLICY "Products viewable by authenticated users only"
ON public.products
FOR SELECT
TO authenticated
USING (true);


-- 2. Product Variants table: Restrict SELECT to authenticated users only
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Product variants are viewable by everyone" ON public.product_variants;
DROP POLICY IF EXISTS "Allow public read access" ON public.product_variants;
DROP POLICY IF EXISTS "Product variants viewable by authenticated users only" ON public.product_variants;

CREATE POLICY "Product variants viewable by authenticated users only"
ON public.product_variants
FOR SELECT
TO authenticated
USING (true);


-- 3. Product Categories table: Restrict SELECT to authenticated users only
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.product_categories;
DROP POLICY IF EXISTS "Product categories viewable by everyone" ON public.product_categories;
DROP POLICY IF EXISTS "Product categories viewable by authenticated users only" ON public.product_categories;

CREATE POLICY "Product categories viewable by authenticated users only"
ON public.product_categories
FOR SELECT
TO authenticated
USING (true);


-- 4. Vial Types table: Restrict SELECT to authenticated users only
ALTER TABLE public.vial_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vial types are viewable by everyone" ON public.vial_types;
DROP POLICY IF EXISTS "Vial types viewable by authenticated users only" ON public.vial_types;

CREATE POLICY "Vial types viewable by authenticated users only"
ON public.vial_types
FOR SELECT
TO authenticated
USING (true);
