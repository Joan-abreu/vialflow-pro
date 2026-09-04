import { format } from "date-fns";

export interface InvoiceItem {
    id?: string;
    product_name?: string;
    quantity: number;
    price_at_time: number;
    sku?: string;
    spec_label?: string;
    image_url?: string | null;
    variant?: {
        id?: string;
        sku?: string;
        pack_size?: number;
        sale_type?: string;
        image_url?: string | null;
        product?: {
            name?: string;
            image_url?: string | null;
        };
        vial_type?: {
            name?: string;
            capacity_ml?: number;
            color?: string | null;
            shape?: string | null;
        };
    };
}

export interface InvoiceOrder {
    id: string;
    total_amount: number;
    shipping_cost?: number;
    tax?: number;
    product_discount?: number;
    shipping_discount?: number;
    status: string;
    payment_status?: string;
    payment_method?: string | null;
    created_at: string;
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    shipping_address?: {
        full_name?: string;
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postal_code?: string;
        country?: string;
        phone?: string;
        email?: string;
    } | any;
    customer_profile?: {
        full_name?: string;
    };
    order_items?: InvoiceItem[];
    notes?: string;
}

export interface CompanyInfo {
    name?: string;
    tagline?: string;
    addressLine1?: string;
    addressLine2?: string;
    cityStateZip?: string;
    email?: string;
    phone?: string;
    website?: string;
    logoUrl?: string;
}

const DEFAULT_COMPANY_INFO: CompanyInfo = {
    name: "Liv Well Research Labs",
    tagline: "Precision Research Solutions & Bulk Peptide Synthesis",
    addressLine1: "12300 Research Parkway, Suite 400",
    cityStateZip: "Orlando, FL 32826, USA",
    email: "orders@livwellresearchlabs.com",
    phone: "+1 (800) 548-9355",
    website: "https://livwellresearchlabs.com",
    logoUrl: "/favicon.png",
};

function escapeHtml(str: string | null | undefined): string {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function formatPaymentMethodLabel(method?: string | null): string {
    if (!method) return "External / Manual Invoice";
    switch (method.toLowerCase()) {
        case "external_invoice":
            return "External Invoice (Square / Direct Link)";
        case "zelle":
            return "Zelle (Direct P2P)";
        case "bank_wire":
            return "Bank Wire / ACH Transfer";
        case "cash":
            return "Cash / Direct";
        case "offline_manual":
            return "Offline / Custom Arrangement";
        case "manual_terminal":
            return "Virtual Terminal (Credit Card)";
        case "stripe":
            return "Online Card Processing (Stripe)";
        case "square":
            return "Square Checkout";
        default:
            return method.replace(/_/g, " ").toUpperCase();
    }
}

export function generateInvoiceHtml(
    order: InvoiceOrder,
    company: CompanyInfo = DEFAULT_COMPANY_INFO
): string {
    const info = { ...DEFAULT_COMPANY_INFO, ...company };
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

    const itemsRows = items
        .map((it, idx) => {
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

            return `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 8px; text-align: center; color: #64748b; font-size: 11px;">
                    ${idx + 1}
                </td>
                <td style="padding: 10px 8px;">
                    <div style="font-weight: 700; color: #0f172a; font-size: 13px;">
                        ${escapeHtml(name)}
                    </div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                        ${sku !== "-" ? `<span style="font-family: monospace; background: #f1f5f9; padding: 2px 4px; border-radius: 3px;">SKU: ${escapeHtml(sku)}</span>` : ""}
                        ${isPack ? `<span style="margin-left: 6px; color: #4338ca; font-weight: 600;">(Pack of ${packSize})</span>` : ""}
                    </div>
                </td>
                <td style="padding: 10px 8px; text-align: center; font-weight: 700; color: #0f172a; font-size: 13px;">
                    ${qty}
                </td>
                <td style="padding: 10px 8px; text-align: right; color: #0f172a; font-size: 13px;">
                    $${unitPrice.toFixed(2)}
                </td>
                <td style="padding: 10px 8px; text-align: right; font-weight: 800; color: #0f172a; font-size: 13px;">
                    $${lineTotal.toFixed(2)}
                </td>
            </tr>
            `;
        })
        .join("");

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(invoiceNum)} - ${escapeHtml(info.name)}</title>
    <style>
        @page {
            size: letter portrait;
            margin: 12mm 14mm;
        }
        *, *::before, *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        html, body {
            background: #ffffff !important;
            color: #0f172a !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
        }
        .invoice-card {
            max-width: 800px;
            margin: 0 auto;
            background: #ffffff;
            padding: 8px 12px;
        }
        .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 2px solid #0f172a;
        }
        .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .badge-paid {
            background: #ecfdf5;
            color: #047857;
            border: 1.5px solid #10b981;
        }
        .badge-pending {
            background: #fffbeb;
            color: #b45309;
            border: 1.5px solid #f59e0b;
        }
        .meta-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px 14px;
        }
        .table-items {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        .table-items th {
            background: #0f172a;
            color: #ffffff;
            padding: 8px 10px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .table-totals {
            width: 280px;
            margin-left: auto;
            border-collapse: collapse;
        }
        .table-totals td {
            padding: 4px 8px;
            font-size: 12px;
        }
        .footer-terms {
            margin-top: 36px;
            padding-top: 14px;
            border-top: 1px solid #e2e8f0;
            color: #64748b;
            font-size: 10.5px;
            line-height: 1.5;
        }
        @media print {
            body {
                background: #ffffff !important;
            }
            .no-print {
                display: none !important;
            }
        }
    </style>
</head>
<body>
    <div class="invoice-card">
        <!-- Header: Company & Invoice Info -->
        <table class="header-table">
            <tr>
                <td style="vertical-align: top; width: 60%;">
                    <div style="font-size: 22px; font-weight: 900; color: #0f172a; letter-spacing: -0.02em;">
                        ${escapeHtml(info.name)}
                    </div>
                    <div style="font-size: 11px; color: #64748b; font-weight: 600; margin-top: 2px;">
                        ${escapeHtml(info.tagline)}
                    </div>
                    <div style="font-size: 11px; color: #475569; margin-top: 6px; line-height: 1.4;">
                        ${escapeHtml(info.addressLine1)}<br>
                        ${escapeHtml(info.cityStateZip)}<br>
                        Email: <strong>${escapeHtml(info.email)}</strong> • Tel: ${escapeHtml(info.phone)}
                    </div>
                </td>
                <td style="vertical-align: top; width: 40%; text-align: right;">
                    <div style="font-size: 28px; font-weight: 900; color: #0f172a; letter-spacing: -0.02em;">
                        INVOICE
                    </div>
                    <div style="font-family: monospace; font-size: 14px; font-weight: 800; color: #3b82f6; margin-top: 2px;">
                        #${escapeHtml(invoiceNum)}
                    </div>
                    <div style="margin-top: 8px;">
                        ${
                            isPaid
                                ? `<span class="badge badge-paid">✓ PAID IN FULL</span>`
                                : `<span class="badge badge-pending">⏳ PENDING PAYMENT</span>`
                        }
                    </div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 8px;">
                        <strong>Date:</strong> ${escapeHtml(orderDate)}<br>
                        <strong>Order Ref:</strong> #${escapeHtml(order.id.slice(0, 8).toUpperCase())}
                    </div>
                </td>
            </tr>
        </table>

        <!-- Bill To & Ship To Grid -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
                <td style="width: 48%; vertical-align: top;">
                    <div class="meta-box">
                        <div style="font-size: 10.5px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 6px;">
                            Billed To:
                        </div>
                        <div style="font-size: 13px; font-weight: 800; color: #0f172a;">
                            ${escapeHtml(customerName)}
                        </div>
                        ${customerEmail ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">📧 ${escapeHtml(customerEmail)}</div>` : ""}
                        ${customerPhone ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">📞 ${escapeHtml(customerPhone)}</div>` : ""}
                    </div>
                </td>
                <td style="width: 4%;"></td>
                <td style="width: 48%; vertical-align: top;">
                    <div class="meta-box">
                        <div style="font-size: 10.5px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 6px;">
                            Ship To Destination:
                        </div>
                        <div style="font-size: 13px; font-weight: 800; color: #0f172a;">
                            ${escapeHtml(customerName)}
                        </div>
                        <div style="font-size: 11px; color: #475569; margin-top: 2px;">
                            ${addrLine1 ? escapeHtml(addrLine1) : "No address specified"}${addrLine2 ? `<br>${escapeHtml(addrLine2)}` : ""}<br>
                            ${addrCity ? `${escapeHtml(addrCity)}, ` : ""}${addrState ? `${escapeHtml(addrState)} ` : ""}${addrZip ? escapeHtml(addrZip) : ""}<br>
                            ${escapeHtml(addrCountry)}
                        </div>
                    </div>
                </td>
            </tr>
        </table>

        <!-- Payment Terms Banner -->
        <div style="background: #f1f5f9; border-left: 4px solid #3b82f6; padding: 8px 12px; border-radius: 0 6px 6px 0; font-size: 11.5px; margin-bottom: 18px;">
            <strong>Payment Method:</strong> ${escapeHtml(formatPaymentMethodLabel(order.payment_method))} &nbsp;|&nbsp; 
            <strong>Payment Terms:</strong> ${isPaid ? "Paid & Settled" : "Due Upon Receipt (Send proof or use checkout link)"}
        </div>

        <!-- Line Items Table -->
        <table class="table-items">
            <thead>
                <tr>
                    <th style="width: 5%; text-align: center; border-radius: 4px 0 0 0;">#</th>
                    <th style="width: 50%; text-align: left;">Item & Description</th>
                    <th style="width: 15%; text-align: center;">Quantity</th>
                    <th style="width: 15%; text-align: right;">Unit Price</th>
                    <th style="width: 15%; text-align: right; border-radius: 0 4px 0 0;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${itemsRows}
            </tbody>
        </table>

        <!-- Financial Summary Table -->
        <table class="table-totals">
            <tr>
                <td style="color: #64748b; text-align: right;">Subtotal:</td>
                <td style="text-align: right; font-weight: 700; color: #0f172a;">$${subtotal.toFixed(2)}</td>
            </tr>
            <tr>
                <td style="color: #64748b; text-align: right;">Shipping:</td>
                <td style="text-align: right; font-weight: 700; color: #0f172a;">
                    ${shipping === 0 ? "FREE" : `$${shipping.toFixed(2)}`}
                </td>
            </tr>
            ${
                discount > 0
                    ? `
            <tr>
                <td style="color: #059669; text-align: right;">Discount:</td>
                <td style="text-align: right; font-weight: 700; color: #059669;">-$${discount.toFixed(2)}</td>
            </tr>`
                    : ""
            }
            ${
                tax > 0
                    ? `
            <tr>
                <td style="color: #64748b; text-align: right;">Sales Tax:</td>
                <td style="text-align: right; font-weight: 700; color: #0f172a;">$${tax.toFixed(2)}</td>
            </tr>`
                    : ""
            }
            <tr style="border-top: 2px solid #0f172a;">
                <td style="padding-top: 8px; font-weight: 800; font-size: 14px; text-align: right; color: #0f172a;">Total Due:</td>
                <td style="padding-top: 8px; font-weight: 900; font-size: 16px; text-align: right; color: #2563eb;">
                    $${grandTotal.toFixed(2)}
                </td>
            </tr>
        </table>

        <!-- Footer / Research Notice / Terms -->
        <div class="footer-terms">
            <div style="font-weight: 700; color: #334155; margin-bottom: 2px;">
                Notes & Terms:
            </div>
            <div>
                All compounds, reconstitution solutions, and peptides supplied by Liv Well Research Labs are strictly intended for laboratory research and analytical in-vitro studies only. Not for human or veterinary clinical use.
            </div>
            <div style="margin-top: 6px;">
                For questions regarding this invoice, batch reports, or custom orders, contact <strong>${escapeHtml(info.email)}</strong> or call <strong>${escapeHtml(info.phone)}</strong>.
            </div>
        </div>
    </div>
</body>
</html>`;
}

export function printInvoice(
    order: InvoiceOrder,
    company?: CompanyInfo
): void {
    if (!order) return;

    // Remove any previous print iframe
    const oldIframe = document.getElementById("invoice-print-iframe");
    if (oldIframe) {
        oldIframe.remove();
    }

    const iframe = document.createElement("iframe");
    iframe.id = "invoice-print-iframe";
    iframe.style.position = "fixed";
    iframe.style.top = "-99999px";
    iframe.style.left = "-99999px";
    iframe.style.width = "8.5in";
    iframe.style.height = "11in";
    iframe.style.border = "none";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    iframe.style.zIndex = "-9999";

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    const fullHtml = generateInvoiceHtml(order, company);
    doc.open();
    doc.write(fullHtml);
    doc.close();

    // Trigger print once content and styles have loaded
    setTimeout(() => {
        try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
        } catch (err) {
            console.error("Invoice print error:", err);
        }
    }, 250);
}
