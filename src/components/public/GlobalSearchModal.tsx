import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, X, ArrowRight, Package, Tag, Loader2, Sparkles, CornerDownLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface GlobalSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
    const [query, setQuery] = useState("");
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus input when modal opens
    useEffect(() => {
        if (isOpen) {
            setQuery("");
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        }
    }, [isOpen]);

    // Handle ESC key & Ctrl+K / Cmd+K
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    // Fetch published products for live client-side searching
    const { data: products = [], isLoading } = useQuery({
        queryKey: ["global-search-products-modal"],
        staleTime: 60000,
        enabled: isOpen,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("products")
                .select(`
                    id, slug, name, description, image_url, images, is_private,
                    product_categories(name),
                    variants:product_variants(id, price, image_url, images, vial_type:vial_types(name))
                `)
                .eq("is_published", true)
                .order("position", { ascending: true });

            if (error) throw error;
            return data || [];
        }
    });

    if (!isOpen) return null;

    // Filter products matching search query
    const trimmedQuery = query.trim().toLowerCase();
    const filteredProducts = trimmedQuery
        ? products.filter(p => {
            const name = p.name?.toLowerCase() || "";
            const desc = p.description?.toLowerCase() || "";
            const cat = (p.product_categories as any)?.name?.toLowerCase() || "";
            return name.includes(trimmedQuery) || desc.includes(trimmedQuery) || cat.includes(trimmedQuery);
        })
        : [];

    const handleSelectProduct = (product: any) => {
        onClose();
        const targetCategory = (product.product_categories as any)?.name;
        const navUrl = `/products/${product.slug || product.id}${targetCategory ? `?fromCategory=${encodeURIComponent(targetCategory)}` : ''}`;
        navigate(navUrl);
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!trimmedQuery) return;
        onClose();
        navigate(`/products?search=${encodeURIComponent(trimmedQuery)}`);
    };

    const handleCategoryClick = (categoryName: string) => {
        onClose();
        navigate(`/products?category=${encodeURIComponent(categoryName)}`);
    };

    const popularCategories = ["Peptides", "BAC Water", "Reconstitution", "Bulk Orders", "Lab Reports"];

    return createPortal(
        <div 
            className="fixed inset-0 z-[9999] flex items-start justify-center pt-12 sm:pt-20 px-4 bg-black/75 backdrop-blur-md transition-all duration-300 animate-in fade-in-0"
            onClick={onClose}
        >
            <div 
                className="w-full max-w-2xl bg-card border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Input Bar */}
                <form onSubmit={handleSearchSubmit} className="relative border-b flex items-center px-4 py-3 bg-muted/30">
                    <Search className="h-5 w-5 text-muted-foreground mr-3 shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search products, peptides, BAC water, lab reports..."
                        className="w-full bg-transparent text-base sm:text-lg font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => setQuery("")}
                            className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted mr-2 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-2 py-1 text-xs font-semibold bg-muted hover:bg-muted/80 text-muted-foreground rounded-md transition-colors border"
                    >
                        ESC
                    </button>
                </form>

                {/* Results / Suggestions Container */}
                <div className="overflow-y-auto p-4 space-y-4 flex-1 scrollbar-thin">
                    {/* Empty search state: show popular category shortcuts */}
                    {!trimmedQuery && (
                        <div className="space-y-4 py-2">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                <Sparkles className="h-3.5 w-3.5 text-primary" />
                                <span>Popular Categories & Quick Links</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {popularCategories.map((cat) => (
                                    <button
                                        key={cat}
                                        onClick={() => handleCategoryClick(cat)}
                                        className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-muted/60 hover:bg-primary hover:text-primary-foreground transition-all duration-200 flex items-center gap-1.5 border hover:border-primary shadow-sm"
                                    >
                                        <Tag className="h-3.5 w-3.5" />
                                        <span>{cat}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Loading State */}
                    {trimmedQuery && isLoading && (
                        <div className="py-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            <span className="text-sm font-medium">Searching catalog...</span>
                        </div>
                    )}

                    {/* Results List */}
                    {trimmedQuery && !isLoading && (
                        <div>
                            {filteredProducts.length > 0 ? (
                                <div className="space-y-2">
                                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex justify-between items-center px-1">
                                        <span>Products Found ({filteredProducts.length})</span>
                                        <span className="text-[10px] font-normal lowercase text-muted-foreground">Press Enter to view all</span>
                                    </div>

                                    {filteredProducts.map((product: any) => {
                                        const categoryName = (product.product_categories as any)?.name;
                                        const displayImage = product.image_url ||
                                            (product.images && product.images.length > 0 ? product.images[0] : null) ||
                                            product.variants?.find((v: any) => (v.images && v.images.length > 0) || v.image_url)?.images?.[0] ||
                                            product.variants?.find((v: any) => v.image_url)?.image_url;

                                        // Calculate lowest price
                                        const prices = product.variants?.map((v: any) => v.price).filter((p: number) => p > 0) || [];
                                        const lowestPrice = prices.length > 0 ? Math.min(...prices) : 0;

                                        return (
                                            <div
                                                key={product.id}
                                                onClick={() => handleSelectProduct(product)}
                                                className="group p-3 rounded-xl border border-transparent hover:border-primary/30 bg-card hover:bg-primary/5 transition-all duration-200 cursor-pointer flex items-center gap-4"
                                            >
                                                {/* Image */}
                                                <div className="h-14 w-14 rounded-lg bg-muted border overflow-hidden shrink-0 flex items-center justify-center">
                                                    {displayImage ? (
                                                        <img src={displayImage} alt={product.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                                    ) : (
                                                        <Package className="h-6 w-6 text-muted-foreground opacity-40" />
                                                    )}
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                        <h4 className="font-semibold text-sm sm:text-base text-foreground truncate group-hover:text-primary transition-colors">
                                                            {product.name}
                                                        </h4>
                                                        {categoryName && (
                                                            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full shrink-0 bg-primary/10 text-primary border border-primary/20">
                                                                {categoryName}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {product.description && (
                                                        <p className="text-xs text-muted-foreground truncate max-w-md">
                                                            {product.description}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Price & Action */}
                                                <div className="flex items-center gap-3 shrink-0">
                                                    {lowestPrice > 0 && (
                                                        <div className="text-right">
                                                            {product.variants && product.variants.length > 1 && (
                                                                <span className="text-[10px] text-muted-foreground block font-medium">Starting at</span>
                                                            )}
                                                            <span className="text-base font-bold text-foreground">
                                                                ${lowestPrice.toFixed(2)}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className="h-8 w-8 rounded-full bg-muted group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200 flex items-center justify-center text-muted-foreground">
                                                        <ArrowRight className="h-4 w-4" />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="py-12 text-center text-muted-foreground space-y-3">
                                    <Package className="h-10 w-10 mx-auto opacity-30" />
                                    <p className="font-semibold text-foreground">No products found for "{trimmedQuery}"</p>
                                    <p className="text-xs">Try searching for "Peptides", "BAC Water", or check your spelling.</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleSearchSubmit({ preventDefault: () => {} } as any)}
                                        className="mt-2 text-xs"
                                    >
                                        View all catalog products
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer hints */}
                <div className="border-t bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground flex justify-between items-center">
                    <span className="flex items-center gap-1">
                        <CornerDownLeft className="h-3 w-3" /> Select item to view product details
                    </span>
                    <span>Press <kbd className="px-1 py-0.5 bg-background border rounded text-[10px] font-mono">ESC</kbd> to close</span>
                </div>
            </div>
        </div>,
        document.body
    );
}
