-- Migration: Alter estimated_delivery_days column type to TEXT for flexible shipping estimates
ALTER TABLE public.orders 
ALTER COLUMN estimated_delivery_days TYPE TEXT USING estimated_delivery_days::text;
