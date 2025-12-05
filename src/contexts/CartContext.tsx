import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "sonner";

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
    weight: number | null;
    image_url: string | null;
    pack_size: number;
    position?: number;
    product: {
        name: string;
        slug?: string;
        image_url: string | null;
        description: string | null;
        category: string | null;
    };
    vial_type: {
        name: string;
        size_ml: number;
    };
}

export interface CartItem {
    variant: ProductVariant;
    quantity: number;
}

interface CartContextType {
    items: CartItem[];
    addToCart: (variant: ProductVariant, quantity?: number) => void;
    removeFromCart: (variantId: string) => void;
    updateQuantity: (variantId: string, quantity: number) => void;
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

    const addToCart = (variant: ProductVariant, quantity: number = 1) => {
        // Trigger animation
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 300);

        setItems((currentItems) => {
            const existingItem = currentItems.find((item) => item.variant.id === variant.id);
            if (existingItem) {
                toast.success("Updated quantity in cart");
                return currentItems.map((item) =>
                    item.variant.id === variant.id
                        ? { ...item, quantity: item.quantity + quantity }
                        : item
                );
            }
            toast.success(`Added ${variant.product.name} (${variant.vial_type.size_ml}ml) to cart`);
            return [...currentItems, { variant, quantity }];
        });
    };

    const removeFromCart = (variantId: string) => {
        setItems((currentItems) => currentItems.filter((item) => item.variant.id !== variantId));
        toast.success("Removed from cart");
    };

    const updateQuantity = (variantId: string, quantity: number) => {
        if (quantity < 1) {
            removeFromCart(variantId);
            return;
        }
        setItems((currentItems) =>
            currentItems.map((item) =>
                item.variant.id === variantId ? { ...item, quantity } : item
            )
        );
    };

    const clearCart = () => {
        setItems([]);
        localStorage.removeItem("cart");
    };

    const cartTotal = items.reduce(
        (total, item) => total + item.variant.price * item.quantity,
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
