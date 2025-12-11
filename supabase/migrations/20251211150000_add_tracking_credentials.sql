-- Add tracking credentials to carrier_settings
ALTER TABLE carrier_settings 
ADD COLUMN IF NOT EXISTS tracking_client_id TEXT,
ADD COLUMN IF NOT EXISTS tracking_client_secret TEXT;

COMMENT ON COLUMN carrier_settings.tracking_client_id IS 'Separate Client ID for Tracking API (specifically for FedEx)';
COMMENT ON COLUMN carrier_settings.tracking_client_secret IS 'Separate Client Secret for Tracking API (specifically for FedEx)';
