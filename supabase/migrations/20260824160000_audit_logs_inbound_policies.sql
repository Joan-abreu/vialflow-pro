-- Allow authenticated users/admins to insert and select audit logs for inbound receiving orders

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can view audit logs" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (true);
