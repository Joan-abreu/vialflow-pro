-- Create table to link vial types with required materials
CREATE TABLE public.vial_type_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vial_type_id UUID NOT NULL REFERENCES public.vial_types(id) ON DELETE CASCADE,
  raw_material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  quantity_per_unit NUMERIC NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(vial_type_id, raw_material_id)
);

-- Enable RLS
ALTER TABLE public.vial_type_materials ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view vial type materials"
ON public.vial_type_materials
FOR SELECT
USING (public.has_active_role(auth.uid()));

CREATE POLICY "Admins can manage vial type materials"
ON public.vial_type_materials
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'manager'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'manager'::app_role)
);

-- Create trigger for updated_at
CREATE TRIGGER update_vial_type_materials_updated_at
  BEFORE UPDATE ON public.vial_type_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();