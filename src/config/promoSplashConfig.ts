export interface PromoCampaign {
    id: string;
    name: string;
    enabled: boolean;
    triggerPlacement: "entry" | "checkout" | "both";
    priority: number;
    badgeText: string;
    headline: string;
    description: string;

    // Scope Targeting
    targetScope: "all" | "category" | "product";
    targetCategory?: string;
    targetProductId?: string;
    targetProductName?: string;

    // Requirement Threshold
    requirementType: "min_spend" | "min_quantity" | "none";
    minOrderAmount: number; // for min_spend ($ USD)
    minQuantity: number;    // for min_quantity (units)

    // Reward Definition
    offerMode: "gift_with_purchase" | "free_shipping" | "coupon_code";

    // Free Gift Details (when offerMode === "gift_with_purchase")
    rewardProductId?: string;
    rewardProductName?: string;
    rewardProductImage?: string;
    rewardQuantity?: number;

    // Free Shipping Details (when offerMode === "free_shipping")
    shippingCarrierScope?: "all_standard" | "ground_only" | "usps" | "ups" | "fedex";

    // Coupon Details (when offerMode === "coupon_code")
    couponCode?: string;

    // Stacking & Anti-Conflict
    allowStacking: boolean;

    ctaText: string;
    ctaUrl: string;
    dismissText: string;
    syncTopBanner: boolean;
    startDate?: string;
    endDate?: string;
}

export interface PromoSplashSettings {
    enabled: boolean;
    triggerPlacement: "entry" | "checkout" | "both";
    frequency: "once_per_session" | "once_per_day" | "every_visit";
    badgeText: string;
    headline: string;
    description: string;
    minOrderAmount: number;
    offerMode: "gift_with_purchase" | "free_shipping" | "coupon_code";
    couponCode: string;
    ctaText: string;
    ctaUrl: string;
    dismissText: string;
    imageUrl?: string;
    syncTopBanner: boolean;
    campaigns?: PromoCampaign[];
}

export const DEFAULT_PROMO_CAMPAIGN: PromoCampaign = {
    id: "default-reta-gift",
    name: "Weekly Retatrutide 10mg Promotion",
    enabled: true,
    triggerPlacement: "both",
    priority: 10,
    badgeText: "🔥 WEEKLY SPECIAL",
    headline: "Complimentary Reta 10mg with Orders Over $50!",
    description: "For a limited time, receive a free Retatrutide 10mg research vial packed with your order when you spend $50 or more. Elevate your research today.",
    
    // Default targeting & requirement
    targetScope: "all",
    targetCategory: "",
    targetProductId: "",
    targetProductName: "",
    requirementType: "min_spend",
    minOrderAmount: 50,
    minQuantity: 1,

    // Reward
    offerMode: "gift_with_purchase",
    rewardProductId: "",
    rewardProductName: "Retatrutide 10mg Research Vial",
    rewardProductImage: "",
    rewardQuantity: 1,
    shippingCarrierScope: "all_standard",
    couponCode: "",
    allowStacking: true,

    ctaText: "Claim Offer & Shop Now",
    ctaUrl: "/products",
    dismissText: "No thanks, continue shopping",
    syncTopBanner: true,
};

export const DEFAULT_PROMO_SPLASH_SETTINGS: PromoSplashSettings = {
    enabled: true,
    triggerPlacement: "both",
    frequency: "once_per_session",
    badgeText: DEFAULT_PROMO_CAMPAIGN.badgeText,
    headline: DEFAULT_PROMO_CAMPAIGN.headline,
    description: DEFAULT_PROMO_CAMPAIGN.description,
    minOrderAmount: DEFAULT_PROMO_CAMPAIGN.minOrderAmount,
    offerMode: DEFAULT_PROMO_CAMPAIGN.offerMode,
    couponCode: DEFAULT_PROMO_CAMPAIGN.couponCode || "",
    ctaText: DEFAULT_PROMO_CAMPAIGN.ctaText,
    ctaUrl: DEFAULT_PROMO_CAMPAIGN.ctaUrl,
    dismissText: DEFAULT_PROMO_CAMPAIGN.dismissText,
    imageUrl: "",
    syncTopBanner: true,
    campaigns: [DEFAULT_PROMO_CAMPAIGN],
};

export const PROMO_SPLASH_STORAGE_KEYS = {
    SESSION: "vialflow_promo_splash_seen_session",
    DAILY: "vialflow_promo_splash_seen_date",
    DISMISSED_AT: "vialflow_promo_splash_dismissed_at",
} as const;

/**
 * Filter campaigns active for a given placement ("entry" | "checkout" | undefined for any)
 * Sorted by priority descending
 */
export function getActiveCampaigns(
    campaigns: PromoCampaign[] | undefined,
    placement?: "entry" | "checkout"
): PromoCampaign[] {
    if (!campaigns || !Array.isArray(campaigns)) return [];

    const now = new Date();

    return campaigns
        .filter((c) => {
            if (!c.enabled) return false;

            // Date boundary check
            if (c.startDate && new Date(c.startDate) > now) return false;
            if (c.endDate && new Date(c.endDate) < now) return false;

            // Placement check
            if (placement) {
                if (c.triggerPlacement !== "both" && c.triggerPlacement !== placement) {
                    return false;
                }
            }

            return true;
        })
        .sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

/**
 * Helper to check if a visitor should see the splash modal based on frequency setting
 */
export function shouldShowPromoSplash(settings: { frequency?: string; enabled?: boolean }): boolean {
    if (settings.enabled === false) return false;
    if (typeof window === "undefined") return false;

    const frequency = settings.frequency || "once_per_session";

    if (frequency === "every_visit") {
        return true;
    }

    if (frequency === "once_per_session") {
        const seenInSession = sessionStorage.getItem(PROMO_SPLASH_STORAGE_KEYS.SESSION);
        return !seenInSession;
    }

    if (frequency === "once_per_day") {
        const lastSeen = localStorage.getItem(PROMO_SPLASH_STORAGE_KEYS.DAILY);
        if (!lastSeen) return true;

        const lastDate = new Date(lastSeen).toDateString();
        const todayDate = new Date().toDateString();
        return lastDate !== todayDate;
    }

    return true;
}

/**
 * Mark that the visitor has seen or interacted with the promo splash
 */
export function markPromoSplashSeen(settings: { frequency?: string }): void {
    if (typeof window === "undefined") return;

    const frequency = settings.frequency || "once_per_session";

    if (frequency === "once_per_session" || frequency === "both") {
        sessionStorage.setItem(PROMO_SPLASH_STORAGE_KEYS.SESSION, "true");
    }

    if (frequency === "once_per_day") {
        localStorage.setItem(PROMO_SPLASH_STORAGE_KEYS.DAILY, new Date().toISOString());
    }

    localStorage.setItem(PROMO_SPLASH_STORAGE_KEYS.DISMISSED_AT, Date.now().toString());
}

export interface CampaignEvaluationResult {
    campaign: PromoCampaign;
    isEligibleScope: boolean;
    qualifyingSpend: number;
    qualifyingQuantity: number;
    isUnlocked: boolean;
    progressPercent: number;
    remainingAmount: number;
    remainingQuantity: number;
    statusText: string;
    rewardDescription: string;
    isSuppressed?: boolean;
}

/**
 * Evaluates a single campaign against the active cart items.
 */
export function evaluateCampaignForCart(
    campaign: PromoCampaign,
    cartItems: any[]
): CampaignEvaluationResult {
    const scope = campaign.targetScope || "all";
    
    // Filter items based on targeting scope
    const qualifyingItems = (cartItems || []).filter((item) => {
        if (scope === "all") return true;
        if (scope === "category" && campaign.targetCategory) {
            const cat = item.variant?.product?.category || "";
            return cat.toLowerCase() === campaign.targetCategory.toLowerCase();
        }
        if (scope === "product" && campaign.targetProductId) {
            const prodId = item.variant?.product_id || item.variant?.product?.id;
            return prodId === campaign.targetProductId;
        }
        return true;
    });

    const isEligibleScope = scope === "all" ? (cartItems.length > 0) : (qualifyingItems.length > 0);

    const qualifyingQuantity = qualifyingItems.reduce((acc, item) => acc + (item.quantity || 1), 0);

    const qualifyingSpend = qualifyingItems.reduce((acc, item) => {
        const bulkPrice = item.variant?.bulk_price ?? null;
        const labelFee = item.with_labels ? (item.variant?.bulk_label_fee ?? 0.15) : 0;
        const unitPrice = item.is_bulk && bulkPrice !== null 
            ? (bulkPrice + labelFee) 
            : (item.variant?.bulk_only ? ((item.variant?.price || 0) + labelFee) : (item.variant?.price || 0));
        return acc + (unitPrice * (item.quantity || 1));
    }, 0);

    const reqType = campaign.requirementType || "min_spend";
    let isUnlocked = false;
    let remainingAmount = 0;
    let remainingQuantity = 0;
    let progressPercent = 0;
    let statusText = "";

    if (reqType === "min_quantity") {
        const targetQty = Math.max(1, campaign.minQuantity || 1);
        isUnlocked = qualifyingQuantity >= targetQty;
        remainingQuantity = Math.max(0, targetQty - qualifyingQuantity);
        progressPercent = Math.min(100, Math.round((qualifyingQuantity / targetQty) * 100));
        statusText = isUnlocked 
            ? "Unlocked! 🎉" 
            : `Add ${remainingQuantity} more ${remainingQuantity === 1 ? "unit" : "units"}`;
    } else if (reqType === "min_spend") {
        const targetSpend = Math.max(0, campaign.minOrderAmount || 0);
        isUnlocked = qualifyingSpend >= targetSpend;
        remainingAmount = Math.max(0, targetSpend - qualifyingSpend);
        progressPercent = targetSpend > 0 ? Math.min(100, Math.round((qualifyingSpend / targetSpend) * 100)) : 100;
        statusText = isUnlocked 
            ? "Unlocked! 🎉" 
            : `Add $${remainingAmount.toFixed(2)} more`;
    } else {
        // "none" - immediately unlocked if any qualifying items exist
        isUnlocked = isEligibleScope;
        progressPercent = isUnlocked ? 100 : 0;
        statusText = isUnlocked ? "Unlocked! 🎉" : "Add item to unlock";
    }

    let rewardDescription = "";
    if (campaign.offerMode === "gift_with_purchase") {
        rewardDescription = `Free ${campaign.rewardQuantity || 1}x ${campaign.rewardProductName || "Research Gift"}`;
    } else if (campaign.offerMode === "free_shipping") {
        rewardDescription = "Free Standard Shipping";
    } else if (campaign.offerMode === "coupon_code") {
        rewardDescription = campaign.couponCode ? `Code: ${campaign.couponCode}` : "Special Discount";
    }

    return {
        campaign,
        isEligibleScope,
        qualifyingSpend,
        qualifyingQuantity,
        isUnlocked,
        progressPercent,
        remainingAmount,
        remainingQuantity,
        statusText,
        rewardDescription,
    };
}

/**
 * Resolves multiple campaigns with anti-conflict stacking rules.
 * If a non-stackable campaign is unlocked, lower-priority non-stackable offers are suppressed.
 */
export function resolveCartCampaigns(
    campaigns: PromoCampaign[],
    cartItems: any[]
): CampaignEvaluationResult[] {
    const evaluated = campaigns.map(c => evaluateCampaignForCart(c, cartItems));

    // Check if any unlocked campaign forbids stacking
    const nonStackableUnlocked = evaluated.filter(e => e.isUnlocked && e.campaign.allowStacking === false);

    if (nonStackableUnlocked.length > 1) {
        // The highest priority non-stackable wins, others are marked suppressed
        const winningId = nonStackableUnlocked[0].campaign.id;
        return evaluated.map(e => {
            if (e.isUnlocked && e.campaign.allowStacking === false && e.campaign.id !== winningId) {
                return { ...e, isSuppressed: true, statusText: "Exclusive Offer (Cannot stack)" };
            }
            return e;
        });
    }

    return evaluated;
}
