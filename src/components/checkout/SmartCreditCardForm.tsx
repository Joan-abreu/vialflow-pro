import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Lock, Loader2, CreditCard, ShieldCheck } from "lucide-react";

interface SmartCreditCardFormProps {
    cardData: {
        number: string;
        expMonth: string;
        expYear: string;
        cvv: string;
        cardholderName: string;
        billingZip?: string;
    };
    onChange: (data: {
        number: string;
        expMonth: string;
        expYear: string;
        cvv: string;
        cardholderName: string;
        billingZip?: string;
    }) => void;
    onSubmit: () => void;
    loading: boolean;
    disabled?: boolean;
    disabledReason?: string;
    amount: number;
    instructions?: string;
    submitButtonText?: string;
}

export const SmartCreditCardForm: React.FC<SmartCreditCardFormProps> = ({
    cardData,
    onChange,
    onSubmit,
    loading,
    disabled = false,
    disabledReason,
    amount,
    instructions,
    submitButtonText
}) => {
    const cardInputRef = useRef<HTMLInputElement>(null);
    const expInputRef = useRef<HTMLInputElement>(null);
    const cvvInputRef = useRef<HTMLInputElement>(null);
    const zipInputRef = useRef<HTMLInputElement>(null);

    const [expFormatted, setExpFormatted] = useState("");

    // Sync initial expMonth and expYear into expFormatted (e.g. 12/28)
    useEffect(() => {
        if (cardData.expMonth && cardData.expYear) {
            const m = cardData.expMonth.padStart(2, "0");
            const y = cardData.expYear.slice(-2);
            setExpFormatted(`${m}/${y}`);
        }
    }, []);

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
            // Format 4-6-5
            if (val.length > 10) {
                formatted = `${val.slice(0, 4)} ${val.slice(4, 10)} ${val.slice(10)}`;
            } else if (val.length > 4) {
                formatted = `${val.slice(0, 4)} ${val.slice(4)}`;
            }
        } else {
            // Format 4-4-4-4
            formatted = val.replace(/(.{4})/g, "$1 ").trim();
        }

        onChange({ ...cardData, number: formatted });

        // Auto-advance to Expiration Date input when max digits entered
        if (val.length === maxLen) {
            setTimeout(() => {
                expInputRef.current?.focus();
            }, 10);
        }
    };

    // 2. Format Expiration Date (MM/YY) & Auto-Advance
    const handleExpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let digits = e.target.value.replace(/\D/g, "").slice(0, 4);

        let formatted = digits;
        let month = "";
        let year = "";

        if (digits.length >= 1) {
            // Check first digit: if user types > 1 (e.g. 5 for May), prefix 0 -> 05
            if (digits.length === 1 && parseInt(digits) > 1) {
                digits = "0" + digits;
            }
        }

        if (digits.length >= 2) {
            month = digits.slice(0, 2);
            // Validate month range (01 - 12)
            let mInt = parseInt(month);
            if (mInt > 12) month = "12";
            if (mInt === 0) month = "01";

            year = digits.slice(2);
            formatted = year ? `${month}/${year}` : `${month}/`;
        } else {
            formatted = digits;
        }

        setExpFormatted(formatted);

        // Extract month and year for parent
        onChange({
            ...cardData,
            expMonth: month,
            expYear: year
        });

        // Auto-advance to CVV when 4 digits (MM/YY) entered
        if (digits.length === 4) {
            setTimeout(() => {
                cvvInputRef.current?.focus();
            }, 10);
        }
    };

    // Handle backspace on empty year in Expiration Date
    const handleExpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && expFormatted.endsWith("/")) {
            setExpFormatted(expFormatted.slice(0, 1));
        }
    };

    // 3. Format CVV & Auto-Advance
    const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const maxCvv = isAmex ? 4 : 3;
        const digits = e.target.value.replace(/\D/g, "").slice(0, maxCvv);
        onChange({ ...cardData, cvv: digits });

        if (digits.length === maxCvv) {
            setTimeout(() => {
                zipInputRef.current?.focus();
            }, 10);
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
    const isButtonEnabled = isFormFullyComplete && !disabled && !loading;

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                if (isButtonEnabled) {
                    onSubmit();
                }
            }}
            className="space-y-4 text-left"
        >
            {instructions && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                        <Lock className="h-3.5 w-3.5" />
                        AES-256 Vaulted Card Payment
                    </div>
                    <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                        {instructions}
                    </p>
                </div>
            )}

            <div className="space-y-3">
                {/* Cardholder Name */}
                <div className="space-y-1.5">
                    <Label htmlFor="smart_cardholder" className="text-xs font-semibold">Cardholder Name</Label>
                    <Input
                        id="smart_cardholder"
                        placeholder="Full Name as shown on card"
                        value={cardData.cardholderName}
                        onChange={(e) => onChange({ ...cardData, cardholderName: e.target.value })}
                        required
                        className="bg-background"
                    />
                </div>

                {/* Card Number */}
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                        <Label htmlFor="smart_card_number" className="text-xs font-semibold">Card Number</Label>
                        {brandName && (
                            <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                                {brandName}
                            </span>
                        )}
                    </div>
                    <div className="relative">
                        <Input
                            id="smart_card_number"
                            ref={cardInputRef}
                            placeholder={isAmex ? "3782 822464 81005" : "4000 1234 5678 9010"}
                            value={cardData.number}
                            onChange={handleCardNumberChange}
                            required
                            maxLength={isAmex ? 17 : 19}
                            className="bg-background font-mono tracking-wider pr-10 text-sm"
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
                        <Label htmlFor="smart_exp" className="text-xs font-semibold">Expires (MM/YY)</Label>
                        <Input
                            id="smart_exp"
                            ref={expInputRef}
                            placeholder="MM / YY"
                            value={expFormatted}
                            onChange={handleExpChange}
                            onKeyDown={handleExpKeyDown}
                            required
                            maxLength={5}
                            className="bg-background font-mono text-center text-sm"
                        />
                    </div>

                    {/* CVV */}
                    <div className="space-y-1.5">
                        <Label htmlFor="smart_cvv" className="text-xs font-semibold">CVV</Label>
                        <Input
                            id="smart_cvv"
                            ref={cvvInputRef}
                            placeholder={isAmex ? "1234" : "123"}
                            value={cardData.cvv}
                            onChange={handleCvvChange}
                            required
                            maxLength={isAmex ? 4 : 3}
                            className="bg-background font-mono text-center text-sm"
                        />
                    </div>

                    {/* Billing ZIP */}
                    <div className="space-y-1.5">
                        <Label htmlFor="smart_zip" className="text-xs font-semibold">Billing ZIP</Label>
                        <Input
                            id="smart_zip"
                            ref={zipInputRef}
                            placeholder="Zip Code"
                            value={cardData.billingZip || ""}
                            onChange={(e) => onChange({ ...cardData, billingZip: e.target.value })}
                            maxLength={10}
                            className="bg-background font-mono text-center text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Helper Validation Hint */}
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
                        ? "bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-amber-600/20"
                        : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                }`}
            >
                {loading ? (
                    <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processing Secure Order...
                    </>
                ) : disabled ? (
                    disabledReason || "Complete required steps to pay"
                ) : !isFormFullyComplete ? (
                    "Fill all card fields to complete order"
                ) : (
                    submitButtonText || `Submit Order ($${amount.toFixed(2)})`
                )}
            </Button>
        </form>
    );
};
