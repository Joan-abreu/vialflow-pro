-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    operation TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    old_values JSONB, -- Previous state (for UPDATE/DELETE)
    new_values JSONB, -- New state (for INSERT/UPDATE)
    changed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for faster querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all logs
CREATE POLICY "Admins can view audit logs" ON audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );

-- Function to handle audit logging
CREATE OR REPLACE FUNCTION process_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_logs (table_name, record_id, operation, old_values, changed_by)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD), current_user_id);
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Only log if changes actually happened (ignoring updated_at)
        IF OLD IS DISTINCT FROM NEW THEN
             INSERT INTO audit_logs (table_name, record_id, operation, old_values, new_values, changed_by)
             VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), current_user_id);
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_logs (table_name, record_id, operation, new_values, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW), current_user_id);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply triggers to key tables
DROP TRIGGER IF EXISTS audit_raw_materials ON raw_materials;
CREATE TRIGGER audit_raw_materials
AFTER INSERT OR UPDATE OR DELETE ON raw_materials
FOR EACH ROW EXECUTE FUNCTION process_audit_log();

DROP TRIGGER IF EXISTS audit_orders ON orders;
CREATE TRIGGER audit_orders
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW EXECUTE FUNCTION process_audit_log();

DROP TRIGGER IF EXISTS audit_product_variants ON product_variants;
CREATE TRIGGER audit_product_variants
AFTER INSERT OR UPDATE OR DELETE ON product_variants
FOR EACH ROW EXECUTE FUNCTION process_audit_log();

DROP TRIGGER IF EXISTS audit_shipments ON shipments;
CREATE TRIGGER audit_shipments
AFTER INSERT OR UPDATE OR DELETE ON shipments
FOR EACH ROW EXECUTE FUNCTION process_audit_log();

DROP TRIGGER IF EXISTS audit_products ON products;
CREATE TRIGGER audit_products
AFTER INSERT OR UPDATE OR DELETE ON products
FOR EACH ROW EXECUTE FUNCTION process_audit_log();

DROP TRIGGER IF EXISTS audit_production_batches ON production_batches;
CREATE TRIGGER audit_production_batches
AFTER INSERT OR UPDATE OR DELETE ON production_batches
FOR EACH ROW EXECUTE FUNCTION process_audit_log();
