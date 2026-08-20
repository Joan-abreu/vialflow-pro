import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, QrCode, ShieldCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_PAYMENT_SETTINGS } from "@/config/paymentGateways";

interface P2PPaymentDisplayProps {
    orderMemoCode?: string;
    amount: number;
    selectedMethod: "zelle" | "venmo" | "cashapp";
    onSelectMethod: (method: "zelle" | "venmo" | "cashapp") => void;
    settings?: typeof DEFAULT_PAYMENT_SETTINGS.p2p;
}

export const P2PPaymentDisplay: React.FC<P2PPaymentDisplayProps> = ({
    orderMemoCode = "#ORDER-MEMO",
    amount,
    selectedMethod,
    onSelectMethod,
    settings = DEFAULT_PAYMENT_SETTINGS.p2p
}) => {
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const isZelleEnabled = settings?.zelle?.enabled !== false;

    const isVenmoEnabled = settings?.venmo?.enabled !== false;
    const isCashAppEnabled = settings?.cashapp?.enabled !== false;

    const availableMethods = [
        { id: "zelle" as const, label: "Zelle", enabled: isZelleEnabled, color: "data-[state=active]:bg-purple-600" },
        { id: "venmo" as const, label: "Venmo", enabled: isVenmoEnabled, color: "data-[state=active]:bg-blue-600" },
        { id: "cashapp" as const, label: "Cash App", enabled: isCashAppEnabled, color: "data-[state=active]:bg-emerald-600" },
    ].filter(m => m.enabled);

    // Auto-select first active method if selected method is disabled
    React.useEffect(() => {
        if (availableMethods.length > 0 && !availableMethods.some(m => m.id === selectedMethod)) {
            onSelectMethod(availableMethods[0].id);
        }
    }, [availableMethods, selectedMethod, onSelectMethod]);

    const handleCopy = (text: string, fieldName: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(fieldName);
        toast.success(`Copied ${fieldName} to clipboard!`);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const currentConfig = settings?.[selectedMethod] || settings?.[availableMethods[0]?.id || "zelle"];

    if (availableMethods.length === 0) {
        return (
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs text-center font-medium">
                P2P payments are currently undergoing maintenance. Please select an alternative payment method.
            </div>
        );
    }

    return (
        <div className="space-y-4 text-left">
            {/* Header Badge */}
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-900 dark:text-purple-200 text-xs space-y-1">
                <div className="font-bold flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300 font-bold">
                        <ShieldCheck className="h-4 w-4" />
                        P2P Direct Payment ({availableMethods.map(m => m.label).join(", ")})
                    </span>
                    <Badge variant="outline" className="bg-purple-500/20 text-purple-700 border-purple-400 font-bold text-[10px]">
                        Zero Fees
                    </Badge>
                </div>
                <p className="text-[11px] text-purple-800/80 dark:text-purple-300/80 leading-relaxed">
                    Select your preferred app below, send the payment, and paste/upload your receipt screenshot for instant verification.
                </p>
            </div>

            {/* Method Tabs */}
            <Tabs value={selectedMethod} onValueChange={(val) => onSelectMethod(val as any)} className="w-full">
                <TabsList className={`grid w-full bg-muted/60 p-1 ${availableMethods.length === 1 ? 'grid-cols-1' : availableMethods.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                    {availableMethods.map(method => (
                        <TabsTrigger
                            key={method.id}
                            value={method.id}
                            className={`font-bold text-xs ${method.color} data-[state=active]:text-white`}
                        >
                            {method.label}
                        </TabsTrigger>
                    ))}
                </TabsList>


                {/* Shared Display Content */}
                <Card className="mt-3 p-4 border bg-background space-y-4">
                    {/* Unique Order Memo Box */}
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between">
                        <div>
                            <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 tracking-wider block">
                                Mandatory Payment Memo Code
                            </span>
                            <span className="font-mono text-sm font-black text-foreground">
                                {orderMemoCode}
                            </span>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-bold gap-1 bg-amber-500/20 text-amber-800 hover:bg-amber-500/30 border-amber-400"
                            onClick={() => handleCopy(orderMemoCode, "Order Memo Code")}
                        >
                            {copiedField === "Order Memo Code" ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                            Copy Memo
                        </Button>
                    </div>

                    {/* QR Code & Details Layout */}
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        {/* QR Code Container */}
                        <div className="w-36 h-36 bg-white p-2 rounded-xl border border-muted shadow-sm flex flex-col items-center justify-center shrink-0">
                            {currentConfig?.qrCodeUrl ? (
                                <img
                                    src={currentConfig.qrCodeUrl}
                                    alt={`${selectedMethod.toUpperCase()} QR Code`}
                                    className="w-full h-full object-contain rounded"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center text-muted-foreground p-2 text-center">
                                    <QrCode className="h-10 w-10 text-muted-foreground/60 mb-1" />
                                    <span className="text-[10px] font-medium leading-tight">
                                        Scan with {selectedMethod.toUpperCase()}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Details & Copy Handles */}
                        <div className="space-y-2.5 flex-1 w-full text-left">
                            <div>
                                <span className="text-[11px] text-muted-foreground font-medium block">
                                    Recipient Name
                                </span>
                                <span className="font-semibold text-sm text-foreground">
                                    {currentConfig?.recipientName || "Liv Well Research Labs"}
                                </span>
                            </div>

                            <div>
                                <span className="text-[11px] text-muted-foreground font-medium block">
                                    {selectedMethod === "zelle" ? "Zelle Email / Handle" : selectedMethod === "venmo" ? "Venmo Username" : "Cash App Tag"}
                                </span>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="font-mono font-bold text-sm bg-muted px-2.5 py-1 rounded text-foreground">
                                        {currentConfig?.handle}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => handleCopy(currentConfig?.handle || "", "Payment Handle")}
                                        title="Copy Handle"
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>

                            {/* Mobile Deep Link Button */}
                            {currentConfig?.deepLinkUrl && (
                                <a
                                    href={currentConfig.deepLinkUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline pt-1"
                                >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    Open {selectedMethod === "cashapp" ? "Cash App" : "Venmo"} Mobile App
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Method Instructions */}
                    <div className="text-[11px] text-muted-foreground leading-relaxed bg-muted/30 p-2.5 rounded border">
                        💡 <strong>Instructions:</strong> {currentConfig?.instructions || "Include your Order Memo Code in the transaction note to accelerate verification."}
                    </div>
                </Card>
            </Tabs>
        </div>
    );
};
