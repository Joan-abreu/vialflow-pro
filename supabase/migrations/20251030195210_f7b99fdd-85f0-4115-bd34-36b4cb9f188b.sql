-- Create function to automatically set started_at and completed_at timestamps
CREATE OR REPLACE FUNCTION public.update_batch_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set started_at when status changes from pending to in_progress
  IF OLD.status = 'pending' AND NEW.status = 'in_progress' AND NEW.started_at IS NULL THEN
    NEW.started_at = now();
  END IF;
  
  -- Set completed_at when status changes to completed
  IF OLD.status != 'completed' AND NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS set_batch_timestamps ON public.production_batches;

CREATE TRIGGER set_batch_timestamps
  BEFORE UPDATE ON public.production_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_batch_timestamps();