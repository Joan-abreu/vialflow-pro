import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateSessionId, captureUtmParams, getGeoIpInfo } from "@/utils/sessionTracker";

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
    images?: string[];
    pack_size: number;
    position?: number;
    bulk_price?: number | null;
    bulk_min_qty?: number;
    bulk_label_fee?: number;
    bulk_only?: boolean;
    product: {
        id?: string;
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
    cartSessionId: string | null;
    updateCartContactInfo: (info: { email?: string; phone?: string; customer_name?: string }) => Promise<void>;
    markCartConverted: (orderId: string) => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
    const [items, setItems] = useState<CartItem[]>([]);
    const [isAnimating, setIsAnimating] = useState(false);
    const [cartSessionId, setCartSessionId] = useState<string | null>(null);
    const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isInitialMount = useRef(true);

    // Calculate cart total
    const cartTotal = items.reduce(
        (total, item) => {
            const bulkPrice = item.variant.bulk_price ?? null;
            const labelFee = item.with_labels ? (item.variant.bulk_label_fee ?? 0.15) : 0;
            const unitPrice = item.is_bulk && bulkPrice !== null 
                ? (bulkPrice + labelFee) 
                : (item.variant.bulk_only ? (item.variant.price + labelFee) : item.variant.price);
            return total + unitPrice * item.quantity;
        },
        0
    );

    // Calculate total weight
    const totalWeight = items.reduce((sum, item) => {
        const isBulkItem = item.is_bulk || item.variant.bulk_only;
        const itemWeight = isBulkItem 
            ? (item.variant.weight || 0) / (item.variant.pack_size || 1)
            : (item.variant.weight || 0);
        return sum + (itemWeight * item.quantity);
    }, 0);

    // Check for recovery token or restore cart from local storage on mount
    useEffect(() => {
        const initCart = async () => {
            if (typeof window === "undefined") return;

            // Check if URL has a recovery token (?recover=... or ?recovery_token=...)
            const urlParams = new URLSearchParams(window.location.search);
            const recoveryToken = urlParams.get("recover") || urlParams.get("recovery_token");

            if (recoveryToken) {
                try {
                    const { data: recoveredCart, error } = await supabase
                        .from("cart_sessions" as any)
                        .select("*")
                        .eq("recovery_token", recoveryToken)
                        .maybeSingle();

                    if (recoveredCart && recoveredCart.items && Array.isArray(recoveredCart.items) && recoveredCart.items.length > 0) {
                        setItems(recoveredCart.items);
                        setCartSessionId(recoveredCart.id);
                        localStorage.setItem("cart", JSON.stringify(recoveredCart.items));
                        
                        // Mark session status as recovered
                        await supabase
                            .from("cart_sessions" as any)
                            .update({ status: "recovered", last_active_at: new Date().toISOString() })
                            .eq("id", recoveredCart.id);

                        toast.success("Welcome back! Your saved cart has been restored.");
                        return;
                    }
                } catch (e) {
                    console.warn("Failed to recover cart from token:", e);
                }
            }

            // Fallback: Load cart from local storage
            const savedCart = localStorage.getItem("cart");
            if (savedCart) {
                try {
                    setItems(JSON.parse(savedCart));
                } catch (error) {
                    console.error("Failed to parse cart from local storage", error);
                }
            }
        };

        initCart();
    }, []);

    // Save cart to local storage whenever it changes
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
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

    // Sync cart with Supabase cart_sessions (Debounced to protect bandwidth)
    const syncCartWithSupabase = useCallback(async (currentItems: CartItem[], currentTotal: number, currentWeight: number) => {
        try {
            const sessionId = getOrCreateSessionId();
            const utms = captureUtmParams();
            const geo = await getGeoIpInfo();
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;

            // Auto-detect email and name from authenticated session if available
            let authEmail = user?.email || null;
            let authName: string | null = (user?.user_metadata?.full_name || user?.user_metadata?.name) || null;

            if (user && !authName) {
                try {
                    const { data: prof } = await supabase
                        .from("profiles")
                        .select("full_name")
                        .eq("user_id", user.id)
                        .maybeSingle();
                    if (prof?.full_name) {
                        authName = prof.full_name;
                    }
                } catch {}
            }

            if (currentItems.length === 0) {
                // If cart is cleared and we have a session, update status to empty
                if (cartSessionId) {
                    await supabase
                        .from("cart_sessions" as any)
                        .update({
                            items: [],
                            subtotal: 0,
                            total_weight: 0,
                            last_active_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", cartSessionId);
                }
                return;
            }

            // Check if a session already exists for this browser session_id
            const { data: existingSession } = await supabase
                .from("cart_sessions" as any)
                .select("id, status, email, customer_name, ip_address")
                .eq("session_id", sessionId)
                .in("status", ["active", "abandoned", "recovered"])
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (existingSession?.id) {
                setCartSessionId(existingSession.id);
                const updatePayload: Record<string, any> = {
                    user_id: user?.id || null,
                    items: currentItems,
                    subtotal: currentTotal,
                    total_weight: currentWeight,
                    status: existingSession.status === "abandoned" ? "active" : existingSession.status,
                    last_active_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    utm_source: utms.utm_source || null,
                    utm_medium: utms.utm_medium || null,
                    utm_campaign: utms.utm_campaign || null,
                    utm_term: utms.utm_term || null,
                    utm_content: utms.utm_content || null,
                    referrer: utms.referrer || null,
                };

                // Populate GeoIP if available
                if (geo.ip_address) updatePayload.ip_address = geo.ip_address;
                if (geo.country) updatePayload.country = geo.country;
                if (geo.country_code) updatePayload.country_code = geo.country_code;
                if (geo.city) updatePayload.city = geo.city;
                if (geo.region) updatePayload.region = geo.region;

                // Auto-fill customer contact if user has an account and not already populated
                if (authEmail && !existingSession.email) updatePayload.email = authEmail;
                if (authName && !existingSession.customer_name) updatePayload.customer_name = authName;

                await supabase
                    .from("cart_sessions" as any)
                    .update(updatePayload)
                    .eq("id", existingSession.id);
            } else {
                const insertPayload: Record<string, any> = {
                    session_id: sessionId,
                    user_id: user?.id || null,
                    email: authEmail || null,
                    customer_name: authName || null,
                    items: currentItems,
                    subtotal: currentTotal,
                    total_weight: currentWeight,
                    status: "active",
                    last_active_at: new Date().toISOString(),
                    utm_source: utms.utm_source || null,
                    utm_medium: utms.utm_medium || null,
                    utm_campaign: utms.utm_campaign || null,
                    utm_term: utms.utm_term || null,
                    utm_content: utms.utm_content || null,
                    referrer: utms.referrer || null,
                    ip_address: geo.ip_address || null,
                    country: geo.country || null,
                    country_code: geo.country_code || null,
                    city: geo.city || null,
                    region: geo.region || null,
                };

                const { data: newSession } = await supabase
                    .from("cart_sessions" as any)
                    .insert(insertPayload)
                    .select("id")
                    .single();

                if (newSession?.id) {
                    setCartSessionId(newSession.id);
                }
            }
        } catch (err) {
            console.debug("Cart session sync error (non-fatal):", err);
        }
    }, [cartSessionId]);

    // Trigger debounced sync when items change
    useEffect(() => {
        if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current);
        }

        syncTimeoutRef.current = setTimeout(() => {
            syncCartWithSupabase(items, cartTotal, totalWeight);
        }, 1200);

        return () => {
            if (syncTimeoutRef.current) {
                clearTimeout(syncTimeoutRef.current);
            }
        };
    }, [items, cartTotal, totalWeight, syncCartWithSupabase]);

    // Update customer contact info in active cart session (Early capture during checkout)
    const updateCartContactInfo = async (info: { email?: string; phone?: string; customer_name?: string }) => {
        try {
            const sessionId = getOrCreateSessionId();
            if (!info.email && !info.phone && !info.customer_name) return;

            await supabase
                .from("cart_sessions" as any)
                .update({
                    email: info.email || null,
                    phone: info.phone || null,
                    customer_name: info.customer_name || null,
                    last_active_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq("session_id", sessionId)
                .in("status", ["active", "abandoned", "recovered"]);
        } catch (e) {
            console.debug("Failed to update cart contact info:", e);
        }
    };

    // Mark active cart session as converted upon successful checkout
    const markCartConverted = async (orderId: string) => {
        try {
            const sessionId = getOrCreateSessionId();
            await supabase
                .from("cart_sessions" as any)
                .update({
                    status: "converted",
                    converted_order_id: orderId,
                    last_active_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq("session_id", sessionId);

            clearCart();
        } catch (e) {
            console.debug("Failed to mark cart converted:", e);
        }
    };

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
        const unitPrice = is_bulk && bulkPrice !== null 
            ? (bulkPrice + labelFee) 
            : (variant.bulk_only ? (variant.price + labelFee) : variant.price);

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

        const availableStock = variant.stock_quantity ?? 999;
        if (availableStock <= 0) {
            toast.error("This item is currently out of stock.");
            return;
        }

        setItems((currentItems) => {
            const existingItemIndex = currentItems.findIndex(
                (item) => item.variant.id === variant.id && 
                          !!item.is_bulk === !!is_bulk && 
                          !!item.with_labels === !!with_labels &&
                          item.custom_label_image_url === custom_label_image_url &&
                          item.custom_label_instructions === custom_label_instructions
            );
            
            const totalOtherQty = currentItems
                .filter((_, idx) => idx !== existingItemIndex && _.variant.id === variant.id)
                .reduce((sum, item) => sum + item.quantity, 0);

            const maxForThisItem = Math.max(0, availableStock - totalOtherQty);

            if (existingItemIndex > -1) {
                const currentQty = currentItems[existingItemIndex].quantity;
                const targetQty = currentQty + quantity;
                const finalQty = Math.min(targetQty, maxForThisItem);

                if (targetQty > maxForThisItem) {
                    toast.error(`Only ${availableStock} units available in stock.`);
                } else {
                    toast.success("Updated quantity in cart");
                }

                const newItems = [...currentItems];
                newItems[existingItemIndex] = {
                    ...newItems[existingItemIndex],
                    variant,
                    quantity: finalQty
                };
                return newItems;
            } else {
                if (maxForThisItem <= 0) {
                    toast.error(`You already have all ${availableStock} available units in your cart.`);
                    return currentItems;
                }
                const finalQty = Math.min(quantity, maxForThisItem);
                if (quantity > maxForThisItem) {
                    toast.error(`Quantity capped to available stock (${availableStock} units).`);
                }
                const labelText = is_bulk ? ` (Bulk - ${with_labels ? 'With Labels' : 'Unlabeled'})` : '';
                const sizeLabel = variant.vial_type.name || `${variant.vial_type.capacity_ml}ml`;
                toast.success(`Added ${variant.product.name} (${sizeLabel}${variant.vial_type.color ? ` - ${variant.vial_type.color}` : ''}${variant.vial_type.shape ? ` - ${variant.vial_type.shape}` : ''})${labelText} to cart`);
                return [...currentItems, { 
                    variant, 
                    quantity: finalQty, 
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
            if (!item) return currentItems;

            const minQty = (is_bulk || !!item.variant.bulk_only) ? (item.variant.bulk_min_qty ?? 100) : 1;

            if (quantity < minQty) {
                return currentItems.filter(
                    (i) => !(i.variant.id === variantId && 
                             !!i.is_bulk === !!is_bulk && 
                             !!i.with_labels === !!with_labels)
                );
            }
            
            const availableStock = item.variant.stock_quantity ?? 999;
            const otherItemsQty = currentItems
                .filter((i) => i.variant.id === variantId && 
                               !(!!i.is_bulk === !!is_bulk && !!i.with_labels === !!with_labels))
                .reduce((sum, i) => sum + i.quantity, 0);

            const maxAllowed = Math.max(minQty, availableStock - otherItemsQty);

            let finalQty = quantity;
            if (quantity > maxAllowed) {
                finalQty = maxAllowed;
                toast.error(`Cannot exceed available stock (${availableStock} units).`);
            }

            return currentItems.map((i) =>
                i.variant.id === variantId && 
                !!i.is_bulk === !!is_bulk && 
                !!i.with_labels === !!with_labels
                    ? { ...i, quantity: finalQty }
                    : i
            );
        });
    };

    const clearCart = () => {
        setItems([]);
        localStorage.removeItem("cart");
    };

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
                cartSessionId,
                updateCartContactInfo,
                markCartConverted,
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
