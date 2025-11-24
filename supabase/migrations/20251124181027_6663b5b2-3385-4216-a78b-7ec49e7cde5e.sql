-- Drop the unique constraint that prevents multiple variants with same product_id and vial_type_id
ALTER TABLE public.product_variants DROP CONSTRAINT IF EXISTS product_variants_product_id_vial_type_id_key;

COMMENT ON TABLE public.product_variants IS 'Allows multiple variants per product-vial type combination (e.g., different pack sizes)';