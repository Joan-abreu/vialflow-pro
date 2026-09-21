import { useState, useEffect } from "react";
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
}

export default function PromoSplashModal({
    isOpen,
    onClose,
    onClaim,
    settings,
    campaigns,
    isPreview = false
}: PromoSplashModalProps) {
    const navigate = useNavigate();
    const [copied, setCopied] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);

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

    // Reset slide when opened
    useEffect(() => {
        if (isOpen) {
            setCurrentSlide(0);
            setCopied(false);
        }
    }, [isOpen]);

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

    const handleCopyCode = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!activeCampaign.couponCode) return;

        navigator.clipboard.writeText(activeCampaign.couponCode);
        setCopied(true);
        localStorage.setItem("vialflow_referral_code", activeCampaign.couponCode.trim().toUpperCase());
        toast.success(`Promo code "${activeCampaign.couponCode}" copied & applied!`);
        setTimeout(() => setCopied(false), 2500);
    };

    const handleClaimAction = () => {
        if (!isPreview) {
            markPromoSplashSeen({ frequency });
            if (activeCampaign.couponCode) {
                localStorage.setItem("vialflow_referral_code", activeCampaign.couponCode.trim().toUpperCase());
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
                className="max-w-lg p-0 overflow-hidden border-border/60 bg-background/95 backdrop-blur-xl shadow-2xl rounded-2xl gap-0 animate-in fade-in-0 zoom-in-95 [&>button]:hidden"
            >
                {/* Visual Top Banner with Atmospheric Lighting & Carousel Controls */}
                <div className="relative bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-7 overflow-hidden border-b border-indigo-500/20">
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
                        className="absolute top-4 right-4 z-50 flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white/80 hover:text-white border border-white/15 backdrop-blur-sm transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/40 shadow-sm"
                        aria-label="Close promotion modal"
                    >
                        <X className="h-4 w-4" />
                    </button>

                    {/* Carousel Navigation Header (if multiple offers) */}
                    {hasMultipleOffers && (
                        <div className="relative z-10 flex items-center justify-between gap-2 mb-4 pr-10">
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
                                <span className="text-[11px] font-semibold text-indigo-200">
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

                    <div className="relative z-10 space-y-3">
                        {/* Promotional Badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-[11px] tracking-wider uppercase border-none px-2.5 py-0.5 shadow-md flex items-center gap-1">
                                <Flame className="h-3 w-3 fill-current" />
                                {activeCampaign.badgeText || "SPECIAL PROMOTION"}
                            </Badge>

                            <Badge variant="outline" className="text-[11px] font-semibold text-slate-300 border-white/20 bg-white/5">
                                {getRequirementLabel(activeCampaign)}
                            </Badge>

                            {activeCampaign.targetScope === "category" && activeCampaign.targetCategory && (
                                <Badge variant="outline" className="text-[10px] font-medium text-emerald-300 border-emerald-400/30 bg-emerald-500/10">
                                    {activeCampaign.targetCategory}
                                </Badge>
                            )}

                            {activeCampaign.targetScope === "product" && (
                                <Badge variant="outline" className="text-[10px] font-medium text-sky-300 border-sky-400/30 bg-sky-500/10">
                                    {activeCampaign.targetProductName || "Specific Product"}
                                </Badge>
                            )}
                        </div>

                        {/* Modal Title / Headline */}
                        <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
                            {activeCampaign.headline}
                        </DialogTitle>

                        {/* Description */}
                        <DialogDescription className="text-xs sm:text-sm text-slate-300 leading-relaxed pt-1">
                            {activeCampaign.description}
                        </DialogDescription>
                    </div>
                </div>

                {/* Offer Incentive Card & Call to Actions */}
                <div className="p-6 space-y-5 bg-card">
                    {/* Mode 1: Coupon Code Box */}
                    {activeCampaign.offerMode === "coupon_code" && (
                        <div className="rounded-xl border border-dashed border-primary/50 bg-primary/5 dark:bg-primary/10 p-4 text-center space-y-2">
                            <div className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center justify-center gap-1">
                                <Sparkles className="h-3.5 w-3.5" />
                                Use Promo Code at Checkout
                            </div>

                            <div className="flex items-center justify-center gap-2">
                                <div className="font-mono font-black text-xl tracking-wider text-foreground bg-background px-4 py-1.5 rounded-lg border shadow-inner">
                                    {activeCampaign.couponCode || "PROMO"}
                                </div>
                                <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={handleCopyCode}
                                    className="gap-1.5 text-xs font-semibold h-9 px-3 cursor-pointer"
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

                            <p className="text-[11px] text-muted-foreground">
                                Code will be automatically applied to your cart when you proceed.
                            </p>
                        </div>
                    )}

                    {/* Mode 2: Free Shipping Reward Card */}
                    {activeCampaign.offerMode === "free_shipping" && (
                        <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 dark:bg-sky-950/20 p-4 flex items-center gap-3.5 shadow-sm">
                            <div className="h-12 w-12 rounded-xl bg-sky-500/15 dark:bg-sky-500/25 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                                <Truck className="h-6 w-6" />
                            </div>
                            <div className="space-y-0.5 min-w-0">
                                <span className="text-xs font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wide block">
                                    Complimentary Shipping Perk
                                </span>
                                <p className="text-xs font-semibold text-foreground truncate">
                                    {getRequirementLabel(activeCampaign)} unlocks FREE Standard Dispatch
                                </p>
                                <span className="text-[11px] text-muted-foreground block">
                                    Applied automatically at checkout for all qualifying research packages.
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Mode 3: Free Gift with Purchase Card */}
                    {activeCampaign.offerMode === "gift_with_purchase" && (
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 p-4 flex items-center gap-3.5 shadow-sm">
                            {activeCampaign.rewardProductImage ? (
                                <div className="h-12 w-12 rounded-xl overflow-hidden border border-emerald-500/30 bg-background shrink-0">
                                    <img 
                                        src={activeCampaign.rewardProductImage} 
                                        alt={activeCampaign.rewardProductName || "Free Gift"} 
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                            ) : (
                                <div className="h-12 w-12 rounded-xl bg-emerald-500/15 dark:bg-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                                    <Gift className="h-6 w-6" />
                                </div>
                            )}

                            <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide block">
                                        Free Research Gift
                                    </span>
                                    <Badge className="bg-emerald-500 text-white font-black text-[9px] px-1.5 py-0 h-4">
                                        {activeCampaign.rewardQuantity ? `${activeCampaign.rewardQuantity}x FREE` : "FREE"}
                                    </Badge>
                                </div>
                                <p className="text-xs font-semibold text-foreground truncate">
                                    {activeCampaign.rewardProductName || "Complimentary Research Item"}
                                </p>
                                <span className="text-[11px] text-muted-foreground block truncate">
                                    Automatically included when {getRequirementLabel(activeCampaign).toLowerCase()} is met.
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Guarantees Perks */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1">
                        <div className="flex items-center gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>100% Laboratory Grade</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <ShoppingBag className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            <span>Fast Priority Dispatch</span>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2.5 pt-1">
                        <Button 
                            onClick={handleClaimAction}
                            size="lg"
                            className="w-full h-12 text-sm font-bold shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all gap-2 cursor-pointer"
                        >
                            <span>{activeCampaign.ctaText || "Claim Offer & Shop Now"}</span>
                            <ArrowRight className="h-4 w-4" />
                        </Button>

                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                            <button
                                type="button"
                                onClick={handleDismiss}
                                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            >
                                {activeCampaign.dismissText || "No thanks, continue shopping"}
                            </button>

                            {hasMultipleOffers && (
                                <button
                                    type="button"
                                    onClick={handleNextSlide}
                                    className="font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                    <span>Next deal</span>
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
