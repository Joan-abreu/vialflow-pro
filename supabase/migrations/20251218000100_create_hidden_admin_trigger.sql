-- Trigger to automatically assign admin role to hidden.admin@dev.com
CREATE OR REPLACE FUNCTION assign_hidden_admin_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email = 'hidden.admin@dev.com' THEN
    -- Check if role already exists (unlikely on insert but good practice)
    IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = NEW.id) THEN
      INSERT INTO user_roles (user_id, role, granted_by)
      VALUES (NEW.id, 'admin', NEW.id); -- granted_by self for now or null
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to auth.users
-- Note: triggers on auth.users are tricky to manage via migrations if permissions aren't set, 
-- but usually allowed in Supabase local dev.
DROP TRIGGER IF EXISTS on_auth_user_created_hidden_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_hidden_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION assign_hidden_admin_role();
