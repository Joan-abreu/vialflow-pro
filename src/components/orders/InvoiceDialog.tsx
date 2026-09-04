import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, Receipt, Copy, Check, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { InvoiceDocument } from "./InvoiceDocument";
import { InvoiceOrder, printInvoice } from "@/utils/printInvoice";

interface InvoiceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    order: InvoiceOrder | any | null;
}

export const InvoiceDialog: React.FC<InvoiceDialogProps> = ({
    open,
    onOpenChange,
    order,
}) => {
    const [hasCopiedText, setHasCopiedText] = useState(false);

    if (!open || !order) return null;

    const invoiceNum = `INV-${order.id ? order.id.slice(0, 8).toUpperCase() : "000000"}`;
    const isPaid =
        order.payment_status === "paid" ||
        order.status === "ready_to_ship" ||
        order.status === "processing" ||
        order.status === "shipped" ||
        order.status === "delivered";

    const handlePrint = () => {
        printInvoice(order);
    };

    const handleCopyText = () => {
        const customerName =
            order.customer_name ||
            order.customer_profile?.full_name ||
            order.shipping_address?.full_name ||
            "Client";

        const items = order.order_items || [];
        const shipping = order.shipping_cost !== undefined ? Number(order.shipping_cost) : 0;
        const total = order.total_amount !== undefined ? Number(order.total_amount) : 0;

        let text = `📦 *COMMERCIAL INVOICE* #${invoiceNum}\n`;
        text += `📅 Date: ${new Date(order.created_at || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}\n`;
        text += `👤 Customer: ${customerName}\n`;
        if (order.customer_email) text += `📧 Email: ${order.customer_email}\n`;
        
        const addr = order.shipping_address || {};
        const addrStr = [addr.line1, addr.city, addr.state, addr.postal_code].filter(Boolean).join(", ");
        if (addrStr) text += `📍 Ship To: ${addrStr}\n`;
        
        text += `\n*ITEMIZED PRODUCTS:*\n`;
        items.forEach((it: any) => {
            const name = it.product_name || it.variant?.product?.name || "Product";
            const price = it.price_at_time || 0;
            const qty = it.quantity || 1;
            text += `• ${qty}x ${name} @ $${price.toFixed(2)} = $${(price * qty).toFixed(2)}\n`;
        });

        text += `\nShipping: ${shipping === 0 ? "FREE" : `$${shipping.toFixed(2)}`}\n`;
        text += `*TOTAL DUE: $${total.toFixed(2)}*\n`;
        text += `Payment Method: ${order.payment_method || "Invoice Link"}\n`;
        text += `Status: ${isPaid ? "PAID IN FULL" : "PENDING PAYMENT"}\n\n`;
        text += `Liv Well Research Labs • Thank you for your business!`;

        navigator.clipboard.writeText(text);
        setHasCopiedText(true);
        toast.success("Invoice text summary copied to clipboard!");
        setTimeout(() => setHasCopiedText(false), 2500);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border shadow-2xl bg-background">
                {/* Header */}
                <DialogHeader className="p-4 sm:p-5 border-b bg-muted/20 shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-6">
                        <div className="space-y-0.5">
                            <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                                <Receipt className="w-5 h-5 text-primary" />
                                <span>Commercial Invoice Preview</span>
                                <Badge variant="outline" className="font-mono text-xs font-bold">
                                    #{invoiceNum}
                                </Badge>
                                {isPaid ? (
                                    <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 text-[10px] font-bold">
                                        PAID
                                    </Badge>
                                ) : (
                                    <Badge className="bg-amber-500/15 text-amber-800 border-amber-300 text-[10px] font-bold">
                                        PENDING PAYMENT
                                    </Badge>
                                )}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground">
                                Print directly or Save as PDF using your browser's native print engine.
                            </DialogDescription>
                        </div>

                        {/* Top Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCopyText}
                                className="h-8 text-xs gap-1.5 font-semibold"
                            >
                                {hasCopiedText ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                )}
                                <span className="hidden sm:inline">Copy Text</span>
                            </Button>

                            <Button
                                onClick={handlePrint}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 text-xs gap-1.5 font-bold shadow-sm"
                            >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Print / Save as PDF</span>
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                {/* Body - Scrollable Invoice Document */}
                <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-950 p-4 sm:p-6">
                    <InvoiceDocument order={order} />
                </div>

                {/* Footer */}
                <DialogFooter className="p-3 sm:p-4 border-t bg-muted/10 shrink-0 flex flex-row items-center justify-between">
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="hidden sm:inline">Standard Letter format (8.5" x 11") with vector printing</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                            Close
                        </Button>
                        <Button size="sm" onClick={handlePrint} className="gap-1.5 font-bold">
                            <Download className="w-3.5 h-3.5" />
                            <span>Download / Print PDF</span>
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default InvoiceDialog;
