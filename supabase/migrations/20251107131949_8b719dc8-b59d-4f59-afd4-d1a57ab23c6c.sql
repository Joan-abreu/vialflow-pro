-- Fix unit relationships so Milliliter is properly linked to Liters
UPDATE units_of_measurement
SET 
  base_unit_id = 'b81b0521-232d-4919-b95e-694e75969dd9',  -- Liters ID
  conversion_to_base = 0.001  -- 1 ml = 0.001 liters
WHERE id = '461e97d1-9f69-4837-bf20-fa752f228e5f'  -- Milliliter ID
  AND name = 'Milliliter';