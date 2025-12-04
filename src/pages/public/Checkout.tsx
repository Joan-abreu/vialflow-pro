import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { useCart } from "@/contexts/CartContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import StripeCheckout from "@/components/checkout/StripeCheckout";
import { Loader2 } from "lucide-react";

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

const Checkout = () => {
    const { items, cartTotal, clearCart } = useCart();
    const navigate = useNavigate();
    const [clientSecret, setClientSecret] = useState("");
    const [loading, setLoading] = useState(false);

    const shippingCost = 10.00;
    const totalAmount = cartTotal + shippingCost;

    useEffect(() => {
        if (items.length > 0) {
            setLoading(true);
            // Create PaymentIntent as soon as the page loads
            const createIntent = async () => {
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
                } finally {
                    setLoading(false);
                }
            };
            createIntent();
        }
    }, [items, totalAmount]);

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
                                <StripeCheckout amount={totalAmount} />
                            </Elements>
                        ) : (
                            <div className="flex justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                                    <span>Shipping</span>
                                    <span>${shippingCost.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-lg pt-2">
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
