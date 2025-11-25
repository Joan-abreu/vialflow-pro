-- Drop the old unique constraint that only considers product_id and vial_type_id
ALTER TABLE public.product_variants 
DROP CONSTRAINT IF EXISTS product_variants_product_id_vial_type_id_key;

-- Add new unique constraint that includes pack_size
-- This allows:
-- - Same product + vial type with different pack sizes (e.g., Individual vs Pack of 5)
-- - But prevents duplicates of the same product + vial type + pack size combination
ALTER TABLE public.product_variants 
ADD CONSTRAINT product_variants_product_vial_pack_unique 
UNIQUE (product_id, vial_type_id, pack_size);

COMMENT ON CONSTRAINT product_variants_product_vial_pack_unique ON public.product_variants 
IS 'Ensures unique combination of product, vial type, and pack size. Allows multiple variants for same product/vial (e.g., Individual and Pack variants)';
