import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Lock, Loader2, CreditCard } from "lucide-react";
import { useCardTokenization, useThreeds } from "@tagadapay/core-js/react";
import { TagadaPayGatewayConfig } from "@/config/paymentGateways";

interface TagadaCheckoutProps {
    amount: number;
    config: TagadaPayGatewayConfig;
    loading: boolean;
    disabled?: boolean;
    disabledReason?: string;
    onTokenized: (tagadaToken: string, rawToken?: any) => Promise<any>;
}

export const TagadaCheckout: React.FC<TagadaCheckoutProps> = ({
    amount,
    config,
    loading: parentLoading,
    disabled = false,
    disabledReason,
    onTokenized
}) => {
    const navigate = useNavigate();
    const { clearCart } = useCart();

    const cardInputRef = useRef<HTMLInputElement>(null);
    const expInputRef = useRef<HTMLInputElement>(null);
    const cvvInputRef = useRef<HTMLInputElement>(null);
    const zipInputRef = useRef<HTMLInputElement>(null);

    const [cardData, setCardData] = useState({
        number: "",
        expMonth: "",
        expYear: "",
        cvv: "",
        cardholderName: "",
        billingZip: ""
    });

    const [expFormatted, setExpFormatted] = useState("");
    const [isLocalProcessing, setIsLocalProcessing] = useState(false);
    const [threedsActive, setThreedsActive] = useState(false);

    const isProd = config?.environment === "production";
    const env = isProd ? "production" : "development";

    const { tokenizeCard, isLoading: isTokenizing, error: tokenError, clearError } = useCardTokenization({
        environment: env as any,
        autoInitialize: true
    });

    const { startChallenge } = useThreeds({
        environment: env as any,
        autoInitialize: true
    });

    // Detect card brand
    const rawNumber = cardData.number.replace(/\D/g, "");
    const isAmex = /^3[47]/.test(rawNumber);
    const isVisa = /^4/.test(rawNumber);
    const isMastercard = /^5[1-5]|^2[2-7]/.test(rawNumber);
    const isDiscover = /^6(?:011|5)/.test(rawNumber);

    const brandName = isAmex ? "American Express" : isVisa ? "Visa" : isMastercard ? "Mastercard" : isDiscover ? "Discover" : "";

    // 1. Format Card Number & Auto-Advance
    const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, "");
        const maxLen = isAmex ? 15 : 16;
        if (val.length > maxLen) val = val.slice(0, maxLen);

        let formatted = val;
        if (isAmex) {
            if (val.length > 10) {
                formatted = `${val.slice(0, 4)} ${val.slice(4, 10)} ${val.slice(10)}`;
            } else if (val.length > 4) {
                formatted = `${val.slice(0, 4)} ${val.slice(4)}`;
            }
        } else {
            formatted = val.replace(/(.{4})/g, "$1 ").trim();
        }

        setCardData(prev => ({ ...prev, number: formatted }));

        if (val.length === maxLen) {
            setTimeout(() => expInputRef.current?.focus(), 10);
        }
    };

    // 2. Format Expiration Date (MM/YY) & Auto-Advance
    const handleExpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let digits = e.target.value.replace(/\D/g, "").slice(0, 4);
        let month = "";
        let year = "";

        if (digits.length >= 1 && parseInt(digits) > 1 && digits.length === 1) {
            digits = "0" + digits;
        }

        if (digits.length >= 2) {
            month = digits.slice(0, 2);
            let mInt = parseInt(month);
            if (mInt > 12) month = "12";
            if (mInt === 0) month = "01";

            year = digits.slice(2);
            setExpFormatted(year ? `${month}/${year}` : `${month}/`);
        } else {
            setExpFormatted(digits);
        }

        setCardData(prev => ({
            ...prev,
            expMonth: month,
            expYear: year
        }));

        if (digits.length === 4) {
            setTimeout(() => cvvInputRef.current?.focus(), 10);
        }
    };

    const handleExpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && expFormatted.endsWith("/")) {
            setExpFormatted(expFormatted.slice(0, 1));
        }
    };

    // 3. Format CVV & Auto-Advance
    const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const maxCvv = isAmex ? 4 : 3;
        const digits = e.target.value.replace(/\D/g, "").slice(0, maxCvv);
        setCardData(prev => ({ ...prev, cvv: digits }));

        if (digits.length === maxCvv) {
            setTimeout(() => zipInputRef.current?.focus(), 10);
        }
    };

    // Validation Statuses
    const reqDigits = isAmex ? 15 : 16;
    const isCardNumberValid = rawNumber.length === reqDigits;
    const rawExpDigits = expFormatted.replace(/\D/g, "");
    const isExpValid = rawExpDigits.length === 4 && parseInt(rawExpDigits.slice(0, 2)) >= 1 && parseInt(rawExpDigits.slice(0, 2)) <= 12;
    const reqCvvLen = isAmex ? 4 : 3;
    const isCvvValid = cardData.cvv.length === reqCvvLen;
    const isNameValid = cardData.cardholderName.trim().length >= 2;

    const isFormFullyComplete = isCardNumberValid && isExpValid && isCvvValid && isNameValid;
    const isBusy = parentLoading || isLocalProcessing || isTokenizing;
    const isButtonEnabled = isFormFullyComplete && !disabled && !isBusy;

    // Resilient direct BasisTheory tokenization fallback
    const directBasisTheoryTokenize = async (expMonthStr: string, expYearStr: string) => {
        const btKey = isProd
            ? "key_prod_us_pub_PNMB2AiaECJ463K6QAPNU6"
            : "key_test_us_pub_VExdfbFQARn821iqP8zNaq";

        const currentCentury = Math.floor(new Date().getFullYear() / 100) * 100;
        const fullYear = expYearStr.length === 2 ? currentCentury + parseInt(expYearStr) : parseInt(expYearStr);

        const res = await fetch("https://api.basistheory.com/tokens", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "BT-API-KEY": btKey
            },
            body: JSON.stringify({
                type: "card",
                data: {
                    number: rawNumber,
                    expiration_month: parseInt(expMonthStr),
                    expiration_year: fullYear,
                    cvc: cardData.cvv
                },
                metadata: {
                    cardholderName: cardData.cardholderName.trim()
                }
            })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const errMsg = errData.title || errData.message || "Failed to tokenize card";
            throw new Error(errMsg);
        }

        const btData = await res.json();
        
        // Wrap into standard TagadaToken format
        const tagadaTokenPayload = {
            type: "card",
            token: btData.id,
            provider: "basistheory",
            nonSensitiveMetadata: {
                cardType: "card",
                expiryMonth: parseInt(expMonthStr),
                expiryYear: fullYear,
                last4: rawNumber.slice(-4),
                bin: rawNumber.slice(0, 6),
                brand: brandName.toLowerCase() || "visa",
                cardholderName: cardData.cardholderName.trim(),
                authentication: btData.card?.authentication || "optional"
            }
        };

        return {
            tagadaToken: btoa(JSON.stringify(tagadaTokenPayload)),
            rawToken: btData
        };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isButtonEnabled) return;

        setIsLocalProcessing(true);
        clearError();

        try {
            const expMonth = cardData.expMonth.padStart(2, "0");
            const expYearTwoDigits = cardData.expYear.length === 4 ? cardData.expYear.slice(-2) : cardData.expYear.padStart(2, "0");
            const formattedExpiry = `${expMonth}/${expYearTwoDigits}`;

            let finalTagadaToken = "";
            let finalRawToken: any = null;

            // 1. Try SDK tokenization first
            try {
                const tokenResult = await tokenizeCard({
                    cardNumber: rawNumber,
                    expiryDate: formattedExpiry,
                    cvc: cardData.cvv,
                    cardholderName: cardData.cardholderName.trim()
                });

                if (tokenResult?.tagadaToken) {
                    finalTagadaToken = tokenResult.tagadaToken;
                    finalRawToken = tokenResult.rawToken;
                }
            } catch (sdkErr) {
                console.warn("Core SDK tokenization fallback triggered:", sdkErr);
            }

            // 2. Direct BasisTheory fallback if SDK had any issue
            if (!finalTagadaToken) {
                const directResult = await directBasisTheoryTokenize(expMonth, expYearTwoDigits);
                finalTagadaToken = directResult.tagadaToken;
                finalRawToken = directResult.rawToken;
            }

            if (!finalTagadaToken) {
                throw new Error("Unable to encrypt card details. Please verify your card information and try again.");
            }

            // 3. Process payment through universal edge function
            const paymentRes = await onTokenized(finalTagadaToken, finalRawToken);

            // 4. If redirect is required (e.g. APM or Hosted 3DS):
            if (paymentRes?.requireAction === "redirect" && paymentRes?.requireActionData?.redirectUrl) {
                window.location.href = paymentRes.requireActionData.redirectUrl;
                return;
            }

            // 5. If 3DS challenge is required by issuer:
            if (paymentRes?.requireAction === "threeds_auth" && paymentRes?.requireActionData?.metadata?.threedsSession) {
                setThreedsActive(true);
                const threedsSession = paymentRes.requireActionData.metadata.threedsSession;
                toast.info("Your bank requires a 3D Secure verification step.");

                const challengeResult = await startChallenge({
                    sessionId: threedsSession.externalSessionId || threedsSession.id,
                    acsChallengeUrl: threedsSession.acsChallengeUrl,
                    acsTransactionId: threedsSession.acsTransID,
                    threeDSVersion: threedsSession.messageVersion || "2.2.0"
                });

                setThreedsActive(false);

                if (!challengeResult.success) {
                    throw new Error("3D Secure verification was cancelled or unsuccessful. Please try again.");
                }

                clearCart();
                toast.success("Payment verified successfully! Your order has been placed.");
                if (paymentRes.orderId) {
                    navigate(`/order-confirmation/${paymentRes.orderId}`);
                }
            }

        } catch (err: any) {
            console.error("Card checkout error:", err);

            // Human-friendly error translation
            let friendlyMessage = err.message || tokenError || "Payment processing failed. Please check your card details.";
            
            if (friendlyMessage.includes("Invalid card number") || friendlyMessage.includes("number")) {
                friendlyMessage = "Invalid card number. Please check the digits and try again.";
            } else if (friendlyMessage.includes("expired") || friendlyMessage.includes("expiry")) {
                friendlyMessage = "The expiration date entered is invalid or the card has expired.";
            } else if (friendlyMessage.includes("CVC") || friendlyMessage.includes("cvc") || friendlyMessage.includes("cvv")) {
                friendlyMessage = "Invalid CVV security code. Please check the 3 or 4 digits on the back of your card.";
            } else if (friendlyMessage.includes("declined") || friendlyMessage.includes("Do Not Honor") || friendlyMessage.includes("insufficient")) {
                friendlyMessage = "Your card was declined by the issuer. Please check with your bank or try a different card.";
            } else if (friendlyMessage.includes("Failed to tokenize")) {
                friendlyMessage = "Could not encrypt card details securely. Please verify your card number and expiration date.";
            }

            toast.error(friendlyMessage);
        } finally {
            setIsLocalProcessing(false);
            setThreedsActive(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div className="p-3 rounded-lg bg-muted/40 border border-border/80 text-xs space-y-1">
                <div className="font-semibold flex items-center justify-between text-foreground">
                    <span className="flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5 text-primary" />
                        Secure Credit & Debit Card Checkout
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground bg-background px-2 py-0.5 rounded border">
                        256-Bit SSL Encrypted
                    </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Your card details are tokenized and processed securely with end-to-end encryption. No sensitive card data is stored on our servers.
                </p>
            </div>

            <div className="space-y-3">
                {/* Cardholder Name */}
                <div className="space-y-1.5">
                    <Label htmlFor="tagada_cardholder" className="text-xs font-semibold">Cardholder Name</Label>
                    <Input
                        id="tagada_cardholder"
                        placeholder="Full Name as shown on card"
                        value={cardData.cardholderName}
                        onChange={(e) => setCardData(prev => ({ ...prev, cardholderName: e.target.value }))}
                        required
                        className="bg-background"
                        disabled={isBusy}
                    />
                </div>

                {/* Card Number */}
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                        <Label htmlFor="tagada_card_number" className="text-xs font-semibold">Card Number</Label>
                        {brandName && (
                            <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                                {brandName}
                            </span>
                        )}
                    </div>
                    <div className="relative">
                        <Input
                            id="tagada_card_number"
                            ref={cardInputRef}
                            placeholder={isAmex ? "3782 822464 81005" : "4000 1234 5678 9010"}
                            value={cardData.number}
                            onChange={handleCardNumberChange}
                            required
                            maxLength={isAmex ? 17 : 19}
                            className="bg-background font-mono tracking-wider pr-10 text-sm"
                            disabled={isBusy}
                        />
                        <div className="absolute right-3 top-2.5 text-muted-foreground pointer-events-none">
                            <CreditCard className="h-4 w-4" />
                        </div>
                    </div>
                </div>

                {/* Expiration Date (MM/YY) & CVV & Billing Zip */}
                <div className="grid grid-cols-3 gap-2.5">
                    {/* Expiration Date (MM/YY) */}
                    <div className="space-y-1.5">
                        <Label htmlFor="tagada_exp" className="text-xs font-semibold">Expires (MM/YY)</Label>
                        <Input
                            id="tagada_exp"
                            ref={expInputRef}
                            placeholder="MM / YY"
                            value={expFormatted}
                            onChange={handleExpChange}
                            onKeyDown={handleExpKeyDown}
                            required
                            maxLength={5}
                            className="bg-background font-mono text-center text-sm"
                            disabled={isBusy}
                        />
                    </div>

                    {/* CVV */}
                    <div className="space-y-1.5">
                        <Label htmlFor="tagada_cvv" className="text-xs font-semibold">CVV</Label>
                        <Input
                            id="tagada_cvv"
                            ref={cvvInputRef}
                            placeholder={isAmex ? "1234" : "123"}
                            value={cardData.cvv}
                            onChange={handleCvvChange}
                            required
                            maxLength={isAmex ? 4 : 3}
                            className="bg-background font-mono text-center text-sm"
                            disabled={isBusy}
                        />
                    </div>

                    {/* Billing ZIP */}
                    <div className="space-y-1.5">
                        <Label htmlFor="tagada_zip" className="text-xs font-semibold">Billing ZIP</Label>
                        <Input
                            id="tagada_zip"
                            ref={zipInputRef}
                            placeholder="Zip Code"
                            value={cardData.billingZip}
                            onChange={(e) => setCardData(prev => ({ ...prev, billingZip: e.target.value }))}
                            maxLength={10}
                            className="bg-background font-mono text-center text-sm"
                            disabled={isBusy}
                        />
                    </div>
                </div>
            </div>

            {/* Validation Hint */}
            {!isFormFullyComplete && (
                <p className="text-[11px] text-muted-foreground text-center pt-1">
                    {!isNameValid 
                        ? "Enter cardholder name" 
                        : !isCardNumberValid 
                            ? `Enter ${reqDigits}-digit card number` 
                            : !isExpValid 
                                ? "Enter valid expiration date (MM/YY)" 
                                : `Enter ${reqCvvLen}-digit CVV`}
                </p>
            )}

            {/* Submit Button */}
            <Button
                type="submit"
                disabled={!isButtonEnabled}
                className={`w-full py-6 text-base font-bold shadow-md transition-all duration-200 ${
                    isButtonEnabled
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-emerald-600/20"
                        : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                }`}
            >
                {isBusy ? (
                    <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        {threedsActive ? "Verifying 3D Secure..." : isTokenizing || isLocalProcessing ? "Encrypting Card..." : "Processing Secure Payment..."}
                    </>
                ) : disabled ? (
                    disabledReason || "Complete required steps to pay"
                ) : !isFormFullyComplete ? (
                    "Fill all card fields to complete order"
                ) : (
                    `Pay $${amount.toFixed(2)} with Card`
                )}
            </Button>
        </form>
    );
};
