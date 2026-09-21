import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription,
    DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { 
    Mail, 
    Send, 
    Loader2, 
    Tag, 
    Eye, 
    Edit3, 
    ShoppingBag, 
    CheckCircle2,
    AlertCircle
} from "lucide-react";
import { toast } from "sonner";

interface CartSessionRecord {
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
}

interface RecoverCartEmailDialogProps {
    isOpen: boolean;
    onClose: () => void;
    cart: CartSessionRecord | null;
    onEmailSent: () => void;
}

export const RecoverCartEmailDialog = ({
    isOpen,
    onClose,
    cart,
    onEmailSent
}: RecoverCartEmailDialogProps) => {
    // 1. Fetch storewide recovery defaults from app_settings
    const { data: dbSettings } = useQuery({
        queryKey: ["recovery_email_settings"],
        queryFn: async () => {
            const { data } = await supabase
                .from("app_settings" as any)
                .select("key, value")
                .in("key", [
                    "recovery_email_subject",
                    "recovery_email_custom_message",
                    "recovery_discount_enabled",
                    "recovery_discount_coupon_code",
                    "recovery_discount_percentage"
                ]);
            return (data as Array<{ key: string; value: string }>) || [];
        },
        enabled: isOpen,
    });

    // 2. Fetch all active pre-existing coupons
    const { data: availableCoupons, isLoading: loadingCoupons } = useQuery({
        queryKey: ["active_coupons_for_recovery"],
        queryFn: async () => {
            const { data } = await supabase
                .from("coupons" as any)
                .select("id, code, type, value, target, expires_at")
                .eq("is_active", true)
                .order("created_at", { ascending: false });
            return (data as Array<{ id: string; code: string; type: string; value: number; target: string; expires_at: string | null }>) || [];
        },
        enabled: isOpen,
    });

    // Form states
    const [subject, setSubject] = useState("");
    const [customMessage, setCustomMessage] = useState("");
    const [includeDiscount, setIncludeDiscount] = useState(false);
    const [couponCode, setCouponCode] = useState("");
    const [discountPercentage, setDiscountPercentage] = useState("10");
    const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
    const [isSending, setIsSending] = useState(false);

    // Initialize/Reset form whenever dialog opens or cart changes
    useEffect(() => {
        if (isOpen && cart) {
            let defaultSubject = "Did you forget something in your cart?";
            let defaultMessage = "We saved the items in your cart so you can easily complete your order whenever you are ready.";
            let defaultDiscountEnabled = false;
            let defaultCoupon = "";
            let defaultPct = "10";

            if (dbSettings && dbSettings.length > 0) {
                const s = dbSettings.find(item => item.key === "recovery_email_subject");
                const m = dbSettings.find(item => item.key === "recovery_email_custom_message");
                const d = dbSettings.find(item => item.key === "recovery_discount_enabled");
                const c = dbSettings.find(item => item.key === "recovery_discount_coupon_code");
                const p = dbSettings.find(item => item.key === "recovery_discount_percentage");

                if (s?.value) defaultSubject = s.value;
                if (m?.value) defaultMessage = m.value;
                if (d?.value) defaultDiscountEnabled = d.value === "true";
                if (c?.value) defaultCoupon = c.value;
                if (p?.value) defaultPct = p.value;
            }

            setSubject(defaultSubject);
            setCustomMessage(defaultMessage);
            setIncludeDiscount(defaultDiscountEnabled);
            setCouponCode(defaultCoupon);
            setDiscountPercentage(defaultPct);
            setActiveTab("edit");
        }
    }, [isOpen, cart, dbSettings]);

    // Ensure couponCode points to a valid active coupon
    useEffect(() => {
        if (availableCoupons && availableCoupons.length > 0) {
            const matches = availableCoupons.some(c => c.code.toUpperCase() === couponCode.toUpperCase());
            if (!matches) {
                setCouponCode(availableCoupons[0].code);
                setDiscountPercentage(String(availableCoupons[0].value));
            } else {
                const found = availableCoupons.find(c => c.code.toUpperCase() === couponCode.toUpperCase());
                if (found && found.value) {
                    setDiscountPercentage(String(found.value));
                }
            }
        }
    }, [availableCoupons, couponCode]);

    const selectedCoupon = useMemo(() => {
        if (!availableCoupons || !couponCode) return null;
        return availableCoupons.find(c => c.code.toUpperCase() === couponCode.toUpperCase()) || null;
    }, [availableCoupons, couponCode]);

    if (!cart) return null;

    const itemsList = cart.items || [];
    const subtotalFormatted = (Number(cart.subtotal) || 0).toFixed(2);

    const handleSelectCoupon = (code: string) => {
        const found = availableCoupons?.find(c => c.code === code);
        if (found) {
            setCouponCode(found.code);
            setDiscountPercentage(String(found.value));
        }
    };

    const handleSend = async () => {
        if (!cart.email) {
            toast.error("This cart session does not have an email address.");
            return;
        }

        if (!subject.trim()) {
            toast.error("Please enter an email subject.");
            return;
        }

        if (includeDiscount) {
            if (!couponCode.trim() || !selectedCoupon) {
                toast.error("Please select an active pre-existing coupon from your store.");
                return;
            }
        }

        setIsSending(true);
        try {
            const { data, error } = await supabase.functions.invoke("send-cart-recovery-email", {
                body: {
                    cart_session_id: cart.id,
                    custom_subject: subject.trim(),
                    custom_message: customMessage.trim(),
                    include_discount: includeDiscount,
                    coupon_code: includeDiscount && selectedCoupon ? selectedCoupon.code : undefined,
                    discount_percentage: includeDiscount && selectedCoupon ? String(selectedCoupon.value) : undefined,
                    discount_type: includeDiscount && selectedCoupon ? selectedCoupon.type : 'percentage',
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            toast.success(`Recovery email sent successfully to ${cart.email}!`);
            onEmailSent();
            onClose();
        } catch (err: any) {
            console.error("Error sending recovery email:", err);
            toast.error(err.message || "Failed to send recovery email");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && !isSending && onClose()}>
            <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
                {/* Header */}
                <DialogHeader className="p-5 pb-3 border-b bg-muted/20">
                    <div className="flex items-center justify-between gap-4">
                        <div className="space-y-1">
                            <DialogTitle className="text-lg font-bold flex items-center gap-2">
                                <Mail className="h-5 w-5 text-primary" />
                                Send Cart Recovery Email
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground">
                                Review and customize the recovery message and incentive before sending it to the customer.
                            </DialogDescription>
                        </div>
                        {cart.recovery_email_sent_count > 0 && (
                            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                                {cart.recovery_email_sent_count} previously sent
                            </Badge>
                        )}
                    </div>

                    {/* Customer & Cart Snapshot */}
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 bg-background rounded-lg border text-xs">
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Recipient</span>
                            <span className="font-semibold text-foreground truncate block" title={cart.email || ""}>
                                {cart.email}
                            </span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Customer</span>
                            <span className="font-medium text-foreground">
                                {cart.customer_name || "Guest Customer"}
                            </span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Cart Value</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                ${subtotalFormatted} USD ({itemsList.length} item{itemsList.length !== 1 ? 's' : ''})
                            </span>
                        </div>
                    </div>
                </DialogHeader>

                {/* Tabs & Content */}
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
                    <div className="px-5 pt-3 pb-2 border-b bg-background flex items-center justify-between">
                        <TabsList className="grid grid-cols-2 w-[240px]">
                            <TabsTrigger value="edit" className="text-xs gap-1.5 font-semibold">
                                <Edit3 className="h-3.5 w-3.5" />
                                Edit Content
                            </TabsTrigger>
                            <TabsTrigger value="preview" className="text-xs gap-1.5 font-semibold">
                                <Eye className="h-3.5 w-3.5" />
                                Live Preview
                            </TabsTrigger>
                        </TabsList>
                        <span className="text-[11px] text-muted-foreground hidden sm:inline-block">
                            {activeTab === "edit" ? "Customize text and select coupon" : "Exact email rendering"}
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5">
                        {/* TAB 1: EDIT CONTENT */}
                        <TabsContent value="edit" className="mt-0 space-y-4">
                            {/* Subject Line */}
                            <div className="space-y-1.5">
                                <Label htmlFor="recovery-subject" className="text-xs font-semibold flex items-center justify-between">
                                    <span>Subject Line</span>
                                    <span className="text-[11px] text-muted-foreground font-normal">Customer inbox title</span>
                                </Label>
                                <Input
                                    id="recovery-subject"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder="e.g. Did you forget something in your cart?"
                                    className="text-sm font-medium"
                                />
                            </div>

                            {/* Message Body */}
                            <div className="space-y-1.5">
                                <Label htmlFor="recovery-message" className="text-xs font-semibold flex items-center justify-between">
                                    <span>Personalized Message</span>
                                    <span className="text-[11px] text-muted-foreground font-normal">Main paragraph in email</span>
                                </Label>
                                <Textarea
                                    id="recovery-message"
                                    rows={4}
                                    value={customMessage}
                                    onChange={(e) => setCustomMessage(e.target.value)}
                                    placeholder="Add a friendly note to invite the customer back..."
                                    className="text-sm leading-relaxed"
                                />
                            </div>

                            {/* Discount Coupon Section: Pick from existing coupons only */}
                            <div className="rounded-xl border p-4 bg-muted/20 space-y-3.5">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-semibold flex items-center gap-1.5 cursor-pointer">
                                            <Tag className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                            Offer Discount Coupon
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            Choose an active coupon from your store to attach to this recovery email.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={includeDiscount}
                                        onCheckedChange={setIncludeDiscount}
                                    />
                                </div>

                                {includeDiscount && (
                                    <div className="pt-2 border-t space-y-3 animate-in fade-in-50 duration-200">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="coupon-select" className="text-xs font-semibold flex items-center justify-between">
                                                <span>Select Active Store Coupon</span>
                                                {availableCoupons && availableCoupons.length > 0 && (
                                                    <span className="text-[11px] text-muted-foreground font-normal">
                                                        {availableCoupons.length} active coupon{availableCoupons.length !== 1 ? 's' : ''} in store
                                                    </span>
                                                )}
                                            </Label>

                                            {loadingCoupons ? (
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    Loading active coupons...
                                                </div>
                                            ) : availableCoupons && availableCoupons.length > 0 ? (
                                                <Select value={couponCode} onValueChange={handleSelectCoupon}>
                                                    <SelectTrigger id="coupon-select" className="w-full text-sm font-medium">
                                                        <SelectValue placeholder="Choose a coupon to attach..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {availableCoupons.map((cp) => (
                                                            <SelectItem key={cp.id} value={cp.code} className="cursor-pointer">
                                                                <div className="flex items-center justify-between gap-3 w-full">
                                                                    <span className="font-mono font-bold tracking-wide">{cp.code}</span>
                                                                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                                                                        {cp.value}{cp.type === "percentage" ? "%" : "$"} OFF ({cp.target === "shipping" ? "Shipping" : "Products"})
                                                                    </span>
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                                                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                                                    <span>No active coupons found in your database. Please create one in Promotions/Coupons first.</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Selected Coupon Details Card */}
                                        {selectedCoupon && (
                                            <div className="p-3 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="h-8 w-8 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-black">
                                                        <Tag className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-mono font-extrabold text-sm tracking-wide text-emerald-800 dark:text-emerald-300">
                                                                {selectedCoupon.code}
                                                            </span>
                                                            <Badge variant="secondary" className="text-[10px] uppercase font-bold py-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-none">
                                                                {selectedCoupon.value}{selectedCoupon.type === "percentage" ? "%" : "$"} OFF
                                                            </Badge>
                                                        </div>
                                                        <span className="text-[11px] text-muted-foreground block">
                                                            Applies to: <span className="capitalize font-medium text-foreground">{selectedCoupon.target}</span>
                                                        </span>
                                                    </div>
                                                </div>
                                                {selectedCoupon.expires_at ? (
                                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                                        Expires: {new Date(selectedCoupon.expires_at).toLocaleDateString()}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                                        No expiration
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Reserved Items Summary */}
                            <div className="rounded-xl border p-4 bg-background space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                        <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                                        Cart Items ({itemsList.length})
                                    </span>
                                    <span className="text-xs font-bold text-muted-foreground">
                                        Subtotal: ${subtotalFormatted} USD
                                    </span>
                                </div>
                                <div className="divide-y text-xs">
                                    {itemsList.map((item: any, idx: number) => {
                                        const productName = item.variant?.product?.name || "Research Product";
                                        const vialName = item.variant?.vial_type?.name || `${item.variant?.vial_type?.capacity_ml || 10}ml`;
                                        const packSize = item.variant?.pack_size > 1 ? ` (${item.variant.pack_size}x Pack)` : '';
                                        const linePrice = ((Number(item.variant?.price) || 0) * (Number(item.quantity) || 1)).toFixed(2);
                                        const imageUrl = item.variant?.image_url || item.variant?.product?.image_url || "";

                                        return (
                                            <div key={idx} className="py-2 flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    {imageUrl ? (
                                                        <img
                                                            src={imageUrl}
                                                            alt={productName}
                                                            className="h-9 w-9 rounded-md object-cover border shrink-0"
                                                        />
                                                    ) : (
                                                        <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                                                            🧪
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <span className="font-semibold block truncate text-foreground">
                                                            {productName}
                                                        </span>
                                                        <span className="text-[11px] text-muted-foreground">
                                                            {vialName}{packSize} &bull; Qty: {item.quantity}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className="font-bold text-foreground shrink-0">
                                                    ${linePrice} USD
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </TabsContent>

                        {/* TAB 2: LIVE EMAIL PREVIEW */}
                        <TabsContent value="preview" className="mt-0">
                            <div className="border rounded-xl bg-slate-50 dark:bg-slate-950 overflow-hidden shadow-sm">
                                {/* Email Client Header */}
                                <div className="p-3 bg-slate-200/70 dark:bg-slate-900 border-b text-xs space-y-1 font-mono">
                                    <div className="text-slate-600 dark:text-slate-400">
                                        <span className="font-bold text-slate-700 dark:text-slate-300">From:</span> Liv Well Research Labs &lt;sales@livwellresearchlabs.com&gt;
                                    </div>
                                    <div className="text-slate-600 dark:text-slate-400">
                                        <span className="font-bold text-slate-700 dark:text-slate-300">To:</span> {cart.email}
                                    </div>
                                    <div className="text-slate-800 dark:text-slate-200 font-semibold truncate">
                                        <span className="font-bold">Subject:</span> {subject || "(No subject)"}
                                    </div>
                                </div>

                                {/* Email Body Container */}
                                <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 my-4 rounded-xl border shadow-sm space-y-5">
                                    {/* Brand Header */}
                                    <div className="bg-slate-900 text-white p-5 rounded-lg text-center">
                                        <h2 className="text-base font-extrabold tracking-wide uppercase m-0">
                                            Liv Well Research Labs
                                        </h2>
                                    </div>

                                    {/* Heading & Greeting */}
                                    <div className="space-y-2">
                                        <h3 className="text-base font-bold text-slate-900 dark:text-white m-0">
                                            {subject || "Did you forget something in your cart?"}
                                        </h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-300">
                                            {cart.customer_name ? `Hi ${cart.customer_name},` : "Hello,"}
                                        </p>
                                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                            {customMessage}
                                        </p>
                                    </div>

                                    {/* Promo Box (If Active) */}
                                    {includeDiscount && couponCode && (
                                        <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-dashed border-emerald-500 text-center space-y-1">
                                            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-widest block">
                                                Exclusive Promo Code
                                            </span>
                                            <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 tracking-wider">
                                                {couponCode}
                                            </div>
                                            <span className="text-xs text-emerald-700 dark:text-emerald-300 block">
                                                Use this code to get <strong>{selectedCoupon?.type === "fixed_amount" ? `$${discountPercentage}` : `${discountPercentage}%`} OFF</strong> your reserved order!
                                            </span>
                                        </div>
                                    )}

                                    {/* Items Table */}
                                    <div className="border rounded-lg overflow-hidden">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400">
                                                    <th className="p-2.5 uppercase font-semibold">Items Reserved</th>
                                                    <th className="p-2.5 text-right uppercase font-semibold">Price</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                                {itemsList.map((item: any, i: number) => {
                                                    const productName = item.variant?.product?.name || "Research Product";
                                                    const vialName = item.variant?.vial_type?.name || `${item.variant?.vial_type?.capacity_ml || 10}ml`;
                                                    const packSize = item.variant?.pack_size > 1 ? ` (${item.variant.pack_size}x Pack)` : '';
                                                    const linePrice = ((Number(item.variant?.price) || 0) * (Number(item.quantity) || 1)).toFixed(2);

                                                    return (
                                                        <tr key={i}>
                                                            <td className="p-2.5">
                                                                <strong className="block text-slate-800 dark:text-slate-200">
                                                                    {productName}
                                                                </strong>
                                                                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                                                    {vialName}{packSize} &bull; Qty: {item.quantity}
                                                                </span>
                                                            </td>
                                                            <td className="p-2.5 text-right font-bold text-slate-800 dark:text-slate-200">
                                                                ${linePrice} USD
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot>
                                                <tr className="border-t bg-slate-50 dark:bg-slate-800/30">
                                                    <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">
                                                        Subtotal:
                                                    </td>
                                                    <td className="p-2.5 text-right font-black text-sm text-blue-600 dark:text-blue-400">
                                                        ${subtotalFormatted} USD
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>

                                    {/* Action Button */}
                                    <div className="pt-2">
                                        <div className="w-full text-center py-3 px-4 rounded-lg bg-blue-600 text-white font-bold text-sm shadow-sm cursor-default">
                                            Restore Cart & Complete Order &rarr;
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <p className="text-[11px] text-slate-400 text-center leading-relaxed m-0 pt-2 border-t">
                                        &copy; {new Date().getFullYear()} Liv Well Research Labs. All items strictly for laboratory & research use only.
                                    </p>
                                </div>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>

                {/* Footer Actions */}
                <DialogFooter className="p-4 border-t bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>Link will restore items & auto-apply coupon at checkout</span>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isSending}
                            className="font-medium text-xs"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSend}
                            disabled={isSending}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 min-w-[170px]"
                        >
                            {isSending ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Sending Email...
                                </>
                            ) : (
                                <>
                                    <Send className="h-3.5 w-3.5" />
                                    Send Recovery Email
                                </>
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
