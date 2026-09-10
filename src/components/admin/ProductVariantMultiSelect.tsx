import React, { useState, useMemo } from "react";
import { Search, Check, ChevronDown, ChevronRight, X, Layers, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface ProductVariantItem {
    id: string;
    sku: string | null;
    price: number;
    pack_size: number;
    vial_type?: {
        name: string;
        capacity_ml: number;
    } | null;
}

export interface ProductWithVariants {
    id: string;
    name: string;
    slug?: string;
    category?: string;
    product_variants?: ProductVariantItem[];
}

interface ProductVariantMultiSelectProps {
    products: ProductWithVariants[];
    selectedProductIds: string[];
    selectedVariantIds: string[];
    onChange: (productIds: string[], variantIds: string[]) => void;
}

export const ProductVariantMultiSelect: React.FC<ProductVariantMultiSelectProps> = ({
    products,
    selectedProductIds,
    selectedVariantIds,
    onChange,
}) => {
    const [search, setSearch] = useState("");
    const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set());

    // Filter products and their variants based on search
    const filteredProducts = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return products;

        return products.filter((p) => {
            const matchesProduct = p.name.toLowerCase().includes(q) || (p.slug && p.slug.toLowerCase().includes(q));
            const matchesVariant = p.product_variants?.some((v) => {
                const skuMatch = v.sku?.toLowerCase().includes(q);
                const vialMatch = v.vial_type?.name?.toLowerCase().includes(q);
                const capMatch = v.vial_type?.capacity_ml?.toString().includes(q);
                return skuMatch || vialMatch || capMatch;
            });
            return matchesProduct || matchesVariant;
        });
    }, [products, search]);

    // Automatically expand products matching search
    React.useEffect(() => {
        if (search.trim()) {
            setExpandedProductIds(new Set(filteredProducts.map((p) => p.id)));
        }
    }, [search, filteredProducts]);

    const toggleProductExpand = (productId: string) => {
        setExpandedProductIds((prev) => {
            const next = new Set(prev);
            if (next.has(productId)) next.delete(productId);
            else next.add(productId);
            return next;
        });
    };

    // Toggle specific variant
    const toggleVariant = (productId: string, variantId: string) => {
        let nextVariants = [...selectedVariantIds];
        let nextProducts = [...selectedProductIds];

        if (nextVariants.includes(variantId)) {
            nextVariants = nextVariants.filter((id) => id !== variantId);
            // Check if any other variant of this product is still selected
            const prod = products.find((p) => p.id === productId);
            const otherSelected = prod?.product_variants?.some(
                (v) => v.id !== variantId && nextVariants.includes(v.id)
            );
            if (!otherSelected) {
                nextProducts = nextProducts.filter((id) => id !== productId);
            }
        } else {
            nextVariants.push(variantId);
            if (!nextProducts.includes(productId)) {
                nextProducts.push(productId);
            }
        }

        onChange(nextProducts, nextVariants);
    };

    // Toggle entire product (select/deselect all its variants, or the product itself if no variants)
    const toggleEntireProduct = (productId: string) => {
        const prod = products.find((p) => p.id === productId);
        if (!prod) return;

        const variantIds = prod.product_variants?.map((v) => v.id) || [];
        const isProductSelected = selectedProductIds.includes(productId);

        let nextProducts = [...selectedProductIds];
        let nextVariants = [...selectedVariantIds];

        if (isProductSelected) {
            // Deselect product and all its variants
            nextProducts = nextProducts.filter((id) => id !== productId);
            nextVariants = nextVariants.filter((id) => !variantIds.includes(id));
        } else {
            // Select product and all its variants
            nextProducts.push(productId);
            variantIds.forEach((vId) => {
                if (!nextVariants.includes(vId)) nextVariants.push(vId);
            });
        }

        onChange(nextProducts, nextVariants);
    };

    const removeVariant = (variantId: string) => {
        const prod = products.find((p) => p.product_variants?.some((v) => v.id === variantId));
        if (prod) {
            toggleVariant(prod.id, variantId);
        } else {
            onChange(
                selectedProductIds,
                selectedVariantIds.filter((id) => id !== variantId)
            );
        }
    };

    const removeProduct = (productId: string) => {
        toggleEntireProduct(productId);
    };

    const clearAll = () => {
        onChange([], []);
    };

    // Fast mapping to build selected chips
    const selectedChips = useMemo(() => {
        const chips: Array<{ id: string; label: string; isVariant: boolean }> = [];

        products.forEach((p) => {
            const selectedVariantsInProd = p.product_variants?.filter((v) =>
                selectedVariantIds.includes(v.id)
            ) || [];

            if (selectedVariantsInProd.length > 0) {
                selectedVariantsInProd.forEach((v) => {
                    const variantName = v.vial_type?.name || (v.sku ? `SKU: ${v.sku}` : `Variant`);
                    chips.push({
                        id: v.id,
                        label: `${p.name} (${variantName})`,
                        isVariant: true,
                    });
                });
            } else if (selectedProductIds.includes(p.id)) {
                chips.push({
                    id: p.id,
                    label: p.name,
                    isVariant: false,
                });
            }
        });

        return chips;
    }, [products, selectedProductIds, selectedVariantIds]);

    return (
        <div className="space-y-2 border rounded-xl p-3 bg-card shadow-2xs">
            <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-emerald-600" />
                    Associated Products &amp; Specific Variants *
                </label>
                {selectedChips.length > 0 && (
                    <button
                        type="button"
                        onClick={clearAll}
                        className="text-[11px] text-muted-foreground hover:text-destructive transition-colors font-medium"
                    >
                        Clear Selection ({selectedChips.length})
                    </button>
                )}
            </div>

            {/* Selected Chips Bar */}
            {selectedChips.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 bg-muted/40 rounded-lg border max-h-24 overflow-y-auto">
                    {selectedChips.map((chip) => (
                        <Badge
                            key={chip.id}
                            variant="secondary"
                            className="text-[11px] py-0.5 px-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center gap-1 font-medium"
                        >
                            <span className="truncate max-w-[220px]">{chip.label}</span>
                            <button
                                type="button"
                                onClick={() => (chip.isVariant ? removeVariant(chip.id) : removeProduct(chip.id))}
                                className="hover:bg-emerald-200/50 dark:hover:bg-emerald-800/50 rounded-full p-0.5"
                                title="Remove"
                            >
                                <X className="h-2.5 w-2.5" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}

            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                    placeholder="Search by product name, variant (e.g. 20mg, 40mg), or SKU..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 text-xs bg-background pl-8"
                />
            </div>

            {/* Products & Variants Tree */}
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 divide-y divide-border/30">
                {filteredProducts.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">No matching products or variants found.</p>
                ) : (
                    filteredProducts.map((p) => {
                        const variants = p.product_variants || [];
                        const hasVariants = variants.length > 0;
                        const isExpanded = expandedProductIds.has(p.id);

                        const selectedCount = variants.filter((v) => selectedVariantIds.includes(v.id)).length;
                        const isAllSelected = hasVariants && selectedCount === variants.length;
                        const isSomeSelected = selectedCount > 0 && !isAllSelected;
                        const isProductAloneSelected = !hasVariants && selectedProductIds.includes(p.id);

                        return (
                            <div key={p.id} className="pt-1.5 first:pt-0">
                                {/* Product Header Row */}
                                <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 text-xs">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        {hasVariants ? (
                                            <button
                                                type="button"
                                                onClick={() => toggleProductExpand(p.id)}
                                                className="p-0.5 hover:bg-muted rounded text-muted-foreground"
                                                title={isExpanded ? "Collapse variants" : "Expand variants"}
                                            >
                                                {isExpanded ? (
                                                    <ChevronDown className="h-3.5 w-3.5" />
                                                ) : (
                                                    <ChevronRight className="h-3.5 w-3.5" />
                                                )}
                                            </button>
                                        ) : (
                                            <div className="w-4.5" />
                                        )}

                                        <label className="flex items-center gap-2 cursor-pointer select-none truncate flex-1">
                                            <input
                                                type="checkbox"
                                                checked={hasVariants ? isAllSelected : isProductAloneSelected}
                                                ref={(el) => {
                                                    if (el) el.indeterminate = isSomeSelected;
                                                }}
                                                onChange={() => toggleEntireProduct(p.id)}
                                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                                            />
                                            <span className="font-semibold text-foreground truncate">{p.name}</span>
                                        </label>
                                    </div>

                                    {/* Variant counter pill */}
                                    {hasVariants && (
                                        <Badge
                                            variant="outline"
                                            className={`text-[10px] py-0 px-1.5 font-medium cursor-pointer ${
                                                selectedCount > 0
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                                                    : "text-muted-foreground"
                                            }`}
                                            onClick={() => toggleProductExpand(p.id)}
                                        >
                                            {selectedCount > 0
                                                ? `${selectedCount}/${variants.length} selected`
                                                : `${variants.length} variants`}
                                        </Badge>
                                    )}
                                </div>

                                {/* Variants Sub-list (when expanded or search active) */}
                                {hasVariants && isExpanded && (
                                    <div className="pl-6 pr-1 py-1 space-y-1 bg-muted/20 rounded-lg my-1 border border-border/40">
                                        {variants.map((v) => {
                                            const isSelected = selectedVariantIds.includes(v.id);
                                            const variantName = v.vial_type?.name || (v.sku ? `SKU: ${v.sku}` : `Option`);
                                            const label = variantName.replace(/\s+(Tall|Short)\s+Vial/gi, "").replace(/\s+Vial/gi, "").trim();

                                            return (
                                                <label
                                                    key={v.id}
                                                    className={`flex items-center justify-between gap-2 px-2.5 py-1 rounded-md text-xs cursor-pointer select-none transition-colors ${
                                                        isSelected
                                                            ? "bg-emerald-100/70 dark:bg-emerald-950/60 font-semibold text-emerald-950 dark:text-emerald-200 border border-emerald-300/80 dark:border-emerald-800"
                                                            : "hover:bg-muted text-muted-foreground hover:text-foreground"
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleVariant(p.id, v.id)}
                                                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3 w-3"
                                                        />
                                                        <span className="font-bold text-foreground text-xs">{label}</span>
                                                        {v.sku && (
                                                            <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1 rounded">
                                                                {v.sku}
                                                            </span>
                                                        )}
                                                        {v.pack_size > 1 && (
                                                            <span className="text-[10px] text-muted-foreground">
                                                                (Pack of {v.pack_size})
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <span className="text-[11px] font-mono text-muted-foreground">
                                                            ${Number(v.price).toFixed(2)}
                                                        </span>
                                                        {isSelected && <Check className="h-3 w-3 text-emerald-600 shrink-0" />}
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default ProductVariantMultiSelect;
