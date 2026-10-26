import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Lock, Loader2, CreditCard, ShieldCheck, AlertCircle, ExternalLink, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { ThixGatewayConfig } from "@/config/paymentGateways";
import { supabase } from "@/integrations/supabase/client";

export interface ThixCheckoutProps {
    amount: number;
    config: ThixGatewayConfig;
    customerEmail?: string;
    shippingAddress?: any;
    billingAddress?: any;
    orderId?: string;
    items?: any[];
    loading?: boolean;
    disabled?: boolean;
    disabledReason?: string;
    onPaymentSuccess: (intentId: string, orderId?: string) => Promise<any>;
    onCreateDraftOrder?: () => Promise<string>;
}

export const ThixCheckout: React.FC<ThixCheckoutProps> = ({
    amount,
    config,
    customerEmail,
    shippingAddress,
    billingAddress,
    orderId: initialOrderId,
    items,
    loading: parentLoading = false,
    disabled = false,
    disabledReason,
    onPaymentSuccess,
    onCreateDraftOrder,
}) => {
    const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
    const [intentId, setIntentId] = useState<string | null>(null);
    const [currentOrderId, setCurrentOrderId] = useState<string | null>(initialOrderId || null);
    const [isInitializing, setIsInitializing] = useState<boolean>(false);
    const [isIframeLoading, setIsIframeLoading] = useState<boolean>(true);
    const [isCompleted, setIsCompleted] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [sessionKey, setSessionKey] = useState<number>(0);

    const iframeRef = useRef<HTMLIFrameElement>(null);

    const clientId = config?.clientId || import.meta.env.VITE_3THIX_CLIENT_ID || "";
    const integrationType = config?.integrationType || "iframe";
    const isSandbox = config?.environment === "sandbox";

    // 1. Listen for 3thix cross-domain postMessage events from iframe
    useEffect(() => {
        const handlePostMessage = async (event: MessageEvent) => {
            // Validate message data
            if (!event.data) return;

            let data = event.data;
            if (typeof data === "string") {
                try {
                    data = JSON.parse(data);
                } catch {
                    // Plain text message, ignore if not JSON
                    return;
                }
            }

            const eventType = data.event || data.type || data.action || "";
            const status = data.status || (data.data && data.data.status) || "";
            const resolvedIntentId = data.intent_id || data.data?.intent_id || intentId || "";

            console.log("👉 [3thix postMessage]", eventType, status, data);

            // Handle successful payment
            if (
                eventType === "payment.succeeded" ||
                eventType === "payment.success" ||
                eventType === "payment_succeeded" ||
                status === "succeeded" ||
                status === "paid" ||
                status === "completed"
            ) {
                setIsCompleted(true);
                toast.success("3thix payment verified successfully!");
                try {
                    await onPaymentSuccess(resolvedIntentId, currentOrderId || undefined);
                } catch (err: any) {
                    setErrorMessage(err?.message || "Error finalizing order after payment.");
                }
                return;
            }

            // Handle failed payment
            if (
                eventType === "payment.failed" ||
                eventType === "payment_failed" ||
                status === "failed" ||
                status === "declined"
            ) {
                const failReason = data.message || data.error?.message || "Your payment was declined. Please verify your card details or try an alternate payment method.";
                setErrorMessage(failReason);
                toast.error(failReason);
                return;
            }

            // Handle user cancel inside checkout
            if (eventType === "payment.canceled" || status === "canceled") {
                toast.info("Payment session was cancelled. You can try again when ready.");
                return;
            }

            // Handle iframe ready / started
            if (eventType === "payment.started" || eventType === "ready") {
                setIsIframeLoading(false);
            }
        };

        window.addEventListener("message", handlePostMessage);
        return () => window.removeEventListener("message", handlePostMessage);
    }, [intentId, currentOrderId, onPaymentSuccess]);

    // 2. Initialize or Refresh 3thix Payment Intent when amount or ready state changes
    useEffect(() => {
        if (amount <= 0 || disabled) {
            setPaymentUrl(null);
            setIntentId(null);
            return;
        }

        let isCancelled = false;

        const initThixSession = async () => {
            setIsInitializing(true);
            setIsIframeLoading(true);
            setErrorMessage(null);

            try {
                // Ensure we have a draft order ID to link to the intent
                let orderRef = currentOrderId;
                if (!orderRef && onCreateDraftOrder) {
                    try {
                        orderRef = await onCreateDraftOrder();
                        if (!isCancelled) setCurrentOrderId(orderRef);
                    } catch (e) {
                        console.warn("[3thix] Could not pre-create draft order, using timestamp fallback:", e);
                    }
                }
                if (!orderRef) {
                    orderRef = `ORD-${Date.now()}`;
                }

                const baseUrl = (supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
                const apiKey = (supabase as any).supabaseKey || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

                const customerName = shippingAddress?.firstName 
                    ? `${shippingAddress.firstName} ${shippingAddress.lastName || ''}`.trim()
                    : customerEmail?.split("@")[0] || "Customer";

                const response = await fetch(`${baseUrl}/functions/v1/process-universal-payment`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${apiKey}`,
                        "apikey": apiKey,
                    },
                    body: JSON.stringify({
                        action: "create_thix_intent",
                        provider: "thix",
                        orderId: orderRef,
                        amount,
                        currency: "USD",
                        customerEmail: customerEmail || "customer@example.com",
                        customerName,
                        shippingAddress,
                        billingAddress,
                        items: items || [],
                        integrationType,
                        thixConfig: config,
                        returnUrl: `${window.location.origin}/order-confirmation/${orderRef}`,
                        cancelUrl: `${window.location.origin}/checkout`,
                    }),
                });

                if (isCancelled) return;

                const data = await response.json().catch(() => ({}));

                if (!response.ok || (!data?.data?.payment_url && !data?.payment_url)) {
                    const err = data?.error || data?.message || "Failed to initialize 3thix payment gateway. Please check your credentials in Site Settings.";
                    throw new Error(err);
                }

                const url = data.data?.payment_url || data.payment_url;
                const piId = data.data?.intent_id || data.intent_id || data.data?.id;

                setPaymentUrl(url);
                setIntentId(piId);
            } catch (err: any) {
                if (!isCancelled) {
                    const msg = err?.message || "Unable to start secure 3thix checkout session.";
                    setErrorMessage(msg);
                }
            } finally {
                if (!isCancelled) {
                    setIsInitializing(false);
                }
            }
        };

        initThixSession();

        return () => {
            isCancelled = true;
        };
    }, [amount, disabled, sessionKey, integrationType, config?.environment, config?.apiBaseUrl]);

    const isBusy = parentLoading || isInitializing;

    // Handle Manual Redirect Checkout
    const handleRedirectClick = () => {
        if (!paymentUrl) return;
        window.location.href = paymentUrl;
    };

    const handleOpenInNewWindow = () => {
        if (!paymentUrl) return;
        window.open(paymentUrl, "_blank", "noopener,noreferrer");
    };

    const handleRetrySession = () => {
        setPaymentUrl(null);
        setIntentId(null);
        setSessionKey(prev => prev + 1);
    };

    return (
        <div className="space-y-4 text-left">
            {/* Header / Security Badge */}
            <div className="p-3.5 bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-indigo-500/10 border border-violet-500/30 rounded-xl text-xs space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md bg-violet-600 flex items-center justify-center text-white font-black text-xs shadow-xs">
                            3
                        </div>
                        <span className="font-bold text-foreground text-sm flex items-center gap-1.5">
                            3thix Payment Platform
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {isSandbox && (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 border border-amber-500/30">
                                Sandbox Mode
                            </span>
                        )}
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-md">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            <span>Encrypted Checkout</span>
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                    <span className="flex items-center gap-1">
                        <CreditCard className="h-3.5 w-3.5 text-primary" />
                        Credit & Debit Cards (Visa, MC, Amex, Discover) + ACH
                    </span>
                    <a
                        href="https://pay.3thix.com/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-primary hover:underline flex items-center gap-1"
                    >
                        pay.3thix.com <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                </div>
            </div>

            {/* Error Message Display */}
            {errorMessage && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1">
                        <strong className="font-semibold block">3thix Checkout Notice:</strong>
                        <p>{errorMessage}</p>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleRetrySession}
                            className="mt-2 h-7 text-xs border-destructive/40 hover:bg-destructive/15 text-destructive"
                        >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Retry Checkout Session
                        </Button>
                    </div>
                </div>
            )}

            {/* Success state banner if verified */}
            {isCompleted && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    <div>
                        <strong className="font-bold text-sm block">Payment Verified!</strong>
                        <span>Finalizing your order confirmation... Please do not close this window.</span>
                    </div>
                </div>
            )}

            {/* Main Checkout View: Iframe or Hosted Redirect */}
            {integrationType === "iframe" ? (
                <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                    <div className="relative min-h-[580px] w-full flex flex-col items-center justify-center">
                        {/* Loading Overlay */}
                        {(isBusy || isIframeLoading) && !isCompleted && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-xs z-10 space-y-3 p-6 text-center">
                                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-foreground">
                                        {isInitializing ? "Initializing 3thix Secure Payment..." : "Loading Secure Checkout Fields..."}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Connecting to pay.3thix.com secure payment gateway...
                                    </p>
                                </div>
                            </div>
                        )}

                        {paymentUrl ? (
                            <iframe
                                ref={iframeRef}
                                src={paymentUrl}
                                title="3thix Secure Checkout"
                                className="w-full min-h-[580px] border-0 rounded-xl"
                                allow="payment *; clipboard-write *"
                                onLoad={() => setIsIframeLoading(false)}
                            />
                        ) : !isBusy && !errorMessage ? (
                            <div className="p-6 text-center space-y-3">
                                <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
                                <p className="text-sm text-muted-foreground">
                                    {disabled ? (disabledReason || "Complete previous steps to enable payment") : "Preparing 3thix payment session..."}
                                </p>
                            </div>
                        ) : null}
                    </div>

                    {/* Footer link for opening externally if iframe is blocked */}
                    {paymentUrl && (
                        <div className="px-4 py-2.5 bg-muted/30 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                            <span>Experiencing issues with the embedded window?</span>
                            <button
                                type="button"
                                onClick={handleOpenInNewWindow}
                                className="font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                            >
                                Open in Full Tab <ExternalLink className="h-3 w-3" />
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                /* Hosted Redirect Option */
                <div className="p-6 rounded-xl border border-border bg-card shadow-sm space-y-4 text-center">
                    <div className="space-y-1">
                        <h4 className="text-base font-bold text-foreground">Hosted Checkout via 3thix</h4>
                        <p className="text-xs text-muted-foreground">
                            You will be redirected to the official 3thix payment portal (<code>pay.3thix.com</code>) to complete your transaction securely.
                        </p>
                    </div>

                    <Button
                        type="button"
                        onClick={handleRedirectClick}
                        disabled={isBusy || disabled || !paymentUrl}
                        className="w-full py-6 text-base font-bold shadow-md bg-violet-600 hover:bg-violet-700 text-white cursor-pointer"
                    >
                        {isBusy ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Initializing 3thix Portal...
                            </>
                        ) : disabled ? (
                            disabledReason || "Complete required fields to proceed"
                        ) : (
                            `Proceed to Pay $${amount.toFixed(2)} on 3thix`
                        )}
                    </Button>
                </div>
            )}

            {/* Security Guarantee Notice */}
            <div className="text-center space-y-1 pt-1">
                <p className="text-[11px] text-muted-foreground">
                    All transactions are processed through 3thix PCI-DSS Level 1 certified infrastructure. Your sensitive card details are never stored on our servers.
                </p>
            </div>
        </div>
    );
};

export default ThixCheckout;
