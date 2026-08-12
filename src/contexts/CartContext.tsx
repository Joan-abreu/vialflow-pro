import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface Product {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
    description: string | null;
    category: string | null;
}

export interface ProductVariant {
    id: string;
    product_id: string;
    vial_type_id: string;
    sku: string | null;
    price: number;
    stock_quantity: number;
    max_online_quantity: number | null;
    weight: number | null;
    dimension_length?: number | null;
    dimension_width?: number | null;
    dimension_height?: number | null;
    image_url: string | null;
    pack_size: number;
    position?: number;
    bulk_price?: number | null;
    bulk_min_qty?: number;
    bulk_label_fee?: number;
    product: {
        name: string;
        slug?: string;
        image_url: string | null;
        description: string | null;
        category: string | null;
        is_private?: boolean;
    };
    vial_type: {
        name: string;
        capacity_ml: number;
        color: string | null;
        shape: string | null;
    };
}

export interface CartItem {
    variant: ProductVariant;
    quantity: number;
    is_bulk?: boolean;
    with_labels?: boolean;
    label_fee_applied?: number;
    custom_label_image_url?: string | null;
    custom_label_instructions?: string | null;
}

interface CartContextType {
    items: CartItem[];
    addToCart: (
        variant: ProductVariant, 
        quantity?: number, 
        is_bulk?: boolean, 
        with_labels?: boolean,
        custom_label_image_url?: string | null,
        custom_label_instructions?: string | null
    ) => void;
    removeFromCart: (variantId: string, is_bulk?: boolean, with_labels?: boolean) => void;
    updateQuantity: (variantId: string, quantity: number, is_bulk?: boolean, with_labels?: boolean) => void;
    clearCart: () => void;
    cartTotal: number;
    cartCount: number;
    isAnimating: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
    const [items, setItems] = useState<CartItem[]>([]);
    const [isAnimating, setIsAnimating] = useState(false);

    // Load cart from local storage on mount
    useEffect(() => {
        const savedCart = localStorage.getItem("cart");
        if (savedCart) {
            try {
                setItems(JSON.parse(savedCart));
            } catch (error) {
                console.error("Failed to parse cart from local storage", error);
            }
        }
    }, []);

    // Save cart to local storage whenever it changes
    useEffect(() => {
        localStorage.setItem("cart", JSON.stringify(items));
    }, [items]);

    // Clear cart on logout
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === "SIGNED_OUT") {
                setItems([]);
                localStorage.removeItem("cart");
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const addToCart = (
        variant: ProductVariant, 
        quantity: number = 1, 
        is_bulk: boolean = false, 
        with_labels: boolean = false,
        custom_label_image_url?: string | null,
        custom_label_instructions?: string | null
    ) => {
        // Trigger animation
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 300);

        const bulkPrice = variant.bulk_price ?? null;
        const labelFee = with_labels ? (variant.bulk_label_fee ?? 0.15) : 0;
        const unitPrice = is_bulk && bulkPrice !== null ? (bulkPrice + labelFee) : (variant.bulk_only ? (variant.price + labelFee) : variant.price);

        if (typeof window !== 'undefined') {
            const dataLayer = (window as any).dataLayer = (window as any).dataLayer || [];
            dataLayer.push({
                event: 'add_to_cart',
                ecommerce: {
                    currency: 'USD',
                    value: unitPrice * quantity,
                    items: [{
                        item_id: variant.id,
                        item_name: variant.product.name,
                        price: unitPrice,
                        quantity: quantity
                    }]
                }
            });
        }

        setItems((currentItems) => {
            const existingItemIndex = currentItems.findIndex(
                (item) => item.variant.id === variant.id && 
                          !!item.is_bulk === !!is_bulk && 
                          !!item.with_labels === !!with_labels &&
                          item.custom_label_image_url === custom_label_image_url &&
                          item.custom_label_instructions === custom_label_instructions
            );
            
            if (existingItemIndex > -1) {
                toast.success("Updated quantity in cart");
                const newItems = [...currentItems];
                newItems[existingItemIndex] = {
                    ...newItems[existingItemIndex],
                    variant, // Re-update with latest variant data (price, etc.)
                    quantity: newItems[existingItemIndex].quantity + quantity
                };
                return newItems;
            } else {
                const labelText = is_bulk ? ` (Bulk - ${with_labels ? 'With Labels' : 'Unlabeled'})` : '';
                const sizeLabel = variant.vial_type.name || `${variant.vial_type.capacity_ml}ml`;
                toast.success(`Added ${variant.product.name} (${sizeLabel}${variant.vial_type.color ? ` - ${variant.vial_type.color}` : ''}${variant.vial_type.shape ? ` - ${variant.vial_type.shape}` : ''})${labelText} to cart`);
                return [...currentItems, { 
                    variant, 
                    quantity, 
                    is_bulk, 
                    with_labels, 
                    label_fee_applied: labelFee,
                    custom_label_image_url,
                    custom_label_instructions
                }];
            }
        });
    };

    const removeFromCart = (variantId: string, is_bulk: boolean = false, with_labels: boolean = false) => {
        setItems((currentItems) => currentItems.filter(
            (item) => !(item.variant.id === variantId && 
                       !!item.is_bulk === !!is_bulk && 
                       !!item.with_labels === !!with_labels)
        ));
        toast.success("Removed from cart");
    };

    const updateQuantity = (variantId: string, quantity: number, is_bulk: boolean = false, with_labels: boolean = false) => {
        setItems((currentItems) => {
            const item = currentItems.find(
                (i) => i.variant.id === variantId && 
                       !!i.is_bulk === !!is_bulk && 
                       !!i.with_labels === !!with_labels
            );
            const minQty = (is_bulk || !!item?.variant.bulk_only) ? (item?.variant.bulk_min_qty ?? 100) : 1;

            if (quantity < minQty) {
                // If it goes below minimum bulk quantity, remove it
                return currentItems.filter(
                    (i) => !(i.variant.id === variantId && 
                             !!i.is_bulk === !!is_bulk && 
                             !!i.with_labels === !!with_labels)
                );
            }
            
            return currentItems.map((i) =>
                i.variant.id === variantId && 
                !!i.is_bulk === !!is_bulk && 
                !!i.with_labels === !!with_labels
                    ? { ...i, quantity }
                    : i
            );
        });
    };

    const clearCart = () => {
        setItems([]);
        localStorage.removeItem("cart");
    };

    const cartTotal = items.reduce(
        (total, item) => {
            const bulkPrice = item.variant.bulk_price ?? null;
            const labelFee = item.with_labels ? (item.variant.bulk_label_fee ?? 0.15) : 0;
            const unitPrice = item.is_bulk && bulkPrice !== null ? (bulkPrice + labelFee) : (item.variant.bulk_only ? (item.variant.price + labelFee) : item.variant.price);
            return total + unitPrice * item.quantity;
        },
        0
    );

    const cartCount = items.reduce((count, item) => count + item.quantity, 0);

    return (
        <CartContext.Provider
            value={{
                items,
                addToCart,
                removeFromCart,
                updateQuantity,
                clearCart,
                cartTotal,
                cartCount,
                isAnimating,
            }}
        >
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error("useCart must be used within a CartProvider");
    }
    return context;
};
