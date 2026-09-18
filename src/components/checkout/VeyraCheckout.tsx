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
    const [sessionRefreshTrigger, setSessionRefreshTrigger] = useState<number>(0);
    const [isCreatingSession, setIsCreatingSession] = useState<boolean>(false);
    const [isMounted, setIsMounted] = useState<boolean>(false);
    const [isLocalProcessing, setIsLocalProcessing] = useState<boolean>(false);
    const [sdkLoaded, setSdkLoaded] = useState<boolean>(false);
    const [isApplePayAvailable, setIsApplePayAvailable] = useState<boolean>(false);
    const [isApplePayProcessing, setIsApplePayProcessing] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const controllerRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const publishableKey = config?.publishableKey || import.meta.env.VITE_VEYRA_PUBLISHABLE_KEY || "vg_pk_live_8mErDBD6gy87FvBUXdmDsMoQiFSyKLAE";
    const channel = config?.channel || "livwell_direct";
    const amountInCents = Math.round(amount * 100);

    const safeDestroyController = () => {
        if (controllerRef.current) {
            try {
                if (typeof controllerRef.current.destroy === "function") {
                    controllerRef.current.destroy();
                } else if (typeof controllerRef.current.unmount === "function") {
                    controllerRef.current.unmount();
                }
            } catch (_) {}
            controllerRef.current = null;
        }
        setIsMounted(false);
    };

    // Listen for bfcache restores (e.g. user hits Back from order confirmation)
    useEffect(() => {
        const handlePageShow = (e: PageTransitionEvent) => {
            if (e.persisted) {
                safeDestroyController();
                setSessionId(null);
                setSessionRefreshTrigger(prev => prev + 1);
            }
        };
        window.addEventListener("pageshow", handlePageShow);
        return () => window.removeEventListener("pageshow", handlePageShow);
    }, []);

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
            setErrorMessage("Unable to load secure card fields. Please refresh or check your internet connection.");
        };
        document.head.appendChild(script);
    }, []);

    // 1b. Dynamically inject Apple Pay SDK and check browser capability
    useEffect(() => {
        const checkApplePay = () => {
            if (typeof window !== "undefined" && (window as any).ApplePaySession) {
                try {
                    const canPay = (window as any).ApplePaySession.canMakePayments();
                    if (canPay) {
                        setIsApplePayAvailable(true);
                    }
                } catch (_) {}
            }
        };

        checkApplePay();

        if (!document.getElementById("apple-pay-sdk-script")) {
            const script = document.createElement("script");
            script.id = "apple-pay-sdk-script";
            script.src = "https://applepay.cdn-apple.com/jsapi/v1/apple-pay-sdk.js";
            script.async = true;
            script.onload = checkApplePay;
            document.head.appendChild(script);
        }
    }, []);

    // 2. Create or Update Checkout Session when amount or order details settle
    useEffect(() => {
        if (amount <= 0 || disabled) return;

        let isCancelled = false;

        const initSession = async () => {
            setIsCreatingSession(true);
            setErrorMessage(null);

            try {
                // Safely destroy existing controller before making a new session
                safeDestroyController();

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
                    throw new Error("Unable to start secure card payment session.");
                }

                setSessionId(data.id);
            } catch (err: any) {
                if (!isCancelled) {
                    setErrorMessage("Unable to initialize secure card fields. Please refresh the page or try again.");
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
    }, [amount, disabled, customerEmail, channel, orderId, sessionRefreshTrigger]);

    // 3. Mount Veyra Hosted Fields when SDK + Session + DOM Container are ready
    useEffect(() => {
        if (!sdkLoaded || !sessionId || !window.Veyra || !containerRef.current) return;

        let active = true;

        const mountFields = async () => {
            try {
                safeDestroyController();

                const controller = window.Veyra!.init({
                    publishableKey,
                    sessionId: sessionId,
                    amountCents: amountInCents,
                    currency: "usd",
                    onReady: () => {
                        if (active) setIsMounted(true);
                    },
                    onError: (err) => {
                        if (active) setErrorMessage(err?.message || "Invalid card details");
                    }
                });

                controllerRef.current = controller;

                // Mount inside the target container
                await controller.mount("#veyra-card-element");
            } catch (err: any) {
                if (active) {
                    setErrorMessage("Failed to render card fields. Please try again.");
                }
            }
        };

        mountFields();

        return () => {
            active = false;
            safeDestroyController();
        };
    }, [sdkLoaded, sessionId, publishableKey, amountInCents]);

    // 4. Submit & Tokenize Card
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!controllerRef.current || isBusy || disabled || !sessionId) return;

        setIsLocalProcessing(true);
        setErrorMessage(null);

        const currentSessionId = sessionId;

        try {
            const tokenResult = await controllerRef.current.tokenize();

            if (!tokenResult?.ok || !tokenResult?.basis_theory_token_intent_id) {
                const failureReason = 
                    typeof tokenResult?.error === "string" ? tokenResult.error :
                    tokenResult?.error?.message ? tokenResult.error.message :
                    typeof tokenResult?.message === "string" ? tokenResult.message :
                    "Please verify your card number, expiration, and CVV.";
                throw new Error(failureReason);
            }

            // Call universal handler to confirm charge on the server
            const paymentRes = await onTokenized(
                tokenResult.basis_theory_token_intent_id,
                currentSessionId,
                tokenResult.card_summary
            );

            // If 3D Secure verification is required by issuer:
            if (paymentRes?.status === "REQUIRES_ACTION" && paymentRes?.redirectUrl) {
                toast.info("Redirecting to bank verification (3D Secure)...");
                window.location.href = paymentRes.redirectUrl;
                return;
            }

            if (paymentRes?.error) {
                const errText = typeof paymentRes.error === "string" 
                    ? paymentRes.error 
                    : paymentRes.error?.message || "Payment declined. Please try another card.";
                
                // CRITICAL: Every confirmation consumes the session. A new session must always be created.
                setSessionId(null);
                setSessionRefreshTrigger(prev => prev + 1);
                throw new Error(errText);
            }

            // Successfully processed - clear sessionId so any new purchases start fresh
            setSessionId(null);
            setSessionRefreshTrigger(prev => prev + 1);
        } catch (err: any) {
            // CRITICAL: Ensure a fresh session is always created after any failed attempt
            setSessionId(null);
            setSessionRefreshTrigger(prev => prev + 1);

            let msg = "Payment declined. Please try another card.";
            if (typeof err === "string") msg = err;
            else if (err?.message && typeof err.message === "string" && err.message !== "[object Object]") msg = err.message;
            else if (err?.error && typeof err.error === "string") msg = err.error;
            else if (err?.error?.message) msg = err.error.message;

            const lower = msg.toLowerCase();
            if (lower.includes("one or more validation errors") || lower.includes("validation error") || lower.includes("invalid card") || lower.includes("expiration") || lower.includes("cvv") || lower.includes("security code")) {
                msg = "Please check your card details. The card number, expiration date, or CVV is invalid.";
            } else if (lower.includes("insufficient funds") || lower.includes("balance")) {
                msg = "Payment declined due to insufficient funds. Please use an alternate card.";
            } else if (lower.includes("declined") || lower.includes("do not honor") || lower.includes("card_declined")) {
                msg = "Your card was declined by the issuer. Please try another card or contact your bank.";
            } else if (lower.includes("already completed") || lower.includes("not been charged again")) {
                msg = "This payment attempt has expired. Please re-enter your card details to complete your order.";
            } else if (lower.includes("session") || lower.includes("token") || lower.includes("basis_theory") || lower.includes("unverifiable") || lower.includes("gateway") || lower.includes("failed to process") || lower.includes("500") || lower.includes("400")) {
                msg = "Unable to process payment with this card. Please verify your card details or try another card.";
            }

            setErrorMessage(msg);
        } finally {
            setIsLocalProcessing(false);
        }
    };

    // 5. Handle Apple Pay Submission
    const handleApplePayClick = async (e?: React.MouseEvent) => {
        if (e) e.preventDefault();
        if (!sessionId || isBusy || disabled) return;

        const ApplePaySession = (window as any).ApplePaySession;
        if (!ApplePaySession) {
            toast.error("Apple Pay is not supported on this browser.");
            return;
        }

        setIsApplePayProcessing(true);
        setErrorMessage(null);

        try {
            const paymentRequest = {
                countryCode: "US",
                currencyCode: "USD",
                merchantCapabilities: ["supports3DS", "supportsCredit", "supportsDebit"],
                supportedNetworks: ["visa", "masterCard", "amex", "discover"],
                total: {
                    label: "LIVWELL",
                    amount: amount.toFixed(2),
                    type: "final"
                },
                requiredBillingContactFields: ["name", "email"],
                requiredShippingContactFields: ["postalAddress", "name", "phone"]
            };

            const apSession = new ApplePaySession(3, paymentRequest);

            apSession.onvalidatemerchant = async (event: any) => {
                try {
                    const btKey = "key_prod_us_pub_Xu4pJrfLcTwegWJVxoRdiB";
                    const host = window.location.host;
                    const domain = host.includes("livwellresearchlabs.com") ? "www.livwellresearchlabs.com" : host;

                    const res = await fetch("https://api.basistheory.com/apple-pay/session", {
                        method: "POST",
                        headers: {
                            "BT-API-KEY": btKey,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            validation_url: event.validationURL,
                            display_name: "LIVWELL",
                            domain: domain
                        })
                    });

                    if (!res.ok) {
                        const errText = await res.text().catch(() => "");
                        console.error("[Apple Pay] Merchant validation non-2xx:", res.status, errText);
                        try { apSession.abort(); } catch (_) {}
                        setErrorMessage("Apple Pay merchant validation failed. Please pay with card below.");
                        setIsApplePayProcessing(false);
                        return;
                    }

                    const merchantSession = await res.json();
                    apSession.completeMerchantValidation(merchantSession);
                } catch (err: any) {
                    console.error("[Apple Pay] Merchant validation threw:", err);
                    try { apSession.abort(); } catch (_) {}
                    setErrorMessage("Unable to validate Apple Pay. Please use card below.");
                    setIsApplePayProcessing(false);
                }
            };

            apSession.onpaymentauthorized = async (event: any) => {
                try {
                    const btKey = "key_prod_us_pub_Xu4pJrfLcTwegWJVxoRdiB";
                    const paymentToken = event.payment?.token;

                    if (!paymentToken) {
                        try { apSession.completePayment(ApplePaySession.STATUS_FAILURE); } catch (_) {}
                        throw new Error("Apple Pay payment token missing.");
                    }

                    // Vault into Basis Theory
                    const btRes = await fetch("https://api.basistheory.com/apple-pay", {
                        method: "POST",
                        headers: {
                            "BT-API-KEY": btKey,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            apple_payment_data: paymentToken
                        })
                    });

                    if (!btRes.ok) {
                        const btErr = await btRes.text().catch(() => "");
                        console.error("[Apple Pay] Tokenization failed:", btRes.status, btErr);
                        try { apSession.completePayment(ApplePaySession.STATUS_FAILURE); } catch (_) {}
                        throw new Error("Failed to secure Apple Pay token.");
                    }

                    const btData = await btRes.json();
                    const tokenId = btData?.apple_pay?.id || btData?.id || btData?.token?.id;

                    if (!tokenId) {
                        try { apSession.completePayment(ApplePaySession.STATUS_FAILURE); } catch (_) {}
                        throw new Error("Invalid Apple Pay token ID.");
                    }

                    try { apSession.completePayment(ApplePaySession.STATUS_SUCCESS); } catch (_) {}

                    const displayName = event.payment?.token?.paymentMethod?.displayName || "";
                    const last4 = displayName.match(/\d{4}$/)?.[0] || "AP";

                    // Call universal processor with the token
                    const paymentRes = await onTokenized(
                        tokenId,
                        sessionId,
                        { brand: "apple_pay", last4 }
                    );

                    if (paymentRes?.status === "REQUIRES_ACTION" && paymentRes?.redirectUrl) {
                        window.location.href = paymentRes.redirectUrl;
                        return;
                    }

                    if (paymentRes?.error) {
                        setSessionId(null);
                        setSessionRefreshTrigger(prev => prev + 1);
                        throw new Error(typeof paymentRes.error === "string" ? paymentRes.error : "Payment declined.");
                    }

                    setSessionId(null);
                    setSessionRefreshTrigger(prev => prev + 1);
                } catch (err: any) {
                    setSessionId(null);
                    setSessionRefreshTrigger(prev => prev + 1);
                    setErrorMessage(err?.message || "Payment declined with Apple Pay. Please try another card.");
                } finally {
                    setIsApplePayProcessing(false);
                }
            };

            apSession.oncancel = () => {
                setIsApplePayProcessing(false);
            };

            apSession.begin();
        } catch (err: any) {
            console.error("[Apple Pay] Launch failed:", err);
            setIsApplePayProcessing(false);
            setErrorMessage("Unable to launch Apple Pay. Please use card below.");
        }
    };

    const isBusy = parentLoading || isCreatingSession || isLocalProcessing || isApplePayProcessing;
    const isButtonEnabled = isMounted && !isBusy && !disabled;
    const isApplePayButtonEnabled = Boolean(sessionId) && !isBusy && !disabled;
    const isPreviewMode = typeof window !== "undefined" && window.location.search.includes("preview_gateway=veyra");

    return (
        <form onSubmit={handleSubmit} className="space-y-4 text-left">

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

            {/* Apple Pay Express Section */}
            {isApplePayAvailable && (
                <div className="space-y-3">
                    <button
                        type="button"
                        onClick={handleApplePayClick}
                        disabled={!isApplePayButtonEnabled}
                        className={`w-full h-12 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer shadow-md ${
                            isApplePayButtonEnabled
                                ? "bg-black hover:bg-neutral-900 active:scale-[0.99] text-white"
                                : "bg-neutral-300 dark:bg-neutral-800 opacity-60 cursor-not-allowed text-neutral-500"
                        }`}
                        style={{
                            WebkitAppearance: "-apple-pay-button",
                            // @ts-ignore
                            ApplePayButtonType: "buy",
                            ApplePayButtonStyle: "black"
                        }}
                        aria-label="Pay with Apple Pay"
                    >
                        {isApplePayProcessing && (
                            <span className="flex items-center justify-center gap-2 text-sm font-medium text-white h-full bg-black/80 rounded-xl">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Connecting to Apple Pay...
                            </span>
                        )}
                    </button>

                    <div className="relative flex items-center justify-center my-2">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-border" />
                        </div>
                        <div className="relative bg-card px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                            Or pay with debit / credit card
                        </div>
                    </div>
                </div>
            )}

            {/* Preview indicator when viewing on non-Safari browser in preview mode */}
            {isPreviewMode && !isApplePayAvailable && (
                <div className="p-3 rounded-lg bg-neutral-900 text-white border border-neutral-800 text-xs flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2">
                        <span className="text-base font-bold">Pay</span>
                        <span className="text-[11px] text-neutral-300">
                            Apple Pay is active. Open this preview on Safari / iPhone with Apple Wallet to test.
                        </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold uppercase">
                        Active
                    </span>
                </div>
            )}

            {/* Card Fields Container */}
            <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs text-muted-foreground pb-2 border-b">
                    <span className="font-semibold text-foreground flex items-center gap-1.5 whitespace-nowrap">
                        <CreditCard className="h-3.5 w-3.5 text-primary shrink-0" />
                        Credit or Debit Card
                    </span>
                    <div className="flex items-center gap-1 text-[11px] shrink-0 text-muted-foreground">
                        <span>Visa</span>
                        <span>•</span>
                        <span>MC</span>
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
