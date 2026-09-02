import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Settings, Truck, Clock, Save, ShieldCheck, CreditCard, CheckSquare, Square, RefreshCw, Zap, AlertCircle, UploadCloud, X, Trash2, Image as ImageIcon, Eye, EyeOff, Copy, Check, Gift, Sparkles, BarChart3, ShoppingCart, MailCheck, MousePointerClick, Timer, BellRing } from "lucide-react";

import { DEFAULT_SHIPPING_CONFIG, PaymentMethodKey } from "@/config/shippingConfig";
import { DEFAULT_PAYMENT_SETTINGS, PaymentGatewayProvider } from "@/config/paymentGateways";
import { DEFAULT_PEPTIDE_UPSELL_SETTINGS } from "@/config/upsellConfig";
import { DEFAULT_ANALYTICS_SETTINGS } from "@/config/analyticsSettingsConfig";
import { ANALYTICS_SETTINGS_QUERY_KEY } from "@/hooks/useAnalyticsSettings";
import { Textarea } from "@/components/ui/textarea";

const TIMEZONES = [
    { value: "America/New_York", label: "Eastern Time (ET / New York)" },
    { value: "America/Chicago", label: "Central Time (CT / Chicago)" },
    { value: "America/Denver", label: "Mountain Time (MT / Denver)" },
    { value: "America/Los_Angeles", label: "Pacific Time (PT / Los Angeles)" },
    { value: "America/Anchorage", label: "Alaska Time (AKT)" },
    { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
];

const AVAILABLE_PAYMENT_METHODS: { id: PaymentMethodKey; label: string; sublabel: string; color: string }[] = [
    { id: "visa", label: "Visa", sublabel: "Credit / Debit Cards", color: "text-[#1A1F71] dark:text-blue-400 font-bold" },
    { id: "mastercard", label: "Mastercard", sublabel: "Credit / Debit Cards", color: "text-[#EB001B] dark:text-red-400 font-bold" },
    { id: "amex", label: "American Express (AMEX)", sublabel: "Credit Cards", color: "text-[#006FCF] dark:text-sky-400 font-black" },
    { id: "discover", label: "Discover", sublabel: "Credit Cards", color: "text-[#FF6000] font-bold" },
    { id: "apple_pay", label: "Apple Pay", sublabel: "Mobile Wallet", color: "text-foreground font-semibold" },
    { id: "google_pay", label: "Google Pay", sublabel: "Mobile Wallet", color: "text-blue-600 dark:text-blue-400 font-semibold" },
    { id: "zelle", label: "Zelle", sublabel: "Direct Bank Transfer", color: "text-purple-600 dark:text-purple-400 font-bold" },
    { id: "cashapp", label: "Cash App", sublabel: "Direct P2P", color: "text-emerald-600 dark:text-emerald-400 font-bold" },
    { id: "venmo", label: "Venmo", sublabel: "Direct P2P", color: "text-sky-500 font-bold" },
    { id: "crypto", label: "Bitcoin / Crypto", sublabel: "BTC, ETH, USDT", color: "text-amber-600 dark:text-amber-400 font-bold" },
];

const SiteSettings = () => {
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(true);
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [requireResearchAck, setRequireResearchAck] = useState(false);
    const [requireLoginForCheckout, setRequireLoginForCheckout] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingResearchAck, setSavingResearchAck] = useState(false);
    const [savingRequireLogin, setSavingRequireLogin] = useState(false);
    const [savingShipping, setSavingShipping] = useState(false);
    const [savingGateways, setSavingGateways] = useState(false);
    const [savingInventorySettings, setSavingInventorySettings] = useState(false);
    const [savingPeptideUpsell, setSavingPeptideUpsell] = useState(false);
    const [savingAnalytics, setSavingAnalytics] = useState(false);

    // E-Commerce Analytics & Abandoned Cart Recovery Settings
    const [abandonedCartTrackingEnabled, setAbandonedCartTrackingEnabled] = useState(DEFAULT_ANALYTICS_SETTINGS.abandonedCartTrackingEnabled);
    const [abandonedCartThresholdMinutes, setAbandonedCartThresholdMinutes] = useState(DEFAULT_ANALYTICS_SETTINGS.abandonedCartThresholdMinutes);
    const [guestCartTrackingEnabled, setGuestCartTrackingEnabled] = useState(DEFAULT_ANALYTICS_SETTINGS.guestCartTrackingEnabled);
    const [earlyContactCaptureEnabled, setEarlyContactCaptureEnabled] = useState(DEFAULT_ANALYTICS_SETTINGS.earlyContactCaptureEnabled);
    const [cartRetentionDays, setCartRetentionDays] = useState(DEFAULT_ANALYTICS_SETTINGS.cartRetentionDays);

    const [autoRecoveryEmailsEnabled, setAutoRecoveryEmailsEnabled] = useState(DEFAULT_ANALYTICS_SETTINGS.autoRecoveryEmailsEnabled);
    const [recoveryEmail1DelayHours, setRecoveryEmail1DelayHours] = useState(DEFAULT_ANALYTICS_SETTINGS.recoveryEmail1DelayHours);
    const [recoveryEmail2DelayHours, setRecoveryEmail2DelayHours] = useState(DEFAULT_ANALYTICS_SETTINGS.recoveryEmail2DelayHours);
    const [recoveryEmail3DelayHours, setRecoveryEmail3DelayHours] = useState(DEFAULT_ANALYTICS_SETTINGS.recoveryEmail3DelayHours);
    const [recoveryDiscountEnabled, setRecoveryDiscountEnabled] = useState(DEFAULT_ANALYTICS_SETTINGS.recoveryDiscountEnabled);
    const [recoveryDiscountCouponCode, setRecoveryDiscountCouponCode] = useState(DEFAULT_ANALYTICS_SETTINGS.recoveryDiscountCouponCode);
    const [recoveryDiscountPercentage, setRecoveryDiscountPercentage] = useState(DEFAULT_ANALYTICS_SETTINGS.recoveryDiscountPercentage);
    const [recoveryEmailSubject, setRecoveryEmailSubject] = useState(DEFAULT_ANALYTICS_SETTINGS.recoveryEmailSubject);
    const [recoveryEmailCustomMessage, setRecoveryEmailCustomMessage] = useState(DEFAULT_ANALYTICS_SETTINGS.recoveryEmailCustomMessage);

    const [funnelTrackingEnabled, setFunnelTrackingEnabled] = useState(DEFAULT_ANALYTICS_SETTINGS.funnelTrackingEnabled);
    const [productViewTrackingEnabled, setProductViewTrackingEnabled] = useState(DEFAULT_ANALYTICS_SETTINGS.productViewTrackingEnabled);
    const [utmAttributionTrackingEnabled, setUtmAttributionTrackingEnabled] = useState(DEFAULT_ANALYTICS_SETTINGS.utmAttributionTrackingEnabled);
    const [excludeAdminFromAnalytics, setExcludeAdminFromAnalytics] = useState(DEFAULT_ANALYTICS_SETTINGS.excludeAdminFromAnalytics);

    const [adminAlertHighValueAbandonment, setAdminAlertHighValueAbandonment] = useState(DEFAULT_ANALYTICS_SETTINGS.adminAlertHighValueAbandonment);
    const [highValueAbandonmentThreshold, setHighValueAbandonmentThreshold] = useState(DEFAULT_ANALYTICS_SETTINGS.highValueAbandonmentThreshold);
    const [analyticsAdminNotificationEmail, setAnalyticsAdminNotificationEmail] = useState(DEFAULT_ANALYTICS_SETTINGS.analyticsAdminNotificationEmail);

    // Pre-Checkout Peptide Cross-Sell & Upsell Settings
    const [peptideUpsellEnabled, setPeptideUpsellEnabled] = useState(DEFAULT_PEPTIDE_UPSELL_SETTINGS.enabled);
    const [peptideUpsellType, setPeptideUpsellType] = useState<"free_water" | "percentage_discount" | "fixed_discount">(DEFAULT_PEPTIDE_UPSELL_SETTINGS.offerType);
    const [peptideUpsellDiscountValue, setPeptideUpsellDiscountValue] = useState(DEFAULT_PEPTIDE_UPSELL_SETTINGS.discountValue);
    const [peptideUpsellMinSpend, setPeptideUpsellMinSpend] = useState(DEFAULT_PEPTIDE_UPSELL_SETTINGS.minPeptideSpend);
    const [peptideUpsellMaxFreeUnits, setPeptideUpsellMaxFreeUnits] = useState(DEFAULT_PEPTIDE_UPSELL_SETTINGS.maxFreeWaterUnits);
    const [peptideUpsellHeadline, setPeptideUpsellHeadline] = useState(DEFAULT_PEPTIDE_UPSELL_SETTINGS.headline);
    const [peptideUpsellSubtitle, setPeptideUpsellSubtitle] = useState(DEFAULT_PEPTIDE_UPSELL_SETTINGS.subtitle);
    const [peptideUpsellBadgeText, setPeptideUpsellBadgeText] = useState(DEFAULT_PEPTIDE_UPSELL_SETTINGS.badgeText);
    const [peptideUpsellCtaText, setPeptideUpsellCtaText] = useState(DEFAULT_PEPTIDE_UPSELL_SETTINGS.ctaButtonText);
    const [peptideUpsellDeclineText, setPeptideUpsellDeclineText] = useState(DEFAULT_PEPTIDE_UPSELL_SETTINGS.declineButtonText);

    // Inventory & Restock System Settings
    const [enableStrictStockEnforcement, setEnableStrictStockEnforcement] = useState(true);
    const [enableRestockNotifications, setEnableRestockNotifications] = useState(true);
    const [restockLeadTimeDays, setRestockLeadTimeDays] = useState(14);
    const [restockDiscountPercent, setRestockDiscountPercent] = useState(40);
    const [restockCouponCode, setRestockCouponCode] = useState("RESTOCK40");

    // Shipping & Cutoff Settings
    const [cutoffHour, setCutoffHour] = useState<number>(DEFAULT_SHIPPING_CONFIG.cutoffHour);
    const [cutoffMinute, setCutoffMinute] = useState<number>(DEFAULT_SHIPPING_CONFIG.cutoffMinute);
    const [timeZone, setTimeZone] = useState<string>(DEFAULT_SHIPPING_CONFIG.timeZone);
    const [cutoffDisplayLabel, setCutoffDisplayLabel] = useState<string>(DEFAULT_SHIPPING_CONFIG.cutoffDisplayLabel);
    const [freeShippingThreshold, setFreeShippingThreshold] = useState<number>(DEFAULT_SHIPPING_CONFIG.freeShippingThreshold);
    const [deliveryMinDays, setDeliveryMinDays] = useState<number>(DEFAULT_SHIPPING_CONFIG.estimatedDeliveryDays.min);
    const [deliveryMaxDays, setDeliveryMaxDays] = useState<number>(DEFAULT_SHIPPING_CONFIG.estimatedDeliveryDays.max);
    const [shipsSaturday, setShipsSaturday] = useState<boolean>(DEFAULT_SHIPPING_CONFIG.shipsOnSaturday);
    const [acceptedPaymentMethods, setAcceptedPaymentMethods] = useState<PaymentMethodKey[]>(DEFAULT_SHIPPING_CONFIG.acceptedPaymentMethods);

    // Payment Processors & Failover Settings
    const [activeGateway, setActiveGateway] = useState<PaymentGatewayProvider>(DEFAULT_PAYMENT_SETTINGS.activeProvider);
    const [backupGateway, setBackupGateway] = useState<PaymentGatewayProvider>(DEFAULT_PAYMENT_SETTINGS.backupProvider);
    const [autoFailover, setAutoFailover] = useState<boolean>(DEFAULT_PAYMENT_SETTINGS.autoFailoverEnabled);
    const [failThreshold, setFailThreshold] = useState<number>(DEFAULT_PAYMENT_SETTINGS.failThreshold);
    const [squareAppId, setSquareAppId] = useState<string>(DEFAULT_PAYMENT_SETTINGS.square.appId);
    const [squareLocationId, setSquareLocationId] = useState<string>(DEFAULT_PAYMENT_SETTINGS.square.locationId);
    const [squareEnv, setSquareEnv] = useState<"sandbox" | "production">(DEFAULT_PAYMENT_SETTINGS.square.environment);
    const [stripePublishableKey, setStripePublishableKey] = useState<string>(DEFAULT_PAYMENT_SETTINGS.stripe.publishableKey);
    const [authNetApiLoginId, setAuthNetApiLoginId] = useState<string>(DEFAULT_PAYMENT_SETTINGS.authorizenet.apiLoginId);
    const [authNetClientKey, setAuthNetClientKey] = useState<string>(DEFAULT_PAYMENT_SETTINGS.authorizenet.clientKey);
    const [authNetEnv, setAuthNetEnv] = useState<"sandbox" | "production">(DEFAULT_PAYMENT_SETTINGS.authorizenet.environment);
    const [cloverMerchantId, setCloverMerchantId] = useState<string>(DEFAULT_PAYMENT_SETTINGS.clover.merchantId);
    const [cloverApiToken, setCloverApiToken] = useState<string>(DEFAULT_PAYMENT_SETTINGS.clover.apiToken);
    const [cloverEnv, setCloverEnv] = useState<"sandbox" | "production">(DEFAULT_PAYMENT_SETTINGS.clover.environment);
    const [nmiSecurityKey, setNmiSecurityKey] = useState<string>(DEFAULT_PAYMENT_SETTINGS.nmi.securityKey);
    const [nmiTokenKey, setNmiTokenKey] = useState<string>(DEFAULT_PAYMENT_SETTINGS.nmi.tokenizationKey);
    const [paypalClientId, setPaypalClientId] = useState<string>(DEFAULT_PAYMENT_SETTINGS.paypal.clientId);
    const [paypalEnv, setPaypalEnv] = useState<"sandbox" | "production">(DEFAULT_PAYMENT_SETTINGS.paypal.environment);
    const [tagadaStoreId, setTagadaStoreId] = useState<string>(DEFAULT_PAYMENT_SETTINGS.tagadapay.storeId);
    const [tagadaPaymentFlowId, setTagadaPaymentFlowId] = useState<string>(DEFAULT_PAYMENT_SETTINGS.tagadapay.paymentFlowId || "");
    const [tagadaApiKey, setTagadaApiKey] = useState<string>("");
    const [showTagadaApiKey, setShowTagadaApiKey] = useState<boolean>(false);
    const [copiedApiKey, setCopiedApiKey] = useState<boolean>(false);
    const [tagadaEnv, setTagadaEnv] = useState<"sandbox" | "production">(DEFAULT_PAYMENT_SETTINGS.tagadapay.environment);
    const [zelleEnabled, setZelleEnabled] = useState<boolean>(DEFAULT_PAYMENT_SETTINGS.p2p.zelle.enabled ?? true);
    const [zelleEmail, setZelleEmail] = useState<string>(DEFAULT_PAYMENT_SETTINGS.manual.zelleEmail || "");
    const [zelleName, setZelleName] = useState<string>(DEFAULT_PAYMENT_SETTINGS.manual.zelleName || "");
    const [zelleQrUrl, setZelleQrUrl] = useState<string>(DEFAULT_PAYMENT_SETTINGS.p2p.zelle.qrCodeUrl || "");
    const [venmoEnabled, setVenmoEnabled] = useState<boolean>(DEFAULT_PAYMENT_SETTINGS.p2p.venmo.enabled ?? true);
    const [cashAppTag, setCashAppTag] = useState<string>(DEFAULT_PAYMENT_SETTINGS.manual.cashAppTag || "");
    const [cashAppQrUrl, setCashAppQrUrl] = useState<string>(DEFAULT_PAYMENT_SETTINGS.p2p.cashapp.qrCodeUrl || "");
    const [cashAppEnabled, setCashAppEnabled] = useState<boolean>(DEFAULT_PAYMENT_SETTINGS.p2p.cashapp.enabled ?? true);
    const [venmoUser, setVenmoUser] = useState<string>(DEFAULT_PAYMENT_SETTINGS.manual.venmoUser || "@livholdinggroupinc");
    const [venmoQrUrl, setVenmoQrUrl] = useState<string>(DEFAULT_PAYMENT_SETTINGS.p2p.venmo.qrCodeUrl || "");
    const [manualInstructions, setManualInstructions] = useState<string>(DEFAULT_PAYMENT_SETTINGS.manual.instructions || "");
    const [uploadingQr, setUploadingQr] = useState<string | null>(null);
    const [isSyncingTagada, setIsSyncingTagada] = useState(false);
    const [tagadaSyncResult, setTagadaSyncResult] = useState<any>(null);

    const handleSyncTagadaProducts = async () => {
        if (!tagadaStoreId) {
            toast.error("Please configure and save a Store ID first.");
            return;
        }

        setIsSyncingTagada(true);
        setTagadaSyncResult(null);

        try {
            const { data, error } = await supabase.functions.invoke("sync-tagada-products", {
                body: {
                    storeId: tagadaStoreId,
                    apiKey: tagadaApiKey || undefined,
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            setTagadaSyncResult(data);
            toast.success(`Successfully synced ${data.successful || 0} of ${data.totalProducts || 0} products to Tagada CRM!`);
        } catch (err: any) {
            console.error("Sync error:", err);
            toast.error(err.message || "Failed to sync products with Tagada CRM");
        } finally {
            setIsSyncingTagada(false);
        }
    };

    const [isRegisteringWebhook, setIsRegisteringWebhook] = useState(false);

    const handleRegisterTagadaWebhook = async () => {
        if (!tagadaStoreId) {
            toast.error("Please configure and save a Store ID first.");
            return;
        }

        setIsRegisteringWebhook(true);

        try {
            const { data, error } = await supabase.functions.invoke("sync-tagada-products", {
                body: {
                    action: "register_webhook",
                    storeId: tagadaStoreId,
                    apiKey: tagadaApiKey || undefined,
                }
            });

            if (data?.error || data?.success === false) {
                throw new Error(data.error || "Failed to register webhook");
            }

            if (error) {
                let msg = error.message;
                try {
                    const ctx = await error.context?.json();
                    if (ctx?.error) msg = ctx.error;
                } catch (_) {}
                throw new Error(msg);
            }

            toast.success(data?.message || "Webhook successfully registered in TagadaPay!");
        } catch (err: any) {
            console.error("Webhook registration error:", err);
            toast.error(err.message || "Failed to register webhook in TagadaPay");
        } finally {
            setIsRegisteringWebhook(false);
        }
    };


    const handleQrImageUpload = async (provider: "zelle" | "venmo" | "cashapp", file: File) => {
        if (!file) return;
        setUploadingQr(provider);
        try {
            const ext = file.name.split('.').pop() || 'png';
            const fileName = `${provider}_qr_${Date.now()}.${ext}`;
            const { error: uploadErr } = await supabase.storage
                .from("p2p-qr-codes")
                .upload(fileName, file, { upsert: true });

            if (uploadErr) throw uploadErr;

            const { data } = supabase.storage
                .from("p2p-qr-codes")
                .getPublicUrl(fileName);

            if (data?.publicUrl) {
                if (provider === "zelle") setZelleQrUrl(data.publicUrl);
                else if (provider === "venmo") setVenmoQrUrl(data.publicUrl);
                else if (provider === "cashapp") setCashAppQrUrl(data.publicUrl);
                toast.success(`${provider.toUpperCase()} QR Code image uploaded!`);
            }
        } catch (err: any) {
            console.error("Error uploading QR code:", err);
            toast.error(err.message || "Failed to upload QR Code image.");
        } finally {
            setUploadingQr(null);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from("app_settings" as any)
                .select("*")
                .in("key", [

                    "maintenance_mode", 
                    "require_research_acknowledgment",
                    "require_login_for_checkout",
                    "shipping_cutoff_hour",
                    "shipping_cutoff_minute",
                    "shipping_timezone",
                    "shipping_cutoff_label",
                    "shipping_free_threshold",
                    "shipping_delivery_min_days",
                    "shipping_delivery_max_days",
                    "shipping_ships_saturday",
                    "shipping_payment_methods",
                    "payment_active_provider",
                    "payment_backup_provider",
                    "payment_auto_failover",
                    "payment_fail_threshold",
                    "payment_square_config",
                    "payment_stripe_config",
                    "payment_authorizenet_config",
                    "payment_clover_config",
                    "payment_nmi_config",
                    "payment_paypal_config",
                    "payment_tagadapay_config",
                    "payment_manual_config",
                    "enable_strict_stock_enforcement",
                    "enable_restock_notifications",
                    "restock_lead_time_days",
                    "restock_discount_percent",
                    "restock_coupon_code",
                    "peptide_upsell_enabled",
                    "peptide_upsell_type",
                    "peptide_upsell_discount_value",
                    "peptide_upsell_min_spend",
                    "peptide_upsell_max_free_units",
                    "peptide_upsell_headline",
                    "peptide_upsell_subtitle",
                    "peptide_upsell_badge_text",
                    "peptide_upsell_cta_text",
                    "peptide_upsell_decline_text",
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
                    "analytics_admin_notification_email"
                ]);

            if (error) throw error;

            if (data) {
                // Analytics & Abandoned Cart Recovery
                const cartTrack = data.find((s: any) => s.key === "abandoned_cart_tracking_enabled");
                const cartThresh = data.find((s: any) => s.key === "abandoned_cart_threshold_minutes");
                const guestTrack = data.find((s: any) => s.key === "guest_cart_tracking_enabled");
                const earlyCapture = data.find((s: any) => s.key === "early_contact_capture_enabled");
                const cartRet = data.find((s: any) => s.key === "cart_retention_days");

                const autoRecovery = data.find((s: any) => s.key === "auto_recovery_emails_enabled");
                const delay1 = data.find((s: any) => s.key === "recovery_email_1_delay_hours");
                const delay2 = data.find((s: any) => s.key === "recovery_email_2_delay_hours");
                const delay3 = data.find((s: any) => s.key === "recovery_email_3_delay_hours");
                const recDisc = data.find((s: any) => s.key === "recovery_discount_enabled");
                const recCode = data.find((s: any) => s.key === "recovery_discount_coupon_code");
                const recPct = data.find((s: any) => s.key === "recovery_discount_percentage");
                const recSubj = data.find((s: any) => s.key === "recovery_email_subject");
                const recMsg = data.find((s: any) => s.key === "recovery_email_custom_message");

                const funTrack = data.find((s: any) => s.key === "funnel_tracking_enabled");
                const prodView = data.find((s: any) => s.key === "product_view_tracking_enabled");
                const utmTrack = data.find((s: any) => s.key === "utm_attribution_tracking_enabled");
                const exclAdmin = data.find((s: any) => s.key === "exclude_admin_from_analytics");

                const highAlert = data.find((s: any) => s.key === "admin_alert_high_value_abandonment");
                const highThresh = data.find((s: any) => s.key === "high_value_abandonment_threshold");
                const adminEmail = data.find((s: any) => s.key === "analytics_admin_notification_email");

                if (cartTrack) setAbandonedCartTrackingEnabled(cartTrack.value === "true");
                if (cartThresh) setAbandonedCartThresholdMinutes(Number(cartThresh.value) || DEFAULT_ANALYTICS_SETTINGS.abandonedCartThresholdMinutes);
                if (guestTrack) setGuestCartTrackingEnabled(guestTrack.value === "true");
                if (earlyCapture) setEarlyContactCaptureEnabled(earlyCapture.value === "true");
                if (cartRet) setCartRetentionDays(Number(cartRet.value) || DEFAULT_ANALYTICS_SETTINGS.cartRetentionDays);

                if (autoRecovery) setAutoRecoveryEmailsEnabled(autoRecovery.value === "true");
                if (delay1) setRecoveryEmail1DelayHours(Number(delay1.value) || DEFAULT_ANALYTICS_SETTINGS.recoveryEmail1DelayHours);
                if (delay2) setRecoveryEmail2DelayHours(Number(delay2.value) || DEFAULT_ANALYTICS_SETTINGS.recoveryEmail2DelayHours);
                if (delay3) setRecoveryEmail3DelayHours(Number(delay3.value) || DEFAULT_ANALYTICS_SETTINGS.recoveryEmail3DelayHours);
                if (recDisc) setRecoveryDiscountEnabled(recDisc.value === "true");
                if (recCode) setRecoveryDiscountCouponCode(recCode.value || DEFAULT_ANALYTICS_SETTINGS.recoveryDiscountCouponCode);
                if (recPct) setRecoveryDiscountPercentage(Number(recPct.value) || DEFAULT_ANALYTICS_SETTINGS.recoveryDiscountPercentage);
                if (recSubj) setRecoveryEmailSubject(recSubj.value || DEFAULT_ANALYTICS_SETTINGS.recoveryEmailSubject);
                if (recMsg) setRecoveryEmailCustomMessage(recMsg.value || DEFAULT_ANALYTICS_SETTINGS.recoveryEmailCustomMessage);

                if (funTrack) setFunnelTrackingEnabled(funTrack.value === "true");
                if (prodView) setProductViewTrackingEnabled(prodView.value === "true");
                if (utmTrack) setUtmAttributionTrackingEnabled(utmTrack.value === "true");
                if (exclAdmin) setExcludeAdminFromAnalytics(exclAdmin.value === "true");

                if (highAlert) setAdminAlertHighValueAbandonment(highAlert.value === "true");
                if (highThresh) setHighValueAbandonmentThreshold(Number(highThresh.value) || DEFAULT_ANALYTICS_SETTINGS.highValueAbandonmentThreshold);
                if (adminEmail) setAnalyticsAdminNotificationEmail(adminEmail.value || "");

                const pUpsellEnabled = data.find((s: any) => s.key === "peptide_upsell_enabled");
                const pUpsellType = data.find((s: any) => s.key === "peptide_upsell_type");
                const pUpsellDiscount = data.find((s: any) => s.key === "peptide_upsell_discount_value");
                const pUpsellMinSpend = data.find((s: any) => s.key === "peptide_upsell_min_spend");
                const pUpsellMaxFree = data.find((s: any) => s.key === "peptide_upsell_max_free_units");
                const pUpsellHeadline = data.find((s: any) => s.key === "peptide_upsell_headline");
                const pUpsellSubtitle = data.find((s: any) => s.key === "peptide_upsell_subtitle");
                const pUpsellBadge = data.find((s: any) => s.key === "peptide_upsell_badge_text");
                const pUpsellCta = data.find((s: any) => s.key === "peptide_upsell_cta_text");
                const pUpsellDecline = data.find((s: any) => s.key === "peptide_upsell_decline_text");

                if (pUpsellEnabled) setPeptideUpsellEnabled(pUpsellEnabled.value === "true");
                if (pUpsellType) setPeptideUpsellType(pUpsellType.value as any);
                if (pUpsellDiscount) setPeptideUpsellDiscountValue(Number(pUpsellDiscount.value) || DEFAULT_PEPTIDE_UPSELL_SETTINGS.discountValue);
                if (pUpsellMinSpend) setPeptideUpsellMinSpend(Number(pUpsellMinSpend.value) || DEFAULT_PEPTIDE_UPSELL_SETTINGS.minPeptideSpend);
                if (pUpsellMaxFree) setPeptideUpsellMaxFreeUnits(Number(pUpsellMaxFree.value) || DEFAULT_PEPTIDE_UPSELL_SETTINGS.maxFreeWaterUnits);
                if (pUpsellHeadline) setPeptideUpsellHeadline(pUpsellHeadline.value);
                if (pUpsellSubtitle) setPeptideUpsellSubtitle(pUpsellSubtitle.value);
                if (pUpsellBadge) setPeptideUpsellBadgeText(pUpsellBadge.value);
                if (pUpsellCta) setPeptideUpsellCtaText(pUpsellCta.value);
                if (pUpsellDecline) setPeptideUpsellDeclineText(pUpsellDecline.value);

                const strictStock = data.find((s: any) => s.key === "enable_strict_stock_enforcement");
                const restockNotify = data.find((s: any) => s.key === "enable_restock_notifications");
                const leadTime = data.find((s: any) => s.key === "restock_lead_time_days");
                const discount = data.find((s: any) => s.key === "restock_discount_percent");
                const coupon = data.find((s: any) => s.key === "restock_coupon_code");

                if (strictStock) setEnableStrictStockEnforcement(strictStock.value === "true");
                if (restockNotify) setEnableRestockNotifications(restockNotify.value === "true");
                if (leadTime) setRestockLeadTimeDays(Number(leadTime.value) || 14);
                if (discount) setRestockDiscountPercent(Number(discount.value) || 40);
                if (coupon) setRestockCouponCode(coupon.value || "RESTOCK40");
                const researchAck = data.find((s: any) => s.key === "require_research_acknowledgment");
                const requireLogin = data.find((s: any) => s.key === "require_login_for_checkout");
                const hour = data.find((s: any) => s.key === "shipping_cutoff_hour");
                const min = data.find((s: any) => s.key === "shipping_cutoff_minute");
                const tz = data.find((s: any) => s.key === "shipping_timezone");
                const label = data.find((s: any) => s.key === "shipping_cutoff_label");
                const threshold = data.find((s: any) => s.key === "shipping_free_threshold");
                const minDays = data.find((s: any) => s.key === "shipping_delivery_min_days");
                const maxDays = data.find((s: any) => s.key === "shipping_delivery_max_days");
                const sat = data.find((s: any) => s.key === "shipping_ships_saturday");
                const pm = data.find((s: any) => s.key === "shipping_payment_methods");

                // Gateways
                const activeP = data.find((s: any) => s.key === "payment_active_provider");
                const backupP = data.find((s: any) => s.key === "payment_backup_provider");
                const autoFail = data.find((s: any) => s.key === "payment_auto_failover");
                const failT = data.find((s: any) => s.key === "payment_fail_threshold");
                const squareCfg = data.find((s: any) => s.key === "payment_square_config");
                const stripeCfg = data.find((s: any) => s.key === "payment_stripe_config");
                const authNetCfg = data.find((s: any) => s.key === "payment_authorizenet_config");
                const cloverCfg = data.find((s: any) => s.key === "payment_clover_config");
                const nmiCfg = data.find((s: any) => s.key === "payment_nmi_config");
                const paypalCfg = data.find((s: any) => s.key === "payment_paypal_config");
                const tagadaCfg = data.find((s: any) => s.key === "payment_tagadapay_config");
                const manualCfg = data.find((s: any) => s.key === "payment_manual_config");

                if (maintenance) setMaintenanceMode(maintenance.value === "true");
                if (researchAck) setRequireResearchAck(researchAck.value === "true");
                if (requireLogin) setRequireLoginForCheckout(requireLogin.value === "true");
                if (hour) setCutoffHour(Number(hour.value));
                if (min) setCutoffMinute(Number(min.value));
                if (tz) setTimeZone(tz.value);
                if (label) setCutoffDisplayLabel(label.value);
                if (threshold) setFreeShippingThreshold(Number(threshold.value));
                if (minDays) setDeliveryMinDays(Number(minDays.value));
                if (maxDays) setDeliveryMaxDays(Number(maxDays.value));
                if (sat) setShipsSaturday(sat.value === "true");
                if (pm && pm.value) {
                    try {
                        const parsed = JSON.parse(pm.value);
                        if (Array.isArray(parsed)) {
                            setAcceptedPaymentMethods(parsed);
                        }
                    } catch (e) {
                        console.warn("Error parsing payment methods from DB:", e);
                    }
                }

                if (activeP) setActiveGateway(activeP.value as PaymentGatewayProvider);
                if (backupP) setBackupGateway(backupP.value as PaymentGatewayProvider);
                if (autoFail) setAutoFailover(autoFail.value === "true");
                if (failT) setFailThreshold(Number(failT.value));

                if (squareCfg?.value) {
                    try {
                        const sq = JSON.parse(squareCfg.value);
                        if (sq.appId) setSquareAppId(sq.appId);
                        if (sq.locationId) setSquareLocationId(sq.locationId);
                        if (sq.environment) setSquareEnv(sq.environment);
                    } catch (e) {}
                }

                if (stripeCfg?.value) {
                    try {
                        const st = JSON.parse(stripeCfg.value);
                        if (st.publishableKey) setStripePublishableKey(st.publishableKey);
                    } catch (e) {}
                }

                if (authNetCfg?.value) {
                    try {
                        const an = JSON.parse(authNetCfg.value);
                        if (an.apiLoginId) setAuthNetApiLoginId(an.apiLoginId);
                        if (an.clientKey) setAuthNetClientKey(an.clientKey);
                        if (an.environment) setAuthNetEnv(an.environment);
                    } catch (e) {}
                }

                if (cloverCfg?.value) {
                    try {
                        const cl = JSON.parse(cloverCfg.value);
                        if (cl.merchantId) setCloverMerchantId(cl.merchantId);
                        if (cl.apiToken) setCloverApiToken(cl.apiToken);
                        if (cl.environment) setCloverEnv(cl.environment);
                    } catch (e) {}
                }

                if (nmiCfg?.value) {
                    try {
                        const nm = JSON.parse(nmiCfg.value);
                        if (nm.securityKey) setNmiSecurityKey(nm.securityKey);
                        if (nm.tokenizationKey) setNmiTokenKey(nm.tokenizationKey);
                    } catch (e) {}
                }

                if (paypalCfg?.value) {
                    try {
                        const pp = JSON.parse(paypalCfg.value);
                        if (pp.clientId) setPaypalClientId(pp.clientId);
                        if (pp.environment) setPaypalEnv(pp.environment);
                    } catch (e) {}
                }

                if (tagadaCfg?.value) {
                    try {
                        const tg = JSON.parse(tagadaCfg.value);
                        if (tg.storeId) setTagadaStoreId(tg.storeId);
                        if (tg.paymentFlowId !== undefined) setTagadaPaymentFlowId(tg.paymentFlowId);
                        if (tg.apiKey) setTagadaApiKey(tg.apiKey);
                        if (tg.environment) setTagadaEnv(tg.environment);
                    } catch (e) {}
                }

                if (manualCfg?.value) {
                    try {
                        const mn = JSON.parse(manualCfg.value);
                        if (typeof mn.zelleEnabled === "boolean") setZelleEnabled(mn.zelleEnabled);
                        if (mn.zelleEmail) setZelleEmail(mn.zelleEmail);
                        if (mn.zelleName) setZelleName(mn.zelleName);
                        if (mn.zelleQrUrl) setZelleQrUrl(mn.zelleQrUrl);
                        if (typeof mn.venmoEnabled === "boolean") setVenmoEnabled(mn.venmoEnabled);
                        if (mn.venmoUser) setVenmoUser(mn.venmoUser);
                        if (mn.venmoQrUrl) setVenmoQrUrl(mn.venmoQrUrl);
                        if (typeof mn.cashAppEnabled === "boolean") setCashAppEnabled(mn.cashAppEnabled);
                        if (mn.cashAppTag) setCashAppTag(mn.cashAppTag);
                        if (mn.cashAppQrUrl) setCashAppQrUrl(mn.cashAppQrUrl);
                        if (mn.instructions) setManualInstructions(mn.instructions);
                    } catch (e) {}
                }

            }
        } catch (error: any) {
            console.error("Error fetching settings:", error);
            toast.error("Failed to load site settings");
        } finally {
            setLoading(false);
        }
    };

    const handleMaintenanceToggle = async (checked: boolean) => {
        setMaintenanceMode(checked);
        setSaving(true);

        try {
            const { error } = await supabase
                .from("app_settings" as any)
                .upsert({
                    key: "maintenance_mode",
                    value: String(checked),
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            toast.success(`Maintenance mode ${checked ? "enabled" : "disabled"}`);
        } catch (error: any) {
            console.error("Error saving settings:", error);
            toast.error("Failed to save settings");
            setMaintenanceMode(!checked); // Revert UI on error
        } finally {
            setSaving(false);
        }
    };

    const handleResearchAckToggle = async (checked: boolean) => {
        setRequireResearchAck(checked);
        setSavingResearchAck(true);

        try {
            const { error } = await supabase
                .from("app_settings" as any)
                .upsert({
                    key: "require_research_acknowledgment",
                    value: String(checked),
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            toast.success(`Research acknowledgment requirement ${checked ? "enabled" : "disabled"}`);
        } catch (error: any) {
            console.error("Error saving settings:", error);
            toast.error("Failed to save settings");
            setRequireResearchAck(!checked); // Revert UI on error
        } finally {
            setSavingResearchAck(false);
        }
    };

    const handleRequireLoginToggle = async (checked: boolean) => {
        setRequireLoginForCheckout(checked);
        setSavingRequireLogin(true);

        try {
            const { error } = await supabase
                .from("app_settings" as any)
                .upsert({
                    key: "require_login_for_checkout",
                    value: String(checked),
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            toast.success(`Checkout login requirement ${checked ? "enabled" : "disabled"}`);
        } catch (error: any) {
            console.error("Error saving settings:", error);
            toast.error("Failed to save settings");
            setRequireLoginForCheckout(!checked); // Revert UI on error
        } finally {
            setSavingRequireLogin(false);
        }
    };

    const updateAutoCutoffLabel = (hour: number, minute: number, tz: string) => {
        const isPM = hour >= 12;
        const displayH = hour % 12 === 0 ? 12 : hour % 12;
        const displayM = minute > 0 ? `:${String(minute).padStart(2, '0')}` : ':00';
        const ampm = isPM ? 'PM' : 'AM';
        
        let tzCode = 'ET';
        if (tz.includes('Central')) tzCode = 'CT';
        else if (tz.includes('Mountain') || tz.includes('Phoenix')) tzCode = 'MT';
        else if (tz.includes('Los_Angeles')) tzCode = 'PT';
        
        setCutoffDisplayLabel(`${displayH}${displayM} ${ampm} ${tzCode}`);
    };

    const handleTogglePaymentMethod = (methodId: PaymentMethodKey) => {
        setAcceptedPaymentMethods(prev => {
            if (prev.includes(methodId)) {
                return prev.filter(m => m !== methodId);
            } else {
                return [...prev, methodId];
            }
        });
    };

    const handleSelectAllPayments = () => {
        setAcceptedPaymentMethods(AVAILABLE_PAYMENT_METHODS.map(m => m.id));
    };

    const handleSelectDefaultCards = () => {
        setAcceptedPaymentMethods(["visa", "mastercard", "amex", "discover", "apple_pay", "google_pay"]);
    };

    const handleClearAllPayments = () => {
        setAcceptedPaymentMethods([]);
    };

    const handleSaveGateways = async () => {
        setSavingGateways(true);
        const now = new Date().toISOString();

        try {
            const squareConfig = JSON.stringify({
                appId: squareAppId,
                locationId: squareLocationId,
                environment: squareEnv
            });

            const stripeConfig = JSON.stringify({
                publishableKey: stripePublishableKey
            });

            const authNetConfig = JSON.stringify({
                apiLoginId: authNetApiLoginId,
                clientKey: authNetClientKey,
                environment: authNetEnv
            });

            const cloverConfig = JSON.stringify({
                merchantId: cloverMerchantId,
                apiToken: cloverApiToken,
                environment: cloverEnv
            });

            const nmiConfig = JSON.stringify({
                securityKey: nmiSecurityKey,
                tokenizationKey: nmiTokenKey
            });

            const paypalConfig = JSON.stringify({
                clientId: paypalClientId,
                environment: paypalEnv
            });

            const tagadapayConfig = JSON.stringify({
                storeId: tagadaStoreId,
                paymentFlowId: tagadaPaymentFlowId,
                apiKey: tagadaApiKey,
                environment: tagadaEnv
            });

            const manualConfig = JSON.stringify({
                zelleEnabled,
                zelleEmail,
                zelleName,
                zelleQrUrl,
                venmoEnabled,
                venmoUser,
                venmoQrUrl,
                cashAppEnabled,
                cashAppTag,
                cashAppQrUrl,
                instructions: manualInstructions
            });

            const p2pConfig = JSON.stringify({
                enabled: zelleEnabled || venmoEnabled || cashAppEnabled,
                verificationSlaHours: 24,
                maxProofResubmissions: 2,
                maxP2POrderAmount: 2500,
                zelle: { enabled: zelleEnabled, qrCodeUrl: zelleQrUrl, handle: zelleEmail, recipientName: zelleName, instructions: manualInstructions },
                venmo: { enabled: venmoEnabled, qrCodeUrl: venmoQrUrl, handle: venmoUser, recipientName: "Liv Holding Group Inc", instructions: manualInstructions },
                cashapp: { enabled: cashAppEnabled, qrCodeUrl: cashAppQrUrl, handle: cashAppTag, recipientName: "Liv Well Labs", instructions: manualInstructions }
            });


            const updates = [
                { key: "payment_active_provider", value: activeGateway, updated_at: now },
                { key: "payment_backup_provider", value: backupGateway, updated_at: now },
                { key: "payment_auto_failover", value: String(autoFailover), updated_at: now },
                { key: "payment_fail_threshold", value: String(failThreshold), updated_at: now },
                { key: "payment_square_config", value: squareConfig, updated_at: now },
                { key: "payment_stripe_config", value: stripeConfig, updated_at: now },
                { key: "payment_authorizenet_config", value: authNetConfig, updated_at: now },
                { key: "payment_clover_config", value: cloverConfig, updated_at: now },
                { key: "payment_nmi_config", value: nmiConfig, updated_at: now },
                { key: "payment_paypal_config", value: paypalConfig, updated_at: now },
                { key: "payment_tagadapay_config", value: tagadapayConfig, updated_at: now },
                { key: "payment_manual_config", value: manualConfig, updated_at: now },
                { key: "payment_p2p_config", value: p2pConfig, updated_at: now },

            ];

            for (const item of updates) {
                const { error } = await supabase
                    .from("app_settings" as any)
                    .upsert(item);
                if (error) throw error;
            }

            toast.success("Online Payment Processors & Failover settings saved successfully!");
        } catch (error: any) {
            console.error("Error saving payment gateway settings:", error);
            toast.error("Failed to save payment processor settings");
        } finally {
            setSavingGateways(false);
        }
    };

    const handleSaveShippingSettings = async () => {
        setSavingShipping(true);
        const now = new Date().toISOString();

        try {
            const updates = [
                { key: "shipping_cutoff_hour", value: String(cutoffHour), updated_at: now },
                { key: "shipping_cutoff_minute", value: String(cutoffMinute), updated_at: now },
                { key: "shipping_timezone", value: timeZone, updated_at: now },
                { key: "shipping_cutoff_label", value: cutoffDisplayLabel, updated_at: now },
                { key: "shipping_free_threshold", value: String(freeShippingThreshold), updated_at: now },
                { key: "shipping_delivery_min_days", value: String(deliveryMinDays), updated_at: now },
                { key: "shipping_delivery_max_days", value: String(deliveryMaxDays), updated_at: now },
                { key: "shipping_ships_saturday", value: String(shipsSaturday), updated_at: now },
                { key: "shipping_payment_methods", value: JSON.stringify(acceptedPaymentMethods), updated_at: now },
            ];

            for (const item of updates) {
                const { error } = await supabase
                    .from("app_settings" as any)
                    .upsert(item);
                if (error) throw error;
            }

            // Invalidate cache so all storefront badges update instantly
            queryClient.invalidateQueries({ queryKey: ['shipping_app_settings'] });

            toast.success("Shipping & Payment settings saved successfully!");
        } catch (error: any) {
            console.error("Error saving shipping settings:", error);
            toast.error("Failed to save shipping settings");
        } finally {
            setSavingShipping(false);
        }
    };

    const handleSaveInventorySettings = async () => {
        setSavingInventorySettings(true);
        const now = new Date().toISOString();
        const cleanCode = restockCouponCode.trim().toUpperCase();

        try {
            const updates = [
                { key: "enable_strict_stock_enforcement", value: String(enableStrictStockEnforcement), updated_at: now },
                { key: "enable_restock_notifications", value: String(enableRestockNotifications), updated_at: now },
                { key: "restock_lead_time_days", value: String(restockLeadTimeDays), updated_at: now },
                { key: "restock_discount_percent", value: String(restockDiscountPercent), updated_at: now },
                { key: "restock_coupon_code", value: cleanCode, updated_at: now },
            ];

            for (const item of updates) {
                const { error } = await supabase
                    .from("app_settings" as any)
                    .upsert(item);
                if (error) throw error;
            }

            // Ensure Restock Coupon exists in coupons table
            if (cleanCode) {
                const { data: existingCoupon } = await supabase
                    .from("coupons")
                    .select("id")
                    .eq("code", cleanCode)
                    .maybeSingle();

                if (!existingCoupon) {
                    await supabase.from("coupons").insert({
                        code: cleanCode,
                        type: "percentage",
                        value: Number(restockDiscountPercent),
                        is_active: true,
                        max_uses: 1000,
                        times_used: 0,
                        one_use_per_user: true,
                        target: "all"
                    });
                } else {
                    await supabase
                        .from("coupons")
                        .update({
                            value: Number(restockDiscountPercent),
                            is_active: true,
                            one_use_per_user: true
                        })
                        .eq("id", existingCoupon.id);
                }
            }

            queryClient.invalidateQueries({ queryKey: ['coupons'] });
            toast.success(`Inventory & Restock settings saved successfully! Coupon ${cleanCode} (${restockDiscountPercent}% OFF) is active.`);
        } catch (error: any) {
            console.error("Error saving inventory settings:", error);
            toast.error("Failed to save inventory settings");
        } finally {
            setSavingInventorySettings(false);
        }
    };

    const handleSavePeptideUpsellSettings = async () => {
        setSavingPeptideUpsell(true);
        const now = new Date().toISOString();

        try {
            const updates = [
                { key: "peptide_upsell_enabled", value: String(peptideUpsellEnabled), updated_at: now },
                { key: "peptide_upsell_type", value: peptideUpsellType, updated_at: now },
                { key: "peptide_upsell_discount_value", value: String(peptideUpsellDiscountValue), updated_at: now },
                { key: "peptide_upsell_min_spend", value: String(peptideUpsellMinSpend), updated_at: now },
                { key: "peptide_upsell_max_free_units", value: String(peptideUpsellMaxFreeUnits), updated_at: now },
                { key: "peptide_upsell_headline", value: peptideUpsellHeadline, updated_at: now },
                { key: "peptide_upsell_subtitle", value: peptideUpsellSubtitle, updated_at: now },
                { key: "peptide_upsell_badge_text", value: peptideUpsellBadgeText, updated_at: now },
                { key: "peptide_upsell_cta_text", value: peptideUpsellCtaText, updated_at: now },
                { key: "peptide_upsell_decline_text", value: peptideUpsellDeclineText, updated_at: now },
            ];

            for (const item of updates) {
                const { error } = await supabase
                    .from("app_settings" as any)
                    .upsert(item);
                if (error) throw error;
            }

            queryClient.invalidateQueries({ queryKey: ['peptide-upsell-settings'] });
            toast.success("Peptide Cross-Sell & Upsell settings saved successfully!");
        } catch (error: any) {
            console.error("Error saving peptide upsell settings:", error);
            toast.error("Failed to save peptide upsell settings");
        } finally {
            setSavingPeptideUpsell(false);
        }
    };

    const handleSaveAnalyticsSettings = async () => {
        setSavingAnalytics(true);
        const now = new Date().toISOString();
        const cleanCoupon = recoveryDiscountCouponCode.trim().toUpperCase();

        try {
            const updates = [
                { key: "abandoned_cart_tracking_enabled", value: String(abandonedCartTrackingEnabled), updated_at: now },
                { key: "abandoned_cart_threshold_minutes", value: String(abandonedCartThresholdMinutes), updated_at: now },
                { key: "guest_cart_tracking_enabled", value: String(guestCartTrackingEnabled), updated_at: now },
                { key: "early_contact_capture_enabled", value: String(earlyContactCaptureEnabled), updated_at: now },
                { key: "cart_retention_days", value: String(cartRetentionDays), updated_at: now },
                { key: "auto_recovery_emails_enabled", value: String(autoRecoveryEmailsEnabled), updated_at: now },
                { key: "recovery_email_1_delay_hours", value: String(recoveryEmail1DelayHours), updated_at: now },
                { key: "recovery_email_2_delay_hours", value: String(recoveryEmail2DelayHours), updated_at: now },
                { key: "recovery_email_3_delay_hours", value: String(recoveryEmail3DelayHours), updated_at: now },
                { key: "recovery_discount_enabled", value: String(recoveryDiscountEnabled), updated_at: now },
                { key: "recovery_discount_coupon_code", value: cleanCoupon, updated_at: now },
                { key: "recovery_discount_percentage", value: String(recoveryDiscountPercentage), updated_at: now },
                { key: "recovery_email_subject", value: recoveryEmailSubject, updated_at: now },
                { key: "recovery_email_custom_message", value: recoveryEmailCustomMessage, updated_at: now },
                { key: "funnel_tracking_enabled", value: String(funnelTrackingEnabled), updated_at: now },
                { key: "product_view_tracking_enabled", value: String(productViewTrackingEnabled), updated_at: now },
                { key: "utm_attribution_tracking_enabled", value: String(utmAttributionTrackingEnabled), updated_at: now },
                { key: "exclude_admin_from_analytics", value: String(excludeAdminFromAnalytics), updated_at: now },
                { key: "admin_alert_high_value_abandonment", value: String(adminAlertHighValueAbandonment), updated_at: now },
                { key: "high_value_abandonment_threshold", value: String(highValueAbandonmentThreshold), updated_at: now },
                { key: "analytics_admin_notification_email", value: analyticsAdminNotificationEmail.trim(), updated_at: now },
            ];

            for (const item of updates) {
                const { error } = await supabase
                    .from("app_settings" as any)
                    .upsert(item);
                if (error) throw error;
            }

            // If recovery discount is enabled, ensure coupon exists
            if (recoveryDiscountEnabled && cleanCoupon) {
                const { data: existingCoupon } = await supabase
                    .from("coupons")
                    .select("id")
                    .eq("code", cleanCoupon)
                    .maybeSingle();

                if (!existingCoupon) {
                    await supabase.from("coupons").insert({
                        code: cleanCoupon,
                        type: "percentage",
                        value: Number(recoveryDiscountPercentage),
                        is_active: true,
                        max_uses: 5000,
                        times_used: 0,
                        one_use_per_user: true,
                        target: "all"
                    });
                } else {
                    await supabase
                        .from("coupons")
                        .update({
                            value: Number(recoveryDiscountPercentage),
                            is_active: true,
                        })
                        .eq("id", existingCoupon.id);
                }
                queryClient.invalidateQueries({ queryKey: ['coupons'] });
            }

            queryClient.invalidateQueries({ queryKey: ANALYTICS_SETTINGS_QUERY_KEY });
            toast.success("Analytics & Abandoned Cart Recovery settings saved successfully!");
        } catch (error: any) {
            console.error("Error saving analytics settings:", error);
            toast.error("Failed to save analytics settings");
        } finally {
            setSavingAnalytics(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 max-w-5xl">
            <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
                <Settings className="h-8 w-8 text-primary" />
                Site Settings
            </h1>

            <div className="space-y-8">
                {/* 1. Maintenance Mode */}
                <Card>
                    <CardHeader>
                        <CardTitle>Global Access Controls</CardTitle>
                        <CardDescription>
                            Manage public access to the website.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between space-x-4 rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <Label className="text-base">Maintenance Mode</Label>
                                <p className="text-sm text-muted-foreground">
                                    When enabled, public visitors will see a maintenance page. <br />
                                    <strong>Admin users can still access the Manufacture Dashboard and login page.</strong>
                                </p>
                            </div>
                            <Switch
                                checked={maintenanceMode}
                                onCheckedChange={handleMaintenanceToggle}
                                disabled={saving}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Storefront Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle>Storefront Compliance</CardTitle>
                        <CardDescription>
                            Configure customer compliance and legal acknowledgment requirements.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between space-x-4 rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <Label className="text-base">Require Research Acknowledgment</Label>
                                <p className="text-sm text-muted-foreground">
                                    When enabled, customers must acknowledge that products are for laboratory research use only (RUO) and agree to the Terms & Conditions before proceeding to checkout and submitting payment.
                                </p>
                            </div>
                            <Switch
                                checked={requireResearchAck}
                                onCheckedChange={handleResearchAckToggle}
                                disabled={savingResearchAck}
                            />
                        </div>

                        <div className="flex items-center justify-between space-x-4 rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <Label className="text-base font-semibold">Require Account / Login to Checkout</Label>
                                    <Badge variant="outline" className="text-[10px] text-primary bg-primary/10 font-bold">Recommended</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    When enabled, customers must sign in or create an account before completing their order. When disabled, guest checkout without password is permitted.
                                </p>
                            </div>
                            <Switch
                                checked={requireLoginForCheckout}
                                onCheckedChange={handleRequireLoginToggle}
                                disabled={savingRequireLogin}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Online Payment Processors & Failover Routing */}
                <Card>
                    <CardHeader className="space-y-1">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-primary">
                                <CreditCard className="h-5 w-5" />
                                <CardTitle className="text-xl">Online Payment Processors & Failover Routing (Anti-Ban)</CardTitle>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Active Gateway:</span>
                                <Badge className={`uppercase text-xs font-bold ${
                                    activeGateway === 'square' ? 'bg-black text-white dark:bg-white dark:text-black' :
                                    activeGateway === 'stripe' ? 'bg-indigo-600 text-white' :
                                    activeGateway === 'tagadapay' ? 'bg-emerald-600 text-white' :
                                    activeGateway === 'authorizenet' ? 'bg-blue-700 text-white' :
                                    activeGateway === 'clover' ? 'bg-emerald-700 text-white' :
                                    activeGateway === 'nmi' ? 'bg-slate-800 text-white' :
                                    activeGateway === 'paypal' ? 'bg-blue-600 text-white' :
                                    'bg-purple-600 text-white'
                                }`}>
                                    🟢 {activeGateway}
                                </Badge>
                            </div>
                        </div>
                        <CardDescription>
                            Manage active payment providers, configure backup gateways, and enable automatic failover if a processor account is restricted or unavailable.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Gateway Routing Selectors */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 rounded-xl border bg-muted/20">
                            <div className="space-y-2">
                                <Label htmlFor="activeGateway" className="font-semibold flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-emerald-600" />
                                    Active Online Processor (Primary)
                                </Label>
                                <Select value={activeGateway} onValueChange={(val: any) => setActiveGateway(val)}>
                                    <SelectTrigger id="activeGateway" className="bg-background">
                                        <SelectValue placeholder="Select active processor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="square">Square (Web Payments SDK)</SelectItem>
                                        <SelectItem value="stripe">Stripe (Elements & Cards)</SelectItem>
                                        <SelectItem value="tagadapay">TagadaPay (Multi-PSP Routing & 3DS)</SelectItem>
                                        <SelectItem value="nmi">NMI (Network Merchants Multi-MID)</SelectItem>
                                        <SelectItem value="authorizenet">Authorize.Net (Accept.js)</SelectItem>
                                        <SelectItem value="clover">Clover (Merchant API)</SelectItem>
                                        <SelectItem value="paypal">PayPal (Wallet & Checkout)</SelectItem>
                                        <SelectItem value="manual">Direct P2P / Manual (Zelle / Cash App)</SelectItem>
                                        <SelectItem value="manual_terminal">Manual Virtual Terminal (Offline Card Processing)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    All customer checkouts will currently be routed through this payment processor.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="backupGateway" className="font-semibold flex items-center gap-2">
                                    <RefreshCw className="h-4 w-4 text-primary" />
                                    Backup Failover Processor
                                </Label>
                                <Select value={backupGateway} onValueChange={(val: any) => setBackupGateway(val)}>
                                    <SelectTrigger id="backupGateway" className="bg-background">
                                        <SelectValue placeholder="Select backup processor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="tagadapay">TagadaPay (Multi-PSP Routing & 3DS)</SelectItem>
                                        <SelectItem value="nmi">NMI (Network Merchants Multi-MID)</SelectItem>
                                        <SelectItem value="authorizenet">Authorize.Net (Accept.js)</SelectItem>
                                        <SelectItem value="clover">Clover (Merchant API)</SelectItem>
                                        <SelectItem value="stripe">Stripe (Elements & Cards)</SelectItem>
                                        <SelectItem value="square">Square (Web Payments SDK)</SelectItem>
                                        <SelectItem value="paypal">PayPal (Wallet & Checkout)</SelectItem>
                                        <SelectItem value="manual">Direct P2P / Manual (Zelle / Cash App)</SelectItem>
                                        <SelectItem value="manual_terminal">Manual Virtual Terminal (Offline Card Processing)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    Emergency failover gateway used automatically if the primary processor encounters restrictions.
                                </p>
                            </div>
                        </div>

                        {/* Auto Failover Toggle */}
                        <div className="flex items-center justify-between space-x-4 rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <Label className="text-base font-semibold">Automatic Processor Failover</Label>
                                    <Badge variant="outline" className="text-[10px] text-emerald-600 bg-emerald-500/10 font-bold">Recommended</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Automatically switches live checkout traffic to the backup processor if critical authentication or account suspension errors are detected.
                                </p>
                            </div>
                            <Switch
                                checked={autoFailover}
                                onCheckedChange={setAutoFailover}
                            />
                        </div>

                        {/* Gateway Credentials Tabs */}
                        <div className="space-y-3 pt-2">
                            <Label className="font-semibold text-sm">Processor Credentials & Keys</Label>
                            <Tabs defaultValue="square" className="w-full">
                                <TabsList className="grid grid-cols-4 md:grid-cols-8 w-full">
                                    <TabsTrigger value="square" className="text-[11px] px-1">Square</TabsTrigger>
                                    <TabsTrigger value="stripe" className="text-[11px] px-1">Stripe</TabsTrigger>
                                    <TabsTrigger value="tagadapay" className="text-[11px] px-1 font-semibold text-emerald-600 dark:text-emerald-400">TagadaPay</TabsTrigger>
                                    <TabsTrigger value="nmi" className="text-[11px] px-1">NMI</TabsTrigger>
                                    <TabsTrigger value="authorizenet" className="text-[11px] px-1">Auth.Net</TabsTrigger>
                                    <TabsTrigger value="clover" className="text-[11px] px-1">Clover</TabsTrigger>
                                    <TabsTrigger value="paypal" className="text-[11px] px-1">PayPal</TabsTrigger>
                                    <TabsTrigger value="manual" className="text-[11px] px-1 font-bold text-purple-700 dark:text-purple-300">⚡ P2P Direct</TabsTrigger>

                                </TabsList>

                                {/* Square Settings */}
                                <TabsContent value="square" className="space-y-4 pt-4 border rounded-lg p-4 mt-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="sqAppId" className="text-xs">Application ID</Label>
                                            <Input
                                                id="sqAppId"
                                                value={squareAppId}
                                                onChange={(e) => setSquareAppId(e.target.value)}
                                                placeholder="sandbox-sq0idb-..."
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="sqLocId" className="text-xs">Location ID</Label>
                                            <Input
                                                id="sqLocId"
                                                value={squareLocationId}
                                                onChange={(e) => setSquareLocationId(e.target.value)}
                                                placeholder="L... (Location ID)"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="sqEnv" className="text-xs">Square Environment</Label>
                                            <Select value={squareEnv} onValueChange={(val: any) => setSquareEnv(val)}>
                                                <SelectTrigger id="sqEnv">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                                                    <SelectItem value="production">Production (Live)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        Note: Private access tokens (<code>SQUARE_ACCESS_TOKEN</code>) are securely managed in Supabase Edge Functions.
                                    </p>
                                </TabsContent>

                                {/* Stripe Settings */}
                                <TabsContent value="stripe" className="space-y-4 pt-4 border rounded-lg p-4 mt-2">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="stPk" className="text-xs">Stripe Publishable Key</Label>
                                        <Input
                                            id="stPk"
                                            value={stripePublishableKey}
                                            onChange={(e) => setStripePublishableKey(e.target.value)}
                                            placeholder="pk_live_... or pk_test_..."
                                        />
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        Note: Stripe Secret Key (<code>STRIPE_SECRET_KEY</code>) is stored in Supabase Edge Functions secrets.
                                    </p>
                                </TabsContent>

                                {/* TagadaPay Settings */}
                                <TabsContent value="tagadapay" className="space-y-4 pt-4 border rounded-lg p-4 mt-2">
                                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs space-y-1">
                                        <strong className="text-emerald-700 dark:text-emerald-300 font-bold block">TagadaPay Multi-PSP Routing & BasisTheory 3DS Tokenization</strong>
                                        <p className="text-muted-foreground text-[11px]">
                                            Tokenizes credit cards securely with @tagadapay/core-js and executes charges server-side with dynamic gateway cascading.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="tagadaStoreId" className="text-xs">Store ID</Label>
                                            <Input
                                                id="tagadaStoreId"
                                                value={tagadaStoreId}
                                                onChange={(e) => setTagadaStoreId(e.target.value)}
                                                placeholder="e.g. store_abc123"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="tagadaFlowId" className="text-xs">Payment Flow ID (Optional)</Label>
                                            <Input
                                                id="tagadaFlowId"
                                                value={tagadaPaymentFlowId}
                                                onChange={(e) => setTagadaPaymentFlowId(e.target.value)}
                                                placeholder="e.g. flow_xyz789 (Optional)"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <Label htmlFor="tagadaApiKey" className="text-xs">API Key / Access Token (Optional)</Label>
                                                {tagadaApiKey && (
                                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                                        <Check className="h-3 w-3" /> Configured
                                                    </span>
                                                )}
                                            </div>
                                            <div className="relative flex items-center">
                                                <Input
                                                    id="tagadaApiKey"
                                                    type={showTagadaApiKey ? "text" : "password"}
                                                    value={tagadaApiKey}
                                                    onChange={(e) => setTagadaApiKey(e.target.value)}
                                                    placeholder="e.g. sk_crm_... or tp_sk_live_..."
                                                    className="pr-16 font-mono text-xs"
                                                />
                                                <div className="absolute right-1 flex items-center gap-0.5">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                        onClick={() => setShowTagadaApiKey(!showTagadaApiKey)}
                                                        title={showTagadaApiKey ? "Hide API Key" : "Show API Key"}
                                                    >
                                                        {showTagadaApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                                    </Button>
                                                    {tagadaApiKey && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(tagadaApiKey);
                                                                setCopiedApiKey(true);
                                                                toast.success("API key copied to clipboard!");
                                                                setTimeout(() => setCopiedApiKey(false), 2000);
                                                            }}
                                                            title="Copy API Key"
                                                        >
                                                            {copiedApiKey ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="tagadaEnv" className="text-xs">Tagada Environment</Label>
                                            <Select value={tagadaEnv} onValueChange={(val: any) => setTagadaEnv(val)}>
                                                <SelectTrigger id="tagadaEnv">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="sandbox">Sandbox / Development</SelectItem>
                                                    <SelectItem value="production">Production (Live)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-muted/40 rounded-lg border flex flex-col md:flex-row md:items-center justify-between gap-3">
                                        <div>
                                            <div className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                                                <RefreshCw className={`h-3.5 w-3.5 text-emerald-600 ${isSyncingTagada ? 'animate-spin' : ''}`} />
                                                Kashu / Tagada CRM Product Sync
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">
                                                Push all active products, vial variants, and pricing directly to TagadaPay CRM via <code>POST /products/create</code>.
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            onClick={handleSyncTagadaProducts}
                                            disabled={isSyncingTagada || !tagadaStoreId}
                                            size="sm"
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shrink-0"
                                        >
                                            {isSyncingTagada ? (
                                                <>
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                                    Syncing Products...
                                                </>
                                            ) : (
                                                <>
                                                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                                    Sync Catalog to Tagada
                                                </>
                                            )}
                                        </Button>
                                    </div>

                                    <div className="p-3 bg-muted/40 rounded-lg border flex flex-col md:flex-row md:items-center justify-between gap-3">
                                        <div>
                                            <div className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                                                <ShieldCheck className={`h-3.5 w-3.5 text-emerald-600 ${isRegisteringWebhook ? 'animate-spin' : ''}`} />
                                                Auto-Register TagadaPay Webhook
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">
                                                Automatically registers <code>universal-payment-webhook?provider=tagadapay</code> in TagadaPay using stored API key.
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            onClick={handleRegisterTagadaWebhook}
                                            disabled={isRegisteringWebhook || !tagadaStoreId}
                                            size="sm"
                                            variant="outline"
                                            className="border-emerald-600/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 text-xs font-semibold shrink-0"
                                        >
                                            {isRegisteringWebhook ? (
                                                <>
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                                    Registering Webhook...
                                                </>
                                            ) : (
                                                <>
                                                    <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                                                    Auto-Register Webhook
                                                </>
                                            )}
                                        </Button>
                                    </div>

                                    {tagadaSyncResult && (
                                        <div className="p-2.5 rounded-lg border bg-emerald-500/10 border-emerald-500/30 text-xs space-y-1">
                                            <div className="font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                                                <span>Catalog Sync Complete</span>
                                                <span className="text-[11px]">{tagadaSyncResult.successful} / {tagadaSyncResult.totalProducts} Succeeded</span>
                                            </div>
                                            {tagadaSyncResult.failed > 0 && (
                                                <p className="text-[11px] text-amber-600">
                                                    {tagadaSyncResult.failed} product(s) could not be synced. Check Edge Function logs for details.
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    <p className="text-[11px] text-muted-foreground">
                                        Note: Secret API Bearer Token (<code>TAGADAPAY_API_KEY</code>) is stored securely in Supabase Edge Functions Secrets.
                                    </p>
                                </TabsContent>

                                {/* NMI Settings */}
                                <TabsContent value="nmi" className="space-y-4 pt-4 border rounded-lg p-4 mt-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="nmiSecKey" className="text-xs">NMI Private Security Key</Label>
                                            <Input
                                                id="nmiSecKey"
                                                value={nmiSecurityKey}
                                                onChange={(e) => setNmiSecurityKey(e.target.value)}
                                                placeholder="e.g. 2F822rw294856175640ab50..."
                                                type="password"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="nmiTokKey" className="text-xs">Public Tokenization Key (Collect.js)</Label>
                                            <Input
                                                id="nmiTokKey"
                                                value={nmiTokenKey}
                                                onChange={(e) => setNmiTokenKey(e.target.value)}
                                                placeholder="e.g. 5x7F9... (Optional)"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        Note: Supports multi-MID accounts and automatic MID load balancing.
                                    </p>
                                </TabsContent>

                                {/* Authorize.Net Settings */}
                                <TabsContent value="authorizenet" className="space-y-4 pt-4 border rounded-lg p-4 mt-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="anLoginId" className="text-xs">API Login ID</Label>
                                            <Input
                                                id="anLoginId"
                                                value={authNetApiLoginId}
                                                onChange={(e) => setAuthNetApiLoginId(e.target.value)}
                                                placeholder="e.g. 5KP6uZZ5"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="anClientKey" className="text-xs">Public Client Key</Label>
                                            <Input
                                                id="anClientKey"
                                                value={authNetClientKey}
                                                onChange={(e) => setAuthNetClientKey(e.target.value)}
                                                placeholder="e.g. 5FcB6nx7..."
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="anEnv" className="text-xs">Authorize.Net Environment</Label>
                                            <Select value={authNetEnv} onValueChange={(val: any) => setAuthNetEnv(val)}>
                                                <SelectTrigger id="anEnv">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                                                    <SelectItem value="production">Production (Live)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        Note: The secret <code>AUTHORIZENET_TRANSACTION_KEY</code> is securely kept in Supabase Edge Functions.
                                    </p>
                                </TabsContent>

                                {/* Clover Settings */}
                                <TabsContent value="clover" className="space-y-4 pt-4 border rounded-lg p-4 mt-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="clovMid" className="text-xs">Clover Merchant ID (mId)</Label>
                                            <Input
                                                id="clovMid"
                                                value={cloverMerchantId}
                                                onChange={(e) => setCloverMerchantId(e.target.value)}
                                                placeholder="e.g. ABC123XYZ456"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="clovToken" className="text-xs">Clover API / Public Token</Label>
                                            <Input
                                                id="clovToken"
                                                value={cloverApiToken}
                                                onChange={(e) => setCloverApiToken(e.target.value)}
                                                placeholder="e.g. clv_..."
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="clovEnv" className="text-xs">Clover Environment</Label>
                                            <Select value={cloverEnv} onValueChange={(val: any) => setCloverEnv(val)}>
                                                <SelectTrigger id="clovEnv">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                                                    <SelectItem value="production">Production (Live)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        Note: Private API keys (<code>CLOVER_API_KEY</code>) are managed securely in Supabase Edge Functions.
                                    </p>
                                </TabsContent>

                                {/* PayPal Settings */}
                                <TabsContent value="paypal" className="space-y-4 pt-4 border rounded-lg p-4 mt-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="ppClientId" className="text-xs">PayPal Client ID</Label>
                                            <Input
                                                id="ppClientId"
                                                value={paypalClientId}
                                                onChange={(e) => setPaypalClientId(e.target.value)}
                                                placeholder="e.g. AeA123..."
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="ppEnv" className="text-xs">PayPal Environment</Label>
                                            <Select value={paypalEnv} onValueChange={(val: any) => setPaypalEnv(val)}>
                                                <SelectTrigger id="ppEnv">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                                                    <SelectItem value="production">Production (Live)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* Manual / Zelle / P2P Settings */}
                                <TabsContent value="manual" className="space-y-4 pt-4 border rounded-lg p-4 mt-2">
                                    <div className="space-y-4">
                                        <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg text-xs space-y-1">
                                            <strong className="text-purple-700 dark:text-purple-300 font-bold block">P2P Payments (Zelle, Venmo, Cash App) & Anti-Fraud Security</strong>
                                            <p className="text-muted-foreground text-[11px]">
                                                Upload QR Code image URLs, handles, and set security SLA limits for proof verification.
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {/* Zelle */}
                                            <div className={`p-3 border rounded-lg space-y-2 bg-background transition-opacity ${!zelleEnabled ? 'opacity-60' : ''}`}>
                                                <div className="flex items-center justify-between pb-1 border-b">
                                                    <Label className="font-bold text-xs text-purple-600 block">Zelle Settings</Label>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`text-[10px] font-bold ${zelleEnabled ? 'text-purple-600' : 'text-muted-foreground'}`}>
                                                            {zelleEnabled ? "Enabled" : "Disabled"}
                                                        </span>
                                                        <Switch
                                                            checked={zelleEnabled}
                                                            onCheckedChange={setZelleEnabled}
                                                            className="data-[state=checked]:bg-purple-600 scale-90"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-1">
                                                    <Label htmlFor="zEmail" className="text-[11px]">Zelle Email / Phone</Label>
                                                    <Input
                                                        id="zEmail"
                                                        value={zelleEmail}
                                                        onChange={(e) => setZelleEmail(e.target.value)}
                                                        placeholder="payments@livwelllabs.com"
                                                        className="text-xs"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor="zName" className="text-[11px]">Account Name</Label>
                                                    <Input
                                                        id="zName"
                                                        value={zelleName}
                                                        onChange={(e) => setZelleName(e.target.value)}
                                                        placeholder="Liv Well Labs LLC"
                                                        className="text-xs"
                                                    />
                                                </div>
                                                {/* Zelle QR Upload & Clear Card */}
                                                <div className="space-y-1.5 pt-1">
                                                    <Label className="text-[11px] font-semibold block">Zelle QR Code Image</Label>
                                                    {zelleQrUrl ? (
                                                        <div className="relative border rounded-lg p-2 bg-muted/10 flex flex-col items-center justify-center space-y-2">
                                                            <div className="w-28 h-28 border rounded-md p-1 bg-white flex items-center justify-center overflow-hidden shadow-sm">
                                                                <img src={zelleQrUrl} alt="Zelle QR" className="w-full h-full object-contain" />
                                                            </div>
                                                            <div className="flex items-center gap-1.5 w-full">
                                                                <label className="flex-1">
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="w-full h-7 text-[11px] gap-1 cursor-pointer font-medium"
                                                                        disabled={uploadingQr === "zelle"}
                                                                        onClick={() => document.getElementById("zelle-qr-file-change")?.click()}
                                                                    >
                                                                        {uploadingQr === "zelle" ? <Loader2 className="h-3 w-3 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                                                                        Change Image
                                                                    </Button>
                                                                    <input
                                                                        id="zelle-qr-file-change"
                                                                        type="file"
                                                                        accept="image/*"
                                                                        className="hidden"
                                                                        onChange={(e) => {
                                                                            const file = e.target.files?.[0];
                                                                            if (file) handleQrImageUpload("zelle", file);
                                                                        }}
                                                                    />
                                                                </label>
                                                                <Button
                                                                    type="button"
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    className="h-7 text-[11px] gap-1 px-2.5 font-medium"
                                                                    onClick={() => setZelleQrUrl("")}
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                    Clear
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="border-2 border-dashed border-muted-foreground/30 hover:border-purple-500/50 rounded-lg p-3 bg-purple-500/5 hover:bg-purple-500/10 transition-all flex flex-col items-center justify-center text-center space-y-1.5">
                                                            <div className="p-2 bg-purple-500/10 rounded-full text-purple-600">
                                                                <UploadCloud className="h-5 w-5" />
                                                            </div>
                                                            <div>
                                                                <p className="text-[11px] font-bold text-foreground">Upload Zelle QR Image</p>
                                                                <p className="text-[10px] text-muted-foreground">PNG, JPG, WEBP &lt; 5MB</p>
                                                            </div>
                                                            <label>
                                                                <Button
                                                                    type="button"
                                                                    variant="default"
                                                                    size="sm"
                                                                    className="h-7 text-[11px] font-bold gap-1 bg-purple-600 hover:bg-purple-700 text-white cursor-pointer shadow-sm"
                                                                    disabled={uploadingQr === "zelle"}
                                                                    onClick={() => document.getElementById("zelle-qr-file-new")?.click()}
                                                                >
                                                                    {uploadingQr === "zelle" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                                                                    Upload Image
                                                                </Button>
                                                                <input
                                                                    id="zelle-qr-file-new"
                                                                    type="file"
                                                                    accept="image/*"
                                                                    className="hidden"
                                                                    onChange={(e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) handleQrImageUpload("zelle", file);
                                                                    }}
                                                                />
                                                            </label>
                                                        </div>
                                                    )}
                                                    <Input
                                                        placeholder="Or paste QR Image URL..."
                                                        value={zelleQrUrl}
                                                        onChange={(e) => setZelleQrUrl(e.target.value)}
                                                        className="text-[11px] h-7 font-mono"
                                                    />
                                                </div>
                                            </div>

                                            {/* Venmo */}
                                            <div className={`p-3 border rounded-lg space-y-2 bg-background transition-opacity ${!venmoEnabled ? 'opacity-60' : ''}`}>
                                                <div className="flex items-center justify-between pb-1 border-b">
                                                    <Label className="font-bold text-xs text-blue-600 block">Venmo Settings</Label>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`text-[10px] font-bold ${venmoEnabled ? 'text-blue-600' : 'text-muted-foreground'}`}>
                                                            {venmoEnabled ? "Enabled" : "Disabled"}
                                                        </span>
                                                        <Switch
                                                            checked={venmoEnabled}
                                                            onCheckedChange={setVenmoEnabled}
                                                            className="data-[state=checked]:bg-blue-600 scale-90"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-1">
                                                    <Label htmlFor="vUser" className="text-[11px]">Venmo Username</Label>
                                                    <Input
                                                        id="vUser"
                                                        value={venmoUser}
                                                        onChange={(e) => setVenmoUser(e.target.value)}
                                                        placeholder="@LivWellLabs"
                                                        className="text-xs"
                                                    />
                                                </div>
                                                {/* Venmo QR Upload & Clear Card */}
                                                <div className="space-y-1.5 pt-1">
                                                    <Label className="text-[11px] font-semibold block">Venmo QR Code Image</Label>
                                                    {venmoQrUrl ? (
                                                        <div className="relative border rounded-lg p-2 bg-muted/10 flex flex-col items-center justify-center space-y-2">
                                                            <div className="w-28 h-28 border rounded-md p-1 bg-white flex items-center justify-center overflow-hidden shadow-sm">
                                                                <img src={venmoQrUrl} alt="Venmo QR" className="w-full h-full object-contain" />
                                                            </div>
                                                            <div className="flex items-center gap-1.5 w-full">
                                                                <label className="flex-1">
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="w-full h-7 text-[11px] gap-1 cursor-pointer font-medium"
                                                                        disabled={uploadingQr === "venmo"}
                                                                        onClick={() => document.getElementById("venmo-qr-file-change")?.click()}
                                                                    >
                                                                        {uploadingQr === "venmo" ? <Loader2 className="h-3 w-3 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                                                                        Change Image
                                                                    </Button>
                                                                    <input
                                                                        id="venmo-qr-file-change"
                                                                        type="file"
                                                                        accept="image/*"
                                                                        className="hidden"
                                                                        onChange={(e) => {
                                                                            const file = e.target.files?.[0];
                                                                            if (file) handleQrImageUpload("venmo", file);
                                                                        }}
                                                                    />
                                                                </label>
                                                                <Button
                                                                    type="button"
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    className="h-7 text-[11px] gap-1 px-2.5 font-medium"
                                                                    onClick={() => setVenmoQrUrl("")}
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                    Clear
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="border-2 border-dashed border-muted-foreground/30 hover:border-blue-500/50 rounded-lg p-3 bg-blue-500/5 hover:bg-blue-500/10 transition-all flex flex-col items-center justify-center text-center space-y-1.5">
                                                            <div className="p-2 bg-blue-500/10 rounded-full text-blue-600">
                                                                <UploadCloud className="h-5 w-5" />
                                                            </div>
                                                            <div>
                                                                <p className="text-[11px] font-bold text-foreground">Upload Venmo QR Image</p>
                                                                <p className="text-[10px] text-muted-foreground">PNG, JPG, WEBP &lt; 5MB</p>
                                                            </div>
                                                            <label>
                                                                <Button
                                                                    type="button"
                                                                    variant="default"
                                                                    size="sm"
                                                                    className="h-7 text-[11px] font-bold gap-1 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-sm"
                                                                    disabled={uploadingQr === "venmo"}
                                                                    onClick={() => document.getElementById("venmo-qr-file-new")?.click()}
                                                                >
                                                                    {uploadingQr === "venmo" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                                                                    Upload Image
                                                                </Button>
                                                                <input
                                                                    id="venmo-qr-file-new"
                                                                    type="file"
                                                                    accept="image/*"
                                                                    className="hidden"
                                                                    onChange={(e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) handleQrImageUpload("venmo", file);
                                                                    }}
                                                                />
                                                            </label>
                                                        </div>
                                                    )}
                                                    <Input
                                                        placeholder="Or paste QR Image URL..."
                                                        value={venmoQrUrl}
                                                        onChange={(e) => setVenmoQrUrl(e.target.value)}
                                                        className="text-[11px] h-7 font-mono"
                                                    />
                                                </div>
                                            </div>

                                            {/* Cash App */}
                                            <div className={`p-3 border rounded-lg space-y-2 bg-background transition-opacity ${!cashAppEnabled ? 'opacity-60' : ''}`}>
                                                <div className="flex items-center justify-between pb-1 border-b">
                                                    <Label className="font-bold text-xs text-emerald-600 block">Cash App Settings</Label>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`text-[10px] font-bold ${cashAppEnabled ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                                            {cashAppEnabled ? "Enabled" : "Disabled"}
                                                        </span>
                                                        <Switch
                                                            checked={cashAppEnabled}
                                                            onCheckedChange={setCashAppEnabled}
                                                            className="data-[state=checked]:bg-emerald-600 scale-90"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-1">
                                                    <Label htmlFor="cTag" className="text-[11px]">Cash App $Cashtag</Label>
                                                    <Input
                                                        id="cTag"
                                                        value={cashAppTag}
                                                        onChange={(e) => setCashAppTag(e.target.value)}
                                                        placeholder="$LivWellLabs"
                                                        className="text-xs"
                                                    />
                                                </div>
                                                {/* Cash App QR Upload & Clear Card */}
                                                <div className="space-y-1.5 pt-1">
                                                    <Label className="text-[11px] font-semibold block">Cash App QR Code Image</Label>
                                                    {cashAppQrUrl ? (
                                                        <div className="relative border rounded-lg p-2 bg-muted/10 flex flex-col items-center justify-center space-y-2">
                                                            <div className="w-28 h-28 border rounded-md p-1 bg-white flex items-center justify-center overflow-hidden shadow-sm">
                                                                <img src={cashAppQrUrl} alt="Cash App QR" className="w-full h-full object-contain" />
                                                            </div>
                                                            <div className="flex items-center gap-1.5 w-full">
                                                                <label className="flex-1">
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="w-full h-7 text-[11px] gap-1 cursor-pointer font-medium"
                                                                        disabled={uploadingQr === "cashapp"}
                                                                        onClick={() => document.getElementById("cashapp-qr-file-change")?.click()}
                                                                    >
                                                                        {uploadingQr === "cashapp" ? <Loader2 className="h-3 w-3 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                                                                        Change Image
                                                                    </Button>
                                                                    <input
                                                                        id="cashapp-qr-file-change"
                                                                        type="file"
                                                                        accept="image/*"
                                                                        className="hidden"
                                                                        onChange={(e) => {
                                                                            const file = e.target.files?.[0];
                                                                            if (file) handleQrImageUpload("cashapp", file);
                                                                        }}
                                                                    />
                                                                </label>
                                                                <Button
                                                                    type="button"
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    className="h-7 text-[11px] gap-1 px-2.5 font-medium"
                                                                    onClick={() => setCashAppQrUrl("")}
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                    Clear
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="border-2 border-dashed border-muted-foreground/30 hover:border-emerald-500/50 rounded-lg p-3 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all flex flex-col items-center justify-center text-center space-y-1.5">
                                                            <div className="p-2 bg-emerald-500/10 rounded-full text-emerald-600">
                                                                <UploadCloud className="h-5 w-5" />
                                                            </div>
                                                            <div>
                                                                <p className="text-[11px] font-bold text-foreground">Upload Cash App QR Image</p>
                                                                <p className="text-[10px] text-muted-foreground">PNG, JPG, WEBP &lt; 5MB</p>
                                                            </div>
                                                            <label>
                                                                <Button
                                                                    type="button"
                                                                    variant="default"
                                                                    size="sm"
                                                                    className="h-7 text-[11px] font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-sm"
                                                                    disabled={uploadingQr === "cashapp"}
                                                                    onClick={() => document.getElementById("cashapp-qr-file-new")?.click()}
                                                                >
                                                                    {uploadingQr === "cashapp" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                                                                    Upload Image
                                                                </Button>
                                                                <input
                                                                    id="cashapp-qr-file-new"
                                                                    type="file"
                                                                    accept="image/*"
                                                                    className="hidden"
                                                                    onChange={(e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) handleQrImageUpload("cashapp", file);
                                                                    }}
                                                                />
                                                            </label>
                                                        </div>
                                                    )}
                                                    <Input
                                                        placeholder="Or paste QR Image URL..."
                                                        value={cashAppQrUrl}
                                                        onChange={(e) => setCashAppQrUrl(e.target.value)}
                                                        className="text-[11px] h-7 font-mono"
                                                    />
                                                </div>
                                            </div>

                                        </div>



                                        <div className="space-y-1.5">
                                            <Label htmlFor="mInst" className="text-xs font-semibold">General Customer Instructions</Label>
                                            <Input
                                                id="mInst"
                                                value={manualInstructions}
                                                onChange={(e) => setManualInstructions(e.target.value)}
                                                placeholder="Please include your Order ID in the payment memo..."
                                                className="text-xs"
                                            />
                                        </div>
                                    </div>
                                </TabsContent>

                            </Tabs>
                        </div>

                        {/* Universal Webhook Endpoint Info */}
                        <div className="p-4 rounded-xl border bg-muted/30 space-y-2">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="space-y-0.5">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Universal Webhook Endpoint URL</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Paste this URL in your gateway merchant dashboards (Square, Stripe, Authorize.Net, Clover, NMI, PayPal) to receive real-time payment, refund, and dispute updates.
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const webhookUrl = `${supabase.supabaseUrl}/functions/v1/universal-payment-webhook`;
                                        navigator.clipboard.writeText(webhookUrl);
                                        toast.success("Webhook URL copied to clipboard!");
                                    }}
                                    className="text-xs font-medium"
                                >
                                    Copy Webhook URL
                                </Button>
                            </div>
                            <code className="block p-2 rounded bg-background border text-xs text-primary font-mono select-all break-all">
                                {supabase.supabaseUrl}/functions/v1/universal-payment-webhook
                            </code>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button 
                                onClick={handleSaveGateways}
                                disabled={savingGateways}
                                className="font-bold min-w-[200px]"
                            >
                                {savingGateways ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving Processors...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Gateway Settings
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* 4. Shipping & Cutoff Time Configuration */}
                <Card>
                    <CardHeader className="space-y-1">
                        <div className="flex items-center gap-2 text-primary">
                            <Truck className="h-5 w-5" />
                            <CardTitle className="text-xl">Same-Day Shipping & Cutoff Settings</CardTitle>
                        </div>
                        <CardDescription>
                            Configure same-day fulfillment cutoff times, delivery estimates, and shipping badges displayed on all product pages.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* Cutoff Time */}
                            <div className="space-y-2">
                                <Label htmlFor="cutoffHour" className="flex items-center gap-1.5 font-semibold">
                                    <Clock className="h-4 w-4 text-emerald-600" />
                                    Same-Day Shipping Cutoff Time
                                </Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Select
                                        value={String(cutoffHour)}
                                        onValueChange={(val) => {
                                            const newH = Number(val);
                                            setCutoffHour(newH);
                                            updateAutoCutoffLabel(newH, cutoffMinute, timeZone);
                                        }}
                                    >
                                        <SelectTrigger id="cutoffHour">
                                            <SelectValue placeholder="Hour" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[300px]">
                                            <SelectItem value="6">6:00 AM</SelectItem>
                                            <SelectItem value="7">7:00 AM</SelectItem>
                                            <SelectItem value="8">8:00 AM</SelectItem>
                                            <SelectItem value="9">9:00 AM</SelectItem>
                                            <SelectItem value="10">10:00 AM</SelectItem>
                                            <SelectItem value="11">11:00 AM</SelectItem>
                                            <SelectItem value="12">12:00 PM (Noon)</SelectItem>
                                            <SelectItem value="13">1:00 PM</SelectItem>
                                            <SelectItem value="14">2:00 PM</SelectItem>
                                            <SelectItem value="15">3:00 PM</SelectItem>
                                            <SelectItem value="16">4:00 PM</SelectItem>
                                            <SelectItem value="17">5:00 PM</SelectItem>
                                            <SelectItem value="18">6:00 PM</SelectItem>
                                            <SelectItem value="19">7:00 PM</SelectItem>
                                            <SelectItem value="20">8:00 PM</SelectItem>
                                            <SelectItem value="21">9:00 PM</SelectItem>
                                            <SelectItem value="22">10:00 PM</SelectItem>
                                            <SelectItem value="23">11:00 PM</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    <Select
                                        value={String(cutoffMinute)}
                                        onValueChange={(val) => {
                                            const newM = Number(val);
                                            setCutoffMinute(newM);
                                            updateAutoCutoffLabel(cutoffHour, newM, timeZone);
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Minute" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="0">:00</SelectItem>
                                            <SelectItem value="15">:15</SelectItem>
                                            <SelectItem value="30">:30</SelectItem>
                                            <SelectItem value="45">:45</SelectItem>
                                            <SelectItem value="59">:59</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Orders placed before this hour will show the live <em>"Order within Xh Ym · ships today"</em> countdown.
                                </p>
                            </div>

                            {/* Timezone */}
                            <div className="space-y-2">
                                <Label htmlFor="timeZone" className="font-semibold">
                                    Fulfillment Time Zone
                                </Label>
                                <Select 
                                    value={timeZone} 
                                    onValueChange={(val) => {
                                        setTimeZone(val);
                                        updateAutoCutoffLabel(cutoffHour, cutoffMinute, val);
                                    }}
                                >
                                    <SelectTrigger id="timeZone">
                                        <SelectValue placeholder="Select timezone" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TIMEZONES.map((tz) => (
                                            <SelectItem key={tz.value} value={tz.value}>
                                                {tz.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    The time zone where your shipping facility processes orders.
                                </p>
                            </div>

                            {/* Cutoff Label */}
                            <div className="space-y-2">
                                <Label htmlFor="cutoffDisplayLabel" className="font-semibold">
                                    Cutoff Subtitle Label (Public Badge)
                                </Label>
                                <Input
                                    id="cutoffDisplayLabel"
                                    value={cutoffDisplayLabel}
                                    onChange={(e) => setCutoffDisplayLabel(e.target.value)}
                                    placeholder="e.g. 6:00 PM ET"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Text shown under the countdown (e.g. <em>"Cutoff {cutoffDisplayLabel || '6:00 PM ET'}"</em>).
                                </p>
                            </div>

                            {/* Free Shipping Threshold */}
                            <div className="space-y-2">
                                <Label htmlFor="freeShippingThreshold" className="font-semibold">
                                    Free Shipping Order Threshold ($ USD)
                                </Label>
                                <Input
                                    id="freeShippingThreshold"
                                    type="number"
                                    min="0"
                                    value={freeShippingThreshold}
                                    onChange={(e) => setFreeShippingThreshold(Number(e.target.value))}
                                    placeholder="100"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Displayed as <em>"Free standard shipping on orders over ${freeShippingThreshold}"</em>.
                                </p>
                            </div>

                            {/* Estimated Delivery Window */}
                            <div className="space-y-2 md:col-span-2">
                                <Label className="font-semibold">
                                    Estimated Delivery Window (Business Days)
                                </Label>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">Min days:</span>
                                        <Input
                                            type="number"
                                            min="1"
                                            max="10"
                                            className="w-20"
                                            value={deliveryMinDays}
                                            onChange={(e) => setDeliveryMinDays(Number(e.target.value))}
                                        />
                                    </div>
                                    <span className="text-muted-foreground font-bold">–</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">Max days:</span>
                                        <Input
                                            type="number"
                                            min="1"
                                            max="15"
                                            className="w-20"
                                            value={deliveryMaxDays}
                                            onChange={(e) => setDeliveryMaxDays(Number(e.target.value))}
                                        />
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        (Calculates dynamic arrival calendar dates on product pages)
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between space-x-4 rounded-lg border p-4 bg-muted/20">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-semibold">Ship On Saturdays</Label>
                                <p className="text-xs text-muted-foreground">
                                    Enable if your warehouse also processes and ships carrier packages on Saturdays.
                                </p>
                            </div>
                            <Switch
                                checked={shipsSaturday}
                                onCheckedChange={setShipsSaturday}
                            />
                        </div>

                        {/* 4. Accepted Payment Badges */}
                        <div className="space-y-4 pt-4 border-t">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-1">
                                    <Label className="text-base font-semibold flex items-center gap-2">
                                        <CreditCard className="h-5 w-5 text-primary" />
                                        Accepted Payment Badges (Product Page Trust Section)
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Check the payment methods you accept to display their official badges in the product perks section.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="text-xs h-8 px-2.5"
                                        onClick={handleSelectDefaultCards}
                                    >
                                        Cards & Wallets
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="text-xs h-8 px-2.5"
                                        onClick={handleSelectAllPayments}
                                    >
                                        Select All
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs h-8 px-2"
                                        onClick={handleClearAllPayments}
                                    >
                                        Clear
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
                                {AVAILABLE_PAYMENT_METHODS.map((pm) => {
                                    const isChecked = acceptedPaymentMethods.includes(pm.id);
                                    return (
                                        <div
                                            key={pm.id}
                                            onClick={() => handleTogglePaymentMethod(pm.id)}
                                            className={`flex items-start space-x-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                                                isChecked
                                                    ? 'bg-primary/5 border-primary/50 shadow-xs'
                                                    : 'bg-card border-border/60 hover:border-border opacity-70 hover:opacity-100'
                                            }`}
                                        >
                                            <Checkbox
                                                id={`pm-${pm.id}`}
                                                checked={isChecked}
                                                onCheckedChange={() => handleTogglePaymentMethod(pm.id)}
                                                className="mt-0.5"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <Label 
                                                    htmlFor={`pm-${pm.id}`} 
                                                    className={`cursor-pointer text-xs sm:text-sm ${pm.color} block truncate`}
                                                >
                                                    {pm.label}
                                                </Label>
                                                <p className="text-[11px] text-muted-foreground truncate">
                                                    {pm.sublabel}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="rounded-lg bg-muted/40 p-3 flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Active Badges:</span>
                                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                    {acceptedPaymentMethods.length === 0 ? (
                                        <span className="text-muted-foreground italic">No badges selected</span>
                                    ) : (
                                        acceptedPaymentMethods.map(id => {
                                            const item = AVAILABLE_PAYMENT_METHODS.find(m => m.id === id);
                                            return (
                                                <Badge key={id} variant="secondary" className="text-[10px] uppercase font-bold py-0.5">
                                                    {item?.label || id}
                                                </Badge>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button 
                                onClick={handleSaveShippingSettings}
                                disabled={savingShipping}
                                className="font-bold min-w-[200px]"
                            >
                                {savingShipping ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving Settings...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Shipping Settings
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Inventory & Restock System Settings Card */}
                <Card className="border shadow-sm">
                    <CardHeader className="border-b bg-muted/20">
                        <div className="flex items-center gap-2">
                            <Truck className="h-5 w-5 text-primary" />
                            <div>
                                <CardTitle className="text-xl">Inventory & Restock System Settings</CardTitle>
                                <CardDescription>
                                    Configure stock enforcement, customer restock notifications, lead times, and discount offers.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Strict Stock Control Switch */}
                            <div className="flex items-center justify-between p-4 rounded-xl border bg-card">
                                <div className="space-y-0.5">
                                    <Label htmlFor="strict-stock-toggle" className="font-bold text-sm cursor-pointer">
                                        Enforce Strict Stock Limits
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Prevents customers from buying out-of-stock items and caps quantity to available stock.
                                    </p>
                                </div>
                                <Switch
                                    id="strict-stock-toggle"
                                    checked={enableStrictStockEnforcement}
                                    onCheckedChange={setEnableStrictStockEnforcement}
                                />
                            </div>

                            {/* Enable Restock Notification Modal Switch */}
                            <div className="flex items-center justify-between p-4 rounded-xl border bg-card">
                                <div className="space-y-0.5">
                                    <Label htmlFor="restock-notify-toggle" className="font-bold text-sm cursor-pointer">
                                        Enable Restock Notification Modal
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Replaces "Add to Cart" with "Notify Me When Restocked" button on out-of-stock items.
                                    </p>
                                </div>
                                <Switch
                                    id="restock-notify-toggle"
                                    checked={enableRestockNotifications}
                                    onCheckedChange={setEnableRestockNotifications}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2 border-t">
                            {/* Max Lead Time Days */}
                            <div className="space-y-2">
                                <Label htmlFor="lead-time-days" className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                                    Est. Restock Lead Time (Days)
                                </Label>
                                <Input
                                    id="lead-time-days"
                                    type="number"
                                    min="1"
                                    value={restockLeadTimeDays}
                                    onChange={(e) => setRestockLeadTimeDays(parseInt(e.target.value) || 14)}
                                    placeholder="14"
                                />
                                <p className="text-[11px] text-muted-foreground">Displayed in modal: "up to X days".</p>
                            </div>

                            {/* Restock Discount % */}
                            <div className="space-y-2">
                                <Label htmlFor="discount-percent" className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                                    Restock Discount Offer (%)
                                </Label>
                                <Input
                                    id="discount-percent"
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={restockDiscountPercent}
                                    onChange={(e) => setRestockDiscountPercent(parseInt(e.target.value) || 40)}
                                    placeholder="40"
                                />
                                <p className="text-[11px] text-muted-foreground">Discount offered to waitlisted customers.</p>
                            </div>

                            {/* Restock Coupon Code */}
                            <div className="space-y-2">
                                <Label htmlFor="coupon-code" className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                                    Restock Coupon Code
                                </Label>
                                <Input
                                    id="coupon-code"
                                    value={restockCouponCode}
                                    onChange={(e) => setRestockCouponCode(e.target.value.toUpperCase())}
                                    placeholder="RESTOCK40"
                                />
                                <p className="text-[11px] text-muted-foreground">Coupon applied upon restock alert.</p>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button 
                                onClick={handleSaveInventorySettings}
                                disabled={savingInventorySettings}
                                className="font-bold min-w-[200px]"
                            >
                                {savingInventorySettings ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving Settings...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Inventory Settings
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* 5. Pre-Checkout Peptide Cross-Sell & Upsell System */}
                <Card className="border-emerald-500/30 shadow-sm">
                    <CardHeader className="space-y-1">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                <Gift className="h-5 w-5" />
                                <CardTitle className="text-xl">Pre-Checkout Peptide Cross-Sell & Upsell Offer</CardTitle>
                            </div>
                            <Badge variant={peptideUpsellEnabled ? "default" : "secondary"} className={peptideUpsellEnabled ? "bg-emerald-600 text-white font-bold" : ""}>
                                {peptideUpsellEnabled ? "Active & Running" : "Disabled"}
                            </Badge>
                        </div>
                        <CardDescription>
                            Automatically trigger an engaging offer modal when a customer has only Reconstitution Solution / Water in their cart, incentivizing them to add research peptides in exchange for a free water or discount.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Enable/Disable Switch */}
                        <div className="flex items-center justify-between space-x-4 rounded-lg border p-4 bg-muted/20">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <Label className="text-base font-semibold">Enable Pre-Checkout Peptide Offer</Label>
                                    <Badge variant="outline" className="text-[10px] text-emerald-600 bg-emerald-500/10 font-bold">High Conversion</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    When enabled, customers clicking "Proceed to Checkout" with only water products will see the special peptide promotion.
                                </p>
                            </div>
                            <Switch
                                checked={peptideUpsellEnabled}
                                onCheckedChange={setPeptideUpsellEnabled}
                            />
                        </div>

                        {/* Offer Rules & Parameters */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Offer Type */}
                            <div className="space-y-2">
                                <Label htmlFor="upsell-type" className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                                    Offer Benefit Type
                                </Label>
                                <Select value={peptideUpsellType} onValueChange={(val: any) => setPeptideUpsellType(val)}>
                                    <SelectTrigger id="upsell-type" className="bg-background">
                                        <SelectValue placeholder="Select offer type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="free_water">Free Water (100% Off Water Item)</SelectItem>
                                        <SelectItem value="percentage_discount">Percentage Discount On Order</SelectItem>
                                        <SelectItem value="fixed_discount">Fixed Dollar Amount Discount</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-[11px] text-muted-foreground">
                                    {peptideUpsellType === "free_water" && "The customer gets 1 unit of water 100% FREE."}
                                    {peptideUpsellType === "percentage_discount" && "A % discount applied when peptide is added."}
                                    {peptideUpsellType === "fixed_discount" && "A flat $ amount deducted from water item."}
                                </p>
                            </div>

                            {/* Discount Value */}
                            {peptideUpsellType !== "free_water" && (
                                <div className="space-y-2">
                                    <Label htmlFor="upsell-discount-val" className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                                        {peptideUpsellType === "percentage_discount" ? "Discount Percentage (%)" : "Discount Amount ($)"}
                                    </Label>
                                    <Input
                                        id="upsell-discount-val"
                                        type="number"
                                        min="1"
                                        value={peptideUpsellDiscountValue}
                                        onChange={(e) => setPeptideUpsellDiscountValue(parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                            )}

                            {/* Minimum Peptide Spend */}
                            <div className="space-y-2">
                                <Label htmlFor="upsell-min-spend" className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                                    Minimum Peptide Spend ($)
                                </Label>
                                <Input
                                    id="upsell-min-spend"
                                    type="number"
                                    min="0"
                                    value={peptideUpsellMinSpend}
                                    onChange={(e) => setPeptideUpsellMinSpend(parseFloat(e.target.value) || 0)}
                                    placeholder="0 (Any Peptide Qualifies)"
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Set to 0 for any peptide. When set above $0 (e.g. $60), badges and banners automatically display "$60+ minimum" to customers. You can also customize the Headline / Subtitle below.
                                </p>
                            </div>

                            {/* Max Free Water Units Limit */}
                            {peptideUpsellType === "free_water" && (
                                <div className="space-y-2">
                                    <Label htmlFor="upsell-max-units" className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                                        Max Free Water Units Per Order
                                    </Label>
                                    <Input
                                        id="upsell-max-units"
                                        type="number"
                                        min="1"
                                        value={peptideUpsellMaxFreeUnits}
                                        onChange={(e) => setPeptideUpsellMaxFreeUnits(parseInt(e.target.value) || 1)}
                                    />
                                    <p className="text-[11px] text-muted-foreground">
                                        Default is 1. If customer has 100 waters in cart, only {peptideUpsellMaxFreeUnits} unit(s) are free; the rest are charged full price.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Modal Copy Customization */}
                        <div className="p-4 rounded-xl border bg-muted/10 space-y-4">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                                Modal Text & Copy Customization
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="upsell-badge-text" className="text-xs font-semibold">Badge Pill Text</Label>
                                    <Input
                                        id="upsell-badge-text"
                                        value={peptideUpsellBadgeText}
                                        onChange={(e) => setPeptideUpsellBadgeText(e.target.value)}
                                        placeholder="EXCLUSIVE LAB UPGRADE OFFER"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="upsell-cta-text" className="text-xs font-semibold">One-Click Add Button Text</Label>
                                    <Input
                                        id="upsell-cta-text"
                                        value={peptideUpsellCtaText}
                                        onChange={(e) => setPeptideUpsellCtaText(e.target.value)}
                                        placeholder="Add to Order & Claim Free Water"
                                    />
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="upsell-headline" className="text-xs font-semibold">Modal Headline</Label>
                                    <Input
                                        id="upsell-headline"
                                        value={peptideUpsellHeadline}
                                        onChange={(e) => setPeptideUpsellHeadline(e.target.value)}
                                        placeholder="Unlock FREE Reconstitution Solution with Any Research Peptide"
                                    />
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="upsell-subtitle" className="text-xs font-semibold">Modal Subtitle / Value Proposition</Label>
                                    <Input
                                        id="upsell-subtitle"
                                        value={peptideUpsellSubtitle}
                                        onChange={(e) => setPeptideUpsellSubtitle(e.target.value)}
                                        placeholder="Add any ultra-pure research peptide to your order and get your Reconstitution Solution 100% FREE!"
                                    />
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="upsell-decline-text" className="text-xs font-semibold">Decline / Dismiss Link Text</Label>
                                    <Input
                                        id="upsell-decline-text"
                                        value={peptideUpsellDeclineText}
                                        onChange={(e) => setPeptideUpsellDeclineText(e.target.value)}
                                        placeholder="No thanks, continue with water only"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button 
                                onClick={handleSavePeptideUpsellSettings}
                                disabled={savingPeptideUpsell}
                                className="font-bold min-w-[200px] bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                {savingPeptideUpsell ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving Settings...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Upsell Settings
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* 7. E-Commerce Analytics, Funnel Tracking & Cart Recovery Engine */}
                <Card className="border-2 border-primary/20 shadow-md">
                    <CardHeader className="space-y-1 bg-muted/10">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 text-primary">
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <BarChart3 className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl">E-Commerce Analytics & Abandoned Cart Recovery</CardTitle>
                                    <CardDescription>
                                        Control first-party behavioral metrics, checkout funnel drop-offs, abandoned cart detection, and automated recovery email sequences.
                                    </CardDescription>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className={`font-semibold ${abandonedCartTrackingEnabled ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' : 'bg-muted text-muted-foreground'}`}>
                                    {abandonedCartTrackingEnabled ? '🟢 Tracking Active' : '⚪ Tracking Disabled'}
                                </Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-8 pt-6">
                        
                        {/* Sub-Section A: Cart Tracking & Abandonment Rules */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b">
                                <ShoppingCart className="h-4 w-4 text-primary" />
                                <h3 className="font-bold text-sm uppercase tracking-wider text-foreground">
                                    1. Cart Tracking & Abandonment Thresholds
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center justify-between space-x-4 rounded-lg border p-4 bg-muted/5">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-semibold">Enable Abandoned Cart Tracking</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Synchronizes active carts to your Supabase database in real time with client-side debounce.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={abandonedCartTrackingEnabled}
                                        onCheckedChange={setAbandonedCartTrackingEnabled}
                                    />
                                </div>

                                <div className="flex items-center justify-between space-x-4 rounded-lg border p-4 bg-muted/5">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-semibold">Early Contact Capture</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Immediately links cart to customer email & name as soon as entered in the checkout form.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={earlyContactCaptureEnabled}
                                        onCheckedChange={setEarlyContactCaptureEnabled}
                                    />
                                </div>

                                <div className="flex items-center justify-between space-x-4 rounded-lg border p-4 bg-muted/5">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-semibold">Track Anonymous Guest Carts</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Assigns anonymous session tokens to visitors who have not logged in yet.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={guestCartTrackingEnabled}
                                        onCheckedChange={setGuestCartTrackingEnabled}
                                    />
                                </div>

                                <div className="space-y-2 rounded-lg border p-4 bg-muted/5">
                                    <Label className="text-sm font-semibold flex items-center justify-between">
                                        <span>Abandonment Inactivity Threshold</span>
                                        <Badge variant="secondary" className="font-mono text-xs">{abandonedCartThresholdMinutes} min</Badge>
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            min="5"
                                            max="1440"
                                            value={abandonedCartThresholdMinutes}
                                            onChange={(e) => setAbandonedCartThresholdMinutes(Math.max(5, parseInt(e.target.value) || 60))}
                                            className="bg-background"
                                        />
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">minutes</span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        Time of inactivity after which an uncompleted cart is flagged as Abandoned (Recommended: 30–60 min).
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Sub-Section B: Automated Recovery Email Sequences */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b">
                                <MailCheck className="h-4 w-4 text-emerald-600" />
                                <h3 className="font-bold text-sm uppercase tracking-wider text-foreground">
                                    2. Automated Recovery Email Sequences
                                </h3>
                            </div>

                            <div className="flex items-center justify-between space-x-4 rounded-lg border p-4 bg-emerald-500/5 border-emerald-500/20">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <Label className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Master Automation Switch</Label>
                                        <Badge className="bg-emerald-600 text-white text-[10px]">Auto-Pilot</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Automatically send branded recovery emails with 1-click cart restoration links to customers who left without buying.
                                    </p>
                                </div>
                                <Switch
                                    checked={autoRecoveryEmailsEnabled}
                                    onCheckedChange={setAutoRecoveryEmailsEnabled}
                                />
                            </div>

                            {/* Email Timing Controls */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl border bg-muted/10">
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                                        <Timer className="h-3.5 w-3.5 text-primary" />
                                        Email 1: Initial Friendly Reminder
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            min="1"
                                            max="24"
                                            value={recoveryEmail1DelayHours}
                                            onChange={(e) => setRecoveryEmail1DelayHours(Math.max(1, parseInt(e.target.value) || 1))}
                                            className="bg-background"
                                        />
                                        <span className="text-xs text-muted-foreground">hours</span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">Default: 1 hr after abandonment</p>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                                        <Timer className="h-3.5 w-3.5 text-primary" />
                                        Email 2: Follow-up & Reservation
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            min="2"
                                            max="72"
                                            value={recoveryEmail2DelayHours}
                                            onChange={(e) => setRecoveryEmail2DelayHours(Math.max(2, parseInt(e.target.value) || 24))}
                                            className="bg-background"
                                        />
                                        <span className="text-xs text-muted-foreground">hours</span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">Default: 24 hrs after abandonment</p>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                                        <Timer className="h-3.5 w-3.5 text-primary" />
                                        Email 3: Final Opportunity
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            min="24"
                                            max="168"
                                            value={recoveryEmail3DelayHours}
                                            onChange={(e) => setRecoveryEmail3DelayHours(Math.max(24, parseInt(e.target.value) || 72))}
                                            className="bg-background"
                                        />
                                        <span className="text-xs text-muted-foreground">hours</span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">Default: 72 hrs (3 days) after</p>
                                </div>
                            </div>

                            {/* Optional Recovery Coupon Incentive */}
                            <div className="p-4 rounded-xl border bg-muted/10 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-semibold flex items-center gap-1.5">
                                            <Gift className="h-4 w-4 text-primary" />
                                            Offer Discount Incentive in Recovery Emails
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            Inject a dynamic promo coupon into recovery emails to boost final conversion rates.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={recoveryDiscountEnabled}
                                        onCheckedChange={setRecoveryDiscountEnabled}
                                    />
                                </div>

                                {recoveryDiscountEnabled && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-semibold">Recovery Coupon Code</Label>
                                            <Input
                                                value={recoveryDiscountCouponCode}
                                                onChange={(e) => setRecoveryDiscountCouponCode(e.target.value.toUpperCase())}
                                                placeholder="COMEBACK10"
                                                className="bg-background uppercase font-mono font-bold"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-semibold">Discount Percentage (%)</Label>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    max="90"
                                                    value={recoveryDiscountPercentage}
                                                    onChange={(e) => setRecoveryDiscountPercentage(Math.max(1, Math.min(90, parseInt(e.target.value) || 10)))}
                                                    className="bg-background"
                                                />
                                                <span className="text-xs text-muted-foreground font-bold">% OFF</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Email Template Customization */}
                            <div className="space-y-3 p-4 rounded-xl border bg-muted/10">
                                <Label className="text-xs font-semibold">Email Subject Line</Label>
                                <Input
                                    value={recoveryEmailSubject}
                                    onChange={(e) => setRecoveryEmailSubject(e.target.value)}
                                    placeholder="Did you forget something in your cart?"
                                    className="bg-background"
                                />

                                <Label className="text-xs font-semibold pt-1">Custom Message / Friendly Call to Action</Label>
                                <Textarea
                                    rows={3}
                                    value={recoveryEmailCustomMessage}
                                    onChange={(e) => setRecoveryEmailCustomMessage(e.target.value)}
                                    placeholder="We saved the items in your cart so you can easily complete your order whenever you are ready."
                                    className="bg-background text-sm"
                                />
                            </div>
                        </div>

                        {/* Sub-Section C: Behavioral & Funnel Tracking */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b">
                                <MousePointerClick className="h-4 w-4 text-primary" />
                                <h3 className="font-bold text-sm uppercase tracking-wider text-foreground">
                                    3. Behavioral & Funnel Tracking
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center justify-between space-x-4 rounded-lg border p-4 bg-muted/5">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-semibold">Track Checkout Funnel Steps</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Records micro-steps (Address, Shipping, Payment selection, Payment errors) to analyze checkout drop-offs.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={funnelTrackingEnabled}
                                        onCheckedChange={setFunnelTrackingEnabled}
                                    />
                                </div>

                                <div className="flex items-center justify-between space-x-4 rounded-lg border p-4 bg-muted/5">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-semibold">Track Product & COA Views</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Measures catalog interest to calculate Product View-to-Cart ratios.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={productViewTrackingEnabled}
                                        onCheckedChange={setProductViewTrackingEnabled}
                                    />
                                </div>

                                <div className="flex items-center justify-between space-x-4 rounded-lg border p-4 bg-muted/5">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-semibold">Capture Marketing UTMs & Referrers</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Preserves campaign parameters (utm_source, campaign, affiliate codes) through the customer journey.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={utmAttributionTrackingEnabled}
                                        onCheckedChange={setUtmAttributionTrackingEnabled}
                                    />
                                </div>

                                <div className="flex items-center justify-between space-x-4 rounded-lg border p-4 bg-muted/5">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-semibold">Exclude Admin Traffic</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Filters out test browsing and actions from admin accounts so analytics reflect real customer behavior.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={excludeAdminFromAnalytics}
                                        onCheckedChange={setExcludeAdminFromAnalytics}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Sub-Section D: Admin High-Value Alerts */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b">
                                <BellRing className="h-4 w-4 text-amber-500" />
                                <h3 className="font-bold text-sm uppercase tracking-wider text-foreground">
                                    4. High-Value Cart Abandonment Alerts
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center justify-between space-x-4 rounded-lg border p-4 bg-muted/5">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-semibold">High-Value Abandonment Alerts</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Receive immediate notifications when a high-ticket cart is abandoned for manual concierge follow-up.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={adminAlertHighValueAbandonment}
                                        onCheckedChange={setAdminAlertHighValueAbandonment}
                                    />
                                </div>

                                <div className="space-y-2 rounded-lg border p-4 bg-muted/5">
                                    <Label className="text-sm font-semibold">High-Value Threshold ($ USD)</Label>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-muted-foreground">$</span>
                                        <Input
                                            type="number"
                                            min="50"
                                            step="25"
                                            value={highValueAbandonmentThreshold}
                                            onChange={(e) => setHighValueAbandonmentThreshold(Math.max(10, parseFloat(e.target.value) || 300))}
                                            className="bg-background"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Save Button for Analytics Card */}
                        <div className="flex justify-end pt-4 border-t">
                            <Button 
                                onClick={handleSaveAnalyticsSettings}
                                disabled={savingAnalytics}
                                className="font-bold min-w-[220px] bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
                            >
                                {savingAnalytics ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving Settings...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Analytics Settings
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default SiteSettings;

