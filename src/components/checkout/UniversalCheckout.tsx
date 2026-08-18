import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, AlertTriangle, CreditCard as CardIcon, ShieldCheck, CheckCircle2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PaymentForm, CreditCard as SquareCreditCard } from "react-square-web-payments-sdk";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Link, useNavigate } from "react-router-dom";
import { DEFAULT_PAYMENT_SETTINGS, PaymentGatewayProvider, PaymentGatewaysSettings } from "@/config/paymentGateways";

interface UniversalCheckoutProps {
    amount: number;
    shippingCost: number;
    shippingService: string;
    shippingServiceCode?: string;
    shippingCarrier?: string;
    estimatedDays?: number;
    tax: number;
    onAddressChange?: (address: any) => void;
    externalAddress?: any;
    isCalculating?: boolean;
    hideAddress?: boolean;
    hideShipping?: boolean;
    hidePayment?: boolean;
    appliedDiscounts?: any[];
}

// -------------------------------------------------------------
// Stripe Embedded Form Component (Matches button style)
// -------------------------------------------------------------
interface StripeFormInnerProps {
    amount: number;
    loading: boolean;
    setLoading: (l: boolean) => void;
    isCalculating?: boolean;
    shippingService: string;
    shippingCost: number;
    requireResearchAck: boolean;
    ackResearch: boolean;
    ackTerms: boolean;
    onSuccess: (intentId: string) => Promise<void>;
}

const StripeFormInner = ({
    amount,
    loading,
    setLoading,
    isCalculating,
    shippingService,
    shippingCost,
    requireResearchAck,
    ackResearch,
    ackTerms,
    onSuccess
}: StripeFormInnerProps) => {
    const stripe = useStripe();
    const elements = useElements();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements) return;

        if (requireResearchAck && (!ackResearch || !ackTerms)) {
            toast.error("Please acknowledge the Research Use Only and Terms conditions.");
            return;
        }

        if (!shippingService || shippingCost === undefined) {
            toast.error("Please select a shipping method before proceeding.");
            return;
        }

        setLoading(true);

        try {
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                redirect: "if_required",
            });

            if (error) {
                toast.error(error.message || "Payment confirmation failed");
                setLoading(false);
            } else if (paymentIntent && (paymentIntent.status === "succeeded" || paymentIntent.status === "processing")) {
                await onSuccess(paymentIntent.id);
            } else {
                toast.error("Payment was not completed. Please check your card details.");
                setLoading(false);
            }
        } catch (err: any) {
            console.error("Stripe payment error:", err);
            toast.error(err.message || "An unexpected error occurred");
            setLoading(false);
        }
    };

    const isButtonDisabled = isCalculating || !shippingService || shippingCost === undefined || (requireResearchAck && (!ackResearch || !ackTerms)) || loading;

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-3 border rounded-md bg-background">
                <PaymentElement />
            </div>
            <Button
                type="submit"
                disabled={isButtonDisabled}
                className="w-full py-6 text-base font-bold transition-all shadow-md"
            >
                {loading ? (
                    <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processing Secure Payment...
                    </>
                ) : isCalculating ? (
                    "Calculating Shipping..."
                ) : !shippingService || shippingCost === undefined ? (
                    "Select Shipping Method"
                ) : requireResearchAck && (!ackResearch || !ackTerms) ? (
                    "Acknowledge terms to pay"
                ) : (
                    `Pay $${amount.toFixed(2)} with Card`
                )}
            </Button>
        </form>
    );
};


// -------------------------------------------------------------
// Main Universal Checkout Component
// -------------------------------------------------------------
const UniversalCheckout = ({
    amount,
    shippingCost,
    shippingService,
    shippingServiceCode,
    shippingCarrier,
    estimatedDays,
    tax,
    onAddressChange,
    externalAddress,
    isCalculating,
    hideAddress,
    hideShipping,
    hidePayment,
    appliedDiscounts
}: UniversalCheckoutProps) => {
    const { items, clearCart } = useCart();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [saveAddress, setSaveAddress] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [requireResearchAck, setRequireResearchAck] = useState(false);
    const [ackResearch, setAckResearch] = useState(false);
    const [ackTerms, setAckTerms] = useState(false);

    // Multi-Gateway Dynamic Settings State
    const [gatewaySettings, setGatewaySettings] = useState<PaymentGatewaysSettings>(DEFAULT_PAYMENT_SETTINGS);
    const [activeProvider, setActiveProvider] = useState<PaymentGatewayProvider>("square");
    const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
    const [manualReference, setManualReference] = useState("");
    const paypalContainerRef = useRef<HTMLDivElement>(null);
    const [paypalSdkLoaded, setPaypalSdkLoaded] = useState(false);

    // Generic Card Form State (Authorize.Net, Clover, NMI)
    const [cardData, setCardData] = useState({
        number: "",
        expMonth: "",
        expYear: "",
        cvv: "",
        cardholderName: ""
    });

    // Custom Address Collection State
    const [addressState, setAddressState] = useState({
        full_name: "",
        email: "",
        line1: "",
        line2: "",
        city: "",
        state: "",
        postal_code: "",
        country: "US"
    });

    // 1. Fetch site settings & payment gateway configuration
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data } = await supabase
                    .from("app_settings" as any)
                    .select("key, value")
                    .in("key", [
                        "require_research_acknowledgment",
                        "payment_active_provider",
                        "payment_backup_provider",
                        "payment_auto_failover",
                        "payment_fail_threshold",
                        "payment_square_config",
                        "payment_stripe_config",
                        "payment_authorizenet_config",
                        "payment_clover_config",
                        "payment_nmi_config",
                        "payment_paypal_config",
                        "payment_manual_config"
                    ]);

                if (data && data.length > 0) {
                    const ack = data.find(s => s.key === "require_research_acknowledgment");
                    const activeP = data.find(s => s.key === "payment_active_provider");
                    const backupP = data.find(s => s.key === "payment_backup_provider");
                    const autoFail = data.find(s => s.key === "payment_auto_failover");
                    const failThresh = data.find(s => s.key === "payment_fail_threshold");
                    const squareCfg = data.find(s => s.key === "payment_square_config");
                    const stripeCfg = data.find(s => s.key === "payment_stripe_config");
                    const authNetCfg = data.find(s => s.key === "payment_authorizenet_config");
                    const cloverCfg = data.find(s => s.key === "payment_clover_config");
                    const nmiCfg = data.find(s => s.key === "payment_nmi_config");
                    const paypalCfg = data.find(s => s.key === "payment_paypal_config");
                    const manualCfg = data.find(s => s.key === "payment_manual_config");

                    if (ack) setRequireResearchAck(ack.value === "true");
                    
                    const newProvider = (activeP?.value as PaymentGatewayProvider) || DEFAULT_PAYMENT_SETTINGS.activeProvider;
                    setActiveProvider(newProvider);

                    setGatewaySettings(prev => ({
                        ...prev,
                        activeProvider: newProvider,
                        backupProvider: (backupP?.value as PaymentGatewayProvider) || prev.backupProvider,
                        autoFailoverEnabled: autoFail ? autoFail.value === "true" : prev.autoFailoverEnabled,
                        failThreshold: failThresh ? Number(failThresh.value) : prev.failThreshold,
                        square: squareCfg?.value ? { ...prev.square, ...JSON.parse(squareCfg.value) } : prev.square,
                        stripe: stripeCfg?.value ? { ...prev.stripe, ...JSON.parse(stripeCfg.value) } : prev.stripe,
                        authorizenet: authNetCfg?.value ? { ...prev.authorizenet, ...JSON.parse(authNetCfg.value) } : prev.authorizenet,
                        clover: cloverCfg?.value ? { ...prev.clover, ...JSON.parse(cloverCfg.value) } : prev.clover,
                        nmi: nmiCfg?.value ? { ...prev.nmi, ...JSON.parse(nmiCfg.value) } : prev.nmi,
                        paypal: paypalCfg?.value ? { ...prev.paypal, ...JSON.parse(paypalCfg.value) } : prev.paypal,
                        manual: manualCfg?.value ? { ...prev.manual, ...JSON.parse(manualCfg.value) } : prev.manual,
                    }));
                }
            } catch (err) {
                console.error("Error fetching payment settings:", err);
            }
        };
        fetchSettings();
    }, []);

    // Sync externalAddress if provided
    useEffect(() => {
        if (externalAddress) {
            setAddressState(prev => ({
                ...prev,
                ...externalAddress
            }));
        }
    }, [externalAddress]);

    // Fetch user & profile for address autofill
    useEffect(() => {
        let isMounted = true;
        const fetchUserAndProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!isMounted) return;
            setUser(user);

            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (isMounted && profile) {
                    setProfile(profile);
                    setAddressState(prev => {
                        const next = {
                            ...prev,
                            full_name: prev.full_name || profile.full_name || "",
                            email: user.email || "",
                            line1: prev.line1 || profile.shipping_address_line1 || "",
                            line2: prev.line2 || profile.shipping_address_line2 || "",
                            city: prev.city || profile.shipping_city || "",
                            state: prev.state || profile.shipping_state || "",
                            postal_code: prev.postal_code || profile.shipping_postal_code || "",
                            country: "US"
                        };
                        if (onAddressChange) onAddressChange(next);
                        return next;
                    });
                }
            }
        };
        fetchUserAndProfile();
        return () => { isMounted = false; };
    }, []);

    // Dynamically load Accept.js if Authorize.Net is active
    useEffect(() => {
        if (activeProvider === "authorizenet") {
            const scriptId = "authorizenet-accept-js";
            if (!document.getElementById(scriptId)) {
                const script = document.createElement("script");
                script.id = scriptId;
                script.src = gatewaySettings.authorizenet.environment === "production"
                    ? "https://js.authorize.net/v1/Accept.js"
                    : "https://jstest.authorize.net/v1/Accept.js";
                script.async = true;
                document.body.appendChild(script);
            }
        }
    }, [activeProvider, gatewaySettings.authorizenet.environment]);

    // Dynamically load PayPal SDK if PayPal is active
    useEffect(() => {
        const paypalClientId = gatewaySettings.paypal.clientId || import.meta.env.VITE_PAYPAL_CLIENT_ID;
        if (activeProvider === "paypal" && paypalClientId && !paypalClientId.includes("your-paypal-client-id")) {
            const scriptId = "paypal-sdk-script";
            let script = document.getElementById(scriptId) as HTMLScriptElement;
            if (!script) {
                script = document.createElement("script");
                script.id = scriptId;
                script.src = `https://www.paypal.com/sdk/js?client-id=${paypalClientId}&currency=USD&intent=capture`;
                script.async = true;
                script.onload = () => setPaypalSdkLoaded(true);
                document.body.appendChild(script);
            } else {
                setPaypalSdkLoaded(true);
            }
        }
    }, [activeProvider, gatewaySettings.paypal.clientId]);

    // Render PayPal Buttons when loaded
    useEffect(() => {
        if (activeProvider === "paypal" && paypalSdkLoaded && paypalContainerRef.current && (window as any).paypal) {
            paypalContainerRef.current.innerHTML = "";
            try {
                (window as any).paypal.Buttons({
                    style: {
                        layout: 'vertical',
                        color: 'gold',
                        shape: 'rect',
                        label: 'paypal'
                    },
                    createOrder: (data: any, actions: any) => {
                        return actions.order.create({
                            purchase_units: [{
                                amount: {
                                    value: amount.toFixed(2)
                                }
                            }]
                        });
                    },
                    onApprove: async (data: any, actions: any) => {
                        const details = await actions.order.capture();
                        await handleProcessPayment(undefined, undefined, undefined, details.id);
                    },
                    onError: (err: any) => {
                        console.error("PayPal Error:", err);
                        toast.error("PayPal checkout error. Please try again.");
                    }
                }).render(paypalContainerRef.current);
            } catch (e) {
                console.error("Error rendering PayPal buttons:", e);
            }
        }
    }, [activeProvider, paypalSdkLoaded, amount]);

    // Initialize Stripe Client
    const stripePromise = useMemo(() => {
        const pk = gatewaySettings.stripe.publishableKey || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
        if (activeProvider === "stripe" && pk && pk.startsWith("pk_") && !pk.includes("your_publishable_key")) {
            return loadStripe(pk);
        }
        return null;
    }, [activeProvider, gatewaySettings.stripe.publishableKey]);

    useEffect(() => {
        if (activeProvider === "stripe" && amount > 0 && shippingService) {
            const initStripeIntent = async () => {
                try {
                    const response = await fetch(`${supabase.supabaseUrl}/functions/v1/create-payment-intent`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${supabase.supabaseKey}`,
                            "apikey": supabase.supabaseKey,
                        },
                        body: JSON.stringify({
                            amount: amount,
                            currency: "usd",
                        }),
                    });
                    const data = await response.json();
                    if (data?.clientSecret) {
                        setStripeClientSecret(data.clientSecret);
                    }
                } catch (e) {
                    console.warn("Could not create Stripe PaymentIntent:", e);
                }
            };
            initStripeIntent();
        }
    }, [activeProvider, amount, shippingService]);

    const handleAddressInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const updated = { ...addressState, [name]: value };
        setAddressState(updated);
        if (onAddressChange) onAddressChange(updated);
    };

    const handleStreetManualChange = (val: string) => {
        const updated = { ...addressState, line1: val };
        setAddressState(updated);
        if (onAddressChange) onAddressChange(updated);
    };

    // Helper: Create draft order in Supabase
    const createDraftOrder = async (): Promise<string> => {
        let orderUserId = user?.id || null;

        if (user && saveAddress) {
            await supabase
                .from('profiles')
                .update({
                    shipping_address_line1: addressState.line1,
                    shipping_address_line2: addressState.line2,
                    shipping_city: addressState.city,
                    shipping_state: addressState.state,
                    shipping_postal_code: addressState.postal_code,
                    shipping_country: addressState.country
                })
                .eq('user_id', user.id);
        }

        const orderData = {
            user_id: orderUserId,
            customer_email: user ? user.email : addressState.email,
            status: "pending",
            total_amount: amount,
            tax_amount: tax,
            shipping_cost: shippingCost,
            shipping_service: shippingService,
            shipping_service_code: shippingServiceCode || null,
            shipping_carrier: shippingCarrier || null,
            estimated_delivery_days: estimatedDays || null,
            shipping_address_line1: addressState.line1,
            shipping_address_line2: addressState.line2,
            shipping_city: addressState.city,
            shipping_state: addressState.state,
            shipping_postal_code: addressState.postal_code,
            shipping_country: addressState.country,
            customer_name: addressState.full_name,
            payment_method: activeProvider,
        };

        const { data: order, error: orderError } = await supabase
            .from("orders")
            .insert(orderData)
            .select()
            .single();

        if (orderError) throw orderError;

        // Insert Order Items
        const orderItems = items.map((item) => {
            const isBulk = item.is_bulk || item.variant.bulk_only;
            const singleVialPrice = item.variant.price / (item.variant.pack_size || 1);
            let itemPrice = isBulk ? (item.variant.bulk_price || singleVialPrice) : item.variant.price;
            if (isBulk && item.with_labels) {
                itemPrice += (item.variant.bulk_label_fee !== undefined ? item.variant.bulk_label_fee : 0.15);
            }
            return {
                order_id: order.id,
                variant_id: item.variant.id,
                product_id: item.variant.product_id,
                quantity: item.quantity,
                unit_price: itemPrice,
                custom_label_url: item.custom_label_url || null,
                custom_label_instructions: item.custom_label_instructions || null,
            };
        });

        const { error: itemsError } = await supabase
            .from("order_items")
            .insert(orderItems);

        if (itemsError) throw itemsError;

        return order.id;
    };

    // -------------------------------------------------------------
    // Generic Universal Payment Execution
    // -------------------------------------------------------------
    const handleProcessPayment = async (sourceId?: string, paymentIntentId?: string, opaqueData?: any, paypalOrderId?: string) => {
        setLoading(true);

        try {
            const orderId = await createDraftOrder();

            const response = await fetch(`${supabase.supabaseUrl}/functions/v1/process-universal-payment`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${supabase.supabaseKey}`,
                    "apikey": supabase.supabaseKey,
                },
                body: JSON.stringify({
                    provider: activeProvider,
                    sourceId,
                    paymentIntentId,
                    paypalOrderId,
                    opaqueData,
                    amount,
                    currency: "USD",
                    orderId,
                    customerEmail: user ? user.email : addressState.email,
                    locationId: gatewaySettings.square.locationId || import.meta.env.VITE_SQUARE_LOCATION_ID,
                    apiLoginId: gatewaySettings.authorizenet.apiLoginId,
                    merchantId: gatewaySettings.clover.merchantId,
                    nmiSecurityKey: gatewaySettings.nmi.securityKey,
                    cardDetails: (activeProvider === "nmi" || activeProvider === "clover") ? cardData : undefined,
                    isProduction: 
                        activeProvider === "square" ? gatewaySettings.square.environment === "production" :
                        activeProvider === "authorizenet" ? gatewaySettings.authorizenet.environment === "production" :
                        activeProvider === "clover" ? gatewaySettings.clover.environment === "production" :
                        gatewaySettings.paypal.environment === "production",
                    items: items.map(item => ({
                        name: `${item.variant.product.name} (${item.variant.vial_type.name})`,
                        quantity: item.quantity,
                        price: item.variant.price,
                        basePriceMoney: {
                            amount: Math.round(item.variant.price * 100),
                            currency: "USD"
                        }
                    })),
                    shippingAddress: {
                        addressLine1: addressState.line1,
                        addressLine2: addressState.line2,
                        locality: addressState.city,
                        administrativeDistrictLevel1: addressState.state,
                        postalCode: addressState.postal_code,
                        country: addressState.country,
                        firstName: addressState.full_name.split(' ')[0] || '',
                        lastName: addressState.full_name.split(' ').slice(1).join(' ') || ''
                    },
                    shippingCost,
                    tax,
                    applied_coupons: appliedDiscounts?.map(d => d.code) || [],
                    discounts: appliedDiscounts || [],
                    manualReference
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                if (result.isCriticalAccountError && gatewaySettings.autoFailoverEnabled && gatewaySettings.backupProvider !== activeProvider) {
                    console.warn(`[Failover Triggered] Switching from ${activeProvider} to ${gatewaySettings.backupProvider}`);
                    toast.error(`Primary payment processor temporarily unavailable. Switching to secure backup processor...`);
                    setActiveProvider(gatewaySettings.backupProvider);
                    setLoading(false);
                    return;
                }
                throw new Error(result.error || "Payment failed");
            }

            clearCart();
            toast.success("Order placed successfully!");
            navigate(`/order-success/${orderId}`);
        } catch (error: any) {
            console.error("Payment execution error:", error);
            toast.error(error.message || "Failed to process payment");
        } finally {
            setLoading(false);
        }
    };

    // Authorize.Net Accept.js Card Tokenization Handler
    const handleAuthorizeNetSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (requireResearchAck && (!ackResearch || !ackTerms)) {
            toast.error("Please acknowledge terms before proceeding.");
            return;
        }

        if (!shippingService || shippingCost === undefined) {
            toast.error("Please select a shipping method before paying.");
            return;
        }

        if (!gatewaySettings.authorizenet.apiLoginId || !gatewaySettings.authorizenet.clientKey) {
            toast.error("Authorize.Net API Login ID or Client Key is missing in Site Settings.");
            return;
        }

        const accept = (window as any).Accept;
        if (!accept) {
            toast.error("Authorize.Net security library is loading. Please try again in a few seconds.");
            return;
        }

        setLoading(true);

        const authData = {
            clientKey: gatewaySettings.authorizenet.clientKey,
            apiLoginID: gatewaySettings.authorizenet.apiLoginId,
        };

        const cardPayload = {
            cardNumber: cardData.number.replace(/\s+/g, ''),
            month: cardData.expMonth.padStart(2, '0'),
            year: cardData.expYear.length === 2 ? `20${cardData.expYear}` : cardData.expYear,
            cardCode: cardData.cvv,
        };

        accept.dispatchData({ authData, cardData: cardPayload }, (response: any) => {
            if (response.messages.resultCode === "Error") {
                const errText = response.messages.message?.[0]?.text || "Card validation failed";
                toast.error(errText);
                setLoading(false);
            } else {
                handleProcessPayment(response.opaqueData.dataValue, undefined, response.opaqueData);
            }
        });
    };

    const squareAppId = gatewaySettings.square.appId || import.meta.env.VITE_SQUARE_APP_ID || "sandbox-sq0idb-your-app-id";
    const squareLocationId = gatewaySettings.square.locationId || import.meta.env.VITE_SQUARE_LOCATION_ID || "sandbox-location-id";

    return (
        <div className="space-y-6">
            <CardContent className="space-y-6 px-0">
                {!hideAddress && (
                    /* Custom Address Collection */
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-foreground/80">Shipping Address</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2 space-y-1.5">
                                <Label htmlFor="full_name" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    Full Name <span className="text-destructive">*</span>
                                </Label>
                                <Input 
                                    id="full_name" 
                                    placeholder="John Doe" 
                                    name="full_name" 
                                    value={addressState.full_name} 
                                    onChange={handleAddressInputChange} 
                                    required 
                                    autoComplete="name" 
                                />
                            </div>
                            {!user && (
                                <div className="md:col-span-2 space-y-1.5">
                                    <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        Email Address <span className="text-destructive">*</span>
                                    </Label>
                                    <Input 
                                        id="email" 
                                        type="email" 
                                        placeholder="john@example.com" 
                                        name="email" 
                                        value={addressState.email} 
                                        onChange={handleAddressInputChange} 
                                        required 
                                        autoComplete="email" 
                                    />
                                    <p className="text-[10px] text-muted-foreground">We'll send your receipt and tracking info here.</p>
                                </div>
                            )}
                            <div className="md:col-span-2 space-y-1.5">
                                <Label htmlFor="line1" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    Address Line 1 <span className="text-destructive">*</span>
                                </Label>
                                <Input 
                                    id="line1" 
                                    name="line1"
                                    value={addressState.line1}
                                    onChange={(e) => handleStreetManualChange(e.target.value)}
                                    required 
                                    autoComplete="address-line1" 
                                />
                            </div>
                            <div className="md:col-span-2 space-y-1.5">
                                <Label htmlFor="line2" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    Suite / Apt (Optional)
                                </Label>
                                <Input 
                                    id="line2" 
                                    placeholder="Suite 400" 
                                    name="line2" 
                                    value={addressState.line2} 
                                    onChange={handleAddressInputChange} 
                                    autoComplete="address-line2" 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="city" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">City</Label>
                                <Input 
                                    id="city" 
                                    placeholder="San Francisco" 
                                    name="city" 
                                    value={addressState.city} 
                                    onChange={handleAddressInputChange} 
                                    required 
                                    autoComplete="address-level2" 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="state" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">State</Label>
                                <Input 
                                    id="state" 
                                    placeholder="CA" 
                                    name="state" 
                                    value={addressState.state} 
                                    onChange={handleAddressInputChange} 
                                    required 
                                    autoComplete="address-level1" 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="postal_code" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">ZIP Code</Label>
                                <Input 
                                    id="postal_code" 
                                    placeholder="94103" 
                                    name="postal_code" 
                                    value={addressState.postal_code} 
                                    onChange={handleAddressInputChange} 
                                    required 
                                    autoComplete="postal-code" 
                                />
                            </div>
                            <div className="space-y-1.5 opacity-70">
                                <Label htmlFor="country" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Country</Label>
                                <Input id="country" value="US" readOnly className="bg-muted cursor-not-allowed" />
                            </div>
                        </div>
                        {user && (
                            <div className="flex items-center space-x-2 pt-2">
                                <Checkbox 
                                    id="save-address" 
                                    checked={saveAddress} 
                                    onCheckedChange={(c) => setSaveAddress(c as boolean)} 
                                />
                                <Label htmlFor="save-address" className="text-sm text-muted-foreground font-normal cursor-pointer select-none">
                                    Save this address for future orders
                                </Label>
                            </div>
                        )}
                    </div>
                )}

                {!hidePayment && (
                    <div className="space-y-4">
                        {/* RUO & Terms Acknowledgment Alert */}
                        {requireResearchAck && (
                            <div className="p-4 rounded-lg border-l-4 border-destructive bg-destructive/5 space-y-3 text-left shadow-xs">
                                <div className="flex items-center gap-2 text-destructive font-semibold text-xs uppercase tracking-wider">
                                    <AlertTriangle className="h-4 w-4" />
                                    Research Use Only — Required Acknowledgment
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    By submitting your payment, you confirm that:
                                </p>
                                
                                <div className="space-y-3">
                                    <div className="flex items-start space-x-2">
                                        <Checkbox 
                                            id="checkout-ruo-ack" 
                                            checked={ackResearch} 
                                            onCheckedChange={(checked) => setAckResearch(checked === true)} 
                                            className="mt-1 flex-shrink-0"
                                        />
                                        <Label htmlFor="checkout-ruo-ack" className="text-xs text-muted-foreground font-normal leading-normal cursor-pointer select-none">
                                            I am a qualified researcher, scientist, or institutional professional purchasing on behalf of a licensed research institution, laboratory, or organization. I understand that all products are exclusively for <strong>laboratory research use only (RUO)</strong> and are <strong>not approved or intended for use in humans or animals</strong>, nor for clinical, diagnostic, or therapeutic purposes.
                                        </Label>
                                    </div>

                                    <div className="flex items-start space-x-2">
                                        <Checkbox 
                                            id="checkout-terms-ack" 
                                            checked={ackTerms} 
                                            onCheckedChange={(checked) => setAckTerms(checked === true)} 
                                            className="mt-1 flex-shrink-0"
                                        />
                                        <Label htmlFor="checkout-terms-ack" className="text-xs text-muted-foreground font-normal leading-normal cursor-pointer select-none">
                                            I have read and agree to the <Link to="/terms" target="_blank" className="text-primary hover:underline font-medium">Terms & Conditions</Link>.
                                        </Label>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium flex items-center gap-2">
                                <CardIcon className="h-4 w-4 text-primary" />
                                Payment Details
                            </h3>
                            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                <ShieldCheck className="h-3 w-3" />
                                <span>256-Bit Encrypted</span>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-card p-4 rounded-md border min-h-[120px]">
                            {/* Case A: Free Order ($0) */}
                            {amount === 0 ? (
                                <Button 
                                    className="w-full py-6 text-lg font-bold bg-green-600 hover:bg-green-700 text-white shadow-lg transition-all"
                                    onClick={() => handleProcessPayment()}
                                    disabled={loading || (requireResearchAck && (!ackResearch || !ackTerms))}
                                >
                                    {loading ? (
                                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                    ) : requireResearchAck && (!ackResearch || !ackTerms) ? (
                                        "Acknowledge terms to complete"
                                    ) : (
                                        "Complete Free Order"
                                    )}
                                </Button>
                            ) : activeProvider === "square" ? (
                                /* Case B: Square Payments SDK */
                                squareAppId.includes("your-app-id") || squareLocationId.includes("location-id") ? (
                                    <div className="flex flex-col items-center justify-center text-center p-4 text-orange-600 bg-orange-50 dark:bg-orange-950/20 rounded">
                                        <p className="font-semibold">Square API Keys Missing</p>
                                        <p className="text-sm">Please set VITE_SQUARE_APP_ID and VITE_SQUARE_LOCATION_ID in your environment or Site Settings.</p>
                                    </div>
                                ) : (
                                    <PaymentForm
                                        applicationId={squareAppId}
                                        locationId={squareLocationId}
                                        cardTokenizeResponseReceived={((token: any) => {
                                            if (typeof window !== 'undefined' && (window as any).dataLayer) {
                                                (window as any).dataLayer.push({
                                                    event: 'click_pay_button',
                                                    event_category: 'ecommerce',
                                                    event_label: 'Square Checkout',
                                                    value: amount,
                                                    currency: 'USD'
                                                });
                                            }
                                            if (token.status === "OK") {
                                                handleProcessPayment(token.token);
                                            } else {
                                                toast.error(token.errors?.[0]?.message || "Could not validate card");
                                            }
                                        }) as any}
                                    >
                                        <SquareCreditCard 
                                            buttonProps={{
                                                css: {
                                                    backgroundColor: (isCalculating || !shippingService || shippingCost === undefined || (requireResearchAck && (!ackResearch || !ackTerms))) ? '#cccccc' : 'hsl(var(--primary))',
                                                    color: '#fff',
                                                    cursor: (isCalculating || !shippingService || shippingCost === undefined || (requireResearchAck && (!ackResearch || !ackTerms))) ? 'not-allowed' : 'pointer',
                                                    pointerEvents: (isCalculating || !shippingService || shippingCost === undefined || (requireResearchAck && (!ackResearch || !ackTerms))) ? 'none' : 'auto',
                                                    fontFamily: 'Inter, sans-serif',
                                                    '&:hover': {
                                                        backgroundColor: (isCalculating || !shippingService || shippingCost === undefined || (requireResearchAck && (!ackResearch || !ackTerms))) ? '#cccccc' : 'hsl(var(--primary) / 0.9)',
                                                    }
                                                }
                                            }}
                                        >
                                            {isCalculating 
                                                ? "Calculating Shipping..." 
                                                : !shippingService || shippingCost === undefined 
                                                    ? "Select Shipping Method" 
                                                    : (requireResearchAck && (!ackResearch || !ackTerms))
                                                        ? "Acknowledge terms to pay"
                                                        : `Pay $${amount.toFixed(2)}`
                                            }
                                        </SquareCreditCard>
                                    </PaymentForm>
                                )
                            ) : activeProvider === "stripe" ? (
                                /* Case C: Stripe Elements */
                                stripePromise && stripeClientSecret ? (
                                    <Elements 
                                        stripe={stripePromise} 
                                        options={{ 
                                            clientSecret: stripeClientSecret,
                                            appearance: { theme: 'stripe' }
                                        }}
                                    >
                                        <StripeFormInner
                                            amount={amount}
                                            loading={loading}
                                            setLoading={setLoading}
                                            isCalculating={isCalculating}
                                            shippingService={shippingService}
                                            shippingCost={shippingCost}
                                            requireResearchAck={requireResearchAck}
                                            ackResearch={ackResearch}
                                            ackTerms={ackTerms}
                                            onSuccess={async (intentId) => {
                                                await handleProcessPayment(undefined, intentId);
                                            }}
                                        />
                                    </Elements>
                                ) : (
                                    <div className="flex items-center justify-center p-6 text-muted-foreground text-sm">
                                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                        Preparing secure Stripe checkout...
                                    </div>
                                )
                            ) : activeProvider === "authorizenet" ? (
                                /* Case D: Authorize.Net Accept.js Form */
                                <form onSubmit={handleAuthorizeNetSubmit} className="space-y-4 text-left">
                                    <div className="space-y-3">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="authnet_card" className="text-xs">Card Number</Label>
                                            <Input
                                                id="authnet_card"
                                                placeholder="4000 1234 5678 9010"
                                                value={cardData.number}
                                                onChange={(e) => setCardData({ ...cardData, number: e.target.value })}
                                                required
                                                maxLength={19}
                                            />
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="authnet_month" className="text-xs">Month (MM)</Label>
                                                <Input
                                                    id="authnet_month"
                                                    placeholder="12"
                                                    value={cardData.expMonth}
                                                    onChange={(e) => setCardData({ ...cardData, expMonth: e.target.value })}
                                                    required
                                                    maxLength={2}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="authnet_year" className="text-xs">Year (YY/YYYY)</Label>
                                                <Input
                                                    id="authnet_year"
                                                    placeholder="28"
                                                    value={cardData.expYear}
                                                    onChange={(e) => setCardData({ ...cardData, expYear: e.target.value })}
                                                    required
                                                    maxLength={4}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="authnet_cvv" className="text-xs">CVV</Label>
                                                <Input
                                                    id="authnet_cvv"
                                                    placeholder="123"
                                                    value={cardData.cvv}
                                                    onChange={(e) => setCardData({ ...cardData, cvv: e.target.value })}
                                                    required
                                                    maxLength={4}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        type="submit"
                                        disabled={isCalculating || !shippingService || shippingCost === undefined || (requireResearchAck && (!ackResearch || !ackTerms)) || loading}
                                        className="w-full py-6 text-base font-bold shadow-md"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                Processing Card with Authorize.Net...
                                            </>
                                        ) : isCalculating ? (
                                            "Calculating Shipping..."
                                        ) : !shippingService || shippingCost === undefined ? (
                                            "Select Shipping Method"
                                        ) : requireResearchAck && (!ackResearch || !ackTerms) ? (
                                            "Acknowledge terms to pay"
                                        ) : (
                                            `Pay $${amount.toFixed(2)} with Authorize.Net`
                                        )}
                                    </Button>
                                </form>
                            ) : activeProvider === "nmi" ? (
                                /* Case E: NMI (Network Merchants Inc.) Direct Card Form */
                                <form onSubmit={(e) => {
                                    e.preventDefault();
                                    if (requireResearchAck && (!ackResearch || !ackTerms)) {
                                        toast.error("Please acknowledge terms before proceeding.");
                                        return;
                                    }
                                    if (!shippingService || shippingCost === undefined) {
                                        toast.error("Please select a shipping method before paying.");
                                        return;
                                    }
                                    handleProcessPayment();
                                }} className="space-y-4 text-left">
                                    <div className="space-y-3">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="nmi_card" className="text-xs">Card Number</Label>
                                            <Input
                                                id="nmi_card"
                                                placeholder="4000 1234 5678 9010"
                                                value={cardData.number}
                                                onChange={(e) => setCardData({ ...cardData, number: e.target.value })}
                                                required
                                                maxLength={19}
                                            />
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="nmi_month" className="text-xs">Month (MM)</Label>
                                                <Input
                                                    id="nmi_month"
                                                    placeholder="12"
                                                    value={cardData.expMonth}
                                                    onChange={(e) => setCardData({ ...cardData, expMonth: e.target.value })}
                                                    required
                                                    maxLength={2}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="nmi_year" className="text-xs">Year (YY/YYYY)</Label>
                                                <Input
                                                    id="nmi_year"
                                                    placeholder="28"
                                                    value={cardData.expYear}
                                                    onChange={(e) => setCardData({ ...cardData, expYear: e.target.value })}
                                                    required
                                                    maxLength={4}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="nmi_cvv" className="text-xs">CVV</Label>
                                                <Input
                                                    id="nmi_cvv"
                                                    placeholder="123"
                                                    value={cardData.cvv}
                                                    onChange={(e) => setCardData({ ...cardData, cvv: e.target.value })}
                                                    required
                                                    maxLength={4}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        type="submit"
                                        disabled={isCalculating || !shippingService || shippingCost === undefined || (requireResearchAck && (!ackResearch || !ackTerms)) || loading}
                                        className="w-full py-6 text-base font-bold shadow-md"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                Processing Card with NMI...
                                            </>
                                        ) : isCalculating ? (
                                            "Calculating Shipping..."
                                        ) : !shippingService || shippingCost === undefined ? (
                                            "Select Shipping Method"
                                        ) : requireResearchAck && (!ackResearch || !ackTerms) ? (
                                            "Acknowledge terms to pay"
                                        ) : (
                                            `Pay $${amount.toFixed(2)} with NMI`
                                        )}
                                    </Button>
                                </form>
                            ) : activeProvider === "paypal" ? (
                                /* Case F: PayPal Checkout & Wallet */
                                <div className="space-y-4">
                                    <div ref={paypalContainerRef} className="min-h-[150px] flex items-center justify-center">
                                        {!paypalSdkLoaded && (
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Loading PayPal checkout...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : activeProvider === "clover" ? (
                                /* Case G: Clover Direct Secure Card Form */
                                <div className="space-y-4 text-left">
                                    <div className="space-y-3">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="clover_card" className="text-xs">Card Number</Label>
                                            <Input
                                                id="clover_card"
                                                placeholder="Card Number"
                                                value={cardData.number}
                                                onChange={(e) => setCardData({ ...cardData, number: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="clover_month" className="text-xs">MM</Label>
                                                <Input
                                                    id="clover_month"
                                                    placeholder="MM"
                                                    value={cardData.expMonth}
                                                    onChange={(e) => setCardData({ ...cardData, expMonth: e.target.value })}
                                                    required
                                                    maxLength={2}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="clover_year" className="text-xs">YY</Label>
                                                <Input
                                                    id="clover_year"
                                                    placeholder="YY"
                                                    value={cardData.expYear}
                                                    onChange={(e) => setCardData({ ...cardData, expYear: e.target.value })}
                                                    required
                                                    maxLength={2}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="clover_cvv" className="text-xs">CVV</Label>
                                                <Input
                                                    id="clover_cvv"
                                                    placeholder="CVV"
                                                    value={cardData.cvv}
                                                    onChange={(e) => setCardData({ ...cardData, cvv: e.target.value })}
                                                    required
                                                    maxLength={4}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={() => handleProcessPayment("clv_card_token_sim")}
                                        disabled={isCalculating || !shippingService || shippingCost === undefined || (requireResearchAck && (!ackResearch || !ackTerms)) || loading}
                                        className="w-full py-6 text-base font-bold shadow-md"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                Processing with Clover...
                                            </>
                                        ) : isCalculating ? (
                                            "Calculating Shipping..."
                                        ) : !shippingService || shippingCost === undefined ? (
                                            "Select Shipping Method"
                                        ) : requireResearchAck && (!ackResearch || !ackTerms) ? (
                                            "Acknowledge terms to pay"
                                        ) : (
                                            `Pay $${amount.toFixed(2)} with Clover`
                                        )}
                                    </Button>
                                </div>
                            ) : (
                                /* Case H: Manual / P2P / Zelle / Cash App */
                                <div className="space-y-4 text-left">
                                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
                                        <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                                            <CheckCircle2 className="h-4 w-4 text-primary" />
                                            Direct Transfer / P2P Payment Instructions
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            {gatewaySettings.manual.instructions || "Please submit your payment using one of the methods below and include your name or Order ID in the payment memo."}
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                                            {gatewaySettings.manual.zelleEmail && (
                                                <div className="p-2.5 rounded bg-background border">
                                                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Zelle Recipient</span>
                                                    <strong className="text-purple-600 dark:text-purple-400">{gatewaySettings.manual.zelleEmail}</strong>
                                                    {gatewaySettings.manual.zelleName && <span className="text-muted-foreground block text-[10px]">({gatewaySettings.manual.zelleName})</span>}
                                                </div>
                                            )}
                                            {gatewaySettings.manual.cashAppTag && (
                                                <div className="p-2.5 rounded bg-background border">
                                                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Cash App</span>
                                                    <strong className="text-emerald-600 dark:text-emerald-400">{gatewaySettings.manual.cashAppTag}</strong>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="manualRef" className="text-xs font-medium">
                                            Payment Reference / Confirmation Memo (Optional)
                                        </Label>
                                        <Input
                                            id="manualRef"
                                            placeholder="e.g. Zelle transaction ID or Cash App username"
                                            value={manualReference}
                                            onChange={(e) => setManualReference(e.target.value)}
                                        />
                                    </div>

                                    <Button
                                        className="w-full py-6 text-base font-bold shadow-md"
                                        disabled={isCalculating || !shippingService || shippingCost === undefined || (requireResearchAck && (!ackResearch || !ackTerms)) || loading}
                                        onClick={() => handleProcessPayment()}
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                Submitting Order...
                                            </>
                                        ) : isCalculating ? (
                                            "Calculating Shipping..."
                                        ) : !shippingService || shippingCost === undefined ? (
                                            "Select Shipping Method"
                                        ) : requireResearchAck && (!ackResearch || !ackTerms) ? (
                                            "Acknowledge terms to submit"
                                        ) : (
                                            `Confirm & Place Order ($${amount.toFixed(2)})`
                                        )}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>

            {loading && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-xs flex items-center justify-center z-20 rounded-lg">
                    <div className="flex flex-col items-center bg-card p-6 rounded-xl shadow-xl border">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                        <span className="text-sm font-semibold">Processing Secure Payment...</span>
                        <span className="text-xs text-muted-foreground mt-1">Please do not close this window</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UniversalCheckout;
