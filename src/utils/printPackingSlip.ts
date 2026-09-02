import { format } from "date-fns";
import {
    PackingSlipOrder,
    formatVariantDetails,
    getProductThumbnail
} from "@/components/orders/PackingSlipDocument";

function escapeHtml(str: string | null | undefined): string {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function generateSingleOrderHtml(
    order: PackingSlipOrder,
    pageIndex: number,
    totalPages: number,
    showPrices: boolean = false
): string {
    const orderShortId = order.id ? order.id.slice(0, 8).toUpperCase() : "ORDER";
    const recipientName =
        order.customer_profile?.full_name ||
        order.shipping_address?.full_name ||
        "Valued Customer";

    const totalUnits = (order.order_items || []).reduce((acc, item) => acc + (item.quantity || 0), 0);
    const uniqueSkusCount = (order.order_items || []).length;

    const activeTracking =
        order.tracking_number ||
        (order.order_shipments && order.order_shipments.find(s => s.status !== "cancelled")?.tracking_number) ||
        null;

    const formattedDate = order.created_at
        ? format(new Date(order.created_at), "MMM d, yyyy h:mm a")
        : "-";

    const currentDate = format(new Date(), "MMM d, yyyy");

    const itemsRows = (order.order_items || []).map((item) => {
        const imgUrl = getProductThumbnail(item);
        const specLabel = formatVariantDetails(item.variant);
        const packSize = item.variant?.pack_size || 1;
        const isPack = item.variant?.sale_type === "pack" || packSize > 1;

        return `
            <tr style="border-bottom: 1.5px solid #000000; page-break-inside: avoid; break-inside: avoid;">
                <!-- Checkbox -->
                <td style="padding: 8px 6px; text-align: center; border-right: 1.5px solid #000000; vertical-align: middle;">
                    <div style="width: 18px; height: 18px; border: 2px solid #000000; border-radius: 3px; margin: 0 auto; background: #ffffff;"></div>
                </td>
                <!-- Photo -->
                <td style="padding: 6px 8px; text-align: center; border-right: 1.5px solid #000000; vertical-align: middle;">
                    <div style="width: 52px; height: 52px; border: 1.5px solid #000000; border-radius: 4px; background: #ffffff; display: flex; align-items: center; justify-content: center; overflow: hidden; margin: 0 auto;">
                        ${
                            imgUrl
                                ? `<img src="${escapeHtml(imgUrl)}" alt="Product" style="width: 100%; height: 100%; object-fit: cover;" />`
                                : `<div style="font-size: 9px; color: #000000; font-weight: 900;">ITEM</div>`
                        }
                    </div>
                </td>
                <!-- Description -->
                <td style="padding: 8px 10px; border-right: 1.5px solid #000000; vertical-align: top;">
                    <div style="font-weight: 900; font-size: 13.5px; color: #000000; line-height: 1.25;">
                        ${escapeHtml(item.variant?.product?.name || "Unknown Product")}
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 4px;">
                        ${
                            specLabel
                                ? `<span style="background: #f3f4f6; color: #000000; border: 1px solid #000000; padding: 2px 6px; border-radius: 3px; font-weight: 800; font-size: 11px;">${escapeHtml(specLabel)}</span>`
                                : ""
                        }
                        ${
                            isPack
                                ? `<span style="background: #eef2ff; color: #000000; border: 1.5px solid #000000; padding: 2px 6px; border-radius: 3px; font-weight: 900; font-size: 11px;">Pack of ${packSize} vials</span>`
                                : ""
                        }
                        ${
                            item.is_bulk
                                ? `<span style="background: #fef3c7; color: #000000; border: 1.5px solid #000000; padding: 2px 6px; border-radius: 3px; font-weight: 900; font-size: 11px;">Bulk ${item.with_labels ? "(Custom Labels)" : "(Unlabeled)"}</span>`
                                : ""
                        }
                    </div>
                    ${
                        item.with_labels && item.custom_label_instructions
                            ? `<div style="margin-top: 4px; padding: 3px 6px; background: #fffbeb; border: 1px solid #000000; border-radius: 3px; font-size: 11px; font-weight: 700; color: #000000;"><strong>Label Notes:</strong> ${escapeHtml(item.custom_label_instructions)}</div>`
                            : ""
                    }
                </td>
                <!-- SKU -->
                <td style="padding: 8px 10px; border-right: 1.5px solid #000000; vertical-align: top;">
                    <div style="font-family: monospace; font-weight: 900; font-size: 12px; color: #000000; background: #f3f4f6; padding: 3px 6px; border-radius: 3px; display: inline-block; border: 1.5px solid #000000;">
                        ${escapeHtml(item.variant?.sku || "NO-SKU")}
                    </div>
                </td>
                <!-- Qty -->
                <td style="padding: 8px 6px; text-align: center; border-right: 1.5px solid #000000; vertical-align: middle;">
                    <div style="display: inline-flex; flex-direction: column; align-items: center;">
                        <span style="font-weight: 900; font-size: 16px; color: #000000; background: #f3f4f6; border: 2px solid #000000; border-radius: 4px; padding: 2px 8px; min-width: 32px; text-align: center;">
                            ${item.quantity}
                        </span>
                        <span style="font-size: 9px; font-weight: 900; color: #000000; text-transform: uppercase; margin-top: 2px;">
                            ${isPack ? `(${item.quantity * packSize} vials)` : "units"}
                        </span>
                    </div>
                </td>
                ${
                    showPrices
                        ? `<td style="padding: 8px 10px; text-align: right; vertical-align: middle; font-family: monospace; font-size: 13px; font-weight: 900; color: #000000;">
                            $${((item.price_at_time || 0) * item.quantity).toFixed(2)}
                           </td>`
                        : ""
                }
            </tr>
        `;
    }).join("");

    const priceBreakdown = showPrices
        ? `
            <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
                <div style="width: 220px; background: #f9fafb; border: 1.5px solid #000000; border-radius: 4px; padding: 8px; font-size: 11px; line-height: 1.4; font-weight: 700; color: #000000;">
                    <div style="display: flex; justify-content: space-between;">
                        <span>Subtotal:</span>
                        <span>$${(order.total_amount - (order.shipping_cost || 0) + (order.product_discount || 0) + (order.shipping_discount || 0)).toFixed(2)}</span>
                    </div>
                    ${
                        (order.product_discount || 0) > 0
                            ? `<div style="display: flex; justify-content: space-between; color: #000000;">
                                <span>Discount:</span>
                                <span>-$${(order.product_discount || 0).toFixed(2)}</span>
                               </div>`
                            : ""
                    }
                    <div style="display: flex; justify-content: space-between;">
                        <span>Shipping:</span>
                        <span>$${(order.shipping_cost || 0).toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 13px; color: #000000; border-top: 2px solid #000000; padding-top: 3px; margin-top: 3px;">
                        <span>Total Paid:</span>
                        <span>$${order.total_amount.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `
        : "";

    return `
        <div class="packing-slip-page" style="page-break-inside: avoid; break-inside: avoid; box-sizing: border-box; width: 100%; max-width: 8.5in; margin: 0 auto; padding: 8px 12px; background: #ffffff; color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <!-- Header Row -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #000000; padding-bottom: 8px;">
                <div style="display: flex; flex-direction: column;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 42px; height: 42px; border-radius: 6px; background: #ffffff; border: 1.5px solid #000000; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;">
                            <img src="/favicon.png" alt="Liv Well Logo" style="width: 100%; height: 100%; object-fit: contain; padding: 2px;" onerror="this.style.display='none'" />
                        </div>
                        <div>
                            <h1 style="font-size: 17px; font-weight: 900; letter-spacing: 0.02em; text-transform: uppercase; color: #000000; margin: 0; line-height: 1.1;">
                                Liv Well Research Labs
                            </h1>
                            <p style="font-size: 10.5px; color: #111111; font-weight: 700; margin: 2px 0 0 0;">
                                Direct Manufacturer of Ultra-Pure Reconstitution Solutions & Research Peptides
                            </p>
                        </div>
                    </div>
                    <div style="margin-top: 6px; font-size: 11px; color: #000000; font-weight: 700; display: flex; align-items: center; gap: 10px;">
                        <span>Web: <strong style="color: #000000; text-decoration: underline;">livwellresearchlabs.com</strong></span>
                        <span>•</span>
                        <span>Support: <strong style="color: #000000;">sales@livwellresearchlabs.com</strong></span>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; align-items: flex-end; text-align: right;">
                    <div style="background: #000000; color: #ffffff; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.12em; padding: 4px 12px; border-radius: 3px;">
                        PACKING SLIP
                    </div>
                    <div style="font-family: monospace; font-size: 16px; font-weight: 900; color: #000000; margin-top: 4px;">
                        #${escapeHtml(orderShortId)}
                    </div>
                </div>
            </div>

            <!-- Metadata & Addresses Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 8px; padding: 8px 12px; background: #f4f4f5; border: 1.5px solid #000000; border-radius: 4px; font-size: 11.5px; color: #000000;">
                <!-- Ship To -->
                <div>
                    <div style="font-weight: 900; text-transform: uppercase; font-size: 11px; letter-spacing: 0.06em; color: #000000; margin-bottom: 3px;">
                        📍 Ship To:
                    </div>
                    <div style="font-weight: 900; font-size: 14px; color: #000000;">
                        ${escapeHtml(recipientName)}
                    </div>
                    ${
                        order.shipping_address
                            ? `
                                <div style="color: #000000; font-weight: 600; line-height: 1.35; margin-top: 2px;">
                                    <div>${escapeHtml(order.shipping_address.line1)}</div>
                                    ${order.shipping_address.line2 ? `<div>${escapeHtml(order.shipping_address.line2)}</div>` : ""}
                                    <div style="font-weight: 800;">
                                        ${escapeHtml(order.shipping_address.city)}, ${escapeHtml(order.shipping_address.state)} ${escapeHtml(order.shipping_address.postal_code)}
                                    </div>
                                    <div style="text-transform: uppercase; font-size: 10px; color: #000000; font-weight: 800;">
                                        ${escapeHtml(order.shipping_address.country || "United States")}
                                    </div>
                                    ${order.shipping_address.phone ? `<div style="font-size: 11px; color: #000000; font-weight: 700; margin-top: 2px;">📞 ${escapeHtml(order.shipping_address.phone)}</div>` : ""}
                                </div>
                            `
                            : `<div style="color: #000000; font-style: italic;">No shipping address recorded</div>`
                    }
                    <div style="font-size: 11px; color: #000000; font-weight: 700; margin-top: 3px;">
                        ✉️ ${escapeHtml(order.customer_email)}
                    </div>
                </div>

                <!-- Order Details -->
                <div style="border-left: 1.5px solid #000000; padding-left: 14px; display: flex; flex-direction: column; justify-content: space-between;">
                    <div style="display: flex; flex-direction: column; gap: 3px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #000000; font-weight: 700;">Order Number:</span>
                            <span style="font-family: monospace; font-weight: 900; font-size: 13px; color: #000000;">#${escapeHtml(orderShortId)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #000000; font-weight: 700;">Order Date:</span>
                            <span style="font-weight: 800; color: #000000;">${formattedDate}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #000000; font-weight: 700;">Shipping Service:</span>
                            <span style="font-weight: 900; color: #000000; background: #ffffff; padding: 2px 6px; border-radius: 3px; border: 1.5px solid #000000; font-size: 10.5px;">
                                ${escapeHtml(order.shipping_service || "Standard Shipping")} ${order.shipping_carrier ? `(${escapeHtml(order.shipping_carrier)})` : ""}
                            </span>
                        </div>
                        ${
                            activeTracking
                                ? `
                                    <div style="display: flex; justify-content: space-between; align-items: center; background: #eff6ff; padding: 3px 6px; border-radius: 3px; border: 1.5px solid #000000; margin-top: 2px;">
                                        <span style="color: #000000; font-weight: 900; font-size: 10px;">🚚 Tracking:</span>
                                        <span style="font-family: monospace; font-weight: 900; font-size: 11px; color: #000000;">${escapeHtml(activeTracking)}</span>
                                    </div>
                                `
                                : ""
                        }
                    </div>

                    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px; border-top: 1.5px solid #000000; padding-top: 4px; margin-top: 4px;">
                        <span style="font-size: 10px; font-weight: 900; color: #000000; text-transform: uppercase;">Items Summary:</span>
                        <span style="background: #000000; color: #ffffff; font-size: 11px; font-weight: 900; padding: 2px 6px; border-radius: 3px;">
                            ${totalUnits} Units
                        </span>
                        <span style="background: #e5e7eb; color: #000000; border: 1px solid #000000; font-size: 11px; font-weight: 900; padding: 2px 6px; border-radius: 3px;">
                            ${uniqueSkusCount} SKUs
                        </span>
                    </div>
                </div>
            </div>

            <!-- Items Checklist Table -->
            <div style="margin-top: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 3px;">
                    <div style="font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; color: #000000;">
                        ☑️ Picking &amp; Packing Checklist
                    </div>
                    <div style="font-size: 10.5px; font-weight: 700; color: #111111; font-style: italic;">
                        ✓ Check off each item during fulfillment
                    </div>
                </div>

                <table style="width: 100%; text-align: left; border-collapse: collapse; border: 2px solid #000000; font-size: 12px;">
                    <thead>
                        <tr style="background: #e5e7eb; color: #000000; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #000000;">
                            <th style="padding: 6px 6px; text-align: center; width: 32px; border-right: 1.5px solid #000000;">Check</th>
                            <th style="padding: 6px 6px; text-align: center; width: 60px; border-right: 1.5px solid #000000;">Photo</th>
                            <th style="padding: 6px 10px; border-right: 1.5px solid #000000;">Product &amp; Specification</th>
                            <th style="padding: 6px 10px; border-right: 1.5px solid #000000; width: 140px;">SKU</th>
                            <th style="padding: 6px 6px; text-align: center; width: 65px; border-right: 1.5px solid #000000;">Qty</th>
                            ${showPrices ? `<th style="padding: 6px 10px; text-align: right; width: 75px;">Price</th>` : ""}
                        </tr>
                    </thead>
                    <tbody>
                        ${
                            itemsRows ||
                            `<tr><td colspan="${showPrices ? 6 : 5}" style="padding: 12px; text-align: center; color: #000000; font-weight: 700;">No items in this order.</td></tr>`
                        }
                    </tbody>
                </table>
            </div>

            ${priceBreakdown}

            <!-- Bottom Verification & Signatures -->
            <div style="margin-top: 12px; border-top: 2px solid #000000; padding-top: 6px; font-size: 11px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; padding-bottom: 6px; border-bottom: 1.5px solid #000000;">
                    <div style="border: 1.5px dashed #000000; padding: 6px 10px; border-radius: 4px; background: #f9fafb; display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-size: 11px; text-transform: uppercase; font-weight: 900; color: #000000; letter-spacing: 0.05em;">Packed By:</span>
                        <div style="width: 140px; border-bottom: 1.5px solid #000000; padding-bottom: 1px; font-family: monospace; font-size: 10px; color: #555555; text-align: center; font-weight: 600;">
                            (Signature / Initials)
                        </div>
                    </div>

                    <div style="border: 1.5px dashed #000000; padding: 6px 10px; border-radius: 4px; background: #f9fafb; display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-size: 11px; text-transform: uppercase; font-weight: 900; color: #000000; letter-spacing: 0.05em;">Fulfillment Date:</span>
                        <span style="font-size: 12px; font-weight: 900; color: #000000;">
                            ${currentDate}
                        </span>
                    </div>
                </div>

                <div style="margin-top: 5px; display: flex; justify-content: space-between; align-items: center; font-size: 9.5px; color: #000000; font-weight: 600; line-height: 1.25;">
                    <p style="margin: 0;">
                        <strong>Inspection Notice:</strong> Please verify all contents upon receipt. For any discrepancies, contact us at <strong>sales@livwellresearchlabs.com</strong>.
                    </p>
                    <div style="font-family: monospace; font-size: 11px; color: #000000; font-weight: 900; flex-shrink: 0; margin-left: 10px;">
                        PS-${escapeHtml(orderShortId)}
                    </div>
                </div>
            </div>
        </div>
    `;
}

export function generatePackingSlipsDocumentHtml(
    orders: PackingSlipOrder[],
    showPrices: boolean = false
): string {
    const pagesHtml = orders
        .map((order, idx) => {
            const pageContent = generateSingleOrderHtml(order, idx + 1, orders.length, showPrices);
            const isLast = idx === orders.length - 1;
            return `
                <div class="packing-slip-page-container" style="${
                    isLast
                        ? "page-break-after: avoid; break-after: avoid;"
                        : "page-break-after: always; break-after: page;"
                }">
                    ${pageContent}
                </div>
            `;
        })
        .join("");

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Packing Slips - Liv Well Research Labs</title>
    <style>
        @page {
            size: letter portrait;
            margin: 8mm 10mm;
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
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .packing-slip-page-container {
            width: 100%;
            margin: 0 auto;
            page-break-inside: avoid;
            break-inside: avoid;
        }
        @media print {
            body {
                background: #ffffff !important;
            }
            .packing-slip-page-container:not(:last-child) {
                page-break-after: always !important;
                break-after: page !important;
            }
            .packing-slip-page-container:last-child {
                page-break-after: avoid !important;
                break-after: avoid !important;
            }
        }
    </style>
</head>
<body>
    ${pagesHtml}
</body>
</html>`;
}

export function printPackingSlips(
    orders: PackingSlipOrder[],
    showPrices: boolean = false
): void {
    if (!orders || orders.length === 0) return;

    // Remove any previous print iframe
    const oldIframe = document.getElementById("packing-slip-print-iframe");
    if (oldIframe) {
        oldIframe.remove();
    }

    const iframe = document.createElement("iframe");
    iframe.id = "packing-slip-print-iframe";
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

    const fullHtml = generatePackingSlipsDocumentHtml(orders, showPrices);
    doc.open();
    doc.write(fullHtml);
    doc.close();

    // Trigger print once content and images are ready
    setTimeout(() => {
        try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
        } catch (err) {
            console.error("Print error:", err);
        }
    }, 250);
}
