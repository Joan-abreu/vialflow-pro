-- Add slug column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Function to generate slug
CREATE OR REPLACE FUNCTION public.generate_slug(name TEXT) RETURNS TEXT AS $$
BEGIN
    -- Convert to lowercase and replace non-alphanumeric characters with hyphens
    -- Remove leading/trailing hyphens
    RETURN trim(both '-' from lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')));
END;
$$ LANGUAGE plpgsql;

-- Backfill existing products
UPDATE public.products 
SET slug = generate_slug(name) 
WHERE slug IS NULL;

-- Make slug required after backfill
ALTER TABLE public.products ALTER COLUMN slug SET NOT NULL;

-- Create trigger to automatically update slug when name changes
CREATE OR REPLACE FUNCTION public.update_product_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.name <> OLD.name OR NEW.slug IS NULL THEN
        NEW.slug := public.generate_slug(NEW.name);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_product_slug_trigger
BEFORE INSERT OR UPDATE OF name ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_product_slug();
