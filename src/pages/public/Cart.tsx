import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { Trash2, Plus, Minus, ArrowRight, AlertTriangle, Sparkles, Gift, Lock, Truck, Tag, Layers, Check, Package } from "lucide-react";
import { useCart, ProductVariant } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import PeptideUpsellModal from "@/components/public/PeptideUpsellModal";
import PromoSplashModal from "@/components/public/PromoSplashModal";
import { usePeptideUpsellSettings } from "@/hooks/usePeptideUpsellSettings";
import { usePromoSplashSettings } from "@/hooks/usePromoSplashSettings";
import { 
    getActiveCampaigns, 
    resolveCartCampaigns, 
    CampaignEvaluationResult 
} from "@/config/promoSplashConfig";
import { 
    DEFAULT_PEPTIDE_UPSELL_SETTINGS, 
    PeptideUpsellSettings, 
    cartHasOnlyWater, 
    calculatePeptideUpsellDiscount 
} from "@/config/upsellConfig";

const QuantityInput = ({ 
    initialValue, 
    minQty, 
    maxQty,
    onChange 
}: { 
    initialValue: number; 
    minQty: number; 
    maxQty?: number;
    onChange: (val: number) => void;
}) => {
    const [inputValue, setInputValue] = useState<string>(initialValue.toString());

    useEffect(() => {
        setInputValue(initialValue.toString());
    }, [initialValue]);

    const handleBlur = () => {
        const val = parseInt(inputValue);
        if (isNaN(val) || val < minQty) {
            setInputValue(minQty.toString());
            onChange(minQty);
        } else if (maxQty !== undefined && maxQty > 0 && val > maxQty) {
            setInputValue(maxQty.toString());
            onChange(maxQty);
        } else {
            onChange(val);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.currentTarget.blur();
        }
    };

    return (
        <input
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-14 text-center text-sm px-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
    );
};

const Cart = () => {
    const { items, addToCart, removeFromCart, updateQuantity, cartTotal } = useCart();
    const navigate = useNavigate();
    const [requireResearchAck, setRequireResearchAck] = useState(false);
    const [ackResearch, setAckResearch] = useState(false);
    const [ackTerms, setAckTerms] = useState(false);
    const [isUpsellModalOpen, setIsUpsellModalOpen] = useState(false);

    // Weekly Promo Splash Settings (Pre-Checkout Trigger & View All Offers)
    const { data: promoSettings } = usePromoSplashSettings();
    const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
    const [hasSeenPromoInCart, setHasSeenPromoInCart] = useState(false);
    const [modalInitialSlide, setModalInitialSlide] = useState(0);
    const [promoModalIntent, setPromoModalIntent] = useState<"view_all" | "checkout_intercept">("view_all");

    // Catalog products query for Gift Pool items & Dynamic Upsell
    const { data: cartCatalogProducts } = useQuery({
        queryKey: ["cart_catalog_products_for_promos"],
        queryFn: async () => {
            const { data } = await supabase
                .from("products")
                .select(`
                    id, name, slug, image_url, category_id,
                    variants:product_variants(
                        id, product_id, sku, price, stock_quantity, pack_size, bulk_price, vial_type_id,
                        vial_type:vial_types(name, capacity_ml, color, shape)
                    )
                `)
                .eq("is_published", true);
            return (data || []).map((p: any) => ({
                ...p,
                product_variants: p.variants || p.product_variants || []
            }));
        },
    });

    const getProductStock = (p: any) => {
        if (!p) return 0;
        const vList = p.product_variants || p.variants || [];
        return vList.reduce((acc: number, v: any) => acc + (v.stock_quantity ?? 0), 0);
    };

    const [selectedPromoGifts, setSelectedPromoGifts] = useState<Record<string, string>>(() => {
        try {
            const stored = localStorage.getItem("vialflow_selected_promo_gifts");
            return stored ? JSON.parse(stored) : {};
        } catch {
            return {};
        }
    });

    const handleSelectPromoGift = (campaignId: string, productId: string) => {
        setSelectedPromoGifts(prev => {
            const updated = { ...prev, [campaignId]: productId };
            try {
                localStorage.setItem("vialflow_selected_promo_gifts", JSON.stringify(updated));
            } catch (_) {}
            return updated;
        });
        toast.success("Free research gift selection updated!");
    };

    const handleAddCrossSellProduct = (product: any) => {
        const variantsList = product.product_variants || product.variants || [];
        const defaultVariant = variantsList[0];
        if (!defaultVariant) {
            toast.error("Product variant not available");
            return;
        }
        const variantObj: ProductVariant = {
            id: defaultVariant.id,
            product_id: product.id,
            vial_type_id: defaultVariant.vial_type_id || defaultVariant.vial_type?.id || "",
            sku: defaultVariant.sku || null,
            price: defaultVariant.price,
            stock_quantity: defaultVariant.stock_quantity || 999,
            max_online_quantity: null,
            weight: defaultVariant.weight || null,
            image_url: defaultVariant.image_url || product.image_url,
            pack_size: defaultVariant.pack_size || 1,
            bulk_price: defaultVariant.bulk_price,
            product: {
                id: product.id,
                name: product.name,
                slug: product.slug,
                image_url: product.image_url,
                description: null,
                category: "Peptides",
            },
            vial_type: {
                name: defaultVariant.vial_type?.name || "Single Vial",
                capacity_ml: defaultVariant.vial_type?.capacity_ml || 0,
                color: defaultVariant.vial_type?.color || null,
                shape: defaultVariant.vial_type?.shape || null,
            },
        };
        addToCart(variantObj, 1);
        toast.success(`Added ${product.name} with promotional discount applied!`);
    };

    useEffect(() => {
        const fetchAckSetting = async () => {
            try {
                const { data } = await supabase
                    .from("app_settings" as any)
                    .select("value")
                    .eq("key", "require_research_acknowledgment")
                    .maybeSingle();
                if (data) {
                    setRequireResearchAck(data.value === "true");
                }
            } catch (err) {
                // Silently ignore settings fetch error
            }
        };
        fetchAckSetting();
    }, []);

    // Fetch dynamic upsell settings from app_settings
    const { data: upsellSettings } = usePeptideUpsellSettings();
    const activeSettings = upsellSettings || DEFAULT_PEPTIDE_UPSELL_SETTINGS;

    // Check if promotional discount is eligible
    const upsellDiscount = useMemo(() => {
        return calculatePeptideUpsellDiscount(items, activeSettings);
    }, [items, activeSettings]);

    // All active store promotional campaigns across all placements
    const allActiveCampaigns = useMemo(() => {
        const rawCampaigns = promoSettings?.campaigns && promoSettings.campaigns.length > 0
            ? promoSettings.campaigns
            : (promoSettings?.enabled ? [promoSettings as any] : []);
        return getActiveCampaigns(rawCampaigns);
    }, [promoSettings]);

    // Active campaigns eligible for automatic pre-checkout interception
    const activeCheckoutCampaigns = useMemo(() => {
        return getActiveCampaigns(allActiveCampaigns, "checkout");
    }, [allActiveCampaigns]);

    const evaluatedCampaigns = useMemo(() => {
        return resolveCartCampaigns(allActiveCampaigns, items);
    }, [allActiveCampaigns, items]);

    const promoGroupDiscounts = useMemo(() => {
        return evaluatedCampaigns
            .filter(e => e.isUnlocked && !e.isSuppressed && e.campaign.offerMode === "group_discount")
            .reduce((sum, e) => sum + (e.rewardDiscountAmount || 0), 0);
    }, [evaluatedCampaigns]);

    // Auto-select first in-stock gift if none selected or if selected gift went out of stock
    useEffect(() => {
        if (!cartCatalogProducts || cartCatalogProducts.length === 0) return;
        const unlockedPoolCampaigns = evaluatedCampaigns.filter(
            e => e.isUnlocked && !e.isSuppressed && e.campaign.offerMode === "gift_with_purchase" && e.campaign.rewardSelectionMode === "pool_choice"
        );
        unlockedPoolCampaigns.forEach(e => {
            const poolIds = e.campaign.rewardPoolProductIds || [];
            const currentSelected = selectedPromoGifts[e.campaign.id];
            const currentSelectedProd = cartCatalogProducts.find(p => p.id === currentSelected);
            const isCurrentValidAndInStock = currentSelectedProd && getProductStock(currentSelectedProd) > 0;
            if (!isCurrentValidAndInStock) {
                // Fall back to first in-stock product in pool
                const firstInStock = cartCatalogProducts.find(p => poolIds.includes(p.id) && getProductStock(p) > 0);
                if (firstInStock) {
                    setSelectedPromoGifts(prev => {
                        const updated = { ...prev, [e.campaign.id]: firstInStock.id };
                        try {
                            localStorage.setItem("vialflow_selected_promo_gifts", JSON.stringify(updated));
                        } catch (_) {}
                        return updated;
                    });
                }
            }
        });
    }, [evaluatedCampaigns, cartCatalogProducts, selectedPromoGifts]);

    const getItemDiscountCampaign = (productId: string) => {
        return evaluatedCampaigns.find(
            e => e.isUnlocked && !e.isSuppressed && e.campaign.offerMode === "group_discount" &&
            (e.campaign.rewardDiscountProductIds?.length ? e.campaign.rewardDiscountProductIds.includes(productId) : true)
        )?.campaign;
    };

    const finalSubtotal = Math.max(0, cartTotal - (upsellDiscount.isEligible ? upsellDiscount.discountAmount : 0) - promoGroupDiscounts);

    const hasUnlockedFreeShipping = useMemo(() => {
        return evaluatedCampaigns.some(e => e.isUnlocked && !e.isSuppressed && e.campaign.offerMode === "free_shipping");
    }, [evaluatedCampaigns]);

    // Handle proceed to checkout directly without intercepting modal friction
    const handleProceedToCheckout = () => {
        const onlyWater = cartHasOnlyWater(items);

        if (onlyWater && activeSettings.enabled) {
            setIsUpsellModalOpen(true);
        } else {
            navigate("/checkout");
        }
    };

    const handleDeclineUpsell = () => {
        setIsUpsellModalOpen(false);
        navigate("/checkout");
    };

    return (
        <div className="container py-12">
            <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>

            {items.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-muted-foreground mb-4">Your cart is empty.</p>
                    <Link to="/products">
                        <Button>Browse Products</Button>
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    <div className="lg:col-span-2 space-y-6">
                        {/* Peptide Cross-Sell Banner (if no peptides yet) */}
                        {cartHasOnlyWater(items) && activeSettings.enabled && (
                            <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/80 text-white border border-emerald-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                                <div className="space-y-1 relative z-10">
                                    <div className="flex items-center gap-2">
                                        <Badge className="bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                                            <Gift className="h-3 w-3 mr-1" /> {activeSettings.badgeText}
                                        </Badge>
                                        <h4 className="font-bold text-sm text-white">Get Your Water 100% FREE</h4>
                                    </div>
                                    <p className="text-xs text-slate-300">
                                        {activeSettings.minPeptideSpend > 0 
                                            ? `Add $${activeSettings.minPeptideSpend}+ of research peptides to your cart and unlock a 100% instant discount on your Reconstitution Solution.`
                                            : "Add any research peptide to your cart and unlock a 100% instant discount on your Reconstitution Solution."}
                                    </p>
                                </div>
                                <Button 
                                    size="sm" 
                                    onClick={() => setIsUpsellModalOpen(true)}
                                    className="shrink-0 w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 shadow-xs rounded-xl gap-1.5"
                                >
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Claim Special Offer
                                </Button>
                            </div>
                        )}

                        {/* Cart Items */}
                        {items.map((item) => {
                            const itemGroupCamp = getItemDiscountCampaign(item.variant.product_id);
                            const bulkPrice = item.variant.bulk_price ?? null;
                            const labelFee = item.with_labels ? (item.variant.bulk_label_fee ?? 0.15) : 0;
                            const unitPrice = item.is_bulk && bulkPrice !== null ? (bulkPrice + labelFee) : (item.variant.bulk_only ? (item.variant.price + labelFee) : item.variant.price);
                            const regularItemTotal = unitPrice * item.quantity;
                            const hasItemDiscount = Boolean(itemGroupCamp && (itemGroupCamp.rewardDiscountValue ?? 0) > 0);
                            const discountedItemTotal = hasItemDiscount
                                ? (itemGroupCamp?.rewardDiscountType === "fixed_amount"
                                    ? Math.max(0, regularItemTotal - (itemGroupCamp.rewardDiscountValue || 0))
                                    : regularItemTotal * (1 - (itemGroupCamp?.rewardDiscountValue || 0) / 100))
                                : regularItemTotal;

                            return (
                                <div key={item.variant.id} className="flex gap-4 p-4 bg-card border rounded-lg">
                                    <Link to={`/products/${item.variant.product.slug || item.variant.product_id}`} className="h-24 w-24 bg-muted rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden hover:opacity-80 transition-opacity">
                                        {(() => {
                                            const displayImage = item.variant.image_url || item.variant.product.image_url;
                                            return displayImage ? (
                                                <img src={displayImage} alt={item.variant.product.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-xs text-muted-foreground">No Image</span>
                                            );
                                        })()}
                                    </Link>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <Link to={`/products/${item.variant.product.slug || item.variant.product_id}`} className="hover:underline">
                                                    <h3 className="font-semibold">{item.variant.product.name}</h3>
                                                </Link>
                                                <p className="text-sm text-muted-foreground">
                                                    {(item.variant.product.category?.toLowerCase().includes("peptide") || item.variant.vial_type?.name?.toLowerCase().includes("mg")) ? (
                                                        <>
                                                            <span>{item.variant.vial_type?.name || `${item.variant.vial_type?.capacity_ml}mg`}</span>
                                                            {item.variant.pack_size > 1 ? (
                                                                <span className="font-medium text-foreground"> ({item.variant.pack_size}x Pack)</span>
                                                            ) : (
                                                                <span> (Single Vial)</span>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span>{item.variant.vial_type?.name || `${item.variant.vial_type?.capacity_ml}ml`}</span>
                                                            {item.variant.vial_type?.color && <span> - {item.variant.vial_type.color}</span>}
                                                            {item.variant.vial_type?.shape && <span> - {item.variant.vial_type.shape}</span>}
                                                            {item.variant.pack_size > 1 && <span> ({item.variant.pack_size}x Pack)</span>}
                                                        </>
                                                    )}
                                                </p>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {item.is_bulk && (
                                                        <>
                                                            <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                                                                Bulk Purchase
                                                            </Badge>
                                                            <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
                                                                {item.with_labels ? "With Labels" : "Unlabeled"}
                                                            </Badge>
                                                        </>
                                                    )}
                                                    {hasItemDiscount && (
                                                        <Badge variant="outline" className="text-xs bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold flex items-center gap-1">
                                                            <Sparkles className="h-3 w-3 text-emerald-500" />
                                                            {itemGroupCamp?.rewardDiscountType === "fixed_amount" 
                                                                ? `$${itemGroupCamp.rewardDiscountValue} OFF Special` 
                                                                : `${itemGroupCamp?.rewardDiscountValue}% OFF Special`}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => removeFromCart(item.variant.id, item.is_bulk, item.with_labels)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-4">{item.variant.product.category || "Product"}</p>
                                        <div className="flex justify-between items-center">
                                             <div className="flex items-center gap-3">
                                                 <div className="flex items-center border rounded-md">
                                                     <Button
                                                         variant="ghost"
                                                         size="icon"
                                                         className="h-8 w-8 rounded-none"
                                                         onClick={() => updateQuantity(item.variant.id, item.quantity - 1, item.is_bulk, item.with_labels)}
                                                     >
                                                         <Minus className="h-3 w-3" />
                                                     </Button>
                                                     <QuantityInput
                                                         initialValue={item.quantity}
                                                         minQty={(item.is_bulk || !!item.variant.bulk_only) ? (item.variant.bulk_min_qty ?? 100) : 1}
                                                         maxQty={item.variant.stock_quantity ?? 999}
                                                         onChange={(val) => updateQuantity(item.variant.id, val, item.is_bulk, item.with_labels)}
                                                     />
                                                     <Button
                                                         variant="ghost"
                                                         size="icon"
                                                         className="h-8 w-8 rounded-none"
                                                         onClick={() => updateQuantity(item.variant.id, item.quantity + 1, item.is_bulk, item.with_labels)}
                                                     >
                                                         <Plus className="h-3 w-3" />
                                                     </Button>
                                                 </div>
                                                 {item.variant.pack_size > 1 && !item.is_bulk && !item.variant.bulk_only && (
                                                     <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                                                         Total: <strong className="text-foreground">{item.quantity * item.variant.pack_size}</strong> viales
                                                     </span>
                                                 )}
                                             </div>
                                            <div className="text-right">
                                                {hasItemDiscount ? (
                                                    <div className="flex flex-col items-end">
                                                        <span className="line-through text-xs text-muted-foreground">${regularItemTotal.toFixed(2)}</span>
                                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">${discountedItemTotal.toFixed(2)}</span>
                                                    </div>
                                                ) : (
                                                    <span className="font-bold">${regularItemTotal.toFixed(2)}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Unlocked Single Free Gift Card (Gift with Purchase) */}
                        {evaluatedCampaigns
                            .filter(e => e.isUnlocked && !e.isSuppressed && e.campaign.offerMode === "gift_with_purchase" && e.campaign.rewardSelectionMode !== "pool_choice")
                            .map(evalResult => {
                                const camp = evalResult.campaign;
                                const giftName = camp.rewardProductName || "Research Free Gift";
                                const giftImage = camp.rewardProductImage;
                                const matchingCartItem = items.find(item => 
                                    item.variant.product.name.toLowerCase().trim() === giftName.toLowerCase().trim() ||
                                    giftName.toLowerCase().includes(item.variant.product.name.toLowerCase()) ||
                                    item.variant.product.name.toLowerCase().includes(giftName.toLowerCase())
                                );
                                const hasSameItemInCart = !!matchingCartItem;

                                return (
                                    <div key={camp.id} className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-card to-emerald-500/5 border-2 border-emerald-500/30 space-y-3 shadow-xs animate-in fade-in-50 duration-300">
                                        <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
                                            <span className="flex items-center gap-1.5 font-bold text-xs text-emerald-700 dark:text-emerald-300 tracking-wide uppercase">
                                                <Gift className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                                Free Bonus Gift (Extra Item)
                                            </span>
                                            <Badge className="bg-emerald-500 text-emerald-950 font-extrabold text-[10px] uppercase tracking-wider">
                                                100% Free Unlocked
                                            </Badge>
                                        </div>

                                        <div className="flex justify-between items-center gap-3">
                                            <div className="flex items-center gap-3.5 min-w-0">
                                                <div className="relative h-14 w-14 bg-background rounded-xl border border-emerald-500/30 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-xs">
                                                    {giftImage ? (
                                                        <img 
                                                            src={giftImage} 
                                                            alt={giftName} 
                                                            className="h-full w-full object-cover" 
                                                        />
                                                    ) : (
                                                        <Package className="h-6 w-6 text-emerald-500" />
                                                    )}
                                                    <span className="absolute -top-1 -right-1 bg-emerald-600 text-white rounded-full p-0.5 shadow-xs">
                                                        <Gift className="h-2.5 w-2.5" />
                                                    </span>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-sm sm:text-base text-foreground truncate">
                                                        {giftName}
                                                    </p>
                                                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                                        +{camp.rewardQuantity || 1} Free Extra Unit (Will be packed with your order)
                                                    </p>
                                                    {hasSameItemInCart && (
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            *Included as an extra free unit in addition to the {matchingCartItem.quantity} unit(s) in your cart
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="text-right flex-shrink-0">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                                    100% FREE
                                                </span>
                                                <p className="text-[10px] text-muted-foreground mt-0.5">$0.00 Gift</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                        {/* Interactive Gift Choice Pool Card (Unlocked Pool Campaign) */}
                        {evaluatedCampaigns
                            .filter(e => e.isUnlocked && !e.isSuppressed && e.campaign.offerMode === "gift_with_purchase" && e.campaign.rewardSelectionMode === "pool_choice")
                            .map(evalResult => {
                                const camp = evalResult.campaign;
                                const poolIds = camp.rewardPoolProductIds || [];
                                const poolProducts = (cartCatalogProducts || []).filter(p => poolIds.includes(p.id));
                                const selectedId = selectedPromoGifts[camp.id];

                                if (poolProducts.length === 0) return null;

                                return (
                                    <div key={camp.id} className="bg-gradient-to-br from-emerald-950/20 via-card to-teal-950/20 border-2 border-emerald-500/40 rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in-50 duration-300">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="h-9 w-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                                                    <Gift className="h-5 w-5 text-emerald-500" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-bold text-sm sm:text-base text-foreground">
                                                            Choose Your Free Research Gift
                                                        </h3>
                                                        <Badge className="bg-emerald-500 text-emerald-950 font-extrabold text-[10px] uppercase tracking-wider">
                                                            100% Free Unlocked
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        {camp.rewardPoolLabel 
                                                            ? `Select your preferred gift from the ${camp.rewardPoolLabel} pool:` 
                                                            : "Your qualifying order includes 1 free research gift! Select which one you would like:"}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                                            {poolProducts.map(prod => {
                                                const stock = getProductStock(prod);
                                                const isStockAvailable = stock > 0;
                                                const isSelected = selectedId === prod.id;

                                                return (
                                                    <div
                                                        key={prod.id}
                                                        onClick={() => {
                                                            if (isStockAvailable) {
                                                                handleSelectPromoGift(camp.id, prod.id);
                                                            } else {
                                                                toast.error("This item is currently out of stock. Automatic fallback is active.");
                                                            }
                                                        }}
                                                        className={`relative p-3 rounded-xl border-2 transition-all flex flex-col justify-between gap-2 ${
                                                            isSelected
                                                                ? "bg-emerald-500/10 border-emerald-500 shadow-md ring-2 ring-emerald-500/20 cursor-pointer"
                                                                : isStockAvailable
                                                                    ? "bg-card hover:bg-muted/50 border-border hover:border-emerald-500/40 cursor-pointer"
                                                                    : "bg-muted/40 border-dashed border-border/60 opacity-60 cursor-not-allowed"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-12 w-12 rounded-lg bg-muted border overflow-hidden shrink-0">
                                                                {prod.image_url ? (
                                                                    <img src={prod.image_url} alt={prod.name} className="h-full w-full object-cover" />
                                                                ) : (
                                                                    <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground">Gift</div>
                                                                )}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="font-semibold text-xs text-foreground truncate">{prod.name}</p>
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">FREE</span>
                                                                    {isStockAvailable ? (
                                                                        <span className="text-[10px] text-muted-foreground font-medium">• In Stock</span>
                                                                    ) : (
                                                                        <span className="text-[10px] text-amber-500 font-medium">• Out of Stock</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                                                isSelected ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/30"
                                                            }`}>
                                                                {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                                                            </div>
                                                        </div>
                                                        {isSelected && (
                                                            <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-center">
                                                                ✓ Selected Gift for Checkout
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}

                        {/* Dynamic Complementary Peptide Cross-Sell (Group Discount Unlocked but none in cart) */}
                        {evaluatedCampaigns
                            .filter(e => e.isUnlocked && !e.isSuppressed && e.campaign.offerMode === "group_discount" && (!e.rewardMatchingItemCount || e.rewardMatchingItemCount === 0))
                            .map(evalResult => {
                                const camp = evalResult.campaign;
                                const discountVal = camp.rewardDiscountValue || 20;
                                const targetIds = camp.rewardDiscountProductIds || [];
                                const eligibleCatalogProducts = (cartCatalogProducts || [])
                                    .filter(p => (targetIds.length === 0 || targetIds.includes(p.id)) && getProductStock(p) > 0)
                                    .slice(0, 3);

                                if (eligibleCatalogProducts.length === 0) return null;

                                return (
                                    <div key={camp.id} className="bg-gradient-to-r from-primary/10 via-card to-emerald-950/15 border-2 border-primary/30 rounded-2xl p-5 shadow-sm space-y-3 animate-in fade-in-50 duration-300">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="h-9 w-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                                                    <Sparkles className="h-5 w-5 text-primary" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-bold text-sm sm:text-base text-foreground">
                                                            Special Complementary Discount Unlocked!
                                                        </h3>
                                                        <Badge className="bg-primary text-primary-foreground font-extrabold text-[10px]">
                                                            {camp.rewardDiscountType === "fixed_amount" ? `$${discountVal} OFF` : `${discountVal}% OFF`}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        {camp.rewardDiscountGroupLabel 
                                                            ? `You unlocked ${camp.rewardDiscountType === "fixed_amount" ? `$${discountVal}` : `${discountVal}%`} OFF on any ${camp.rewardDiscountGroupLabel}! Add one to save instantly:`
                                                            : `You unlocked ${camp.rewardDiscountType === "fixed_amount" ? `$${discountVal}` : `${discountVal}%`} OFF on complementary research peptides! Add one to save instantly:`}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                                            {eligibleCatalogProducts.map(prod => {
                                                const defaultVariant = prod.product_variants?.[0];
                                                if (!defaultVariant) return null;
                                                const origPrice = defaultVariant.price;
                                                const discountedPrice = camp.rewardDiscountType === "fixed_amount"
                                                    ? Math.max(0, origPrice - discountVal)
                                                    : origPrice * (1 - discountVal / 100);

                                                return (
                                                    <div key={prod.id} className="p-3 bg-card border rounded-xl flex flex-col justify-between gap-2 shadow-xs hover:border-primary/40 transition-all">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="h-10 w-10 rounded-md bg-muted border overflow-hidden shrink-0">
                                                                {prod.image_url ? (
                                                                    <img src={prod.image_url} alt={prod.name} className="h-full w-full object-cover" />
                                                                ) : (
                                                                    <div className="h-full w-full flex items-center justify-center text-[10px] text-muted-foreground">Peptide</div>
                                                                )}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="font-semibold text-xs text-foreground truncate">{prod.name}</p>
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    <span className="text-[10px] line-through text-muted-foreground">${origPrice.toFixed(2)}</span>
                                                                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">${discountedPrice.toFixed(2)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleAddCrossSellProduct(prod)}
                                                            className="w-full h-8 text-xs font-bold gap-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-xs"
                                                        >
                                                            <Plus className="h-3.5 w-3.5" />
                                                            Add ({camp.rewardDiscountType === "fixed_amount" ? `$${discountVal} OFF` : `${discountVal}% OFF`})
                                                        </Button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>

                    <div className="lg:col-span-1">
                        <div className="bg-card border rounded-lg p-6 sticky top-24 space-y-4">
                            <h3 className="font-semibold text-lg">Order Summary</h3>

                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span>${cartTotal.toFixed(2)}</span>
                                </div>

                                {/* Applied Peptide Upsell Promo Discount */}
                                {upsellDiscount.isEligible && upsellDiscount.discountAmount > 0 && (
                                    <div className="flex justify-between items-center text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                                        <span className="flex items-center gap-1.5">
                                            <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                            {upsellDiscount.discountLabel}
                                        </span>
                                        <span>-${upsellDiscount.discountAmount.toFixed(2)}</span>
                                    </div>
                                )}

                                {/* Applied Promotional Group Discount */}
                                {promoGroupDiscounts > 0 && (
                                    <div className="flex justify-between items-center text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                                        <span className="flex items-center gap-1.5">
                                            <Tag className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                            Promotional Group Discount
                                        </span>
                                        <span>-${promoGroupDiscounts.toFixed(2)}</span>
                                    </div>
                                )}

                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Shipping</span>
                                    {hasUnlockedFreeShipping ? (
                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                            <Truck className="h-3.5 w-3.5" /> FREE (Unlocked)
                                        </span>
                                    ) : (
                                        <span>Calculated at checkout</span>
                                    )}
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Tax</span>
                                    <span>$0.00</span>
                                </div>
                                <div className="border-t pt-3 flex justify-between font-bold text-base">
                                    <span>Total</span>
                                    <span>${finalSubtotal.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Active Store Promotions & Unlocked Perks */}
                            {evaluatedCampaigns.length > 0 && (
                                <div className="space-y-2 pt-2 border-t border-border/50">
                                    <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider px-0.5">
                                        <span className="flex items-center gap-1.5">
                                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                                            <span>Active Research Perks</span>
                                        </span>
                                        <span 
                                            onClick={() => {
                                                setModalInitialSlide(0);
                                                setPromoModalIntent("view_all");
                                                setIsPromoModalOpen(true);
                                            }}
                                            className="text-[11px] text-primary hover:underline cursor-pointer lowercase first-letter:uppercase font-medium"
                                        >
                                            View all offers
                                        </span>
                                    </div>
                                    {evaluatedCampaigns.map((result) => {
                                        const { campaign: camp, isUnlocked, progressPercent, statusText, isSuppressed } = result;

                                        return (
                                            <div 
                                                key={camp.id}
                                                onClick={() => {
                                                    const campIdx = allActiveCampaigns.findIndex(c => c.id === camp.id);
                                                    setModalInitialSlide(Math.max(0, campIdx));
                                                    setPromoModalIntent("view_all");
                                                    setIsPromoModalOpen(true);
                                                }}
                                                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                                                    isSuppressed
                                                        ? "bg-muted/30 border-dashed border-border/60 text-muted-foreground opacity-75"
                                                        : isUnlocked 
                                                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-300 hover:bg-emerald-500/15 shadow-xs" 
                                                            : "bg-muted/40 border-border/60 hover:bg-muted/60 text-muted-foreground"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                    <span className="font-bold flex items-center gap-1.5 text-foreground">
                                                        {camp.offerMode === "free_shipping" ? (
                                                            <Truck className={`h-3.5 w-3.5 ${isUnlocked ? "text-emerald-500" : "text-blue-500"}`} />
                                                        ) : camp.offerMode === "gift_with_purchase" ? (
                                                            <Gift className={`h-3.5 w-3.5 ${isUnlocked ? "text-emerald-500" : "text-primary"}`} />
                                                        ) : (
                                                            <Tag className={`h-3.5 w-3.5 ${isUnlocked ? "text-emerald-500" : "text-primary"}`} />
                                                        )}
                                                        {camp.badgeText || "PROMOTION"}
                                                    </span>
                                                    <span className={`font-semibold text-[11px] ${isUnlocked ? "text-emerald-600 dark:text-emerald-400 font-extrabold" : ""}`}>
                                                        {statusText}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {camp.offerMode === "gift_with_purchase" && camp.rewardProductImage && (
                                                        <img 
                                                            src={camp.rewardProductImage} 
                                                            alt={camp.rewardProductName || "Free Gift"} 
                                                            className="w-7 h-7 rounded-md object-cover border border-border/60 shrink-0 bg-muted"
                                                        />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] font-medium text-foreground truncate">
                                                            {camp.offerMode === "gift_with_purchase" && camp.rewardProductName 
                                                                ? `+${camp.rewardQuantity || 1} Free ${camp.rewardProductName}` 
                                                                : camp.offerMode === "free_shipping"
                                                                    ? "Free Standard Carrier Shipping"
                                                                    : camp.couponCode
                                                                        ? `Code: ${camp.couponCode} — ${camp.headline}`
                                                                        : camp.headline}
                                                        </p>
                                                        {camp.targetScope && camp.targetScope !== "all" && (
                                                            <span className="text-[10px] text-muted-foreground block truncate">
                                                                Scope: {camp.targetScope === "category" 
                                                                    ? (camp.targetCategory || "Category") 
                                                                    : camp.targetScope === "group"
                                                                        ? (camp.targetGroupLabel || `${(camp.targetProductIds?.length || 0) + (camp.targetVariantIds?.length || 0)} Items`)
                                                                        : `${camp.targetProductName || "Selected Item"}${camp.targetVariantName ? ` (${camp.targetVariantName})` : ""}`}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {!isUnlocked && !isSuppressed && progressPercent < 100 && (
                                                    <div className="w-full h-1.5 bg-muted rounded-full mt-2 overflow-hidden border border-border/40">
                                                        <div 
                                                            className="h-full bg-primary rounded-full transition-all duration-300" 
                                                            style={{ width: `${progressPercent}%` }} 
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {requireResearchAck && (
                                <div className="p-4 rounded-lg border-l-4 border-destructive bg-destructive/5 space-y-3 text-left shadow-sm">
                                    <div className="flex items-center gap-2 text-destructive font-semibold text-xs uppercase tracking-wider">
                                        <AlertTriangle className="h-4 w-4" />
                                        Research Use Only — Required Acknowledgment
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        By proceeding to checkout, you confirm that:
                                    </p>
                                    
                                    <div className="space-y-3">
                                        <div className="flex items-start space-x-2">
                                            <Checkbox 
                                                id="cart-ruo-ack" 
                                                checked={ackResearch} 
                                                onCheckedChange={(checked) => setAckResearch(checked === true)} 
                                                className="mt-1 flex-shrink-0"
                                            />
                                            <Label htmlFor="cart-ruo-ack" className="text-xs text-muted-foreground font-normal leading-normal cursor-pointer select-none">
                                                I am a qualified researcher, scientist, or institutional professional purchasing on behalf of a licensed research institution, laboratory, or organization. I understand that all products are exclusively for <strong>laboratory research use only (RUO)</strong> and are <strong>not approved or intended for use in humans or animals</strong>, nor for clinical, diagnostic, or therapeutic purposes.
                                            </Label>
                                        </div>

                                        <div className="flex items-start space-x-2">
                                            <Checkbox 
                                                id="cart-terms-ack" 
                                                checked={ackTerms} 
                                                onCheckedChange={(checked) => setAckTerms(checked === true)}
                                                className="mt-1 flex-shrink-0"
                                            />
                                            <Label htmlFor="cart-terms-ack" className="text-xs text-muted-foreground font-normal leading-normal cursor-pointer select-none">
                                                I have read and agree to the <Link to="/terms" target="_blank" className="text-primary hover:underline font-medium">Terms & Conditions</Link>.
                                            </Label>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {(!requireResearchAck || (ackResearch && ackTerms)) ? (
                                <Button 
                                    onClick={handleProceedToCheckout}
                                    className="w-full shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all font-semibold h-12 text-sm" 
                                    size="lg"
                                >
                                    Proceed to Checkout <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            ) : (
                                <Button className="w-full cursor-not-allowed opacity-50 font-semibold h-12 text-sm" size="lg" disabled>
                                    Proceed to Checkout <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            )}

                            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground text-center pt-1">
                                <Lock className="h-3 w-3 shrink-0" />
                                <span>Guaranteed safe & secure checkout</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Pre-Checkout Peptide Upsell Modal */}
            <PeptideUpsellModal
                isOpen={isUpsellModalOpen}
                onClose={() => setIsUpsellModalOpen(false)}
                onDecline={handleDeclineUpsell}
            />

            {/* Promotional Campaigns Modal (Pre-Checkout Interception & View All Offers) */}
            <PromoSplashModal
                isOpen={isPromoModalOpen}
                onClose={() => {
                    setIsPromoModalOpen(false);
                    if (promoModalIntent === "checkout_intercept") {
                        navigate("/checkout");
                    }
                }}
                onClaim={() => {
                    setIsPromoModalOpen(false);
                    if (promoModalIntent === "checkout_intercept") {
                        navigate("/checkout");
                    }
                }}
                settings={promoSettings}
                campaigns={allActiveCampaigns}
                initialSlide={modalInitialSlide}
            />
        </div>
    );
};

export default Cart;
