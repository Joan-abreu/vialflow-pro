import React from "react";
import { format } from "date-fns";
import { Package, CheckSquare, Truck, MapPin } from "lucide-react";

// Code128-B Barcode patterns for crisp SVG rendering without external dependencies
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

function generateCode128Bars(text: string): boolean[] {
    const cleanText = text.toUpperCase().replace(/[^ -~]/g, "");
    if (!cleanText) return [];

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
    return bars;
}

export const BarcodeSVG: React.FC<{ value: string; height?: number; className?: string }> = ({
    value,
    height = 26,
    className = ""
}) => {
    const bars = React.useMemo(() => generateCode128Bars(value), [value]);

    if (!bars || bars.length === 0) {
        return (
            <div className="font-mono text-xs font-bold tracking-widest text-gray-800">
                *{value}*
            </div>
        );
    }

    const barWidth = 1.25;
    const totalWidth = bars.length * barWidth;

    return (
        <div className={`flex flex-col items-center ${className}`}>
            <svg
                width={totalWidth}
                height={height}
                viewBox={`0 0 ${totalWidth} ${height}`}
                className="overflow-visible"
                style={{ shapeRendering: "crispEdges" }}
            >
                {bars.map((isBar, idx) =>
                    isBar ? (
                        <rect
                            key={idx}
                            x={idx * barWidth}
                            y={0}
                            width={barWidth}
                            height={height}
                            fill="#000000"
                        />
                    ) : null
                )}
            </svg>
            <span className="font-mono text-[9px] font-bold text-gray-900 tracking-wider mt-0.5">
                {value}
            </span>
        </div>
    );
};

export interface PackingSlipItem {
    id: string;
    product_id: string;
    variant_id: string;
    quantity: number;
    price_at_time: number;
    is_bulk?: boolean;
    with_labels?: boolean;
    custom_label_image_url?: string | null;
    custom_label_instructions?: string | null;
    variant?: {
        id: string;
        sku: string;
        sale_type: string;
        pack_size: number;
        image_url: string | null;
        images?: string[] | null;
        product?: {
            name: string;
            image_url: string | null;
            images?: string[] | null;
            category?: string;
            product_categories?: { name: string };
        };
        vial_type?: {
            name: string;
            capacity_ml: number;
            color: string | null;
            shape: string | null;
        };
    };
}

export interface PackingSlipOrder {
    id: string;
    total_amount: number;
    shipping_cost?: number;
    product_discount?: number;
    shipping_discount?: number;
    status: string;
    created_at: string;
    customer_email: string;
    shipping_address?: {
        full_name?: string;
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postal_code?: string;
        country?: string;
        phone?: string;
    };
    customer_profile?: {
        full_name?: string;
    };
    shipping_service?: string;
    shipping_carrier?: string;
    tracking_number?: string | null;
    order_items?: PackingSlipItem[];
    order_shipments?: Array<{
        carrier: string;
        tracking_number: string;
        status: string;
    }>;
    notes?: string;
}

interface PackingSlipDocumentProps {
    orders: PackingSlipOrder[];
    showPrices?: boolean;
    companyInfo?: {
        name?: string;
        tagline?: string;
        email?: string;
        website?: string;
        logoUrl?: string;
    };
}

export const formatVariantDetails = (variant: any) => {
    if (!variant) return "";
    const vialName = variant.vial_type?.name || "";
    const capMl = variant.vial_type?.capacity_ml;
    const color = variant.vial_type?.color;
    const shape = variant.vial_type?.shape;
    const category = (variant.product?.category || variant.product?.product_categories?.name || "").toLowerCase();

    const isMg =
        vialName.toLowerCase().includes("mg") ||
        category.includes("peptide") ||
        (variant.sku && /^(RT|MOTS|NAD|TR|GLP|PEP)/i.test(variant.sku));

    if (isMg) {
        const mgLabel = vialName || (capMl ? `${capMl}mg` : "");
        const details = [color, shape].filter(Boolean).join(" - ");
        return details ? `${mgLabel} (${details})` : mgLabel;
    }

    const sizeStr = capMl ? `${capMl}ml` : "";
    let mainLabel = vialName || sizeStr;

    if (vialName && sizeStr) {
        if (vialName.toLowerCase() === sizeStr.toLowerCase() || vialName.toLowerCase().includes(sizeStr.toLowerCase())) {
            mainLabel = vialName;
        } else {
            mainLabel = `${sizeStr} (${vialName})`;
        }
    }

    const details = [color, shape].filter(Boolean).join(" - ");
    if (details && !mainLabel.includes(details)) {
        return `${mainLabel} - ${details}`;
    }
    return mainLabel;
};

export const getProductThumbnail = (item: PackingSlipItem): string | null => {
    if (item.variant?.image_url) return item.variant.image_url;
    if (item.variant?.images && item.variant.images.length > 0 && item.variant.images[0]) {
        return item.variant.images[0];
    }
    if (item.variant?.product?.image_url) return item.variant.product.image_url;
    if (item.variant?.product?.images && item.variant.product.images.length > 0 && item.variant.product.images[0]) {
        return item.variant.product.images[0];
    }
    return null;
};

export const SingleOrderPackingSlip: React.FC<{
    order: PackingSlipOrder;
    showPrices?: boolean;
    companyInfo?: PackingSlipDocumentProps["companyInfo"];
    pageIndex: number;
    totalPages: number;
}> = ({ order, showPrices = false, companyInfo, pageIndex, totalPages }) => {
    const company = {
        name: companyInfo?.name || "Liv Well Research Labs",
        tagline: companyInfo?.tagline || "Direct Manufacturer of Ultra-Pure Reconstitution Solutions & Research Peptides",
        email: companyInfo?.email || "sales@livwellresearchlabs.com",
        website: companyInfo?.website || "livwellresearchlabs.com",
        logoUrl: companyInfo?.logoUrl || "/favicon.png",
    };

    const recipientName =
        order.customer_profile?.full_name ||
        order.shipping_address?.full_name ||
        "Valued Customer";

    const totalUnits = (order.order_items || []).reduce((acc, item) => acc + (item.quantity || 0), 0);
    const uniqueSkusCount = (order.order_items || []).length;
    const orderShortId = order.id ? order.id.slice(0, 8).toUpperCase() : "ORDER";
    const barcodeValue = `ORD-${orderShortId}`;

    const activeTracking =
        order.tracking_number ||
        (order.order_shipments && order.order_shipments.find(s => s.status !== "cancelled")?.tracking_number) ||
        null;

    return (
        <div className="packing-slip-sheet bg-white text-black p-5 font-sans box-border relative flex flex-col justify-between max-w-[8.5in] mx-auto border border-gray-200 shadow-sm print:shadow-none print:border-none print:p-0 print:m-0 print:w-full print:max-w-none print:break-inside-avoid">
            {/* Top Section */}
            <div>
                {/* Header Row */}
                <div className="flex justify-between items-start border-b-2 border-black pb-2.5">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded bg-white border border-gray-200 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                                <img
                                    src={company.logoUrl}
                                    alt={company.name}
                                    className="w-full h-full object-contain p-0.5"
                                    crossOrigin="anonymous"
                                    onError={(e) => {
                                        (e.target as HTMLElement).style.display = "none";
                                    }}
                                />
                            </div>
                            <div>
                                <h1 className="text-sm font-black tracking-wide uppercase text-black leading-tight">
                                    {company.name}
                                </h1>
                                <p className="text-[9px] text-gray-600 font-medium tracking-tight">
                                    {company.tagline}
                                </p>
                            </div>
                        </div>
                        <div className="mt-1 text-[9px] text-gray-600 flex items-center gap-2">
                            <span>Web: <strong className="text-gray-900">{company.website}</strong></span>
                            <span>•</span>
                            <span>Support: <strong className="text-gray-900">{company.email}</strong></span>
                        </div>
                    </div>

                    {/* Document Title */}
                    <div className="flex flex-col items-end text-right">
                        <div className="bg-black text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-xs">
                            PACKING SLIP
                        </div>
                        <div className="font-mono text-xs font-black text-gray-900 mt-1">
                            #{orderShortId}
                        </div>
                    </div>
                </div>

                {/* Metadata & Addresses Grid */}
                <div className="grid grid-cols-2 gap-3 mt-2.5 py-2 px-3 bg-gray-50 border border-gray-200 rounded">
                    {/* Left: Ship To */}
                    <div className="text-[10px]">
                        <div className="flex items-center gap-1 font-bold uppercase text-[9px] tracking-wider text-gray-500 mb-0.5">
                            <MapPin className="w-3 h-3 text-gray-700" />
                            <span>Ship To:</span>
                        </div>
                        <p className="font-bold text-xs text-gray-900">{recipientName}</p>
                        {order.shipping_address ? (
                            <div className="text-gray-700 leading-tight mt-0.5">
                                <p>{order.shipping_address.line1}</p>
                                {order.shipping_address.line2 && <p>{order.shipping_address.line2}</p>}
                                <p className="font-medium text-gray-900">
                                    {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postal_code}
                                </p>
                                <p className="uppercase text-[8px] text-gray-500 font-semibold">{order.shipping_address.country || "United States"}</p>
                                {order.shipping_address.phone && (
                                    <p className="text-[9px] text-gray-600 mt-0.5">📞 {order.shipping_address.phone}</p>
                                )}
                            </div>
                        ) : (
                            <p className="text-gray-500 italic">No shipping address recorded</p>
                        )}
                        <p className="text-[9px] text-gray-600 mt-0.5">
                            ✉️ {order.customer_email}
                        </p>
                    </div>

                    {/* Right: Order Details */}
                    <div className="text-[10px] flex flex-col justify-between border-l border-gray-200 pl-3">
                        <div className="space-y-0.5">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 font-medium">Order Number:</span>
                                <span className="font-mono font-bold text-xs text-black">#{orderShortId}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 font-medium">Order Date:</span>
                                <span className="font-semibold text-gray-900">
                                    {order.created_at ? format(new Date(order.created_at), "MMM d, yyyy h:mm a") : "-"}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 font-medium">Shipping Service:</span>
                                <span className="font-bold text-gray-900 bg-white px-1 py-0.2 rounded border border-gray-200 text-[9px]">
                                    {order.shipping_service || "Standard Shipping"} {order.shipping_carrier ? `(${order.shipping_carrier})` : ""}
                                </span>
                            </div>
                            {activeTracking && (
                                <div className="flex justify-between items-center bg-blue-50/70 px-1.5 py-0.5 rounded border border-blue-200 mt-0.5">
                                    <span className="text-blue-900 font-bold text-[8px] flex items-center gap-1">
                                        <Truck className="w-2.5 h-2.5 text-blue-700" /> Tracking:
                                    </span>
                                    <span className="font-mono font-bold text-[9px] text-blue-900">
                                        {activeTracking}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Summary Badges */}
                        <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-gray-200 mt-1">
                            <span className="text-[8px] font-semibold text-gray-500 uppercase">Items:</span>
                            <span className="inline-flex items-center px-1.5 py-0.2 bg-black text-white text-[9px] font-bold rounded">
                                {totalUnits} Units
                            </span>
                            <span className="inline-flex items-center px-1 py-0.2 bg-gray-200 text-gray-800 text-[9px] font-bold rounded">
                                {uniqueSkusCount} SKUs
                            </span>
                        </div>
                    </div>
                </div>

                {/* Items Checklist Table */}
                <div className="mt-2.5">
                    <div className="flex items-center justify-between pb-1">
                        <h2 className="text-[10px] font-bold uppercase tracking-wider text-black flex items-center gap-1">
                            <CheckSquare className="w-3 h-3 text-black" />
                            Picking & Packing Checklist
                        </h2>
                        <span className="text-[8px] font-medium text-gray-500 italic">
                            ✓ Check off each item during fulfillment
                        </span>
                    </div>

                    <table className="w-full text-left border-collapse border border-gray-300">
                        <thead>
                            <tr className="bg-gray-100 text-gray-800 text-[9px] uppercase tracking-wider border-b border-gray-300">
                                <th className="py-1 px-1.5 text-center w-7 border-r border-gray-300">Check</th>
                                <th className="py-1 px-1.5 text-center w-12 border-r border-gray-300">Photo</th>
                                <th className="py-1 px-2 border-r border-gray-300">Product & Specification</th>
                                <th className="py-1 px-2 border-r border-gray-300 w-32">SKU</th>
                                <th className="py-1 px-1.5 text-center w-14 border-r border-gray-300">Qty</th>
                                {showPrices && (
                                    <th className="py-1 px-2 text-right w-16">Price</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-xs">
                            {order.order_items && order.order_items.length > 0 ? (
                                order.order_items.map((item, idx) => {
                                    const imgUrl = getProductThumbnail(item);
                                    const specLabel = formatVariantDetails(item.variant);
                                    const packSize = item.variant?.pack_size || 1;
                                    const isPack = item.variant?.sale_type === "pack" || packSize > 1;

                                    return (
                                        <tr key={item.id || idx} className="hover:bg-gray-50/50 break-inside-avoid">
                                            {/* Checkbox box for physical pen check */}
                                            <td className="py-1 px-1 text-center border-r border-gray-300 align-middle">
                                                <div className="w-3.5 h-3.5 border-2 border-gray-700 rounded-xs mx-auto bg-white flex items-center justify-center">
                                                    {/* Empty box for operator check */}
                                                </div>
                                            </td>

                                            {/* Visual Image Thumbnail */}
                                            <td className="py-1 px-1 text-center border-r border-gray-300 align-middle">
                                                <div className="w-9 h-9 rounded border border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden mx-auto shadow-2xs">
                                                    {imgUrl ? (
                                                        <img
                                                            src={imgUrl}
                                                            alt={item.variant?.product?.name || "Product"}
                                                            className="w-full h-full object-cover"
                                                            crossOrigin="anonymous"
                                                        />
                                                    ) : (
                                                        <Package className="w-4 h-4 text-gray-400" />
                                                    )}
                                                </div>
                                            </td>

                                            {/* Product Description */}
                                            <td className="py-1 px-2 border-r border-gray-300 align-top">
                                                <div className="font-bold text-xs text-gray-900 leading-tight">
                                                    {item.variant?.product?.name || "Unknown Product"}
                                                </div>
                                                <div className="text-gray-700 text-[9px] mt-0.5 font-medium flex flex-wrap items-center gap-1">
                                                    {specLabel && (
                                                        <span className="bg-gray-100 text-gray-800 px-1 py-0.2 rounded font-semibold text-[8px]">
                                                            {specLabel}
                                                        </span>
                                                    )}
                                                    {isPack && (
                                                        <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-1 py-0.2 rounded font-bold text-[8px]">
                                                            Pack of {packSize} vials
                                                        </span>
                                                    )}
                                                    {item.is_bulk && (
                                                        <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1 py-0.2 rounded font-bold text-[8px]">
                                                            Bulk {item.with_labels ? "(Custom Labels)" : "(Unlabeled)"}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Custom Label Instructions */}
                                                {item.with_labels && item.custom_label_instructions && (
                                                    <div className="mt-0.5 p-0.5 bg-yellow-50 border border-yellow-200 rounded text-[8px] text-yellow-900 font-medium">
                                                        <span className="font-bold">🏷️ Label Notes:</span> {item.custom_label_instructions}
                                                    </div>
                                                )}
                                            </td>

                                            {/* SKU */}
                                            <td className="py-1 px-2 border-r border-gray-300 align-top">
                                                <div className="font-mono font-bold text-[10px] text-gray-900 bg-gray-100 px-1 py-0.2 rounded inline-block border border-gray-200">
                                                    {item.variant?.sku || "NO-SKU"}
                                                </div>
                                            </td>

                                            {/* Quantity */}
                                            <td className="py-1 px-1 text-center border-r border-gray-300 align-middle">
                                                <div className="inline-flex flex-col items-center justify-center">
                                                    <span className="font-black text-xs text-black bg-gray-100 border-2 border-gray-800 rounded px-1.5 py-0.2 min-w-[24px] text-center">
                                                        {item.quantity}
                                                    </span>
                                                    <span className="text-[7px] font-bold text-gray-500 uppercase mt-0.5">
                                                        {isPack ? `(${item.quantity * packSize} v)` : "units"}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Price (optional) */}
                                            {showPrices && (
                                                <td className="py-1 px-2 text-right align-middle font-mono text-[10px]">
                                                    <div className="font-bold text-gray-900">
                                                        ${((item.price_at_time || 0) * item.quantity).toFixed(2)}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={showPrices ? 6 : 5} className="py-3 text-center text-gray-500 italic text-xs">
                                        No items in this order.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Price Breakdown (only when showPrices is enabled) */}
                {showPrices && (
                    <div className="flex justify-end mt-1.5">
                        <div className="w-44 bg-gray-50 border border-gray-200 rounded p-1.5 text-[9px] space-y-0.5">
                            <div className="flex justify-between text-gray-600">
                                <span>Subtotal:</span>
                                <span>${(order.total_amount - (order.shipping_cost || 0) + (order.product_discount || 0) + (order.shipping_discount || 0)).toFixed(2)}</span>
                            </div>
                            {(order.product_discount || 0) > 0 && (
                                <div className="flex justify-between text-green-700 font-medium">
                                    <span>Discount:</span>
                                    <span>-${(order.product_discount || 0).toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-gray-600">
                                <span>Shipping:</span>
                                <span>${(order.shipping_cost || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-[10px] text-black border-t border-gray-300 pt-0.5">
                                <span>Total Paid:</span>
                                <span>${order.total_amount.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Verification & Signatures */}
            <div className="mt-3 pt-2 border-t border-gray-300 text-[9px]">
                <div className="grid grid-cols-2 gap-4 pb-1.5 border-b border-gray-200">
                    {/* Packer Signature */}
                    <div className="border border-dashed border-gray-400 px-2.5 py-1.5 rounded bg-gray-50/50 flex items-center justify-between">
                        <span className="text-[9px] uppercase font-bold text-gray-600 tracking-wider">Packed By:</span>
                        <div className="w-32 border-b border-gray-400 pb-0.5 text-[9px] font-mono text-center text-gray-400">
                            (Signature / Initials)
                        </div>
                    </div>

                    {/* Packing Date / Stamp */}
                    <div className="border border-dashed border-gray-400 px-2.5 py-1.5 rounded bg-gray-50/50 flex items-center justify-between">
                        <span className="text-[9px] uppercase font-bold text-gray-600 tracking-wider">Fulfillment Date:</span>
                        <span className="text-[9px] font-semibold text-gray-800">
                            {format(new Date(), "MMM d, yyyy")}
                        </span>
                    </div>
                </div>

                {/* Return & Support Notice */}
                <div className="mt-1 flex justify-between items-center text-[8px] text-gray-500 leading-tight">
                    <p>
                        <strong>Inspection Notice:</strong> Please verify all contents upon receipt. For any discrepancies, contact us at <strong>{company.email}</strong>.
                    </p>
                    <div className="shrink-0 ml-2 text-right font-mono text-[8px] font-semibold text-gray-600">
                        PS-{orderShortId}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const PackingSlipDocument: React.FC<PackingSlipDocumentProps> = ({
    orders,
    showPrices = false,
    companyInfo
}) => {
    if (!orders || orders.length === 0) {
        return (
            <div className="p-8 text-center text-gray-500 font-medium">
                No orders selected to generate packing slips.
            </div>
        );
    }

    return (
        <div className="packing-slip-printable-root w-full bg-slate-100 dark:bg-slate-900 py-2 print:bg-white print:p-0 print:py-0">
            {orders.map((order, index) => (
                <div
                    key={order.id || index}
                    className="packing-slip-page-wrapper mb-4 print:mb-0"
                    style={{
                        pageBreakAfter: index < orders.length - 1 ? "always" : "avoid",
                        breakAfter: index < orders.length - 1 ? "page" : "avoid"
                    }}
                >
                    <SingleOrderPackingSlip
                        order={order}
                        showPrices={showPrices}
                        companyInfo={companyInfo}
                        pageIndex={index + 1}
                        totalPages={orders.length}
                    />
                </div>
            ))}

            {/* Print Styles */}
            <style>{`
                @media print {
                    @page {
                        size: letter portrait;
                        margin: 5mm 7mm;
                    }
                    html, body, #root, .packing-slip-printable-root {
                        background: #ffffff !important;
                        color: #000000 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        min-height: 0 !important;
                        height: auto !important;
                    }
                    .packing-slip-page-wrapper {
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .packing-slip-page-wrapper:not(:last-child) {
                        page-break-after: always !important;
                        break-after: page !important;
                    }
                    .packing-slip-page-wrapper:last-child {
                        page-break-after: avoid !important;
                        break-after: avoid !important;
                        margin-bottom: 0 !important;
                        padding-bottom: 0 !important;
                    }
                    .packing-slip-sheet {
                        box-shadow: none !important;
                        border: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        min-height: 0 !important;
                        height: auto !important;
                    }
                    /* Ensure exact colors and background shading print cleanly */
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default PackingSlipDocument;
