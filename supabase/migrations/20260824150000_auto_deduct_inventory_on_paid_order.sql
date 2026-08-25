-- Automatic Inventory Deduction Trigger on Order Status Update
-- Deducts stock_quantity from product_variants when an order status transitions to paid/processing state
-- Restores stock_quantity if an order is cancelled or refunded.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS inventory_deducted BOOLEAN DEFAULT false;

-- 1. Trigger Function for Orders table (Status changes)
CREATE OR REPLACE FUNCTION public.handle_order_inventory_deduction()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    paid_statuses TEXT[] := ARRAY['processing', 'in_production', 'ready_to_ship', 'shipped', 'out_for_delivery', 'delivered', 'completed'];
    is_paid BOOLEAN;
BEGIN
    is_paid := (NEW.status = ANY(paid_statuses));

    -- If order becomes paid and inventory was NOT deducted yet
    IF is_paid AND (NEW.inventory_deducted IS FALSE OR NEW.inventory_deducted IS NULL) THEN
        FOR item IN 
            SELECT variant_id, quantity 
            FROM public.order_items 
            WHERE order_id = NEW.id AND variant_id IS NOT NULL
        LOOP
            UPDATE public.product_variants
            SET stock_quantity = GREATEST(0, stock_quantity - item.quantity)
            WHERE id = item.variant_id;
        END LOOP;

        NEW.inventory_deducted := TRUE;
    
    -- If order becomes cancelled/refunded and inventory WAS deducted, restore stock
    ELSIF (NEW.status = 'cancelled' OR NEW.status = 'failed' OR NEW.status = 'refunded') AND NEW.inventory_deducted IS TRUE THEN
        FOR item IN 
            SELECT variant_id, quantity 
            FROM public.order_items 
            WHERE order_id = NEW.id AND variant_id IS NOT NULL
        LOOP
            UPDATE public.product_variants
            SET stock_quantity = stock_quantity + item.quantity
            WHERE id = item.variant_id;
        END LOOP;

        NEW.inventory_deducted := FALSE;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger BEFORE INSERT OR UPDATE ON orders
DROP TRIGGER IF EXISTS trigger_deduct_inventory_on_order ON public.orders;
CREATE TRIGGER trigger_deduct_inventory_on_order
BEFORE INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_inventory_deduction();


-- 2. Trigger Function for Order Items table (Handling items inserted after order creation)
CREATE OR REPLACE FUNCTION public.handle_order_item_inventory_deduction()
RETURNS TRIGGER AS $$
DECLARE
    order_rec RECORD;
    paid_statuses TEXT[] := ARRAY['processing', 'in_production', 'ready_to_ship', 'shipped', 'out_for_delivery', 'delivered', 'completed'];
BEGIN
    IF NEW.variant_id IS NOT NULL THEN
        SELECT status, inventory_deducted INTO order_rec FROM public.orders WHERE id = NEW.order_id;
        
        -- If the parent order is already paid but item was just added, deduct stock for this item
        IF order_rec.status = ANY(paid_statuses) THEN
            UPDATE public.product_variants
            SET stock_quantity = GREATEST(0, stock_quantity - NEW.quantity)
            WHERE id = NEW.variant_id;

            UPDATE public.orders SET inventory_deducted = TRUE WHERE id = NEW.order_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger AFTER INSERT ON order_items
DROP TRIGGER IF EXISTS trigger_deduct_inventory_on_order_item ON public.order_items;
CREATE TRIGGER trigger_deduct_inventory_on_order_item
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_item_inventory_deduction();
