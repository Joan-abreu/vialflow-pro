import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "@/contexts/CartContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import UniversalCheckout from "@/components/checkout/UniversalCheckout";
import { Loader2, LogIn, AlertTriangle, Package, Sparkles, Truck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { calculateShipping, getShippingLabel } from "@/utils/shipping";
import { AddressValidationModal } from "@/components/checkout/AddressValidationModal";
import { trackFunnelStep } from "@/utils/sessionTracker";
import { 
    DEFAULT_PEPTIDE_UPSELL_SETTINGS, 
    PeptideUpsellSettings, 
    calculatePeptideUpsellDiscount 
} from "@/config/upsellConfig";
import { usePeptideUpsellSettings } from "@/hooks/usePeptideUpsellSettings";
import { usePromoSplashSettings } from "@/hooks/usePromoSplashSettings";
import { getActiveCampaigns, resolveCartCampaigns } from "@/config/promoSplashConfig";

const Checkout = () => {
    const { items, cartTotal, updateCartContactInfo, cartSessionId } = useCart();
    const navigate = useNavigate();
    const { session, loading: authLoading } = useAuth();
    const [isProcessing, setIsProcessing] = useState(false);

    // Real-Time Shipping State
    const [shippingCost, setShippingCost] = useState<number>(0);
    const [shippingService, setShippingService] = useState<string>("");
    const [shippingServiceCode, setShippingServiceCode] = useState<string>("");
    const [shippingCarrier, setShippingCarrier] = useState<string>("");
    const [shippingEstimatedDays, setShippingEstimatedDays] = useState<number | undefined>(undefined);
    const [shippingRates, setShippingRates] = useState<any[]>([]);
    const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
    const [step, setStep] = useState<'address' | 'shipping' | 'payment'>('address');
    const [externalAddressUpdate, setExternalAddressUpdate] = useState<any>(null);
    
    // Coupon & Referral State
    const [couponCode, setCouponCode] = useState("");
    const [pendingCouponCode, setPendingCouponCode] = useState<string>("");
    const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
    const [appliedDiscounts, setAppliedDiscounts] = useState<any[]>([]);
    const [finalSubtotal, setFinalSubtotal] = useState<number>(cartTotal);
    const [finalShipping, setFinalShipping] = useState<number>(0);

    // Fetch dynamic upsell settings using unified hook
    const { data: upsellSettings } = usePeptideUpsellSettings();
    const activeUpsellSettings = upsellSettings || DEFAULT_PEPTIDE_UPSELL_SETTINGS;
    const upsellDiscount = useMemo(() => calculatePeptideUpsellDiscount(items, activeUpsellSettings), [items, activeUpsellSettings]);
    const autoDiscountAmount = (upsellDiscount.isEligible && appliedDiscounts.length === 0) ? upsellDiscount.discountAmount : 0;

    // Fetch active promotional splash campaigns and evaluate against cart
    const { data: promoSettings } = usePromoSplashSettings();
    const promoCampaigns = useMemo(() => {
        const rawCampaigns = promoSettings?.campaigns && promoSettings.campaigns.length > 0
            ? promoSettings.campaigns
            : (promoSettings?.enabled ? [promoSettings as any] : []);
        return getActiveCampaigns(rawCampaigns, "checkout");
    }, [promoSettings]);

    const evaluatedPromoCampaigns = useMemo(() => {
        return resolveCartCampaigns(promoCampaigns, items);
    }, [promoCampaigns, items]);

    const hasCampaignFreeShipping = useMemo(() => {
        return evaluatedPromoCampaigns.some(e => e.isUnlocked && !e.isSuppressed && e.campaign.offerMode === "free_shipping");
    }, [evaluatedPromoCampaigns]);

    // Calculate total weight (default to 1lb per item if weight is missing)
    const totalWeight = items.reduce((sum, item) => {
        const isBulkItem = item.is_bulk || item.variant.bulk_only;
        const itemWeight = isBulkItem 
            ? (item.variant.weight || 0) / (item.variant.pack_size || 1)
            : (item.variant.weight || 0);
        return sum + (itemWeight * item.quantity);
    }, 0);
    
    // Use final values if coupons are applied, otherwise fallback to standard with auto promo discount
    const displaySubtotal = appliedDiscounts.length > 0 ? finalSubtotal : Math.max(0, cartTotal - autoDiscountAmount);
    const displayShipping = appliedDiscounts.length > 0 ? finalShipping : shippingCost;
    const totalAmount = Number((displaySubtotal + displayShipping).toFixed(2));

    const [currentAddress, setCurrentAddress] = useState<any>(null);
    const [validationResult, setValidationResult] = useState<any>(null);
    const [showValidationModal, setShowValidationModal] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [requireLoginForCheckout, setRequireLoginForCheckout] = useState(true);
    const [freeShippingEnabled, setFreeShippingEnabled] = useState(true);
    const [freeShippingThreshold, setFreeShippingThreshold] = useState(100);

    // Track the amount for which we calculated
    const intentAmountRef = useRef<number>(0);
    const checkoutStartedRef = useRef<boolean>(false);
    const checkoutTopRef = useRef<HTMLDivElement>(null);
    const isFirstStepRender = useRef<boolean>(true);

    // Automatically scroll to the top of the active step on mobile and desktop
    useEffect(() => {
        if (isFirstStepRender.current) {
            isFirstStepRender.current = false;
            return;
        }

        const scrollToCheckoutTop = () => {
            if (checkoutTopRef.current) {
                const elementPosition = checkoutTopRef.current.getBoundingClientRect().top + window.scrollY;
                // 85px offset accounts for fixed navbar
                const offsetPosition = Math.max(0, elementPosition - 85);
                window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth"
                });
            } else {
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        };

        const timer = setTimeout(scrollToCheckoutTop, 60);
        return () => clearTimeout(timer);
    }, [step]);

    useEffect(() => {
        const fetchStoreSettings = async () => {
            try {
                const { data } = await supabase
                    .from("app_settings" as any)
                    .select("key, value")
                    .in("key", ["require_login_for_checkout", "shipping_free_enabled", "shipping_free_threshold"]);
                if (data && data.length > 0) {
                    const reqLogin = data.find((s: any) => s.key === "require_login_for_checkout");
                    const freeEnabled = data.find((s: any) => s.key === "shipping_free_enabled");
                    const threshold = data.find((s: any) => s.key === "shipping_free_threshold");
                    if (reqLogin && reqLogin.value !== undefined) setRequireLoginForCheckout(reqLogin.value === "true");
                    if (freeEnabled && freeEnabled.value !== undefined) setFreeShippingEnabled(freeEnabled.value === "true");
                    if (threshold && threshold.value !== undefined) setFreeShippingThreshold(Number(threshold.value) || 100);
                }
            } catch (e) {}
        };
        fetchStoreSettings();
    }, []);

    useEffect(() => {
        if (!checkoutStartedRef.current && items.length > 0) {
            checkoutStartedRef.current = true;
            trackFunnelStep("begin_checkout", {
                cartTotal,
                itemCount: items.length,
            }, cartSessionId);

            if (typeof window !== 'undefined') {
                const dataLayer = (window as any).dataLayer = (window as any).dataLayer || [];
                dataLayer.push({
                    event: 'begin_checkout',
                    ecommerce: {
                        currency: 'USD',
                        value: cartTotal,
                        items: items.map(item => ({
                            item_id: item.variant.id,
                            item_name: item.variant.product.name,
                            price: item.variant.price,
                            quantity: item.quantity
                        }))
                    }
                });
            }
        }
    }, [items, cartTotal, cartSessionId]);

    // Handle Address change from Square Form (Silent update with early contact capture)
    const handleAddressChange = useCallback((address: any) => {
        setCurrentAddress(address);

        // Early contact capture to link customer info & location to cart session
        if (address) {
            updateCartContactInfo({
                email: address.email || undefined,
                phone: address.phone || undefined,
                customer_name: address.full_name || undefined,
                city: address.city || undefined,
                region: address.state || undefined,
                country: address.country === "US" ? "United States" : (address.country || undefined),
                country_code: address.country || undefined,
            });
        }

        // Reset shipping if address changes
        if (shippingService) {
           setShippingCost(0);
           setShippingService("");
           setShippingRates([]);
        }
    }, [shippingService, updateCartContactInfo]);

    const validateAndProceed = async () => {
        if (requireLoginForCheckout && !session) {
            toast.error("Please sign in or create an account to proceed.");
            document.getElementById("checkout-auth-card")?.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        if (!currentAddress) {
            toast.error("Please provide your shipping address.");
            return;
        }
        
        // Strict Full Name check
        if (!currentAddress.full_name || currentAddress.full_name.trim().length < 3) {
            toast.error("Please enter your full name.");
            return;
        }

        const isComplete = (currentAddress.line1?.length > 5) && 
                          (currentAddress.city?.length > 2) && 
                          (currentAddress.state?.length >= 2) && 
                          (currentAddress.postal_code?.length >= 5);

        if (!isComplete) {
            toast.error("Please provide a complete shipping address.");
            return;
        }

        setIsValidating(true);
        try {
            const { data, error } = await supabase.functions.invoke('validate-address', {
                body: { address: currentAddress }
            });

            if (error) throw error; 
            
            setValidationResult(data);
            
            const hasChanges = (data.changed_attributes || []).length > 0;
            const isInvalid = data.validation_value === 'invalid';
            const isPartiallyValid = data.validation_value === 'partially_valid';

            // Show modal if invalid OR if it has suggested changes/partially valid (as requested by user)
            if (isInvalid || isPartiallyValid || hasChanges) {
                setShowValidationModal(true);
            } else {
                // Perfectly valid
                await calculateRates(currentAddress);
                trackFunnelStep("address_entered", {
                    city: currentAddress?.city,
                    state: currentAddress?.state,
                    zip: currentAddress?.postal_code,
                }, cartSessionId);
                setStep('shipping');
            }
        } catch (error: any) {
            toast.error("Could not verify address. Please try again.");
        } finally {
            setIsValidating(false);
        }
    };

    const calculateRates = async (address: any, customSubtotal?: number) => {
        setIsCalculatingShipping(true);
        const subtotalToUse = typeof customSubtotal === 'number' ? customSubtotal : displaySubtotal;
        try {
            const { data, error } = await supabase.functions.invoke('calculate-shipping', {
                body: { 
                    weight: totalWeight, 
                    address,
                    subtotal: subtotalToUse,
                    items: items.map(item => {
                        const isBulkItem = item.is_bulk || item.variant.bulk_only;
                        const itemWeight = isBulkItem 
                            ? (item.variant.weight || 0) / (item.variant.pack_size || 1)
                            : (item.variant.weight || 0);

                        return {
                            variant_id: item.variant.id,
                            quantity: item.quantity,
                            weight: itemWeight,
                            length: item.variant.dimension_length,
                            width: item.variant.dimension_width,
                            height: item.variant.dimension_height,
                            is_bulk: isBulkItem || false,
                            with_labels: item.with_labels || false
                        };
                    })
                }
            });

            if (error) throw error;
            
            let rates = data.rates || [];
            if (rates.length > 0) {
                rates = rates.filter((rate: any) => {
                    const provider = (rate.carrier || rate.provider || "").toUpperCase();
                    const serviceName = (rate.serviceName || rate.service || "").toUpperCase();
                    if (provider.includes('FEDEX') || serviceName.includes('FEDEX')) {
                        return serviceName.includes('GROUND') || serviceName.includes('EXPRESS');
                    }
                    return true;
                });

                // Apply campaign-based free shipping if unlocked
                if (hasCampaignFreeShipping) {
                    const isExpressOrOvernight = (rate: any) => {
                        const text = ((rate.serviceName || rate.service || "") + " " + (rate.serviceCode || rate.service_code || "")).toUpperCase();
                        return (
                            text.includes("EXPRESS") ||
                            text.includes("OVERNIGHT") ||
                            text.includes("2DAY") ||
                            text.includes("2_DAY") ||
                            text.includes("AIR")
                        );
                    };

                    const groundRate = rates.find((r: any) => !isExpressOrOvernight(r));
                    if (groundRate && !groundRate.is_free) {
                        groundRate.original_cost = groundRate.cost;
                        groundRate.cost = 0;
                        groundRate.is_free = true;
                        groundRate.free_shipping_reason = "Free shipping unlocked by active promotion";
                        rates.sort((a: any, b: any) => a.cost - b.cost);
                    }
                }
            }
            setShippingRates(rates);
            if (rates.length > 0) {
                // Auto-select the lowest cost / free rate immediately so the Continue button is active
                const defaultRate = rates.find((r: any) => r.is_free || r.cost === 0 || r.rate === 0) || rates[0];
                if (defaultRate) {
                    handleShippingSelect(defaultRate);
                }
            } else {
                toast.error("No shipping rates found.");
            }
        } catch (error: any) {
            toast.error("Error calculating shipping rates.");
        } finally {
            setIsCalculatingShipping(false);
        }
    };

    const handleConfirmSuggestion = async (suggestedAddress: any) => {
        const fullSuggested = {
            ...currentAddress,
            ...suggestedAddress
        };
        setCurrentAddress(fullSuggested);
        setExternalAddressUpdate(fullSuggested);
        setShowValidationModal(false);
        await calculateRates(fullSuggested);
        trackFunnelStep("address_entered", {
            city: fullSuggested.city,
            state: fullSuggested.state,
            zip: fullSuggested.postal_code,
            isSuggested: true,
        }, cartSessionId);
        setStep('shipping');
    };

    const handleShippingSelect = (rate: any) => {
        const isFree = rate.is_free || rate.cost === 0;
        const cost = isFree ? 0 : (rate.rate || rate.cost || 0);
        setShippingCost(cost);
        setShippingService(rate.serviceName || rate.service || rate.service_name);
        setShippingServiceCode(rate.serviceCode || rate.service_code || rate.service); 
        setShippingCarrier((rate.carrier || rate.provider || "FEDEX").toUpperCase());
        setShippingEstimatedDays(rate.estimated_days || rate.estimatedDays);
        intentAmountRef.current = 0;

        trackFunnelStep("shipping_selected", {
            carrier: rate.carrier || rate.provider,
            service: rate.serviceName || rate.service,
            cost: cost,
            estimatedDays: rate.estimated_days || rate.estimatedDays,
        }, cartSessionId);

        // Re-validate coupons only if an applied discount targets shipping
        const hasShippingDiscount = appliedDiscounts.some(d => d.target === 'shipping' || d.target === 'all');
        if (hasShippingDiscount) {
            handleApplyCoupon(appliedDiscounts.map(d => d.code), cost, false);
        } else {
            setFinalShipping(cost);
        }
    };

    // Auto-apply referral/promo code from URL param or storage on mount
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref') || localStorage.getItem('vialflow_referral_code');
        if (refCode && appliedDiscounts.length === 0) {
            const cleanRef = refCode.trim().toUpperCase();
            localStorage.setItem('vialflow_referral_code', cleanRef);
            handleApplyCoupon([cleanRef], undefined, false);
        }
    }, []);

    // Auto-retry pending or restricted coupon as soon as customer email becomes known
    const userEmailForCoupons = session?.user?.email || currentAddress?.email;
    useEffect(() => {
        if (userEmailForCoupons) {
            if (pendingCouponCode && appliedDiscounts.length === 0) {
                const codeToRetry = pendingCouponCode;
                setPendingCouponCode("");
                handleApplyCoupon([codeToRetry], undefined, false);
            }
        }
    }, [userEmailForCoupons]);

    const handleApplyCoupon = async (codesInput?: string[], currentShipCost?: number, shouldRecalculateRates = false) => {
        const currentlyApplied = appliedDiscounts.map(d => d.code);
        const codeTyped = couponCode.trim().toUpperCase();
        const codesToValidate = codesInput || (codeTyped ? [...currentlyApplied, codeTyped] : currentlyApplied);
        
        if (codesToValidate.length === 0) return;
        
        // Avoid duplicate codes
        const uniqueCodes = Array.from(new Set(codesToValidate.map(c => c.trim().toUpperCase())));

        if (codeTyped && !codesInput) {
            setPendingCouponCode(codeTyped);
        }

        setIsValidatingCoupon(true);
        try {
            const emailToValidate = session?.user?.email || currentAddress?.email;
            const { data, error } = await supabase.functions.invoke('validate-coupon', {
                body: { 
                    codes: uniqueCodes, 
                    subtotal: cartTotal, 
                    shipping: currentShipCost ?? shippingCost,
                    userId: session?.user?.id,
                    email: emailToValidate,
                    shippingAddress: currentAddress ? {
                        line1: currentAddress.line1 || currentAddress.street1,
                        zip: currentAddress.postal_code || currentAddress.zip,
                    } : null
                }
            });

            if (error) throw error;

            setAppliedDiscounts(data.appliedDiscounts || []);
            setFinalSubtotal(data.subtotal);
            setFinalShipping(data.shipping);
            setPendingCouponCode("");

            if (shouldRecalculateRates && currentAddress && shippingRates.length > 0) {
                calculateRates(currentAddress, data.subtotal);
            }
            
            if (!codesInput) {
                if (data.appliedDiscounts.length > appliedDiscounts.length) {
                    toast.success("Coupon applied!");
                    setCouponCode("");
                } else {
                    toast.error("Invalid or expired coupon.");
                }
            }
        } catch (error: any) {
            let message = "This code could not be applied. Please check it and try again.";
            
            // Handle Supabase Functions error specifically
            if (error.context) {
                try {
                    const body = await error.context.json();
                    if (body && body.error) {
                        message = body.error;
                    }
                } catch (e) {
                    // Ignore parse error
                }
            } else if (error.message && !error.message.includes("non-2xx")) {
                message = error.message;
            }

            if (message.toLowerCase().includes("non-2xx") || message.toLowerCase().includes("failed to fetch") || message.toLowerCase().includes("internal") || message.toLowerCase().includes("edge function")) {
                message = "This code could not be applied. Please check it and try again.";
            }
            
            toast.error(message);
        } finally {
            setIsValidatingCoupon(false);
        }
    };

    const removeCoupon = (codeToRemove: string) => {
        const newCodes = appliedDiscounts
            .filter(d => d.code !== codeToRemove)
            .map(d => d.code);
        
        if (newCodes.length === 0) {
            setAppliedDiscounts([]);
            setFinalSubtotal(cartTotal);
            setFinalShipping(shippingCost);
            if (currentAddress && shippingRates.length > 0) {
                calculateRates(currentAddress, cartTotal);
            }
        } else {
            handleApplyCoupon(newCodes);
        }
    };

    const nextStep = () => {
        if (step === 'address') {
            validateAndProceed();
        } else if (step === 'shipping') {
            if (!shippingService) {
                if (shippingRates.length > 0) {
                    const defaultRate = shippingRates.find((r: any) => r.is_free || r.cost === 0 || r.rate === 0) || shippingRates[0];
                    handleShippingSelect(defaultRate);
                } else {
                    toast.error("Please select a shipping method to continue.");
                    return;
                }
            }
            trackFunnelStep("payment_selected", {
                subtotal: displaySubtotal,
                shipping: displayShipping,
                total: totalAmount,
                itemCount: items.length,
            }, cartSessionId);
            setStep('payment');
        }
    };

    const prevStep = () => {
        if (step === 'shipping') setStep('address');
        else if (step === 'payment') setStep('shipping');
    };

    const canGoNext = () => {
        if (step === 'address') {
            if (requireLoginForCheckout && !session) return false;
            return true;
        }
        if (step === 'shipping') return !!shippingService && !isCalculatingShipping;
        return false;
    };

    if (authLoading) {
        return (
            <div className="container py-12 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="container py-12 text-center">
                <h1 className="text-3xl font-bold mb-4">Your cart is empty</h1>
                <p className="text-muted-foreground">Add some products to proceed to checkout.</p>
            </div>
        );
    }

    return (
        <div className="container py-12" ref={checkoutTopRef}>
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h1 className="text-3xl font-bold">Checkout</h1>
                
                {/* Visual Stepper */}
                <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-full px-4 border">
                    <div className={`flex items-center gap-2 ${step === 'address' ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'address' ? 'bg-primary text-white' : 'bg-muted border'}`}>1</span>
                        <span className="hidden sm:inline">
                            {requireLoginForCheckout && !session ? "Account & Address" : "Address"}
                        </span>
                    </div>
                    <div className="w-4 h-px bg-border"></div>
                    <div className={`flex items-center gap-2 ${step === 'shipping' ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'shipping' ? 'bg-primary text-white' : 'bg-muted border'}`}>2</span>
                        <span className="hidden sm:inline">Shipping</span>
                    </div>
                    <div className="w-4 h-px bg-border"></div>
                    <div className={`flex items-center gap-2 ${step === 'payment' ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'payment' ? 'bg-primary text-white' : 'bg-muted border'}`}>3</span>
                        <span className="hidden sm:inline">Payment</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Main Checkout Area */}
                    <div className="bg-card border rounded-lg p-6 shadow-sm">
                        <div className="mb-6 border-b pb-4">
                            <h2 className="text-xl font-semibold">
                                {step === 'address' 
                                    ? (requireLoginForCheckout && !session ? "Account & Delivery" : "Address Details")
                                    : step === 'shipping' ? "Shipping Details" : "Payment Details"}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {step === 'address' && (
                                    requireLoginForCheckout && !session 
                                        ? "Sign in or create an account to proceed with your order." 
                                        : "Provide your delivery information."
                                )}
                                {step === 'shipping' && "Choose how you want your items delivered."}
                                {step === 'payment' && "Enter your payment details to complete the order."}
                            </p>
                        </div>

                        <UniversalCheckout
                            amount={totalAmount}
                            shippingCost={displayShipping}
                            shippingService={shippingService}
                            shippingServiceCode={shippingServiceCode}
                            shippingCarrier={shippingCarrier}
                            estimatedDays={shippingEstimatedDays}
                            tax={0}
                            onAddressChange={handleAddressChange}
                            externalAddress={externalAddressUpdate}
                            isCalculating={isCalculatingShipping || isValidating || isValidatingCoupon}
                            hideAddress={step !== 'address'}
                            hidePayment={step !== 'payment'}
                            appliedDiscounts={appliedDiscounts}
                        />
                        
                        {step === 'address' && validationResult && (
                            <AddressValidationModal
                                isOpen={showValidationModal}
                                onClose={() => setShowValidationModal(false)}
                                originalAddress={currentAddress}
                                recommendedAddress={validationResult.suggestions?.[0]}
                                validationResult={validationResult}
                                onConfirm={handleConfirmSuggestion}
                            />
                        )}

                        {step === 'shipping' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                {isValidating ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
                                        <p className="text-sm font-medium">Verifying Address...</p>
                                    </div>
                                ) : isCalculatingShipping ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
                                        <p className="text-sm font-medium">Fetching real-time rates...</p>
                                    </div>
                                ) : shippingRates.length > 0 ? (
                                    <div className="space-y-3">
                                        {(hasCampaignFreeShipping || (freeShippingEnabled && displaySubtotal >= freeShippingThreshold)) ? (
                                            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                                                <Sparkles className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                                <span>🎉 You unlocked Free Standard Shipping on this order!</span>
                                            </div>
                                        ) : freeShippingEnabled ? (
                                            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border text-xs text-muted-foreground">
                                                <Truck className="h-4 w-4 shrink-0 text-primary" />
                                                <span>Add <strong className="text-foreground font-bold">${(freeShippingThreshold - displaySubtotal).toFixed(2)}</strong> more to unlock <strong>Free Standard Shipping</strong>!</span>
                                            </div>
                                        ) : null}

                                        {shippingRates.map((rate, idx) => {
                                            const isSelected = shippingService === (rate.serviceName || rate.service);
                                            const isFree = rate.is_free || rate.cost === 0;
                                            const originalCost = rate.original_cost || rate.originalCost;

                                            return (
                                                <div
                                                    key={idx}
                                                    className={`
                                                        flex justify-between items-center p-4 rounded-lg border-2 cursor-pointer transition-all
                                                        ${isSelected 
                                                            ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20' 
                                                            : 'border-border hover:border-primary/50 hover:bg-muted/50'}
                                                    `}
                                                    onClick={() => handleShippingSelect(rate)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>
                                                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold text-base">{rate.serviceName || rate.service}</span>
                                                                {isFree && (
                                                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                                                        Free Standard
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-sm text-muted-foreground">
                                                                {(rate.carrier || rate.provider || 'FEDEX').toUpperCase()} — Est. {rate.estimated_days || rate.estimatedDays || 'N/A'} {rate.estimated_days || rate.estimatedDays ? 'days' : ''}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        {isFree ? (
                                                            <div className="flex items-center gap-1.5 justify-end">
                                                                {originalCost && (
                                                                    <span className="line-through text-xs text-muted-foreground">${originalCost.toFixed(2)}</span>
                                                                )}
                                                                <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">FREE</span>
                                                            </div>
                                                        ) : (
                                                            <span className="font-bold text-lg">
                                                                ${(rate.rate || rate.cost).toFixed(2)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center border-2 border-dashed rounded-lg">
                                        <p className="text-muted-foreground">
                                            {currentAddress?.line1 
                                                ? "No shipping rates found for this address. Please go back and verify your address." 
                                                : "Please go back and enter your address details."}
                                        </p>
                                        <Button variant="outline" className="mt-4" onClick={() => setStep('address')}>
                                            Go Back to Address
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Navigation Footer */}
                        <div className="mt-8 pt-6 border-t flex justify-between items-center">
                            {step !== 'address' ? (
                                <Button variant="ghost" onClick={prevStep} className="flex items-center gap-2">
                                    Back to {step === 'shipping' ? 'Address' : 'Shipping'}
                                </Button>
                            ) : <div></div>}
                            
                            {step !== 'payment' && (
                                <Button 
                                    onClick={nextStep} 
                                    disabled={isValidating || isCalculatingShipping}
                                    className="px-8 font-semibold shadow-lg hover:scale-105 active:scale-95 transition-all"
                                >
                                    {step === 'address' ? (
                                        isValidating ? (
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span>Verifying...</span>
                                            </div>
                                        ) : 'Continue to Shipping'
                                    ) : (
                                        isCalculatingShipping ? (
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span>Calculating...</span>
                                            </div>
                                        ) : 'Continue to Payment'
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>

                <div>
                    <div className="bg-muted/30 rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-4">Order Review</h2>
                        <div className="space-y-4">
                            {items.map((item) => {
                                const displayImage = item.variant.image_url || (item.variant.images && item.variant.images[0]) || item.variant.product.image_url;
                                const isPeptide = item.variant.product.category?.toLowerCase().includes("peptide") || item.variant.vial_type?.name?.toLowerCase().includes("mg");

                                return (
                                    <div key={item.variant.id} className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="h-12 w-12 bg-background rounded-md border flex items-center justify-center overflow-hidden flex-shrink-0 shadow-xs">
                                                {displayImage ? (
                                                    <img src={displayImage} alt={item.variant.product.name} className="h-full w-full object-cover" />
                                                ) : (
                                                    <Package className="h-5 w-5 text-muted-foreground/60" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-sm text-foreground">{item.variant.product.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {isPeptide ? (
                                                        <>
                                                            <span>{item.variant.vial_type.name || `${item.variant.vial_type.capacity_ml}mg`}</span>
                                                            {item.variant.pack_size > 1 ? (
                                                                <span className="font-medium text-foreground"> ({item.variant.pack_size}x Pack)</span>
                                                            ) : (
                                                                <span> (Single Vial)</span>
                                                            )}
                                                            <span> • Qty: {item.quantity}</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span>{item.variant.vial_type.name || `${item.variant.vial_type.capacity_ml}ml`}</span>
                                                            {item.variant.vial_type.color && <span> - {item.variant.vial_type.color}</span>}
                                                            {item.variant.vial_type.shape && <span> - {item.variant.vial_type.shape}</span>}
                                                            {item.variant.pack_size > 1 && <span> ({item.variant.pack_size}x Pack)</span>}
                                                            <span> • Qty: {item.quantity}</span>
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="font-semibold text-sm">${(item.variant.price * item.quantity).toFixed(2)}</span>
                                    </div>
                                );
                            })}
                            
                            {/* Promo Campaign Unlocked Free Gifts */}
                            {evaluatedPromoCampaigns.filter(e => e.isUnlocked && !e.isSuppressed && e.campaign.offerMode === "gift_with_purchase").map((giftPerk) => (
                                <div key={giftPerk.campaign.id} className="flex justify-between items-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
                                    <div className="flex items-center gap-3">
                                        <div className="h-12 w-12 bg-background rounded-md border flex items-center justify-center overflow-hidden flex-shrink-0 shadow-xs">
                                            {giftPerk.campaign.rewardProductImage ? (
                                                <img 
                                                    src={giftPerk.campaign.rewardProductImage} 
                                                    alt={giftPerk.campaign.rewardProductName || "Free Gift"} 
                                                    className="h-full w-full object-cover" 
                                                />
                                            ) : (
                                                <Package className="h-5 w-5 text-emerald-500" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                                                <Sparkles className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                                {giftPerk.campaign.rewardProductName || "Research Free Gift"}
                                            </p>
                                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                                Free Promotional Perk • Qty: {giftPerk.campaign.rewardQuantity || 1}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">FREE</span>
                                </div>
                            ))}

                            <div className="border-t pt-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Subtotal</span>
                                    <div className="flex items-center gap-2">
                                        {displaySubtotal < cartTotal && (
                                            <span className="line-through text-muted-foreground">${cartTotal.toFixed(2)}</span>
                                        )}
                                        <span className="font-medium">${displaySubtotal.toFixed(2)}</span>
                                    </div>
                                </div>
                                {upsellDiscount.isEligible && upsellDiscount.discountAmount > 0 && appliedDiscounts.length === 0 && (
                                    <div className="flex justify-between items-center text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                                        <span className="flex items-center gap-1.5">
                                            <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                            {upsellDiscount.discountLabel}
                                        </span>
                                        <span>-${upsellDiscount.discountAmount.toFixed(2)}</span>
                                    </div>
                                )}
                                {appliedDiscounts.map((d, i) => (
                                    <div key={i} className="flex justify-between text-sm text-green-600 font-medium">
                                        <div className="flex items-center gap-1">
                                            <span>
                                                {d.isReferralTracking ? "Referral Code" : "Discount"} ({d.code})
                                            </span>
                                            <button onClick={() => removeCoupon(d.code)} className="text-destructive hover:text-destructive/80 ml-1">×</button>
                                        </div>
                                        <span>{d.amount > 0 ? `-$${d.amount.toFixed(2)}` : "Applied"}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-base font-medium">
                                    <span>Shipping</span>
                                    <div className="flex items-center gap-2">
                                        {displayShipping < shippingCost && shippingCost > 0 && (
                                            <span className="line-through text-muted-foreground text-sm font-normal">${shippingCost.toFixed(2)}</span>
                                        )}
                                        <span>
                                            {shippingService ? (
                                                displayShipping === 0 ? (
                                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">FREE</span>
                                                ) : (
                                                    `$${displayShipping.toFixed(2)}`
                                                )
                                            ) : (
                                                step === 'address' ? '--' : 'Select method'
                                            )}
                                        </span>
                                    </div>
                                </div>
                                {shippingService && (
                                    <div className="text-xs text-muted-foreground text-right -mt-1 italic">
                                        {shippingService} {displayShipping === 0 && "(Free Ground)"}
                                    </div>
                                )}
                                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                                    <span>Total</span>
                                    <div className="flex flex-col items-end">
                                        <div className="flex items-center gap-2">
                                            {totalAmount < Number((cartTotal + shippingCost).toFixed(2)) && (
                                                <span className="line-through text-muted-foreground text-sm font-normal">${(cartTotal + shippingCost).toFixed(2)}</span>
                                            )}
                                            <span>${totalAmount.toFixed(2)}</span>
                                        </div>
                                        {totalAmount === 0 && <span className="text-[10px] text-green-600 uppercase">Free Order</span>}
                                    </div>
                                </div>
                                
                                <div className="pt-4 mt-4 border-t">
                                    <div className="flex gap-2">
                                        <Input 
                                            placeholder="Promo or Referral Code" 
                                            value={couponCode}
                                            onChange={(e) => setCouponCode(e.target.value)}
                                            className="h-9 transition-all focus:ring-1"
                                            onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                                        />
                                        <Button 
                                            variant="secondary" 
                                            size="sm" 
                                            onClick={() => handleApplyCoupon()}
                                            disabled={isValidatingCoupon || !couponCode.trim()}
                                        >
                                            {isValidatingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default Checkout;
