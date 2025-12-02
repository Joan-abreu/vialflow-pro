-- Add 'customer' role to app_role enum and update user registration flow
-- This migration:
-- 1. Adds 'customer' to the app_role enum
-- 2. Updates the handle_new_user_role() function to assign 'customer' instead of 'pending'
-- 3. Migrates existing 'pending' users to 'customer' role (assumes they are confirmed)

-- Step 1: Add 'customer' to the app_role enum
ALTER TYPE public.app_role ADD VALUE 'customer';

-- Step 2: Update the handle_new_user_role function to assign 'customer' role
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
    -- All other users get customer role by default
    -- They can be promoted to staff/manager/admin later
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'customer');
  END IF;
  RETURN NEW;
END;
$$;

-- Step 3: Migrate existing 'pending' users to 'customer' role
-- This assumes that existing pending users have confirmed their email
-- If you have unconfirmed users, you may want to handle them differently
UPDATE public.user_roles
SET role = 'customer'
WHERE role = 'pending';

-- Add comment for documentation
COMMENT ON TYPE public.app_role IS 'User roles: admin (full access), manager (manage operations), staff (operational access), customer (registered customer), pending (unconfirmed/awaiting approval)';
