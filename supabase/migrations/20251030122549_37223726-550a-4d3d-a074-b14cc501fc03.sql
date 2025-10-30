-- Add order_index to raw_materials for drag and drop ordering
ALTER TABLE public.raw_materials 
ADD COLUMN order_index INTEGER DEFAULT 0;

-- Create index for better performance
CREATE INDEX idx_raw_materials_order ON public.raw_materials(order_index);

-- Create material_categories table
CREATE TABLE public.material_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.material_categories ENABLE ROW LEVEL SECURITY;

-- Create policies for material_categories
CREATE POLICY "Anyone can view material categories" 
ON public.material_categories 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can manage material categories" 
ON public.material_categories 
FOR ALL 
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid())
);

-- Insert default categories
INSERT INTO public.material_categories (name) VALUES
  ('vials'),
  ('seals'),
  ('labels'),
  ('packaging'),
  ('other');