-- Create units of measurement table
CREATE TABLE public.units_of_measurement (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  abbreviation TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('weight', 'volume', 'quantity', 'length')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.units_of_measurement ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view units" ON public.units_of_measurement FOR SELECT USING (true);
CREATE POLICY "Admins can manage units" ON public.units_of_measurement FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);

-- Insert default units
INSERT INTO public.units_of_measurement (name, abbreviation, category) VALUES
('Pieces', 'pcs', 'quantity'),
('Boxes', 'box', 'quantity'),
('Rolls', 'roll', 'quantity'),
('Liters', 'L', 'volume'),
('Kilograms', 'kg', 'weight'),
('Grams', 'g', 'weight'),
('Meters', 'm', 'length'),
('Centimeters', 'cm', 'length');

-- Add shipment items table to track what's in each shipment
CREATE TABLE public.shipment_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.production_batches(id),
  quantity INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shipment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view shipment items" ON public.shipment_items FOR SELECT USING (true);
CREATE POLICY "Staff can manage shipment items" ON public.shipment_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid())
);