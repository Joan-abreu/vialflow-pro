import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
    DEFAULT_BUNDLE_SETTINGS, 
    BundleSaveSettings 
} from "@/config/bundleConfig";

export const BUNDLE_SETTINGS_QUERY_KEY = ["bundle-save-settings"];

export function useBundleSettings() {
    return useQuery<BundleSaveSettings>({
        queryKey: BUNDLE_SETTINGS_QUERY_KEY,
        staleTime: 60000,
        queryFn: async () => {
            try {
                const { data, error } = await supabase
                    .from("app_settings" as any)
                    .select("key, value")
                    .eq("key", "bundle_save_settings")
                    .maybeSingle();

                if (error) {
                    console.warn("[useBundleSettings] Error loading settings:", error);
                    return DEFAULT_BUNDLE_SETTINGS;
                }

                if (data && data.value) {
                    const parsed = JSON.parse(data.value);
                    return {
                        enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_BUNDLE_SETTINGS.enabled,
                        frequentlyBoughtTogether: {
                            ...DEFAULT_BUNDLE_SETTINGS.frequentlyBoughtTogether,
                            ...(parsed.frequentlyBoughtTogether || {})
                        },
                        volumeTiers: {
                            ...DEFAULT_BUNDLE_SETTINGS.volumeTiers,
                            ...(parsed.volumeTiers || {})
                        }
                    };
                }
            } catch (err) {
                console.warn("[useBundleSettings] Exception parsing bundle settings:", err);
            }

            return DEFAULT_BUNDLE_SETTINGS;
        }
    });
}
