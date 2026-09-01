import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart, ProductVariant } from "@/contexts/CartContext";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    Sparkles, 
    ArrowRight, 
    Package, 
    ShieldCheck, 
    Gift,
    Plus,
    Loader2
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { 
    DEFAULT_PEPTIDE_UPSELL_SETTINGS, 
    PeptideUpsellSettings, 
    isWaterCartItem 
} from "@/config/upsellConfig";
import { toast } from "sonner";

import { usePeptideUpsellSettings } from "@/hooks/usePeptideUpsellSettings";

interface PeptideUpsellModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDecline: () => void;
}

export default function PeptideUpsellModal({
    isOpen,
    onClose,
    onDecline
}: PeptideUpsellModalProps) {
    const { items, addToCart } = useCart();
    const navigate = useNavigate();
    const [addingVariantId, setAddingVariantId] = useState<string | null>(null);
    const [selectedVariantMap, setSelectedVariantMap] = useState<Record<string, string>>({});

    // Calculate the highest value water product in cart to display exact savings
    const waterSavings = useMemo(() => {
        const waterItems = items.filter(isWaterCartItem);
        if (waterItems.length === 0) return 14.99;
        const prices = waterItems.map(item => {
            const bulkPrice = item.variant.bulk_price ?? null;
            const labelFee = item.with_labels ? (item.variant.bulk_label_fee ?? 0.15) : 0;
            return item.is_bulk && bulkPrice !== null ? (bulkPrice + labelFee) : (item.variant.bulk_only ? (item.variant.price + labelFee) : item.variant.price);
        });
        return Math.max(...prices);
    }, [items]);

    // Fetch dynamic upsell settings using unified hook
    const { data: settings } = usePeptideUpsellSettings();
    const currentSettings = settings || DEFAULT_PEPTIDE_UPSELL_SETTINGS;

    // Fetch published research peptides to display in modal
    const { data: peptideProducts, isLoading: loadingProducts } = useQuery({
        queryKey: ["featured-upsell-peptides"],
        staleTime: 60000,
        enabled: isOpen,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("products")
                .select(`
                    id,
                    name,
                    slug,
                    image_url,
                    images,
                    description,
                    product_categories(name),
                    variants:product_variants(
                        id,
                        price,
                        stock_quantity,
                        pack_size,
                        image_url,
                        images,
                        vial_type:vial_types(name, capacity_ml)
                    )
                `)
                .eq("is_published", true)
                .or("is_archived.eq.false,is_archived.is.null")
                .order("position", { ascending: true })
                .limit(30);

            if (error) throw error;

            // Filter for peptide products (exclude reconstitution solution/water) with at least one in-stock variant
            const filtered = (data || []).filter((p: any) => {
                const cat = (p.product_categories?.name || "").toLowerCase();
                const name = (p.name || "").toLowerCase();
                const isWater = cat.includes("water") || cat.includes("reconstitution") || name.includes("reconstitution") || name.includes("bac water") || name.includes("bacteriostatic");
                const inStockVariants = (p.variants || []).filter((v: any) => (v.stock_quantity ?? 999) > 0);
                return !isWater && inStockVariants.length > 0;
            }).map((p: any) => ({
                ...p,
                // Only provide in-stock variants in the selector
                variants: (p.variants || []).filter((v: any) => (v.stock_quantity ?? 999) > 0)
            }));

            return filtered.slice(0, 4); // Show top 4 in-stock research peptides
        }
    });

    const handleAddPeptideAndCheckout = (product: any, variant: any, displayImage: string | null) => {
        if (!variant || (variant.stock_quantity ?? 999) <= 0) {
            toast.error("This peptide is currently out of stock. Please select another dosage.");
            return;
        }

        setAddingVariantId(variant.id);
        try {
            // Construct standard ProductVariant for CartContext
            const fullVariant: ProductVariant = {
                id: variant.id,
                product_id: product.id,
                vial_type_id: variant.vial_type?.id || "",
                sku: null,
                price: variant.price,
                stock_quantity: variant.stock_quantity ?? 999,
                max_online_quantity: null,
                weight: null,
                image_url: displayImage || variant.image_url || product.image_url,
                pack_size: variant.pack_size || 1,
                product: {
                    name: product.name,
                    slug: product.slug,
                    image_url: displayImage || product.image_url,
                    description: product.description,
                    category: product.product_categories?.name || "Peptides"
                },
                vial_type: {
                    name: variant.vial_type?.name || `${variant.vial_type?.capacity_ml || 5}mg`,
                    capacity_ml: variant.vial_type?.capacity_ml || 5,
                    color: null,
                    shape: null
                }
            };

            addToCart(fullVariant, 1, false, false);
            toast.success(`🎉 ${product.name} added! Your free water promo has been applied.`);
            onClose();
            navigate("/checkout");
        } catch (error) {
            console.error("Error adding peptide upsell:", error);
            toast.error("Failed to add peptide. Please try again.");
        } finally {
            setAddingVariantId(null);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0 border-0 rounded-2xl sm:rounded-3xl shadow-2xl bg-gradient-to-b from-card via-card to-background">
                {/* Header Banner with Premium Aesthetics */}
                <div className="relative p-6 sm:p-7 bg-gradient-to-r from-emerald-950/90 via-slate-900 to-teal-950/90 text-white border-b border-emerald-500/20 overflow-hidden">
                    <div className="absolute top-0 right-0 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                    
                    <div className="space-y-2 relative z-10">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 backdrop-blur-md">
                            <Gift className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                            {currentSettings.badgeText}
                        </div>
                        
                        <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
                            {currentSettings.headline}
                        </DialogTitle>
                        
                        <DialogDescription className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                            {currentSettings.subtitle}
                        </DialogDescription>
                    </div>

                    {/* Savings Highlight Pill */}
                    <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs backdrop-blur-xs">
                        <div className="flex items-center gap-2 font-medium text-emerald-200">
                            <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
                            <span>
                                {currentSettings.minPeptideSpend > 0 
                                    ? `Special Offer: Orders $${currentSettings.minPeptideSpend}+ in Peptides Qualify:`
                                    : "Instant Promotion Unlocked:"}
                            </span>
                        </div>
                        <span className="font-black text-emerald-300 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/40 text-xs shadow-xs">
                            FREE Water (Save ${waterSavings.toFixed(2)})
                        </span>
                    </div>
                </div>

                {/* Body Content */}
                <div className="p-5 sm:p-7 space-y-4">
                    {/* Top Action & Skip Navigation Strip (Immediately visible without scrolling) */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 p-3 rounded-xl bg-muted/40 border border-muted-foreground/15">
                        <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="w-full sm:w-auto text-xs font-bold gap-1.5 border-primary/40 hover:bg-primary/10 text-primary h-8 shadow-2xs"
                            onClick={() => onClose()}
                        >
                            <Link to="/products?category=peptides">
                                Browse Full Research Peptides Catalog
                                <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
                            </Link>
                        </Button>

                        <button
                            onClick={onDecline}
                            className="text-xs text-muted-foreground hover:text-foreground font-medium underline underline-offset-4 hover:no-underline transition-colors py-1 cursor-pointer text-center sm:text-right"
                        >
                            {currentSettings.declineButtonText} →
                        </button>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Package className="h-4 w-4 text-primary" />
                            Featured Research Peptides (Ready to Ship)
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-semibold">
                            <ShieldCheck className="h-3 w-3 mr-1" /> ≥99% HPLC Verified
                        </Badge>
                    </div>

                    {/* Products Grid */}
                    {loadingProducts ? (
                        <div className="py-12 text-center space-y-2">
                            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                            <p className="text-xs text-muted-foreground">Loading research peptides...</p>
                        </div>
                    ) : peptideProducts && peptideProducts.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {peptideProducts.map((product: any) => {
                                const selectedVarId = selectedVariantMap[product.id] || product.variants[0]?.id;
                                const currentVar = product.variants.find((v: any) => v.id === selectedVarId) || product.variants[0];
                                const isAdding = addingVariantId === currentVar?.id;
                                const varPrice = Number(currentVar?.price || 0);
                                const qualifiesDirectly = currentSettings.minPeptideSpend <= 0 || varPrice >= currentSettings.minPeptideSpend;

                                // Robust image resolution checking variant image_url, variant images array, product image_url, product images array
                                const displayImage = 
                                    currentVar?.image_url ||
                                    (currentVar?.images && currentVar.images.length > 0 ? currentVar.images[0] : null) ||
                                    product.image_url ||
                                    (product.images && product.images.length > 0 ? product.images[0] : null) ||
                                    product.variants?.find((v: any) => v.image_url)?.image_url ||
                                    product.variants?.find((v: any) => v.images && v.images.length > 0)?.images?.[0] ||
                                    null;

                                return (
                                    <div 
                                        key={product.id}
                                        className="flex flex-col justify-between p-3.5 rounded-xl border bg-card/60 hover:bg-muted/30 hover:border-emerald-500/40 transition-all shadow-xs group"
                                    >
                                        <div className="flex gap-3">
                                            {/* Product Thumbnail */}
                                            <div className="h-16 w-16 bg-muted/50 rounded-lg overflow-hidden shrink-0 border flex items-center justify-center">
                                                {displayImage ? (
                                                    <img 
                                                        src={displayImage} 
                                                        alt={product.name} 
                                                        loading="lazy"
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                                                    />
                                                ) : (
                                                    <Package className="h-6 w-6 text-muted-foreground/50" />
                                                )}
                                            </div>

                                            {/* Product Info */}
                                            <div className="space-y-1 min-w-0 flex-1">
                                                <h4 className="font-bold text-xs leading-tight truncate text-foreground" title={product.name}>
                                                    {product.name}
                                                </h4>
                                                
                                                {/* Dosage Selector if multiple variants */}
                                                {product.variants.length > 1 ? (
                                                    <select
                                                        value={selectedVarId}
                                                        onChange={(e) => setSelectedVariantMap(prev => ({ ...prev, [product.id]: e.target.value }))}
                                                        className="text-[11px] font-medium bg-muted/60 border rounded px-1.5 py-0.5 w-full cursor-pointer focus:outline-none"
                                                    >
                                                        {product.variants.map((v: any) => (
                                                            <option key={v.id} value={v.id}>
                                                                {v.vial_type?.name || `${v.vial_type?.capacity_ml || 5}mg`} — ${Number(v.price).toFixed(2)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <span className="text-[11px] text-muted-foreground font-mono">
                                                        {currentVar?.vial_type?.name || "Standard Vial"}
                                                    </span>
                                                )}

                                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                                    <span className="font-extrabold text-sm text-foreground">
                                                        ${varPrice.toFixed(2)}
                                                    </span>
                                                    {qualifiesDirectly ? (
                                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                                                            ✓ Unlocks Free Water
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-500/30">
                                                            + Free Water on ${currentSettings.minPeptideSpend}+ orders
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Button */}
                                        <Button
                                            size="sm"
                                            onClick={() => handleAddPeptideAndCheckout(product, currentVar, displayImage)}
                                            disabled={isAdding}
                                            className="mt-3 w-full h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs rounded-lg gap-1.5 transition-all cursor-pointer"
                                        >
                                            {isAdding ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Plus className="h-3.5 w-3.5" />
                                            )}
                                            {currentSettings.ctaButtonText}
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-4 rounded-xl border bg-muted/20 text-center text-xs text-muted-foreground">
                            Browse our complete peptide catalog to claim your free reconstitution solution.
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
