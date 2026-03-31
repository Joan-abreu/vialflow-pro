-- Add Shippo to carrier_settings
INSERT INTO carrier_settings (carrier, is_active, api_url) 
VALUES ('SHIPPO', true, 'https://api.goshippo.com/')
ON CONFLICT (carrier) DO UPDATE SET is_active = EXCLUDED.is_active, api_url = EXCLUDED.api_url;

-- Comment for Shippo integration
COMMENT ON COLUMN carrier_settings.api_key IS 'For Shippo: Use your ShippoToken <API_KEY>';
