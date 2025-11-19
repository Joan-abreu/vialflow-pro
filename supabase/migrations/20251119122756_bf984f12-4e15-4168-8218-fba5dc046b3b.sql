-- Create production_configurations table to link product, vial type, and raw materials
CREATE TABLE IF NOT EXISTS public.production_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  vial_type_id UUID NOT NULL REFERENCES public.vial_types(id) ON DELETE CASCADE,
  raw_material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  quantity_per_unit NUMERIC NOT NULL DEFAULT 0,
  application_type TEXT NOT NULL DEFAULT 'per_unit',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_product_vial_material UNIQUE (product_id, vial_type_id, raw_material_id)
);

-- Add RLS policies
ALTER TABLE public.production_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view configurations"
  ON public.production_configurations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert configurations"
  ON public.production_configurations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update configurations"
  ON public.production_configurations FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to delete configurations"
  ON public.production_configurations FOR DELETE
  TO authenticated
  USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_production_configurations_updated_at
  BEFORE UPDATE ON public.production_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster queries
CREATE INDEX idx_production_configurations_product_vial 
  ON public.production_configurations(product_id, vial_type_id);