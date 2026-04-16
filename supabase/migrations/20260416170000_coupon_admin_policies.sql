
-- Allow admins and staff to see all coupons (including inactive/expired ones)
CREATE POLICY "Admins and staff can see all coupons" ON public.coupons
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'manager', 'staff')
        )
    );

-- Allow admins to create coupons
CREATE POLICY "Admins can create coupons" ON public.coupons
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Allow admins to update coupons
CREATE POLICY "Admins can update coupons" ON public.coupons
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Allow admins to delete coupons
CREATE POLICY "Admins can delete coupons" ON public.coupons
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );
