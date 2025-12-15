-- Allow public read access to product_categories
BEGIN;

DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.product_categories;

CREATE POLICY "Allow public read access" ON public.product_categories
    FOR SELECT USING (true);

COMMIT;
