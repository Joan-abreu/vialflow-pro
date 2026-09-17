import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Lock, Loader2, CreditCard, ShieldCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { VeyraGatewayConfig } from "@/config/paymentGateways";
import { supabase } from "@/integrations/supabase/client";

interface VeyraCheckoutProps {
    amount: number;
    config: VeyraGatewayConfig;
    customerEmail?: string;
    shippingAddress?: any;
    billingAddress?: any;
    orderId?: string;
    loading?: boolean;
    disabled?: boolean;
    disabledReason?: string;
    onTokenized: (tokenIntentId: string, sessionId: string, cardSummary?: any) => Promise<any>;
}

declare global {
    interface Window {
        Veyra?: {
            init: (options: {
                publishableKey: string;
                sessionId: string;
                amountCents: number;
                currency: string;
                onReady?: () => void;
                onError?: (error: any) => void;
            }) => {
                mount: (selector: string) => Promise<void>;
                unmount: () => void;
                tokenize: () => Promise<{
                    ok: boolean;
                    basis_theory_token_intent_id?: string;
                    card_summary?: {
                        brand?: string;
                        last4?: string;
                        exp_month?: number;
                        exp_year?: number;
                    };
                    error?: string;
                    message?: string;
                }>;
                destroy?: () => void;
            };
        };
    }
}

export const VeyraCheckout: React.FC<VeyraCheckoutProps> = ({
    amount,
    config,
    customerEmail,
    shippingAddress,
    billingAddress,
    orderId,
    loading: parentLoading = false,
    disabled = false,
    disabledReason,
    onTokenized
}) => {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isCreatingSession, setIsCreatingSession] = useState<boolean>(false);
    const [isMounted, setIsMounted] = useState<boolean>(false);
    const [isLocalProcessing, setIsLocalProcessing] = useState<boolean>(false);
    const [sdkLoaded, setSdkLoaded] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const controllerRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const publishableKey = config?.publishableKey || import.meta.env.VITE_VEYRA_PUBLISHABLE_KEY || "vg_pk_live_8mErDBD6gy87FvBUXdmDsMoQiFSyKLAE";
    const channel = config?.channel || "livwell_direct";
    const amountInCents = Math.round(amount * 100);

    // 1. Dynamically inject Veyra Hosted Fields Script
    useEffect(() => {
        if (window.Veyra) {
            setSdkLoaded(true);
            return;
        }

        const existingScript = document.getElementById("veyra-sdk-script");
        if (existingScript) {
            existingScript.addEventListener("load", () => setSdkLoaded(true));
            return;
        }

        const script = document.createElement("script");
        script.id = "veyra-sdk-script";
        script.src = "https://veyragate.com/v1/hosted-fields.js";
        script.async = true;
        script.onload = () => setSdkLoaded(true);
        script.onerror = () => {
            console.error("Failed to load Veyra hosted-fields.js SDK");
            setErrorMessage("Unable to load secure card fields. Please refresh or check your internet connection.");
        };
        document.head.appendChild(script);
    }, []);

    // 2. Create or Update Checkout Session when amount or order details settle
    useEffect(() => {
        if (amount <= 0 || disabled) return;

        let isCancelled = false;

        const initSession = async () => {
            setIsCreatingSession(true);
            setErrorMessage(null);

            try {
                // Safely unmount existing controller before making a new session
                if (controllerRef.current) {
                    try {
                        controllerRef.current.unmount();
                    } catch (_) {}
                    controllerRef.current = null;
                    setIsMounted(false);
                }

                const baseUrl = (supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
                const apiKey = (supabase as any).supabaseKey || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

                const response = await fetch(`${baseUrl}/functions/v1/process-universal-payment`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${apiKey}`,
                        "apikey": apiKey,
                    },
                    body: JSON.stringify({
                        action: "create_veyra_session",
                        amount,
                        currency: "usd",
                        channel,
                        customerEmail: customerEmail || "customer@livwellresearchlabs.com",
                        shippingAddress,
                        billingAddress,
                        orderId,
                        veyraSecretKey: config?.secretKey,
                        returnUrl: `${window.location.origin}/order-confirmation?orderId=${orderId || ''}`,
                        cancelUrl: `${window.location.origin}/checkout`,
                    }),
                });

                if (isCancelled) return;

                const data = await response.json();
                if (!response.ok || !data?.id) {
                    throw new Error(data?.message || data?.error || "Failed to initialize payment session with Veyra");
                }

                setSessionId(data.id);
            } catch (err: any) {
                if (!isCancelled) {
                    console.error("Veyra session creation error:", err);
                    setErrorMessage(err.message || "Could not start payment session. Please try again.");
                }
            } finally {
                if (!isCancelled) {
                    setIsCreatingSession(false);
                }
            }
        };

        initSession();

        return () => {
            isCancelled = true;
        };
    }, [amount, disabled, customerEmail, channel, orderId]);

    // 3. Mount Veyra Hosted Fields when SDK + Session + DOM Container are ready
    useEffect(() => {
        if (!sdkLoaded || !sessionId || !window.Veyra || !containerRef.current) return;

        let active = true;

        const mountFields = async () => {
            try {
                if (controllerRef.current) {
                    try {
                        controllerRef.current.unmount();
                    } catch (_) {}
                    controllerRef.current = null;
                }

                setIsMounted(false);

                const controller = window.Veyra!.init({
                    publishableKey,
                    sessionId: sessionId,
                    amountCents: amountInCents,
                    currency: "usd",
                    onReady: () => {
                        if (active) setIsMounted(true);
                    },
                    onError: (err) => {
                        console.error("Veyra field error:", err);
                        if (active) setErrorMessage(err?.message || "Invalid card details");
                    }
                });

                controllerRef.current = controller;

                // Mount inside the target container
                await controller.mount("#veyra-card-element");
            } catch (err: any) {
                if (active) {
                    console.error("Error mounting Veyra hosted fields:", err);
                    setErrorMessage("Failed to render card fields. Please try again.");
                }
            }
        };

        mountFields();

        return () => {
            active = false;
            if (controllerRef.current) {
                try {
                    controllerRef.current.unmount();
                } catch (_) {}
                controllerRef.current = null;
            }
            setIsMounted(false);
        };
    }, [sdkLoaded, sessionId, publishableKey, amountInCents]);

    // 4. Submit & Tokenize Card
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!controllerRef.current || isBusy || disabled || !sessionId) return;

        setIsLocalProcessing(true);
        setErrorMessage(null);

        try {
            const tokenResult = await controllerRef.current.tokenize();
            console.log("👉 [Veyra] Tokenize Result:", tokenResult);

            if (!tokenResult?.ok || !tokenResult?.basis_theory_token_intent_id) {
                const failureReason = tokenResult?.message || tokenResult?.error || "Please verify your card number, expiration, and CVV.";
                throw new Error(failureReason);
            }

            // Call universal handler to confirm charge on the server
            const paymentRes = await onTokenized(
                tokenResult.basis_theory_token_intent_id,
                sessionId,
                tokenResult.card_summary
            );

            // If 3D Secure verification is required by issuer:
            if (paymentRes?.status === "REQUIRES_ACTION" && paymentRes?.redirectUrl) {
                toast.info("Redirecting to bank verification (3D Secure)...");
                window.location.href = paymentRes.redirectUrl;
                return;
            }

            if (paymentRes?.error) {
                throw new Error(paymentRes.error);
            }
        } catch (err: any) {
            console.error("❌ Veyra payment processing error:", err);
            const msg = err.message || "Payment declined. Please try another card.";
            setErrorMessage(msg);
            toast.error(msg);
        } finally {
            setIsLocalProcessing(false);
        }
    };

    const isBusy = parentLoading || isCreatingSession || isLocalProcessing;
    const isButtonEnabled = isMounted && !isBusy && !disabled;

    return (
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
            {/* Security Guarantee Header */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-medium">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span>256-Bit SSL Encrypted & PCI-DSS Level 1 Vault</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Lock className="h-3 w-3" />
                    <span>Inline Secure</span>
                </div>
            </div>

            {/* Error Message Display */}
            {errorMessage && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <strong className="font-semibold block">Card Processing Notice:</strong>
                        <span>{errorMessage}</span>
                    </div>
                </div>
            )}

            {/* Card Fields Container */}
            <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-primary" />
                        Credit or Debit Card
                    </span>
                    <div className="flex items-center gap-1 text-[11px]">
                        <span>Visa</span>
                        <span>•</span>
                        <span>Mastercard</span>
                        <span>•</span>
                        <span>Amex</span>
                        <span>•</span>
                        <span>Discover</span>
                    </div>
                </div>

                {/* Target node for Veyra Hosted Fields SDK */}
                <div className="relative min-h-[90px] flex items-center justify-center">
                    {(!sdkLoaded || isCreatingSession || !isMounted) && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-xs rounded-lg z-10 space-y-2">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            <span className="text-xs text-muted-foreground">
                                {isCreatingSession ? "Establishing secure payment session..." : "Loading secure card fields..."}
                            </span>
                        </div>
                    )}
                    <div
                        id="veyra-card-element"
                        ref={containerRef}
                        className="w-full min-h-[90px]"
                    />
                </div>
            </div>

            {/* Statement Descriptor Notice (Mandatory by Veyra spec Section 9) */}
            <div className="text-center space-y-1">
                <p className="text-xs text-muted-foreground">
                    Your card statement will show <strong className="font-bold text-foreground">LIVWELL</strong>.
                </p>
            </div>

            {/* Pay Button */}
            <Button
                type="submit"
                disabled={!isButtonEnabled}
                className={`w-full py-6 text-base font-bold shadow-md transition-all duration-200 ${
                    isButtonEnabled
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer shadow-primary/20"
                        : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                }`}
            >
                {isBusy ? (
                    <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        {isLocalProcessing ? "Processing Secure Payment..." : isCreatingSession ? "Securing Session..." : "Please wait..."}
                    </>
                ) : disabled ? (
                    disabledReason || "Complete required steps to pay"
                ) : !isMounted ? (
                    "Initializing Card Fields..."
                ) : (
                    `Pay $${amount.toFixed(2)} with Card`
                )}
            </Button>
        </form>
    );
};
