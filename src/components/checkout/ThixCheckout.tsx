import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Lock, Loader2, CreditCard, ShieldCheck, AlertCircle, RefreshCw, CheckCircle2 } from "lucide-react";
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

const STRIPE_JS_URL = "https://js.stripe.com/v3/";
const DEFAULT_THIX_PK = "thx_live_pk_60ca8d826c67c81476b612646c3030a0ff337b24";
const THIX_API_BASE = "https://pay.3thix.com/api";

function loadStripeJs(): Promise<any> {
    return new Promise((resolve, reject) => {
        if ((window as any).Stripe) {
            return resolve((window as any).Stripe);
        }
        const existing = document.querySelector(`script[src="${STRIPE_JS_URL}"]`) as HTMLScriptElement | null;
        if (existing) {
            existing.addEventListener("load", () => resolve((window as any).Stripe));
            existing.addEventListener("error", () => reject(new Error("Failed to load payment SDK")));
            return;
        }
        const el = document.createElement("script");
        el.src = STRIPE_JS_URL;
        el.async = true;
        el.onload = () => resolve((window as any).Stripe);
        el.onerror = () => reject(new Error("Failed to load payment SDK"));
        document.head.appendChild(el);
    });
}

export const ThixCheckout: React.FC<ThixCheckoutProps> = ({
    amount,
    config,
    customerEmail,
    shippingAddress,
    billingAddress,
    orderId: initialOrderId,
    loading: parentLoading = false,
    disabled = false,
    disabledReason,
    onPaymentSuccess,
    onCreateDraftOrder,
}) => {
    const [currentOrderId, setCurrentOrderId] = useState<string | null>(initialOrderId || null);
    const [isInitializing, setIsInitializing] = useState<boolean>(true);
    const [isReady, setIsReady] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [isCompleted, setIsCompleted] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [sessionKey, setSessionKey] = useState<number>(0);

    const cardMountRef = useRef<HTMLDivElement>(null);
    const expressMountRef = useRef<HTMLDivElement>(null);
    const stripeRef = useRef<any>(null);
    const elementsRef = useRef<any>(null);
    const paymentElementRef = useRef<any>(null);
    const expressElementRef = useRef<any>(null);
    const cfgStripeAccountRef = useRef<string | null>(null);
    const submitPaymentRef = useRef<(walletEvent?: any) => Promise<void>>(async () => {});

    const isSandbox = config?.environment === "sandbox";
    const apiKey = (
        config?.clientId ||
        import.meta.env.VITE_3THIX_CLIENT_ID ||
        DEFAULT_THIX_PK
    ).trim();

    const amountCents = Math.max(50, Math.round((Number(amount) || 0) * 100));

    const resolveBuyerDetails = useCallback(() => {
        const email = (customerEmail || billingAddress?.email || "").trim();
        const fullName = (
            billingAddress?.name ||
            (shippingAddress ? `${shippingAddress.firstName || ""} ${shippingAddress.lastName || ""}`.trim() : "")
        ).trim();
        const phone = (billingAddress?.phone || shippingAddress?.phone || "").trim();
        const line1 = (billingAddress?.line1 || shippingAddress?.addressLine1 || "").trim();
        const line2 = (shippingAddress?.addressLine2 || "").trim();
        const city = (billingAddress?.city || shippingAddress?.locality || "").trim();
        const state = (billingAddress?.state || shippingAddress?.administrativeDistrictLevel1 || "").trim();
        const postal_code = (billingAddress?.postal_code || shippingAddress?.postalCode || "").trim();
        const rawCountry = (billingAddress?.country || shippingAddress?.country || "US").trim();
        const country = /^[A-Za-z]{2}$/.test(rawCountry) ? rawCountry.toUpperCase() : "US";

        const billingDetails: Record<string, any> = {};
        if (email) billingDetails.email = email;
        if (fullName) billingDetails.name = fullName;
        if (phone) billingDetails.phone = phone;
        if (line1 || city || state || postal_code) {
            billingDetails.address = {
                line1: line1 || undefined,
                line2: line2 || undefined,
                city: city || undefined,
                state: state || undefined,
                postal_code: postal_code || undefined,
                country,
            };
        }
        return { email, fullName, billingDetails };
    }, [customerEmail, billingAddress, shippingAddress]);

    // Update amount dynamically on existing Stripe Elements instance without remounting card inputs
    useEffect(() => {
        if (elementsRef.current && amountCents >= 50) {
            try {
                elementsRef.current.update({ amount: amountCents });
            } catch (e) {
                console.warn("[Checkout] Could not update elements amount:", e);
            }
        }
    }, [amountCents]);

    // Core payment submission (used by both Card button and Express Checkout Apple/Google Pay)
    const handleConfirmPayment = useCallback(
        async (walletEvent?: any) => {
            if (isSubmitting || isCompleted) return;

            if (disabled) {
                const msg = disabledReason || "Please complete shipping and required acknowledgments first.";
                toast.error(msg);
                if (walletEvent?.paymentFailed) walletEvent.paymentFailed({ reason: "fail" });
                return;
            }

            const stripe = stripeRef.current;
            const elements = elementsRef.current;
            if (!stripe || !elements) {
                if (walletEvent?.paymentFailed) walletEvent.paymentFailed({ reason: "fail" });
                return;
            }

            const { email: buyerEmail, billingDetails } = resolveBuyerDetails();
            const effectiveEmail =
                buyerEmail ||
                walletEvent?.billingDetails?.email ||
                "customer@livwellresearchlabs.com";

            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(effectiveEmail)) {
                const msg = "Please enter a valid email address above before paying.";
                setErrorMessage(msg);
                toast.error(msg);
                if (walletEvent?.paymentFailed) walletEvent.paymentFailed({ reason: "fail" });
                return;
            }

            setIsSubmitting(true);
            setErrorMessage(null);
            let completed = false;

            try {
                // 1. Validate card fields via Stripe Elements
                const submitRes = await elements.submit();
                if (submitRes?.error) {
                    throw new Error(submitRes.error.message || "Please check your card details.");
                }

                // 2. Ensure a draft order exists in Supabase
                let orderRef = currentOrderId;
                if (!orderRef && onCreateDraftOrder) {
                    orderRef = await onCreateDraftOrder();
                    setCurrentOrderId(orderRef);
                }
                if (!orderRef) {
                    orderRef = `ORD-${Date.now()}`;
                }

                const sanitizedOrderRef = String(orderRef).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 100);

                // 3. Create direct card payment intent on 3thix (cardOnly: true, canRedirect: false)
                const payRes = await fetch(`${THIX_API_BASE}/payments`, {
                    method: "POST",
                    headers: {
                        "x-api-key": apiKey,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        amountCents,
                        externalOrderId: sanitizedOrderRef,
                        customerEmail: effectiveEmail,
                        canRedirect: false,
                        cardOnly: true,
                    }),
                });

                const payData = await payRes.json().catch(() => ({}));
                if (!payRes.ok) {
                    throw new Error(
                        payData?.error?.message ||
                            payData?.message ||
                            "Unable to initialize card transaction. Please check your details and try again."
                    );
                }

                if ((payData.stripeAccount || null) !== cfgStripeAccountRef.current) {
                    throw new Error("Payment session refreshed. Please click Pay again.");
                }

                if (
                    payData.payment &&
                    (payData.payment.amountCents !== amountCents ||
                        String(payData.payment.currency || "usd").toLowerCase() !== "usd")
                ) {
                    throw new Error("The order total changed. Please review your total and try again.");
                }

                const paymentId = payData.payment?.id;
                const clientSecret = payData.clientSecret;
                if (!clientSecret || !paymentId) {
                    throw new Error("Unable to initialize card authorization token.");
                }

                // 4. Confirm the card charge in-place with Stripe Elements (supports 3DS modal if required)
                const confirmRes = await stripe.confirmPayment({
                    elements,
                    clientSecret,
                    confirmParams: {
                        return_url: `${window.location.origin}/order-confirmation/${orderRef}`,
                        payment_method_data: {
                            billing_details: billingDetails,
                        },
                    },
                    redirect: "if_required",
                });

                if (confirmRes?.error) {
                    throw new Error(confirmRes.error.message || "Your card was declined. Please verify your card details.");
                }

                completed = true;

                // 5. Reconcile / sync payment status with 3thix
                const syncRes = await fetch(`${THIX_API_BASE}/payments/${paymentId}/sync`, {
                    method: "POST",
                    headers: {
                        "x-api-key": apiKey,
                    },
                });

                if (!syncRes.ok) {
                    throw new Error("Order confirmation is delayed. Please do not submit payment again.");
                }

                const syncedPayment = await syncRes.json().catch(() => ({}));
                if (!syncedPayment || syncedPayment.status !== "SUCCEEDED") {
                    throw new Error("Payment authorization is pending confirmation.");
                }

                // 6. Finalize order in Supabase and trigger confirmation emails
                setIsCompleted(true);
                toast.success("Payment approved!");
                await onPaymentSuccess(String(paymentId), orderRef);
            } catch (err: any) {
                const rawMsg = err?.message || "Something went wrong confirming your payment.";
                setErrorMessage(rawMsg);
                toast.error(rawMsg);
                if (!completed && walletEvent?.paymentFailed) {
                    walletEvent.paymentFailed({ reason: "fail" });
                }
            } finally {
                if (!completed) {
                    setIsSubmitting(false);
                }
            }
        },
        [
            isSubmitting,
            isCompleted,
            disabled,
            disabledReason,
            resolveBuyerDetails,
            currentOrderId,
            onCreateDraftOrder,
            apiKey,
            amountCents,
            onPaymentSuccess,
        ]
    );

    useEffect(() => {
        submitPaymentRef.current = handleConfirmPayment;
    }, [handleConfirmPayment]);

    // Initialize 3thix public config & mount inline Stripe Card + Express Wallet Elements
    useEffect(() => {
        if (amount <= 0) return;

        let isCancelled = false;

        const initInlineCardForm = async () => {
            setIsInitializing(true);
            setIsReady(false);
            setErrorMessage(null);

            try {
                const [StripeConstructor, cfgRes] = await Promise.all([
                    loadStripeJs(),
                    fetch(`${THIX_API_BASE}/public/config?mode=card`, {
                        headers: { "x-api-key": apiKey },
                    }),
                ]);

                if (isCancelled) return;

                const cfg = await cfgRes.json().catch(() => ({}));
                if (!cfgRes.ok || !cfg?.publishableKey) {
                    throw new Error(
                        cfg?.error?.message || "Unable to load card payment configuration."
                    );
                }

                if (!cfg.direct && cfg.cardPaymentsEnabled === false) {
                    throw new Error("Direct card processing is currently unavailable for this account.");
                }

                cfgStripeAccountRef.current = cfg.stripeAccount || null;

                const stripeInstance = cfg.stripeAccount
                    ? StripeConstructor(cfg.publishableKey, { stripeAccount: cfg.stripeAccount })
                    : StripeConstructor(cfg.publishableKey);

                stripeRef.current = stripeInstance;

                const isDark = document.documentElement.classList.contains("dark");
                const elements = stripeInstance.elements({
                    mode: "payment",
                    amount: amountCents,
                    currency: "usd",
                    paymentMethodTypes: ["card"],
                    appearance: {
                        theme: isDark ? "night" : "stripe",
                        variables: {
                            colorPrimary: "#0f766e",
                            borderRadius: "10px",
                            fontFamily: "Inter, system-ui, -apple-system, sans-serif",
                        },
                    },
                });

                elementsRef.current = elements;

                const wallets = cfg.wallets || {};
                const { billingDetails } = resolveBuyerDetails();

                // Mount Express Checkout (Apple Pay / Google Pay) if supported
                let hasExpress = false;
                if (expressMountRef.current) {
                    expressMountRef.current.innerHTML = "";
                    expressMountRef.current.style.display = "none";
                    try {
                        const express = elements.create("expressCheckout", {
                            emailRequired: true,
                            paymentMethods: {
                                applePay: wallets.applePay === false ? "never" : "always",
                                googlePay: wallets.googlePay === false ? "never" : "always",
                                link: "never",
                                amazonPay: "never",
                                paypal: "never",
                                klarna: "never",
                            },
                        });

                        express.on("ready", (event: any) => {
                            if (isCancelled || !expressMountRef.current) return;
                            const methods = event?.availablePaymentMethods;
                            const show = Boolean(methods && (methods.applePay || methods.googlePay));
                            expressMountRef.current.style.display = show ? "block" : "none";
                        });

                        express.on("confirm", (ev: any) => {
                            submitPaymentRef.current(ev);
                        });

                        express.mount(expressMountRef.current);
                        expressElementRef.current = express;
                        hasExpress = true;
                    } catch (_) {
                        hasExpress = false;
                    }
                }

                // Mount inline Card Payment Element (always expanded from the start, with Link disabled)
                if (cardMountRef.current) {
                    cardMountRef.current.innerHTML = "";
                    const pe = elements.create("payment", {
                        layout: {
                            type: "tabs",
                            defaultCollapsed: false,
                        },
                        defaultValues: {
                            billingDetails,
                        },
                        wallets: {
                            applePay: "never",
                            googlePay: "never",
                            link: "never",
                        },
                    });

                    pe.on("ready", () => {
                        if (!isCancelled) {
                            setIsReady(true);
                            setIsInitializing(false);
                        }
                    });

                    pe.on("loaderror", (ev: any) => {
                        if (!isCancelled) {
                            setErrorMessage(
                                ev?.error?.message || "Could not load secure card fields. Please refresh and try again."
                            );
                            setIsInitializing(false);
                        }
                    });

                    pe.mount(cardMountRef.current);
                    paymentElementRef.current = pe;
                }
            } catch (err: any) {
                if (!isCancelled) {
                    setErrorMessage(err?.message || "Unable to initialize secure card fields.");
                    setIsInitializing(false);
                }
            }
        };

        initInlineCardForm();

        return () => {
            isCancelled = true;
            try {
                paymentElementRef.current?.destroy?.();
            } catch (_) {}
            try {
                expressElementRef.current?.destroy?.();
            } catch (_) {}
        };
    }, [apiKey, sessionKey]);

    const handleRetrySession = () => {
        setErrorMessage(null);
        setSessionKey((prev) => prev + 1);
    };

    const isButtonDisabled =
        parentLoading || isInitializing || !isReady || isSubmitting || isCompleted || disabled;

    return (
        <div className="space-y-4 text-left">
            {/* Security Header */}
            <div className="p-3.5 bg-gradient-to-r from-primary/5 via-card to-primary/5 border border-border/80 rounded-xl text-xs space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
                            <CreditCard className="h-4 w-4" />
                        </div>
                        <div>
                            <span className="font-bold text-foreground text-sm block leading-tight">
                                Credit or Debit Card
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                                Instant, secure encrypted card payment
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {isSandbox && (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 border border-amber-500/30">
                                Test Mode
                            </span>
                        )}
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                            <span>256-Bit SSL Encrypted</span>
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground pt-1.5 border-t border-border/50">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-wider">
                            Accepted:
                        </span>
                        <div className="flex items-center gap-1 text-[10px] font-medium text-foreground">
                            <span className="px-1.5 py-0.5 rounded bg-muted/60 border text-[10px]">Visa</span>
                            <span className="px-1.5 py-0.5 rounded bg-muted/60 border text-[10px]">Mastercard</span>
                            <span className="px-1.5 py-0.5 rounded bg-muted/60 border text-[10px]">Amex</span>
                            <span className="px-1.5 py-0.5 rounded bg-muted/60 border text-[10px]">Discover</span>
                        </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Lock className="h-2.5 w-2.5 text-emerald-500" /> Bank-Grade Security
                    </span>
                </div>
            </div>

            {/* Error Alert */}
            {errorMessage && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1">
                        <strong className="font-semibold block">Payment Notice:</strong>
                        <p>{errorMessage}</p>
                        {!isReady && (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleRetrySession}
                                className="mt-2 h-7 text-xs border-destructive/40 hover:bg-destructive/15 text-destructive"
                            >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Reload Card Form
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* Success Banner */}
            {isCompleted && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    <div>
                        <strong className="font-bold text-sm block">Payment Approved!</strong>
                        <span>Finalizing your order confirmation... Please do not close this window.</span>
                    </div>
                </div>
            )}

            {/* Inline Card Form Container */}
            <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-4">
                {isInitializing && (
                    <div className="py-8 flex flex-col items-center justify-center space-y-2 text-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <p className="text-xs text-muted-foreground">Loading secure card fields...</p>
                    </div>
                )}

                {/* Express Wallets (Apple Pay / Google Pay) */}
                <div ref={expressMountRef} style={{ display: "none" }} className="pb-2" />

                {/* Card Input Element */}
                <div ref={cardMountRef} className={isInitializing ? "min-h-[120px]" : ""} />

                <Button
                    type="button"
                    onClick={() => handleConfirmPayment()}
                    disabled={isButtonDisabled}
                    className="w-full py-6 text-base font-bold transition-all shadow-md cursor-pointer"
                >
                    {isSubmitting || parentLoading ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Processing Secure Payment...
                        </>
                    ) : isInitializing ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Loading Card Fields...
                        </>
                    ) : disabled ? (
                        disabledReason || "Complete required fields to pay"
                    ) : (
                        `Pay $${amount.toFixed(2)} with Card`
                    )}
                </Button>
            </div>

            <div className="text-center space-y-1 pt-1">
                <p className="text-[11px] text-muted-foreground">
                    All transactions are processed through bank-grade PCI-DSS Level 1 certified encrypted infrastructure. Your sensitive card details are never stored on our servers.
                </p>
            </div>
        </div>
    );
};

export default ThixCheckout;
