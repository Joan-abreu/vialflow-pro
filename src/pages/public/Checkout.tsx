import { useEffect, useState, useRef } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { useCart } from "@/contexts/CartContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import StripeCheckout from "@/components/checkout/StripeCheckout";
import SquareCheckout from "@/components/checkout/SquareCheckout";
import { Loader2, LogIn } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { calculateShipping, getShippingLabel } from "@/utils/shipping";

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");
const USE_SQUARE = true;

const Checkout = () => {
    const { items, cartTotal } = useCart();
    const navigate = useNavigate();
    const { session, loading: authLoading } = useAuth();
    const [clientSecret, setClientSecret] = useState("");
    const [paymentIntentId, setPaymentIntentId] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    // Real-Time Shipping State
    const [shippingCost, setShippingCost] = useState<number>(0);
    const [shippingService, setShippingService] = useState<string>("");
    const [shippingServiceCode, setShippingServiceCode] = useState<string>("");
    const [shippingCarrier, setShippingCarrier] = useState<string>("");
    const [shippingEstimatedDays, setShippingEstimatedDays] = useState<number | undefined>(undefined);
    const [shippingRates, setShippingRates] = useState<any[]>([]);
    const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);

    // Calculate total weight (default to 1lb per item if weight is missing)
    const totalWeight = items.reduce((sum, item) => {
        return sum + ((item.variant.weight || 0) * item.quantity);
    }, 0);

    const totalAmount = Number((cartTotal + shippingCost).toFixed(2));

    // Handle Address Change from StripeCheckout
    const handleAddressChange = async (address: any) => {
        console.log("Checkout handleAddressChange called", address);
        if (!address?.country || !address?.state) {
            console.log("Missing country or state, skipping calculation");
            return;
        }

        setIsCalculatingShipping(true);
        // Reset selected shipping when address changes until we get new rates
        setShippingCost(0);
        setShippingService("");
        setShippingEstimatedDays(undefined);
        setShippingRates([]);

        try {
            // Validate address first to give user feedback
            const { data: valData, error: valErr } = await supabase.functions.invoke('validate-address', {
                body: { address }
            });

            if (valErr) {
               console.warn("Address validation error:", valErr);
            } else if (valData && !valData.valid) {
               if (valData.suggestions && valData.suggestions.length > 0) {
                   const sugg = valData.suggestions[0].AddressKeyFormat;
                   let line = "";
                   if (Array.isArray(sugg?.AddressLine)) line = sugg.AddressLine.join(', ');
                   else if (typeof sugg?.AddressLine === 'string') line = sugg.AddressLine;
                   
                   const city = sugg?.PoliticalDivision2 || '';
                   const zip = sugg?.PostcodePrimaryLow || '';
                   toast.warning(`UPS suggests a correction. Did you mean: ${line}, ${city} ${zip}?`, { duration: 8000 });
               } else {
                   toast.warning("UPS does not recognize this specific address. Please double-check for typos or missing apartment numbers.");
               }
            }

            const { data, error } = await supabase.functions.invoke('calculate-shipping', {
                body: { 
                    weight: totalWeight, 
                    address,
                    items: items.map(item => ({
                        quantity: item.quantity,
                        weight: item.variant.weight,
                        length: item.variant.dimension_length,
                        width: item.variant.dimension_width,
                        height: item.variant.dimension_height
                    }))
                }
            });

            if (error) throw error;

            console.log("Shipping Rates:", data.rates);

            let rates = data.rates || [];

            // Filter FedEx rates to only show GROUND and EXPRESS
            if (rates.length > 0) {
                rates = rates.filter((rate: any) => {
                    const provider = (rate.carrier || rate.provider || "").toUpperCase();
                    const serviceName = (rate.serviceName || rate.service || "").toUpperCase();

                    if (provider.includes('FEDEX') || serviceName.includes('FEDEX')) {
                        return serviceName.includes('GROUND') || serviceName.includes('EXPRESS');
                    }
                    return true;
                });
            }

            setShippingRates(rates);

            // Auto-select the first (cheapest) rate by default from the FILTERED list
            if (rates && rates.length > 0) {
                const cheapest = rates[0];
                setShippingCost(cheapest.rate || cheapest.cost);
                setShippingService(cheapest.serviceName || cheapest.service);
                setShippingServiceCode(cheapest.serviceCode || cheapest.service_code || cheapest.service);
                setShippingCarrier((cheapest.carrier || cheapest.provider || "FEDEX").toUpperCase());
                setShippingEstimatedDays(cheapest.estimated_days || cheapest.estimatedDays);
            } else {
                // Fallback / No rates found
                toast.error("No shipping rates found for this address.");
            }
        } catch (error: any) {
            console.error("Error calculating shipping:", error);
            // Attempt to extract the error payload from the edge function response
            let errorMsg = "Error calculating shipping rates.";
            
            try {
                if (error.context && typeof error.context.json === 'function') {
                    const errorData = await error.context.json();
                    if (errorData.error) errorMsg = errorData.error;
                } else if (error.message && error.message.includes("Carrier errors")) {
                    errorMsg = error.message;
                }
            } catch (e) {
                console.error("Failed to parse edge function error", e);
            }
            
            toast.error(errorMsg);
        } finally {
            setIsCalculatingShipping(false);
        }
    };

    const handleShippingSelect = (rate: any) => {
        setShippingCost(rate.rate || rate.cost);
        setShippingService(rate.serviceName || rate.service || rate.service_name);
        setShippingServiceCode(rate.serviceCode || rate.service_code || rate.service); 
        setShippingCarrier((rate.carrier || rate.provider || "FEDEX").toUpperCase());
        setShippingEstimatedDays(rate.estimated_days || rate.estimatedDays);
        // Force intent update
        intentAmountRef.current = 0;
    };

    // Track the amount for which we created the current payment intent
    const intentAmountRef = useRef<number>(0);

    // Initial Payment Intent Creation (runs once) 
    // AND Re-creation/Update when Total Amount changes
    useEffect(() => {
        if (items.length > 0 && session) {

            const createOrUpdateIntent = async () => {
                // If we are calculating shipping or processing, wait.
                if (isCalculatingShipping || isProcessing) return;

                // If amount hasn't changed from what's on intent, don't update
                if (intentAmountRef.current === totalAmount && clientSecret) return;
                
                // If using Square, we skip creating a Stripe payment intent.
                if (USE_SQUARE) return;

                try {
                    console.log(`${paymentIntentId ? 'Updating' : 'Creating'} payment intent for $${totalAmount}`);

                    const { data, error } = await supabase.functions.invoke('create-payment-intent', {
                        body: {
                            amount: totalAmount,
                            currency: 'usd',
                            paymentIntentId: paymentIntentId // Pass ID if we have it to update
                        }
                    });

                    if (error) throw error;
                    if (data?.clientSecret) {
                        // Only set if different to avoid re-render
                        if (data.clientSecret !== clientSecret) {
                            setClientSecret(data.clientSecret);
                        }
                        if (data.id) {
                            setPaymentIntentId(data.id);
                        }
                        intentAmountRef.current = totalAmount;
                    }
                } catch (error) {
                    console.error("Error creating/updating payment intent:", error);
                }
            };

            // Debounce updates slightly
            const timeoutId = setTimeout(() => {
                createOrUpdateIntent();
            }, 500);

            return () => clearTimeout(timeoutId);
        }
    }, [items, totalAmount, session, isCalculatingShipping, isProcessing, clientSecret, paymentIntentId]);

    if (authLoading) {
        return (
            <div className="container py-12 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!session) {
        return (
            <div className="container py-12 flex justify-center">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                            <LogIn className="w-6 h-6 text-primary" />
                        </div>
                        <CardTitle className="text-2xl">Log In Required</CardTitle>
                        <CardDescription>
                            Please log in or create an account to complete your purchase.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <Button
                            className="w-full"
                            size="lg"
                            onClick={() => navigate("/login", { state: { from: "/checkout" } })}
                        >
                            Log In
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => navigate("/register", { state: { from: "/checkout" } })}
                        >
                            Create Account
                        </Button>
                    </CardContent>
                </Card>
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

    const appearance = {
        theme: 'stripe' as const,
    };
    const options = {
        clientSecret,
        appearance,
    };

    return (
        <div className="container py-12">
            <h1 className="text-3xl font-bold mb-8">Checkout</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                    {/* Payment & Shipping Section */}
                    <div className="bg-card border rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-4">Shipping & Payment</h2>
                        {USE_SQUARE ? (
                            <SquareCheckout
                                amount={totalAmount}
                                shippingCost={shippingCost}
                                shippingService={shippingService}
                                shippingServiceCode={shippingServiceCode}
                                shippingCarrier={shippingCarrier}
                                estimatedDays={shippingEstimatedDays}
                                tax={0}
                                onAddressChange={handleAddressChange}
                            />
                        ) : clientSecret ? (
                            <Elements key={clientSecret} options={options} stripe={stripePromise}>
                                <StripeCheckout
                                    amount={totalAmount}
                                    shippingCost={shippingCost}
                                    shippingService={shippingService}
                                    shippingServiceCode={shippingServiceCode}
                                    shippingCarrier={shippingCarrier}
                                    estimatedDays={shippingEstimatedDays}
                                    tax={0}
                                    clientSecret={clientSecret}
                                    onAddressChange={handleAddressChange}
                                />
                            </Elements>
                        ) : (
                            <div className="flex justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        )}
                        {isCalculatingShipping && (
                            <div className="mt-4 flex items-center justify-center text-sm text-muted-foreground">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Updating shipping rates...
                            </div>
                        )}
                    </div>
                </div>

                <div>
                    <div className="bg-muted/30 rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-4">Order Review</h2>
                        <div className="space-y-4">
                            {items.map((item) => (
                                <div key={item.variant.id} className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="h-12 w-12 bg-background rounded border flex items-center justify-center overflow-hidden">
                                            {item.variant.product.image_url ? (
                                                <img src={item.variant.product.image_url} alt={item.variant.product.name} className="h-full w-full object-cover" />
                                            ) : (
                                                <span className="text-[10px]">Img</span>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{item.variant.product.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {item.variant.vial_type.capacity_ml}ml{item.variant.vial_type.color ? ` - ${item.variant.vial_type.color}` : ''}{item.variant.vial_type.shape ? ` - ${item.variant.vial_type.shape}` : ''}
                                                {item.variant.pack_size > 1 && ` (${item.variant.pack_size}x Pack)`}
                                                {' '}- Qty: {item.quantity}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="font-medium">${(item.variant.price * item.quantity).toFixed(2)}</span>
                                </div>
                            ))}

                            <div className="border-t pt-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Subtotal</span>
                                    <span>${cartTotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Shipping ({shippingService})</span>
                                    <span>${shippingCost.toFixed(2)}</span>
                                </div>
                                <div className="text-xs text-muted-foreground text-right -mt-1 mb-6">
                                    {/* Total Weight: {totalWeight > 0 ? `${totalWeight.toFixed(1)} lbs` : 'N/A'} */}
                                </div>

                                {/* Shipping Selection */}
                                <div className="py-2 mt-6">
                                    <p className="font-semibold text-sm mb-2">Shipping Method</p>
                                    {isCalculatingShipping ? (
                                        <div className="flex items-center text-sm text-muted-foreground">
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calculating...
                                        </div>
                                    ) : shippingRates.length > 0 ? (
                                        <div className="space-y-2">
                                            {shippingRates.map((rate, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`
                                                        flex justify-between items-center p-2 rounded border cursor-pointer text-sm
                                                        ${shippingService === (rate.serviceName || rate.service) ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted'}
                                                    `}
                                                    onClick={() => handleShippingSelect(rate)}
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{rate.serviceName || rate.service}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            Est. Delivery: {rate.estimated_days || rate.estimatedDays || 'N/A'} {rate.estimated_days || rate.estimatedDays ? 'days' : ''}
                                                        </span>
                                                    </div>
                                                    <span className="font-semibold">
                                                        ${(rate.rate || rate.cost).toFixed(2)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground italic">Enter address to see rates</p>
                                    )}
                                </div>
                                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                                    <span>Total</span>
                                    <span>${totalAmount.toFixed(2)}</span>
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
