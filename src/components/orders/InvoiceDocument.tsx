import React from "react";
import { format } from "date-fns";
import { Receipt, CheckCircle2, Clock, MapPin, Mail, Phone, Building, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { InvoiceOrder, formatPaymentMethodLabel } from "@/utils/printInvoice";

interface InvoiceDocumentProps {
    order: InvoiceOrder;
    companyInfo?: {
        name?: string;
        tagline?: string;
        addressLine1?: string;
        cityStateZip?: string;
        email?: string;
        phone?: string;
    };
}

export const InvoiceDocument: React.FC<InvoiceDocumentProps> = ({
    order,
    companyInfo = {
        name: "Liv Well Research Labs",
        tagline: "Precision Research Solutions & Bulk Peptide Synthesis",
        addressLine1: "12300 Research Parkway, Suite 400",
        cityStateZip: "Orlando, FL 32826, USA",
        email: "orders@livwellresearchlabs.com",
        phone: "+1 (800) 548-9355",
    },
}) => {
    const invoiceNum = `INV-${order.id ? order.id.slice(0, 8).toUpperCase() : "000000"}`;
    const orderDate = order.created_at
        ? format(new Date(order.created_at), "MMMM d, yyyy")
        : format(new Date(), "MMMM d, yyyy");

    const isPaid =
        order.payment_status === "paid" ||
        order.status === "ready_to_ship" ||
        order.status === "processing" ||
        order.status === "shipped" ||
        order.status === "delivered";

    const customerName =
        order.customer_name ||
        order.customer_profile?.full_name ||
        order.shipping_address?.full_name ||
        "Valued Client";

    const customerEmail =
        order.customer_email ||
        order.shipping_address?.email ||
        "";

    const customerPhone =
        order.customer_phone ||
        order.shipping_address?.phone ||
        "";

    const addr = order.shipping_address || {};
    const addrLine1 = addr.line1 || addr.address_line1 || "";
    const addrLine2 = addr.line2 || addr.address_line2 || "";
    const addrCity = addr.city || "";
    const addrState = addr.state || "";
    const addrZip = addr.postal_code || addr.zip || "";
    const addrCountry = addr.country || "US";

    const items = order.order_items || [];
    const subtotal = items.reduce(
        (acc, it) => acc + (it.price_at_time || 0) * (it.quantity || 1),
        0
    );
    const shipping = order.shipping_cost !== undefined ? Number(order.shipping_cost) : 0;
    const discount = (order.product_discount || 0) + (order.shipping_discount || 0);
    const tax = order.tax !== undefined ? Number(order.tax) : 0;
    const grandTotal = order.total_amount !== undefined ? Number(order.total_amount) : subtotal + shipping - discount;

    return (
        <div className="bg-card text-card-foreground border rounded-2xl shadow-xl p-6 sm:p-8 max-w-4xl mx-auto space-y-6">
            {/* Header: Company & Invoice Badges */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black">
                            <Receipt className="h-5 w-5" />
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                            {companyInfo.name}
                        </h2>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">
                        {companyInfo.tagline}
                    </p>
                    <div className="text-[11px] text-muted-foreground pt-1 space-y-0.5">
                        <p>{companyInfo.addressLine1} • {companyInfo.cityStateZip}</p>
                        <p>📧 {companyInfo.email} • 📞 {companyInfo.phone}</p>
                    </div>
                </div>

                <div className="text-left sm:text-right space-y-2 shrink-0">
                    <div>
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground block">
                            Commercial Invoice
                        </span>
                        <span className="text-xl sm:text-2xl font-black font-mono text-primary">
                            #{invoiceNum}
                        </span>
                    </div>

                    <div>
                        {isPaid ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 gap-1 text-xs font-bold px-3 py-1">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                PAID IN FULL
                            </Badge>
                        ) : (
                            <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-300 gap-1 text-xs font-bold px-3 py-1">
                                <Clock className="h-3.5 w-3.5 text-amber-600" />
                                PENDING PAYMENT
                            </Badge>
                        )}
                    </div>

                    <div className="text-[11px] text-muted-foreground space-y-0.5">
                        <p><strong>Date Issued:</strong> {orderDate}</p>
                        <p><strong>Order Ref:</strong> #{order.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                </div>
            </div>

            {/* Bill To & Ship To Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                        Billed To
                    </span>
                    <div className="font-bold text-sm text-foreground">
                        {customerName}
                    </div>
                    {customerEmail && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Mail className="h-3 w-3 text-muted-foreground/70" />
                            <span>{customerEmail}</span>
                        </div>
                    )}
                    {customerPhone && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Phone className="h-3 w-3 text-muted-foreground/70" />
                            <span>{customerPhone}</span>
                        </div>
                    )}
                </div>

                <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                        Ship To Destination
                    </span>
                    <div className="font-bold text-sm text-foreground">
                        {customerName}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <MapPin className="h-3 w-3 text-muted-foreground/70 shrink-0 mt-0.5" />
                        <div>
                            {addrLine1 ? (
                                <>
                                    <p>{addrLine1} {addrLine2 && `(${addrLine2})`}</p>
                                    <p>{addrCity}{addrCity && addrState ? ", " : ""}{addrState} {addrZip}</p>
                                    <p>{addrCountry}</p>
                                </>
                            ) : (
                                <p className="italic text-muted-foreground/80">No address specified on order</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Payment Method Notice Bar */}
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                    <span className="text-muted-foreground">Payment Method: </span>
                    <strong className="text-foreground">{formatPaymentMethodLabel(order.payment_method)}</strong>
                </div>
                <div>
                    <span className="text-muted-foreground">Terms: </span>
                    <strong className="text-foreground">
                        {isPaid ? "Paid & Settled" : "Due Upon Receipt (External Link / Manual)"}
                    </strong>
                </div>
            </div>

            {/* Itemized Line Items Table */}
            <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-muted/40 text-muted-foreground font-bold uppercase text-[10px] tracking-wider border-b">
                        <tr>
                            <th className="p-3 text-center w-10">#</th>
                            <th className="p-3">Item & Description</th>
                            <th className="p-3 text-center w-20">Quantity</th>
                            <th className="p-3 text-right w-24">Unit Price</th>
                            <th className="p-3 text-right w-24">Line Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-4 text-center text-muted-foreground italic">
                                    No products in this order.
                                </td>
                            </tr>
                        ) : (
                            items.map((it, idx) => {
                                const name =
                                    it.product_name ||
                                    it.variant?.product?.name ||
                                    "Research Product";
                                const sku = it.sku || it.variant?.sku || "-";
                                const qty = it.quantity || 1;
                                const unitPrice = it.price_at_time || 0;
                                const lineTotal = unitPrice * qty;

                                const packSize = it.variant?.pack_size || 1;
                                const isPack = it.variant?.sale_type === "pack" || packSize > 1;

                                return (
                                    <tr key={it.id || idx} className="hover:bg-muted/20">
                                        <td className="p-3 text-center text-muted-foreground font-mono text-[11px]">
                                            {idx + 1}
                                        </td>
                                        <td className="p-3">
                                            <div className="font-semibold text-foreground text-sm">
                                                {name}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                                                {sku !== "-" && (
                                                    <span className="font-mono bg-muted px-1.5 py-0.2 rounded text-[10px]">
                                                        SKU: {sku}
                                                    </span>
                                                )}
                                                {isPack && (
                                                    <span className="font-semibold text-primary">
                                                        (Pack of {packSize})
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3 text-center font-bold text-foreground">
                                            {qty}
                                        </td>
                                        <td className="p-3 text-right font-medium">
                                            ${unitPrice.toFixed(2)}
                                        </td>
                                        <td className="p-3 text-right font-bold text-foreground">
                                            ${lineTotal.toFixed(2)}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Totals Summary */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-2">
                <div className="text-[11px] text-muted-foreground space-y-1 max-w-sm">
                    <p className="font-bold text-foreground">Compliance & Research Usage:</p>
                    <p>
                        All items supplied by Liv Well Research Labs are strictly for laboratory research and analytical studies only. Not for human consumption, diagnostic, or clinical therapeutic use.
                    </p>
                </div>

                <div className="w-full sm:w-64 space-y-2 text-xs border rounded-xl p-3.5 bg-muted/20">
                    <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal:</span>
                        <span className="font-semibold text-foreground">${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                        <span>Shipping:</span>
                        <span className="font-semibold text-foreground">
                            {shipping === 0 ? "FREE" : `$${shipping.toFixed(2)}`}
                        </span>
                    </div>
                    {discount > 0 && (
                        <div className="flex justify-between text-emerald-600 font-semibold">
                            <span>Discount:</span>
                            <span>-${discount.toFixed(2)}</span>
                        </div>
                    )}
                    {tax > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                            <span>Tax:</span>
                            <span className="font-semibold text-foreground">${tax.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between border-t pt-2 text-sm font-black text-foreground">
                        <span>Total Due:</span>
                        <span className="text-base text-primary">${grandTotal.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InvoiceDocument;
