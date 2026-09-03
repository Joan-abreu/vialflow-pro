import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
    ShoppingCart,
    DollarSign,
    Percent,
    RefreshCw,
    Search,
    Copy,
    Check,
    Mail,
    Send,
    Filter,
    BarChart3,
    TrendingUp,
    Eye,
    Package,
    ArrowUpRight,
    CheckCircle2,
    Clock,
    User,
    Globe,
    ExternalLink,
    Loader2,
    Activity,
    CreditCard,
    PackageCheck,
    AlertCircle,
    FlaskConical,
    Sparkles,
    Layers,
    Flame,
    ArrowRight,
    ShieldCheck,
    Shield,
} from "lucide-react";
import { format, formatDistanceToNow, subDays } from "date-fns";
import { DateRangeFilter, DateRange } from "@/components/shared/DateRangeFilter";
import EcommerceFunnelChart from "@/components/dashboard/EcommerceFunnelChart";
import { getCountryFlagEmoji } from "@/utils/sessionTracker";
import { useAnalyticsSettings } from "@/hooks/useAnalyticsSettings";

export interface CartSessionRecord {
    id: string;
    session_id: string;
    user_id: string | null;
    email: string | null;
    phone: string | null;
    customer_name: string | null;
    items: any[];
    subtotal: number;
    total_weight: number | null;
    currency: string;
    status: "active" | "abandoned" | "recovered" | "converted" | "archived";
    recovery_token: string;
    recovery_email_sent_count: number;
    last_recovery_email_at: string | null;
    last_active_at: string;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_term: string | null;
    referrer: string | null;
    ip_address?: string | null;
    country?: string | null;
    country_code?: string | null;
    city?: string | null;
    region?: string | null;
    converted_order_id: string | null;
    created_at: string;
    updated_at: string;
}

export default function Analytics() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<string>("funnel");
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [selectedCart, setSelectedCart] = useState<CartSessionRecord | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState<string | null>(null);
    const [copiedToken, setCopiedToken] = useState<string | null>(null);

    // Global Date Range Filter (Default: Last 30 Days)
    const [dateRange, setDateRange] = useState<DateRange>({
        startDate: format(subDays(new Date(), 29), "yyyy-MM-dd"),
        endDate: format(new Date(), "yyyy-MM-dd"),
    });

    const startDateTime = `${dateRange.startDate}T00:00:00.000Z`;
    const endDateTime = `${dateRange.endDate}T23:59:59.999Z`;

    // 1. Fetch Analytics Events (Product views, category views, etc.)
    const { data: analyticsEvents = [], isLoading: loadingEvents, refetch: refetchEvents } = useQuery({
        queryKey: ["analytics_events_filtered", dateRange],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("analytics_events" as any)
                .select("*")
                .gte("created_at", startDateTime)
                .lte("created_at", endDateTime)
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Error fetching analytics events:", error);
                return [];
            }
            return (data || []) as any[];
        },
    });

    // 2. Fetch Funnel Events
    const { data: funnelEvents = [], isLoading: loadingFunnel, refetch: refetchFunnel } = useQuery({
        queryKey: ["checkout_funnel_filtered", dateRange],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("checkout_funnel_events" as any)
                .select("*")
                .gte("created_at", startDateTime)
                .lte("created_at", endDateTime)
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Error fetching funnel events:", error);
                return [];
            }
            return (data || []) as any[];
        },
    });

    // 3. Fetch Cart Sessions
    const { data: cartSessions = [], isLoading: loadingCarts, refetch: refetchCarts } = useQuery<CartSessionRecord[]>({
        queryKey: ["cart_sessions_filtered", dateRange],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("cart_sessions" as any)
                .select("*")
                .gte("created_at", startDateTime)
                .lte("created_at", endDateTime)
                .order("last_active_at", { ascending: false });

            if (error) {
                console.error("Error fetching cart sessions:", error);
                return [];
            }
            return (data || []) as CartSessionRecord[];
        },
    });

    // 4. Fetch Completed Orders for the period
    const { data: orders = [], isLoading: loadingOrders, refetch: refetchOrders } = useQuery({
        queryKey: ["orders_filtered_analytics", dateRange],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("orders" as any)
                .select("id, total_amount, status, created_at, user_id, customer_email")
                .gte("created_at", startDateTime)
                .lte("created_at", endDateTime)
                .neq("status", "cancelled")
                .neq("status", "failed");

            if (error) {
                console.error("Error fetching orders:", error);
                return [];
            }
            return (data || []) as any[];
        },
    });

    const isRefetching = loadingEvents || loadingFunnel || loadingCarts || loadingOrders;

    // 5. Fetch Global Analytics Settings (Exclude Admin Traffic flag)
    const { data: analyticsSettings } = useAnalyticsSettings();
    const [excludeAdmin, setExcludeAdmin] = useState<boolean>(true);

    useEffect(() => {
        if (analyticsSettings) {
            setExcludeAdmin(analyticsSettings.excludeAdminFromAnalytics);
        }
    }, [analyticsSettings?.excludeAdminFromAnalytics]);

    // 6. Fetch Admin / Manager / Staff User IDs from user_roles
    const { data: adminUserIds = [] } = useQuery({
        queryKey: ["admin_user_role_ids"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("user_roles")
                .select("user_id")
                .in("role", ["admin", "manager", "staff"]);
            if (error) return [];
            return (data || []).map((r: any) => r.user_id).filter(Boolean);
        },
    });

    // Effective datasets filtering out admin test traffic if excludeAdmin is active
    const effectiveCartSessions = useMemo(() => {
        if (!excludeAdmin || adminUserIds.length === 0) return cartSessions;
        return cartSessions.filter(c => !c.user_id || !adminUserIds.includes(c.user_id));
    }, [cartSessions, excludeAdmin, adminUserIds]);

    const effectiveAnalyticsEvents = useMemo(() => {
        if (!excludeAdmin || adminUserIds.length === 0) return analyticsEvents;
        return analyticsEvents.filter(e => !e.user_id || !adminUserIds.includes(e.user_id));
    }, [analyticsEvents, excludeAdmin, adminUserIds]);

    const effectiveFunnelEvents = useMemo(() => {
        if (!excludeAdmin || adminUserIds.length === 0) return funnelEvents;
        return funnelEvents.filter(e => !e.user_id || !adminUserIds.includes(e.user_id));
    }, [funnelEvents, excludeAdmin, adminUserIds]);

    const effectiveOrders = useMemo(() => {
        if (!excludeAdmin || adminUserIds.length === 0) return orders;
        return orders.filter(o => !o.user_id || !adminUserIds.includes(o.user_id));
    }, [orders, excludeAdmin, adminUserIds]);

    const handleRefreshAll = () => {
        refetchEvents();
        refetchFunnel();
        refetchCarts();
        refetchOrders();
    };

    // Aggregate High-Level Metrics
    const metrics = useMemo(() => {
        const productViews = effectiveAnalyticsEvents.filter(e => e.event_name === "product_view").length;
        const totalCarts = effectiveCartSessions.length;
        const checkoutStarts = effectiveFunnelEvents.filter(e => e.step === "begin_checkout").length;
        const addressEntered = effectiveFunnelEvents.filter(e => e.step === "address_entered").length;
        const shippingSelected = effectiveFunnelEvents.filter(e => e.step === "shipping_selected").length;
        const paymentSelected = effectiveFunnelEvents.filter(e => e.step === "payment_selected").length;
        const totalOrders = effectiveOrders.length;

        const abandonedCarts = effectiveCartSessions.filter(c => c.status === "abandoned" || (c.status === "active" && new Date(c.last_active_at).getTime() < Date.now() - 3600000));
        const recoveredCarts = effectiveCartSessions.filter(c => c.status === "recovered");
        const convertedCarts = effectiveCartSessions.filter(c => c.status === "converted");

        const lostRevenue = abandonedCarts.reduce((acc, c) => acc + (Number(c.subtotal) || 0), 0);
        const recoveredRevenue = recoveredCarts.reduce((acc, c) => acc + (Number(c.subtotal) || 0), 0);

        const overallConversion = productViews > 0 ? ((totalOrders / productViews) * 100).toFixed(2) : "0.00";
        const cartToOrderConversion = totalCarts > 0 ? ((totalOrders / totalCarts) * 100).toFixed(1) : "0.0";
        const recoveryRate = (abandonedCarts.length + recoveredCarts.length) > 0 
            ? ((recoveredCarts.length / (abandonedCarts.length + recoveredCarts.length)) * 100).toFixed(1) 
            : "0.0";

        // Peptide-Specific Metrics
        const peptideEvents = effectiveAnalyticsEvents.filter(e => {
            if (e.event_name !== "product_view") return false;
            const cat = (e.properties?.category || "").toLowerCase();
            const name = (e.properties?.product_name || e.properties?.name || "").toLowerCase();
            return cat.includes("peptide") || name.includes("peptide") || e.properties?.is_peptide;
        });

        const waterEvents = effectiveAnalyticsEvents.filter(e => {
            if (e.event_name !== "product_view") return false;
            const cat = (e.properties?.category || "").toLowerCase();
            const name = (e.properties?.product_name || e.properties?.name || "").toLowerCase();
            return !cat.includes("peptide") && !name.includes("peptide") && (cat.includes("water") || cat.includes("solution") || cat.includes("reconstitution") || name.includes("water") || name.includes("reconstitution") || name.includes("bac"));
        });

        const peptideViews = peptideEvents.length;
        const peptideUniqueSessions = new Set(peptideEvents.map(e => e.session_id).filter(Boolean)).size;

        const waterViews = waterEvents.length;
        const waterUniqueSessions = new Set(waterEvents.map(e => e.session_id).filter(Boolean)).size;

        const peptideCarts = effectiveCartSessions.filter(c => {
            return (c.items || []).some((item: any) => {
                const cat = (item.variant?.product?.category || "").toLowerCase();
                const name = (item.variant?.product?.name || "").toLowerCase();
                const vialName = (item.variant?.vial_type?.name || "").toLowerCase();
                return cat.includes("peptide") || name.includes("peptide") || vialName.includes("mg");
            });
        });

        const waterCarts = effectiveCartSessions.filter(c => {
            return (c.items || []).some((item: any) => {
                const cat = (item.variant?.product?.category || "").toLowerCase();
                const name = (item.variant?.product?.name || "").toLowerCase();
                return !cat.includes("peptide") && !name.includes("peptide");
            });
        });

        const combinedCarts = effectiveCartSessions.filter(c => {
            const hasPeptide = (c.items || []).some((item: any) => {
                const cat = (item.variant?.product?.category || "").toLowerCase();
                const name = (item.variant?.product?.name || "").toLowerCase();
                return cat.includes("peptide") || name.includes("peptide");
            });
            const hasWater = (c.items || []).some((item: any) => {
                const cat = (item.variant?.product?.category || "").toLowerCase();
                const name = (item.variant?.product?.name || "").toLowerCase();
                return !cat.includes("peptide") && !name.includes("peptide");
            });
            return hasPeptide && hasWater;
        });

        const peptideAbandoned = peptideCarts.filter(c => c.status === "abandoned" || (c.status === "active" && new Date(c.last_active_at).getTime() < Date.now() - 3600000));
        const peptideLostRevenue = peptideAbandoned.reduce((acc, c) => acc + (Number(c.subtotal) || 0), 0);
        const peptideRecovered = peptideCarts.filter(c => c.status === "recovered");
        const peptideRecoveredRevenue = peptideRecovered.reduce((acc, c) => acc + (Number(c.subtotal) || 0), 0);
        const peptideConverted = peptideCarts.filter(c => c.status === "converted");
        const peptideTotalCartValue = peptideCarts.reduce((acc, c) => acc + (Number(c.subtotal) || 0), 0);

        const peptideTrafficShare = productViews > 0 ? ((peptideViews / productViews) * 100).toFixed(1) : "0.0";
        const peptideCartConversionRate = peptideCarts.length > 0 ? ((peptideConverted.length / peptideCarts.length) * 100).toFixed(1) : "0.0";

        return {
            productViews,
            totalCarts,
            checkoutStarts,
            addressEntered,
            shippingSelected,
            paymentSelected,
            totalOrders,
            abandonedCount: abandonedCarts.length,
            lostRevenue,
            recoveredCount: recoveredCarts.length,
            recoveredRevenue,
            convertedCount: convertedCarts.length,
            overallConversion,
            cartToOrderConversion,
            recoveryRate,
            // Peptide analytics
            peptideViews,
            peptideUniqueSessions,
            waterViews,
            waterUniqueSessions,
            peptideCartsCount: peptideCarts.length,
            waterCartsCount: waterCarts.length,
            combinedCartsCount: combinedCarts.length,
            peptideAbandonedCount: peptideAbandoned.length,
            peptideLostRevenue,
            peptideRecoveredCount: peptideRecovered.length,
            peptideRecoveredRevenue,
            peptideConvertedCount: peptideConverted.length,
            peptideTotalCartValue,
            peptideTrafficShare,
            peptideCartConversionRate,
        };
    }, [effectiveAnalyticsEvents, effectiveFunnelEvents, effectiveCartSessions, effectiveOrders]);

    // Top Viewed Peptides Breakdown
    const topViewedPeptides = useMemo(() => {
        const counts: Record<string, { name: string; views: number; uniqueVisitors: number; productId: string; category: string }> = {};
        const sessionsByProduct: Record<string, Set<string>> = {};

        effectiveAnalyticsEvents.forEach(e => {
            if (e.event_name === "product_view" && e.properties?.product_name) {
                const cat = (e.properties.category || "").toLowerCase();
                const name = e.properties.product_name;
                const isPeptide = cat.includes("peptide") || name.toLowerCase().includes("peptide") || e.properties.is_peptide;
                if (!isPeptide) return;

                const id = e.properties.product_id || name;
                if (!counts[id]) {
                    counts[id] = { name, views: 0, uniqueVisitors: 0, productId: id, category: e.properties.category || "Peptides" };
                    sessionsByProduct[id] = new Set();
                }
                counts[id].views += 1;
                if (e.session_id) sessionsByProduct[id].add(e.session_id);
            }
        });

        return Object.values(counts).map(c => ({
            ...c,
            uniqueVisitors: sessionsByProduct[c.productId]?.size || 0,
        })).sort((a, b) => b.views - a.views);
    }, [effectiveAnalyticsEvents]);

    // Product Views Breakdown
    const topViewedProducts = useMemo(() => {
        const counts: Record<string, { name: string; views: number; productId: string }> = {};
        effectiveAnalyticsEvents.forEach(e => {
            if (e.event_name === "product_view" && e.properties?.product_name) {
                const name = e.properties.product_name;
                const id = e.properties.product_id || name;
                if (!counts[id]) {
                    counts[id] = { name, views: 0, productId: id };
                }
                counts[id].views += 1;
            }
        });
        return Object.values(counts).sort((a, b) => b.views - a.views).slice(0, 8);
    }, [effectiveAnalyticsEvents]);

    // Marketing & Attribution Breakdown
    const attributionData = useMemo(() => {
        const sources: Record<string, { source: string; carts: number; revenue: number; converted: number }> = {};
        effectiveCartSessions.forEach(c => {
            const src = c.utm_source || (c.referrer ? "Referral" : "Direct / Organic");
            if (!sources[src]) {
                sources[src] = { source: src, carts: 0, revenue: 0, converted: 0 };
            }
            sources[src].carts += 1;
            sources[src].revenue += Number(c.subtotal) || 0;
            if (c.status === "converted" || c.status === "recovered") {
                sources[src].converted += 1;
            }
        });
        return Object.values(sources).sort((a, b) => b.carts - a.carts);
    }, [effectiveCartSessions]);

    // Filtered Abandoned Carts Table
    const filteredCarts = useMemo(() => {
        return effectiveCartSessions.filter(c => {
            if (statusFilter !== "all" && c.status !== statusFilter) return false;
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            const emailMatch = c.email?.toLowerCase().includes(term);
            const nameMatch = c.customer_name?.toLowerCase().includes(term);
            const phoneMatch = c.phone?.toLowerCase().includes(term);
            const utmMatch = c.utm_source?.toLowerCase().includes(term) || c.utm_campaign?.toLowerCase().includes(term);
            const itemMatch = c.items?.some(i => i.variant?.product?.name?.toLowerCase().includes(term));
            return emailMatch || nameMatch || phoneMatch || utmMatch || itemMatch;
        });
    }, [effectiveCartSessions, statusFilter, searchTerm]);

    const handleCopyRecoveryLink = (token: string) => {
        const url = `${window.location.origin}/cart?recover=${token}`;
        navigator.clipboard.writeText(url);
        setCopiedToken(token);
        toast.success("1-Click Recovery Link copied to clipboard!");
        setTimeout(() => setCopiedToken(null), 3000);
    };

    const handleSendRecoveryEmail = async (cart: CartSessionRecord) => {
        if (!cart.email) {
            toast.error("This cart session does not have an associated email address.");
            return;
        }

        setIsSendingEmail(cart.id);
        try {
            const { data, error } = await supabase.functions.invoke("send-cart-recovery-email", {
                body: { cart_session_id: cart.id }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            toast.success(`Recovery email sent successfully to ${cart.email}!`);
            refetchCarts();
        } catch (err: any) {
            console.error("Error sending recovery email:", err);
            toast.error(err.message || "Failed to send recovery email");
        } finally {
            setIsSendingEmail(null);
        }
    };

    const getStatusBadge = (status: string, lastActive: string) => {
        const isStale = new Date(lastActive).getTime() < Date.now() - 3600000;
        switch (status) {
            case "converted":
                return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">Converted</Badge>;
            case "recovered":
                return <Badge className="bg-blue-600 hover:bg-blue-700 text-white">Recovered</Badge>;
            case "abandoned":
                return <Badge variant="destructive">Abandoned</Badge>;
            case "active":
                return isStale ? (
                    <Badge variant="outline" className="text-amber-600 border-amber-500/30 bg-amber-500/10">Stale / Idle</Badge>
                ) : (
                    <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 bg-emerald-500/10">Active Now</Badge>
                );
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    return (
        <div className="container mx-auto py-8 space-y-8 animate-in fade-in-50 duration-300">
            
            {/* Header: Title with Exclude Admin Switch on the side & Subtitle */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                            <BarChart3 className="h-7 w-7" />
                        </div>
                        E-Commerce Analytics & Recovery Hub
                    </h1>
                    <p className="text-muted-foreground">
                        Unified real-time analytics, conversion drop-off funnel, abandoned cart recovery, and attribution.
                    </p>
                </div>

                {/* Exclude Admin Traffic Switch beside Title */}
                <div className="flex items-center gap-3 bg-card border rounded-xl px-4 py-2.5 shadow-xs shrink-0 self-start md:self-center">
                    <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                        <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                        <Label htmlFor="exclude-admin-switch" className="text-xs font-bold text-foreground cursor-pointer select-none">
                            Exclude Admin Traffic
                        </Label>
                        <span className="text-[10px] text-muted-foreground">
                            {excludeAdmin ? "Filtering admin actions" : "Including admin test carts"}
                        </span>
                    </div>
                    <Switch
                        id="exclude-admin-switch"
                        checked={excludeAdmin}
                        onCheckedChange={setExcludeAdmin}
                        className="data-[state=checked]:bg-amber-600"
                    />
                </div>
            </div>

            {/* Filter & Actions Bar: Full-Width Row underneath subtitle */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
                <div className="flex-1 w-full">
                    <DateRangeFilter initialRange={dateRange} onChange={setDateRange} className="w-full shadow-xs" />
                </div>
                <Button 
                    variant="outline" 
                    onClick={handleRefreshAll} 
                    disabled={isRefetching}
                    className="h-11 px-4 text-xs font-semibold flex items-center justify-center gap-2 rounded-xl shadow-xs bg-card hover:bg-primary/10 hover:text-primary transition-colors shrink-0"
                >
                    <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin text-primary' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* High-Level KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border shadow-xs bg-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">Product Views</CardTitle>
                        <Eye className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-foreground">{metrics.productViews.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {metrics.totalOrders} total orders placed ({metrics.overallConversion}% CVR)
                        </p>
                    </CardContent>
                </Card>

                <Card className="border shadow-xs bg-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-muted-foreground">Carts Created</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-indigo-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-foreground">{metrics.totalCarts.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-semibold text-emerald-600">{metrics.cartToOrderConversion}%</span> cart-to-order conversion
                        </p>
                    </CardContent>
                </Card>

                <Card className="border shadow-xs bg-destructive/5 border-destructive/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-destructive">Abandoned Carts</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-destructive">{metrics.abandonedCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-bold text-destructive">${metrics.lostRevenue.toFixed(2)}</span> potential lost revenue
                        </p>
                    </CardContent>
                </Card>

                <Card className="border shadow-xs bg-emerald-500/5 border-emerald-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Recovered Sales</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-emerald-600">${metrics.recoveredRevenue.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {metrics.recoveredCount} carts reclaimed ({metrics.recoveryRate}% recovery rate)
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Unified Tabs Section */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <div className="flex justify-between items-center border-b pb-3">
                    <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full sm:w-[700px]">
                        <TabsTrigger value="funnel" className="flex items-center gap-1.5 text-xs sm:text-sm font-bold">
                            <TrendingUp className="h-4 w-4" />
                            Conversion Funnel
                        </TabsTrigger>
                        <TabsTrigger value="peptides" className="flex items-center gap-1.5 text-xs sm:text-sm font-bold data-[state=active]:text-purple-600">
                            <FlaskConical className="h-4 w-4 text-purple-600" />
                            Peptides Analytics
                            {metrics.peptideViews > 0 && (
                                <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1 bg-purple-500/15 text-purple-700 dark:text-purple-300 font-bold">
                                    {metrics.peptideViews}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="abandoned" className="flex items-center gap-1.5 text-xs sm:text-sm font-bold">
                            <ShoppingCart className="h-4 w-4" />
                            Abandoned Carts
                            {metrics.abandonedCount > 0 && (
                                <Badge variant="destructive" className="ml-1 text-[10px] h-4 px-1">
                                    {metrics.abandonedCount}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="attribution" className="flex items-center gap-1.5 text-xs sm:text-sm font-bold">
                            <Globe className="h-4 w-4" />
                            Attribution & UTMs
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* TAB 1: CONVERSION FUNNEL */}
                <TabsContent value="funnel" className="space-y-6 animate-in fade-in-50">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* Visual Funnel */}
                        <div className="lg:col-span-2">
                            <EcommerceFunnelChart
                                viewsCount={metrics.productViews}
                                cartsCount={metrics.totalCarts}
                                checkoutsCount={metrics.checkoutStarts}
                                addressesCount={metrics.addressEntered}
                                shippingCount={metrics.shippingSelected}
                                paymentCount={metrics.paymentSelected}
                                ordersCount={metrics.totalOrders}
                                periodLabel={`${dateRange.startDate} to ${dateRange.endDate}`}
                            />
                        </div>

                        {/* Top Viewed Products */}
                        <Card className="border shadow-xs">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    <Eye className="h-4 w-4 text-blue-500" />
                                    Top Product Catalog Views
                                </CardTitle>
                                <CardDescription>Most viewed items during this period</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                {topViewedProducts.length === 0 ? (
                                    <div className="p-6 text-center text-xs text-muted-foreground">
                                        No product view events recorded in this date range.
                                    </div>
                                ) : (
                                    <div className="divide-y text-xs">
                                        {topViewedProducts.map((p, idx) => (
                                            <div key={p.productId} className="flex items-center justify-between p-3.5 hover:bg-muted/30">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="font-mono text-muted-foreground w-4 text-center">{idx + 1}.</span>
                                                    <span className="font-semibold text-foreground line-clamp-1">{p.name}</span>
                                                </div>
                                                <Badge variant="secondary" className="font-mono font-bold">
                                                    {p.views.toLocaleString()} views
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Funnel Drop-off Insights */}
                    <Card className="border shadow-xs bg-muted/5">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Activity className="h-4 w-4 text-primary" />
                                Checkout Micro-Steps Breakdown
                            </CardTitle>
                            <CardDescription>Granular analysis of where shoppers encounter friction during checkout</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                <div className="p-4 rounded-xl border bg-background space-y-1">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                                        <span>Started Checkout</span>
                                        <CreditCard className="h-4 w-4 text-purple-500" />
                                    </div>
                                    <div className="text-xl font-bold">{metrics.checkoutStarts}</div>
                                    <p className="text-[11px] text-muted-foreground">Initial /checkout visits</p>
                                </div>

                                <div className="p-4 rounded-xl border bg-background space-y-1">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                                        <span>Address Form Filled</span>
                                        <PackageCheck className="h-4 w-4 text-amber-500" />
                                    </div>
                                    <div className="text-xl font-bold">{metrics.addressEntered}</div>
                                    <p className="text-[11px] text-muted-foreground">
                                        {metrics.checkoutStarts > 0 ? `${((metrics.addressEntered / metrics.checkoutStarts) * 100).toFixed(0)}% completion` : '0%'}
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl border bg-background space-y-1">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                                        <span>Shipping Selected</span>
                                        <Globe className="h-4 w-4 text-blue-500" />
                                    </div>
                                    <div className="text-xl font-bold">{metrics.shippingSelected}</div>
                                    <p className="text-[11px] text-muted-foreground">Carrier selected</p>
                                </div>

                                <div className="p-4 rounded-xl border bg-background space-y-1">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                                        <span>Payment Confirmed</span>
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    </div>
                                    <div className="text-xl font-bold">{metrics.totalOrders}</div>
                                    <p className="text-[11px] text-emerald-600 font-semibold">Final orders created</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 2: PEPTIDES ANALYTICS */}
                <TabsContent value="peptides" className="space-y-6 animate-in fade-in-50">
                    
                    {/* Peptide KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="border shadow-xs bg-purple-500/5 border-purple-500/20">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-semibold text-purple-700 dark:text-purple-300">Peptide Product Views</CardTitle>
                                <FlaskConical className="h-4 w-4 text-purple-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black text-purple-700 dark:text-purple-300">{metrics.peptideViews.toLocaleString()}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    <span className="font-semibold text-purple-600">{metrics.peptideTrafficShare}%</span> of total store catalog views
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border shadow-xs bg-card">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-semibold text-muted-foreground">Unique Peptide Shoppers</CardTitle>
                                <User className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black text-foreground">{metrics.peptideUniqueSessions.toLocaleString()}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Distinct customer sessions browsing peptides
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border shadow-xs bg-card">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-semibold text-muted-foreground">Carts with Peptides</CardTitle>
                                <ShoppingCart className="h-4 w-4 text-indigo-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black text-foreground">{metrics.peptideCartsCount.toLocaleString()}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    ${metrics.peptideTotalCartValue.toFixed(2)} total value • {metrics.peptideCartConversionRate}% converted
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border shadow-xs bg-card">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-semibold text-muted-foreground">Peptide Cross-Sell Carts</CardTitle>
                                <Sparkles className="h-4 w-4 text-amber-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black text-amber-600">{metrics.combinedCartsCount.toLocaleString()}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Carts containing BOTH Water & Peptides
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Peptides Traffic Comparison & Top Peptides Leaderboard */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* Top Viewed Peptides Table */}
                        <Card className="lg:col-span-2 border shadow-xs">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base font-bold flex items-center gap-2">
                                            <FlaskConical className="h-4 w-4 text-purple-600" />
                                            Most Visited Research Peptides
                                        </CardTitle>
                                        <CardDescription>Individual product view frequency and unique visitor interest</CardDescription>
                                    </div>
                                    <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30 text-xs font-semibold">
                                        🧪 Peptides Catalog
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {topViewedPeptides.length === 0 ? (
                                    <div className="p-10 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                                        <FlaskConical className="h-8 w-8 text-muted-foreground/40" />
                                        <p className="font-semibold text-foreground text-sm">No peptide views recorded yet</p>
                                        <p className="text-muted-foreground">As visitors browse peptide products, their view metrics will show here.</p>
                                    </div>
                                ) : (
                                    <div className="rounded-md border-t overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/40">
                                                    <TableHead className="font-bold">Peptide Product</TableHead>
                                                    <TableHead className="font-bold">Category</TableHead>
                                                    <TableHead className="font-bold text-center">Total Views</TableHead>
                                                    <TableHead className="font-bold text-center">Unique Shoppers</TableHead>
                                                    <TableHead className="text-right font-bold">Traffic Share</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {topViewedPeptides.map((p, idx) => {
                                                    const share = metrics.peptideViews > 0 
                                                        ? ((p.views / metrics.peptideViews) * 100).toFixed(1) 
                                                        : "0.0";

                                                    return (
                                                        <TableRow key={p.productId} className="hover:bg-muted/30">
                                                            <TableCell className="font-semibold text-sm">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-mono text-xs text-muted-foreground w-4">{idx + 1}.</span>
                                                                    <span className="text-foreground">{p.name}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant="secondary" className="text-[10px] uppercase">
                                                                    {p.category}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-center font-bold text-sm">
                                                                {p.views.toLocaleString()}
                                                            </TableCell>
                                                            <TableCell className="text-center text-sm font-medium">
                                                                {p.uniqueVisitors.toLocaleString()}
                                                            </TableCell>
                                                            <TableCell className="text-right font-mono font-bold text-xs text-purple-600">
                                                                {share}%
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Product Line Breakdown Card */}
                        <Card className="border shadow-xs flex flex-col justify-between">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    <Layers className="h-4 w-4 text-primary" />
                                    Catalog Segment Share
                                </CardTitle>
                                <CardDescription>Peptides vs Reconstitution Solutions</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                
                                {/* Peptide Views Share */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-semibold">
                                        <span className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300">
                                            🧪 Research Peptides
                                        </span>
                                        <span className="font-mono">{metrics.peptideViews} views ({metrics.peptideTrafficShare}%)</span>
                                    </div>
                                    <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-purple-600 rounded-full transition-all duration-500" 
                                            style={{ width: `${Math.min(100, parseFloat(metrics.peptideTrafficShare) || 0)}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Reconstitution Solutions Views Share */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-semibold">
                                        <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                                            💧 Reconstitution Solutions
                                        </span>
                                        <span className="font-mono">
                                            {metrics.waterViews} views (
                                            {metrics.productViews > 0 
                                                ? ((metrics.waterViews / metrics.productViews) * 100).toFixed(1) 
                                                : 0}%)
                                        </span>
                                    </div>
                                    <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-blue-500 rounded-full transition-all duration-500" 
                                            style={{ 
                                                width: `${metrics.productViews > 0 
                                                    ? Math.min(100, (metrics.waterViews / metrics.productViews) * 100) 
                                                    : 0}%` 
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Cross-Sell & Upsell Performance Notice */}
                                <div className="p-4 rounded-xl border bg-purple-500/5 border-purple-500/20 text-xs space-y-1.5">
                                    <div className="flex items-center gap-2 font-bold text-purple-800 dark:text-purple-300">
                                        <Sparkles className="h-4 w-4 text-purple-600" />
                                        Cross-Sell & Upsell Opportunity
                                    </div>
                                    <p className="text-muted-foreground leading-relaxed">
                                        You have <strong className="text-foreground">{metrics.combinedCartsCount}</strong> shopping carts that paired Reconstitution Solutions with Research Peptides.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* TAB 2: ABANDONED CARTS & RECOVERY */}
                <TabsContent value="abandoned" className="space-y-6 animate-in fade-in-50">
                    <Card className="border shadow-xs">
                        <CardHeader className="pb-4">
                            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                                <div className="flex flex-1 items-center gap-3 w-full md:max-w-md">
                                    <div className="relative w-full">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search by customer email, name, product, or UTM..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-9 bg-background"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger className="w-[180px] bg-background">
                                            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                                            <SelectValue placeholder="Filter by status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Statuses ({effectiveCartSessions.length})</SelectItem>
                                            <SelectItem value="abandoned">Abandoned Only</SelectItem>
                                            <SelectItem value="active">Active / Idle</SelectItem>
                                            <SelectItem value="recovered">Recovered</SelectItem>
                                            <SelectItem value="converted">Converted / Ordered</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="rounded-md border-t overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/40">
                                            <TableHead className="font-bold">Customer / Contact</TableHead>
                                            <TableHead className="font-bold">Items in Cart</TableHead>
                                            <TableHead className="font-bold">Cart Subtotal</TableHead>
                                            <TableHead className="font-bold">Last Activity</TableHead>
                                            <TableHead className="font-bold">Traffic Source</TableHead>
                                            <TableHead className="font-bold">Status</TableHead>
                                            <TableHead className="text-right font-bold">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loadingCarts ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center py-12">
                                                    <div className="flex flex-col items-center justify-center gap-2">
                                                        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
                                                        <p className="text-sm text-muted-foreground">Loading cart sessions...</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredCarts.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center py-12">
                                                    <div className="flex flex-col items-center justify-center gap-2">
                                                        <ShoppingCart className="h-8 w-8 text-muted-foreground/50" />
                                                        <p className="text-sm font-semibold">No cart sessions found</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {searchTerm ? "Try adjusting your search criteria." : "Shopping carts created during this date range will appear here."}
                                                        </p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredCarts.map((cart) => {
                                                const itemCount = (cart.items || []).reduce((acc: number, item: any) => acc + (item.quantity || 1), 0);
                                                const previewItem = cart.items?.[0];

                                                return (
                                                    <TableRow key={cart.id} className="hover:bg-muted/50 transition-colors">
                                                        
                                                        {/* Customer & Location */}
                                                        <TableCell>
                                                            <div className="flex flex-col gap-0.5">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-semibold text-foreground text-sm">
                                                                        {cart.customer_name || cart.email || (cart.user_id ? "Registered Customer" : "Anonymous Guest")}
                                                                    </span>
                                                                    {cart.user_id && adminUserIds.includes(cart.user_id) ? (
                                                                        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-semibold">Admin Test</Badge>
                                                                    ) : cart.user_id ? (
                                                                        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-primary/10 text-primary border-primary/20">Account</Badge>
                                                                    ) : (
                                                                        <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground">Guest</Badge>
                                                                    )}
                                                                </div>
                                                                {cart.email && (
                                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                                        <Mail className="h-3 w-3" /> {cart.email}
                                                                    </span>
                                                                )}
                                                                {cart.phone && (
                                                                    <span className="text-[11px] text-muted-foreground">
                                                                        📞 {cart.phone}
                                                                    </span>
                                                                )}
                                                                {/* Passive GeoIP / Location */}
                                                                {(cart.country_code || cart.city || cart.country || cart.ip_address) && (
                                                                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5" title={`Location: ${[cart.city, cart.region, cart.country].filter(Boolean).join(", ")}${cart.ip_address ? ` • IP: ${cart.ip_address}` : ''}`}>
                                                                        <span className="text-xs select-none">
                                                                            {getCountryFlagEmoji(cart.country_code || undefined)}
                                                                        </span>
                                                                        <span className="truncate max-w-[130px] font-medium text-foreground/80">
                                                                            {[cart.city, cart.country_code || cart.country].filter(Boolean).join(", ")}
                                                                        </span>
                                                                        {cart.ip_address && (
                                                                            <span className="text-[10px] text-muted-foreground/60 font-mono">
                                                                                ({cart.ip_address})
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TableCell>

                                                        {/* Items in Cart */}
                                                        <TableCell>
                                                            <div 
                                                                className="flex items-center gap-2 cursor-pointer group"
                                                                onClick={() => {
                                                                    setSelectedCart(cart);
                                                                    setIsDetailsOpen(true);
                                                                }}
                                                            >
                                                                <div className="h-10 w-10 rounded-md border bg-muted/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                                    {previewItem?.variant?.image_url || previewItem?.variant?.product?.image_url ? (
                                                                        <img 
                                                                            src={previewItem?.variant?.image_url || previewItem?.variant?.product?.image_url} 
                                                                            alt="Preview" 
                                                                            className="h-full w-full object-cover" 
                                                                        />
                                                                    ) : (
                                                                        <Package className="h-5 w-5 text-muted-foreground/60" />
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                                                                        {previewItem?.variant?.product?.name || "Cart Items"}
                                                                    </span>
                                                                    <span className="text-[11px] text-muted-foreground">
                                                                        {itemCount} total unit{itemCount === 1 ? '' : 's'} {cart.items?.length > 1 ? `(${cart.items.length} products)` : ''}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </TableCell>

                                                        {/* Cart Subtotal */}
                                                        <TableCell>
                                                            <span className="font-bold text-sm text-foreground">
                                                                ${(Number(cart.subtotal) || 0).toFixed(2)}
                                                            </span>
                                                        </TableCell>

                                                        {/* Last Activity */}
                                                        <TableCell>
                                                            <div className="flex flex-col text-xs text-muted-foreground">
                                                                <span className="font-medium text-foreground">
                                                                    {formatDistanceToNow(new Date(cart.last_active_at), { addSuffix: true })}
                                                                </span>
                                                                <span className="text-[10px]">
                                                                    {format(new Date(cart.last_active_at), "MMM d, h:mm a")}
                                                                </span>
                                                            </div>
                                                        </TableCell>

                                                        {/* Traffic Source */}
                                                        <TableCell>
                                                            {cart.utm_source || cart.referrer ? (
                                                                <div className="flex flex-col gap-0.5">
                                                                    <Badge variant="outline" className="text-[10px] w-fit font-mono font-medium">
                                                                        {cart.utm_source || "Referral"}
                                                                    </Badge>
                                                                    {cart.utm_campaign && (
                                                                        <span className="text-[10px] text-muted-foreground">
                                                                            {cart.utm_campaign}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground">Direct</span>
                                                            )}
                                                        </TableCell>

                                                        {/* Status */}
                                                        <TableCell>
                                                            {getStatusBadge(cart.status, cart.last_active_at)}
                                                        </TableCell>

                                                        {/* Actions */}
                                                        <TableCell className="text-right">
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                
                                                                {/* 1-Click Recovery Link Copy */}
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                                    title="Copy 1-Click Recovery Link"
                                                                    onClick={() => handleCopyRecoveryLink(cart.recovery_token)}
                                                                >
                                                                    {copiedToken === cart.recovery_token ? (
                                                                        <Check className="h-4 w-4 text-emerald-600" />
                                                                    ) : (
                                                                        <Copy className="h-4 w-4" />
                                                                    )}
                                                                </Button>

                                                                {/* Send Email Recovery Button */}
                                                                {cart.email && cart.status !== "converted" && (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-8 text-xs font-semibold flex items-center gap-1.5 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border-emerald-500/30"
                                                                        disabled={isSendingEmail === cart.id}
                                                                        onClick={() => handleSendRecoveryEmail(cart)}
                                                                    >
                                                                        {isSendingEmail === cart.id ? (
                                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                        ) : (
                                                                            <Send className="h-3.5 w-3.5" />
                                                                        )}
                                                                        <span>Recover</span>
                                                                    </Button>
                                                                )}

                                                                {/* View Details Button */}
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 text-xs font-semibold"
                                                                    onClick={() => {
                                                                        setSelectedCart(cart);
                                                                        setIsDetailsOpen(true);
                                                                    }}
                                                                >
                                                                    Details
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 3: ATTRIBUTION & UTMS */}
                <TabsContent value="attribution" className="space-y-6 animate-in fade-in-50">
                    <Card className="border shadow-xs">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Globe className="h-4 w-4 text-primary" />
                                Traffic Source & UTM Marketing Attribution
                            </CardTitle>
                            <CardDescription>
                                Track which marketing campaigns, ad sources, or affiliates generate shopping carts and sales
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="rounded-md border-t">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/40">
                                            <TableHead className="font-bold">Traffic Channel / Source</TableHead>
                                            <TableHead className="font-bold">Carts Created</TableHead>
                                            <TableHead className="font-bold">Conversions Reclaimed</TableHead>
                                            <TableHead className="font-bold text-right">Potential Revenue</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {attributionData.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-10 text-xs text-muted-foreground">
                                                    No attribution data recorded for this date range.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            attributionData.map((item) => (
                                                <TableRow key={item.source}>
                                                    <TableCell className="font-semibold text-sm">
                                                        <Badge variant="outline" className="font-mono">
                                                            {item.source}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="font-medium text-sm">
                                                        {item.carts}
                                                    </TableCell>
                                                    <TableCell className="font-semibold text-emerald-600 text-sm">
                                                        {item.converted} ({item.carts > 0 ? ((item.converted / item.carts) * 100).toFixed(0) : 0}%)
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold text-sm">
                                                        ${item.revenue.toFixed(2)} USD
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Cart Details Dialog */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <ShoppingCart className="h-5 w-5 text-primary" />
                            Cart Session Breakdown
                        </DialogTitle>
                        <DialogDescription>
                            Session ID: <span className="font-mono text-xs">{selectedCart?.session_id}</span>
                        </DialogDescription>
                    </DialogHeader>

                    {selectedCart && (
                        <div className="space-y-6 pt-2">
                            {/* Customer & Tracking Metadata */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl border bg-muted/20 text-xs">
                                <div>
                                    <span className="text-muted-foreground block">Customer Name</span>
                                    <span className="font-semibold text-foreground text-sm">
                                        {selectedCart.customer_name || (selectedCart.user_id ? "Registered Customer" : "Guest")}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Email</span>
                                    <span className="font-semibold text-foreground text-sm break-all">
                                        {selectedCart.email || "Not entered"}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Phone</span>
                                    <span className="font-semibold text-foreground text-sm">
                                        {selectedCart.phone || "Not entered"}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Location (GeoIP)</span>
                                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                                        {selectedCart.country_code && (
                                            <span className="text-sm">{getCountryFlagEmoji(selectedCart.country_code)}</span>
                                        )}
                                        <span>
                                            {[selectedCart.city, selectedCart.region, selectedCart.country].filter(Boolean).join(", ") || "Unknown"}
                                        </span>
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">IP Address</span>
                                    <span className="font-mono font-medium text-foreground">
                                        {selectedCart.ip_address || "Not recorded"}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Traffic Channel</span>
                                    <span className="font-semibold text-foreground">
                                        {selectedCart.utm_source || selectedCart.referrer || "Direct"}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Created At</span>
                                    <span className="font-semibold text-foreground">
                                        {format(new Date(selectedCart.created_at), "MMM d, yyyy h:mm a")}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Last Active</span>
                                    <span className="font-semibold text-foreground">
                                        {format(new Date(selectedCart.last_active_at), "MMM d, yyyy h:mm a")}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Recovery Emails Sent</span>
                                    <Badge variant="secondary" className="font-bold">
                                        {selectedCart.recovery_email_sent_count} email(s)
                                    </Badge>
                                </div>
                            </div>

                            {/* Items List */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Items in Cart ({(selectedCart.items || []).length})
                                </h4>
                                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                    {(selectedCart.items || []).map((item: any, idx: number) => {
                                        const displayImage = item.variant?.image_url || item.variant?.product?.image_url;
                                        return (
                                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded border bg-muted/30 overflow-hidden flex items-center justify-center flex-shrink-0">
                                                        {displayImage ? (
                                                            <img src={displayImage} alt="Product" className="h-full w-full object-cover" />
                                                        ) : (
                                                            <Package className="h-5 w-5 text-muted-foreground/60" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-sm text-foreground">{item.variant?.product?.name || "Product"}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {item.variant?.vial_type?.name || `${item.variant?.vial_type?.capacity_ml}ml`}
                                                            {item.variant?.pack_size > 1 ? ` • ${item.variant.pack_size}x Pack` : ''}
                                                            {item.is_bulk ? ' • Bulk Purchase' : ''}
                                                            <span> • Qty: {item.quantity}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="font-bold text-sm">
                                                    ${((item.variant?.price || 0) * item.quantity).toFixed(2)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="flex justify-between items-center p-3 rounded-lg border bg-muted/40 font-bold text-base">
                                    <span>Total Subtotal:</span>
                                    <span className="text-primary">${(Number(selectedCart.subtotal) || 0).toFixed(2)} USD</span>
                                </div>
                            </div>

                            {/* Actions in Modal */}
                            <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 border-t">
                                <Button
                                    variant="outline"
                                    className="flex items-center gap-2"
                                    onClick={() => handleCopyRecoveryLink(selectedCart.recovery_token)}
                                >
                                    <Copy className="h-4 w-4" />
                                    Copy 1-Click Recovery URL
                                </Button>

                                {selectedCart.email && selectedCart.status !== "converted" && (
                                    <Button
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2"
                                        disabled={isSendingEmail === selectedCart.id}
                                        onClick={() => handleSendRecoveryEmail(selectedCart)}
                                    >
                                        {isSendingEmail === selectedCart.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Send className="h-4 w-4" />
                                        )}
                                        Send Recovery Email Now
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
