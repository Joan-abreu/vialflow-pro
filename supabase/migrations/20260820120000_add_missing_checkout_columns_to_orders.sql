-- Migration: Add estimated_delivery_days and tax_amount to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS estimated_delivery_days INTEGER,
ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax NUMERIC DEFAULT 0;
