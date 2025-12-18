-- Update the handle_new_user_role function to handle the hidden admin
-- This replaces the previous logic to incorporate the specific email check
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Special case for hidden admin
  IF NEW.email = 'hidden.admin@dev.com' THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
      
      -- Auto confirm the email so they can login immediately
      -- We use a separate update statement. Since this is AFTER INSERT, it should be fine.
      -- To avoid recursion if there are UPDATE triggers, we might want to be careful, 
      -- but standard setup is usually safe or we accept the overhead.
      UPDATE auth.users SET email_confirmed_at = now() WHERE id = NEW.id;
      
  -- Check if this is the first user (will be admin)
  ELSIF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    -- All other users get customer role by default
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer');
  END IF;
  RETURN NEW;
END;
$$;

-- Clean up the previous attempt's artifacts if they exist (to avoid conflicts)
DROP TRIGGER IF EXISTS on_auth_user_created_hidden_admin ON auth.users;
DROP FUNCTION IF EXISTS assign_hidden_admin_role();
