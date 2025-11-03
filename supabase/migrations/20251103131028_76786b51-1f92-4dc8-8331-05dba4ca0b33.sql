-- Add destination column to shipment_boxes
ALTER TABLE public.shipment_boxes 
ADD COLUMN destination TEXT;

-- Migrate existing destination data from shipments to their boxes
UPDATE public.shipment_boxes sb
SET destination = s.destination
FROM public.shipments s
WHERE sb.shipment_id = s.id AND s.destination IS NOT NULL;

-- Remove destination column from shipments table
ALTER TABLE public.shipments 
DROP COLUMN destination;