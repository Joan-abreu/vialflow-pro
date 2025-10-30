-- Remove unique constraint on shipment_number to allow multiple boxes per shipment
ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_shipment_number_key;