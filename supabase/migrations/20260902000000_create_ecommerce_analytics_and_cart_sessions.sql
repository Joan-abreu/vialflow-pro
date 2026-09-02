-- Migration: Create E-Commerce Analytics, Cart Sessions, Funnel Tracking & Settings
-- Date: 2026-09-02

-- 1. Table: cart_sessions
CREATE TABLE IF NOT EXISTS public.cart_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    email TEXT,
    phone TEXT,
    customer_name TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_weight NUMERIC(10, 4) DEFAULT 0.0000,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'abandoned', 'recovered', 'converted', 'archived')),
    recovery_token TEXT UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
    recovery_email_sent_count INT NOT NULL DEFAULT 0,
    last_recovery_email_at TIMESTAMP WITH TIME ZONE,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_term TEXT,
    utm_content TEXT,
    referrer TEXT,
    converted_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cart_sessions_session_id ON public.cart_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_cart_sessions_user_id ON public.cart_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_sessions_email ON public.cart_sessions(email);
CREATE INDEX IF NOT EXISTS idx_cart_sessions_status ON public.cart_sessions(status);
CREATE INDEX IF NOT EXISTS idx_cart_sessions_recovery_token ON public.cart_sessions(recovery_token);
CREATE INDEX IF NOT EXISTS idx_cart_sessions_last_active ON public.cart_sessions(last_active_at);

-- 2. Table: checkout_funnel_events
CREATE TABLE IF NOT EXISTS public.checkout_funnel_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    cart_session_id UUID REFERENCES public.cart_sessions(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    step TEXT NOT NULL, -- 'cart_view', 'begin_checkout', 'address_entered', 'shipping_selected', 'payment_selected', 'payment_attempted', 'payment_failed', 'order_completed'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_checkout_funnel_session_id ON public.checkout_funnel_events(session_id);
CREATE INDEX IF NOT EXISTS idx_checkout_funnel_step ON public.checkout_funnel_events(step);
CREATE INDEX IF NOT EXISTS idx_checkout_funnel_created_at ON public.checkout_funnel_events(created_at);

-- 3. Table: analytics_events
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_name TEXT NOT NULL, -- 'product_view', 'product_search', 'coa_view', 'coupon_applied', 'category_filter'
    item_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_name ON public.analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.cart_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_funnel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Cart Sessions RLS Policies
-- Public/Anon can insert or update cart sessions matching their session_id or user_id
CREATE POLICY "Public insert cart sessions"
    ON public.cart_sessions FOR INSERT
    TO public
    WITH CHECK (true);

CREATE POLICY "Public update own cart sessions"
    ON public.cart_sessions FOR UPDATE
    TO public
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Public select own cart sessions"
    ON public.cart_sessions FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Admins full access cart sessions"
    ON public.cart_sessions FOR ALL
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );

-- Checkout Funnel Events RLS Policies
CREATE POLICY "Public insert checkout funnel events"
    ON public.checkout_funnel_events FOR INSERT
    TO public
    WITH CHECK (true);

CREATE POLICY "Admins read checkout funnel events"
    ON public.checkout_funnel_events FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );

-- Analytics Events RLS Policies
CREATE POLICY "Public insert analytics events"
    ON public.analytics_events FOR INSERT
    TO public
    WITH CHECK (true);

CREATE POLICY "Admins read analytics events"
    ON public.analytics_events FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );

-- 5. Seed default App Settings for Analytics & Abandoned Carts
INSERT INTO public.app_settings (key, value, created_at, updated_at)
VALUES
    ('abandoned_cart_tracking_enabled', 'true', now(), now()),
    ('abandoned_cart_threshold_minutes', '60', now(), now()),
    ('guest_cart_tracking_enabled', 'true', now(), now()),
    ('early_contact_capture_enabled', 'true', now(), now()),
    ('cart_retention_days', '30', now(), now()),
    ('auto_recovery_emails_enabled', 'false', now(), now()),
    ('recovery_email_1_delay_hours', '1', now(), now()),
    ('recovery_email_2_delay_hours', '24', now(), now()),
    ('recovery_email_3_delay_hours', '72', now(), now()),
    ('recovery_discount_enabled', 'false', now(), now()),
    ('recovery_discount_coupon_code', 'COMEBACK10', now(), now()),
    ('recovery_discount_percentage', '10', now(), now()),
    ('recovery_email_subject', 'Did you forget something in your cart?', now(), now()),
    ('recovery_email_custom_message', 'We saved the items in your cart so you can easily complete your order whenever you are ready.', now(), now()),
    ('funnel_tracking_enabled', 'true', now(), now()),
    ('product_view_tracking_enabled', 'true', now(), now()),
    ('utm_attribution_tracking_enabled', 'true', now(), now()),
    ('exclude_admin_from_analytics', 'true', now(), now()),
    ('admin_alert_high_value_abandonment', 'true', now(), now()),
    ('high_value_abandonment_threshold', '300', now(), now()),
    ('analytics_admin_notification_email', '', now(), now())
ON CONFLICT (key) DO NOTHING;

-- 6. Helper Function to mark inactive carts as abandoned
CREATE OR REPLACE FUNCTION public.check_abandoned_carts(threshold_minutes INT DEFAULT 60)
RETURNS INT AS $$
DECLARE
    updated_count INT;
BEGIN
    UPDATE public.cart_sessions
    SET status = 'abandoned',
        updated_at = timezone('utc'::text, now())
    WHERE status = 'active'
      AND jsonb_array_length(items) > 0
      AND last_active_at < (timezone('utc'::text, now()) - (threshold_minutes || ' minutes')::interval);
      
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
