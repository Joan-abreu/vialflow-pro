import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { User, Package, ChevronDown, ChevronUp, RotateCcw, Users, Copy, Pencil, Check, X, Sparkles, ArrowRight, Wallet, Share2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TrackingDialog } from "@/components/shipping/TrackingDialog";
import { detectCarrier } from "@/utils/shipping";

interface TrackingInfo {
    trackingNumber: string;
    carrier: string;
    trackingUrl?: string;
    shipmentId?: string;
}

interface Order {
    id: string;
    total_amount: number;
    shipping_cost: number;
    shipping_service: string;
    tax: number;
    status: string;
    created_at: string;
    sent_to_production?: boolean;
    sent_to_production_at?: string;
    tracking_number?: string;
    shipping_address?: {
        street?: string;
        line1?: string;
        city?: string;
        state?: string;
        postal_code?: string;
        zip?: string;
        country?: string;
    };
    order_shipments?: {
        id: string;
        carrier: string;
        tracking_number: string;
        tracking_url?: string;
    }[];
    order_items: {
        id: string;
        quantity: number;
        price_at_time: number;
        variant_id: string;
        variant: {
            image_url: string | null;
            pack_size: number;
            product: {
                name: string;
                image_url: string | null;
            };
            vial_type: {
                name: string;
                capacity_ml: number;
                color: string | null;
                shape: string | null;
            };
        };
    }[];
}

interface PromoterSummary {
    id: string;
    name: string;
    promo_code: string;
    status: string;
    pendingBalance: number;
    totalEarned: number;
    ordersCount: number;
}

const Account = () => {
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [promoterData, setPromoterData] = useState<PromoterSummary | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [updating, setUpdating] = useState(false);
    const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
    const [reordering, setReordering] = useState<string | null>(null);
    const [trackingOpen, setTrackingOpen] = useState(false);
    const [trackingInfo, setTrackingInfo] = useState<TrackingInfo | null>(null);
    
    // Inline edit states
    const [isEditingName, setIsEditingName] = useState(false);
    const [isEditingPhone, setIsEditingPhone] = useState(false);

    useEffect(() => {
        checkUser();
        fetchOrders();
    }, []);

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            navigate("/login");
            return;
        }

        setUser(user);

        // Fetch profile
        const { data: profileData } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", user.id)
            .single();

        setProfile(profileData);
        setFullName(profileData?.full_name || "");
        setPhone(profileData?.phone || "");

        // Check if user is registered as an affiliate / promoter
        try {
            const { data: affList } = await supabase
                .from("affiliates" as any)
                .select("id, name, promo_code, status")
                .or(`user_id.eq.${user.id},email.ilike.${user.email}`)
                .order("created_at", { ascending: false });

            const aff = (affList || []).find((a: any) => a.status === "active") || affList?.[0];

            if (aff) {
                const affiliateIds = (affList || []).map((a: any) => a.id);
                const { data: comms } = await supabase
                    .from("affiliate_commissions" as any)
                    .select("commission_amount, status")
                    .in("affiliate_id", affiliateIds);

                let pendingBalance = 0;
                let totalEarned = 0;
                let ordersCount = 0;

                (comms || []).forEach((c: any) => {
                    if (c.status !== "rejected") {
                        ordersCount++;
                        totalEarned += Number(c.commission_amount || 0);
                        if (c.status === "approved") {
                            pendingBalance += Number(c.commission_amount || 0);
                        }
                    }
                });

                setPromoterData({
                    id: aff.id,
                    name: aff.name,
                    promo_code: aff.promo_code,
                    status: aff.status,
                    pendingBalance,
                    totalEarned,
                    ordersCount,
                    allCodes: (affList || []).map((a: any) => ({
                        id: a.id,
                        name: a.name,
                        promo_code: a.promo_code,
                        status: a.status
                    }))
                });
            }
        } catch (err) {
            console.error("Failed to load promoter status for account:", err);
        }

        setLoading(false);
    };

    const fetchOrders = async () => {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return;

        const { data, error } = await supabase
            .from("orders" as any)
            .select(`
                *,
                shipping_cost,
                tax,
                shipping_service,
                tracking_number,
                order_shipments(id, carrier, tracking_number, tracking_url),
                order_items (
                    id,
                    quantity,
                    price_at_time,
                    variant_id,
                    variant:product_variants (
                        image_url,
                        pack_size,
                        product:products (
                            name,
                            image_url
                        ),
                        vial_type:vial_types(name, capacity_ml, color, shape)
                    )
                )
            `)
            .or(user.email ? `user_id.eq.${user.id},customer_email.ilike.${user.email}` : `user_id.eq.${user.id}`)
            .order("created_at", { ascending: false });

        if (!error && data) {
            setOrders(data as unknown as Order[]);
        }
    };

    const handleUpdateProfile = async () => {
        if (!fullName.trim()) {
            toast.error("Full Name is required");
            return;
        }
        
        setUpdating(true);
        try {
            const { error } = await supabase
                .from("profiles")
                .update({ full_name: fullName, phone: phone } as any)
                .eq("user_id", user.id);

            if (error) throw error;

            toast.success("Profile updated successfully");
            setProfile({ ...profile, full_name: fullName, phone: phone });
            setIsEditingName(false);
            setIsEditingPhone(false);
        } catch (error: any) {
            toast.error("Failed to update profile");
            console.error(error);
        } finally {
            setUpdating(false);
        }
    };

    const getStatusColor = (status: string) => {
        const lower = status?.toLowerCase();
        switch (lower) {
            case "pending": return "bg-yellow-100 text-yellow-800";
            case "processing": return "bg-blue-100 text-blue-800";
            case "shipped": 
            case "in_transit":
            case "pickup_scheduled": return "bg-purple-100 text-purple-800";
            case "out_for_delivery": return "bg-indigo-100 text-indigo-800";
            case "delivered": return "bg-green-100 text-green-800";
            case "cancelled": return "bg-red-100 text-red-800";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    const formatStatus = (status: string) => {
        switch (status?.toLowerCase()) {
            case "pending": return "Pending";
            case "processing": return "Processing";
            case "shipped": return "Shipped";
            case "in_transit": return "In Transit";
            case "out_for_delivery": return "Out for Delivery";
            case "delivered": return "Delivered";
            case "cancelled": return "Cancelled";
            case "pickup_scheduled": return "In Transit";
            case "ready_to_ship": return "Ready to Ship";
            default: return status?.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) || "Pending";
        }
    };

    const toggleOrderExpand = (orderId: string) => {
        const newExpanded = new Set(expandedOrders);
        if (newExpanded.has(orderId)) {
            newExpanded.delete(orderId);
        } else {
            newExpanded.add(orderId);
        }
        setExpandedOrders(newExpanded);
    };

    const handleReorder = async (order: Order) => {
        setReordering(order.id);
        try {
            let addedCount = 0;
            let unavailableCount = 0;
            const unavailableItems: string[] = [];

            // Fetch current variant data for each item
            for (const item of order.order_items) {
                if (!item.variant_id) {
                    unavailableCount++;
                    unavailableItems.push(item.variant?.product?.name || "Unknown");
                    continue;
                }

                // Fetch the latest variant data
                const { data: variantData, error: variantError } = await supabase
                    .from("product_variants")
                    .select(`
                        *,
                        product:products(*),
                        vial_type:vial_types(name, capacity_ml, color, shape)
                    `)
                    .eq("id", item.variant_id)
                    .eq("is_published", true)
                    .single();

                if (variantError || !variantData) {
                    unavailableCount++;
                    unavailableItems.push(item.variant?.product?.name || "Unknown");
                    continue;
                }

                // Check if product is published
                if (!variantData.product?.is_published) {
                    unavailableCount++;
                    unavailableItems.push(variantData.product?.name || "Unknown");
                    continue;
                }

                // Check stock
                if (variantData.stock_quantity < item.quantity) {
                    unavailableCount++;
                    unavailableItems.push(variantData.product?.name || "Unknown");
                    continue;
                }

                // Add to cart - construct proper variant object
                const variantForCart: any = {
                    id: variantData.id,
                    product_id: variantData.product_id,
                    vial_type_id: variantData.vial_type_id,
                    sku: variantData.sku,
                    price: variantData.price,
                    stock_quantity: variantData.stock_quantity,
                    max_online_quantity: (variantData as any).max_online_quantity || 100,
                    weight: (variantData as any).weight || 0,
                    image_url: variantData.image_url,
                    pack_size: variantData.pack_size || 1,
                    product: {
                        name: variantData.product.name,
                        slug: (variantData.product as any).slug || '',
                        image_url: variantData.product.image_url,
                        description: variantData.product.description,
                        category: variantData.product.category,
                    },
                    vial_type: {
                        name: variantData.vial_type.name,
                        capacity_ml: variantData.vial_type.capacity_ml,
                        color: variantData.vial_type.color,
                        shape: variantData.vial_type.shape,
                    },
                };

                addToCart(variantForCart, item.quantity);
                addedCount++;
            }

            // Show appropriate toast messages
            if (addedCount > 0) {
                toast.success(`${addedCount} item${addedCount > 1 ? 's' : ''} added to cart`);
            }
            if (unavailableCount > 0) {
                toast.warning(`${unavailableCount} item${unavailableCount > 1 ? 's were' : ' was'} unavailable: ${unavailableItems.join(', ')}`);
            }

            // Navigate to cart if any items were added
            if (addedCount > 0) {
                navigate("/cart");
            }
        } catch (error: any) {
            console.error("Reorder error:", error);
            toast.error("Failed to reorder. Please try again.");
        } finally {
            setReordering(null);
        }
    };

    if (loading) {
        return (
            <div className="container py-12 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="container py-12">
            <div className="max-w-5xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">My Account</h1>

                <div className="grid gap-6 md:grid-cols-2">
                {/* Profile Section */}
                <Card className="md:col-span-1 flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            Profile
                        </CardTitle>
                        <CardDescription>Manage your personal information</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 flex-1">
                        <div className="space-y-1">
                            <Label className="text-sm text-muted-foreground">Email</Label>
                            <p className="font-medium text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">{user?.email}</p>
                        </div>
                        <div className="space-y-3">
                            <Label className="text-[10px] items-center font-bold text-muted-foreground uppercase tracking-widest">Full Name <span className="text-destructive">*</span></Label>
                            {isEditingName ? (
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="h-9 transition-all focus:ring-primary/20"
                                        autoFocus
                                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateProfile()}
                                    />
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={handleUpdateProfile}>
                                        <Check className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => {
                                        setIsEditingName(false);
                                        setFullName(profile?.full_name || "");
                                    }}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 py-1">
                                    <p className="font-medium text-slate-800">{fullName || "Not set"}</p>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 transition-colors hover:bg-slate-100" onClick={() => setIsEditingName(true)}>
                                        <Pencil className="h-3 w-3 text-muted-foreground" />
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <Label className="text-[10px] items-center font-bold text-muted-foreground uppercase tracking-widest">Phone Number</Label>
                            {isEditingPhone ? (
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="h-9 transition-all focus:ring-primary/20"
                                        autoFocus
                                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateProfile()}
                                    />
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={handleUpdateProfile}>
                                        <Check className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => {
                                        setIsEditingPhone(false);
                                        setPhone(profile?.phone || "");
                                    }}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 py-1">
                                    <p className="font-medium text-slate-800">{phone || "Not set"}</p>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 transition-colors hover:bg-slate-100" onClick={() => setIsEditingPhone(true)}>
                                        <Pencil className="h-3 w-3 text-muted-foreground" />
                                    </Button>
                                </div>
                            )}
                        </div>

                        {(isEditingName || isEditingPhone) && (
                            <Button 
                                onClick={handleUpdateProfile} 
                                disabled={updating}
                                className="w-full mt-2 shadow-sm"
                                size="sm"
                            >
                                {updating ? "Saving Changes..." : "Save All Changes"}
                            </Button>
                        )}
                        <Separator />
                        <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
                            <span>Member Since</span>
                            <span className="font-medium text-slate-600">
                                {user?.created_at ? format(new Date(user.created_at), "MMMM yyyy") : "-"}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* Referrals or Influencer Promoter Section (Conditional) */}
                {promoterData ? (
                    <Card className="md:col-span-1 border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-background shadow-sm">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                    Influencer Partner Hub
                                </CardTitle>
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] font-bold">
                                    ● Active Partner
                                </Badge>
                            </div>
                            <CardDescription className="text-xs">
                                Track your live commission earnings and share your code.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                                    {promoterData.allCodes && promoterData.allCodes.length > 1 ? "Your Active Promo Codes" : "Your Exclusive Promo Code"}
                                </Label>
                                {promoterData.allCodes && promoterData.allCodes.length > 1 ? (
                                    <div className="space-y-2">
                                        {promoterData.allCodes.map((c) => {
                                            const link = `${window.location.origin}/?ref=${encodeURIComponent(c.promo_code)}`;
                                            return (
                                                <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-background border border-primary/30 rounded-xl p-2.5 px-3 shadow-xs">
                                                    <div>
                                                        <p className="font-mono font-black text-sm text-primary tracking-wider">{c.promo_code}</p>
                                                        <p className="text-[10px] text-muted-foreground">{c.name || "Campaign Code"}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <Button 
                                                            size="sm" 
                                                            variant="outline" 
                                                            className="h-7 px-2.5 text-xs gap-1 font-semibold hover:bg-primary/5 border-border"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(c.promo_code);
                                                                toast.success(`Promo code ${c.promo_code} copied!`);
                                                            }}
                                                        >
                                                            <Copy className="h-3 w-3" />
                                                            Code
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant="outline" 
                                                            className="h-7 px-2.5 text-xs gap-1 font-semibold hover:bg-primary/5 border-primary/30 text-primary"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(link);
                                                                toast.success(`Referral link for ${c.promo_code} copied!`);
                                                            }}
                                                        >
                                                            <Share2 className="h-3 w-3" />
                                                            Link
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                        <Input 
                                            value={promoterData.promo_code} 
                                            readOnly 
                                            className="font-mono text-center font-bold text-base tracking-widest bg-background border-primary/30 text-primary flex-1" 
                                        />
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <Button 
                                                variant="outline" 
                                                className="gap-1 text-xs font-semibold hover:bg-primary/5 border-border flex-1 sm:flex-initial"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(promoterData.promo_code);
                                                    toast.success(`Promo code ${promoterData.promo_code} copied!`);
                                                }}
                                            >
                                                <Copy className="h-3.5 w-3.5" />
                                                Copy Code
                                            </Button>
                                            <Button 
                                                variant="outline" 
                                                className="gap-1 text-xs font-semibold hover:bg-primary/5 border-primary/30 text-primary flex-1 sm:flex-initial"
                                                onClick={() => {
                                                    const link = `${window.location.origin}/?ref=${encodeURIComponent(promoterData.promo_code)}`;
                                                    navigator.clipboard.writeText(link);
                                                    toast.success(`Referral link for ${promoterData.promo_code} copied!`);
                                                }}
                                            >
                                                <Share2 className="h-3.5 w-3.5" />
                                                Copy Link
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Separator />

                            {/* Live Stats Summary */}
                            <div className="grid grid-cols-2 gap-2 text-center">
                                <div className="p-2.5 bg-background border rounded-lg">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Unpaid Balance</p>
                                    <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                                        ${(promoterData.pendingBalance || 0).toFixed(2)}
                                    </p>
                                    <p className="text-[9px] text-muted-foreground">Ready for payout</p>
                                </div>
                                <div className="p-2.5 bg-background border rounded-lg">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Sales Generated</p>
                                    <p className="text-lg font-black text-primary">
                                        {promoterData.ordersCount}
                                    </p>
                                    <p className="text-[9px] text-muted-foreground">${(promoterData.totalEarned || 0).toFixed(2)} total earned</p>
                                </div>
                            </div>

                            {/* Direct Action Link to Full Portal */}
                            <Button className="w-full font-bold gap-2 shadow-xs text-xs h-10" asChild>
                                <Link to="/promoter">
                                    <Wallet className="w-4 h-4" />
                                    Open Full Commission Portal
                                    <ArrowRight className="w-4 h-4 ml-auto" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="md:col-span-1">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                Refer & Earn
                            </CardTitle>
                            <CardDescription>Share your code with friends and get rewards</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Your Referral Code</Label>
                                <div className="flex gap-2">
                                    <Input 
                                        value={profile?.referral_code || ""} 
                                        readOnly 
                                        className="font-mono text-center tracking-widest bg-muted/50 border-primary/20" 
                                    />
                                    <Button 
                                        size="icon" 
                                        variant="outline" 
                                        className="shrink-0 hover:bg-primary/5"
                                        onClick={() => {
                                            navigator.clipboard.writeText(profile?.referral_code || "");
                                            toast.success("Code copied to clipboard!");
                                        }}
                                    >
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center py-1">
                                <div className="space-y-0.5">
                                    <p className="text-sm font-medium">Successful Referrals</p>
                                    <p className="text-3xl font-extrabold text-primary">{profile?.successful_referrals || 0}</p>
                                </div>
                                <div className="text-right space-y-1">
                                    <p className="text-[10px] items-center font-bold text-muted-foreground uppercase tracking-widest">Next Reward</p>
                                    <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                                        {Math.min((profile?.successful_referrals || 0) * 10, 30)}% OFF
                                    </Badge>
                                </div>
                            </div>
                            <p className="text-[11px] leading-relaxed text-muted-foreground italic bg-muted/30 p-2 rounded">
                                Get 10% off products for each friend referred. Use your code during checkout to redeem your earned discount (capped at 30% off).
                            </p>
                            <div className="pt-2 border-t mt-2">
                                <Button variant="outline" size="sm" className="w-full gap-2 text-xs font-semibold text-muted-foreground hover:text-primary hover:bg-primary/5" asChild>
                                    <Link to="/contact">
                                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                                        Interested in our Influencer Program? Apply here
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            <Separator className="my-8" />

            {/* Order History */}
            <div>
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                    <Package className="h-6 w-6" />
                    Order History
                </h2>

                {orders.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">No orders yet</p>
                            <Button className="mt-4" onClick={() => navigate("/products")}>
                                Start Shopping
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {orders.map((order) => (
                            <Card key={order.id}>
                                <Collapsible>
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-1">
                                                <CardTitle className="text-lg">
                                                    Order #{order.id.slice(0, 8)}
                                                </CardTitle>
                                                <CardDescription>
                                                    {format(new Date(order.created_at), "MMMM d, yyyy 'at' h:mm a")}
                                                </CardDescription>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <Badge variant="secondary" className={getStatusColor(order.status)}>
                                                    {formatStatus(order.status)}
                                                </Badge>
                                                {order.tracking_number && (
                                                    <Button variant="outline" size="sm" onClick={() => {
                                                        const shipment = order.order_shipments?.[0];
                                                        const trackingNum = order.tracking_number as string;
                                                        setTrackingInfo({
                                                            trackingNumber: trackingNum,
                                                            carrier: shipment?.carrier || detectCarrier(trackingNum),
                                                            trackingUrl: shipment?.tracking_url || undefined,
                                                            shipmentId: shipment?.id
                                                        });
                                                        setTrackingOpen(true);
                                                    }}>
                                                        Track Package
                                                    </Button>
                                                )}
                                                <div className="text-right">
                                                    <p className="text-sm text-muted-foreground">Total</p>
                                                    <p className="text-lg font-bold">${order.total_amount.toFixed(2)}</p>
                                                </div>
                                                <CollapsibleTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => toggleOrderExpand(order.id)}
                                                    >
                                                        {expandedOrders.has(order.id) ? (
                                                            <ChevronUp className="h-4 w-4" />
                                                        ) : (
                                                            <ChevronDown className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </CollapsibleTrigger>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CollapsibleContent>
                                        <CardContent>
                                            <div className="space-y-3">
                                                <h4 className="font-semibold text-sm">Order Items:</h4>
                                                {order.order_items.map((item) => {
                                                    const variant = item.variant;
                                                    const product = variant?.product;
                                                    const displayImage = variant?.image_url || product?.image_url;

                                                    return (
                                                        <div key={item.id} className="flex items-center gap-4 py-2 border-b last:border-0">
                                                            <div className="h-16 w-16 bg-muted rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                                                                {displayImage ? (
                                                                    <img
                                                                        src={displayImage}
                                                                        alt={product?.name || "Product"}
                                                                        className="h-full w-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <Package className="h-6 w-6 text-muted-foreground" />
                                                                )}
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className="font-medium">{product?.name || "Unknown Product"}</p>
                                                                <p className="text-sm text-muted-foreground">
                                                                    {(product?.category?.toLowerCase().includes("peptide") || variant?.vial_type?.name?.toLowerCase().includes("mg")) ? (
                                                                        <>
                                                                            <span>{variant?.vial_type?.name || `${variant?.vial_type?.capacity_ml}mg`}</span>
                                                                            {variant?.pack_size && variant.pack_size > 1 ? (
                                                                                <span className="font-medium text-foreground"> ({variant.pack_size}x Pack)</span>
                                                                            ) : (
                                                                                <span> (Single Vial)</span>
                                                                            )}
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <span>{variant?.vial_type?.name || (variant?.vial_type?.capacity_ml ? `${variant.vial_type.capacity_ml}ml` : '')}</span>
                                                                            {variant?.vial_type?.color && <span> - {variant.vial_type.color}</span>}
                                                                            {variant?.vial_type?.shape && <span> - {variant.vial_type.shape}</span>}
                                                                            {variant?.pack_size && variant.pack_size > 1 && <span> ({variant.pack_size}x Pack)</span>}
                                                                        </>
                                                                    )}
                                                                </p>
                                                                <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                                                            </div>
                                                            <p className="font-medium">${item.price_at_time.toFixed(2)}</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            <div className="mt-4 pt-4 border-t space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-muted-foreground">Subtotal</span>
                                                    <span>${(order.total_amount - (order.shipping_cost || 0) - (order.tax || 0) + (order.product_discount || 0) + (order.shipping_discount || 0)).toFixed(2)}</span>
                                                </div>
                                                {(order.product_discount || 0) > 0 && (
                                                    <div className="flex justify-between text-sm text-green-600 font-medium">
                                                        <span>Discount {order.applied_coupons && order.applied_coupons.length > 0 && `(${order.applied_coupons.join(", ")})`}</span>
                                                        <span>-${(order.product_discount || 0).toFixed(2)}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-muted-foreground">Shipping</span>
                                                    <span className="text-right">
                                                        <span>${(order.shipping_cost || 0).toFixed(2)}</span>
                                                        <span className="block text-xs text-muted-foreground">
                                                            {order.shipping_service || 'Standard'}
                                                        </span>
                                                    </span>
                                                </div>
                                                {(order.shipping_discount || 0) > 0 && (
                                                    <div className="flex justify-between text-sm text-green-600 font-medium">
                                                        <span>Shipping Discount</span>
                                                        <span>-${(order.shipping_discount || 0).toFixed(2)}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-muted-foreground">Tax</span>
                                                    <span>${(order.tax || 0).toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between font-bold pt-2 border-t">
                                                    <span>Total</span>
                                                    <span>${order.total_amount.toFixed(2)}</span>
                                                </div>
                                            </div>

                                            <div className="mt-4 pt-4 border-t">
                                                <Button
                                                    onClick={() => handleReorder(order)}
                                                    disabled={reordering === order.id}
                                                    variant="outline"
                                                    className="w-full"
                                                >
                                                    <RotateCcw className="mr-2 h-4 w-4" />
                                                    {reordering === order.id ? "Adding to cart..." : "Reorder"}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </CollapsibleContent>
                                </Collapsible>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <TrackingDialog 
                open={trackingOpen}
                onOpenChange={setTrackingOpen}
                trackingNumber={trackingInfo?.trackingNumber}
                carrier={trackingInfo?.carrier}
                shipmentId={trackingInfo?.shipmentId}
            />
            </div>
        </div>
    );
};

export default Account;
