import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
    DEFAULT_PROMO_SPLASH_SETTINGS, 
    DEFAULT_PROMO_CAMPAIGN,
    PromoSplashSettings,
    PromoCampaign 
} from "@/config/promoSplashConfig";

export function usePromoSplashSettings() {
    return useQuery<PromoSplashSettings>({
        queryKey: ["promo-splash-settings"],
        staleTime: 60000,
        queryFn: async () => {
            const { data } = await supabase
                .from("app_settings" as any)
                .select("key, value")
                .in("key", [
                    "promo_campaigns",
                    "promo_splash_enabled",
                    "promo_splash_trigger_placement",
                    "promo_splash_frequency",
                    "promo_splash_badge_text",
                    "promo_splash_headline",
                    "promo_splash_description",
                    "promo_splash_min_order_amount",
                    "promo_splash_offer_mode",
                    "promo_splash_coupon_code",
                    "promo_splash_cta_text",
                    "promo_splash_cta_url",
                    "promo_splash_dismiss_text",
                    "promo_splash_image_url",
                    "promo_splash_sync_top_banner"
                ]);

            const map: Record<string, string> = {};
            if (data && Array.isArray(data)) {
                data.forEach((item: any) => {
                    if (item.key && item.value !== undefined) {
                        map[item.key] = item.value;
                    }
                });
            }

            const cleanStr = (val: string | undefined, fallback: string) => {
                return (val && val.trim().length > 0) ? val.trim() : fallback;
            };

            // Parse campaigns JSON if present
            let parsedCampaigns: PromoCampaign[] | null = null;
            if (map.promo_campaigns) {
                try {
                    const parsed = JSON.parse(map.promo_campaigns);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        parsedCampaigns = parsed;
                    }
                } catch (e) {
                    console.error("Failed to parse promo_campaigns JSON:", e);
                }
            }

            // If no parsed campaigns exist yet, construct from existing single settings
            if (!parsedCampaigns || parsedCampaigns.length === 0) {
                const legacyCampaign: PromoCampaign = {
                    id: "migrated-default-campaign",
                    name: "Primary Promotion",
                    enabled: map.promo_splash_enabled !== undefined
                        ? map.promo_splash_enabled === "true"
                        : DEFAULT_PROMO_SPLASH_SETTINGS.enabled,
                    triggerPlacement: (map.promo_splash_trigger_placement as any) || DEFAULT_PROMO_SPLASH_SETTINGS.triggerPlacement,
                    priority: 10,
                    badgeText: cleanStr(map.promo_splash_badge_text, DEFAULT_PROMO_SPLASH_SETTINGS.badgeText),
                    headline: cleanStr(map.promo_splash_headline, DEFAULT_PROMO_SPLASH_SETTINGS.headline),
                    description: cleanStr(map.promo_splash_description, DEFAULT_PROMO_SPLASH_SETTINGS.description),
                    minOrderAmount: map.promo_splash_min_order_amount
                        ? Number(map.promo_splash_min_order_amount)
                        : DEFAULT_PROMO_SPLASH_SETTINGS.minOrderAmount,
                    offerMode: (map.promo_splash_offer_mode as any) || DEFAULT_PROMO_SPLASH_SETTINGS.offerMode,
                    couponCode: cleanStr(map.promo_splash_coupon_code, DEFAULT_PROMO_SPLASH_SETTINGS.couponCode),
                    ctaText: cleanStr(map.promo_splash_cta_text, DEFAULT_PROMO_SPLASH_SETTINGS.ctaText),
                    ctaUrl: cleanStr(map.promo_splash_cta_url, DEFAULT_PROMO_SPLASH_SETTINGS.ctaUrl),
                    dismissText: cleanStr(map.promo_splash_dismiss_text, DEFAULT_PROMO_SPLASH_SETTINGS.dismissText),
                    syncTopBanner: map.promo_splash_sync_top_banner !== undefined
                        ? map.promo_splash_sync_top_banner === "true"
                        : DEFAULT_PROMO_SPLASH_SETTINGS.syncTopBanner,
                };
                parsedCampaigns = [legacyCampaign];
            }

            // Top active campaign for fallback compatibility
            const primaryCampaign = parsedCampaigns.find(c => c.enabled) || parsedCampaigns[0] || DEFAULT_PROMO_CAMPAIGN;

            return {
                enabled: parsedCampaigns.some(c => c.enabled),
                triggerPlacement: primaryCampaign.triggerPlacement,
                frequency: (map.promo_splash_frequency as any) || DEFAULT_PROMO_SPLASH_SETTINGS.frequency,
                badgeText: primaryCampaign.badgeText,
                headline: primaryCampaign.headline,
                description: primaryCampaign.description,
                minOrderAmount: primaryCampaign.minOrderAmount,
                offerMode: primaryCampaign.offerMode,
                couponCode: primaryCampaign.couponCode || "",
                ctaText: primaryCampaign.ctaText,
                ctaUrl: primaryCampaign.ctaUrl,
                dismissText: primaryCampaign.dismissText,
                imageUrl: cleanStr(map.promo_splash_image_url, DEFAULT_PROMO_SPLASH_SETTINGS.imageUrl || ""),
                syncTopBanner: primaryCampaign.syncTopBanner,
                campaigns: parsedCampaigns,
            };
        }
    });
}
