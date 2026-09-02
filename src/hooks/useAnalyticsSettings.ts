import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AnalyticsSettings, DEFAULT_ANALYTICS_SETTINGS } from "@/config/analyticsSettingsConfig";

export const ANALYTICS_SETTINGS_QUERY_KEY = ["app_settings", "analytics_and_recovery"];

export const useAnalyticsSettings = () => {
    return useQuery<AnalyticsSettings>({
        queryKey: ANALYTICS_SETTINGS_QUERY_KEY,
        queryFn: async () => {
            try {
                const { data, error } = await supabase
                    .from("app_settings" as any)
                    .select("key, value")
                    .in("key", [
                        "abandoned_cart_tracking_enabled",
                        "abandoned_cart_threshold_minutes",
                        "guest_cart_tracking_enabled",
                        "early_contact_capture_enabled",
                        "cart_retention_days",
                        "auto_recovery_emails_enabled",
                        "recovery_email_1_delay_hours",
                        "recovery_email_2_delay_hours",
                        "recovery_email_3_delay_hours",
                        "recovery_discount_enabled",
                        "recovery_discount_coupon_code",
                        "recovery_discount_percentage",
                        "recovery_email_subject",
                        "recovery_email_custom_message",
                        "funnel_tracking_enabled",
                        "product_view_tracking_enabled",
                        "utm_attribution_tracking_enabled",
                        "exclude_admin_from_analytics",
                        "admin_alert_high_value_abandonment",
                        "high_value_abandonment_threshold",
                        "analytics_admin_notification_email",
                    ]);

                if (error) {
                    console.warn("Failed to fetch analytics settings, using defaults:", error);
                    return DEFAULT_ANALYTICS_SETTINGS;
                }

                if (!data || data.length === 0) {
                    return DEFAULT_ANALYTICS_SETTINGS;
                }

                const map = new Map<string, string>();
                data.forEach((row: any) => {
                    map.set(row.key, row.value);
                });

                return {
                    abandonedCartTrackingEnabled: map.has("abandoned_cart_tracking_enabled")
                        ? map.get("abandoned_cart_tracking_enabled") === "true"
                        : DEFAULT_ANALYTICS_SETTINGS.abandonedCartTrackingEnabled,
                    abandonedCartThresholdMinutes: Number(map.get("abandoned_cart_threshold_minutes")) || DEFAULT_ANALYTICS_SETTINGS.abandonedCartThresholdMinutes,
                    guestCartTrackingEnabled: map.has("guest_cart_tracking_enabled")
                        ? map.get("guest_cart_tracking_enabled") === "true"
                        : DEFAULT_ANALYTICS_SETTINGS.guestCartTrackingEnabled,
                    earlyContactCaptureEnabled: map.has("early_contact_capture_enabled")
                        ? map.get("early_contact_capture_enabled") === "true"
                        : DEFAULT_ANALYTICS_SETTINGS.earlyContactCaptureEnabled,
                    cartRetentionDays: Number(map.get("cart_retention_days")) || DEFAULT_ANALYTICS_SETTINGS.cartRetentionDays,

                    autoRecoveryEmailsEnabled: map.has("auto_recovery_emails_enabled")
                        ? map.get("auto_recovery_emails_enabled") === "true"
                        : DEFAULT_ANALYTICS_SETTINGS.autoRecoveryEmailsEnabled,
                    recoveryEmail1DelayHours: Number(map.get("recovery_email_1_delay_hours")) || DEFAULT_ANALYTICS_SETTINGS.recoveryEmail1DelayHours,
                    recoveryEmail2DelayHours: Number(map.get("recovery_email_2_delay_hours")) || DEFAULT_ANALYTICS_SETTINGS.recoveryEmail2DelayHours,
                    recoveryEmail3DelayHours: Number(map.get("recovery_email_3_delay_hours")) || DEFAULT_ANALYTICS_SETTINGS.recoveryEmail3DelayHours,
                    recoveryDiscountEnabled: map.has("recovery_discount_enabled")
                        ? map.get("recovery_discount_enabled") === "true"
                        : DEFAULT_ANALYTICS_SETTINGS.recoveryDiscountEnabled,
                    recoveryDiscountCouponCode: map.get("recovery_discount_coupon_code") || DEFAULT_ANALYTICS_SETTINGS.recoveryDiscountCouponCode,
                    recoveryDiscountPercentage: Number(map.get("recovery_discount_percentage")) || DEFAULT_ANALYTICS_SETTINGS.recoveryDiscountPercentage,
                    recoveryEmailSubject: map.get("recovery_email_subject") || DEFAULT_ANALYTICS_SETTINGS.recoveryEmailSubject,
                    recoveryEmailCustomMessage: map.get("recovery_email_custom_message") || DEFAULT_ANALYTICS_SETTINGS.recoveryEmailCustomMessage,

                    funnelTrackingEnabled: map.has("funnel_tracking_enabled")
                        ? map.get("funnel_tracking_enabled") === "true"
                        : DEFAULT_ANALYTICS_SETTINGS.funnelTrackingEnabled,
                    productViewTrackingEnabled: map.has("product_view_tracking_enabled")
                        ? map.get("product_view_tracking_enabled") === "true"
                        : DEFAULT_ANALYTICS_SETTINGS.productViewTrackingEnabled,
                    utmAttributionTrackingEnabled: map.has("utm_attribution_tracking_enabled")
                        ? map.get("utm_attribution_tracking_enabled") === "true"
                        : DEFAULT_ANALYTICS_SETTINGS.utmAttributionTrackingEnabled,
                    excludeAdminFromAnalytics: map.has("exclude_admin_from_analytics")
                        ? map.get("exclude_admin_from_analytics") === "true"
                        : DEFAULT_ANALYTICS_SETTINGS.excludeAdminFromAnalytics,

                    adminAlertHighValueAbandonment: map.has("admin_alert_high_value_abandonment")
                        ? map.get("admin_alert_high_value_abandonment") === "true"
                        : DEFAULT_ANALYTICS_SETTINGS.adminAlertHighValueAbandonment,
                    highValueAbandonmentThreshold: Number(map.get("high_value_abandonment_threshold")) || DEFAULT_ANALYTICS_SETTINGS.highValueAbandonmentThreshold,
                    analyticsAdminNotificationEmail: map.get("analytics_admin_notification_email") || DEFAULT_ANALYTICS_SETTINGS.analyticsAdminNotificationEmail,
                };
            } catch (err) {
                console.error("Error reading analytics settings from Supabase:", err);
                return DEFAULT_ANALYTICS_SETTINGS;
            }
        },
        staleTime: 1000 * 60 * 5, // 5 minutes cache
    });
};
