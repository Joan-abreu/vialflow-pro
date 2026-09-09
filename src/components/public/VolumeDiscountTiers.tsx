import React from "react";
import { VolumeTier } from "@/config/bundleConfig";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Tag } from "lucide-react";

interface VolumeDiscountTiersProps {
    basePrice: number;
    currentQuantity: number | "";
    onSelectQuantity: (qty: number) => void;
    tiers: VolumeTier[];
    packSize?: number;
    disabled?: boolean;
}

export const VolumeDiscountTiers: React.FC<VolumeDiscountTiersProps> = ({
    basePrice,
    currentQuantity,
    onSelectQuantity,
    tiers,
    packSize = 1,
    disabled = false
}) => {
    if (!tiers || tiers.length <= 1) return null;

    const numQty = typeof currentQuantity === "number" ? currentQuantity : 1;

    // Find the currently active tier
    const sortedTiers = [...tiers].sort((a, b) => a.minQty - b.minQty);
    const qualifiedTier = [...sortedTiers]
        .reverse()
        .find(t => numQty >= t.minQty) || sortedTiers[0];

    return (
        <div className="space-y-2.5 my-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <Tag className="h-3.5 w-3.5 text-primary" />
                    <span>Buy More & Save (Tiered Pricing)</span>
                </div>
                {qualifiedTier && qualifiedTier.discountPercentage > 0 && (
                    <Badge className="bg-emerald-600 text-white text-[10px] font-bold animate-pulse">
                        <Sparkles className="h-3 w-3 mr-1" />
                        {qualifiedTier.discountPercentage}% Discount Active
                    </Badge>
                )}
            </div>

            <div className={`grid grid-cols-3 gap-2 sm:gap-3 ${disabled ? "opacity-60 pointer-events-none" : ""}`}>
                {sortedTiers.map((tier) => {
                    const isSelected = qualifiedTier?.id === tier.id;
                    const discountedUnitPrice = basePrice * (1 - tier.discountPercentage / 100);
                    const perVialPrice = packSize > 1 ? discountedUnitPrice / packSize : discountedUnitPrice;
                    const totalTierSavings = (basePrice * (tier.discountPercentage / 100)) * tier.minQty;

                    return (
                        <button
                            key={tier.id}
                            type="button"
                            onClick={() => onSelectQuantity(tier.minQty)}
                            className={`
                                relative flex flex-col items-center justify-between p-2.5 sm:p-3 rounded-xl border-2 text-center transition-all cursor-pointer select-none
                                ${isSelected 
                                    ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20 scale-[1.02]" 
                                    : "border-border/80 hover:border-primary/50 hover:bg-muted/30 bg-card"}
                            `}
                        >
                            {/* Top Badge */}
                            {tier.discountPercentage > 0 ? (
                                <span className={`text-[10px] sm:text-[11px] font-black px-1.5 py-0.5 rounded-md mb-1 uppercase tracking-tight ${
                                    isSelected 
                                        ? "bg-primary text-primary-foreground" 
                                        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold"
                                }`}>
                                    {tier.badge || `Save ${tier.discountPercentage}%`}
                                </span>
                            ) : (
                                <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-tight">
                                    Standard
                                </span>
                            )}

                            {/* Qty Label */}
                            <div className="font-extrabold text-xs sm:text-sm text-foreground">
                                {tier.minQty === 1 ? "1 Unit" : `${tier.minQty}+ Units`}
                            </div>

                            {/* Price */}
                            <div className="mt-1 flex flex-col items-center">
                                <span className="font-black text-sm sm:text-base text-foreground">
                                    ${discountedUnitPrice.toFixed(2)}
                                </span>
                                {tier.discountPercentage > 0 && (
                                    <span className="text-[10px] text-muted-foreground line-through">
                                        ${basePrice.toFixed(2)}
                                    </span>
                                )}
                            </div>

                            {/* Active Indicator Icon */}
                            {isSelected && (
                                <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default VolumeDiscountTiers;
