-- Add production materials enhancements
-- This migration adds support for:
-- 1. Calculation types (fixed, percentage, per_box)
-- 2. Box configurations per variant

-- Add new columns to production_configurations
ALTER TABLE production_configurations
ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'fixed' CHECK (calculation_type IN ('fixed', 'percentage', 'per_box')),
ADD COLUMN IF NOT EXISTS percentage_of_material_id UUID REFERENCES raw_materials(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS percentage_value NUMERIC;

COMMENT ON COLUMN production_configurations.calculation_type IS 'How to calculate quantity: fixed (direct quantity), percentage (% of another material), per_box (one per box)';
COMMENT ON COLUMN production_configurations.percentage_of_material_id IS 'For percentage type: which material to calculate percentage from';
COMMENT ON COLUMN production_configurations.percentage_value IS 'For percentage type: the percentage value (e.g., 70 for 70%)';

-- Create box_configurations table
CREATE TABLE IF NOT EXISTS box_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  packs_per_box INTEGER NOT NULL CHECK (packs_per_box > 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(variant_id)
);

COMMENT ON TABLE box_configurations IS 'Stores how many packs fit in a box for each product variant';
COMMENT ON COLUMN box_configurations.packs_per_box IS 'Number of packs that fit in one box for this variant';

-- Enable RLS on box_configurations
ALTER TABLE box_configurations ENABLE ROW LEVEL SECURITY;

-- Create policies for box_configurations
CREATE POLICY "Anyone can view box configurations" ON box_configurations FOR SELECT USING (true);
CREATE POLICY "Staff can manage box configurations" ON box_configurations FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid())
);

-- Create updated_at trigger for box_configurations
CREATE OR REPLACE FUNCTION update_box_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_box_configurations_updated_at
BEFORE UPDATE ON box_configurations
FOR EACH ROW
EXECUTE FUNCTION update_box_configurations_updated_at();
