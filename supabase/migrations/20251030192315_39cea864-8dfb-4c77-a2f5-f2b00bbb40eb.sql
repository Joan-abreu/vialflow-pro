-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'staff', 'pending');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'pending',
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user has any active role (not pending)
CREATE OR REPLACE FUNCTION public.has_active_role(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role != 'pending'
  )
$$;

-- Function to assign pending role to new users
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if this is the first user (will be admin)
  IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    -- All other users get pending role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'pending');
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to assign role on user creation
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();

-- RLS Policies for user_roles table
CREATE POLICY "Users can view their own role"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update RLS policies for all tables to require active role
-- Material Categories
DROP POLICY IF EXISTS "Staff can manage raw materials" ON public.raw_materials;
DROP POLICY IF EXISTS "Authenticated users can manage material categories" ON public.material_categories;
DROP POLICY IF EXISTS "Authenticated users can manage units" ON public.units_of_measurement;
DROP POLICY IF EXISTS "Staff can manage production batches" ON public.production_batches;
DROP POLICY IF EXISTS "Staff can manage shipments" ON public.shipments;
DROP POLICY IF EXISTS "Staff can manage shipment boxes" ON public.shipment_boxes;
DROP POLICY IF EXISTS "Staff can manage shipment items" ON public.shipment_items;

CREATE POLICY "Active users can manage material categories"
  ON public.material_categories
  FOR ALL
  TO authenticated
  USING (public.has_active_role(auth.uid()))
  WITH CHECK (public.has_active_role(auth.uid()));

CREATE POLICY "Active users can manage units"
  ON public.units_of_measurement
  FOR ALL
  TO authenticated
  USING (public.has_active_role(auth.uid()))
  WITH CHECK (public.has_active_role(auth.uid()));

CREATE POLICY "Active users can manage raw materials"
  ON public.raw_materials
  FOR ALL
  TO authenticated
  USING (public.has_active_role(auth.uid()))
  WITH CHECK (public.has_active_role(auth.uid()));

CREATE POLICY "Active users can manage production batches"
  ON public.production_batches
  FOR ALL
  TO authenticated
  USING (public.has_active_role(auth.uid()))
  WITH CHECK (public.has_active_role(auth.uid()));

CREATE POLICY "Active users can manage shipments"
  ON public.shipments
  FOR ALL
  TO authenticated
  USING (public.has_active_role(auth.uid()))
  WITH CHECK (public.has_active_role(auth.uid()));

CREATE POLICY "Active users can manage shipment boxes"
  ON public.shipment_boxes
  FOR ALL
  TO authenticated
  USING (public.has_active_role(auth.uid()))
  WITH CHECK (public.has_active_role(auth.uid()));

CREATE POLICY "Active users can manage shipment items"
  ON public.shipment_items
  FOR ALL
  TO authenticated
  USING (public.has_active_role(auth.uid()))
  WITH CHECK (public.has_active_role(auth.uid()));

-- Assign roles to existing users (all become staff except first one becomes admin)
DO $$
DECLARE
  first_user_id UUID;
  user_record RECORD;
BEGIN
  -- Get first user (oldest by created_at)
  SELECT id INTO first_user_id
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1;
  
  -- Assign roles to all existing users
  FOR user_record IN SELECT id FROM auth.users LOOP
    IF user_record.id = first_user_id THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (user_record.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    ELSE
      INSERT INTO public.user_roles (user_id, role)
      VALUES (user_record.id, 'staff')
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END LOOP;
END $$;