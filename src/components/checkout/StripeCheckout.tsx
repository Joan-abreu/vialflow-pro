import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { PaymentElement, useStripe, useElements, AddressElement } from "@stripe/react-stripe-js";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface StripeCheckoutProps {
    amount: number;
    clientSecret: string;
    onAddressChange?: (address: any) => void;
}

const StripeCheckout = ({ amount, clientSecret, onAddressChange }: StripeCheckoutProps) => {
    const stripe = useStripe();
    const elements = useElements();
    const { clearCart, items } = useCart();

    const [loading, setLoading] = useState(false);
    const [saveAddress, setSaveAddress] = useState(false);
    const [addressState, setAddressState] = useState<any>(null);
    const [user, setUser] = useState<any>(null);
    const [defaultAddress, setDefaultAddress] = useState<any>(null);

    useEffect(() => {
        const fetchUserAndProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);

            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (profile && profile.address_line1) {
                    const savedAddress = {
                        name: profile.full_name || user.user_metadata?.full_name || '',
                        address: {
                            line1: profile.address_line1,
                            line2: profile.address_line2,
                            city: profile.city,
                            state: profile.state,
                            postal_code: profile.postal_code,
                            country: profile.country || 'US',
                        }
                    };
                    setDefaultAddress(savedAddress);

                    // Also set initial address state so it's valid if they don't change anything
                    const initialAddressState = savedAddress.address;
                    setAddressState(initialAddressState);

                    // Notify parent immediately if address exists
                    if (onAddressChange) {
                        onAddressChange(initialAddressState);
                    }
                } else {
                    setDefaultAddress({
                        name: user.user_metadata?.full_name || '',
                    });
                }
            }
        };
        fetchUserAndProfile();
    }, []); // Run only once on mount

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setLoading(true);

        try {
            // 1. Save address if requested and user is logged in
            if (saveAddress && user && addressState) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({
                        address_line1: addressState.line1,
                        address_line2: addressState.line2,
                        city: addressState.city,
                        state: addressState.state,
                        postal_code: addressState.postal_code,
                        country: addressState.country,
                    })
                    .eq('user_id', user.id);

                if (profileError) {
                    console.error("Error saving address:", profileError);
                    toast.error("Failed to save address, but proceeding with payment.");
                }
            }

            // 2. Create Order in Supabase (Pending Payment)
            const cartItems = items;

            // Get user email for customer_email field
            const customerEmail = user?.email || "";

            const { data: order, error: orderError } = await supabase
                .from("orders")
                .insert({
                    user_id: user?.id,
                    customer_email: customerEmail,
                    total_amount: Number(amount.toFixed(2)),
                    status: "pending_payment", // Initial status
                    shipping_address: addressState || {}, // Save the address used for this order
                })
                .select()
                .single();

            if (orderError) throw orderError;

            // 3. Create Order Items
            const orderItems = cartItems.map(item => ({
                order_id: order.id,
                product_id: item.variant.product_id,
                variant_id: item.variant.id,
                quantity: item.quantity,
                price_at_time: item.variant.price
            }));

            const { error: itemsError } = await supabase
                .from("order_items")
                .insert(orderItems);

            if (itemsError) throw itemsError;

            // 4. Link Order to PaymentIntent (Metadata)
            try {
                if (clientSecret) {
                    const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);

                    if (paymentIntent) {
                        const { error: updateError } = await supabase.functions.invoke("update-payment-intent", {
                            body: {
                                paymentIntentId: paymentIntent.id,
                                order_id: order.id,
                            }
                        });

                        if (updateError) {
                            console.error("Failed to link order to payment intent:", updateError);
                        }
                    }
                }
            } catch (linkError) {
                console.error("Failed to retrieve or link payment intent:", linkError);
            }

            // 5. Confirm Payment
            const { error } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: `${window.location.origin}/order-confirmation/${order.id}`,
                },
            });

            if (error) {
                toast.error(error.message || "An unexpected error occurred.");
            }
            // Cart will be cleared on the OrderConfirmation page
        } catch (error: any) {
            console.error("Payment error:", error);
            toast.error(error.message || "Payment failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6 px-0">
                <div className="space-y-2">
                    <h3 className="text-sm font-medium">Shipping Address</h3>
                    <AddressElement
                        key={defaultAddress ? 'loaded' : 'loading'}
                        options={{
                            mode: 'shipping',
                            defaultValues: defaultAddress || {
                                name: user?.user_metadata?.full_name || '',
                            }
                        }}
                        onChange={(e) => {
                            if (e.complete) {
                                const newAddress = e.value.address;
                                setAddressState(newAddress);
                                if (onAddressChange) {
                                    onAddressChange(newAddress);
                                }
                            }
                        }}
                    />
                    {user && (
                        <div className="flex items-center space-x-2 pt-2">
                            <Checkbox
                                id="save-address"
                                checked={saveAddress}
                                onCheckedChange={(checked) => setSaveAddress(checked as boolean)}
                            />
                            <Label htmlFor="save-address" className="text-sm text-muted-foreground font-normal cursor-pointer">
                                Save this address for future orders
                            </Label>
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <h3 className="text-sm font-medium">Payment Details</h3>
                    <PaymentElement />
                </div>

                <div className="pt-4">
                    <div className="flex justify-between text-sm font-medium">
                        <span>Total Amount</span>
                        <span>${amount.toFixed(2)}</span>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="px-0">
                <Button className="w-full" type="submit" disabled={!stripe || loading}>
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                        </>
                    ) : (
                        `Pay $${amount.toFixed(2)}`
                    )}
                </Button>
            </CardFooter>
        </form>
    );
};

export default StripeCheckout;
