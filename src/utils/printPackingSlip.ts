import { format } from "date-fns";
import {
    PackingSlipOrder,
    formatVariantDetails,
    getProductThumbnail
} from "@/components/orders/PackingSlipDocument";

const CODE128_B_PATTERNS: string[] = [
    "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
    "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
    "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
    "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
    "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
    "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
    "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
    "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
    "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
    "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
    "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
];

const START_CODE_B = 104;
const STOP_CODE = 106;

function generateBarcodeSvg(value: string, height: number = 24): string {
    const cleanText = value.toUpperCase().replace(/[^ -~]/g, "");
    if (!cleanText) return `<span style="font-family: monospace; font-size: 10px;">*${value}*</span>`;

    const codes: number[] = [START_CODE_B];
    let checksum = START_CODE_B;

    for (let i = 0; i < cleanText.length; i++) {
        const charCode = cleanText.charCodeAt(i) - 32;
        codes.push(charCode);
        checksum += charCode * (i + 1);
    }

    codes.push(checksum % 103);
    codes.push(STOP_CODE);

    const bars: boolean[] = [];
    for (const code of codes) {
        const pattern = CODE128_B_PATTERNS[code] || CODE128_B_PATTERNS[0];
        let isBar = true;
        for (const char of pattern) {
            const width = parseInt(char, 10);
            for (let w = 0; w < width; w++) {
                bars.push(isBar);
            }
            isBar = !isBar;
        }
    }

    const barWidth = 1.25;
    const totalWidth = bars.length * barWidth;

    const rects = bars
        .map((isBar, idx) =>
            isBar
                ? `<rect x="${idx * barWidth}" y="0" width="${barWidth}" height="${height}" fill="#000000" />`
                : ""
        )
        .join("");

    return `
        <div style="display: flex; flex-direction: column; align-items: center;">
            <svg width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}" style="overflow: visible; shape-rendering: crispEdges;">
                ${rects}
            </svg>
            <span style="font-family: monospace; font-size: 8px; font-weight: bold; color: #111; letter-spacing: 0.05em; margin-top: 1px;">${value}</span>
        </div>
    `;
}

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
    const barcodeValue = `ORD-${orderShortId}`;
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
            <tr style="border-bottom: 1px solid #e5e7eb; page-break-inside: avoid; break-inside: avoid;">
                <td style="padding: 4px 6px; text-align: center; border-right: 1px solid #e5e7eb; vertical-align: middle;">
                    <div style="width: 13px; height: 13px; border: 1.5px solid #374151; border-radius: 2px; margin: 0 auto; background: #fff;"></div>
                </td>
                <td style="padding: 4px 6px; text-align: center; border-right: 1px solid #e5e7eb; vertical-align: middle;">
                    <div style="width: 36px; height: 36px; border: 1px solid #d1d5db; border-radius: 3px; background: #f9fafb; display: flex; align-items: center; justify-content: center; overflow: hidden; margin: 0 auto;">
                        ${
                            imgUrl
                                ? `<img src="${escapeHtml(imgUrl)}" alt="Product" style="width: 100%; height: 100%; object-fit: cover;" />`
                                : `<div style="font-size: 8px; color: #9ca3af; font-weight: bold;">ITEM</div>`
                        }
                    </div>
                </td>
                <td style="padding: 4px 8px; border-right: 1px solid #e5e7eb; vertical-align: top;">
                    <div style="font-weight: bold; font-size: 11px; color: #111827; line-height: 1.2;">
                        ${escapeHtml(item.variant?.product?.name || "Unknown Product")}
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-top: 2px;">
                        ${
                            specLabel
                                ? `<span style="background: #f3f4f6; color: #1f2937; padding: 1px 4px; border-radius: 2px; font-weight: 600; font-size: 8px;">${escapeHtml(specLabel)}</span>`
                                : ""
                        }
                        ${
                            isPack
                                ? `<span style="background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; padding: 1px 4px; border-radius: 2px; font-weight: bold; font-size: 8px;">Pack of ${packSize} vials</span>`
                                : ""
                        }
                        ${
                            item.is_bulk
                                ? `<span style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a; padding: 1px 4px; border-radius: 2px; font-weight: bold; font-size: 8px;">Bulk ${item.with_labels ? "(Custom Labels)" : "(Unlabeled)"}</span>`
                                : ""
                        }
                    </div>
                    ${
                        item.with_labels && item.custom_label_instructions
                            ? `<div style="margin-top: 2px; padding: 2px 4px; background: #fefce8; border: 1px solid #fef08a; border-radius: 2px; font-size: 8px; color: #713f12;"><strong>Label Notes:</strong> ${escapeHtml(item.custom_label_instructions)}</div>`
                            : ""
                    }
                </td>
                <td style="padding: 4px 8px; border-right: 1px solid #e5e7eb; vertical-align: top;">
                    <div style="font-family: monospace; font-weight: bold; font-size: 9.5px; color: #111827; background: #f3f4f6; padding: 2px 4px; border-radius: 2px; display: inline-block; border: 1px solid #e5e7eb;">
                        ${escapeHtml(item.variant?.sku || "NO-SKU")}
                    </div>
                </td>
                <td style="padding: 4px 6px; text-align: center; border-right: 1px solid #e5e7eb; vertical-align: middle;">
                    <div style="display: inline-flex; flex-direction: column; align-items: center;">
                        <span style="font-weight: 900; font-size: 11px; color: #000; background: #f3f4f6; border: 1.5px solid #1f2937; border-radius: 3px; padding: 1px 6px; min-width: 22px; text-align: center;">
                            ${item.quantity}
                        </span>
                        <span style="font-size: 7px; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-top: 1px;">
                            ${isPack ? `(${item.quantity * packSize} v)` : "units"}
                        </span>
                    </div>
                </td>
                ${
                    showPrices
                        ? `<td style="padding: 4px 8px; text-align: right; vertical-align: middle; font-family: monospace; font-size: 10px; font-weight: bold; color: #111827;">
                            $${((item.price_at_time || 0) * item.quantity).toFixed(2)}
                           </td>`
                        : ""
                }
            </tr>
        `;
    }).join("");

    const priceBreakdown = showPrices
        ? `
            <div style="display: flex; justify-content: flex-end; margin-top: 6px;">
                <div style="width: 170px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 6px; font-size: 9px; line-height: 1.4;">
                    <div style="display: flex; justify-content: space-between; color: #4b5563;">
                        <span>Subtotal:</span>
                        <span>$${(order.total_amount - (order.shipping_cost || 0) + (order.product_discount || 0) + (order.shipping_discount || 0)).toFixed(2)}</span>
                    </div>
                    ${
                        (order.product_discount || 0) > 0
                            ? `<div style="display: flex; justify-content: space-between; color: #15803d; font-weight: 600;">
                                <span>Discount:</span>
                                <span>-$${(order.product_discount || 0).toFixed(2)}</span>
                               </div>`
                            : ""
                    }
                    <div style="display: flex; justify-content: space-between; color: #4b5563;">
                        <span>Shipping:</span>
                        <span>$${(order.shipping_cost || 0).toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 10px; color: #000; border-top: 1px solid #d1d5db; padding-top: 2px; margin-top: 2px;">
                        <span>Total Paid:</span>
                        <span>$${order.total_amount.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `
        : "";

    return `
        <div class="packing-slip-page" style="page-break-inside: avoid; break-inside: avoid; box-sizing: border-box; width: 100%; max-width: 8.5in; margin: 0 auto; padding: 4px 8px; background: #ffffff; color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <!-- Header Row -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000000; padding-bottom: 6px;">
                <div style="display: flex; flex-direction: column;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 32px; height: 32px; border-radius: 4px; background: #ffffff; border: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;">
                            <img src="/favicon.png" alt="Liv Well Logo" style="width: 100%; height: 100%; object-fit: contain; padding: 1px;" onerror="this.style.display='none'" />
                        </div>
                        <div>
                            <h1 style="font-size: 13.5px; font-weight: 900; letter-spacing: 0.02em; text-transform: uppercase; color: #000000; margin: 0; line-height: 1.1;">
                                Liv Well Research Labs
                            </h1>
                            <p style="font-size: 8.5px; color: #4b5563; font-weight: 500; margin: 1px 0 0 0;">
                                Direct Manufacturer of Ultra-Pure Reconstitution Solutions & Research Peptides
                            </p>
                        </div>
                    </div>
                    <div style="margin-top: 4px; font-size: 8.5px; color: #4b5563; display: flex; align-items: center; gap: 8px;">
                        <span>Web: <strong style="color: #111827;">livwellresearchlabs.com</strong></span>
                        <span>•</span>
                        <span>Support: <strong style="color: #111827;">sales@livwellresearchlabs.com</strong></span>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; align-items: flex-end; text-align: right;">
                    <div style="background: #000000; color: #ffffff; font-size: 9.5px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; padding: 2px 8px; border-radius: 2px;">
                        PACKING SLIP
                    </div>
                    <div style="font-family: monospace; font-size: 11px; font-weight: 900; color: #111827; margin-top: 3px;">
                        #${escapeHtml(orderShortId)}
                    </div>
                </div>
            </div>

            <!-- Metadata & Addresses Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 6px; padding: 6px 10px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 9.5px;">
                <!-- Ship To -->
                <div>
                    <div style="font-weight: bold; text-transform: uppercase; font-size: 8px; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 2px;">
                        📍 Ship To:
                    </div>
                    <div style="font-weight: bold; font-size: 11px; color: #111827;">
                        ${escapeHtml(recipientName)}
                    </div>
                    ${
                        order.shipping_address
                            ? `
                                <div style="color: #374151; line-height: 1.25; margin-top: 1px;">
                                    <div>${escapeHtml(order.shipping_address.line1)}</div>
                                    ${order.shipping_address.line2 ? `<div>${escapeHtml(order.shipping_address.line2)}</div>` : ""}
                                    <div style="font-weight: 600; color: #111827;">
                                        ${escapeHtml(order.shipping_address.city)}, ${escapeHtml(order.shipping_address.state)} ${escapeHtml(order.shipping_address.postal_code)}
                                    </div>
                                    <div style="text-transform: uppercase; font-size: 8px; color: #6b7280; font-weight: 600;">
                                        ${escapeHtml(order.shipping_address.country || "United States")}
                                    </div>
                                    ${order.shipping_address.phone ? `<div style="font-size: 8.5px; color: #4b5563; margin-top: 1px;">📞 ${escapeHtml(order.shipping_address.phone)}</div>` : ""}
                                </div>
                            `
                            : `<div style="color: #9ca3af; font-style: italic;">No shipping address recorded</div>`
                    }
                    <div style="font-size: 8.5px; color: #4b5563; margin-top: 2px;">
                        ✉️ ${escapeHtml(order.customer_email)}
                    </div>
                </div>

                <!-- Order Details -->
                <div style="border-left: 1px solid #e5e7eb; padding-left: 10px; display: flex; flex-direction: column; justify-content: space-between;">
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #6b7280; font-weight: 500;">Order Number:</span>
                            <span style="font-family: monospace; font-weight: bold; font-size: 11px; color: #000000;">#${escapeHtml(orderShortId)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #6b7280; font-weight: 500;">Order Date:</span>
                            <span style="font-weight: 600; color: #111827;">${formattedDate}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #6b7280; font-weight: 500;">Shipping Service:</span>
                            <span style="font-weight: bold; color: #111827; background: #ffffff; padding: 1px 4px; border-radius: 2px; border: 1px solid #e5e7eb; font-size: 8.5px;">
                                ${escapeHtml(order.shipping_service || "Standard Shipping")} ${order.shipping_carrier ? `(${escapeHtml(order.shipping_carrier)})` : ""}
                            </span>
                        </div>
                        ${
                            activeTracking
                                ? `
                                    <div style="display: flex; justify-content: space-between; align-items: center; background: #eff6ff; padding: 2px 4px; border-radius: 2px; border: 1px solid #bfdbfe; margin-top: 1px;">
                                        <span style="color: #1e3a8a; font-weight: bold; font-size: 8px;">🚚 Tracking:</span>
                                        <span style="font-family: monospace; font-weight: bold; font-size: 9px; color: #1e3a8a;">${escapeHtml(activeTracking)}</span>
                                    </div>
                                `
                                : ""
                        }
                    </div>

                    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px; border-top: 1px solid #e5e7eb; padding-top: 3px; margin-top: 3px;">
                        <span style="font-size: 8px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Items:</span>
                        <span style="background: #000000; color: #ffffff; font-size: 8.5px; font-weight: bold; padding: 1px 4px; border-radius: 2px;">
                            ${totalUnits} Units
                        </span>
                        <span style="background: #e5e7eb; color: #1f2937; font-size: 8.5px; font-weight: bold; padding: 1px 4px; border-radius: 2px;">
                            ${uniqueSkusCount} SKUs
                        </span>
                    </div>
                </div>
            </div>

            <!-- Items Checklist Table -->
            <div style="margin-top: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 2px;">
                    <div style="font-size: 9.5px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #000000;">
                        ☑️ Picking &amp; Packing Checklist
                    </div>
                    <div style="font-size: 8px; font-weight: 500; color: #6b7280; font-style: italic;">
                        ✓ Check off each item during fulfillment
                    </div>
                </div>

                <table style="width: 100%; text-align: left; border-collapse: collapse; border: 1px solid #d1d5db; font-size: 9.5px;">
                    <thead>
                        <tr style="background: #f3f4f6; color: #374151; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #d1d5db;">
                            <th style="padding: 3px 4px; text-align: center; width: 24px; border-right: 1px solid #d1d5db;">Check</th>
                            <th style="padding: 3px 4px; text-align: center; width: 44px; border-right: 1px solid #d1d5db;">Photo</th>
                            <th style="padding: 3px 6px; border-right: 1px solid #d1d5db;">Product &amp; Specification</th>
                            <th style="padding: 3px 6px; border-right: 1px solid #d1d5db; width: 120px;">SKU</th>
                            <th style="padding: 3px 4px; text-align: center; width: 50px; border-right: 1px solid #d1d5db;">Qty</th>
                            ${showPrices ? `<th style="padding: 3px 6px; text-align: right; width: 60px;">Price</th>` : ""}
                        </tr>
                    </thead>
                    <tbody>
                        ${
                            itemsRows ||
                            `<tr><td colspan="${showPrices ? 6 : 5}" style="padding: 8px; text-align: center; color: #9ca3af; font-style: italic;">No items in this order.</td></tr>`
                        }
                    </tbody>
                </table>
            </div>

            ${priceBreakdown}

            <!-- Bottom Verification & Signatures -->
            <div style="margin-top: 8px; border-top: 1px solid #d1d5db; padding-top: 4px; font-size: 8.5px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb;">
                    <div style="border: 1px dashed #9ca3af; padding: 4px 6px; border-radius: 3px; background: #f9fafb; display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-size: 8.5px; text-transform: uppercase; font-weight: bold; color: #4b5563; letter-spacing: 0.05em;">Packed By:</span>
                        <div style="width: 120px; border-bottom: 1px solid #9ca3af; padding-bottom: 1px; font-family: monospace; font-size: 8px; color: #9ca3af; text-align: center;">
                            (Signature / Initials)
                        </div>
                    </div>

                    <div style="border: 1px dashed #9ca3af; padding: 4px 6px; border-radius: 3px; background: #f9fafb; display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-size: 8.5px; text-transform: uppercase; font-weight: bold; color: #4b5563; letter-spacing: 0.05em;">Fulfillment Date:</span>
                        <span style="font-size: 8.5px; font-weight: 600; color: #1f2937;">
                            ${currentDate}
                        </span>
                    </div>
                </div>

                <div style="margin-top: 3px; display: flex; justify-content: space-between; align-items: center; font-size: 7.5px; color: #6b7280; line-height: 1.2;">
                    <p style="margin: 0;">
                        <strong>Inspection Notice:</strong> Please verify all contents upon receipt. For any discrepancies, contact us at <strong>sales@livwellresearchlabs.com</strong>.
                    </p>
                    <div style="font-family: monospace; font-size: 8px; color: #6b7280; flex-shrink: 0; margin-left: 6px; font-weight: 600;">
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
            margin: 6mm 8mm;
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
