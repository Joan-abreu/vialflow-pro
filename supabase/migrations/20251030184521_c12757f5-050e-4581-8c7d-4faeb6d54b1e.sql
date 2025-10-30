-- Initialize shipped_units for existing batches based on current shipments with ups_delivery_date
UPDATE public.production_batches pb
SET shipped_units = COALESCE(
  (
    SELECT SUM(sb.bottles_per_box)
    FROM public.shipments s
    JOIN public.shipment_boxes sb ON sb.shipment_id = s.id
    WHERE s.batch_id = pb.id 
      AND s.ups_delivery_date IS NOT NULL
  ), 
  0
)
WHERE shipped_units IS NULL OR shipped_units = 0;