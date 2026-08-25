-- Allow authenticated users to update and delete audit logs when editing or reverting inbound receiving orders

DROP POLICY IF EXISTS "Authenticated users can update audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can update audit logs" ON public.audit_logs
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can delete audit logs" ON public.audit_logs
    FOR DELETE TO authenticated
    USING (true);
