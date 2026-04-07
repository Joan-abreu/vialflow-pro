import { useEffect, useState, useRef, useCallback } from "react";
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
import { AddressValidationModal } from "@/components/checkout/AddressValidationModal";

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
    const [step, setStep] = useState<'address' | 'shipping' | 'payment'>('address');
    const [externalAddressUpdate, setExternalAddressUpdate] = useState<any>(null);

    // Calculate total weight (default to 1lb per item if weight is missing)
    const totalWeight = items.reduce((sum, item) => {
        return sum + ((item.variant.weight || 0) * item.quantity);
    }, 0);

    const totalAmount = Number((cartTotal + shippingCost).toFixed(2));

    const [currentAddress, setCurrentAddress] = useState<any>(null);
    const [validationResult, setValidationResult] = useState<any>(null);
    const [showValidationModal, setShowValidationModal] = useState(false);
    const [isValidating, setIsValidating] = useState(false);

    // Track the amount for which we calculated
    const intentAmountRef = useRef<number>(0);

    // Handle Address change from Square Form (Silent update)
    const handleAddressChange = useCallback((address: any) => {
        setCurrentAddress(address);
        // Reset shipping if address changes
        if (shippingService) {
           setShippingCost(0);
           setShippingService("");
           setShippingRates([]);
        }
    }, [shippingService]);

    const validateAndProceed = async () => {
        if (!currentAddress) return;
        
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
                setStep('shipping');
            }
        } catch (error: any) {
            console.error("Validation error:", error);
            toast.error("Could not verify address. Please try again.");
        } finally {
            setIsValidating(false);
        }
    };

    const calculateRates = async (address: any) => {
        setIsCalculatingShipping(true);
        try {
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
            }
            setShippingRates(rates);
            if (rates.length === 0) toast.error("No shipping rates found.");
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
        setStep('shipping');
    };

    const handleShippingSelect = (rate: any) => {
        setShippingCost(rate.rate || rate.cost);
        setShippingService(rate.serviceName || rate.service || rate.service_name);
        setShippingServiceCode(rate.serviceCode || rate.service_code || rate.service); 
        setShippingCarrier((rate.carrier || rate.provider || "FEDEX").toUpperCase());
        setShippingEstimatedDays(rate.estimated_days || rate.estimatedDays);
        intentAmountRef.current = 0;
    };

    const nextStep = () => {
        if (step === 'address') validateAndProceed();
        else if (step === 'shipping' && shippingService) setStep('payment');
    };

    const prevStep = () => {
        if (step === 'shipping') setStep('address');
        else if (step === 'payment') setStep('shipping');
    };

    const canGoNext = () => {
        if (step === 'address') return true; // Always active as requested
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h1 className="text-3xl font-bold">Checkout</h1>
                
                {/* Visual Stepper */}
                <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-full px-4 border">
                    <div className={`flex items-center gap-2 ${step === 'address' ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'address' ? 'bg-primary text-white' : 'bg-muted border'}`}>1</span>
                        <span className="hidden sm:inline">Address</span>
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
                            <h2 className="text-xl font-semibold capitalize">{step} Details</h2>
                            <p className="text-sm text-muted-foreground">
                                {step === 'address' && "Provide your delivery information."}
                                {step === 'shipping' && "Choose how you want your items delivered."}
                                {step === 'payment' && "Enter your payment details to complete the order."}
                            </p>
                        </div>

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
                            isCalculating={isCalculatingShipping || isValidating}
                            hideAddress={step !== 'address'}
                            hidePayment={step !== 'payment'}
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
                                        {shippingRates.map((rate, idx) => (
                                            <div
                                                key={idx}
                                                className={`
                                                    flex justify-between items-center p-4 rounded-lg border-2 cursor-pointer transition-all
                                                    ${shippingService === (rate.serviceName || rate.service) 
                                                        ? 'border-primary bg-primary/5 shadow-sm' 
                                                        : 'border-border hover:border-primary/50 hover:bg-muted/50'}
                                                `}
                                                onClick={() => handleShippingSelect(rate)}
                                            >
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-base">{rate.serviceName || rate.service}</span>
                                                    <span className="text-sm text-muted-foreground">
                                                        {(rate.carrier || rate.provider || 'FEDEX').toUpperCase()} — Est. {rate.estimated_days || rate.estimatedDays || 'N/A'} {rate.estimated_days || rate.estimatedDays ? 'days' : ''}
                                                    </span>
                                                </div>
                                                <span className="font-bold text-lg">
                                                    ${(rate.rate || rate.cost).toFixed(2)}
                                                </span>
                                            </div>
                                        ))}
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
                                    disabled={!canGoNext()}
                                    className="px-8 font-semibold shadow-lg hover:scale-105 active:scale-95 transition-all"
                                >
                                    {step === 'address' ? 'Select Shipping' : 'Continue to Payment'}
                                </Button>
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
                                <div className="flex justify-between text-base font-medium">
                                    <span>Shipping</span>
                                    <span>{shippingCost > 0 ? `$${shippingCost.toFixed(2)}` : (step === 'address' ? '--' : 'Select method')}</span>
                                </div>
                                {shippingService && shippingCost > 0 && (
                                    <div className="text-xs text-muted-foreground text-right -mt-1 italic">
                                        {shippingService}
                                    </div>
                                )}
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
