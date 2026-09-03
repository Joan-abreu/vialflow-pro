-- Migration: Add GeoIP and Location tracking to cart_sessions
-- Date: 2026-09-03

ALTER TABLE public.cart_sessions 
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS country_code TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS region TEXT;

-- Create index for geographic aggregation / filtering
CREATE INDEX IF NOT EXISTS idx_cart_sessions_country_code ON public.cart_sessions(country_code);
