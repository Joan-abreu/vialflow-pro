-- Allow anonymous users to create orders (Guest Checkout)
CREATE POLICY "Allow anonymous insert access"
ON public.orders FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anonymous users to view their own order if they have the ID
CREATE POLICY "Allow anonymous select access"
ON public.orders FOR SELECT
TO anon
USING (true);

-- Allow anonymous users to create order items (Guest Checkout)
CREATE POLICY "Allow anonymous insert access"
ON public.order_items FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anonymous users to view order items if they have the order ID
CREATE POLICY "Allow anonymous select access"
ON public.order_items FOR SELECT
TO anon
USING (true);
