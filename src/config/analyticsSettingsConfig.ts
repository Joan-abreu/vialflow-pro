export interface AnalyticsSettings {
    // Abandoned Cart & Tracking Controls
    abandonedCartTrackingEnabled: boolean;
    abandonedCartThresholdMinutes: number;
    guestCartTrackingEnabled: boolean;
    earlyContactCaptureEnabled: boolean;
    cartRetentionDays: number;

    // Automated Recovery Email Settings
    autoRecoveryEmailsEnabled: boolean;
    recoveryEmail1DelayHours: number;
    recoveryEmail2DelayHours: number;
    recoveryEmail3DelayHours: number;
    recoveryDiscountEnabled: boolean;
    recoveryDiscountCouponCode: string;
    recoveryDiscountPercentage: number;
    recoveryEmailSubject: string;
    recoveryEmailCustomMessage: string;

    // Behavioral & Funnel Tracking Controls
    funnelTrackingEnabled: boolean;
    productViewTrackingEnabled: boolean;
    utmAttributionTrackingEnabled: boolean;
    excludeAdminFromAnalytics: boolean;

    // Admin Alerts
    adminAlertHighValueAbandonment: boolean;
    highValueAbandonmentThreshold: number;
    analyticsAdminNotificationEmail: string;
}

export const DEFAULT_ANALYTICS_SETTINGS: AnalyticsSettings = {
    abandonedCartTrackingEnabled: true,
    abandonedCartThresholdMinutes: 60,
    guestCartTrackingEnabled: true,
    earlyContactCaptureEnabled: true,
    cartRetentionDays: 30,

    autoRecoveryEmailsEnabled: false,
    recoveryEmail1DelayHours: 1,
    recoveryEmail2DelayHours: 24,
    recoveryEmail3DelayHours: 72,
    recoveryDiscountEnabled: false,
    recoveryDiscountCouponCode: "COMEBACK10",
    recoveryDiscountPercentage: 10,
    recoveryEmailSubject: "Did you forget something in your cart?",
    recoveryEmailCustomMessage: "We saved the items in your cart so you can easily complete your order whenever you are ready.",

    funnelTrackingEnabled: true,
    productViewTrackingEnabled: true,
    utmAttributionTrackingEnabled: true,
    excludeAdminFromAnalytics: true,

    adminAlertHighValueAbandonment: true,
    highValueAbandonmentThreshold: 300,
    analyticsAdminNotificationEmail: "",
};
