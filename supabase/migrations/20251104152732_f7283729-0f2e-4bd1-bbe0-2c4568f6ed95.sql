-- Add conversion system to units_of_measurement
ALTER TABLE public.units_of_measurement
ADD COLUMN base_unit_id uuid REFERENCES public.units_of_measurement(id),
ADD COLUMN conversion_to_base numeric DEFAULT 1,
ADD COLUMN is_base_unit boolean DEFAULT false;

-- Add purchase and usage units to raw_materials
ALTER TABLE public.raw_materials
ADD COLUMN purchase_unit_id uuid REFERENCES public.units_of_measurement(id),
ADD COLUMN usage_unit_id uuid REFERENCES public.units_of_measurement(id),
ADD COLUMN qty_per_container numeric;

-- Update existing materials to use their current unit as both purchase and usage
UPDATE public.raw_materials
SET purchase_unit_id = (SELECT id FROM public.units_of_measurement WHERE abbreviation = raw_materials.unit LIMIT 1),
    usage_unit_id = (SELECT id FROM public.units_of_measurement WHERE abbreviation = raw_materials.unit LIMIT 1);

-- Rename qty_per_box for clarity (keeping old column for now to not break existing data)
COMMENT ON COLUMN public.raw_materials.qty_per_box IS 'Deprecated: Use qty_per_container instead';

-- Create function to convert between units
CREATE OR REPLACE FUNCTION public.convert_units(
  amount numeric,
  from_unit_id uuid,
  to_unit_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  from_base numeric;
  to_base numeric;
  from_base_unit_id uuid;
  to_base_unit_id uuid;
BEGIN
  -- If units are the same, no conversion needed
  IF from_unit_id = to_unit_id THEN
    RETURN amount;
  END IF;
  
  -- Get conversion factors and base units
  SELECT 
    COALESCE(base_unit_id, id),
    COALESCE(conversion_to_base, 1)
  INTO from_base_unit_id, from_base
  FROM public.units_of_measurement
  WHERE id = from_unit_id;
  
  SELECT 
    COALESCE(base_unit_id, id),
    COALESCE(conversion_to_base, 1)
  INTO to_base_unit_id, to_base
  FROM public.units_of_measurement
  WHERE id = to_unit_id;
  
  -- Check if units are in the same family (same base unit)
  IF from_base_unit_id != to_base_unit_id THEN
    RAISE EXCEPTION 'Cannot convert between different unit families';
  END IF;
  
  -- Convert: amount * from_conversion / to_conversion
  RETURN amount * from_base / to_base;
END;
$$;

-- Create function to get material stock in usage units
CREATE OR REPLACE FUNCTION public.get_material_stock_in_usage_units(material_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  stock numeric;
  purchase_unit uuid;
  usage_unit uuid;
  container_qty numeric;
BEGIN
  SELECT 
    current_stock,
    purchase_unit_id,
    usage_unit_id,
    COALESCE(qty_per_container, qty_per_box, 1)
  INTO stock, purchase_unit, usage_unit, container_qty
  FROM public.raw_materials
  WHERE id = material_id;
  
  -- First convert from purchase units to usage units
  IF purchase_unit IS NOT NULL AND usage_unit IS NOT NULL THEN
    stock := convert_units(stock, purchase_unit, usage_unit);
  END IF;
  
  -- Then multiply by quantity per container
  RETURN stock * container_qty;
END;
$$;