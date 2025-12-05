-- Make weight column mandatory and enforce positive values
UPDATE product_variants SET weight = 0.1 WHERE weight IS NULL OR weight <= 0;

ALTER TABLE product_variants 
ALTER COLUMN weight SET DEFAULT 0.01;

ALTER TABLE product_variants 
ALTER COLUMN weight SET NOT NULL;

ALTER TABLE product_variants
ADD CONSTRAINT weight_positive_check CHECK (weight > 0);
