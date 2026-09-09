import { CartItem } from "@/contexts/CartContext";

export interface VolumeTier {
    id: string;
    minQty: number;
    discountPercentage: number;
    badge: string;
}

export interface FrequentlyBoughtTogetherConfig {
    enabled: boolean;
    discountType: "percentage" | "fixed";
    discountValue: number; // e.g. 15 for 15% or 5 for $5.00 off
    headline: string;
    badgeText: string;
    ctaButtonText: string;
    defaultPartnerCategory: string; // e.g. "water" or "reconstitution"
    customPartnerVariantId?: string; // Optional manual override SKU/variant
}

export interface VolumeTiersConfig {
    enabled: boolean;
    tiers: VolumeTier[];
}

export interface BundleSaveSettings {
    enabled: boolean;
    frequentlyBoughtTogether: FrequentlyBoughtTogetherConfig;
    volumeTiers: VolumeTiersConfig;
}

export const DEFAULT_BUNDLE_SETTINGS: BundleSaveSettings = {
    enabled: true,
    frequentlyBoughtTogether: {
        enabled: true,
        discountType: "percentage",
        discountValue: 15, // 15% off the combo
        headline: "Frequently Paired for Reconstitution",
        badgeText: "PAIR & SAVE 15%",
        ctaButtonText: "Add Both to Cart & Save",
        defaultPartnerCategory: "water",
    },
    volumeTiers: {
        enabled: true,
        tiers: [
            { id: "tier-1", minQty: 1, discountPercentage: 0, badge: "Standard" },
            { id: "tier-2", minQty: 3, discountPercentage: 10, badge: "Save 10% • Popular" },
            { id: "tier-3", minQty: 5, discountPercentage: 20, badge: "Save 20% • Best Value" },
        ]
    }
};

/**
 * Returns the highest applicable volume tier for a given quantity
 */
export function getVolumeDiscountForQuantity(
    quantity: number,
    tiers: VolumeTier[]
): VolumeTier | null {
    if (!tiers || tiers.length === 0 || quantity <= 0) return null;

    // Filter tiers with discount > 0 that the quantity qualifies for
    const qualified = tiers
        .filter(t => t.discountPercentage > 0 && quantity >= t.minQty)
        .sort((a, b) => b.minQty - a.minQty); // Highest minimum quantity first

    return qualified.length > 0 ? qualified[0] : null;
}

/**
 * Check if an item is a water / reconstitution solvent product
 */
export function isWaterProduct(product: { name?: string | null; category?: string | null; product_categories?: { name?: string } | null }): boolean {
    const category = (product.category || product.product_categories?.name || "").toLowerCase();
    const name = (product.name || "").toLowerCase();
    return (
        category.includes("water") ||
        category.includes("reconstitution") ||
        name.includes("water") ||
        name.includes("reconstitution") ||
        name.includes("bacteriostatic") ||
        name.includes("bac water")
    ) && !name.includes("peptide") && !category.includes("peptide");
}

/**
 * Check if an item is a peptide product
 */
export function isPeptideProduct(product: { name?: string | null; category?: string | null; product_categories?: { name?: string } | null }): boolean {
    const category = (product.category || product.product_categories?.name || "").toLowerCase();
    const name = (product.name || "").toLowerCase();
    return (
        category.includes("peptide") ||
        name.includes("peptide") ||
        (!category.includes("water") && !name.includes("reconstitution") && !name.includes("bacteriostatic") && !name.includes("bac water"))
    );
}

/**
 * Calculate total volume tier savings and combo bundle savings across cart items
 */
export interface BundleCalculationResult {
    volumeSavings: number;
    pairBundleSavings: number;
    totalSavings: number;
    appliedTiers: {
        variantId: string;
        productName: string;
        quantity: number;
        discountPercentage: number;
        savedAmount: number;
    }[];
    hasPairBundle: boolean;
    bundleSummaryText: string | null;
}

export function calculateBundleAndVolumeSavings(
    items: CartItem[],
    settings: BundleSaveSettings = DEFAULT_BUNDLE_SETTINGS
): BundleCalculationResult {
    if (!settings.enabled || !items || items.length === 0) {
        return {
            volumeSavings: 0,
            pairBundleSavings: 0,
            totalSavings: 0,
            appliedTiers: [],
            hasPairBundle: false,
            bundleSummaryText: null
        };
    }

    let volumeSavings = 0;
    const appliedTiers: BundleCalculationResult["appliedTiers"] = [];

    // 1. Calculate Volume Tier Discounts per item (only on non-bulk items, since bulk has wholesale pricing)
    if (settings.volumeTiers.enabled && settings.volumeTiers.tiers.length > 0) {
        items.forEach(item => {
            if (item.is_bulk || item.variant.bulk_only) return;

            const tier = getVolumeDiscountForQuantity(item.quantity, settings.volumeTiers.tiers);
            if (tier && tier.discountPercentage > 0) {
                const itemBaseTotal = item.variant.price * item.quantity;
                const discount = (itemBaseTotal * tier.discountPercentage) / 100;
                volumeSavings += discount;

                appliedTiers.push({
                    variantId: item.variant.id,
                    productName: item.variant.product.name,
                    quantity: item.quantity,
                    discountPercentage: tier.discountPercentage,
                    savedAmount: Number(discount.toFixed(2))
                });
            }
        });
    }

    // 2. Calculate Frequently Bought Together (Pair & Save) Combo
    let pairBundleSavings = 0;
    let hasPairBundle = false;
    let bundleSummaryText: string | null = null;

    if (settings.frequentlyBoughtTogether.enabled) {
        const hasWater = items.some(item => isWaterProduct(item.variant.product));
        const hasPeptide = items.some(item => isPeptideProduct(item.variant.product));

        if (hasWater && hasPeptide) {
            hasPairBundle = true;
            const fbt = settings.frequentlyBoughtTogether;

            if (fbt.discountType === "percentage") {
                const waterItems = items.filter(item => isWaterProduct(item.variant.product));
                const waterSubtotal = waterItems.reduce((sum, it) => sum + (it.variant.price * it.quantity), 0);
                pairBundleSavings = (waterSubtotal * fbt.discountValue) / 100;
                bundleSummaryText = `Bundle & Save: ${fbt.discountValue}% off Reconstitution Solution`;
            } else {
                pairBundleSavings = fbt.discountValue;
                bundleSummaryText = `Bundle & Save: $${fbt.discountValue.toFixed(2)} off Pair`;
            }
        }
    }

    const totalSavings = Number((volumeSavings + pairBundleSavings).toFixed(2));

    return {
        volumeSavings: Number(volumeSavings.toFixed(2)),
        pairBundleSavings: Number(pairBundleSavings.toFixed(2)),
        totalSavings,
        appliedTiers,
        hasPairBundle,
        bundleSummaryText
    };
}
