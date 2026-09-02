import { supabase } from "@/integrations/supabase/client";

const SESSION_STORAGE_KEY = "vialflow_session_id";
const UTM_STORAGE_KEY = "vialflow_utm_params";

export interface UtmParams {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_term?: string;
    utm_content?: string;
    referrer?: string;
}

let memorySessionId: string | null = null;

/**
 * Gets or creates a persistent session ID for the current browser
 * Guaranteed to never throw even in strict private browsing mode
 */
export const getOrCreateSessionId = (): string => {
    if (typeof window === "undefined") return "";

    try {
        let sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
        if (!sessionId) {
            sessionId = "sess_" + Math.random().toString(36).substring(2, 15) + "_" + Date.now().toString(36);
            localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
        }
        return sessionId;
    } catch {
        if (!memorySessionId) {
            memorySessionId = "sess_mem_" + Math.random().toString(36).substring(2, 15) + "_" + Date.now().toString(36);
        }
        return memorySessionId;
    }
};

/**
 * Captures UTM parameters and Referrer on first landing and stores them
 */
export const captureUtmParams = (): UtmParams => {
    if (typeof window === "undefined") return {};

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const utm_source = urlParams.get("utm_source") || undefined;
        const utm_medium = urlParams.get("utm_medium") || undefined;
        const utm_campaign = urlParams.get("utm_campaign") || undefined;
        const utm_term = urlParams.get("utm_term") || undefined;
        const utm_content = urlParams.get("utm_content") || undefined;
        const referrer = document.referrer || undefined;

        // If new UTMs are present, update storage
        if (utm_source || utm_campaign || utm_medium) {
            const currentUtms: UtmParams = {
                utm_source,
                utm_medium,
                utm_campaign,
                utm_term,
                utm_content,
                referrer,
            };
            try {
                localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(currentUtms));
            } catch {}
            return currentUtms;
        }

        // Return previously stored UTMs if any
        const stored = localStorage.getItem(UTM_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.debug("Failed to capture UTM params:", e);
    }

    return {};
};

/**
 * Track a checkout funnel step (100% non-blocking)
 */
export const trackFunnelStep = async (
    step: "cart_view" | "begin_checkout" | "address_entered" | "shipping_selected" | "payment_selected" | "payment_attempted" | "payment_failed" | "order_completed" | string,
    metadata: Record<string, any> = {},
    cartSessionId?: string | null
) => {
    try {
        const sessionId = getOrCreateSessionId();
        const { data: { session } } = await supabase.auth.getSession();

        // Non-blocking asynchronous insert
        await supabase
            .from("checkout_funnel_events" as any)
            .insert({
                session_id: sessionId,
                cart_session_id: cartSessionId || null,
                user_id: session?.user?.id || null,
                step,
                metadata,
            });
    } catch (err) {
        // Silently catch to never break client execution
        console.debug("Funnel event tracking debug:", err);
    }
};

/**
 * Track a generic analytics/behavior event (100% non-blocking)
 */
export const trackAnalyticsEvent = async (
    eventName: "product_view" | "product_search" | "coa_view" | "coupon_applied" | "category_filter" | "category_view" | string,
    metadata: Record<string, any> = {},
    itemId?: string | null
) => {
    try {
        const sessionId = getOrCreateSessionId();
        const { data: { session } } = await supabase.auth.getSession();

        await supabase
            .from("analytics_events" as any)
            .insert({
                session_id: sessionId,
                user_id: session?.user?.id || null,
                event_name: eventName,
                item_id: itemId || null,
                metadata,
            });
    } catch (err) {
        console.debug("Analytics event tracking debug:", err);
    }
};
