import { useEffect, useState, useRef } from "react";
import { useCart } from "@/contexts/CartContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SquareCheckout from "@/components/checkout/SquareCheckout";
import { Loader2, LogIn } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { calculateShipping, getShippingLabel } from "@/utils/shipping";

const Checkout = () => {
    const { items, cartTotal } = useCart();
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
    const [addressSuggestion, setAddressSuggestion] = useState<any>(null);
    const [lastValidatedAddress, setLastValidatedAddress] = useState<string>("");
    const [externalAddressUpdate, setExternalAddressUpdate] = useState<any>(null);

    // Calculate total weight (default to 1lb per item if weight is missing)
    const totalWeight = items.reduce((sum, item) => {
        return sum + ((item.variant.weight || 0) * item.quantity);
    }, 0);

    const totalAmount = Number((cartTotal + shippingCost).toFixed(2));

    // Handle Address Change
    const handleAddressChange = async (address: any) => {
        // Reset selected shipping immediately when address starts changing
        setShippingCost(0);
        setShippingService("");
        setShippingEstimatedDays(undefined);
        setShippingRates([]);
        setAddressSuggestion(null);

        // Guard: Only proceed if address is "complete enough" to avoid jitter while typing
        const isComplete = (address.line1?.length > 3) && 
                          (address.city?.length > 1) && 
                          (address.state?.length >= 2) && 
                          (address.postal_code?.length >= 5);

        // Skip if not complete or if it's the same as last validated to avoid loops
        const currentAddrStr = `${address.line1}-${address.city}-${address.state}-${address.postal_code}`;
        if (!isComplete || currentAddrStr === lastValidatedAddress) {
            return;
        }

        setLastValidatedAddress(currentAddrStr);
        setIsCalculatingShipping(true);

        try {
            // Validate address first to give user feedback
            const { data: valData, error: valErr } = await supabase.functions.invoke('validate-address', {
                body: { address }
            });

            console.log("Address Validation Result:", valData);

            if (valErr) {
               console.warn("Address validation error:", valErr);
            } else if (valData && !valData.valid) {
               console.log("Address is invalid, checking suggestions:", valData.suggestions);
               if (valData.suggestions && valData.suggestions.length > 0) {
                   const sugg = valData.suggestions[0].AddressKeyFormat;
                   
                   // Prepare normalized suggestion for easy application
                   const line = Array.isArray(sugg?.AddressLine) ? sugg.AddressLine.join(', ') : (sugg?.AddressLine || "");
                   const suggestionObj = {
                       line1: line,
                       city: sugg?.PoliticalDivision2 || '',
                       state: sugg?.PoliticalDivision1 || '',
                       postal_code: sugg?.PostcodePrimaryLow || '',
                       country: sugg?.CountryCode || 'US'
                   };
                   
                   setAddressSuggestion(suggestionObj);
                   toast.info("UPS found a more accurate version of your address.");
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

    const applySuggestion = () => {
        if (!addressSuggestion) return;
        setExternalAddressUpdate(addressSuggestion);
        handleAddressChange(addressSuggestion);
        setAddressSuggestion(null);
        toast.success("Address updated with UPS suggestion");
    };

    // Track the amount for which we calculated
    const intentAmountRef = useRef<number>(0);

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

    return (
        <div className="container py-12">
            <h1 className="text-3xl font-bold mb-8">Checkout</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                    {/* Payment & Shipping Section */}
                    <div className="bg-card border rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-4">Shipping & Payment</h2>
                        <SquareCheckout
                            amount={totalAmount}
                            shippingCost={shippingCost}
                            shippingService={shippingService}
                            shippingServiceCode={shippingServiceCode}
                            shippingCarrier={shippingCarrier}
                            estimatedDays={shippingEstimatedDays}
                            tax={0}
                            onAddressChange={handleAddressChange}
                            externalAddress={externalAddressUpdate}
                        />
                        
                        {addressSuggestion && (
                            <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-white">!</span>
                                        UPS Address Suggestion
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        We found a more accurate format: <br />
                                        <span className="font-medium text-foreground">
                                            {addressSuggestion.line1}, {addressSuggestion.city}, {addressSuggestion.state} {addressSuggestion.postal_code}
                                        </span>
                                    </p>
                                    <Button 
                                        size="sm" 
                                        variant="default" 
                                        className="mt-2 w-fit h-8 px-4 text-xs"
                                        onClick={applySuggestion}
                                    >
                                        Use Suggested Address
                                    </Button>
                                </div>
                            </div>
                        )}

                        {isCalculatingShipping && (
                            <div className="mt-8 pt-8 border-t flex flex-col items-center justify-center text-center space-y-3">
                                <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
                                <div className="space-y-1">
                                    <p className="text-sm font-medium">Calculating Shipping Rates</p>
                                    <p className="text-xs text-muted-foreground">Contacting carriers for the best prices...</p>
                                </div>
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
