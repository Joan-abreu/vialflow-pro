-- Add new columns to shipments table for detailed box tracking
ALTER TABLE shipments
ADD COLUMN batch_id uuid REFERENCES production_batches(id),
ADD COLUMN box_number integer,
ADD COLUMN packs_per_box integer,
ADD COLUMN bottles_per_box integer,
ADD COLUMN packing_date timestamp with time zone,
ADD COLUMN ups_delivery_date timestamp with time zone,
ADD COLUMN weight_lb numeric,
ADD COLUMN dimension_length_in numeric,
ADD COLUMN dimension_width_in numeric,
ADD COLUMN dimension_height_in numeric;