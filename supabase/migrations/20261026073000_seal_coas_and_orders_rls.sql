-- Migration: Close remaining open read policies on product_coas, orders, and order_items
-- Ensure NO anonymous user can read COAs, orders, or order items via the Supabase REST API

-- 1. product_coas
ALTER TABLE public.product_coas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "COAs are viewable by everyone" ON public.product_coas;
DROP POLICY IF EXISTS "Public can view COAs" ON public.product_coas;
DROP POLICY IF EXISTS "Allow anonymous read access to coas" ON public.product_coas;

CREATE POLICY "Authenticated users can view COAs"
ON public.product_coas
FOR SELECT
TO authenticated
USING (true);

-- 2. orders
-- Drop open anon select policy
DROP POLICY IF EXISTS "Allow anonymous select access" ON public.orders;
DROP POLICY IF EXISTS "Public can view orders" ON public.orders;

-- Ensure only authenticated users can view their own orders or admins/staff
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
CREATE POLICY "Users can view own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role IN ('admin', 'manager', 'staff')
    )
);

-- 3. order_items
-- Drop open anon select policy
DROP POLICY IF EXISTS "Allow anonymous select access" ON public.order_items;
DROP POLICY IF EXISTS "Public can view order items" ON public.order_items;

DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
CREATE POLICY "Users can view own order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = order_items.order_id
        AND (
            orders.user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.user_roles
                WHERE user_roles.user_id = auth.uid()
                AND user_roles.role IN ('admin', 'manager', 'staff')
            )
        )
    )
);
