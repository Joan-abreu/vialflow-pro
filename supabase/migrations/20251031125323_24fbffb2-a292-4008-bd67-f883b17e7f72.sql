-- Add ups_tracking_number and fba_id columns to shipment_boxes table
ALTER TABLE public.shipment_boxes 
ADD COLUMN ups_tracking_number TEXT,
ADD COLUMN fba_id TEXT;

-- Migrate existing data from shipments to shipment_boxes
-- If a shipment has these values, copy them to all its boxes
UPDATE public.shipment_boxes sb
SET 
  ups_tracking_number = s.ups_tracking_number,
  fba_id = s.fba_id
FROM public.shipments s
WHERE sb.shipment_id = s.id
  AND (s.ups_tracking_number IS NOT NULL OR s.fba_id IS NOT NULL);

-- Remove ups_tracking_number and fba_id columns from shipments table
ALTER TABLE public.shipments 
DROP COLUMN ups_tracking_number,
DROP COLUMN fba_id;