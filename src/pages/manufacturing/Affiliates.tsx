import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import {
    Users,
    DollarSign,
    TrendingUp,
    CreditCard,
    Plus,
    Search,
    RefreshCcw,
    Copy,
    Check,
    ExternalLink,
    Settings,
    Edit,
    Trash2,
    Calendar,
    ChevronRight,
    ArrowUpRight,
    ShoppingBag,
    History,
    CheckCircle2,
    Clock,
    AlertCircle,
    XCircle,
    Share2,
    Wallet,
    Percent,
    Sparkles,
    Eye
} from "lucide-react";
import { cn } from "@/lib/utils";

function parseAffiliateError(err: any, promoCode?: string): string {
    const rawMsg = (err?.message || err?.details || String(err || "")).toLowerCase();
    
    if (rawMsg.includes("affiliates_promo_code_key") || (rawMsg.includes("unique") && rawMsg.includes("promo_code"))) {
        return promoCode 
            ? `The promo code "${promoCode}" is already in use by another promoter or coupon. Please enter a different code.`
            : "This promo code is already in use. Please enter a different code.";
    }

    if (rawMsg.includes("affiliates_email_key") || (rawMsg.includes("unique") && rawMsg.includes("email"))) {
        return "An affiliate with this email address is already registered.";
    }

    if (rawMsg.includes("violates foreign key constraint")) {
        return "Cannot perform this action due to linked order or commission dependencies.";
    }

    return err?.message || "Failed to save promoter information.";
}

interface Affiliate {
    id: string;
    user_id: string | null;
    name: string;
    email: string;
    phone: string | null;
    social_handle: string | null;
    promo_code: string;
    is_custom_rates: boolean;
    customer_discount_type: "percentage" | "fixed_amount";
    customer_discount_value: number;
    commission_type: "percentage" | "fixed_per_order";
    commission_rate: number;
    commission_basis: "net_subtotal" | "gross_subtotal";
    payout_method: string;
    payout_details: any;
    status: "active" | "inactive" | "suspended";
    max_uses: number | null;
    expires_at: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

interface AffiliateCommission {
    id: string;
    affiliate_id: string;
    order_id: string;
    coupon_code: string;
    customer_email: string | null;
    order_subtotal: number;
    customer_discount_amount: number;
    commission_rate: number;
    commission_amount: number;
    status: "pending" | "approved" | "rejected" | "paid";
    payout_id: string | null;
    created_at: string;
    updated_at: string;
    orders?: {
        id?: string;
        customer_name?: string;
        customer_email?: string;
        total_amount?: number;
        status?: string;
        created_at?: string;
    } | null;
}

interface AffiliatePayout {
    id: string;
    affiliate_id: string;
    amount: number;
    payment_method: string;
    transaction_reference: string | null;
    receipt_url: string | null;
    payment_date: string;
    notes: string | null;
    created_by: string | null;
    created_at: string;
}

export default function Affiliates() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    
    // Modals & Drawers state
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingAffiliate, setEditingAffiliate] = useState<Affiliate | null>(null);
    const [deletingAffiliate, setDeletingAffiliate] = useState<Affiliate | null>(null);
    const [payoutAffiliate, setPayoutAffiliate] = useState<Affiliate | null>(null);
    const [selectedDetailAffiliate, setSelectedDetailAffiliate] = useState<Affiliate | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    // 1. Fetch Global Settings
    const { data: appSettings, refetch: refetchSettings } = useQuery({
        queryKey: ["affiliate-settings"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("app_settings")
                .select("key, value")
                .in("key", [
                    "affiliate_program_enabled",
                    "affiliate_default_customer_discount_type",
                    "affiliate_default_customer_discount_value",
                    "affiliate_default_commission_type",
                    "affiliate_default_commission_rate",
                    "affiliate_min_payout_threshold",
                    "affiliate_commission_basis"
                ]);
            if (error) throw error;
            const map: Record<string, string> = {};
            data?.forEach(s => { map[s.key] = s.value; });
            return map;
        }
    });

    // 2. Fetch All Affiliates
    const { data: affiliates = [], isLoading: isLoadingAffiliates, refetch: refetchAffiliates } = useQuery({
        queryKey: ["affiliates-list"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("affiliates" as any)
                .select("*")
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data as unknown as Affiliate[];
        }
    });

    // 3. Fetch All Commissions
    const { data: commissions = [], isLoading: isLoadingCommissions, refetch: refetchCommissions } = useQuery({
        queryKey: ["affiliate-commissions-all"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("affiliate_commissions" as any)
                .select("*, orders:order_id(id, customer_name, customer_email, total_amount, status, created_at)")
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data as unknown as AffiliateCommission[];
        }
    });

    // 4. Fetch All Payouts
    const { data: payouts = [], isLoading: isLoadingPayouts, refetch: refetchPayouts } = useQuery({
        queryKey: ["affiliate-payouts-all"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("affiliate_payouts" as any)
                .select("*")
                .order("payment_date", { ascending: false });
            if (error) throw error;
            return data as unknown as AffiliatePayout[];
        }
    });

    // Aggregate promoter metrics
    const affiliateStats = useMemo(() => {
        const stats: Record<string, {
            ordersCount: number;
            totalSalesVolume: number;
            totalEarned: number;
            pendingBalance: number;
            totalPaid: number;
        }> = {};

        affiliates.forEach(aff => {
            stats[aff.id] = {
                ordersCount: 0,
                totalSalesVolume: 0,
                totalEarned: 0,
                pendingBalance: 0,
                totalPaid: 0,
            };
        });

        commissions.forEach(c => {
            if (stats[c.affiliate_id]) {
                if (c.status !== "rejected") {
                    stats[c.affiliate_id].ordersCount += 1;
                    stats[c.affiliate_id].totalSalesVolume += Number(c.order_subtotal || 0);
                    stats[c.affiliate_id].totalEarned += Number(c.commission_amount || 0);
                    if (c.status === "approved") {
                        stats[c.affiliate_id].pendingBalance += Number(c.commission_amount || 0);
                    }
                }
            }
        });

        payouts.forEach(p => {
            if (stats[p.affiliate_id]) {
                stats[p.affiliate_id].totalPaid += Number(p.amount || 0);
            }
        });

        return stats;
    }, [affiliates, commissions, payouts]);

    // Global KPIs Calculation
    const globalKpis = useMemo(() => {
        let totalSales = 0;
        let totalEarned = 0;
        let totalPending = 0;
        let totalPaid = 0;

        Object.values(affiliateStats).forEach(s => {
            totalSales += s.totalSalesVolume;
            totalEarned += s.totalEarned;
            totalPending += s.pendingBalance;
            totalPaid += s.totalPaid;
        });

        const activeCount = affiliates.filter(a => a.status === "active").length;

        return {
            totalSales,
            totalEarned,
            totalPending,
            totalPaid,
            activeCount,
            totalPromoters: affiliates.length
        };
    }, [affiliateStats, affiliates]);

    // Filtered Affiliates Table
    const filteredAffiliates = useMemo(() => {
        return affiliates.filter(aff => {
            const matchesSearch = 
                aff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                aff.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                aff.promo_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (aff.social_handle && aff.social_handle.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesStatus = statusFilter === "all" || aff.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [affiliates, searchQuery, statusFilter]);

    // Copy Referral Link helper
    const handleCopyLink = (code: string) => {
        const url = `${window.location.origin}/?ref=${encodeURIComponent(code)}`;
        navigator.clipboard.writeText(url);
        setCopiedCode(code);
        toast.success(`Copied referral link: ${url}`);
        setTimeout(() => setCopiedCode(null), 2500);
    };

    // Toggle promoter status mutation
    const toggleStatusMutation = useMutation({
        mutationFn: async ({ id, newStatus }: { id: string; newStatus: "active" | "inactive" | "suspended" }) => {
            const { error } = await supabase
                .from("affiliates" as any)
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["affiliates-list"] });
            toast.success("Promoter status updated");
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to update status");
        }
    });

    // Delete affiliate mutation
    const deleteAffiliateMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from("affiliates" as any)
                .delete()
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["affiliates-list"] });
            toast.success("Promoter deleted successfully");
            setDeletingAffiliate(null);
        },
        onError: (err: any) => {
            toast.error(err.message || "Could not delete promoter");
        }
    });

    // Save Settings Mutation
    const saveSettingsMutation = useMutation({
        mutationFn: async (newSettings: Record<string, string>) => {
            for (const [key, value] of Object.entries(newSettings)) {
                const { error } = await supabase
                    .from("app_settings")
                    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["affiliate-settings"] });
            toast.success("Program settings updated successfully");
            setIsSettingsOpen(false);
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to save settings");
        }
    });

    const isProgramEnabled = appSettings?.affiliate_program_enabled !== "false";

    return (
        <div className="space-y-8 p-6 max-w-[1600px] mx-auto animate-in fade-in duration-300">
            {/* Header with Title & Action Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                            <Users className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Affiliates & Influencers</h1>
                            <p className="text-muted-foreground text-sm">
                                Manage promoters, track order commissions, configure rates, and register payouts.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <Button 
                        variant="outline" 
                        className="gap-2" 
                        onClick={() => {
                            refetchAffiliates();
                            refetchCommissions();
                            refetchPayouts();
                            toast.success("Data refreshed");
                        }}
                    >
                        <RefreshCcw className="w-4 h-4" />
                        Refresh
                    </Button>
                    <Button 
                        variant="outline" 
                        className="gap-2"
                        onClick={() => setIsSettingsOpen(true)}
                    >
                        <Settings className="w-4 h-4" />
                        Program Settings
                    </Button>
                    <Button 
                        className="gap-2 shadow-sm font-semibold"
                        onClick={() => setIsCreateOpen(true)}
                    >
                        <Plus className="w-4 h-4" />
                        New Promoter
                    </Button>
                </div>
            </div>

            {/* Master Switch Alert Banner if Disabled */}
            {!isProgramEnabled && (
                <div className="bg-amber-500/15 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between gap-4 text-amber-900 dark:text-amber-200">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                        <div>
                            <p className="font-semibold text-sm">Affiliate Program is Currently Disabled</p>
                            <p className="text-xs text-muted-foreground">Promoter promo codes and links are currently inactive at checkout.</p>
                        </div>
                    </div>
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="border-amber-500/40 hover:bg-amber-500/10 text-xs font-semibold"
                        onClick={() => saveSettingsMutation.mutate({ affiliate_program_enabled: "true" })}
                    >
                        Enable Program Now
                    </Button>
                </div>
            )}

            {/* Global KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-card to-card/50">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Total Influencer Sales
                        </CardTitle>
                        <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                            <TrendingUp className="w-4 h-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tracking-tight">
                            ${globalKpis.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Across all promoter promo codes
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-card to-card/50">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Commissions Earned
                        </CardTitle>
                        <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg">
                            <Percent className="w-4 h-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tracking-tight">
                            ${globalKpis.totalEarned.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Total commissions generated
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                            Outstanding Balance to Pay
                        </CardTitle>
                        <div className="p-2 bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 rounded-lg">
                            <DollarSign className="w-4 h-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 tracking-tight">
                            ${globalKpis.totalPending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1 font-medium">
                            Approved & ready for payout
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-card to-card/50">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Total Paid Out
                        </CardTitle>
                        <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
                            <Wallet className="w-4 h-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold tracking-tight">
                            ${globalKpis.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {globalKpis.activeCount} active of {globalKpis.totalPromoters} promoters
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Filter Bar & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                    <div className="relative w-full">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search promoter name, email, code, @social..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-background"
                        />
                    </div>
                    {searchQuery && (
                        <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")}>
                            Clear
                        </Button>
                    )}
                </div>

                {/* Status Filter Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto">
                    {[
                        { id: "all", label: "All Promoters" },
                        { id: "active", label: "Active" },
                        { id: "inactive", label: "Paused / Inactive" },
                        { id: "suspended", label: "Suspended" },
                    ].map(tab => (
                        <Button
                            key={tab.id}
                            variant={statusFilter === tab.id ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setStatusFilter(tab.id)}
                            className={cn(
                                "text-xs font-semibold rounded-lg h-8",
                                statusFilter === tab.id ? "shadow-xs" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {tab.label}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Promoters Main Directory Table */}
            <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/40">
                        <TableRow>
                            <TableHead className="font-semibold">Promoter / Contact</TableHead>
                            <TableHead className="font-semibold">Promo Code & Link</TableHead>
                            <TableHead className="font-semibold">Rules (% / $)</TableHead>
                            <TableHead className="font-semibold text-center">Orders</TableHead>
                            <TableHead className="font-semibold text-right">Total Sales</TableHead>
                            <TableHead className="font-semibold text-right">Earned</TableHead>
                            <TableHead className="font-semibold text-right">Unpaid Balance</TableHead>
                            <TableHead className="font-semibold text-center">Status</TableHead>
                            <TableHead className="font-semibold text-right pr-6">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoadingAffiliates ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-40 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <RefreshCcw className="w-5 h-5 animate-spin text-primary" />
                                        <span>Loading promoters directory...</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : filteredAffiliates.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9} className="h-48 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <Users className="w-8 h-8 text-muted-foreground/50 mb-1" />
                                        <p className="font-semibold text-foreground">No promoters found</p>
                                        <p className="text-xs">
                                            {searchQuery ? "Try refining your search filter" : "Get started by adding your first influencer or brand ambassador."}
                                        </p>
                                        {!searchQuery && (
                                            <Button size="sm" className="mt-2" onClick={() => setIsCreateOpen(true)}>
                                                <Plus className="w-4 h-4 mr-1.5" /> Add Promoter
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredAffiliates.map((aff) => {
                                const stats = affiliateStats[aff.id] || {
                                    ordersCount: 0,
                                    totalSalesVolume: 0,
                                    totalEarned: 0,
                                    pendingBalance: 0,
                                    totalPaid: 0,
                                };

                                const discText = aff.is_custom_rates 
                                    ? (aff.customer_discount_type === 'percentage' ? `${aff.customer_discount_value}% OFF` : `$${aff.customer_discount_value} OFF`)
                                    : `${appSettings?.affiliate_default_customer_discount_value || 10}% OFF (Default)`;

                                const commText = aff.is_custom_rates 
                                    ? (aff.commission_type === 'percentage' ? `${aff.commission_rate}% Comm.` : `$${aff.commission_rate}/order`)
                                    : `${appSettings?.affiliate_default_commission_rate || 10}% Comm. (Default)`;

                                return (
                                    <TableRow key={aff.id} className="hover:bg-muted/30 transition-colors">
                                        {/* Promoter info */}
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-foreground hover:underline cursor-pointer" onClick={() => setSelectedDetailAffiliate(aff)}>
                                                    {aff.name}
                                                </span>
                                                <span className="text-xs text-muted-foreground">{aff.email}</span>
                                                {aff.social_handle && (
                                                    <span className="text-xs font-medium text-primary mt-0.5">
                                                        {aff.social_handle}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>

                                        {/* Promo Code & Copy Link */}
                                        <TableCell>
                                            <div className="flex items-center gap-1.5">
                                                <Badge variant="outline" className="font-mono font-bold text-xs bg-muted/50 px-2 py-0.5 border-primary/30 text-primary">
                                                    {aff.promo_code}
                                                </Badge>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                    title="Copy shareable referral link"
                                                    onClick={() => handleCopyLink(aff.promo_code)}
                                                >
                                                    {copiedCode === aff.promo_code ? (
                                                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                                                    ) : (
                                                        <Copy className="w-3.5 h-3.5" />
                                                    )}
                                                </Button>
                                            </div>
                                        </TableCell>

                                        {/* Rules */}
                                        <TableCell>
                                            <div className="flex flex-col text-xs">
                                                <span className="font-semibold text-foreground">User: {discText}</span>
                                                <span className="text-muted-foreground">Promoter: {commText}</span>
                                            </div>
                                        </TableCell>

                                        {/* Orders count */}
                                        <TableCell className="text-center font-semibold">
                                            {stats.ordersCount}
                                        </TableCell>

                                        {/* Total sales generated */}
                                        <TableCell className="text-right font-medium">
                                            ${stats.totalSalesVolume.toFixed(2)}
                                        </TableCell>

                                        {/* Total Earned */}
                                        <TableCell className="text-right font-semibold text-foreground">
                                            ${stats.totalEarned.toFixed(2)}
                                        </TableCell>

                                        {/* Unpaid Pending Balance */}
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <span className={cn(
                                                    "font-bold text-sm",
                                                    stats.pendingBalance > 0 
                                                        ? "text-emerald-600 dark:text-emerald-400" 
                                                        : "text-muted-foreground"
                                                )}>
                                                    ${stats.pendingBalance.toFixed(2)}
                                                </span>
                                                {stats.pendingBalance > 0 && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-6 text-[11px] px-2 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20 font-bold"
                                                        onClick={() => setPayoutAffiliate(aff)}
                                                    >
                                                        Pay
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>

                                        {/* Status */}
                                        <TableCell className="text-center">
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "cursor-pointer text-[11px] font-semibold select-none",
                                                    aff.status === "active" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
                                                    aff.status === "inactive" && "bg-muted text-muted-foreground border-border",
                                                    aff.status === "suspended" && "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30"
                                                )}
                                                onClick={() => {
                                                    const nextStatus = aff.status === "active" ? "inactive" : "active";
                                                    toggleStatusMutation.mutate({ id: aff.id, newStatus: nextStatus });
                                                }}
                                                title="Click to toggle Active / Inactive"
                                            >
                                                {aff.status === "active" ? "● Active" : aff.status === "suspended" ? "✕ Suspended" : "○ Paused"}
                                            </Badge>
                                        </TableCell>

                                        {/* Actions */}
                                        <TableCell className="text-right pr-6">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                    title="View order history and payouts"
                                                    onClick={() => setSelectedDetailAffiliate(aff)}
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                    title="Edit promoter"
                                                    onClick={() => setEditingAffiliate(aff)}
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-red-500"
                                                    title="Delete promoter"
                                                    onClick={() => setDeletingAffiliate(aff)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
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

            {/* 1. Modal: Create / Edit Promoter */}
            <PromoterFormDialog
                isOpen={isCreateOpen || !!editingAffiliate}
                onClose={() => {
                    setIsCreateOpen(false);
                    setEditingAffiliate(null);
                }}
                editingAffiliate={editingAffiliate}
                globalSettings={appSettings}
                onSuccess={() => {
                    refetchAffiliates();
                    setIsCreateOpen(false);
                    setEditingAffiliate(null);
                }}
            />

            {/* 2. Modal: Record Payout */}
            {payoutAffiliate && (
                <RecordPayoutDialog
                    isOpen={!!payoutAffiliate}
                    onClose={() => setPayoutAffiliate(null)}
                    affiliate={payoutAffiliate}
                    pendingBalance={affiliateStats[payoutAffiliate.id]?.pendingBalance || 0}
                    onSuccess={() => {
                        refetchCommissions();
                        refetchPayouts();
                        setPayoutAffiliate(null);
                    }}
                />
            )}

            {/* 3. Drawer: Detailed Promoter View (Orders & Payouts) */}
            {selectedDetailAffiliate && (
                <PromoterDetailSheet
                    isOpen={!!selectedDetailAffiliate}
                    onClose={() => setSelectedDetailAffiliate(null)}
                    affiliate={selectedDetailAffiliate}
                    commissions={commissions.filter(c => c.affiliate_id === selectedDetailAffiliate.id)}
                    payouts={payouts.filter(p => p.affiliate_id === selectedDetailAffiliate.id)}
                    stats={affiliateStats[selectedDetailAffiliate.id]}
                    onRecordPayout={() => {
                        const target = selectedDetailAffiliate;
                        setSelectedDetailAffiliate(null);
                        setPayoutAffiliate(target);
                    }}
                />
            )}

            {/* 4. Modal: Global Program Settings */}
            <ProgramSettingsDialog
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                currentSettings={appSettings || {}}
                onSave={(newSettings) => saveSettingsMutation.mutate(newSettings)}
                isLoading={saveSettingsMutation.isPending}
            />

            {/* 5. Alert Dialog: Confirm Delete */}
            <AlertDialog open={!!deletingAffiliate} onOpenChange={(open) => !open && setDeletingAffiliate(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Promoter: {deletingAffiliate?.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove this promoter? Their promo code (<span className="font-mono font-bold text-foreground">{deletingAffiliate?.promo_code}</span>) will be permanently deactivated. Associated past orders will be preserved.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                            onClick={() => deletingAffiliate && deleteAffiliateMutation.mutate(deletingAffiliate.id)}
                        >
                            Delete Promoter
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// -----------------------------------------------------------------------------
// Component: Create / Edit Promoter Dialog
// -----------------------------------------------------------------------------
interface PromoterFormDialogProps {
    isOpen: boolean;
    onClose: () => void;
    editingAffiliate: Affiliate | null;
    globalSettings?: Record<string, string>;
    onSuccess: () => void;
}

function PromoterFormDialog({ isOpen, onClose, editingAffiliate, globalSettings, onSuccess }: PromoterFormDialogProps) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [socialHandle, setSocialHandle] = useState("");
    const [promoCode, setPromoCode] = useState("");
    const [isCustomRates, setIsCustomRates] = useState(false);
    const [customerDiscountType, setCustomerDiscountType] = useState<"percentage" | "fixed_amount">("percentage");
    const [customerDiscountValue, setCustomerDiscountValue] = useState<number>(10);
    const [commissionType, setCommissionType] = useState<"percentage" | "fixed_per_order">("percentage");
    const [commissionRate, setCommissionRate] = useState<number>(10);
    const [commissionBasis, setCommissionBasis] = useState<"net_subtotal" | "gross_subtotal">("net_subtotal");
    const [payoutMethod, setPayoutMethod] = useState("zelle");
    const [payoutDetailsText, setPayoutDetailsText] = useState("");
    const [status, setStatus] = useState<"active" | "inactive" | "suspended">("active");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Sync on open
    React.useEffect(() => {
        if (editingAffiliate) {
            setName(editingAffiliate.name || "");
            setEmail(editingAffiliate.email || "");
            setPhone(editingAffiliate.phone || "");
            setSocialHandle(editingAffiliate.social_handle || "");
            setPromoCode(editingAffiliate.promo_code || "");
            setIsCustomRates(!!editingAffiliate.is_custom_rates);
            setCustomerDiscountType(editingAffiliate.customer_discount_type || "percentage");
            setCustomerDiscountValue(editingAffiliate.customer_discount_value || 10);
            setCommissionType(editingAffiliate.commission_type || "percentage");
            setCommissionRate(editingAffiliate.commission_rate || 10);
            setCommissionBasis(editingAffiliate.commission_basis || "net_subtotal");
            setPayoutMethod(editingAffiliate.payout_method || "zelle");
            setPayoutDetailsText(
                typeof editingAffiliate.payout_details === "string" 
                    ? editingAffiliate.payout_details 
                    : JSON.stringify(editingAffiliate.payout_details || {}, null, 2)
            );
            setStatus(editingAffiliate.status || "active");
            setNotes(editingAffiliate.notes || "");
        } else {
            setName("");
            setEmail("");
            setPhone("");
            setSocialHandle("");
            setPromoCode("");
            setIsCustomRates(false);
            setCustomerDiscountType((globalSettings?.affiliate_default_customer_discount_type as any) || "percentage");
            setCustomerDiscountValue(Number(globalSettings?.affiliate_default_customer_discount_value) || 10);
            setCommissionType((globalSettings?.affiliate_default_commission_type as any) || "percentage");
            setCommissionRate(Number(globalSettings?.affiliate_default_commission_rate) || 10);
            setCommissionBasis((globalSettings?.affiliate_commission_basis as any) || "net_subtotal");
            setPayoutMethod("zelle");
            setPayoutDetailsText("");
            setStatus("active");
            setNotes("");
        }
    }, [editingAffiliate, isOpen, globalSettings]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !email.trim() || !promoCode.trim()) {
            toast.error("Please fill in promoter Name, Email and Promo Code.");
            return;
        }

        const cleanCode = promoCode.trim().toUpperCase().replace(/\s+/g, "");

        setIsSubmitting(true);
        try {
            let parsedDetails: any = payoutDetailsText.trim();
            try {
                if (parsedDetails.startsWith("{") && parsedDetails.endsWith("}")) {
                    parsedDetails = JSON.parse(parsedDetails);
                }
            } catch (_) {}

            const payload: any = {
                name: name.trim(),
                email: email.trim().toLowerCase(),
                phone: phone.trim() || null,
                social_handle: socialHandle.trim() || null,
                promo_code: cleanCode,
                is_custom_rates: isCustomRates,
                customer_discount_type: customerDiscountType,
                customer_discount_value: Number(customerDiscountValue) || 0,
                commission_type: commissionType,
                commission_rate: Number(commissionRate) || 0,
                commission_basis: commissionBasis,
                payout_method: payoutMethod,
                payout_details: parsedDetails,
                status: status,
                notes: notes.trim() || null,
                updated_at: new Date().toISOString(),
            };

            if (editingAffiliate) {
                const { error } = await supabase
                    .from("affiliates" as any)
                    .update(payload)
                    .eq("id", editingAffiliate.id);
                if (error) throw error;
                toast.success("Promoter updated successfully!");
            } else {
                payload.created_at = new Date().toISOString();
                const { error } = await supabase
                    .from("affiliates" as any)
                    .insert(payload);
                if (error) throw error;
                toast.success(`Promoter ${cleanCode} created successfully!`);
            }

            onSuccess();
        } catch (err: any) {
            console.error("Promoter save error:", err);
            toast.error(parseAffiliateError(err, cleanCode));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary" />
                        {editingAffiliate ? `Edit Promoter: ${editingAffiliate.name}` : "Create New Influencer / Promoter"}
                    </DialogTitle>
                    <DialogDescription>
                        Set up the promoter's profile, exclusive promo code, custom commission rates, and payment info.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 pt-2">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Full Name *</Label>
                            <Input
                                placeholder="e.g. Alex Morales"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Email Address *</Label>
                            <Input
                                type="email"
                                placeholder="e.g. alex@creator.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Social Handle / Channel</Label>
                            <Input
                                placeholder="e.g. @fitnessalex (TikTok / IG)"
                                value={socialHandle}
                                onChange={(e) => setSocialHandle(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Phone Number (Optional)</Label>
                            <Input
                                placeholder="e.g. +1 555 123 4567"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Promo Code Box */}
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="text-sm font-bold text-foreground">Exclusive Promo Code *</Label>
                                <p className="text-xs text-muted-foreground">The unique code their followers will use at checkout.</p>
                            </div>
                            <Badge variant="outline" className="font-mono text-xs">Auto-Uppercase</Badge>
                        </div>
                        <Input
                            placeholder="e.g. ALEX15"
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                            className="font-mono text-base font-bold tracking-wider uppercase bg-background"
                            required
                        />
                    </div>

                    {/* Commission & Discount Rates */}
                    <div className="border rounded-xl p-4 space-y-4 bg-muted/20">
                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="text-sm font-bold">Custom Commission & Discount Rules</Label>
                                <p className="text-xs text-muted-foreground">
                                    Override global defaults to offer custom percentages to this promoter.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground">
                                    {isCustomRates ? "Custom Deal" : "Use Global Defaults"}
                                </span>
                                <Switch
                                    checked={isCustomRates}
                                    onCheckedChange={setIsCustomRates}
                                />
                            </div>
                        </div>

                        {isCustomRates ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Customer Discount</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={customerDiscountValue}
                                            onChange={(e) => setCustomerDiscountValue(parseFloat(e.target.value) || 0)}
                                            className="w-2/3"
                                        />
                                        <Select
                                            value={customerDiscountType}
                                            onValueChange={(val: any) => setCustomerDiscountType(val)}
                                        >
                                            <SelectTrigger className="w-1/3">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="percentage">% OFF</SelectItem>
                                                <SelectItem value="fixed_amount">$ OFF</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Promoter Commission</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={commissionRate}
                                            onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
                                            className="w-2/3"
                                        />
                                        <Select
                                            value={commissionType}
                                            onValueChange={(val: any) => setCommissionType(val)}
                                        >
                                            <SelectTrigger className="w-1/3">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="percentage">% of Sale</SelectItem>
                                                <SelectItem value="fixed_per_order">$ / Order</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg flex items-center justify-between">
                                <span>Using Global Defaults:</span>
                                <span className="font-semibold text-foreground">
                                    {globalSettings?.affiliate_default_customer_discount_value || 10}% Customer Discount &bull; {globalSettings?.affiliate_default_commission_rate || 10}% Promoter Commission
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Payment / Payout Information */}
                    <div className="space-y-3">
                        <Label className="text-sm font-bold">Payment & Payout Details</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Preferred Method</Label>
                                <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="zelle">Zelle</SelectItem>
                                        <SelectItem value="paypal">PayPal</SelectItem>
                                        <SelectItem value="cashapp">CashApp</SelectItem>
                                        <SelectItem value="venmo">Venmo</SelectItem>
                                        <SelectItem value="wire">Bank Wire Transfer</SelectItem>
                                        <SelectItem value="crypto">Crypto (USDT / BTC)</SelectItem>
                                        <SelectItem value="other">Other / Check</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="sm:col-span-2 space-y-1.5">
                                <Label className="text-xs font-semibold">Account / Handle Details</Label>
                                <Input
                                    placeholder="e.g. Zelle Email: alex@gmail.com, Name: Alex Morales"
                                    value={payoutDetailsText}
                                    onChange={(e) => setPayoutDetailsText(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Status & Notes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Account Status</Label>
                            <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active (Can Earn Commissions)</SelectItem>
                                    <SelectItem value="inactive">Paused / Inactive</SelectItem>
                                    <SelectItem value="suspended">Suspended</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Internal Notes</Label>
                            <Input
                                placeholder="Contract details, agreed monthly target, etc."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter className="pt-4 border-t gap-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="font-semibold">
                            {isSubmitting ? "Saving..." : editingAffiliate ? "Save Changes" : "Create Promoter"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// -----------------------------------------------------------------------------
// Component: Record Payout Modal
// -----------------------------------------------------------------------------
interface RecordPayoutDialogProps {
    isOpen: boolean;
    onClose: () => void;
    affiliate: Affiliate;
    pendingBalance: number;
    onSuccess: () => void;
}

function RecordPayoutDialog({ isOpen, onClose, affiliate, pendingBalance, onSuccess }: RecordPayoutDialogProps) {
    const [amount, setAmount] = useState(pendingBalance.toString());
    const [paymentMethod, setPaymentMethod] = useState(affiliate.payout_method || "zelle");
    const [transactionReference, setTransactionReference] = useState("");
    const [receiptUrl, setReceiptUrl] = useState("");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payAmount = parseFloat(amount);
        if (isNaN(payAmount) || payAmount <= 0) {
            toast.error("Please enter a valid payout amount greater than $0.");
            return;
        }

        setIsSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { data, error } = await supabase.rpc("record_affiliate_payout", {
                p_affiliate_id: affiliate.id,
                p_amount: payAmount,
                p_payment_method: paymentMethod,
                p_transaction_reference: transactionReference.trim() || null,
                p_receipt_url: receiptUrl.trim() || null,
                p_notes: notes.trim() || null,
                p_created_by: user?.id || null,
            });

            if (error) throw error;

            toast.success(`Successfully registered $${payAmount.toFixed(2)} payout for ${affiliate.name}!`);
            onSuccess();
        } catch (err: any) {
            console.error("Payout error:", err);
            toast.error(err.message || "Failed to record payout");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <Wallet className="w-5 h-5" />
                        Record Payout: {affiliate.name}
                    </DialogTitle>
                    <DialogDescription>
                        Register a payment sent to this promoter. Their pending commissions will be marked as paid.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    {/* Outstanding Balance Banner */}
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between">
                        <div>
                            <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">Current Pending Balance</p>
                            <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                                ${pendingBalance.toFixed(2)}
                            </p>
                        </div>
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 font-mono">
                            {affiliate.promo_code}
                        </Badge>
                    </div>

                    {/* Payment info reminder */}
                    {affiliate.payout_details && (
                        <div className="text-xs bg-muted/50 p-2.5 rounded-lg border">
                            <span className="font-semibold text-foreground">Promoter Payout Details: </span>
                            <span className="text-muted-foreground">
                                {typeof affiliate.payout_details === "string" 
                                    ? affiliate.payout_details 
                                    : JSON.stringify(affiliate.payout_details)}
                            </span>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Amount to Pay ($) *</Label>
                        <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                            className="text-lg font-bold"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Payment Method *</Label>
                            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="zelle">Zelle</SelectItem>
                                    <SelectItem value="paypal">PayPal</SelectItem>
                                    <SelectItem value="cashapp">CashApp</SelectItem>
                                    <SelectItem value="venmo">Venmo</SelectItem>
                                    <SelectItem value="wire">Bank Wire Transfer</SelectItem>
                                    <SelectItem value="crypto">Crypto</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Tx / Confirmation #</Label>
                            <Input
                                placeholder="e.g. ZEL-948294"
                                value={transactionReference}
                                onChange={(e) => setTransactionReference(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Receipt / Proof URL (Optional)</Label>
                        <Input
                            placeholder="https://... receipt image or link"
                            value={receiptUrl}
                            onChange={(e) => setReceiptUrl(e.target.value)}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Notes / Memo</Label>
                        <Input
                            placeholder="e.g. August 2026 Commission settlement"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>

                    <DialogFooter className="pt-3 border-t gap-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={isSubmitting} 
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        >
                            {isSubmitting ? "Processing..." : `Confirm $${parseFloat(amount || "0").toFixed(2)} Payout`}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// -----------------------------------------------------------------------------
// Component: Detailed Promoter Drawer (Orders & Payouts)
// -----------------------------------------------------------------------------
interface PromoterDetailSheetProps {
    isOpen: boolean;
    onClose: () => void;
    affiliate: Affiliate;
    commissions: AffiliateCommission[];
    payouts: AffiliatePayout[];
    stats?: {
        ordersCount: number;
        totalSalesVolume: number;
        totalEarned: number;
        pendingBalance: number;
        totalPaid: number;
    };
    onRecordPayout: () => void;
}

function PromoterDetailSheet({ isOpen, onClose, affiliate, commissions, payouts, stats, onRecordPayout }: PromoterDetailSheetProps) {
    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-6">
                <SheetHeader className="pb-4 border-b">
                    <div className="flex items-center justify-between">
                        <div>
                            <SheetTitle className="text-2xl font-bold flex items-center gap-2">
                                {affiliate.name}
                            </SheetTitle>
                            <SheetDescription className="text-xs mt-0.5">
                                {affiliate.email} {affiliate.phone && `&bull; ${affiliate.phone}`}
                            </SheetDescription>
                        </div>
                        <Badge variant="outline" className="font-mono text-sm px-3 py-1 font-bold border-primary/40 text-primary">
                            {affiliate.promo_code}
                        </Badge>
                    </div>
                </SheetHeader>

                {/* Performance Summary Banner */}
                <div className="grid grid-cols-3 gap-3 my-5">
                    <div className="p-3 bg-muted/40 rounded-xl border">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase">Total Sales</p>
                        <p className="text-lg font-bold">${stats?.totalSalesVolume.toFixed(2) || "0.00"}</p>
                        <p className="text-[11px] text-muted-foreground">{stats?.ordersCount || 0} orders</p>
                    </div>
                    <div className="p-3 bg-muted/40 rounded-xl border">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase">Commissions</p>
                        <p className="text-lg font-bold">${stats?.totalEarned.toFixed(2) || "0.00"}</p>
                        <p className="text-[11px] text-muted-foreground">${stats?.totalPaid.toFixed(2) || "0.00"} paid</p>
                    </div>
                    <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/30 flex flex-col justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">Unpaid Balance</p>
                            <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">${stats?.pendingBalance.toFixed(2) || "0.00"}</p>
                        </div>
                        {(stats?.pendingBalance || 0) > 0 && (
                            <Button size="sm" className="h-6 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold mt-1" onClick={onRecordPayout}>
                                Pay Now
                            </Button>
                        )}
                    </div>
                </div>

                {/* Tabs: Orders vs Payouts */}
                <Tabs defaultValue="orders" className="space-y-4">
                    <TabsList className="grid grid-cols-2 w-full">
                        <TabsTrigger value="orders" className="gap-2 font-semibold">
                            <ShoppingBag className="w-4 h-4" />
                            Attributed Orders ({commissions.length})
                        </TabsTrigger>
                        <TabsTrigger value="payouts" className="gap-2 font-semibold">
                            <History className="w-4 h-4" />
                            Payouts History ({payouts.length})
                        </TabsTrigger>
                    </TabsList>

                    {/* Orders Tab */}
                    <TabsContent value="orders" className="space-y-3">
                        {commissions.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground border rounded-xl bg-muted/10">
                                <ShoppingBag className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                                <p className="text-sm font-semibold text-foreground">No orders attributed yet</p>
                                <p className="text-xs">Sales made using code {affiliate.promo_code} will show up here automatically.</p>
                            </div>
                        ) : (
                            <div className="border rounded-xl overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/40">
                                        <TableRow>
                                            <TableHead className="text-xs">Order</TableHead>
                                            <TableHead className="text-xs">Customer</TableHead>
                                            <TableHead className="text-xs text-right">Subtotal</TableHead>
                                            <TableHead className="text-xs text-right">Commission</TableHead>
                                            <TableHead className="text-xs text-center">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {commissions.map(comm => (
                                            <TableRow key={comm.id} className="text-xs">
                                                <TableCell className="font-semibold">
                                                    <div>
                                                        <span>#ORD-{comm.order_id.substring(0, 8).toUpperCase()}</span>
                                                        <p className="text-[10px] text-muted-foreground">
                                                            {format(new Date(comm.created_at), "MMM d, yyyy")}
                                                        </p>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {comm.customer_email || "Guest"}
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    ${comm.order_subtotal?.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                                                    +${comm.commission_amount?.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            "text-[10px] px-2 py-0",
                                                            comm.status === "approved" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
                                                            comm.status === "paid" && "bg-blue-500/10 text-blue-600 border-blue-500/30",
                                                            comm.status === "pending" && "bg-amber-500/10 text-amber-600 border-amber-500/30",
                                                            comm.status === "rejected" && "bg-red-500/10 text-red-600 border-red-500/30"
                                                        )}
                                                    >
                                                        {comm.status}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </TabsContent>

                    {/* Payouts Tab */}
                    <TabsContent value="payouts" className="space-y-3">
                        {payouts.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground border rounded-xl bg-muted/10">
                                <History className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                                <p className="text-sm font-semibold text-foreground">No payouts recorded yet</p>
                                <p className="text-xs">When you settle commission payments with this promoter, the records will appear here.</p>
                            </div>
                        ) : (
                            <div className="border rounded-xl overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/40">
                                        <TableRow>
                                            <TableHead className="text-xs">Date</TableHead>
                                            <TableHead className="text-xs">Method</TableHead>
                                            <TableHead className="text-xs">Reference</TableHead>
                                            <TableHead className="text-xs text-right">Amount Paid</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {payouts.map(p => (
                                            <TableRow key={p.id} className="text-xs">
                                                <TableCell>
                                                    {format(new Date(p.payment_date), "MMM d, yyyy")}
                                                </TableCell>
                                                <TableCell className="capitalize font-medium">
                                                    {p.payment_method}
                                                </TableCell>
                                                <TableCell className="font-mono text-muted-foreground">
                                                    {p.transaction_reference || "—"}
                                                </TableCell>
                                                <TableCell className="text-right font-black text-emerald-600 dark:text-emerald-400">
                                                    ${Number(p.amount).toFixed(2)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </SheetContent>
        </Sheet>
    );
}

// -----------------------------------------------------------------------------
// Component: Global Program Settings Dialog
// -----------------------------------------------------------------------------
interface ProgramSettingsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    currentSettings: Record<string, string>;
    onSave: (settings: Record<string, string>) => void;
    isLoading: boolean;
}

function ProgramSettingsDialog({ isOpen, onClose, currentSettings, onSave, isLoading }: ProgramSettingsDialogProps) {
    const [enabled, setEnabled] = useState(true);
    const [discountType, setDiscountType] = useState("percentage");
    const [discountValue, setDiscountValue] = useState("10");
    const [commissionType, setCommissionType] = useState("percentage");
    const [commissionRate, setCommissionRate] = useState("10");
    const [commissionBasis, setCommissionBasis] = useState("net_subtotal");
    const [minPayout, setMinPayout] = useState("0");

    React.useEffect(() => {
        setEnabled(currentSettings.affiliate_program_enabled !== "false");
        setDiscountType(currentSettings.affiliate_default_customer_discount_type || "percentage");
        setDiscountValue(currentSettings.affiliate_default_customer_discount_value || "10");
        setCommissionType(currentSettings.affiliate_default_commission_type || "percentage");
        setCommissionRate(currentSettings.affiliate_default_commission_rate || "10");
        setCommissionBasis(currentSettings.affiliate_commission_basis || "net_subtotal");
        setMinPayout(currentSettings.affiliate_min_payout_threshold || "0");
    }, [currentSettings, isOpen]);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            affiliate_program_enabled: enabled ? "true" : "false",
            affiliate_default_customer_discount_type: discountType,
            affiliate_default_customer_discount_value: discountValue,
            affiliate_default_commission_type: commissionType,
            affiliate_default_commission_rate: commissionRate,
            affiliate_commission_basis: commissionBasis,
            affiliate_min_payout_threshold: minPayout
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Settings className="w-5 h-5 text-primary" />
                        Affiliate Program Global Settings
                    </DialogTitle>
                    <DialogDescription>
                        Configure global defaults, commission calculations, and master toggles.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSave} className="space-y-5 pt-2">
                    {/* Master Switch */}
                    <div className="p-4 bg-muted/40 rounded-xl border flex items-center justify-between">
                        <div>
                            <Label className="text-sm font-bold text-foreground">Program Master Switch</Label>
                            <p className="text-xs text-muted-foreground">Enable or pause the entire affiliate and influencer system.</p>
                        </div>
                        <Switch checked={enabled} onCheckedChange={setEnabled} />
                    </div>

                    {/* Default Customer Discount */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold">Default Customer Discount (For New Promoters)</Label>
                        <div className="flex gap-2">
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={discountValue}
                                onChange={(e) => setDiscountValue(e.target.value)}
                                className="w-2/3"
                            />
                            <Select value={discountType} onValueChange={setDiscountType}>
                                <SelectTrigger className="w-1/3">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="percentage">% OFF</SelectItem>
                                    <SelectItem value="fixed_amount">$ OFF</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Default Promoter Commission */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold">Default Promoter Commission Rate</Label>
                        <div className="flex gap-2">
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={commissionRate}
                                onChange={(e) => setCommissionRate(e.target.value)}
                                className="w-2/3"
                            />
                            <Select value={commissionType} onValueChange={setCommissionType}>
                                <SelectTrigger className="w-1/3">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="percentage">% Commission</SelectItem>
                                    <SelectItem value="fixed_per_order">$ Fixed / Order</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Commission Calculation Basis */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold">Commission Calculation Basis</Label>
                        <Select value={commissionBasis} onValueChange={setCommissionBasis}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="net_subtotal">Net Subtotal (After coupon discounts are subtracted)</SelectItem>
                                <SelectItem value="gross_subtotal">Gross Subtotal (Before coupon discounts)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Min Payout Threshold */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold">Minimum Payout Threshold ($)</Label>
                        <Input
                            type="number"
                            min="0"
                            step="1"
                            value={minPayout}
                            onChange={(e) => setMinPayout(e.target.value)}
                            placeholder="0 for no minimum"
                        />
                        <p className="text-[11px] text-muted-foreground">Minimum accumulated balance recommended before issuing a payout.</p>
                    </div>

                    <DialogFooter className="pt-3 border-t gap-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading} className="font-bold">
                            {isLoading ? "Saving..." : "Save Settings"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
