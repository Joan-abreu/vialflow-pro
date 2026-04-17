-- Add position column to product_categories for custom ordering
ALTER TABLE public.product_categories ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

-- Update existing categories to have a deterministic initial order based on name
-- This is optional but helps avoid all being 0 at the start
DO $$
DECLARE
    cat_record RECORD;
    pos_index INTEGER := 1;
BEGIN
    FOR cat_record IN SELECT id FROM public.product_categories ORDER BY name LOOP
        UPDATE public.product_categories SET position = pos_index WHERE id = cat_record.id;
        pos_index := pos_index + 1;
    END LOOP;
END $$;
