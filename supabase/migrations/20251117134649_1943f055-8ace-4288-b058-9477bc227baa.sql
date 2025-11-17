-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Create policies for products
CREATE POLICY "Products are viewable by authenticated users"
ON public.products
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Products can be created by authenticated users"
ON public.products
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Products can be updated by authenticated users"
ON public.products
FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Products can be deleted by authenticated users"
ON public.products
FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Add product_id to production_batches
ALTER TABLE public.production_batches
ADD COLUMN product_id UUID REFERENCES public.products(id);

-- Create product_materials table (bill of materials per product)
CREATE TABLE public.product_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  quantity_per_unit DECIMAL(10, 4) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, material_id)
);

-- Enable RLS
ALTER TABLE public.product_materials ENABLE ROW LEVEL SECURITY;

-- Create policies for product_materials
CREATE POLICY "Product materials are viewable by authenticated users"
ON public.product_materials
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Product materials can be created by authenticated users"
ON public.product_materials
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Product materials can be updated by authenticated users"
ON public.product_materials
FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Product materials can be deleted by authenticated users"
ON public.product_materials
FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Create trigger for products updated_at
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default product "Reconstitution Solution"
INSERT INTO public.products (name, description, is_active)
VALUES ('Reconstitution Solution', 'Water and alcohol based reconstitution solution', true);