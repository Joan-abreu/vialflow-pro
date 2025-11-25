-- Seed additional common units of measurement for production
-- This migration adds more standard units if they don't already exist

-- Volume units
INSERT INTO units_of_measurement (name, abbreviation, category)
VALUES 
  ('Milliliters', 'mL', 'volume'),
  ('Gallons', 'gal', 'volume')
ON CONFLICT (name) DO NOTHING;

-- Weight/Mass units
INSERT INTO units_of_measurement (name, abbreviation, category)
VALUES 
  ('Milligrams', 'mg', 'weight'),
  ('Pounds', 'lb', 'weight'),
  ('Ounces', 'oz', 'weight')
ON CONFLICT (name) DO NOTHING;

-- Count/Quantity units
INSERT INTO units_of_measurement (name, abbreviation, category)
VALUES 
  ('Units', 'units', 'quantity'),
  ('Packs', 'pack', 'quantity'),
  ('Bottles', 'btl', 'quantity'),
  ('Vials', 'vial', 'quantity'),
  ('Bags', 'bag', 'quantity')
ON CONFLICT (name) DO NOTHING;

-- Length units
INSERT INTO units_of_measurement (name, abbreviation, category)
VALUES 
  ('Millimeters', 'mm', 'length'),
  ('Inches', 'in', 'length'),
  ('Feet', 'ft', 'length')
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE units_of_measurement IS 'Standard units of measurement organized by category (volume, weight, quantity, length)';

