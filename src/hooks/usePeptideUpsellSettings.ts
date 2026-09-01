import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
    DEFAULT_PEPTIDE_UPSELL_SETTINGS, 
    PeptideUpsellSettings 
} from "@/config/upsellConfig";

export function usePeptideUpsellSettings() {
    return useQuery<PeptideUpsellSettings>({
        queryKey: ["peptide-upsell-settings"],
        staleTime: 60000,
        queryFn: async () => {
            const { data } = await supabase
                .from("app_settings" as any)
                .select("key, value")
                .in("key", [
                    "peptide_upsell_enabled",
                    "peptide_upsell_type",
                    "peptide_upsell_discount_value",
                    "peptide_upsell_min_spend",
                    "peptide_upsell_max_free_units",
                    "peptide_upsell_featured_ids",
                    "peptide_upsell_headline",
                    "peptide_upsell_subtitle",
                    "peptide_upsell_badge_text",
                    "peptide_upsell_cta_text",
                    "peptide_upsell_decline_text"
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

            return {
                enabled: map.peptide_upsell_enabled !== undefined 
                    ? map.peptide_upsell_enabled === "true" 
                    : DEFAULT_PEPTIDE_UPSELL_SETTINGS.enabled,
                offerType: (map.peptide_upsell_type as any) || DEFAULT_PEPTIDE_UPSELL_SETTINGS.offerType,
                discountValue: map.peptide_upsell_discount_value 
                    ? parseFloat(map.peptide_upsell_discount_value) 
                    : DEFAULT_PEPTIDE_UPSELL_SETTINGS.discountValue,
                minPeptideSpend: map.peptide_upsell_min_spend 
                    ? parseFloat(map.peptide_upsell_min_spend) 
                    : DEFAULT_PEPTIDE_UPSELL_SETTINGS.minPeptideSpend,
                maxFreeWaterUnits: map.peptide_upsell_max_free_units 
                    ? Math.max(1, parseInt(map.peptide_upsell_max_free_units)) 
                    : DEFAULT_PEPTIDE_UPSELL_SETTINGS.maxFreeWaterUnits,
                featuredProductIds: map.peptide_upsell_featured_ids 
                    ? JSON.parse(map.peptide_upsell_featured_ids) 
                    : DEFAULT_PEPTIDE_UPSELL_SETTINGS.featuredProductIds,
                headline: cleanStr(map.peptide_upsell_headline, DEFAULT_PEPTIDE_UPSELL_SETTINGS.headline),
                subtitle: cleanStr(map.peptide_upsell_subtitle, DEFAULT_PEPTIDE_UPSELL_SETTINGS.subtitle),
                badgeText: cleanStr(map.peptide_upsell_badge_text, DEFAULT_PEPTIDE_UPSELL_SETTINGS.badgeText),
                ctaButtonText: cleanStr(map.peptide_upsell_cta_text, DEFAULT_PEPTIDE_UPSELL_SETTINGS.ctaButtonText),
                declineButtonText: cleanStr(map.peptide_upsell_decline_text, DEFAULT_PEPTIDE_UPSELL_SETTINGS.declineButtonText),
            };
        }
    });
}
