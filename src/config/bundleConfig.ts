import { CartItem } from "@/contexts/CartContext";

export interface VolumeTier {
    id: string;
    minQty: number;
    discountPercentage: number;
    badge: string;
}

export interface FrequentlyBoughtTogetherConfig {
    enabled: boolean;
    pairingMode: "smart" | "manual"; // Switch between Smart (Best Seller) and Manual (Explicit Pairs)
    discountType: "percentage" | "fixed";
    discountValue: number; // e.g. 15 for 15% or 5 for $5.00 off
    headline: string;
    badgeText: string;
    ctaButtonText: string;
    defaultPartnerCategory: string; // e.g. "peptides"
    customPairs?: Record<string, string>; // Map of productId -> partnerProductId
    defaultGlpPartnerId?: string; // Fallback default GLP partner
    defaultResearchPartnerId?: string; // Fallback default Research partner
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
        pairingMode: "smart",
        discountType: "percentage",
        discountValue: 15, // 15% off the combo
        headline: "Synergistic Research Protocol",
        badgeText: "PROTOCOL PAIR • SAVE 15%",
        ctaButtonText: "Add Protocol Pair & Save",
        defaultPartnerCategory: "peptides",
        customPairs: {},
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
export function isWaterProduct(product: { name?: string | null; category?: string | null; slug?: string | null; product_categories?: { name?: string } | null }): boolean {
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
 * Check if a product belongs to the high-priority GLP Peptides group
 * (GLP1-SM, GLP2-TZ, GLP3-RT, Semaglutide, Tirzepatide, Retatrutide, etc.)
 */
export function isGlpProduct(product: { name?: string | null; category?: string | null; slug?: string | null; product_categories?: { name?: string } | null }): boolean {
    const name = (product.name || "").toLowerCase();
    const slug = (product.slug || "").toLowerCase();
    const cat = (product.category || product.product_categories?.name || "").toLowerCase();

    return (
        name.includes("glp") ||
        slug.includes("glp") ||
        name.includes("semaglutide") ||
        slug.includes("semaglutide") ||
        name.includes("tirzepatide") ||
        slug.includes("tirzepatide") ||
        name.includes("retatrutide") ||
        slug.includes("retatrutide") ||
        cat.includes("weight loss")
    );
}

/**
 * Check if an item is a research peptide (non-GLP, non-water, non-bulk)
 * e.g. Wolverine, BPC-157, TB-500, KLOW, NAD+, MOTS-C, etc.
 */
export function isResearchPeptideProduct(product: { name?: string | null; category?: string | null; slug?: string | null; product_categories?: { name?: string } | null }): boolean {
    if (isWaterProduct(product)) return false;
    const name = (product.name || "").toLowerCase();
    if (name.includes("[bulk") || name.includes("bulk order")) return false;
    return !isGlpProduct(product);
}

/**
 * Legacy check: peptide product of any kind
 */
export function isPeptideProduct(product: { name?: string | null; category?: string | null; slug?: string | null; product_categories?: { name?: string } | null }): boolean {
    return isGlpProduct(product) || isResearchPeptideProduct(product);
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

    // 1. Calculate Volume Tier Discounts per item (only on non-bulk items)
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

    // 2. Calculate Frequently Bought Together (Pair & Save) Combo:
    // Pairing is between GLP Peptides (e.g. GLP1-SM) and Synergistic Research Peptides (e.g. Wolverine)
    let pairBundleSavings = 0;
    let hasPairBundle = false;
    let bundleSummaryText: string | null = null;

    if (settings.frequentlyBoughtTogether.enabled) {
        const hasGlp = items.some(item => !item.is_bulk && !item.variant.bulk_only && isGlpProduct(item.variant.product));
        const hasResearch = items.some(item => !item.is_bulk && !item.variant.bulk_only && isResearchPeptideProduct(item.variant.product));

        if (hasGlp && hasResearch) {
            hasPairBundle = true;
            const fbt = settings.frequentlyBoughtTogether;

            // Discount applies to the paired research companion
            const researchItems = items.filter(item => !item.is_bulk && !item.variant.bulk_only && isResearchPeptideProduct(item.variant.product));
            const researchSubtotal = researchItems.reduce((sum, it) => sum + (it.variant.price * it.quantity), 0);

            if (fbt.discountType === "percentage") {
                pairBundleSavings = (researchSubtotal * fbt.discountValue) / 100;
                bundleSummaryText = `Bundle & Save: ${fbt.discountValue}% off Research Companion`;
            } else {
                pairBundleSavings = Math.min(fbt.discountValue, researchSubtotal);
                bundleSummaryText = `Bundle & Save: $${fbt.discountValue.toFixed(2)} off Protocol Pair`;
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
