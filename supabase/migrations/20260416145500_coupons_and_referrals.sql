
-- Create coupons table
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    target TEXT NOT NULL CHECK (target IN ('product', 'shipping', 'all')),
    type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed_amount')),
    value NUMERIC NOT NULL,
    max_uses INTEGER,
    times_used INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    is_referral BOOLEAN DEFAULT false,
    referrer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add coupon columns to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS applied_coupons JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS product_discount NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_discount NUMERIC DEFAULT 0;

-- Add referral columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS successful_referrals INTEGER DEFAULT 0;

-- Function to generate a random referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
BEGIN
    LOOP
        new_code := upper(substring(md5(random()::text) from 1 for 8));
        SELECT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = new_code) INTO code_exists;
        IF NOT code_exists THEN
            RETURN new_code;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically generate referral code for new profiles
CREATE OR REPLACE FUNCTION public.handle_new_profile_referral()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.referral_code IS NULL THEN
        NEW.referral_code := public.generate_referral_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profile_created_referral
    BEFORE INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile_referral();

-- Backfill referral codes for existing users
UPDATE public.profiles SET referral_code = public.generate_referral_code() WHERE referral_code IS NULL;

-- Enable RLS for coupons
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Allow reading active coupons
CREATE POLICY "Enable read access for active coupons" ON public.coupons
    FOR SELECT USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Atomic increment functions
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(coupon_code TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE public.coupons
    SET times_used = times_used + 1
    WHERE code = coupon_code;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.increment_referral_count(referrer_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET successful_referrals = successful_referrals + 1
    WHERE user_id = referrer_user_id;
END;
$$ LANGUAGE plpgsql;
