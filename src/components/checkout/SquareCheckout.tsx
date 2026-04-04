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
import { AddressAutocomplete } from "@/components/shipping/AddressAutocomplete";

interface SquareCheckoutProps {
    amount: number;
    shippingCost: number;
    shippingService: string;
    shippingServiceCode?: string;
    shippingCarrier?: string;
    estimatedDays?: number;
    tax: number;
    onAddressChange?: (address: any) => void;
    externalAddress?: any; // To allow parent to inject/correct address
}

const appId = import.meta.env.VITE_SQUARE_APP_ID || "sandbox-sq0idb-your-app-id";
const locationId = import.meta.env.VITE_SQUARE_LOCATION_ID || "sandbox-location-id";

const SquareCheckout = ({ amount, shippingCost, shippingService, shippingServiceCode, shippingCarrier, estimatedDays, tax, onAddressChange, externalAddress }: SquareCheckoutProps) => {
    const { items } = useCart();
    
    const [loading, setLoading] = useState(false);
    const [saveAddress, setSaveAddress] = useState(false);
    const [user, setUser] = useState<any>(null);

    // Sync externalAddress if provided (e.g. after a UPS correction)
    useEffect(() => {
        if (externalAddress) {
            setAddressState(prev => ({
                ...prev,
                ...externalAddress
            }));
        }
    }, [externalAddress]);

    // Custom Address Collection State for Square
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
                        country: normalizeCountry(profile.country || 'US'),
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
        const newState = { ...addressState, [name]: value };
        setAddressState(newState);
        
        // Notify parent of changes to trigger rate calculation
        if (onAddressChange) {
            onAddressChange(newState);
        }
    };

    const handleAddressAutocompleteSelect = (addr: any) => {
        const selectedAddress = {
            ...addressState,
            line1: addr.line1,
            city: addr.city,
            state: addr.state,
            postal_code: addr.zip, // Map zip -> postal_code
            country: normalizeCountry(addr.country || 'US')
        };
        
        setAddressState(selectedAddress);
        
        // Notify parent immediately to refresh rates
        if (onAddressChange) {
            onAddressChange(selectedAddress);
        }
    };

    // Helper to normalize country to ISO code since Square requires US instead of United States
    const normalizeCountry = (country: string) => {
        if (!country) return "US";
        const val = country.trim().toUpperCase();
        if (val === "UNITED STATES" || val === "USA" || val === "UNITED STATES OF AMERICA" || val === "ESTADOS UNIDOS") {
            return "US";
        }
        return country; // Fallback to raw if not matched
    };

    // Helper to translate Square technical errors to friendly messages
    const translateSquareError = (errorMsg: string) => {
        const upperError = errorMsg.toUpperCase();
        if (upperError.includes('GENERIC_DECLINE')) {
            return "Your card was declined. Please try another card or contact your bank.";
        }
        if (upperError.includes('INSUFFICIENT_FUNDS')) {
            return "Insufficient funds. Please use another card.";
        }
        if (upperError.includes('CVV_FAILURE')) {
            return "The security code (CVV) is incorrect. Please verify it.";
        }
        if (upperError.includes('EXPIRATION_FAILURE')) {
            return "The card has expired. Please use a valid card.";
        }
        if (upperError.includes('INVALID_CARD')) {
            return "Invalid card number. Please verify it.";
        }
        if (upperError.includes('AMOUNT_TOO_HIGH')) {
            return "The amount is too high for this card.";
        }
        if (upperError.includes('ADDRESS_VERIFICATION_FAILURE')) {
            return "Address verification failed. Check your zip code.";
        }
        return errorMsg; // Show the raw error message if no friendly translation exists
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
                    customerEmail: customerEmail,
                    locationId: locationId,
                    isProduction: appId.startsWith("sq0idp"),
                    shippingCost: shippingCost,
                    tax: tax,
                    items: items.map(item => ({
                        name: item.variant.product.name,
                        quantity: item.quantity.toString(),
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
                        country: normalizeCountry(addressState.country)
                    }
                }
            });

            if (paymentError || !paymentResult || paymentResult.success === false) {
                const rawError = paymentResult?.error || paymentError?.message || "Payment declined";
                console.error("Square Detailed Error (Raw):", rawError);
                throw new Error(translateSquareError(rawError));
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
                    <h3 className="text-sm font-semibold text-foreground/80">Shipping Address</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2 space-y-1.5">
                            <Label htmlFor="line1" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Address Line 1</Label>
                            <AddressAutocomplete
                                value={addressState.line1}
                                onSelectAddress={handleAddressAutocompleteSelect}
                                placeholder="Search for an address (UPS / Google Maps style)..."
                                className="w-full"
                            />
                        </div>
                        <div className="md:col-span-2 space-y-1.5">
                            <Label htmlFor="line2" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Suite / Apt (Optional)</Label>
                            <Input id="line2" placeholder="Suite 400" name="line2" value={addressState.line2} onChange={handleAddressInputChange} autoComplete="address-line2" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="city" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">City</Label>
                            <Input id="city" placeholder="San Francisco" name="city" value={addressState.city} onChange={handleAddressInputChange} required autoComplete="address-level2" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="state" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">State</Label>
                            <Input id="state" placeholder="CA" name="state" value={addressState.state} onChange={handleAddressInputChange} required autoComplete="address-level1" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="postal_code" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">ZIP Code</Label>
                            <Input id="postal_code" placeholder="94103" name="postal_code" value={addressState.postal_code} onChange={handleAddressInputChange} required autoComplete="postal-code" />
                        </div>
                        <div className="space-y-1.5 opacity-70">
                            <Label htmlFor="country" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Country</Label>
                            <Input id="country" value="US" readOnly className="bg-muted cursor-not-allowed" />
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
