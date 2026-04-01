import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PaymentForm, CreditCard } from "react-square-web-payments-sdk";

interface SquareCheckoutProps {
    amount: number;
    shippingCost: number;
    shippingService: string;
    shippingServiceCode?: string;
    shippingCarrier?: string;
    estimatedDays?: number;
    tax: number;
    onAddressChange?: (address: any) => void;
}

const appId = import.meta.env.VITE_SQUARE_APP_ID || "sandbox-sq0idb-your-app-id";
const locationId = import.meta.env.VITE_SQUARE_LOCATION_ID || "sandbox-location-id";

const SquareCheckout = ({ amount, shippingCost, shippingService, shippingServiceCode, shippingCarrier, estimatedDays, tax, onAddressChange }: SquareCheckoutProps) => {
    const { items } = useCart();
    
    const [loading, setLoading] = useState(false);
    const [saveAddress, setSaveAddress] = useState(false);
    const [user, setUser] = useState<any>(null);

    // Custom Address Collection State for Square since it lacks Stripe's AddressElement
    const [addressState, setAddressState] = useState({
        line1: "",
        line2: "",
        city: "",
        state: "",
        postal_code: "",
        country: "US"
    });

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
                        line1: profile.address_line1,
                        line2: profile.address_line2 || "",
                        city: profile.city,
                        state: profile.state,
                        postal_code: profile.postal_code,
                        country: profile.country || 'US',
                    };
                    setAddressState(savedAddress);

                    // Notify parent immediately
                    if (onAddressChange) {
                        onAddressChange(savedAddress);
                    }
                }
            }
        };
        fetchUserAndProfile();
    }, []);

    const handleAddressInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setAddressState(prev => ({ ...prev, [name]: value }));
    };

    // Delay validating address and triggering parent callback until typing stops
    useEffect(() => {
        if (!addressState.line1 || !addressState.city || !addressState.state || !addressState.postal_code || !addressState.country) return;

        const timeout = setTimeout(() => {
            if (onAddressChange) onAddressChange(addressState);
        }, 1000);
        return () => clearTimeout(timeout);
    }, [addressState]);

    const handleSquarePayment = async (token: string) => {
        setLoading(true);

        try {
            // 1. Save address if requested
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
                }
            }

            // 2. Create Order in Supabase
            const customerEmail = user?.email || "";

            const { data: order, error: orderError } = await supabase
                .from("orders")
                .insert({
                    user_id: user?.id,
                    customer_email: customerEmail,
                    total_amount: Number(amount.toFixed(2)),
                    status: "pending_payment",
                    shipping_address: addressState,
                    shipping_cost: shippingCost || 0,
                    shipping_service: shippingService || "Standard",
                    shipping_service_code: shippingServiceCode || null,
                    shipping_carrier: shippingCarrier || null,
                    estimated_days: estimatedDays ? parseInt(String(estimatedDays)) : null,
                    tax: tax || 0
                })
                .select()
                .single();

            if (orderError) throw orderError;

            // 3. Create Order Items
            const orderItems = items.map(item => ({
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

            // 4. Charge Card via Square Edge Function
            const { data: paymentResult, error: paymentError } = await supabase.functions.invoke("create-square-payment", {
                body: {
                    sourceId: token,
                    amount: amount,
                    orderId: order.id,
                    customerEmail: customerEmail
                }
            });

            if (paymentError || paymentResult.error) {
                throw new Error(paymentResult?.error || paymentError?.message || "Payment declined");
            }

            // Update order to processing implicitly if payment success since the webhook handles it 
            // OR update immediately if webhook isn't configured
            await supabase
                .from("orders")
                .update({ status: "processing" })
                .eq("id", order.id);

            // Redirect to success
            window.location.href = `/order-confirmation/${order.id}`;

        } catch (error: any) {
            console.error("Square Payment Error:", error);
            toast.error(error.message || "Payment failed");
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <CardContent className="space-y-6 px-0">
                {/* Custom Address Collection */}
                <div className="space-y-4">
                    <h3 className="text-sm font-medium">Shipping Address</h3>
                    <div className="grid grid-cols-1 gap-4">
                        <Input placeholder="Address Line 1" name="line1" value={addressState.line1} onChange={handleAddressInputChange} required />
                        <Input placeholder="Apt, Suite, Unit (optional)" name="line2" value={addressState.line2} onChange={handleAddressInputChange} />
                        <div className="grid grid-cols-2 gap-4">
                            <Input placeholder="City" name="city" value={addressState.city} onChange={handleAddressInputChange} required />
                            <Input placeholder="State (e.g., CA)" name="state" value={addressState.state} onChange={handleAddressInputChange} required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Input placeholder="ZIP Code" name="postal_code" value={addressState.postal_code} onChange={handleAddressInputChange} required />
                            <Input placeholder="Country (e.g., US)" name="country" value={addressState.country} onChange={handleAddressInputChange} required />
                        </div>
                    </div>
                    {user && (
                        <div className="flex items-center space-x-2 pt-2">
                            <Checkbox id="save-address" checked={saveAddress} onCheckedChange={(c) => setSaveAddress(c as boolean)} />
                            <Label htmlFor="save-address" className="text-sm text-muted-foreground font-normal">
                                Save this address for future orders
                            </Label>
                        </div>
                    )}
                </div>

                {/* Square Web SDK */}
                <div className="space-y-4">
                    <h3 className="text-sm font-medium">Payment Details</h3>
                    <div className="bg-white p-4 rounded-md border min-h-[120px]">
                        {appId.includes("your-app-id") || locationId.includes("location-id") ? (
                            <div className="flex flex-col items-center justify-center text-center p-4 text-orange-600 bg-orange-50 rounded">
                                <p className="font-semibold">Square API Keys Missing</p>
                                <p className="text-sm">Please set VITE_SQUARE_APP_ID and VITE_SQUARE_LOCATION_ID in your .env file to view the payment form.</p>
                            </div>
                        ) : (
                            <PaymentForm
                                applicationId={appId}
                                locationId={locationId}
                                cardTokenizeResponseReceived={((token: any) => {
                                    if (token.status === "OK") {
                                        handleSquarePayment(token.token);
                                    } else {
                                        toast.error(token.errors?.[0]?.message || "Could not validate card");
                                    }
                                }) as any}
                            >
                                <CreditCard 
                                    buttonProps={{
                                        css: {
                                            backgroundColor: 'hsl(var(--primary))',
                                            color: '#fff',
                                            fontFamily: 'Inter, sans-serif',
                                            '&:hover': {
                                                backgroundColor: 'hsl(var(--primary) / 0.9)',
                                            }
                                        }
                                    }}
                                >
                                    Pay ${(amount).toFixed(2)}
                                </CreditCard>
                            </PaymentForm>
                        )}
                    </div>
                </div>
            </CardContent>
            {loading && (
                <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10 rounded-lg">
                    <div className="flex flex-col items-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                        <span className="text-sm font-medium">Processing...</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SquareCheckout;
