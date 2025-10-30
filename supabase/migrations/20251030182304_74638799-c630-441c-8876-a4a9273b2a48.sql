-- Create shipment_boxes table
CREATE TABLE public.shipment_boxes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  box_number INTEGER NOT NULL,
  packs_per_box INTEGER,
  bottles_per_box INTEGER,
  weight_lb NUMERIC,
  dimension_length_in NUMERIC,
  dimension_width_in NUMERIC,
  dimension_height_in NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(shipment_id, box_number)
);

-- Enable RLS on shipment_boxes
ALTER TABLE public.shipment_boxes ENABLE ROW LEVEL SECURITY;

-- RLS policies for shipment_boxes
CREATE POLICY "Anyone can view shipment boxes"
ON public.shipment_boxes
FOR SELECT
USING (true);

CREATE POLICY "Staff can manage shipment boxes"
ON public.shipment_boxes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
  )
);

-- Migrate existing data from shipments to shipment_boxes
INSERT INTO public.shipment_boxes (
  shipment_id,
  box_number,
  packs_per_box,
  bottles_per_box,
  weight_lb,
  dimension_length_in,
  dimension_width_in,
  dimension_height_in
)
SELECT 
  id,
  COALESCE(box_number, 1),
  packs_per_box,
  bottles_per_box,
  weight_lb,
  dimension_length_in,
  dimension_width_in,
  dimension_height_in
FROM public.shipments
WHERE box_number IS NOT NULL OR packs_per_box IS NOT NULL OR bottles_per_box IS NOT NULL;

-- Remove box-specific columns from shipments table
ALTER TABLE public.shipments 
  DROP COLUMN IF EXISTS box_number,
  DROP COLUMN IF EXISTS packs_per_box,
  DROP COLUMN IF EXISTS bottles_per_box,
  DROP COLUMN IF EXISTS weight_lb,
  DROP COLUMN IF EXISTS dimension_length_in,
  DROP COLUMN IF EXISTS dimension_width_in,
  DROP COLUMN IF EXISTS dimension_height_in,
  DROP COLUMN IF EXISTS packing_date;

-- Add trigger for updated_at on shipment_boxes
CREATE TRIGGER update_shipment_boxes_updated_at
BEFORE UPDATE ON public.shipment_boxes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();