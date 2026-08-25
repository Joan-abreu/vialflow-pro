import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bell, Sparkles, Clock, CheckCircle2, Loader2, Mail, ShieldCheck } from "lucide-react";

interface RestockNotificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: any;
    selectedVariant: any;
}

export default function RestockNotificationModal({
    isOpen,
    onClose,
    product,
    selectedVariant
}: RestockNotificationModalProps) {
    const { session } = useAuth();
    const userEmail = session?.user?.email || "";
    const [email, setEmail] = useState(userEmail);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        if (userEmail && !email) {
            setEmail(userEmail);
        }
    }, [userEmail]);

    // Fetch dynamic restock settings from app_settings
    const { data: restockSettings } = useQuery({
        queryKey: ["restock-modal-settings"],
        staleTime: 60000,
        enabled: isOpen,
        queryFn: async () => {
            const { data } = await supabase
                .from("app_settings" as any)
                .select("key, value")
                .in("key", ["restock_lead_time_days", "restock_discount_percent", "restock_coupon_code"]);

            const map: Record<string, string> = {
                restock_lead_time_days: "14",
                restock_discount_percent: "40",
                restock_coupon_code: "RESTOCK40"
            };

            if (data && Array.isArray(data)) {
                data.forEach((item: any) => {
                    if (item.key && item.value) {
                        map[item.key] = item.value;
                    }
                });
            }
            return map;
        }
    });

    const leadTimeDays = restockSettings?.restock_lead_time_days || "14";
    const discountPercent = restockSettings?.restock_discount_percent || "40";
    const couponCode = restockSettings?.restock_coupon_code || "RESTOCK40";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !email.includes("@")) {
            toast.error("Please enter a valid email address.");
            return;
        }

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from("restock_notifications" as any)
                .insert({
                    user_id: session?.user?.id || null,
                    email: email.trim().toLowerCase(),
                    product_id: product?.id,
                    variant_id: selectedVariant?.id,
                    discount_offered: `${discountPercent}% OFF (${couponCode})`,
                    status: "pending",
                });

            if (error) throw error;

            setIsSuccess(true);
            toast.success(`You're on the list! We'll email you with a ${discountPercent}% OFF code when restocked.`);
        } catch (err: any) {
            console.error("Restock notification signup error:", err);
            toast.error(err.message || "Failed to sign up for restock notifications.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const displayImage = selectedVariant?.image_url ||
        (selectedVariant?.images && selectedVariant.images.length > 0 ? selectedVariant.images[0] : null) ||
        product?.image_url;

    const sizeLabel = selectedVariant?.vial_type?.name || `${selectedVariant?.vial_type?.capacity_ml || 10}ml`;

    return createPortal(
        <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md transition-all duration-300 animate-in fade-in-0"
            onClick={onClose}
        >
            <div 
                className="w-full max-w-md bg-card border rounded-2xl shadow-2xl overflow-hidden p-6 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {isSuccess ? (
                    <div className="text-center py-6 space-y-4">
                        <div className="h-14 w-14 rounded-full bg-emerald-500/10 text-emerald-600 mx-auto flex items-center justify-center border border-emerald-500/20">
                            <CheckCircle2 className="h-8 w-8" />
                        </div>
                        <h3 className="text-2xl font-bold text-foreground">You're on the list!</h3>
                        <p className="text-sm text-muted-foreground">
                            We've saved <strong>{email}</strong>. As soon as <strong>{product?.name} ({sizeLabel})</strong> is back in stock, we'll email you immediately along with your <strong>{discountPercent}% OFF</strong> coupon code ({couponCode}).
                        </p>
                        <Button onClick={onClose} className="w-full font-semibold mt-4">
                            Got it, thanks!
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="flex items-start gap-4 pb-4 border-b">
                            {/* Product Thumbnail */}
                            <div className="h-16 w-16 rounded-xl bg-muted border overflow-hidden shrink-0 flex items-center justify-center">
                                {displayImage ? (
                                    <img src={displayImage} alt={product?.name} className="h-full w-full object-cover" />
                                ) : (
                                    <Bell className="h-6 w-6 text-muted-foreground opacity-40" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider mb-1 bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                    Out of Stock
                                </Badge>
                                <h3 className="font-bold text-base text-foreground leading-tight truncate">
                                    {product?.name}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Size: {sizeLabel} {selectedVariant?.pack_size > 1 ? `(Pack ${selectedVariant.pack_size})` : ''}
                                </p>
                            </div>
                        </div>

                        {/* Lead Time Notice */}
                        <div className="flex items-center gap-2 bg-muted/60 p-3 rounded-xl border text-xs text-muted-foreground">
                            <Clock className="h-4 w-4 text-primary shrink-0" />
                            <span>Estimated max restock lead time: <strong>up to {leadTimeDays} days</strong>.</span>
                        </div>

                        {/* Discount Incentive Banner */}
                        <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-primary text-sm">
                                <Sparkles className="h-4 w-4" />
                                <span>Get Notified & Save {discountPercent}% OFF</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Sign up to receive an instant email alert when back in stock + an exclusive <strong>{discountPercent}% OFF</strong> coupon code for your patience.
                            </p>
                        </div>

                        {/* Email Input */}
                        <div className="space-y-2">
                            <Label htmlFor="restock-email" className="text-xs font-semibold">Your Email Address</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="restock-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="researcher@lab.org"
                                    required
                                    className="pl-9"
                                />
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-3 pt-2">
                            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting} className="flex-1 font-bold shadow-md">
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Bell className="h-4 w-4 mr-2" />
                                        Notify Me
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>,
        document.body
    );
}
