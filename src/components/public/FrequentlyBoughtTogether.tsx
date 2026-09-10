import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart, ProductVariant } from "@/contexts/CartContext";
import { FrequentlyBoughtTogetherConfig, isGlpProduct, isResearchPeptideProduct } from "@/config/bundleConfig";
import { getBaseSalesCount } from "@/utils/salesCount";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, ShoppingCart, Sparkles, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface FrequentlyBoughtTogetherProps {
    currentProduct: {
        id: string;
        name: string;
        category?: string | null;
        image_url?: string | null;
        images?: string[];
        product_categories?: { name?: string } | null;
        slug?: string | null;
    };
    currentVariant: ProductVariant | null;
    fbtConfig: FrequentlyBoughtTogetherConfig;
}

export const FrequentlyBoughtTogether: React.FC<FrequentlyBoughtTogetherProps> = ({
    currentProduct,
    currentVariant,
    fbtConfig
}) => {
    const { addToCart } = useCart();
    const isCurrentOutOfStock = !currentVariant || (currentVariant.stock_quantity ?? 0) <= 0;

    const [includeCurrent, setIncludeCurrent] = useState(!isCurrentOutOfStock);
    const [includePartner, setIncludePartner] = useState(true);
    const [selectedPartnerVariantId, setSelectedPartnerVariantId] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);

    // Sync includeCurrent if currentVariant changes stock status
    useEffect(() => {
        if (!currentVariant || (currentVariant.stock_quantity ?? 0) <= 0) {
            setIncludeCurrent(false);
        } else {
            setIncludeCurrent(true);
        }
    }, [currentVariant?.id, currentVariant?.stock_quantity]);

    const isCurrentGlp = isGlpProduct(currentProduct);
    const isCurrentResearch = isResearchPeptideProduct(currentProduct);
    const pairingMode = fbtConfig.pairingMode || "smart";
    const customPairId = fbtConfig.customPairs ? fbtConfig.customPairs[currentProduct.id] : undefined;

    // Fetch complementary partner product
    const { data: partnerData, isLoading } = useQuery({
        queryKey: ["fbt-partner-product", currentProduct.id, pairingMode, customPairId, isCurrentGlp],
        staleTime: 5 * 60 * 1000,
        queryFn: async () => {
            let query = supabase
                .from("products")
                .select(`
                    id,
                    name,
                    slug,
                    image_url,
                    images,
                    product_categories(name),
                    variants:product_variants(
                        id,
                        price,
                        stock_quantity,
                        image_url,
                        images,
                        pack_size,
                        vial_type:vial_types(name, capacity_ml, color, shape)
                    )
                `)
                .eq("is_published", true)
                .neq("id", currentProduct.id)
                .or("is_archived.eq.false,is_archived.is.null")
                .limit(40);

            const { data, error } = await query;
            if (error) {
                console.warn("[FrequentlyBoughtTogether] Error loading partner:", error);
                return null;
            }

            if (!data || data.length === 0) return null;

            let matched: any = null;

            // 1. MANUAL MODE: Look up explicitly configured pair
            if (pairingMode === "manual") {
                if (customPairId) {
                    matched = data.find(p => p.id === customPairId);
                    const hasStock = matched && (matched.variants || []).some((v: any) => (v.stock_quantity ?? 999) > 0);
                    if (!hasStock) matched = null;
                }

                // If not found in custom pairs, check default group fallback
                if (!matched) {
                    const defaultPartnerId = isCurrentGlp ? fbtConfig.defaultResearchPartnerId : fbtConfig.defaultGlpPartnerId;
                    if (defaultPartnerId) {
                        matched = data.find(p => p.id === defaultPartnerId);
                        const hasStock = matched && (matched.variants || []).some((v: any) => (v.stock_quantity ?? 999) > 0);
                        if (!hasStock) matched = null;
                    }
                }

                // In strict manual mode, if no custom pair or fallback is configured/in-stock, do not show
                if (!matched) return null;
            } else {
                // 2. SMART MODE: Rule-based ranking by Best Seller / Popularity & Cross-Group Affinity
                const eligible = data.filter(p => {
                    const isBulk = (p.name || "").toLowerCase().includes("[bulk") || (p.product_categories?.name || "").toLowerCase().includes("bulk");
                    if (isBulk) return false;
                    const inStock = (p.variants || []).some((v: any) => (v.stock_quantity ?? 999) > 0);
                    if (!inStock) return false;

                    // Group match:
                    if (isCurrentGlp) {
                        return isResearchPeptideProduct(p);
                    }
                    if (isCurrentResearch) {
                        return isGlpProduct(p);
                    }
                    return isGlpProduct(p) || isResearchPeptideProduct(p);
                });

                if (eligible.length === 0) return null;

                // Rank by popularity score + synergy affinity
                const scored = eligible.map(p => {
                    const baseSales = getBaseSalesCount(p.id, false, p.name, p.product_categories?.name);
                    let affinityBonus = 0;
                    const pName = (p.name || "").toLowerCase();
                    const pSlug = (p.slug || "").toLowerCase();

                    if (isCurrentGlp) {
                        // High synergy partner for GLPs: Wolverine, then BPC-157, KLOW, NAD+
                        if (pName.includes("wolverine") || pSlug.includes("wolverine")) affinityBonus += 250;
                        else if (pName.includes("bpc-157") || pSlug.includes("bpc-157")) affinityBonus += 120;
                        else if (pName.includes("klow") || pSlug.includes("klow")) affinityBonus += 100;
                        else if (pName.includes("nad") || pSlug.includes("nad")) affinityBonus += 80;
                    } else {
                        // High synergy partner for Research Peptides: GLP1-SM, then GLP2-TZ, GLP3-RT
                        if (pSlug.includes("glp1-sm") || pName.includes("glp1-sm")) affinityBonus += 250;
                        else if (pSlug.includes("glp2-tz") || pName.includes("glp2-tz")) affinityBonus += 180;
                        else if (pSlug.includes("glp3-rt") || pName.includes("glp3-rt")) affinityBonus += 120;
                        else if (isGlpProduct(p)) affinityBonus += 60;
                    }

                    return {
                        product: p,
                        score: baseSales + affinityBonus
                    };
                });

                scored.sort((a, b) => b.score - a.score);
                matched = scored[0].product;
            }

            if (!matched) return null;

            const inStockVariants = (matched.variants || [])
                .filter((v: any) => (v.stock_quantity ?? 999) > 0)
                .map((v: any) => ({
                    ...v,
                    price: Number(v.price) || 0,
                    product: {
                        id: matched.id,
                        name: matched.name,
                        slug: matched.slug,
                        image_url: matched.image_url,
                        description: null,
                        category: matched.product_categories?.name || null,
                        is_private: false,
                    },
                    vial_type: {
                        name: v.vial_type?.name || 'Standard',
                        capacity_ml: v.vial_type?.capacity_ml || 30,
                        color: v.vial_type?.color || 'Clear',
                        shape: v.vial_type?.shape || 'Round',
                    }
                }));

            return {
                product: matched,
                variants: inStockVariants as ProductVariant[]
            };
        }
    });

    // Pick active partner variant
    const partnerVariant = useMemo(() => {
        if (!partnerData?.variants || partnerData.variants.length === 0) return null;
        if (selectedPartnerVariantId) {
            const found = partnerData.variants.find(v => v.id === selectedPartnerVariantId);
            if (found) return found;
        }
        return partnerData.variants[0];
    }, [partnerData, selectedPartnerVariantId]);

    if (isLoading || !partnerData || !partnerVariant || !currentVariant) {
        return null;
    }

    const currentPrice = currentVariant.price;
    const partnerPrice = partnerVariant.price;

    const rawTotal = (includeCurrent ? currentPrice : 0) + (includePartner ? partnerPrice : 0);

    const isBothSelected = includeCurrent && includePartner;
    let savings = 0;
    if (isBothSelected) {
        if (fbtConfig.discountType === "percentage") {
            savings = (partnerPrice * fbtConfig.discountValue) / 100;
        } else {
            savings = Math.min(fbtConfig.discountValue, partnerPrice);
        }
    }
    const finalBundlePrice = Math.max(0, rawTotal - savings);

    const handleAddBundle = async () => {
        if (!includeCurrent && !includePartner) {
            toast.error("Please select at least one item to add to cart.");
            return;
        }

        setIsAdding(true);
        try {
            if (includeCurrent && currentVariant) {
                addToCart(currentVariant, 1, false, false);
            }
            if (includePartner && partnerVariant) {
                addToCart(partnerVariant, 1, false, false);
            }

            if (isBothSelected) {
                toast.success(
                    <div className="space-y-1">
                        <strong className="font-bold flex items-center gap-1 text-emerald-600">
                            <Sparkles className="h-4 w-4" /> Protocol Pair Added!
                        </strong>
                        <p className="text-xs text-muted-foreground">
                            You saved ${savings.toFixed(2)} on this research pair!
                        </p>
                    </div>
                );
            } else {
                toast.success("Item added to cart!");
            }
        } catch (err: any) {
            toast.error("Could not add items to cart.");
        } finally {
            setIsAdding(false);
        }
    };

    const currentImage = currentVariant.image_url || currentProduct.image_url || (currentProduct.images && currentProduct.images[0]);
    const partnerImage = partnerVariant.image_url || partnerData.product.image_url || (partnerData.product.images && partnerData.product.images[0]);

    const subtitleText = isCurrentGlp
        ? `Synergistic recovery & research protocol with ${partnerData.product.name}`
        : `Synergistic metabolic protocol with ${partnerData.product.name}`;

    return (
        <div className="bg-gradient-to-br from-card via-card to-emerald-500/[0.04] border-2 border-emerald-500/25 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 my-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                        <h3 className="font-extrabold text-sm sm:text-base text-foreground tracking-tight leading-tight">
                            {fbtConfig.headline && fbtConfig.headline !== "Frequently Paired for Reconstitution"
                                ? fbtConfig.headline
                                : "Frequently Paired Research Protocol"}
                        </h3>
                        <p className="text-[11px] text-muted-foreground hidden sm:block">
                            {subtitleText}
                        </p>
                    </div>
                </div>
                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider shadow-xs shrink-0">
                    {fbtConfig.badgeText && fbtConfig.badgeText !== "PAIR & SAVE 15%"
                        ? fbtConfig.badgeText
                        : "PROTOCOL PAIR • SAVE 15%"}
                </Badge>
            </div>

            {/* Products Combo: Clean stacked pair with connecting plus badge */}
            <div className="space-y-2 relative">
                {/* Main Item Card */}
                <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    includeCurrent ? "bg-background border-primary/30 shadow-2xs" : "bg-muted/20 border-border opacity-60"
                }`}>
                    <Checkbox 
                        id="fbt-current" 
                        checked={includeCurrent} 
                        disabled={isCurrentOutOfStock}
                        onCheckedChange={(c) => setIncludeCurrent(Boolean(c))} 
                        className="shrink-0"
                    />
                    <div className="h-12 w-12 rounded-lg bg-muted border overflow-hidden shrink-0 flex items-center justify-center">
                        {currentImage ? (
                            <img src={currentImage} alt={currentProduct.name} className="h-full w-full object-cover" />
                        ) : (
                            <Package className="h-5 w-5 text-muted-foreground/40" />
                        )}
                    </div>
                    <div className="space-y-0.5 min-w-0 flex-1">
                        <label htmlFor="fbt-current" className="text-xs font-bold text-foreground line-clamp-1 cursor-pointer hover:text-primary transition-colors block">
                            {currentProduct.name}
                        </label>
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-muted-foreground truncate">
                                {currentVariant.vial_type?.name || "Single Unit"}
                            </span>
                            {isCurrentOutOfStock ? (
                                <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4 font-bold">
                                    Out of stock
                                </Badge>
                            ) : (
                                <span className="text-xs font-black text-foreground shrink-0">
                                    ${currentPrice.toFixed(2)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Plus Connector Badge */}
                <div className="flex items-center justify-center -my-1 relative z-10">
                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-xs">
                        <Plus className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                </div>

                {/* Partner Item Card */}
                <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    includePartner ? "bg-background border-emerald-500/30 shadow-2xs" : "bg-muted/20 border-border opacity-60"
                }`}>
                    <Checkbox 
                        id="fbt-partner" 
                        checked={includePartner} 
                        onCheckedChange={(c) => setIncludePartner(Boolean(c))} 
                        className="shrink-0"
                    />
                    <div className="h-12 w-12 rounded-lg bg-muted border overflow-hidden shrink-0 flex items-center justify-center">
                        {partnerImage ? (
                            <img src={partnerImage} alt={partnerData.product.name} className="h-full w-full object-cover" />
                        ) : (
                            <Package className="h-5 w-5 text-muted-foreground/40" />
                        )}
                    </div>
                    <div className="space-y-0.5 min-w-0 flex-1">
                        <label htmlFor="fbt-partner" className="text-xs font-bold text-foreground line-clamp-1 cursor-pointer hover:text-emerald-600 transition-colors block">
                            {partnerData.product.name}
                        </label>
                        <div className="flex items-center justify-between gap-2">
                            {partnerData.variants.length > 1 ? (
                                <Select 
                                    value={partnerVariant.id} 
                                    onValueChange={setSelectedPartnerVariantId}
                                >
                                    <SelectTrigger className="h-6 text-[11px] px-2 py-0 border-muted max-w-[140px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {partnerData.variants.map((v) => (
                                            <SelectItem key={v.id} value={v.id} className="text-xs">
                                                {v.vial_type?.name || `${v.price}`} - ${v.price.toFixed(2)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <span className="text-[11px] text-muted-foreground truncate">
                                    {partnerVariant.vial_type?.name || "Standard Size"}
                                </span>
                            )}
                            <span className="text-xs font-black text-foreground shrink-0">
                                ${partnerPrice.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pricing & Full-Width 1-Click CTA */}
            <div className="p-3.5 rounded-xl bg-background/90 border border-emerald-500/20 space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <span className="text-xs text-muted-foreground font-semibold block">
                            Combined Protocol Price:
                        </span>
                        {isBothSelected && savings > 0 ? (
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                                <Sparkles className="h-3 w-3" /> You Save ${savings.toFixed(2)} ({fbtConfig.discountValue}%)
                            </span>
                        ) : (
                            <span className="text-[11px] text-muted-foreground">
                                Select both to unlock protocol discount
                            </span>
                        )}
                    </div>
                    <div className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                            {isBothSelected && savings > 0 && (
                                <span className="text-xs sm:text-sm text-muted-foreground line-through font-normal">
                                    ${rawTotal.toFixed(2)}
                                </span>
                            )}
                            <span className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight">
                                ${finalBundlePrice.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>

                <Button
                    type="button"
                    onClick={handleAddBundle}
                    disabled={isAdding || (!includeCurrent && !includePartner)}
                    className="w-full h-11 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center justify-center gap-2 transition-all hover:scale-[1.005] active:scale-[0.99]"
                >
                    {isAdding ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <>
                            <ShoppingCart className="h-4 w-4" />
                            <span>
                                {isBothSelected 
                                    ? (fbtConfig.ctaButtonText || "Add Protocol Pair & Save") 
                                    : (includeCurrent ? "Add Item to Cart" : "Add Partner to Cart")}
                            </span>
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
};

export default FrequentlyBoughtTogether;
