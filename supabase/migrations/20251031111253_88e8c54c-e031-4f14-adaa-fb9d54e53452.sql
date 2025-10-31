-- Fix critical security issues (correct order)

-- 1. First drop the policies that depend on profiles.role
DROP POLICY IF EXISTS "Admins can manage vial types" ON public.vial_types;
DROP POLICY IF EXISTS "Admins can manage production steps" ON public.production_steps;

-- 2. Now we can safely remove the role column from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- 3. Recreate vial_types policies using security definer functions
CREATE POLICY "Admins can manage vial types" 
ON public.vial_types 
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'manager'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'manager'::app_role)
);

DROP POLICY IF EXISTS "Anyone can view vial types" ON public.vial_types;

CREATE POLICY "Authenticated users can view vial types" 
ON public.vial_types 
FOR SELECT 
USING (public.has_active_role(auth.uid()));

-- 4. Recreate production_steps policies using security definer functions
CREATE POLICY "Admins can manage production steps" 
ON public.production_steps 
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'manager'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'manager'::app_role)
);

DROP POLICY IF EXISTS "Anyone can view production steps" ON public.production_steps;

CREATE POLICY "Authenticated users can view production steps" 
ON public.production_steps 
FOR SELECT 
USING (public.has_active_role(auth.uid()));

-- 5. Fix public data exposure - require authentication for all tables

-- material_categories
DROP POLICY IF EXISTS "Anyone can view material categories" ON public.material_categories;
CREATE POLICY "Authenticated users can view material categories" 
ON public.material_categories 
FOR SELECT 
USING (public.has_active_role(auth.uid()));

-- production_batches
DROP POLICY IF EXISTS "Anyone can view production batches" ON public.production_batches;
CREATE POLICY "Authenticated users can view production batches" 
ON public.production_batches 
FOR SELECT 
USING (public.has_active_role(auth.uid()));

-- profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles" 
ON public.profiles 
FOR SELECT 
USING (public.has_active_role(auth.uid()));

-- raw_materials
DROP POLICY IF EXISTS "Anyone can view raw materials" ON public.raw_materials;
CREATE POLICY "Authenticated users can view raw materials" 
ON public.raw_materials 
FOR SELECT 
USING (public.has_active_role(auth.uid()));

-- shipment_boxes
DROP POLICY IF EXISTS "Anyone can view shipment boxes" ON public.shipment_boxes;
CREATE POLICY "Authenticated users can view shipment boxes" 
ON public.shipment_boxes 
FOR SELECT 
USING (public.has_active_role(auth.uid()));

-- shipment_items
DROP POLICY IF EXISTS "Anyone can view shipment items" ON public.shipment_items;
CREATE POLICY "Authenticated users can view shipment items" 
ON public.shipment_items 
FOR SELECT 
USING (public.has_active_role(auth.uid()));

-- shipments
DROP POLICY IF EXISTS "Anyone can view shipments" ON public.shipments;
CREATE POLICY "Authenticated users can view shipments" 
ON public.shipments 
FOR SELECT 
USING (public.has_active_role(auth.uid()));

-- units_of_measurement
DROP POLICY IF EXISTS "Anyone can view units" ON public.units_of_measurement;
CREATE POLICY "Authenticated users can view units" 
ON public.units_of_measurement 
FOR SELECT 
USING (public.has_active_role(auth.uid()));