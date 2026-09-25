import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    Gift, 
    Sparkles, 
    ArrowRight, 
    Copy, 
    Check, 
    X, 
    Flame, 
    ShoppingBag, 
    ShieldCheck,
    Tag,
    Truck,
    ChevronLeft,
    ChevronRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { 
    PromoSplashSettings, 
    PromoCampaign,
    DEFAULT_PROMO_SPLASH_SETTINGS, 
    DEFAULT_PROMO_CAMPAIGN,
    markPromoSplashSeen 
} from "@/config/promoSplashConfig";
import { toast } from "sonner";

interface PromoSplashModalProps {
    isOpen: boolean;
    onClose: () => void;
    onClaim?: () => void;
    settings?: PromoSplashSettings;
    campaigns?: PromoCampaign[];
    isPreview?: boolean;
    initialSlide?: number;
}

export default function PromoSplashModal({
    isOpen,
    onClose,
    onClaim,
    settings,
    campaigns,
    isPreview = false,
    initialSlide = 0
}: PromoSplashModalProps) {
    const navigate = useNavigate();
    const [copied, setCopied] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(initialSlide);

    // Resolve active campaigns list
    const activeCampaignsList: PromoCampaign[] = (campaigns && campaigns.length > 0)
        ? campaigns
        : (settings?.campaigns && settings.campaigns.length > 0)
            ? settings.campaigns
            : [DEFAULT_PROMO_CAMPAIGN];

    // Current campaign being inspected
    const activeIndex = Math.min(currentSlide, Math.max(0, activeCampaignsList.length - 1));
    const activeCampaign = activeCampaignsList[activeIndex] || DEFAULT_PROMO_CAMPAIGN;
    const frequency = settings?.frequency || DEFAULT_PROMO_SPLASH_SETTINGS.frequency;

    // Touch Swipe Gesture State & Refs
    const touchStartXRef = useRef<number | null>(null);
    const touchStartYRef = useRef<number | null>(null);
    const touchDeltaXRef = useRef<number>(0);
    const hasSwipedRef = useRef(false);
    const [dragOffset, setDragOffset] = useState<number>(0);
    const [isDragging, setIsDragging] = useState(false);

    // Reset slide when opened
    useEffect(() => {
        if (isOpen) {
            setCurrentSlide(initialSlide || 0);
            setCopied(false);
            setDragOffset(0);
            setIsDragging(false);
        }
    }, [isOpen, initialSlide]);

    const handleNextSlide = () => {
        setCopied(false);
        setCurrentSlide((prev) => (prev + 1) % activeCampaignsList.length);
    };

    const handlePrevSlide = () => {
        setCopied(false);
        setCurrentSlide((prev) => (prev - 1 + activeCampaignsList.length) % activeCampaignsList.length);
    };

    const handleDismiss = () => {
        if (!isPreview) {
            markPromoSplashSeen({ frequency });
        }
        onClose();
    };

    const effectiveCouponCode = (activeCampaign.couponCode || "WELCOME10").trim().toUpperCase();

    const handleCopyCode = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (hasSwipedRef.current) return;
        navigator.clipboard.writeText(effectiveCouponCode);
        setCopied(true);
        localStorage.setItem("vialflow_referral_code", effectiveCouponCode);
        toast.success(`Promo code "${effectiveCouponCode}" copied & applied!`);
        setTimeout(() => setCopied(false), 2500);
    };

    const handleClaimAction = () => {
        if (hasSwipedRef.current) return;
        if (!isPreview) {
            markPromoSplashSeen({ frequency });
            if (activeCampaign.offerMode === "coupon_code" || activeCampaign.couponCode) {
                localStorage.setItem("vialflow_referral_code", effectiveCouponCode);
            }
        }

        if (onClaim) {
            onClaim();
        } else if (activeCampaign.ctaUrl) {
            onClose();
            if (activeCampaign.ctaUrl.startsWith("http")) {
                window.location.href = activeCampaign.ctaUrl;
            } else {
                navigate(activeCampaign.ctaUrl);
            }
        } else {
            onClose();
        }
    };

    const hasMultipleOffers = activeCampaignsList.length > 1;

    // Touch Swipe Handlers for Mobile & Touchscreens
    const handleTouchStart = (e: React.TouchEvent) => {
        if (!hasMultipleOffers) return;
        touchStartXRef.current = e.touches[0].clientX;
        touchStartYRef.current = e.touches[0].clientY;
        touchDeltaXRef.current = 0;
        hasSwipedRef.current = false;
        setIsDragging(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStartXRef.current === null || touchStartYRef.current === null || !hasMultipleOffers) return;
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = currentX - touchStartXRef.current;
        const diffY = currentY - touchStartYRef.current;

        // If swipe is primarily horizontal, prevent interference and provide fluid drag feedback
        if (Math.abs(diffX) > Math.abs(diffY)) {
            touchDeltaXRef.current = diffX;
            if (Math.abs(diffX) > 10) {
                hasSwipedRef.current = true;
            }
            // Dampened tactile offset (max +- 80px)
            const dampened = Math.sign(diffX) * Math.min(80, Math.abs(diffX) * 0.4);
            setDragOffset(dampened);
        }
    };

    const handleTouchEnd = () => {
        if (!hasMultipleOffers || touchStartXRef.current === null) {
            setIsDragging(false);
            setDragOffset(0);
            return;
        }

        const diffX = touchDeltaXRef.current;
        const swipeThreshold = 35; // Trigger threshold in pixels

        if (diffX < -swipeThreshold) {
            // Swiped Left -> Advance to next offer
            handleNextSlide();
        } else if (diffX > swipeThreshold) {
            // Swiped Right -> Back to previous offer
            handlePrevSlide();
        }

        setDragOffset(0);
        setIsDragging(false);
        touchStartXRef.current = null;
        touchStartYRef.current = null;
        touchDeltaXRef.current = 0;
        setTimeout(() => {
            hasSwipedRef.current = false;
        }, 150);
    };

    // Requirement Badge Label Helper
    const getRequirementLabel = (camp: PromoCampaign) => {
        if (camp.requirementType === "min_quantity" && camp.minQuantity > 0) {
            return `Buy ${camp.minQuantity}+ Units`;
        }
        if (camp.requirementType === "min_spend" && camp.minOrderAmount > 0) {
            return `Orders $${camp.minOrderAmount}+`;
        }
        if (camp.minOrderAmount > 0) {
            return `Orders $${camp.minOrderAmount}+`;
        }
        return "Any Order";
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleDismiss()}>
            <DialogContent 
                hideCloseButton={true}
                className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-lg max-h-[92vh] sm:max-h-[88vh] p-0 flex flex-col overflow-hidden border-border/60 bg-background/95 backdrop-blur-xl shadow-2xl rounded-2xl gap-0 animate-in fade-in-0 zoom-in-95 [&>button]:hidden"
            >
                {/* Scrollable Modal Body for perfect rendering on any screen/device with touch swipe support */}
                <div 
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchEnd}
                    className="flex flex-col overflow-y-auto max-h-[92vh] sm:max-h-[88vh] touch-pan-y select-none"
                    style={{
                        transform: dragOffset !== 0 ? `translateX(${dragOffset}px)` : undefined,
                        transition: isDragging ? "none" : "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
                    }}
                >
                    {/* Visual Top Banner with Atmospheric Lighting & Carousel Controls */}
                    <div className="relative bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-7 overflow-hidden border-b border-indigo-500/20 shrink-0">
                        {/* Glowing Accents */}
                        <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />

                        {/* Single Crisp Close Button (top right) */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDismiss();
                            }}
                            className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 z-50 flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white/80 hover:text-white border border-white/15 backdrop-blur-sm transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/40 shadow-sm shrink-0"
                            aria-label="Close promotion modal"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        {/* Carousel Navigation Header (if multiple offers) */}
                        {hasMultipleOffers && (
                            <div className="relative z-10 flex items-center justify-between gap-2 mb-3 sm:mb-4 pr-10">
                                <div className="flex items-center gap-1">
                                    {activeCampaignsList.map((_, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => {
                                                setCopied(false);
                                                setCurrentSlide(idx);
                                            }}
                                            className={`transition-all rounded-full cursor-pointer ${
                                                idx === activeIndex
                                                    ? "w-6 h-2 bg-amber-400 shadow-xs"
                                                    : "w-2 h-2 bg-white/30 hover:bg-white/60"
                                            }`}
                                            aria-label={`Slide ${idx + 1}`}
                                        />
                                    ))}
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] sm:text-[11px] font-semibold text-indigo-200">
                                        {activeIndex + 1} / {activeCampaignsList.length}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={handlePrevSlide}
                                            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer"
                                            aria-label="Previous offer"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleNextSlide}
                                            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer"
                                            aria-label="Next offer"
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="relative z-10 space-y-2.5 sm:space-y-3 pr-8 sm:pr-10">
                            {/* Promotional Badges */}
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-[10px] sm:text-[11px] tracking-wider uppercase border-none px-2 sm:px-2.5 py-0.5 shadow-md flex items-center gap-1 shrink-0">
                                    <Flame className="h-3 w-3 fill-current shrink-0" />
                                    {activeCampaign.badgeText || "SPECIAL PROMOTION"}
                                </Badge>

                                <Badge variant="outline" className="text-[10px] sm:text-[11px] font-semibold text-slate-300 border-white/20 bg-white/5 shrink-0">
                                    {getRequirementLabel(activeCampaign)}
                                </Badge>

                                {activeCampaign.targetScope === "category" && activeCampaign.targetCategory && (
                                    <Badge variant="outline" className="text-[10px] font-medium text-emerald-300 border-emerald-400/30 bg-emerald-500/10 shrink-0">
                                        {activeCampaign.targetCategory}
                                    </Badge>
                                )}

                                {activeCampaign.targetScope === "product" && (
                                    <Badge variant="outline" className="text-[10px] font-medium text-sky-300 border-sky-400/30 bg-sky-500/10 shrink-0 max-w-[200px] truncate">
                                        {activeCampaign.targetProductName || "Specific Product"}{activeCampaign.targetVariantName ? ` (${activeCampaign.targetVariantName})` : ""}
                                    </Badge>
                                )}

                                {activeCampaign.targetScope === "group" && (
                                    <Badge variant="outline" className="text-[10px] font-medium text-sky-300 border-sky-400/30 bg-sky-500/10 shrink-0 max-w-[200px] truncate">
                                        {activeCampaign.targetGroupLabel || "Selected Group"}
                                    </Badge>
                                )}
                            </div>

                            {/* Modal Title / Headline */}
                            <DialogTitle className="text-lg sm:text-2xl font-black tracking-tight text-white leading-tight break-words">
                                {activeCampaign.headline}
                            </DialogTitle>

                            {/* Description */}
                            <DialogDescription className="text-xs sm:text-sm text-slate-300 leading-relaxed pt-0.5 break-words">
                                {activeCampaign.description}
                            </DialogDescription>
                        </div>
                    </div>

                    {/* Offer Incentive Card & Call to Actions */}
                    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 bg-card flex-1">
                        {/* Mode 1: Coupon Code Box */}
                        {activeCampaign.offerMode === "coupon_code" && (
                            <div className="rounded-xl border border-dashed border-primary/50 bg-primary/5 dark:bg-primary/10 p-3.5 sm:p-4 text-center space-y-2 w-full min-w-0 overflow-hidden">
                                <div className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center justify-center gap-1">
                                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                                    <span>Use Promo Code at Checkout</span>
                                </div>

                                <div className="flex items-center justify-center gap-2 flex-wrap">
                                    <div className="font-mono font-black text-lg sm:text-xl tracking-wider text-foreground bg-background px-3 sm:px-4 py-1.5 rounded-lg border shadow-inner">
                                        {effectiveCouponCode}
                                    </div>
                                    <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={handleCopyCode}
                                        className="gap-1.5 text-xs font-semibold h-8 sm:h-9 px-3 cursor-pointer shrink-0"
                                    >
                                        {copied ? (
                                            <>
                                                <Check className="h-3.5 w-3.5 text-emerald-500" />
                                                Copied!
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="h-3.5 w-3.5" />
                                                Copy
                                            </>
                                        )}
                                    </Button>
                                </div>

                                <p className="text-[10px] sm:text-[11px] text-muted-foreground">
                                    Code will be automatically applied to your cart when you proceed.
                                </p>
                            </div>
                        )}

                        {/* Mode 2: Free Shipping Reward Card */}
                        {activeCampaign.offerMode === "free_shipping" && (
                            <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 dark:bg-sky-950/20 p-3 sm:p-4 flex items-center gap-3 shadow-sm w-full min-w-0 overflow-hidden">
                                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-sky-500/15 dark:bg-sky-500/25 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                                    <Truck className="h-5 w-5 sm:h-6 sm:w-6" />
                                </div>
                                <div className="space-y-0.5 min-w-0 flex-1">
                                    <span className="text-[11px] sm:text-xs font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wide block truncate">
                                        Complimentary Shipping Perk
                                    </span>
                                    <p className="text-xs sm:text-sm font-semibold text-foreground truncate block">
                                        {getRequirementLabel(activeCampaign)} unlocks FREE Standard Dispatch
                                    </p>
                                    <span className="text-[10px] sm:text-[11px] text-muted-foreground block truncate">
                                        Applied automatically at checkout for qualifying research packages.
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Mode 3: Free Gift with Purchase Card */}
                        {activeCampaign.offerMode === "gift_with_purchase" && (
                            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 p-3 sm:p-4 flex items-center gap-3 shadow-sm w-full min-w-0 overflow-hidden">
                                {activeCampaign.rewardProductImage ? (
                                    <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl overflow-hidden border border-emerald-500/30 bg-background shrink-0">
                                        <img 
                                            src={activeCampaign.rewardProductImage} 
                                            alt={activeCampaign.rewardProductName || "Free Gift"} 
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                ) : (
                                    <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-emerald-500/15 dark:bg-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                                        <Gift className="h-5 w-5 sm:h-6 sm:w-6" />
                                    </div>
                                )}

                                <div className="space-y-0.5 min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[11px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide block">
                                            Free Research Gift
                                        </span>
                                        <Badge className="bg-emerald-500 text-white font-black text-[9px] px-1.5 py-0 h-4 shrink-0">
                                            {activeCampaign.rewardQuantity ? `${activeCampaign.rewardQuantity}x FREE` : "FREE"}
                                        </Badge>
                                    </div>
                                    <p className="text-xs sm:text-sm font-semibold text-foreground truncate block">
                                        {activeCampaign.rewardProductName || "Complimentary Research Item"}
                                    </p>
                                    <span className="text-[10px] sm:text-[11px] text-muted-foreground block truncate">
                                        Automatically included when {getRequirementLabel(activeCampaign).toLowerCase()} is met.
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Guarantees Perks */}
                        <div className="grid grid-cols-2 gap-2 text-[10px] sm:text-[11px] text-muted-foreground pt-0.5">
                            <div className="flex items-center gap-1.5">
                                <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                                <span className="truncate">100% Laboratory Grade</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <ShoppingBag className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                <span className="truncate">Fast Priority Dispatch</span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-2.5 pt-1 text-center">
                            <Button 
                                onClick={handleClaimAction}
                                size="lg"
                                className="w-full h-11 sm:h-12 text-xs sm:text-sm font-bold shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all gap-2 cursor-pointer"
                            >
                                <span className="truncate">
                                    {onClaim 
                                        ? (activeCampaign.couponCode ? `Apply ${effectiveCouponCode} & Checkout` : "Proceed to Checkout")
                                        : (activeCampaign.ctaText || "Claim Offer & Shop Now")}
                                </span>
                                <ArrowRight className="h-4 w-4 shrink-0" />
                            </Button>

                            <div className="flex flex-col items-center justify-center gap-1.5 pt-0.5">
                                <button
                                    type="button"
                                    onClick={handleDismiss}
                                    className="text-[11px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-center underline-offset-4 hover:underline py-0.5"
                                >
                                    {activeCampaign.dismissText || "No thanks, continue shopping"}
                                </button>

                                {hasMultipleOffers && (
                                    <div className="flex items-center justify-between w-full pt-1.5 px-0.5 border-t border-border/40 text-xs">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handlePrevSlide();
                                            }}
                                            className="text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors py-1 px-1.5 rounded-md hover:bg-muted/50"
                                        >
                                            <ChevronLeft className="h-3.5 w-3.5" />
                                            <span>Anterior</span>
                                        </button>

                                        <span className="text-[10px] text-muted-foreground/70 font-medium flex items-center gap-1 select-none">
                                            ↔ Desliza con el dedo
                                        </span>

                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleNextSlide();
                                            }}
                                            className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer transition-colors py-1 px-1.5 rounded-md hover:bg-primary/10"
                                        >
                                            <span>Siguiente ({activeIndex + 1}/{activeCampaignsList.length})</span>
                                            <ChevronRight className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );

}
