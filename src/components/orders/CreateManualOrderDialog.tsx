import React, { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Plus,
    Trash2,
    DollarSign,
    Package,
    Truck,
    User,
    CheckCircle2,
    Copy,
    Printer,
    Check,
    AlertCircle,
    Loader2,
    Search,
    Receipt,
    ShieldCheck,
    X,
    MapPin,
    ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { AddressValidationModal } from "@/components/checkout/AddressValidationModal";
import { InvoiceDialog } from "./InvoiceDialog";

interface VariantOption {
    id: string;
    product_id: string;
    product_name: string;
    sku: string | null;
    price: number;
    stock_quantity: number;
    pack_size: number | null;
    image_url: string | null;
    is_active: boolean;
}

interface OrderLineItem {
    id: string; // local temporary key
    variant_id: string;
    product_id: string;
    product_name: string;
    sku: string | null;
    standard_price: number;
    unit_price: number;
    quantity: number;
    stock_quantity: number;
    image_url: string | null;
}

interface CreateManualOrderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: (createdOrder: any) => void;
    onOpenShippingLabel?: (order: any) => void;
    onOpenPackingSlip?: (order: any) => void;
    onOpenInvoice?: (order: any) => void;
}

export const CreateManualOrderDialog: React.FC<CreateManualOrderDialogProps> = ({
    open,
    onOpenChange,
    onSuccess,
    onOpenShippingLabel,
    onOpenPackingSlip,
    onOpenInvoice,
}) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // Invoice Preview state
    const [isInvoicePreviewOpen, setIsInvoicePreviewOpen] = useState(false);

    // Customer state
    const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
    const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
    const [customerSearchQuery, setCustomerSearchQuery] = useState("");
    const [selectedUserId, setSelectedUserId] = useState<string>("");
    const [customerName, setCustomerName] = useState("");
    const [customerEmail, setCustomerEmail] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [isLoadingCustomerAddress, setIsLoadingCustomerAddress] = useState(false);

    // Address state
    const [addressLine1, setAddressLine1] = useState("");
    const [addressLine2, setAddressLine2] = useState("");
    const [city, setCity] = useState("");
    const [stateProvince, setStateProvince] = useState("");
    const [postalCode, setPostalCode] = useState("");
    const [country, setCountry] = useState("US");

    // Address Validation state
    const [isValidatingAddress, setIsValidatingAddress] = useState(false);
    const [addressValidationStatus, setAddressValidationStatus] = useState<"none" | "valid" | "suggested" | "invalid">("none");
    const [addressValidationMessage, setAddressValidationMessage] = useState<string>("");
    const [showValidationModal, setShowValidationModal] = useState(false);
    const [validationResult, setValidationResult] = useState<any>(null);
    const [recommendedAddress, setRecommendedAddress] = useState<any>(null);

    // Items state
    const [items, setItems] = useState<OrderLineItem[]>([]);
    
    // Product catalog & multi-select state
    const [productSearchQuery, setProductSearchQuery] = useState("");
    const [onlyInStock, setOnlyInStock] = useState<boolean>(true);
    const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);

    // Shipping & Payment state
    const [isFreeShipping, setIsFreeShipping] = useState<boolean>(true);
    const [customShippingCost, setCustomShippingCost] = useState<string>("0.00");
    const [paymentMethod, setPaymentMethod] = useState<string>("external_invoice");
    const [initialStatus, setInitialStatus] = useState<string>("ready_to_ship");
    const [internalNotes, setInternalNotes] = useState<string>("");

    // UI state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [createdOrderResult, setCreatedOrderResult] = useState<any | null>(null);
    const [hasCopiedSummary, setHasCopiedSummary] = useState(false);

    // 1. Fetch available products & variants with images and stock
    const { data: variantOptions = [], isLoading: loadingVariants } = useQuery<VariantOption[]>({
        queryKey: ["manual_order_variants"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("product_variants")
                .select(`
                    id,
                    product_id,
                    sku,
                    price,
                    stock_quantity,
                    pack_size,
                    image_url,
                    images,
                    is_published,
                    is_archived,
                    product:products (
                        id,
                        name,
                        image_url,
                        is_active,
                        is_published,
                        is_archived
                    )
                `)
                .order("product_id");

            if (error) {
                console.error("Error fetching variants for manual order:", error);
                return [];
            }

            return (data || []).map((v: any) => {
                const prodImg = v.product?.image_url;
                const variantImg = v.image_url || (Array.isArray(v.images) && v.images[0]) || prodImg;
                const isActive = 
                    (v.product?.is_active !== false) && 
                    (v.is_published !== false) && 
                    (!v.is_archived) && 
                    (!v.product?.is_archived);

                return {
                    id: v.id,
                    product_id: v.product_id,
                    product_name: v.product?.name || "Unnamed Product",
                    sku: v.sku,
                    price: Number(v.price) || 0,
                    stock_quantity: v.stock_quantity ?? 0,
                    pack_size: v.pack_size || 1,
                    image_url: variantImg || null,
                    is_active: isActive,
                };
            });
        },
        enabled: open,
    });

    // 2. Fetch existing customer profiles with full address fields
    const { data: customerProfiles = [], isLoading: loadingCustomers } = useQuery({
        queryKey: ["manual_order_customers"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("profiles")
                .select("id, user_id, full_name, email, phone, address_line1, address_line2, city, state, postal_code, country")
                .order("full_name");

            if (error) {
                console.error("Error fetching customer profiles:", error);
                return [];
            }
            return data || [];
        },
        enabled: open,
    });

    // Filter customers for search
    const filteredCustomers = useMemo(() => {
        if (!customerSearchQuery.trim()) {
            return customerProfiles.slice(0, 15);
        }
        const q = customerSearchQuery.toLowerCase().trim();
        return customerProfiles.filter((p: any) => {
            const name = (p.full_name || "").toLowerCase();
            const email = (p.email || "").toLowerCase();
            const phone = (p.phone || "").toLowerCase();
            return name.includes(q) || email.includes(q) || phone.includes(q);
        }).slice(0, 20);
    }, [customerProfiles, customerSearchQuery]);

    // Handle existing customer selection & pre-fill address from DB
    const handleSelectExistingCustomer = async (profile: any) => {
        setSelectedCustomer(profile);
        setSelectedUserId(profile.user_id);
        setCustomerName(profile.full_name || "");
        setCustomerEmail(profile.email || "");
        setCustomerPhone(profile.phone || "");

        // Try to get address from profile first
        let line1 = profile.address_line1 || "";
        let line2 = profile.address_line2 || "";
        let cCity = profile.city || "";
        let cState = profile.state || "";
        let cZip = profile.postal_code || "";
        let cCountry = profile.country || "US";

        // If profile address is not complete, query customer's last order shipping_address!
        if (!line1 || !cCity || !cZip) {
            setIsLoadingCustomerAddress(true);
            try {
                const { data: lastOrders } = await supabase
                    .from("orders")
                    .select("shipping_address, customer_phone")
                    .eq("user_id", profile.user_id)
                    .order("created_at", { ascending: false })
                    .limit(1);

                if (lastOrders && lastOrders.length > 0) {
                    const lastShip = (lastOrders[0].shipping_address as any) || {};
                    line1 = line1 || lastShip.line1 || lastShip.street1 || lastShip.address?.line1 || "";
                    line2 = line2 || lastShip.line2 || lastShip.street2 || lastShip.address?.line2 || "";
                    cCity = cCity || lastShip.city || lastShip.address?.city || "";
                    cState = cState || lastShip.state || lastShip.address?.state || "";
                    cZip = cZip || lastShip.postal_code || lastShip.zip || lastShip.address?.postal_code || "";
                    cCountry = cCountry || lastShip.country || lastShip.address?.country || "US";
                    if (!profile.phone && (lastShip.phone || lastOrders[0].customer_phone)) {
                        setCustomerPhone(lastShip.phone || lastOrders[0].customer_phone);
                    }
                }
            } catch (err) {
                console.error("Error fetching customer last order address:", err);
            } finally {
                setIsLoadingCustomerAddress(false);
            }
        }

        setAddressLine1(line1);
        setAddressLine2(line2);
        setCity(cCity);
        setStateProvince(cState);
        setPostalCode(cZip);
        setCountry(cCountry || "US");

        if (line1 && cCity) {
            toast.success("Customer and shipping address pre-filled from records");
            setAddressValidationStatus("none");
        }
    };

    const handleClearSelectedCustomer = () => {
        setSelectedCustomer(null);
        setSelectedUserId("");
        setCustomerName("");
        setCustomerEmail("");
        setCustomerPhone("");
        setAddressLine1("");
        setAddressLine2("");
        setCity("");
        setStateProvince("");
        setPostalCode("");
        setCountry("US");
        setAddressValidationStatus("none");
    };

    // Filter products for catalog
    const filteredVariants = useMemo(() => {
        return variantOptions.filter((v) => {
            if (onlyInStock && (v.stock_quantity <= 0 || !v.is_active)) {
                return false;
            }
            if (productSearchQuery.trim()) {
                const q = productSearchQuery.toLowerCase().trim();
                const matchesName = v.product_name.toLowerCase().includes(q);
                const matchesSku = (v.sku || "").toLowerCase().includes(q);
                if (!matchesName && !matchesSku) return false;
            }
            return true;
        });
    }, [variantOptions, onlyInStock, productSearchQuery]);

    // Multi-select helpers
    const toggleSelectVariant = (id: string) => {
        setSelectedVariantIds((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
    };

    const selectAllVisibleVariants = () => {
        const allIds = filteredVariants.map((v) => v.id);
        setSelectedVariantIds(allIds);
    };

    const clearSelectedVariants = () => {
        setSelectedVariantIds([]);
    };

    // Add selected items to order
    const handleAddSelectedVariants = () => {
        if (selectedVariantIds.length === 0) return;

        setItems((prev) => {
            const next = [...prev];
            selectedVariantIds.forEach((id) => {
                const variant = variantOptions.find((v) => v.id === id);
                if (!variant) return;

                const existingIndex = next.findIndex((item) => item.variant_id === variant.id);
                if (existingIndex >= 0) {
                    next[existingIndex] = {
                        ...next[existingIndex],
                        quantity: next[existingIndex].quantity + 1,
                    };
                } else {
                    next.push({
                        id: Math.random().toString(36).substr(2, 9),
                        variant_id: variant.id,
                        product_id: variant.product_id,
                        product_name: variant.product_name,
                        sku: variant.sku,
                        standard_price: variant.price,
                        unit_price: variant.price, // Admin overrides freely!
                        quantity: 1,
                        stock_quantity: variant.stock_quantity,
                        image_url: variant.image_url,
                    });
                }
            });
            return next;
        });

        toast.success(`Added ${selectedVariantIds.length} item(s) to order`);
        setSelectedVariantIds([]);
    };

    // Single item add helper
    const handleAddSingleVariant = (variant: VariantOption) => {
        setItems((prev) => {
            const existingIndex = prev.findIndex((i) => i.variant_id === variant.id);
            if (existingIndex >= 0) {
                return prev.map((item, idx) =>
                    idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
                );
            } else {
                return [
                    ...prev,
                    {
                        id: Math.random().toString(36).substr(2, 9),
                        variant_id: variant.id,
                        product_id: variant.product_id,
                        product_name: variant.product_name,
                        sku: variant.sku,
                        standard_price: variant.price,
                        unit_price: variant.price,
                        quantity: 1,
                        stock_quantity: variant.stock_quantity,
                        image_url: variant.image_url,
                    },
                ];
            }
        });
        toast.success(`Added ${variant.product_name} to order`);
    };

    const handleUpdateItemPrice = (id: string, newPrice: number) => {
        setItems((prev) =>
            prev.map((item) => (item.id === id ? { ...item, unit_price: Math.max(0, newPrice) } : item))
        );
    };

    const handleUpdateItemQty = (id: string, newQty: number) => {
        setItems((prev) =>
            prev.map((item) => (item.id === id ? { ...item, quantity: Math.max(1, newQty) } : item))
        );
    };

    const handleRemoveItem = (id: string) => {
        setItems((prev) => prev.filter((item) => item.id !== id));
    };

    // Validate Address using Shippo Edge Function
    const handleValidateAddress = async (showModalOnInvalid = true): Promise<boolean> => {
        if (!addressLine1.trim() || !city.trim() || !stateProvince.trim() || !postalCode.trim()) {
            toast.error("Please enter a complete address (street, city, state, zip) to verify.");
            return false;
        }

        setIsValidatingAddress(true);
        try {
            const addressToValidate = {
                full_name: customerName.trim() || "Recipient",
                name: customerName.trim() || "Recipient",
                line1: addressLine1.trim(),
                line2: addressLine2.trim() || undefined,
                city: city.trim(),
                state: stateProvince.trim().toUpperCase(),
                postal_code: postalCode.trim(),
                country: country.trim().toUpperCase() || "US",
                phone: customerPhone.trim() || undefined,
                email: customerEmail.trim() || undefined,
            };

            const { data, error } = await supabase.functions.invoke("validate-address", {
                body: { address: addressToValidate },
            });

            if (error) throw error;

            setValidationResult(data);
            const isValid = data?.valid === true;
            const validationVal = data?.validation_value; // 'valid' | 'partially_valid' | 'invalid'
            const hasSuggestions = 
                (data?.suggestions && data.suggestions.length > 0) || 
                (data?.changed_attributes && data.changed_attributes.length > 0);
            const isInvalid = validationVal === "invalid" || (!isValid && !hasSuggestions);

            if (isInvalid) {
                setAddressValidationStatus("invalid");
                setAddressValidationMessage(data?.note || "The carrier could not verify this address.");
                if (showModalOnInvalid) {
                    setShowValidationModal(true);
                }
                return false;
            } else if (hasSuggestions || validationVal === "partially_valid") {
                setAddressValidationStatus("suggested");
                setAddressValidationMessage("Carrier standardized suggestion available");
                if (data.suggestions && data.suggestions[0]) {
                    setRecommendedAddress(data.suggestions[0]);
                }
                if (showModalOnInvalid) {
                    setShowValidationModal(true);
                }
                return true;
            } else {
                setAddressValidationStatus("valid");
                setAddressValidationMessage("Verified with Carrier (USPS / Shippo)");
                toast.success("Shipping address verified by carrier!");
                return true;
            }
        } catch (err: any) {
            console.error("Address validation error:", err);
            toast.error(`Address validation service: ${err.message || "Request failed"}`);
            setAddressValidationStatus("none");
            return true; // Don't hard-block if API is offline
        } finally {
            setIsValidatingAddress(false);
        }
    };

    const handleConfirmSuggestedAddress = (suggested: any) => {
        if (suggested.line1) setAddressLine1(suggested.line1);
        if (suggested.line2 !== undefined) setAddressLine2(suggested.line2 || "");
        if (suggested.city) setCity(suggested.city);
        if (suggested.state) setStateProvince(suggested.state);
        if (suggested.postal_code) setPostalCode(suggested.postal_code);
        if (suggested.country) setCountry(suggested.country);
        setAddressValidationStatus("valid");
        setAddressValidationMessage("Standardized with Carrier (USPS / Shippo)");
        setShowValidationModal(false);
        toast.success("Carrier suggested address applied!");
    };

    // Computations
    const subtotal = useMemo(() => {
        return items.reduce((acc, item) => acc + item.unit_price * item.quantity, 0);
    }, [items]);

    const effectiveShipping = useMemo(() => {
        if (isFreeShipping) return 0;
        return Math.max(0, parseFloat(customShippingCost) || 0);
    }, [isFreeShipping, customShippingCost]);

    const grandTotal = useMemo(() => {
        return subtotal + effectiveShipping;
    }, [subtotal, effectiveShipping]);

    const totalUnitsCount = useMemo(() => {
        return items.reduce((acc, item) => acc + item.quantity, 0);
    }, [items]);

    // Reset form
    const resetForm = () => {
        setCustomerMode("existing");
        setSelectedCustomer(null);
        setSelectedUserId("");
        setCustomerName("");
        setCustomerEmail("");
        setCustomerPhone("");
        setAddressLine1("");
        setAddressLine2("");
        setCity("");
        setStateProvince("");
        setPostalCode("");
        setCountry("US");
        setAddressValidationStatus("none");
        setItems([]);
        setSelectedVariantIds([]);
        setProductSearchQuery("");
        setOnlyInStock(true);
        setIsFreeShipping(true);
        setCustomShippingCost("0.00");
        setPaymentMethod("external_invoice");
        setInitialStatus("ready_to_ship");
        setInternalNotes("");
        setIsSubmitting(false);
        setCreatedOrderResult(null);
        setHasCopiedSummary(false);
    };

    const handleClose = () => {
        resetForm();
        onOpenChange(false);
    };

    // Submit & Create Order
    const handleSubmit = async () => {
        if (!customerName.trim()) {
            toast.error("Please enter customer name");
            return;
        }
        if (!customerEmail.trim() && !customerPhone.trim()) {
            toast.error("Please enter either email or phone for the customer");
            return;
        }
        if (items.length === 0) {
            toast.error("Please add at least one product to the order");
            return;
        }
        if (!addressLine1.trim() || !city.trim() || !stateProvince.trim() || !postalCode.trim()) {
            toast.error("Please complete the shipping address for label creation");
            return;
        }

        // Validate address if it has not been validated or is invalid
        if (addressValidationStatus === "invalid") {
            setShowValidationModal(true);
            toast.error("Please correct the invalid shipping address before creating the order.");
            return;
        }

        if (addressValidationStatus === "none") {
            const isValid = await handleValidateAddress(true);
            if (!isValid) {
                // Address is invalid according to carrier; stopped by modal
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const isPaid = initialStatus === "ready_to_ship" || initialStatus === "processing";

            const shippingAddressObj = {
                full_name: customerName.trim(),
                email: customerEmail.trim() || null,
                phone: customerPhone.trim() || null,
                line1: addressLine1.trim(),
                line2: addressLine2.trim() || null,
                city: city.trim(),
                state: stateProvince.trim().toUpperCase(),
                postal_code: postalCode.trim(),
                country: country.trim().toUpperCase(),
            };

            // 1. Insert into orders table
            const orderPayload: Record<string, any> = {
                user_id: selectedUserId || null,
                customer_name: customerName.trim(),
                customer_email: customerEmail.trim() || null,
                total_amount: grandTotal,
                shipping_cost: effectiveShipping,
                tax: 0,
                status: initialStatus,
                payment_method: paymentMethod,
                payment_status: isPaid ? "paid" : "pending",
                shipping_address: shippingAddressObj,
                shipping_address_line1: addressLine1.trim(),
                shipping_address_line2: addressLine2.trim() || null,
                shipping_city: city.trim(),
                shipping_state: stateProvince.trim().toUpperCase(),
                shipping_postal_code: postalCode.trim(),
                shipping_country: country.trim().toUpperCase(),
                shipping_service: effectiveShipping === 0 ? "Free Shipping" : "Custom Shipping Rate",
                inventory_deducted: false, // Handled automatically by trigger when status is paid/ready_to_ship
            };

            const { data: newOrder, error: orderError } = await supabase
                .from("orders")
                .insert(orderPayload)
                .select("*, order_items(*)")
                .single();

            if (orderError) throw orderError;
            if (!newOrder?.id) throw new Error("Failed to retrieve created order ID");

            // 2. Insert order_items
            const orderItemsPayload = items.map((item) => ({
                order_id: newOrder.id,
                product_id: item.product_id,
                variant_id: item.variant_id,
                quantity: item.quantity,
                price_at_time: item.unit_price, // Stores agreed differentiated price!
                is_bulk: false,
                with_labels: false,
                label_fee_applied: 0,
            }));

            const { error: itemsError } = await supabase
                .from("order_items")
                .insert(orderItemsPayload);

            if (itemsError) throw itemsError;

            // 3. Add internal note if provided
            if (internalNotes.trim()) {
                await supabase.from("order_notes").insert({
                    order_id: newOrder.id,
                    author_name: user?.email || "Admin",
                    note: `[Manual Order]: ${internalNotes.trim()}`,
                });
            }

            // Invalidate orders queries so list refreshes immediately
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            queryClient.invalidateQueries({ queryKey: ["product_variants"] });

            // Attach created items to full object
            const completeOrder = {
                ...newOrder,
                order_items: items.map((item) => ({
                    ...item,
                    order_id: newOrder.id,
                    price_at_time: item.unit_price,
                    variant: {
                        id: item.variant_id,
                        sku: item.sku,
                        product: { name: item.product_name },
                    },
                })),
            };

            setCreatedOrderResult(completeOrder);
            toast.success(`Order #${newOrder.id.slice(0, 8)} created successfully!`);
            if (onSuccess) onSuccess(completeOrder);
        } catch (err: any) {
            console.error("Error creating manual order:", err);
            toast.error(err.message || "Failed to create order");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Copy text summary for customer (e.g. WhatsApp / Email)
    const handleCopyInvoiceSummary = () => {
        if (!createdOrderResult) return;

        const orderNum = createdOrderResult.id.slice(0, 8).toUpperCase();
        const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        
        let text = `📦 *INVOICE / ORDER CONFIRMATION* #${orderNum}\n`;
        text += `📅 Date: ${dateStr}\n`;
        text += `👤 Customer: ${customerName}\n`;
        if (customerEmail) text += `📧 Email: ${customerEmail}\n`;
        text += `📍 Shipping Address: ${addressLine1}, ${city}, ${stateProvince} ${postalCode}\n\n`;
        text += `*ITEMS ORDERED:*\n`;

        items.forEach((item) => {
            text += `• ${item.quantity}x ${item.product_name} @ $${item.unit_price.toFixed(2)} = $${(item.unit_price * item.quantity).toFixed(2)}\n`;
        });

        text += `\nSubtotal: $${subtotal.toFixed(2)}\n`;
        text += `Shipping: ${effectiveShipping === 0 ? "FREE" : `$${effectiveShipping.toFixed(2)}`}\n`;
        text += `*TOTAL DUE: $${grandTotal.toFixed(2)}*\n\n`;
        text += `Payment Method: ${paymentMethod === "external_invoice" ? "Invoice Payment Link" : paymentMethod.toUpperCase()}\n`;
        text += `Status: ${initialStatus === "ready_to_ship" ? "Paid / Processing for Dispatch" : "Pending Payment"}\n`;
        text += `\nThank you for your business!`;

        navigator.clipboard.writeText(text);
        setHasCopiedSummary(true);
        toast.success("Invoice summary copied to clipboard!");
        setTimeout(() => setHasCopiedSummary(false), 3000);
    };

    return (
        <>
            <Dialog open={open} onOpenChange={handleClose}>
                {/* Fully responsive DialogContent: fixed centering, fluid 95vw max, no default grid overflow */}
                <DialogContent className="w-[95vw] sm:max-w-2xl lg:max-w-3xl max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden rounded-2xl border shadow-2xl bg-background">
                    {/* Fixed Header */}
                    <DialogHeader className="p-4 sm:p-5 border-b bg-muted/20 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                                <Receipt className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 pr-6 sm:pr-0">
                                <DialogTitle className="text-lg sm:text-xl font-bold truncate">
                                    Create Custom Order / Manual Invoice
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground mt-0.5 line-clamp-1 sm:line-clamp-none">
                                    Set custom prices, bypass online processors, auto-deduct stock, and generate shipping labels.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* Scrollable Body - Strictly horizontal overflow-x-hidden */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-5 sm:space-y-6">
                        {createdOrderResult ? (
                            // Success View
                            <div className="space-y-5 sm:space-y-6">
                                <div className="flex flex-col items-center justify-center p-5 sm:p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center space-y-2">
                                    <div className="p-3 bg-emerald-500/20 rounded-full text-emerald-600">
                                        <CheckCircle2 className="h-7 w-7 sm:h-8 sm:w-8" />
                                    </div>
                                    <h3 className="text-base sm:text-lg font-bold text-foreground">
                                        Order #{createdOrderResult.id.slice(0, 8).toUpperCase()} Created!
                                    </h3>
                                    <p className="text-xs text-muted-foreground max-w-md">
                                        Order recorded for <strong className="text-foreground">{customerName}</strong>. 
                                        {initialStatus === "ready_to_ship" 
                                            ? " Inventory has been deducted and the order is ready for label printing." 
                                            : " Order is pending payment. Stock will deduct once marked as paid."}
                                    </p>
                                </div>

                                {/* Order Summary Snapshot */}
                                <div className="p-4 rounded-xl border bg-card text-xs space-y-3">
                                    <div className="flex justify-between font-semibold text-sm border-b pb-2">
                                        <span>Order Summary</span>
                                        <span className="text-primary font-bold">${grandTotal.toFixed(2)}</span>
                                    </div>
                                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                        {items.map((it) => (
                                            <div key={it.id} className="flex justify-between items-center text-muted-foreground gap-2">
                                                <span className="truncate">
                                                    {it.quantity}x {it.product_name}
                                                </span>
                                                <span className="font-mono text-foreground shrink-0 font-medium">
                                                    ${(it.unit_price * it.quantity).toFixed(2)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-between pt-2 border-t font-medium">
                                        <span>Shipping ({effectiveShipping === 0 ? "Free" : `$${effectiveShipping.toFixed(2)}`})</span>
                                        <span>Total: ${grandTotal.toFixed(2)}</span>
                                    </div>
                                </div>

                                {/* Quick Post-Creation Actions */}
                                <div className="space-y-2.5">
                                    {/* Prominent View & Print Official Invoice Button */}
                                    <Button
                                        onClick={() => {
                                            if (onOpenInvoice) {
                                                onOpenInvoice(createdOrderResult);
                                            } else {
                                                setIsInvoicePreviewOpen(true);
                                            }
                                        }}
                                        className="flex items-center justify-center gap-2 h-11 text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white w-full shadow-sm"
                                    >
                                        <Receipt className="h-4 w-4" />
                                        <span>View & Print Official Invoice (PDF)</span>
                                    </Button>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
                                        <Button
                                            variant="outline"
                                            onClick={handleCopyInvoiceSummary}
                                            className="flex items-center justify-center gap-1.5 h-10 text-xs font-semibold w-full"
                                        >
                                            {hasCopiedSummary ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                                            <span>Copy Text (WhatsApp)</span>
                                        </Button>

                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                if (onOpenPackingSlip) onOpenPackingSlip(createdOrderResult);
                                            }}
                                            className="flex items-center justify-center gap-1.5 h-10 text-xs font-semibold text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100/50 border-indigo-200 w-full"
                                        >
                                            <Printer className="h-3.5 w-3.5 text-indigo-600" />
                                            <span>Print Packing Slip</span>
                                        </Button>

                                        <Button
                                            onClick={() => {
                                                handleClose();
                                                if (onOpenShippingLabel) onOpenShippingLabel(createdOrderResult);
                                            }}
                                            className="flex items-center justify-center gap-1.5 h-10 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground w-full"
                                        >
                                            <Truck className="h-3.5 w-3.5" />
                                            <span>Create Label ↗</span>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // Form View
                            <>
                                {/* Section 1: Customer Details */}
                                <div className="space-y-3.5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <h4 className="text-sm font-bold flex items-center gap-2 text-foreground">
                                            <User className="h-4 w-4 text-primary shrink-0" />
                                            1. Customer Information
                                        </h4>
                                        <div className="flex items-center gap-1.5 self-start sm:self-auto">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={customerMode === "existing" ? "secondary" : "ghost"}
                                                className="h-7 text-xs px-2.5 font-medium"
                                                onClick={() => setCustomerMode("existing")}
                                            >
                                                Existing Customer
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={customerMode === "new" ? "secondary" : "ghost"}
                                                className="h-7 text-xs px-2.5 font-medium"
                                                onClick={() => {
                                                    setCustomerMode("new");
                                                    handleClearSelectedCustomer();
                                                }}
                                            >
                                                New Customer
                                            </Button>
                                        </div>
                                    </div>

                                    {customerMode === "existing" && (
                                        <div className="space-y-3 p-3 sm:p-3.5 rounded-xl border bg-muted/20">
                                            {selectedCustomer ? (
                                                // Selected customer card
                                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 p-3 rounded-lg border bg-background">
                                                    <div className="flex items-start gap-3 min-w-0">
                                                        <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                                                            {(selectedCustomer.full_name || "C").charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="space-y-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-bold text-sm text-foreground truncate">
                                                                    {selectedCustomer.full_name || "Unnamed Customer"}
                                                                </span>
                                                                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 bg-emerald-50">
                                                                    Existing Client
                                                                </Badge>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                                                                {selectedCustomer.email && <span className="truncate">📧 {selectedCustomer.email}</span>}
                                                                {customerPhone && <span>📞 {customerPhone}</span>}
                                                            </div>
                                                            {addressLine1 ? (
                                                                <div className="text-xs text-muted-foreground flex items-center gap-1 pt-0.5">
                                                                    <MapPin className="h-3 w-3 text-primary shrink-0" />
                                                                    <span className="truncate">{addressLine1}, {city}, {stateProvince} {postalCode}</span>
                                                                </div>
                                                            ) : (
                                                                <div className="text-xs text-amber-600 flex items-center gap-1 pt-0.5">
                                                                    <AlertCircle className="h-3 w-3 shrink-0" />
                                                                    <span>No address on file. Please enter shipping address below.</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 text-xs text-muted-foreground hover:text-foreground shrink-0 self-end sm:self-start"
                                                        onClick={handleClearSelectedCustomer}
                                                    >
                                                        Change
                                                    </Button>
                                                </div>
                                            ) : (
                                                // Searchable Combobox
                                                <div className="space-y-2">
                                                    <div className="relative">
                                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                                        <Input
                                                            placeholder="Search customer by name, email, or phone..."
                                                            value={customerSearchQuery}
                                                            onChange={(e) => setCustomerSearchQuery(e.target.value)}
                                                            className="h-9 pl-8 text-xs bg-background w-full"
                                                        />
                                                        {customerSearchQuery && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                                                                onClick={() => setCustomerSearchQuery("")}
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        )}
                                                    </div>

                                                    <div className="max-h-48 overflow-y-auto rounded-lg border bg-background divide-y">
                                                        {loadingCustomers ? (
                                                            <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                Loading customers...
                                                            </div>
                                                        ) : filteredCustomers.length === 0 ? (
                                                            <div className="p-4 text-center text-xs text-muted-foreground">
                                                                No customer found. You can switch to "New Customer" to enter details.
                                                            </div>
                                                        ) : (
                                                            filteredCustomers.map((profile: any) => {
                                                                const hasAddress = Boolean(profile.address_line1 && profile.city);
                                                                return (
                                                                    <button
                                                                        key={profile.id || profile.user_id}
                                                                        type="button"
                                                                        onClick={() => handleSelectExistingCustomer(profile)}
                                                                        className="w-full p-2.5 text-left hover:bg-muted/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2"
                                                                    >
                                                                        <div className="min-w-0">
                                                                            <div className="font-semibold text-xs text-foreground truncate">
                                                                                {profile.full_name || "Unnamed Customer"}
                                                                            </div>
                                                                            <div className="text-[11px] text-muted-foreground truncate">
                                                                                {profile.email || "No email"} {profile.phone ? `• ${profile.phone}` : ""}
                                                                            </div>
                                                                        </div>
                                                                        <div className="shrink-0 flex items-center gap-1.5 self-start sm:self-center">
                                                                            {hasAddress ? (
                                                                                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200 bg-emerald-50/50">
                                                                                    Address saved
                                                                                </Badge>
                                                                            ) : (
                                                                                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                                                                    No address
                                                                                </Badge>
                                                                            )}
                                                                            <ArrowRight className="h-3 w-3 text-muted-foreground hidden sm:inline" />
                                                                        </div>
                                                                    </button>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs font-medium">Full Name *</Label>
                                            <Input
                                                placeholder="e.g. John Doe"
                                                value={customerName}
                                                onChange={(e) => setCustomerName(e.target.value)}
                                                className="h-9 text-xs w-full"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs font-medium">Email Address</Label>
                                            <Input
                                                placeholder="client@example.com"
                                                type="email"
                                                value={customerEmail}
                                                onChange={(e) => setCustomerEmail(e.target.value)}
                                                className="h-9 text-xs w-full"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs font-medium">Phone (optional)</Label>
                                            <Input
                                                placeholder="(555) 000-0000"
                                                value={customerPhone}
                                                onChange={(e) => setCustomerPhone(e.target.value)}
                                                className="h-9 text-xs w-full"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Shipping Destination & Carrier Validation */}
                                <div className="space-y-3.5 pt-2 border-t">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <h4 className="text-sm font-bold flex items-center gap-2 text-foreground">
                                            <Truck className="h-4 w-4 text-primary shrink-0" />
                                            2. Shipping Address (For Label & Packing Slip)
                                        </h4>

                                        <div className="flex flex-wrap items-center gap-2">
                                            {/* Status badge */}
                                            {addressValidationStatus === "valid" && (
                                                <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 gap-1 text-[11px] font-semibold">
                                                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                                    Carrier Verified
                                                </Badge>
                                            )}
                                            {addressValidationStatus === "suggested" && (
                                                <Badge className="bg-amber-500/15 text-amber-700 border-amber-300 gap-1 text-[11px] font-semibold">
                                                    <AlertCircle className="h-3 w-3 text-amber-600" />
                                                    Suggestion Available
                                                </Badge>
                                            )}
                                            {addressValidationStatus === "invalid" && (
                                                <Badge className="bg-rose-500/15 text-rose-700 border-rose-300 gap-1 text-[11px] font-semibold">
                                                    <AlertCircle className="h-3 w-3 text-rose-600" />
                                                    Invalid Address
                                                </Badge>
                                            )}

                                            {/* Verify Button */}
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleValidateAddress(true)}
                                                disabled={isValidatingAddress || !addressLine1.trim() || !city.trim() || !postalCode.trim()}
                                                className="h-7 text-xs font-semibold gap-1.5"
                                            >
                                                {isValidatingAddress ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                                                )}
                                                Verify Address
                                            </Button>
                                        </div>
                                    </div>

                                    {isLoadingCustomerAddress && (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 rounded-lg bg-muted/40">
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            Looking up address history for this customer...
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs font-medium">Street Address Line 1 *</Label>
                                            <Input
                                                placeholder="123 Main St"
                                                value={addressLine1}
                                                onChange={(e) => {
                                                    setAddressLine1(e.target.value);
                                                    setAddressValidationStatus("none");
                                                }}
                                                className="h-9 text-xs w-full"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs font-medium">Apt / Suite / Unit (optional)</Label>
                                            <Input
                                                placeholder="Suite 200"
                                                value={addressLine2}
                                                onChange={(e) => {
                                                    setAddressLine2(e.target.value);
                                                    setAddressValidationStatus("none");
                                                }}
                                                className="h-9 text-xs w-full"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs font-medium">City *</Label>
                                            <Input
                                                placeholder="Miami"
                                                value={city}
                                                onChange={(e) => {
                                                    setCity(e.target.value);
                                                    setAddressValidationStatus("none");
                                                }}
                                                className="h-9 text-xs w-full"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs font-medium">State *</Label>
                                            <Input
                                                placeholder="FL"
                                                maxLength={10}
                                                value={stateProvince}
                                                onChange={(e) => {
                                                    setStateProvince(e.target.value);
                                                    setAddressValidationStatus("none");
                                                }}
                                                className="h-9 text-xs uppercase w-full"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs font-medium">Zip Code *</Label>
                                            <Input
                                                placeholder="33101"
                                                value={postalCode}
                                                onChange={(e) => {
                                                    setPostalCode(e.target.value);
                                                    setAddressValidationStatus("none");
                                                }}
                                                className="h-9 text-xs w-full"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs font-medium">Country *</Label>
                                            <Input
                                                value={country}
                                                onChange={(e) => {
                                                    setCountry(e.target.value);
                                                    setAddressValidationStatus("none");
                                                }}
                                                className="h-9 text-xs uppercase w-full"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Section 3: Products Multi-Select Catalog & Differentiated Pricing */}
                                <div className="space-y-3.5 pt-2 border-t">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-bold flex items-center gap-2 text-foreground">
                                            <Package className="h-4 w-4 text-primary shrink-0" />
                                            3. Products & Negotiated Unit Prices
                                        </h4>
                                        <Badge variant="outline" className="text-[11px] font-semibold">
                                            {totalUnitsCount} unit(s) in order
                                        </Badge>
                                    </div>

                                    {/* Catalog Filter & Multi-Select Toolbar */}
                                    <div className="p-3 bg-muted/20 rounded-xl border space-y-3">
                                        <div className="flex items-center justify-between pb-1 border-b">
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                                                <Search className="h-3.5 w-3.5 text-primary" />
                                                <span>Product Catalog & Search</span>
                                            </div>
                                            <span className="text-[11px] text-muted-foreground hidden sm:inline">
                                                Select items to add to the order below
                                            </span>
                                        </div>

                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                            {/* Search Filter */}
                                            <div className="relative flex-1">
                                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                                <Input
                                                    placeholder="Search products, peptides, bac water, SKU..."
                                                    value={productSearchQuery}
                                                    onChange={(e) => setProductSearchQuery(e.target.value)}
                                                    className="h-8 pl-8 text-xs bg-background w-full"
                                                />
                                                {productSearchQuery && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                                                        onClick={() => setProductSearchQuery("")}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                )}
                                            </div>

                                            {/* In-stock only filter switch */}
                                            <div className="flex items-center gap-2 shrink-0 bg-background px-2.5 py-1 rounded-lg border w-fit">
                                                <Switch
                                                    id="in-stock-only"
                                                    checked={onlyInStock}
                                                    onCheckedChange={setOnlyInStock}
                                                    className="scale-75"
                                                />
                                                <Label htmlFor="in-stock-only" className="text-xs font-semibold cursor-pointer select-none">
                                                    In-Stock Only (&gt; 0)
                                                </Label>
                                            </div>
                                        </div>

                                        {/* Multi-select actions bar */}
                                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t">
                                            <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                                                <span>Showing <strong>{filteredVariants.length}</strong> available item(s)</span>
                                                {selectedVariantIds.length > 0 && (
                                                    <Badge variant="secondary" className="text-[10px] font-bold">
                                                        {selectedVariantIds.length} selected
                                                    </Badge>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {filteredVariants.length > 0 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                                                        onClick={
                                                            selectedVariantIds.length === filteredVariants.length
                                                                ? clearSelectedVariants
                                                                : selectAllVisibleVariants
                                                        }
                                                    >
                                                        {selectedVariantIds.length === filteredVariants.length ? "Deselect All" : "Select All"}
                                                    </Button>
                                                )}

                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    disabled={selectedVariantIds.length === 0}
                                                    onClick={handleAddSelectedVariants}
                                                    className="h-7 text-xs font-bold gap-1 px-3"
                                                >
                                                    <Plus className="h-3.5 w-3.5" />
                                                    Add Selected ({selectedVariantIds.length})
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Scrollable Catalog Grid / List */}
                                        <div className="max-h-48 sm:max-h-52 overflow-y-auto rounded-lg border bg-background divide-y">
                                            {loadingVariants ? (
                                                <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    Loading product catalog...
                                                </div>
                                            ) : filteredVariants.length === 0 ? (
                                                <div className="p-4 text-center text-xs text-muted-foreground">
                                                    No products found matching filters.
                                                </div>
                                            ) : (
                                                filteredVariants.map((v) => {
                                                    const isSelected = selectedVariantIds.includes(v.id);
                                                    const inStock = v.stock_quantity > 0;
                                                    return (
                                                        <div
                                                            key={v.id}
                                                            className={`p-2 sm:p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 transition-colors ${
                                                                isSelected ? "bg-primary/5" : "hover:bg-muted/40"
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-2.5 min-w-0">
                                                                <Checkbox
                                                                    checked={isSelected}
                                                                    onCheckedChange={() => toggleSelectVariant(v.id)}
                                                                    className="shrink-0"
                                                                />

                                                                {/* Thumbnail image */}
                                                                <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-md border bg-muted/30 overflow-hidden shrink-0 flex items-center justify-center">
                                                                    {v.image_url ? (
                                                                        <img
                                                                            src={v.image_url}
                                                                            alt={v.product_name}
                                                                            className="h-full w-full object-cover"
                                                                        />
                                                                    ) : (
                                                                        <Package className="h-4 w-4 text-muted-foreground/60" />
                                                                    )}
                                                                </div>

                                                                <div className="min-w-0">
                                                                    <div className="font-semibold text-xs text-foreground truncate">
                                                                        {v.product_name}
                                                                    </div>
                                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                                                                        {v.sku && <span className="font-mono">SKU: {v.sku}</span>}
                                                                        <span>• Stock: <strong className={inStock ? "text-emerald-600" : "text-rose-600"}>{v.stock_quantity}</strong></span>
                                                                        <span>• Retail: ${v.price.toFixed(2)}</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="shrink-0 flex items-center gap-1.5 self-end sm:self-center">
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleAddSingleVariant(v)}
                                                                    className="h-7 text-[11px] font-semibold gap-1 px-2.5"
                                                                >
                                                                    <Plus className="h-3 w-3" /> Add
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {/* Section 3.B: Added Items for this Order / Invoice */}
                                    <div className="space-y-2.5 pt-1">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-2 rounded-lg bg-muted/30 border">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-600">
                                                    <Receipt className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                        Items in this Order / Invoice
                                                        <Badge variant="secondary" className="text-[10px] font-semibold h-5 px-1.5">
                                                            {items.length} product(s)
                                                        </Badge>
                                                    </h5>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        Set negotiated unit prices, adjust quantities, and verify line totals
                                                    </p>
                                                </div>
                                            </div>

                                            {items.length > 0 && (
                                                <div className="text-left sm:text-right shrink-0 self-start sm:self-auto">
                                                    <span className="text-xs font-bold text-foreground">
                                                        Subtotal: ${subtotal.toFixed(2)}
                                                    </span>
                                                    <span className="text-[11px] text-muted-foreground block">
                                                        {totalUnitsCount} total unit(s)
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Order Items Table (Added Products) */}
                                        {items.length === 0 ? (
                                            <div className="text-center py-6 border border-dashed rounded-xl text-muted-foreground text-xs bg-muted/10">
                                                <Package className="h-8 w-8 mx-auto mb-1.5 text-muted-foreground/40" />
                                                <p className="font-semibold text-foreground">No products added to this order yet</p>
                                                <p className="text-[11px] mt-0.5">
                                                    Select products from the catalog above and click "Add" or "Add Selected" to include them here.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 border rounded-xl divide-y bg-background shadow-sm">
                                            {items.map((item) => {
                                                const isPriceModified = item.unit_price !== item.standard_price;
                                                return (
                                                    <div key={item.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                                            {/* Thumbnail */}
                                                            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-md border bg-muted/30 overflow-hidden shrink-0 flex items-center justify-center">
                                                                {item.image_url ? (
                                                                    <img
                                                                        src={item.image_url}
                                                                        alt={item.product_name}
                                                                        className="h-full w-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <Package className="h-4 w-4 text-muted-foreground/60" />
                                                                )}
                                                            </div>

                                                            <div className="space-y-0.5 min-w-0">
                                                                <div className="font-semibold text-foreground text-sm truncate">
                                                                    {item.product_name}
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-muted-foreground text-[11px]">
                                                                    {item.sku && <span className="font-mono">SKU: {item.sku}</span>}
                                                                    <span>• Stock: {item.stock_quantity}</span>
                                                                    <span>• Standard: ${item.standard_price.toFixed(2)}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Controls: Price, Qty, Total, Delete */}
                                                        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 shrink-0">
                                                            {/* Unit Price Input (Differentiated price) */}
                                                            <div className="flex flex-col items-start sm:items-end gap-1">
                                                                <span className="text-[10px] text-muted-foreground font-semibold uppercase">
                                                                    Unit Price ($)
                                                                </span>
                                                                <div className="relative w-20 sm:w-24">
                                                                    <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                                                    <Input
                                                                        type="number"
                                                                        step="0.01"
                                                                        min="0"
                                                                        value={item.unit_price}
                                                                        onChange={(e) => handleUpdateItemPrice(item.id, parseFloat(e.target.value) || 0)}
                                                                        className={`h-8 pl-5 sm:pl-6 text-xs text-right font-bold ${
                                                                            isPriceModified ? "border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-300" : ""
                                                                        }`}
                                                                    />
                                                                </div>
                                                            </div>

                                                            {/* Qty Input */}
                                                            <div className="flex flex-col items-start sm:items-end gap-1">
                                                                <span className="text-[10px] text-muted-foreground font-semibold uppercase">
                                                                    Qty
                                                                </span>
                                                                <Input
                                                                    type="number"
                                                                    min="1"
                                                                    value={item.quantity}
                                                                    onChange={(e) => handleUpdateItemQty(item.id, parseInt(e.target.value) || 1)}
                                                                    className="h-8 w-14 sm:w-16 text-center text-xs font-bold"
                                                                />
                                                            </div>

                                                            {/* Line Total */}
                                                            <div className="flex flex-col items-end gap-1 min-w-[3.5rem] sm:w-20">
                                                                <span className="text-[10px] text-muted-foreground font-semibold uppercase">
                                                                    Total
                                                                </span>
                                                                <span className="text-xs sm:text-sm font-bold text-foreground">
                                                                    ${(item.unit_price * item.quantity).toFixed(2)}
                                                                </span>
                                                            </div>

                                                            {/* Remove */}
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0 self-end sm:self-center"
                                                                onClick={() => handleRemoveItem(item.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        )}
                                    </div>
                                </div>

                                {/* Section 4: Shipping, Payment & Status */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2 border-t text-xs">
                                    {/* Shipping Options */}
                                    <div className="space-y-3 p-3 sm:p-3.5 rounded-xl border bg-muted/20">
                                        <Label className="text-xs font-bold flex items-center gap-1.5">
                                            <Truck className="h-3.5 w-3.5 text-primary" />
                                            Shipping Fee Configuration
                                        </Label>

                                        <div className="flex items-center gap-2 sm:gap-3">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={isFreeShipping ? "default" : "outline"}
                                                className="h-8 text-xs font-semibold flex-1"
                                                onClick={() => {
                                                    setIsFreeShipping(true);
                                                    setCustomShippingCost("0.00");
                                                }}
                                            >
                                                Free Shipping ($0.00)
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={!isFreeShipping ? "default" : "outline"}
                                                className="h-8 text-xs font-semibold flex-1"
                                                onClick={() => setIsFreeShipping(false)}
                                            >
                                                Charge Shipping
                                            </Button>
                                        </div>

                                        {!isFreeShipping && (
                                            <div className="space-y-1">
                                                <Label className="text-[11px] text-muted-foreground">Custom Shipping Fee ($)</Label>
                                                <div className="relative">
                                                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        placeholder="9.99"
                                                        value={customShippingCost}
                                                        onChange={(e) => setCustomShippingCost(e.target.value)}
                                                        className="h-8 pl-7 text-xs font-semibold w-full"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Payment Method & Initial Status */}
                                    <div className="space-y-3 p-3 sm:p-3.5 rounded-xl border bg-muted/20">
                                        <Label className="text-xs font-bold flex items-center gap-1.5">
                                            <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                                            Payment Method & Initial Status
                                        </Label>

                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] text-muted-foreground">Payment Method</Label>
                                            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                                <SelectTrigger className="h-8 text-xs bg-background w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="external_invoice">External Invoice (Square / Direct Link)</SelectItem>
                                                    <SelectItem value="zelle">Zelle / Cash App (P2P)</SelectItem>
                                                    <SelectItem value="bank_wire">Bank Wire / ACH</SelectItem>
                                                    <SelectItem value="cash">Cash / Direct Cash</SelectItem>
                                                    <SelectItem value="offline_manual">Offline / Other Manual</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] text-muted-foreground">Initial Order Status</Label>
                                            <Select value={initialStatus} onValueChange={setInitialStatus}>
                                                <SelectTrigger className="h-8 text-xs bg-background font-semibold w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="ready_to_ship">
                                                        🟢 Ready to Ship (Paid - Deduct Stock & Create Label Now)
                                                    </SelectItem>
                                                    <SelectItem value="pending_payment">
                                                        🟡 Pending Payment (Unpaid - Deducts stock when marked paid)
                                                    </SelectItem>
                                                    <SelectItem value="processing">
                                                        🔵 Processing (Paid - Deduct Stock)
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                {/* Internal Notes */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Internal Order Notes (Optional)</Label>
                                    <Textarea
                                        placeholder="e.g. Negotiated wholesale rate of $18/vial for 30ml bac water and peptides. Agreed on WhatsApp."
                                        value={internalNotes}
                                        onChange={(e) => setInternalNotes(e.target.value)}
                                        className="h-16 text-xs resize-none w-full"
                                    />
                                </div>

                                {/* Financial Totals Summary Bar */}
                                <div className="p-3.5 sm:p-4 rounded-xl bg-card border flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                                    <div className="text-xs text-muted-foreground">
                                        Subtotal: <strong className="text-foreground">${subtotal.toFixed(2)}</strong> • 
                                        Shipping: <strong className="text-foreground">{effectiveShipping === 0 ? "FREE" : `$${effectiveShipping.toFixed(2)}`}</strong>
                                    </div>
                                    <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto">
                                        <span className="text-xs text-muted-foreground font-medium">Grand Total:</span>
                                        <span className="text-xl sm:text-2xl font-black tracking-tight text-primary">
                                            ${grandTotal.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Fixed Responsive Footer */}
                    {!createdOrderResult && (
                        <DialogFooter className="p-3 sm:p-4 border-t bg-muted/10 shrink-0 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
                            <Button 
                                variant="ghost" 
                                onClick={handleClose} 
                                disabled={isSubmitting} 
                                className="w-full sm:w-auto text-xs order-2 sm:order-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting || items.length === 0}
                                className="w-full sm:w-auto text-xs font-bold gap-2 px-5 py-2.5 sm:py-2 order-1 sm:order-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Creating Order...
                                    </>
                                ) : (
                                    <>
                                        <Check className="h-4 w-4" />
                                        <span>Create Order & Generate Invoice</span>
                                        <Badge variant="secondary" className="ml-1 bg-primary-foreground/20 text-primary-foreground">
                                            ${grandTotal.toFixed(2)}
                                        </Badge>
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>

            {/* Carrier Address Validation Modal */}
            {validationResult && (
                <AddressValidationModal
                    isOpen={showValidationModal}
                    onClose={() => setShowValidationModal(false)}
                    originalAddress={{
                        full_name: customerName,
                        line1: addressLine1,
                        line2: addressLine2 || undefined,
                        city,
                        state: stateProvince,
                        postal_code: postalCode,
                        country,
                    }}
                    recommendedAddress={recommendedAddress}
                    validationResult={{
                        valid: validationResult.valid,
                        validation_value: validationResult.validation_value || (validationResult.valid ? "valid" : "invalid"),
                        reasons: validationResult.reasons || [],
                        changed_attributes: validationResult.changed_attributes || [],
                        note: validationResult.note || addressValidationMessage,
                    }}
                    onConfirm={handleConfirmSuggestedAddress}
                />
            )}

            {/* Official Commercial Invoice Preview & Print Modal */}
            <InvoiceDialog
                open={isInvoicePreviewOpen}
                onOpenChange={setIsInvoicePreviewOpen}
                order={createdOrderResult}
            />
        </>
    );
};
export default CreateManualOrderDialog;
