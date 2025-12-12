-- Create product_categories table
CREATE TABLE IF NOT EXISTS public.product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- Create policies for product_categories (allow all for now based on typical small app usage, or specific roles if needed. 
-- Assuming authenticated users can read, and service_role/admin can write. For simplicity in this refactor step, I'll allow all authenticated to read.)
CREATE POLICY "Allow read access for authenticated users" ON public.product_categories
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow write access for authenticated users" ON public.product_categories
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update access for authenticated users" ON public.product_categories
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow delete access for authenticated users" ON public.product_categories
    FOR DELETE USING (auth.role() = 'authenticated');


-- Add category_id to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.product_categories(id);

-- Populate product_categories with existing categories
INSERT INTO public.product_categories (name)
SELECT DISTINCT category FROM public.products WHERE category IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- Update products.category_id based on name matching
UPDATE public.products p
SET category_id = pc.id
FROM public.product_categories pc
WHERE p.category = pc.name;

-- Drop the old category column
ALTER TABLE public.products DROP COLUMN IF EXISTS category;
