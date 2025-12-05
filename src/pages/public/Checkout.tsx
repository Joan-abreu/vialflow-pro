import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { useCart } from "@/contexts/CartContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import StripeCheckout from "@/components/checkout/StripeCheckout";
import { Loader2, LogIn } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateShipping, getShippingLabel } from "@/utils/shipping";

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

const Checkout = () => {
    const { items, cartTotal } = useCart();
    const navigate = useNavigate();
    const { session, loading: authLoading } = useAuth();
    const [clientSecret, setClientSecret] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    // Real-Time Shipping State
    const [shippingCost, setShippingCost] = useState<number>(0);
    const [shippingService, setShippingService] = useState<string>("Standard");
    const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);

    // Calculate total weight (default to 1lb per item if weight is missing)
    const totalWeight = items.reduce((sum, item) => {
        return sum + ((item.variant.weight || 0) * item.quantity);
    }, 0);

    const totalAmount = Number((cartTotal + shippingCost).toFixed(2));

    // Handle Address Change from StripeCheckout
    const handleAddressChange = async (address: any) => {
        if (!address?.country || !address?.state) return;

        setIsCalculatingShipping(true);
        try {
            const { data, error } = await supabase.functions.invoke('calculate-shipping', {
                body: { weight: totalWeight, address }
            });

            if (error) throw error;

            console.log("Shipping Rates:", data.rates);

            // For now, auto-select the first/cheapest option (Ground)
            if (data.rates && data.rates.length > 0) {
                const selectedRate = data.rates[0];
                setShippingCost(selectedRate.rate);
                setShippingService(selectedRate.service);
            }
        } catch (error) {
            console.error("Error calculating shipping:", error);
            // Fallback to flat rate?
            setShippingCost(calculateShipping(totalWeight));
            setShippingService(getShippingLabel(totalWeight));
        } finally {
            setIsCalculatingShipping(false);
        }
    };

    // Initial Payment Intent Creation (runs once) 
    // AND Re-creation/Update when Total Amount changes significantly
    // Note: Creating a new PaymentIntent invalidates the old clientSecret. 
    // This effectively "updates" the amount for the user.
    useEffect(() => {
        if (items.length > 0 && session) {
            // Debounce slightly to avoid rapid updates while typing? 
            // Actually handleAddressChange is triggered on "complete" or specific events, so it should be fine.

            const createOrUpdateIntent = async () => {
                // If we are calculating shipping, wait.
                if (isCalculatingShipping) return;

                try {
                    const { data, error } = await supabase.functions.invoke('create-payment-intent', {
                        body: { amount: totalAmount, currency: 'usd' }
                    });

                    if (error) throw error;
                    if (data?.clientSecret) {
                        setClientSecret(data.clientSecret);
                    }
                } catch (error) {
                    console.error("Error creating payment intent:", error);
                }
            };

            // Only update if totalAmount is greater than 0
            if (totalAmount > 0) {
                createOrUpdateIntent();
            }
        }
    }, [items, totalAmount, session, isCalculatingShipping]);

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
                        {clientSecret ? (
                            <Elements options={options} stripe={stripePromise}>
                                <StripeCheckout
                                    amount={totalAmount}
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
                                                {item.variant.vial_type.size_ml}ml
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
                                <div className="text-xs text-muted-foreground text-right -mt-1 mb-2">
                                    Total Weight: {totalWeight > 0 ? `${totalWeight.toFixed(1)} lbs` : 'N/A'}
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
        </div>
    );
};

export default Checkout;
