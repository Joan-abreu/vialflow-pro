-- Migration: Automatic linking of guest orders to registered user profiles

-- 1. Function to link guest orders when a profile is created or updated with an email
CREATE OR REPLACE FUNCTION public.link_guest_orders_to_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NEW.user_id IS NOT NULL THEN
    UPDATE public.orders
    SET user_id = NEW.user_id
    WHERE LOWER(customer_email) = LOWER(NEW.email)
      AND user_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop trigger if it exists and recreate
DROP TRIGGER IF EXISTS tr_link_guest_orders_on_profile ON public.profiles;

CREATE TRIGGER tr_link_guest_orders_on_profile
AFTER INSERT OR UPDATE OF email, user_id ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.link_guest_orders_to_user();

-- 2. Function to link orders automatically on order creation if profile already exists for that email
CREATE OR REPLACE FUNCTION public.auto_link_guest_order_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matching_user_id UUID;
BEGIN
  IF NEW.user_id IS NULL AND NEW.customer_email IS NOT NULL THEN
    SELECT user_id INTO matching_user_id
    FROM public.profiles
    WHERE LOWER(email) = LOWER(NEW.customer_email)
      AND user_id IS NOT NULL
    LIMIT 1;

    IF matching_user_id IS NOT NULL THEN
      NEW.user_id := matching_user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop trigger if it exists and recreate
DROP TRIGGER IF EXISTS tr_auto_link_guest_order ON public.orders;

CREATE TRIGGER tr_auto_link_guest_order
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_guest_order_on_insert();

-- 3. Backfill existing unlinked guest orders in the database for current profiles
UPDATE public.orders o
SET user_id = p.user_id
FROM public.profiles p
WHERE LOWER(o.customer_email) = LOWER(p.email)
  AND o.user_id IS NULL
  AND p.user_id IS NOT NULL;
