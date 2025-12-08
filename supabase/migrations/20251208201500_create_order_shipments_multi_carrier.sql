-- Create order_shipments table for e-commerce shipping (separate from manufacturing shipments)
CREATE TABLE IF NOT EXISTS order_shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Order reference
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    
    -- Carrier information (multi-carrier support)
    carrier TEXT NOT NULL, -- 'UPS', 'FEDEX', 'USPS', 'DHL', etc.
    carrier_account_id TEXT, -- Account number with carrier
    service_code TEXT NOT NULL, -- Carrier-specific service code
    service_name TEXT, -- Human-readable service name
    
    -- Tracking
    tracking_number TEXT,
    tracking_url TEXT,
    
    -- Label
    label_data TEXT, -- Base64 encoded PDF or image
    label_format TEXT DEFAULT 'PDF', -- PDF, PNG, ZPL, etc.
    label_url TEXT, -- URL to download label if stored externally
    
    -- Shipment details
    weight DECIMAL(10, 2), -- Total weight in lbs
    weight_unit TEXT DEFAULT 'LBS', -- LBS or KG
    length DECIMAL(10, 2), -- Inches or CM
    width DECIMAL(10, 2),
    height DECIMAL(10, 2),
    dimension_unit TEXT DEFAULT 'IN', -- IN or CM
    
    -- Addresses (stored as JSONB for flexibility)
    ship_from JSONB, -- Shipper address
    ship_to JSONB, -- Recipient address
    
    -- Costs
    shipping_cost DECIMAL(10, 2),
    insurance_cost DECIMAL(10, 2),
    total_cost DECIMAL(10, 2),
    currency TEXT DEFAULT 'USD',
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'label_created', 
    -- Possible values: label_created, picked_up, in_transit, out_for_delivery, delivered, exception, cancelled
    
    -- Pickup information
    pickup_confirmation TEXT,
    pickup_date DATE,
    pickup_ready_time TEXT,
    pickup_close_time TEXT,
    
    -- Delivery
    estimated_delivery_date DATE,
    actual_delivery_date TIMESTAMPTZ,
    delivery_signature TEXT,
    
    -- Carrier-specific data
    carrier_response JSONB DEFAULT '{}'::jsonb, -- Full API response
    metadata JSONB DEFAULT '{}'::jsonb -- Additional custom data
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_shipments_order_id ON order_shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_shipments_tracking_number ON order_shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_order_shipments_carrier ON order_shipments(carrier);
CREATE INDEX IF NOT EXISTS idx_order_shipments_status ON order_shipments(status);
CREATE INDEX IF NOT EXISTS idx_order_shipments_created_at ON order_shipments(created_at DESC);

-- Enable RLS
ALTER TABLE order_shipments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view all order shipments"
    ON order_shipments FOR SELECT
    TO authenticated
    USING (
        public.has_role(auth.uid(), 'admin'::app_role)
    );

CREATE POLICY "Users can view their own order shipments"
    ON order_shipments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_shipments.order_id
            AND orders.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can insert order shipments"
    ON order_shipments FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_role(auth.uid(), 'admin'::app_role)
    );

CREATE POLICY "Admins can update order shipments"
    ON order_shipments FOR UPDATE
    TO authenticated
    USING (
        public.has_role(auth.uid(), 'admin'::app_role)
    );

CREATE POLICY "Admins can delete order shipments"
    ON order_shipments FOR DELETE
    TO authenticated
    USING (
        public.has_role(auth.uid(), 'admin'::app_role)
    );

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_order_shipments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_order_shipments_updated_at
    BEFORE UPDATE ON order_shipments
    FOR EACH ROW
    EXECUTE FUNCTION update_order_shipments_updated_at();

-- Create carrier_settings table for storing API credentials
CREATE TABLE IF NOT EXISTS carrier_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    carrier TEXT NOT NULL UNIQUE, -- 'UPS', 'FEDEX', 'USPS', etc.
    is_active BOOLEAN DEFAULT false,
    is_production BOOLEAN DEFAULT false, -- false = sandbox/test mode
    
    -- Credentials (encrypted in production)
    client_id TEXT,
    client_secret TEXT,
    account_number TEXT,
    api_key TEXT,
    meter_number TEXT, -- For FedEx
    
    -- API URLs
    api_url TEXT,
    
    -- Default settings
    default_service_code TEXT,
    default_package_type TEXT,
    
    -- Shipper information
    shipper_name TEXT,
    shipper_address JSONB,
    shipper_phone TEXT,
    shipper_email TEXT,
    
    -- Additional configuration
    config JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS on carrier_settings
ALTER TABLE carrier_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage carrier settings
CREATE POLICY "Only admins can manage carrier settings"
    ON carrier_settings FOR ALL
    TO authenticated
    USING (
        public.has_role(auth.uid(), 'admin'::app_role)
    );

-- Insert default carrier configurations
INSERT INTO carrier_settings (carrier, is_active, api_url) VALUES
    ('UPS', false, 'https://wwwcie.ups.com/api'),
    ('FEDEX', false, 'https://apis-sandbox.fedex.com'),
    ('USPS', false, 'https://secure.shippingapis.com/ShippingAPI.dll')
ON CONFLICT (carrier) DO NOTHING;

-- Add comments
COMMENT ON TABLE order_shipments IS 'Tracks shipping labels and deliveries for e-commerce orders (multi-carrier support)';
COMMENT ON TABLE carrier_settings IS 'Stores API credentials and configuration for shipping carriers';
