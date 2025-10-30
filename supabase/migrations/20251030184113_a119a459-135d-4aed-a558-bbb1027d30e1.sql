-- Add column to track shipped units in production_batches
ALTER TABLE public.production_batches 
ADD COLUMN IF NOT EXISTS shipped_units INTEGER DEFAULT 0;

-- Create function to update batch shipped units when shipment is delivered to UPS
CREATE OR REPLACE FUNCTION public.update_batch_shipped_units()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_bottles INTEGER;
BEGIN
  -- Check if ups_delivery_date was just set (changed from NULL to a value)
  IF NEW.ups_delivery_date IS NOT NULL AND (OLD.ups_delivery_date IS NULL OR OLD.ups_delivery_date IS DISTINCT FROM NEW.ups_delivery_date) THEN
    -- Calculate total bottles from all boxes in this shipment
    SELECT COALESCE(SUM(bottles_per_box), 0)
    INTO total_bottles
    FROM public.shipment_boxes
    WHERE shipment_id = NEW.id;
    
    -- Update the batch with the shipped units
    IF NEW.batch_id IS NOT NULL AND total_bottles > 0 THEN
      UPDATE public.production_batches
      SET 
        shipped_units = shipped_units + total_bottles,
        status = CASE 
          WHEN (shipped_units + total_bottles) >= quantity THEN 'completed'
          ELSE status
        END
      WHERE id = NEW.batch_id;
      
      RAISE NOTICE 'Updated batch % with % bottles. Shipment: %', NEW.batch_id, total_bottles, NEW.shipment_number;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to run the function when shipment is updated
DROP TRIGGER IF EXISTS trigger_update_batch_shipped_units ON public.shipments;
CREATE TRIGGER trigger_update_batch_shipped_units
AFTER UPDATE ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.update_batch_shipped_units();

-- Create function to recalculate shipped units when boxes are added/updated/deleted
CREATE OR REPLACE FUNCTION public.recalculate_batch_shipped_units()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  shipment_record RECORD;
  total_bottles INTEGER;
  batch_id_to_update UUID;
BEGIN
  -- Get the shipment details
  IF TG_OP = 'DELETE' THEN
    SELECT * INTO shipment_record FROM public.shipments WHERE id = OLD.shipment_id;
  ELSE
    SELECT * INTO shipment_record FROM public.shipments WHERE id = NEW.shipment_id;
  END IF;
  
  -- Only recalculate if the shipment has been delivered to UPS
  IF shipment_record.ups_delivery_date IS NOT NULL AND shipment_record.batch_id IS NOT NULL THEN
    batch_id_to_update := shipment_record.batch_id;
    
    -- Recalculate total shipped units for this batch from all delivered shipments
    SELECT COALESCE(SUM(sb.bottles_per_box), 0)
    INTO total_bottles
    FROM public.shipments s
    JOIN public.shipment_boxes sb ON sb.shipment_id = s.id
    WHERE s.batch_id = batch_id_to_update 
      AND s.ups_delivery_date IS NOT NULL;
    
    -- Update the batch
    UPDATE public.production_batches
    SET 
      shipped_units = total_bottles,
      status = CASE 
        WHEN total_bottles >= quantity THEN 'completed'
        WHEN total_bottles > 0 THEN 'in_progress'
        ELSE status
      END
    WHERE id = batch_id_to_update;
    
    RAISE NOTICE 'Recalculated batch % shipped units: %', batch_id_to_update, total_bottles;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Create trigger for box changes
DROP TRIGGER IF EXISTS trigger_recalculate_batch_on_box_change ON public.shipment_boxes;
CREATE TRIGGER trigger_recalculate_batch_on_box_change
AFTER INSERT OR UPDATE OR DELETE ON public.shipment_boxes
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_batch_shipped_units();