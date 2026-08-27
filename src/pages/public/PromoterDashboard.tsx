import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { toast } from "sonner";
import { format } from "date-fns";
import {
    Sparkles,
    Copy,
    Check,
    DollarSign,
    TrendingUp,
    ShoppingBag,
    History,
    Wallet,
    Share2,
    Users,
    ArrowRight,
    ExternalLink,
    Lock,
    LogIn,
    Percent,
    Award,
    CheckCircle2,
    Clock,
    AlertCircle,
    Save,
    ArrowLeft
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function PromoterDashboard() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedCode, setCopiedCode] = useState(false);

    // Auth State
    const [authEmail, setAuthEmail] = useState("");
    const [authPassword, setAuthPassword] = useState("");
    const [isAuthLoading, setIsAuthLoading] = useState(false);

    // 1. Fetch current session user
    const { data: sessionData, isLoading: isSessionLoading } = useQuery({
        queryKey: ["current-session-promoter"],
        queryFn: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            return session;
        }
    });

    const user = sessionData?.user;
    const userEmail = user?.email?.toLowerCase();

    // 2. Fetch all promoter affiliate profiles for this user/email
    const { data: affiliatesList = [], isLoading: isAffiliateLoading, refetch: refetchAffiliate } = useQuery({
        queryKey: ["promoter-profiles", userEmail, user?.id],
        enabled: !!userEmail,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("affiliates" as any)
                .select("*")
                .or(`user_id.eq.${user?.id},email.ilike.${userEmail}`)
                .order("created_at", { ascending: false });
            if (error) throw error;
            return (data || []) as any[];
        }
    });

    const [selectedAffiliateId, setSelectedAffiliateId] = useState<string>("all");

    // Primary or currently selected affiliate
    const affiliate = useMemo(() => {
        if (selectedAffiliateId !== "all") {
            return affiliatesList.find(a => a.id === selectedAffiliateId) || affiliatesList[0];
        }
        return affiliatesList.find(a => a.status === "active") || affiliatesList[0];
    }, [affiliatesList, selectedAffiliateId]);

    const allAffiliateIds = useMemo(() => affiliatesList.map(a => a.id), [affiliatesList]);

    // 3. Fetch promoter commissions (for selected campaign or combined for all)
    const { data: commissions = [], isLoading: isCommissionsLoading } = useQuery({
        queryKey: ["promoter-commissions", selectedAffiliateId, allAffiliateIds],
        enabled: allAffiliateIds.length > 0,
        queryFn: async () => {
            let query = supabase
                .from("affiliate_commissions" as any)
                .select("*, orders:order_id(id, customer_name, total_amount, status, created_at)")
                .order("created_at", { ascending: false });

            if (selectedAffiliateId === "all") {
                query = query.in("affiliate_id", allAffiliateIds);
            } else {
                query = query.eq("affiliate_id", selectedAffiliateId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return (data || []) as any[];
        }
    });

    // 4. Fetch promoter payouts (for selected campaign or combined for all)
    const { data: payouts = [], isLoading: isPayoutsLoading } = useQuery({
        queryKey: ["promoter-payouts", selectedAffiliateId, allAffiliateIds],
        enabled: allAffiliateIds.length > 0,
        queryFn: async () => {
            let query = supabase
                .from("affiliate_payouts" as any)
                .select("*")
                .order("payment_date", { ascending: false });

            if (selectedAffiliateId === "all") {
                query = query.in("affiliate_id", allAffiliateIds);
            } else {
                query = query.eq("affiliate_id", selectedAffiliateId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return (data || []) as any[];
        }
    });

    // 5. Fetch Global Settings for default rates
    const { data: appSettings } = useQuery({
        queryKey: ["promoter-app-settings"],
        queryFn: async () => {
            const { data } = await supabase
                .from("app_settings")
                .select("key, value")
                .in("key", [
                    "affiliate_default_customer_discount_value",
                    "affiliate_default_commission_rate"
                ]);
            const map: Record<string, string> = {};
            data?.forEach(s => { map[s.key] = s.value; });
            return map;
        }
    });

    // Payout settings local state
    const [payoutMethod, setPayoutMethod] = useState(affiliate?.payout_method || "zelle");
    const [payoutDetails, setPayoutDetails] = useState(
        typeof affiliate?.payout_details === "string" ? affiliate.payout_details : ""
    );

    React.useEffect(() => {
        if (affiliate) {
            setPayoutMethod(affiliate.payout_method || "zelle");
            setPayoutDetails(
                typeof affiliate.payout_details === "string" 
                    ? affiliate.payout_details 
                    : JSON.stringify(affiliate.payout_details || "")
            );
        }
    }, [affiliate]);

    // Update payout settings mutation
    const updatePayoutSettingsMutation = useMutation({
        mutationFn: async () => {
            if (!affiliate?.id) return;
            const { error } = await supabase
                .from("affiliates" as any)
                .update({
                    payout_method: payoutMethod,
                    payout_details: payoutDetails.trim(),
                    updated_at: new Date().toISOString()
                })
                .eq("id", affiliate.id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Payment information updated successfully!");
            queryClient.invalidateQueries({ queryKey: ["promoter-profile"] });
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to update payment information");
        }
    });

    // Financial Metrics Calculation
    const metrics = useMemo(() => {
        let totalSales = 0;
        let totalEarned = 0;
        let pendingBalance = 0;
        let totalPaid = 0;

        commissions.forEach(c => {
            if (c.status !== "rejected") {
                totalSales += Number(c.order_subtotal || 0);
                totalEarned += Number(c.commission_amount || 0);
                if (c.status === "approved") {
                    pendingBalance += Number(c.commission_amount || 0);
                }
            }
        });

        payouts.forEach(p => {
            totalPaid += Number(p.amount || 0);
        });

        return {
            totalSales,
            totalSalesVolume: totalSales,
            totalEarned,
            pendingBalance,
            totalPaid,
            ordersCount: commissions.filter(c => c.status !== "rejected").length
        };
    }, [commissions, payouts]);

    // Handle Inline Login
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!authEmail.trim() || !authPassword) {
            toast.error("Please enter both email and password.");
            return;
        }
        setIsAuthLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: authEmail.trim(),
                password: authPassword,
            });
            if (error) throw error;
            toast.success("Signed in successfully!");
            queryClient.invalidateQueries({ queryKey: ["current-session-promoter"] });
        } catch (err: any) {
            toast.error(err.message || "Sign-in failed. Please check your credentials.");
        } finally {
            setIsAuthLoading(false);
        }
    };

    // Copy Helpers
    const referralLink = affiliate ? `${window.location.origin}/?ref=${encodeURIComponent(affiliate.promo_code)}` : "";

    const handleCopyCode = () => {
        if (!affiliate?.promo_code) return;
        navigator.clipboard.writeText(affiliate.promo_code);
        setCopiedCode(true);
        toast.success(`Promo code ${affiliate.promo_code} copied!`);
        setTimeout(() => setCopiedCode(false), 2500);
    };

    const handleCopyReferralLink = () => {
        if (!referralLink) return;
        navigator.clipboard.writeText(referralLink);
        setCopiedLink(true);
        toast.success("Referral link copied to clipboard!");
        setTimeout(() => setCopiedLink(false), 2500);
    };

    // Helper to calculate exact rate labels for any campaign
    const getCampaignRates = (item: any) => {
        if (!item) return { discount: "10% OFF", commission: "10%" };
        const discount = item.is_custom_rates
            ? (item.customer_discount_type === 'percentage' ? `${item.customer_discount_value}% OFF` : `$${item.customer_discount_value} OFF`)
            : `${appSettings?.affiliate_default_customer_discount_value || 10}% OFF`;
        const commission = item.is_custom_rates
            ? (item.commission_type === 'percentage' ? `${item.commission_rate}%` : `$${item.commission_rate}`)
            : `${appSettings?.affiliate_default_commission_rate || 10}%`;
        return { discount, commission };
    };

    // Determine banner text based on selection
    const bannerRates = useMemo(() => {
        if (selectedAffiliateId !== "all") {
            const current = affiliatesList.find(a => a.id === selectedAffiliateId) || affiliate;
            const rates = getCampaignRates(current);
            return {
                mode: "single",
                title: "Your Custom Partnership Deal",
                discount: rates.discount,
                commission: rates.commission,
                text: `Your audience receives ${rates.discount} on every order, and you earn ${rates.commission} commission!`
            };
        }

        // When "all" is selected, check if rates across all campaigns are homogeneous or varied
        const allRates = affiliatesList.map(getCampaignRates);
        const firstDiscount = allRates[0]?.discount;
        const firstCommission = allRates[0]?.commission;
        const allSame = allRates.length > 0 && allRates.every(r => r.discount === firstDiscount && r.commission === firstCommission);

        if (allSame && firstDiscount && firstCommission) {
            return {
                mode: "homogeneous",
                title: "Your Exclusive Partnership Deals",
                discount: firstDiscount,
                commission: firstCommission,
                text: `Your audience receives ${firstDiscount} on every order, and you earn ${firstCommission} commission!`
            };
        }

        return {
            mode: "varied",
            title: "Your Multi-Campaign Partnership Deals",
            discount: "",
            commission: "",
            text: "Each of your promo codes has tailored audience discounts and commission payouts listed below."
        };
    }, [selectedAffiliateId, affiliatesList, affiliate, appSettings]);

    // 1. Loading State
    if (isSessionLoading || (user && isAffiliateLoading)) {
        return (
            <div className="container max-w-5xl py-24 flex flex-col items-center justify-center space-y-4">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-medium text-muted-foreground">Loading promoter portal...</p>
            </div>
        );
    }

    // 2. Unauthenticated State (Login Screen)
    if (!user) {
        return (
            <div className="container max-w-md py-16 px-4">
                <Card className="border-border/60 shadow-xl overflow-hidden">
                    <div className="p-6 bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b text-center space-y-2">
                        <div className="w-12 h-12 bg-primary/20 text-primary rounded-2xl flex items-center justify-center mx-auto mb-2">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight">Promoter & Influencer Portal</h1>
                        <p className="text-xs text-muted-foreground">
                            Sign in to access your live commission dashboard, shareable promo codes, and payout records.
                        </p>
                    </div>

                    <CardContent className="pt-6">
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Email Address</Label>
                                <Input
                                    type="email"
                                    placeholder="promoter@email.com"
                                    value={authEmail}
                                    onChange={(e) => setAuthEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Password</Label>
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    value={authPassword}
                                    onChange={(e) => setAuthPassword(e.target.value)}
                                    required
                                />
                            </div>

                            <Button type="submit" className="w-full font-bold gap-2" disabled={isAuthLoading}>
                                {isAuthLoading ? "Signing in..." : <><LogIn className="w-4 h-4" /> Sign In to Portal</>}
                            </Button>

                            <p className="text-[11px] text-center text-muted-foreground pt-2">
                                Not registered as a promoter yet? Contact our team at{" "}
                                <a href="mailto:support@vialflow.com" className="text-primary hover:underline font-semibold">
                                    support@vialflow.com
                                </a>
                            </p>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // 3. User logged in but has no affiliate profile
    if (!affiliate) {
        return (
            <div className="container max-w-2xl py-20 px-4 text-center space-y-6">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto text-muted-foreground">
                    <Award className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold tracking-tight">No Active Promoter Account Found</h1>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto">
                        Your account (<span className="font-semibold text-foreground">{userEmail}</span>) is not yet registered in our Influencer & Promoter Program.
                    </p>
                </div>

                <div className="flex justify-center gap-3">
                    <Button variant="outline" asChild>
                        <Link to="/account">Go to My Account</Link>
                    </Button>
                    <Button asChild>
                        <Link to="/contact">Contact Support to Join</Link>
                    </Button>
                </div>
            </div>
        );
    }

    // 4. Authenticated Promoter Dashboard
    return (
        <div className="container max-w-6xl py-10 px-4 space-y-8 animate-in fade-in duration-300">
            {/* Header with Promoter Greeting */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-bold px-2.5 py-0.5 text-xs">
                            Promoter Partner
                        </Badge>
                        {affiliatesList.length > 1 ? (
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30 text-xs font-semibold">
                                {affiliatesList.length} Active Campaigns
                            </Badge>
                        ) : affiliate?.status === "active" ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs font-semibold">
                                ● Active
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs font-semibold">
                                ○ Paused
                            </Badge>
                        )}
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                        Welcome back, {affiliate?.name || "Partner"}!
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Track your live sales commissions, share your exclusive promo codes, and review payouts.
                    </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                    {/* Campaign Switcher if multiple codes */}
                    {affiliatesList.length > 1 && (
                        <div className="flex items-center gap-2 bg-muted/50 border rounded-lg px-2.5 h-9">
                            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Filter:</span>
                            <Select value={selectedAffiliateId} onValueChange={setSelectedAffiliateId}>
                                <SelectTrigger className="h-7 w-[180px] font-bold bg-background text-xs border-0 shadow-none focus:ring-0">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">⚡ All Codes Combined</SelectItem>
                                    {affiliatesList.map((a: any) => (
                                        <SelectItem key={a.id} value={a.id}>
                                            {a.promo_code} ({a.name})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <Button variant="outline" size="sm" asChild className="gap-1.5 font-semibold text-xs h-9 shadow-xs">
                        <Link to="/account">
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Back to My Account
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Shareable Kit & Deal Banner */}
            <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-background shadow-sm overflow-hidden">
                <CardContent className="p-6 space-y-6">
                    <div className="space-y-2 max-w-2xl">
                        <div className="flex items-center gap-2 text-primary font-bold text-sm">
                            <Sparkles className="w-4 h-4" />
                            <span>{bannerRates.title}</span>
                        </div>
                        {bannerRates.mode !== "varied" ? (
                            <p className="text-lg font-bold text-foreground">
                                Your audience receives <span className="text-primary font-extrabold">{bannerRates.discount}</span> on every order, and you earn <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{bannerRates.commission} commission</span>!
                            </p>
                        ) : (
                            <p className="text-lg font-bold text-foreground">
                                {bannerRates.text}
                            </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                            Discounts are automatically applied at checkout whenever someone uses your link or code.
                        </p>
                    </div>

                    {/* Promo Codes & Share Buttons List */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        {(selectedAffiliateId === "all" ? affiliatesList : [affiliate]).filter(Boolean).map((item: any) => {
                            const itemLink = `${window.location.origin}/?ref=${encodeURIComponent(item.promo_code)}`;
                            const rates = getCampaignRates(item);
                            return (
                                <div key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-background border border-primary/20 rounded-xl p-3 shadow-xs">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <p className="font-mono text-base font-black text-primary tracking-wider">{item.promo_code}</p>
                                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-semibold text-muted-foreground">
                                                {item.name || "Campaign"}
                                            </Badge>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground font-medium">
                                            🏷️ <span className="text-foreground font-semibold">{rates.discount}</span> Customer Discount • 💵 <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{rates.commission}</span> Commission
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 gap-1.5 font-bold text-xs flex-1 sm:flex-initial"
                                            onClick={() => {
                                                navigator.clipboard.writeText(item.promo_code);
                                                toast.success(`Promo code ${item.promo_code} copied!`);
                                            }}
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                            Copy Code
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="h-8 gap-1.5 font-bold text-xs flex-1 sm:flex-initial shadow-xs"
                                            onClick={() => {
                                                navigator.clipboard.writeText(itemLink);
                                                toast.success(`Referral link for ${item.promo_code} copied!`);
                                            }}
                                        >
                                            <Share2 className="w-3.5 h-3.5" />
                                            Copy Link
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Live Financial Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-border/60 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Total Earned
                        </CardTitle>
                        <div className="p-2 bg-purple-500/10 text-purple-600 rounded-lg">
                            <DollarSign className="w-4 h-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black tracking-tight">
                            ${(metrics.totalEarned || 0).toFixed(2)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Lifetime accumulated commissions
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                            Unpaid Balance
                        </CardTitle>
                        <div className="p-2 bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 rounded-lg">
                            <Wallet className="w-4 h-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 tracking-tight">
                            ${(metrics.pendingBalance || 0).toFixed(2)}
                        </div>
                        <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1 font-medium">
                            Ready to be paid out
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Total Paid
                        </CardTitle>
                        <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black tracking-tight">
                            ${(metrics.totalPaid || 0).toFixed(2)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Transferred to your account
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Referred Orders
                        </CardTitle>
                        <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
                            <ShoppingBag className="w-4 h-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black tracking-tight">
                            {metrics.ordersCount || 0}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            ${(metrics.totalSalesVolume || 0).toFixed(2)} gross sales volume
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Tabs: Orders, Payouts, Payment Info */}
            <Tabs defaultValue="sales" className="space-y-6">
                <TabsList className="grid grid-cols-3 max-w-md">
                    <TabsTrigger value="sales" className="gap-2 font-bold text-xs">
                        <ShoppingBag className="w-3.5 h-3.5" />
                        Sales ({commissions.length})
                    </TabsTrigger>
                    <TabsTrigger value="payouts" className="gap-2 font-bold text-xs">
                        <History className="w-3.5 h-3.5" />
                        Payouts ({payouts.length})
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="gap-2 font-bold text-xs">
                        <Wallet className="w-3.5 h-3.5" />
                        Payout Info
                    </TabsTrigger>
                </TabsList>

                {/* Tab 1: Referred Sales & Commissions */}
                <TabsContent value="sales" className="space-y-4">
                    <Card className="border-border/60 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg font-bold">Sales & Earnings Log</CardTitle>
                            <CardDescription className="text-xs">
                                Real-time breakdown of all orders placed by your audience.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {commissions.length === 0 ? (
                                <div className="text-center py-16 text-muted-foreground space-y-2">
                                    <ShoppingBag className="w-10 h-10 mx-auto text-muted-foreground/30" />
                                    <p className="font-semibold text-foreground">No referred sales yet</p>
                                    <p className="text-xs max-w-sm mx-auto">
                                        Share your promo code <span className="font-mono font-bold text-primary">{affiliate.promo_code}</span> on your social media, videos, and bio to start earning!
                                    </p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader className="bg-muted/40">
                                        <TableRow>
                                            <TableHead className="font-semibold">Date</TableHead>
                                            <TableHead className="font-semibold">Order Reference</TableHead>
                                            <TableHead className="font-semibold text-right">Sale Amount</TableHead>
                                            <TableHead className="font-semibold text-right">Discount Applied</TableHead>
                                            <TableHead className="font-semibold text-right">Your Commission</TableHead>
                                            <TableHead className="font-semibold text-center">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {commissions.map(c => (
                                            <TableRow key={c.id} className="hover:bg-muted/20">
                                                <TableCell className="font-medium text-xs">
                                                    {format(new Date(c.created_at), "MMM d, yyyy")}
                                                </TableCell>
                                                <TableCell className="font-mono text-xs font-semibold">
                                                    #ORD-{c.order_id.substring(0, 8).toUpperCase()}
                                                </TableCell>
                                                <TableCell className="text-right text-xs font-medium">
                                                    ${Number(c.order_subtotal || 0).toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-muted-foreground">
                                                    -${Number(c.customer_discount_amount || 0).toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right text-sm font-black text-emerald-600 dark:text-emerald-400">
                                                    +${Number(c.commission_amount || 0).toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            "text-[10px] px-2 py-0.5 uppercase font-bold",
                                                            c.status === "approved" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
                                                            c.status === "paid" && "bg-blue-500/10 text-blue-600 border-blue-500/30",
                                                            c.status === "pending" && "bg-amber-500/10 text-amber-600 border-amber-500/30",
                                                            c.status === "rejected" && "bg-red-500/10 text-red-600 border-red-500/30"
                                                        )}
                                                    >
                                                        {c.status === "approved" ? "✓ Approved" : c.status === "paid" ? "● Paid" : c.status}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 2: Payout History */}
                <TabsContent value="payouts" className="space-y-4">
                    <Card className="border-border/60 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg font-bold">Payouts History</CardTitle>
                            <CardDescription className="text-xs">
                                All transfers and payments completed by our management team.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {payouts.length === 0 ? (
                                <div className="text-center py-16 text-muted-foreground space-y-2">
                                    <History className="w-10 h-10 mx-auto text-muted-foreground/30" />
                                    <p className="font-semibold text-foreground">No payout records yet</p>
                                    <p className="text-xs">
                                        Once commissions are settled, each payment reference and confirmation will appear here.
                                    </p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader className="bg-muted/40">
                                        <TableRow>
                                            <TableHead className="font-semibold">Payment Date</TableHead>
                                            <TableHead className="font-semibold">Method</TableHead>
                                            <TableHead className="font-semibold">Reference / Confirmation #</TableHead>
                                            <TableHead className="font-semibold">Notes</TableHead>
                                            <TableHead className="font-semibold text-right">Amount Received</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {payouts.map(p => (
                                            <TableRow key={p.id} className="hover:bg-muted/20">
                                                <TableCell className="font-medium text-xs">
                                                    {format(new Date(p.payment_date), "MMMM d, yyyy")}
                                                </TableCell>
                                                <TableCell className="capitalize font-semibold text-xs">
                                                    {p.payment_method}
                                                </TableCell>
                                                <TableCell className="font-mono text-xs text-muted-foreground">
                                                    {p.transaction_reference || "—"}
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {p.notes || "Commission payout"}
                                                </TableCell>
                                                <TableCell className="text-right text-base font-black text-emerald-600 dark:text-emerald-400">
                                                    ${Number(p.amount).toFixed(2)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 3: Payout Info Settings */}
                <TabsContent value="settings" className="space-y-4">
                    <Card className="border-border/60 shadow-sm max-w-2xl">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg font-bold">Your Payment & Payout Details</CardTitle>
                            <CardDescription className="text-xs">
                                Keep your payment details updated so we know where to send your commission earnings.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5 pt-2">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold">Preferred Payout Method</Label>
                                <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                                    <SelectTrigger className="bg-background">
                                        <SelectValue placeholder="Select payout method" />
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

                            <div className="space-y-2">
                                <Label className="text-xs font-semibold">Account / Handle Details</Label>
                                <Input
                                    placeholder={
                                        payoutMethod === "zelle" 
                                            ? "e.g. Zelle Email or Phone & Full Legal Name"
                                            : payoutMethod === "paypal"
                                            ? "e.g. PayPal email address (alex@creator.com)"
                                            : payoutMethod === "cashapp"
                                            ? "e.g. $Cashtag username"
                                            : payoutMethod === "venmo"
                                            ? "e.g. @Venmo handle"
                                            : payoutMethod === "wire"
                                            ? "e.g. Bank Name, Routing #, Account #, Beneficiary Name"
                                            : payoutMethod === "crypto"
                                            ? "e.g. USDT (TRC-20 / ERC-20) or BTC wallet address"
                                            : "e.g. Account and payout instructions"
                                    }
                                    value={payoutDetails}
                                    onChange={(e) => setPayoutDetails(e.target.value)}
                                    className="bg-background"
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Include your Zelle phone/email, PayPal address, or Cashtag so we can transfer your earnings smoothly.
                                </p>
                            </div>

                            <Button 
                                className="font-bold gap-2"
                                onClick={() => updatePayoutSettingsMutation.mutate()}
                                disabled={updatePayoutSettingsMutation.isPending}
                            >
                                <Save className="w-4 h-4" />
                                {updatePayoutSettingsMutation.isPending ? "Saving..." : "Save Payment Details"}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
