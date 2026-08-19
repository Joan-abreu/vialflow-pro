import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Lock, CreditCard, Copy, Eye, EyeOff, CheckCircle2, XCircle, AlertTriangle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface VirtualTerminalModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    order: any;
    onOrderUpdated?: () => void;
}

export const VirtualTerminalModal: React.FC<VirtualTerminalModalProps> = ({
    open,
    onOpenChange,
    order,
    onOrderUpdated
}) => {
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [cardDetails, setCardDetails] = useState<any>(null);
    const [isPurged, setIsPurged] = useState(false);
    const [last4, setLast4] = useState("0000");
    const [cardBrand, setCardBrand] = useState("Card");
    const [showCVV, setShowCVV] = useState(false);
    const [showDeclineForm, setShowDeclineForm] = useState(false);
    const [declineReason, setDeclineReason] = useState("Declined by Issuer");

    useEffect(() => {
        if (open && order?.id) {
            fetchVaultedCard();
        } else {
            setCardDetails(null);
            setShowCVV(false);
            setShowDeclineForm(false);
        }
    }, [open, order?.id]);

    const fetchVaultedCard = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${supabase.supabaseUrl}/functions/v1/vault-card-payment`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || supabase.supabaseKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    action: "decrypt_for_terminal",
                    orderId: order.id
                })
            });

            const data = await response.json();
            if (!response.ok || data.error) {
                throw new Error(data.error || "Failed to decrypt card details");
            }

            if (data.isPurged) {
                setIsPurged(true);
                setLast4(data.last4 || "0000");
                setCardBrand(data.cardBrand || "Card");
            } else {
                setIsPurged(false);
                setCardDetails(data.cardDetails);
                setLast4(data.last4 || "0000");
                setCardBrand(data.cardBrand || "Card");
            }
        } catch (err: any) {
            console.error("Error fetching vaulted card:", err);
            toast.error(err.message || "Could not decrypt vaulted card details");
        } finally {
            setLoading(false);
        }
    };

    const handleCopyCard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Card number copied to clipboard!");
    };

    const handleMarkAsCharged = async () => {
        setProcessing(true);
        try {
            const response = await fetch(`${supabase.supabaseUrl}/functions/v1/vault-card-payment`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || supabase.supabaseKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    action: "mark_as_processed",
                    orderId: order.id
                })
            });

            const data = await response.json();
            if (!response.ok || data.error) {
                throw new Error(data.error || "Failed to process card");
            }

            toast.success("Payment marked as successful! CVV redacted & receipt email sent.");
            if (onOrderUpdated) onOrderUpdated();
            onOpenChange(false);
        } catch (err: any) {
            console.error("Error marking as charged:", err);
            toast.error(err.message || "Failed to mark order as charged");
        } finally {
            setProcessing(false);
        }
    };

    const handleMarkAsDeclined = async () => {
        setProcessing(true);
        try {
            const response = await fetch(`${supabase.supabaseUrl}/functions/v1/vault-card-payment`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || supabase.supabaseKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    action: "mark_as_declined",
                    orderId: order.id,
                    reason: declineReason
                })
            });

            const data = await response.json();
            if (!response.ok || data.error) {
                throw new Error(data.error || "Failed to decline card");
            }

            toast.warning("Order marked as declined. Customer notified via email.");
            if (onOrderUpdated) onOrderUpdated();
            onOpenChange(false);
        } catch (err: any) {
            console.error("Error marking as declined:", err);
            toast.error(err.message || "Failed to record decline");
        } finally {
            setProcessing(false);
        }
    };

    const formattedCardNumber = cardDetails?.cardNumber 
        ? cardDetails.cardNumber.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim()
        : "";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md sm:max-w-lg bg-background border shadow-2xl">
                <DialogHeader className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 flex items-center gap-1.5 px-3 py-1 font-bold">
                            <Lock className="h-3.5 w-3.5" />
                            Admin Virtual Terminal
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                            Order #{order?.id?.slice(0, 8)?.toUpperCase()}
                        </span>
                    </div>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-primary" />
                        Process Offline Card Charge
                    </DialogTitle>
                    <DialogDescription>
                        Securely view AES-256 encrypted credit card details to complete terminal processing.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground font-medium">Decrypting card details securely from vault...</p>
                    </div>
                ) : isPurged ? (
                    <div className="p-6 rounded-xl bg-muted/40 border text-center space-y-3">
                        <ShieldCheck className="h-10 w-10 text-emerald-600 mx-auto" />
                        <h4 className="font-bold text-foreground">PCI Redacted & Completed</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Sensitive CVV and full card numbers for this order have been purged from the vault to maintain PCI-DSS compliance.
                        </p>
                        <div className="inline-block bg-background px-4 py-2 rounded-lg border font-mono text-sm font-semibold">
                            {cardBrand} ending in ****{last4}
                        </div>
                    </div>
                ) : cardDetails ? (
                    <div className="space-y-5 py-2">
                        {/* Summary Bar */}
                        <div className="p-3.5 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between text-sm">
                            <span className="text-muted-foreground font-medium">Total Amount to Charge:</span>
                            <span className="text-lg font-extrabold text-primary">${Number(order?.total_amount || 0).toFixed(2)}</span>
                        </div>

                        {/* Card Details Box */}
                        <div className="space-y-4 p-4 rounded-xl border bg-card/50 shadow-sm">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Cardholder Name</Label>
                                <Input 
                                    value={cardDetails.cardholderName || order?.customer_name || "N/A"} 
                                    readOnly 
                                    className="font-medium bg-muted/30"
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Card Number ({cardBrand})</Label>
                                <div className="flex items-center gap-2">
                                    <Input 
                                        value={formattedCardNumber} 
                                        readOnly 
                                        className="font-mono text-base font-bold tracking-widest bg-muted/30"
                                    />
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        size="icon"
                                        onClick={() => handleCopyCard(cardDetails.cardNumber)}
                                        title="Copy Card Number"
                                    >
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Expires</Label>
                                    <Input 
                                        value={`${cardDetails.expMonth}/${cardDetails.expYear}`} 
                                        readOnly 
                                        className="font-mono text-sm font-semibold bg-muted/30"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">CVV</Label>
                                    <div className="relative">
                                        <Input 
                                            type={showCVV ? "text" : "password"}
                                            value={cardDetails.cvv || "123"} 
                                            readOnly 
                                            className="font-mono text-sm font-semibold pr-8 bg-muted/30"
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => setShowCVV(!showCVV)}
                                            className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                                        >
                                            {showCVV ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Billing Zip</Label>
                                    <Input 
                                        value={cardDetails.billingZip || order?.shipping_postal_code || "N/A"} 
                                        readOnly 
                                        className="font-mono text-sm font-semibold bg-muted/30"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Optional Decline Form */}
                        {showDeclineForm && (
                            <div className="p-3.5 rounded-lg border border-red-500/30 bg-red-500/5 space-y-3">
                                <Label className="text-xs font-semibold text-red-700 dark:text-red-400">Select Decline Reason:</Label>
                                <Select value={declineReason} onValueChange={setDeclineReason}>
                                    <SelectTrigger className="bg-background border-red-200">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Declined by Issuer">Declined by Issuer / Bank</SelectItem>
                                        <SelectItem value="Insufficient Funds">Insufficient Funds</SelectItem>
                                        <SelectItem value="Incorrect CVV or Billing Zip">Incorrect CVV or Billing Zip</SelectItem>
                                        <SelectItem value="Expired Card">Expired Card</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="py-6 text-center text-muted-foreground text-sm">
                        No active card data available for this order.
                    </div>
                )}

                <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
                    {!isPurged && cardDetails && (
                        <>
                            {!showDeclineForm ? (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                        onClick={() => setShowDeclineForm(true)}
                                        disabled={processing}
                                    >
                                        <XCircle className="h-4 w-4 mr-2" />
                                        Decline Card
                                    </Button>
                                    <Button
                                        type="button"
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex-1"
                                        onClick={handleMarkAsCharged}
                                        disabled={processing}
                                    >
                                        {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                        Mark as Successfully Charged
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setShowDeclineForm(false)}
                                        disabled={processing}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        onClick={handleMarkAsDeclined}
                                        disabled={processing}
                                        className="flex-1"
                                    >
                                        {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                                        Confirm Decline & Notify Customer
                                    </Button>
                                </>
                            )}
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
