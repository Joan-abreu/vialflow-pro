import { CartItem } from "@/contexts/CartContext";

export interface PeptideUpsellSettings {
    enabled: boolean;
    offerType: "free_water" | "percentage_discount" | "fixed_discount";
    discountValue: number; // e.g. 100 for 100% off water, 20 for 20% off, or 15 for $15 off
    minPeptideSpend: number; // e.g. 0 for any peptide, or 45 for $45 min
    maxFreeWaterUnits: number; // Maximum units of water discounted (default: 1)
    featuredProductIds: string[]; // empty means auto-pick top published peptides
    headline: string;
    subtitle: string;
    badgeText: string;
    ctaButtonText: string;
    declineButtonText: string;
}

export const DEFAULT_PEPTIDE_UPSELL_SETTINGS: PeptideUpsellSettings = {
    enabled: true,
    offerType: "free_water",
    discountValue: 100, // 100% off water up to maxFreeWaterUnits
    minPeptideSpend: 0,
    maxFreeWaterUnits: 1, // Default limit: 1 free water unit per order
    featuredProductIds: [],
    headline: "Unlock FREE Reconstitution Solution with Any Research Peptide",
    subtitle: "Add any ultra-pure research peptide to your order and get your Reconstitution Solution 100% FREE!",
    badgeText: "EXCLUSIVE LAB UPGRADE OFFER",
    ctaButtonText: "Add to Order & Claim Free Water",
    declineButtonText: "No thanks, continue with water only",
};

/**
 * Check if a cart item is a reconstitution solution / bacteriostatic water product
 */
export function isWaterCartItem(item: CartItem): boolean {
    const category = (item.variant.product.category || "").toLowerCase();
    const name = (item.variant.product.name || "").toLowerCase();
    const vialName = (item.variant.vial_type?.name || "").toLowerCase();

    return (
        category.includes("reconstitution") ||
        category.includes("water") ||
        name.includes("reconstitution") ||
        name.includes("bac water") ||
        name.includes("bacteriostatic") ||
        vialName.includes("ml")
    ) && !name.includes("peptide") && !category.includes("peptide");
}

/**
 * Check if a cart item is a research peptide product
 */
export function isPeptideCartItem(item: CartItem): boolean {
    const category = (item.variant.product.category || "").toLowerCase();
    const name = (item.variant.product.name || "").toLowerCase();
    const vialName = (item.variant.vial_type?.name || "").toLowerCase();

    return (
        category.includes("peptide") ||
        name.includes("peptide") ||
        vialName.includes("mg") ||
        (!category.includes("water") && !name.includes("reconstitution") && !name.includes("bacteriostatic") && !name.includes("bac water"))
    );
}

/**
 * Check if cart contains ONLY water products (trigger condition for upsell modal)
 */
export function cartHasOnlyWater(items: CartItem[]): boolean {
    if (!items || items.length === 0) return false;
    const hasWater = items.some(isWaterCartItem);
    const hasPeptide = items.some(isPeptideCartItem);
    return hasWater && !hasPeptide;
}

/**
 * Calculate the promotional upsell discount if eligible
 */
export function calculatePeptideUpsellDiscount(
    items: CartItem[],
    settings: PeptideUpsellSettings = DEFAULT_PEPTIDE_UPSELL_SETTINGS
): {
    isEligible: boolean;
    discountAmount: number;
    discountLabel: string;
    freeWaterValue: number;
} {
    if (!settings.enabled || !items || items.length === 0) {
        return { isEligible: false, discountAmount: 0, discountLabel: "", freeWaterValue: 0 };
    }

    const waterItems = items.filter(isWaterCartItem);
    const peptideItems = items.filter(isPeptideCartItem);

    if (waterItems.length === 0 || peptideItems.length === 0) {
        return { isEligible: false, discountAmount: 0, discountLabel: "", freeWaterValue: 0 };
    }

    // Calculate total spend on peptides
    const peptideSpend = peptideItems.reduce((sum, item) => {
        const bulkPrice = item.variant.bulk_price ?? null;
        const labelFee = item.with_labels ? (item.variant.bulk_label_fee ?? 0.15) : 0;
        const unitPrice = item.is_bulk && bulkPrice !== null ? (bulkPrice + labelFee) : (item.variant.bulk_only ? (item.variant.price + labelFee) : item.variant.price);
        return sum + (unitPrice * item.quantity);
    }, 0);

    if (peptideSpend < settings.minPeptideSpend) {
        return { isEligible: false, discountAmount: 0, discountLabel: "", freeWaterValue: 0 };
    }

    const maxUnits = Math.max(1, settings.maxFreeWaterUnits || 1);
    let freeUnitsCount = 0;
    let totalFreeWaterValue = 0;
    let singleWaterUnitPrice = 0;

    for (const item of waterItems) {
        const bulkPrice = item.variant.bulk_price ?? null;
        const labelFee = item.with_labels ? (item.variant.bulk_label_fee ?? 0.15) : 0;
        const unitPrice = item.is_bulk && bulkPrice !== null ? (bulkPrice + labelFee) : (item.variant.bulk_only ? (item.variant.price + labelFee) : item.variant.price);
        
        if (singleWaterUnitPrice === 0) {
            singleWaterUnitPrice = unitPrice;
        }

        const take = Math.min(item.quantity, maxUnits - freeUnitsCount);
        if (take > 0) {
            totalFreeWaterValue += (unitPrice * take);
            freeUnitsCount += take;
        }
        if (freeUnitsCount >= maxUnits) break;
    }

    let discountAmount = 0;
    let discountLabel = "Promo: Free Reconstitution Solution";

    if (settings.offerType === "free_water") {
        discountAmount = totalFreeWaterValue;
        discountLabel = maxUnits > 1 
            ? `Special Promo: ${maxUnits}x Free Reconstitution Solution` 
            : "Special Promo: 1x Free Reconstitution Solution";
    } else if (settings.offerType === "percentage_discount") {
        const cartSubtotal = items.reduce((sum, item) => {
            const bulkPrice = item.variant.bulk_price ?? null;
            const labelFee = item.with_labels ? (item.variant.bulk_label_fee ?? 0.15) : 0;
            const unitPrice = item.is_bulk && bulkPrice !== null ? (bulkPrice + labelFee) : (item.variant.bulk_only ? (item.variant.price + labelFee) : item.variant.price);
            return sum + (unitPrice * item.quantity);
        }, 0);
        discountAmount = Number(((cartSubtotal * settings.discountValue) / 100).toFixed(2));
        discountLabel = `Special Promo: ${settings.discountValue}% Off Order`;
    } else if (settings.offerType === "fixed_discount") {
        discountAmount = Math.min(settings.discountValue, totalFreeWaterValue);
        discountLabel = `Special Promo: $${settings.discountValue.toFixed(2)} Off`;
    }

    return {
        isEligible: true,
        discountAmount: Number(discountAmount.toFixed(2)),
        discountLabel,
        freeWaterValue: Number((singleWaterUnitPrice || totalFreeWaterValue).toFixed(2))
    };
}
