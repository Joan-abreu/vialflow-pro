-- Create email_logs table
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    content TEXT, -- stores HTML content
    status TEXT NOT NULL, -- sent, failed
    type TEXT NOT NULL, -- customer_confirmation, admin_notification, status_update, registration_welcome
    related_id UUID, -- CAN be order_id or user_id
    metadata JSONB DEFAULT '{}'::jsonb
);

-- RLS Policies
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all logs
CREATE POLICY "Admins can view all email logs"
    ON public.email_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );

-- Admins can insert/update (e.g. from edge functions or dashboard if needed)
CREATE POLICY "Admins and Service Role can insert email logs"
    ON public.email_logs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );

-- TRIGGER for Registration Emails
-- When a new profile is created, we assume a welcome email is sent by Supabase Auth
CREATE OR REPLACE FUNCTION public.log_registration_email()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.email_logs (
        recipient,
        subject,
        content,
        status,
        type,
        related_id,
        metadata
    ) VALUES (
        NEW.email,
        'Welcome to VialFlow Pro', 
        '<p>Welcome! Please confirm your email address to get started.</p>', -- Placeholder content
        'sent',
        'registration_welcome',
        NEW.id, -- profile id matches user_id usually, or at least relates to it
        '{"source": "auth_trigger"}'::jsonb
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_profile_created_log_email
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.log_registration_email();
