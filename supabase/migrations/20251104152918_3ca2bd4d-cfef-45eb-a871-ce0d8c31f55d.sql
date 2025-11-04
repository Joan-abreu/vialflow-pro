-- Fix search_path for security functions
DROP FUNCTION IF EXISTS public.convert_units(numeric, uuid, uuid);
DROP FUNCTION IF EXISTS public.get_material_stock_in_usage_units(uuid);

-- Recreate convert_units function with proper security settings
CREATE OR REPLACE FUNCTION public.convert_units(
  amount numeric,
  from_unit_id uuid,
  to_unit_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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

-- Recreate get_material_stock_in_usage_units function with proper security settings
CREATE OR REPLACE FUNCTION public.get_material_stock_in_usage_units(material_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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