-- Add UPS tracking number field to shipments table
ALTER TABLE public.shipments 
ADD COLUMN ups_tracking_number text;