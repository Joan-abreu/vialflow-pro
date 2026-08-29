import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useCart, ProductVariant } from "@/contexts/CartContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { getBaseSalesCount } from "@/utils/salesCount";
import SEO from "@/components/SEO";
import { getSEOConfig } from "@/config/seoConfig";
import { useEffect } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown } from "lucide-react";

// Group variants by product
interface ProductWithVariants {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    image_url: string | null;
    category: string | null;
    sale_type: string;
    default_pack_size: number | null;
    variants: ProductVariant[];
    sales_count?: number;
    is_private?: boolean;
    position?: number;
}

const Products = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const categoryParam = searchParams.get("category");
    const searchUrlParam = searchParams.get("search");
    const [searchQuery, setSearchQuery] = useState(searchUrlParam || "");
    const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryParam || null);
    const [sortBy, setSortBy] = useState<string>("featured");
    const { addToCart } = useCart();

    useEffect(() => {
        setSelectedCategory(categoryParam || null);
        if (searchUrlParam !== null) {
            setSearchQuery(searchUrlParam);
        }
    }, [categoryParam, searchUrlParam]);

    const { data: userVipStatus } = useQuery({
        queryKey: ["user-vip-status"],
        queryFn: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) return false;
            
            const { data } = await supabase
                .from("profiles")
                .select("can_view_private_products")
                .eq("user_id", session.user.id)
                .single();
                
            return data?.can_view_private_products || false;
        },
        staleTime: 0
    });

    const isVip = Boolean(userVipStatus);

    const { data: productsWithVariants, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["public-product-variants", isVip],
        staleTime: 0,
        queryFn: async () => {
            // Fetch all published variants with their product and vial type info
            let query = supabase
                .from("products")
                .select(`
                    *,
                    product_categories(name, is_private),
                    variants:product_variants(
                        *,
                        vial_type:vial_types(name, capacity_ml, color, shape)
                    )
                `)
                .eq("is_published", true)
                .or("is_archived.eq.false,is_archived.is.null")
                .order('position', { ascending: true })
                .order('position', { foreignTable: 'product_variants', ascending: true });

            if (!isVip) {
                query = query.or("is_private.eq.false,is_private.is.null")
                             .or('is_private.eq.false,is_private.is.null', { foreignTable: 'product_categories' });
            }

            const { data, error } = await query;

            if (error) {
                console.error("Error fetching products:", error);
                throw error;
            }

            // Fetch order items to calculate actual sales real-time
            const { data: orderItems } = await supabase.from('order_items').select('product_id, quantity');
            const salesMap: Record<string, number> = {};
            if (orderItems) {
                orderItems.forEach(item => {
                    const pid = item.product_id;
                    if (pid) {
                        salesMap[pid] = (salesMap[pid] || 0) + (item.quantity || 1);
                    }
                });
            }

            // Map products to the expected format
            return (data as any[]).map(product => ({
                id: product.id,
                slug: product.slug,
                name: product.name,
                description: product.description,
                image_url: product.image_url,
                category: product.product_categories?.name || null,
                sale_type: product.sale_type || 'individual',
                default_pack_size: product.default_pack_size,
                is_private: product.is_private,
                position: product.position || 0,
                sales_count: (salesMap[product.id] || 0) + getBaseSalesCount(product.id, product.is_private, product.name, product.product_categories?.name),
                variants: (product.variants || []).map((v: any) => ({
                    id: v.id,
                    product_id: v.product_id,
                    vial_type_id: v.vial_type_id,
                    sku: v.sku,
                    price: v.price,
                    stock_quantity: v.stock_quantity,
                    max_online_quantity: v.max_online_quantity,
                    weight: v.weight,
                    pack_size: v.pack_size || 1,
                    image_url: v.image_url,
                    position: v.position || 0,
                    product: {
                        name: product.name,
                        image_url: product.image_url,
                        description: product.description,
                        category: product.product_categories?.name || null,
                        is_private: product.is_private,
                    },
                    vial_type: {
                        name: v.vial_type?.name || 'Standard',
                        capacity_ml: v.vial_type?.capacity_ml || 10,
                        color: v.vial_type?.color || 'Clear',
                        shape: v.vial_type?.shape || 'Round',
                    },
                })).sort((a: any, b: any) => {
                    const posA = a.position ?? 0;
                    const posB = b.position ?? 0;
                    if (posA !== posB) return posA - posB;

                    const capA = a.vial_type?.capacity_ml ?? 0;
                    const capB = b.vial_type?.capacity_ml ?? 0;
                    if (capA !== capB && capA > 0 && capB > 0) return capA - capB;

                    const getNum = (item: any) => {
                        const str = `${item.vial_type?.name || ''} ${item.sku || ''}`;
                        const m = str.match(/(\d+(?:\.\d+)?)\s*(?:mg|ml|g|mcg|pack|pk|units?)/i) || str.match(/\b(\d+(?:\.\d+)?)\b/);
                        return m ? parseFloat(m[1]) : 0;
                    };
                    const numA = getNum(a);
                    const numB = getNum(b);
                    if (numA !== numB && numA > 0 && numB > 0) return numA - numB;

                    if ((a.pack_size || 1) !== (b.pack_size || 1)) return (a.pack_size || 1) - (b.pack_size || 1);

                    return (a.price || 0) - (b.price || 0);
                })
            }));
        },
    });

    const normalizeCategory = (product: ProductWithVariants): {
        key: string;
        name: string;
        icon: string;
        description: string;
        priority: number;
    } => {
        const rawCat = (product.category || "").toLowerCase();
        const name = (product.name || "").toLowerCase();
        const firstSku = (product.variants?.[0]?.sku || "").toUpperCase();

        const isBulk = 
            product.sale_type === 'bulk' ||
            rawCat.includes("bulk") ||
            name.includes("bulk") ||
            (product.variants && product.variants.some((v: any) => v.bulk_only || v.bulk_price || v.sale_type === 'bulk'));

        const isPeptide = 
            rawCat.includes("peptide") ||
            name.includes("peptide") ||
            name.includes("glp") ||
            name.includes("mots") ||
            name.includes("nad") ||
            name.includes("tesamorelin") ||
            name.includes("tirzepatide") ||
            name.includes("retatrutide") ||
            name.includes("semaglutide") ||
            /^(RT|MOTS|NAD|TR|GLP|PEP)/.test(firstSku);

        const isWater = 
            rawCat.includes("water") ||
            rawCat.includes("reconstitution") ||
            rawCat.includes("solution") ||
            name.includes("water") ||
            name.includes("bacteriostatic") ||
            name.includes("reconstitution") ||
            name.includes("bac ");

        // If product category explicitly mentions bulk or the product is bulk-only
        if (rawCat.includes("bulk") || product.sale_type === 'bulk' || (product.variants && product.variants.length > 0 && product.variants.every(v => v.bulk_only))) {
            return {
                key: "bulk",
                name: product.category || "Bulk & Wholesale Orders",
                icon: "📦",
                description: "High-volume packaging and bulk manufacturing supplies.",
                priority: 3
            };
        }

        if (isPeptide) {
            return {
                key: "peptides",
                name: "Research Peptides",
                icon: "🧪",
                description: "High-purity lyophilized peptides for laboratory & analytical research.",
                priority: 1
            };
        }

        if (isWater) {
            return {
                key: "water",
                name: "Reconstitution Solutions & BAC Water",
                icon: "💧",
                description: "3rd party lab-tested bacteriostatic water & sterile reconstitution solutions.",
                priority: 2
            };
        }

        if (isBulk) {
            return {
                key: "bulk",
                name: product.category || "Bulk & Wholesale Orders",
                icon: "📦",
                description: "High-volume packaging and bulk manufacturing supplies.",
                priority: 3
            };
        }

        return {
            key: rawCat || "other",
            name: product.category || "Laboratory Supplies",
            icon: "🔬",
            description: "Specialized research and laboratory accessories.",
            priority: 4
        };
    };

    const filteredProducts = productsWithVariants?.filter(product => {
        const q = searchQuery.trim().toLowerCase();
        let matchesSearch = true;
        if (q) {
            const inName = product.name?.toLowerCase().includes(q);
            const inDesc = product.description?.toLowerCase().includes(q);
            const inCat = product.category?.toLowerCase().includes(q);
            const inVariants = product.variants?.some((v: any) => 
                v.sku?.toLowerCase().includes(q) || 
                v.vial_type?.name?.toLowerCase().includes(q)
            );
            matchesSearch = Boolean(inName || inDesc || inCat || inVariants);
        }

        if (!selectedCategory) return matchesSearch;

        const targetCategory = selectedCategory.toLowerCase();
        const productCategory = (product.category || "").toLowerCase();
        const productName = (product.name || "").toLowerCase();
        const catInfo = normalizeCategory(product);

        let matchesCat = false;

        if (targetCategory === "all" || !targetCategory) {
            matchesCat = true;
        } else if (targetCategory === "peptides" || targetCategory.includes("peptide")) {
            matchesCat = catInfo.key === "peptides" || productCategory.includes("peptide") || productName.includes("peptide");
        } else if (
            targetCategory === "water" ||
            targetCategory.includes("water") ||
            targetCategory.includes("bac") ||
            targetCategory.includes("reconstitution")
        ) {
            matchesCat = 
                catInfo.key === "water" ||
                productCategory.includes("water") ||
                productCategory.includes("reconstitution") ||
                productCategory.includes("solution") ||
                productName.includes("water") ||
                productName.includes("bacteriostatic") ||
                productName.includes("reconstitution");
        } else if (targetCategory === "bulk" || targetCategory.includes("bulk")) {
            matchesCat = 
                catInfo.key === "bulk" ||
                productCategory.includes("bulk") ||
                productName.includes("bulk") ||
                product.sale_type === 'bulk' ||
                (product.variants && product.variants.some((v: any) => v.bulk_only || v.bulk_price || v.sale_type === 'bulk'));
        } else {
            matchesCat = 
                productCategory === targetCategory ||
                productCategory.includes(targetCategory) ||
                targetCategory.includes(productCategory) ||
                catInfo.key === targetCategory ||
                catInfo.name.toLowerCase() === targetCategory;
        }

        return matchesSearch && matchesCat;
    });

    // Get lowest price variant for display
    const getLowestPrice = (variants: ProductVariant[]) => {
        if (!variants || variants.length === 0) return 0;
        return Math.min(...variants.map(v => v.price));
    };

    // Sort helper
    const sortProducts = (items: ProductWithVariants[], sortType: string) => {
        return [...items].sort((a, b) => {
            switch (sortType) {
                case "price-low":
                    return getLowestPrice(a.variants) - getLowestPrice(b.variants);
                case "price-high":
                    return getLowestPrice(b.variants) - getLowestPrice(a.variants);
                case "sales":
                    return (b.sales_count || 0) - (a.sales_count || 0);
                case "name-az":
                    return a.name.localeCompare(b.name);
                case "name-za":
                    return b.name.localeCompare(a.name);
                case "featured":
                default:
                    if (a.is_private !== b.is_private) {
                        return a.is_private ? -1 : 1;
                    }
                    const posA = a.position ?? 0;
                    const posB = b.position ?? 0;
                    if (posA !== posB) return posA - posB;
                    return a.name.localeCompare(b.name);
            }
        });
    };

    // Group products by normalized category for the default overview
    const groupedCategories = useEffect ? (() => {
        if (!filteredProducts || filteredProducts.length === 0) return [];
        
        const groupsMap = new Map<string, {
            key: string;
            name: string;
            icon: string;
            description: string;
            priority: number;
            products: ProductWithVariants[];
        }>();

        filteredProducts.forEach(product => {
            const catInfo = normalizeCategory(product);
            if (!groupsMap.has(catInfo.key)) {
                groupsMap.set(catInfo.key, {
                    ...catInfo,
                    products: []
                });
            }
            groupsMap.get(catInfo.key)!.products.push(product);
        });

        const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => a.priority - b.priority);
        sortedGroups.forEach(g => {
            g.products = sortProducts(g.products, sortBy);
        });

        return sortedGroups;
    })() : [];

    // Fetch categories for sidebar/pills
    const { data: categories } = useQuery({
        queryKey: ["product-categories", isVip],
        staleTime: 0,
        queryFn: async () => {
            let catQuery = supabase
                .from("product_categories" as any)
                .select("name, is_private, position")
                .eq("active", true)
                .order("position", { ascending: true })
                .order("name");
                
            if (!isVip) {
                catQuery = catQuery.or("is_private.eq.false,is_private.is.null");
            }
                
            const { data } = await catQuery;
            return (data || []).map((c: any) => c.name);
        }
    });

    const seo = getSEOConfig("products-catalog");

    const renderProductCard = (product: ProductWithVariants) => {
        const catInfo = normalizeCategory(product);
        const isPeptide = catInfo.key === "peptides";

        const displayImage = product.image_url ||
            (product.images && product.images.length > 0 ? product.images[0] : null) ||
            product.variants?.find((v: any) => (v.images && v.images.length > 0) || v.image_url)?.images?.[0] ||
            product.variants?.find((v: any) => v.image_url)?.image_url;

        const packSize = product.default_pack_size || 
            (product.variants.length > 0 && product.variants.every(v => v.pack_size === product.variants[0].pack_size) 
                ? product.variants[0].pack_size 
                : null);

        return (
            <div
                key={product.id}
                className="group relative bg-card rounded-xl border overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col h-full hover:border-primary/40"
                onClick={() => navigate(
                    `/products/${product.slug || product.id}${selectedCategory ? `?fromCategory=${encodeURIComponent(selectedCategory)}` : ''}`,
                    { state: { fromCategory: selectedCategory } }
                )}
            >
                <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden relative">
                    {displayImage ? (
                        <img src={displayImage} alt={product.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                        <div className="text-muted-foreground opacity-50 font-medium">No image</div>
                    )}
                    
                    {packSize && packSize > 1 && (
                        <div className="absolute top-3 right-3 z-10">
                            <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold border-none shadow-md py-1 px-2.5 rounded-full text-xs">
                                Pack {packSize}
                            </Badge>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-black/5 group-hover:bg-black/0 transition-colors duration-300" />
                </div>
                <div className="p-5 flex flex-col flex-1 pb-6">
                    <h3 className={`font-bold mb-1 transition-all duration-300 group-hover:text-primary ${
                        product.name.length > 70 
                            ? 'text-sm' 
                            : product.name.length > 40 
                                ? 'text-base' 
                                : 'text-lg'
                    }`}>
                        {product.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">
                        <span className="font-bold text-slate-700">{product.sales_count}+</span> bought in past month
                    </p>
                    {product.description && (
                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                            {product.description}
                        </p>
                    )}
                    {product.variants && product.variants.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-4">
                            {product.variants.map((v) => {
                                const vialName = v.vial_type?.name || "";
                                const capMl = v.vial_type?.capacity_ml;
                                let cleanBadge = "";
                                if (isPeptide) {
                                    cleanBadge = vialName || (capMl ? `${capMl}mg` : "");
                                } else {
                                    cleanBadge = vialName || (capMl ? `${capMl}ml` : "");
                                }
                                cleanBadge = cleanBadge.replace(/\s+(Tall|Short)\s+Vial/gi, "").replace(/\s+Vial/gi, "").trim();
                                if (!cleanBadge) cleanBadge = v.sku || "Variant";

                                return (
                                    <Badge key={v.id} variant="secondary" className="text-[10px] px-2 py-0.5 font-semibold bg-muted/80 text-foreground">
                                        {cleanBadge}
                                    </Badge>
                                );
                            })}
                        </div>
                    )}
                    <div className="mt-auto pt-4 border-t border-border/50 flex items-center justify-between">
                        <div className="flex flex-col">
                            {product.variants && product.variants.length > 1 && (
                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Starting at</span>
                            )}
                            <p className="text-2xl font-black text-foreground antialiased tracking-tight">
                                ${getLowestPrice(product.variants).toFixed(2)}
                            </p>
                        </div>
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                            <Search className="h-4 w-4" />
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const isGroupedView = selectedCategory === null && !searchQuery.trim() && sortBy === "featured";

    return (
        <div className="container py-12">
            <SEO title={seo.title} description={seo.description} />
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Our Products</h1>
                    <p className="text-muted-foreground">Browse our complete catalog of ultra-pure reconstitution solutions and research peptides.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search products..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <div className="w-full sm:w-52">
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="w-full bg-background border-border">
                                <div className="flex items-center gap-2">
                                    <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                                    <SelectValue placeholder="Sort by" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="featured">Featured / Category</SelectItem>
                                <SelectItem value="price-low">Price: Low to High</SelectItem>
                                <SelectItem value="price-high">Price: High to Low</SelectItem>
                                <SelectItem value="sales">Best Sellers</SelectItem>
                                <SelectItem value="name-az">Name: A-Z</SelectItem>
                                <SelectItem value="name-za">Name: Z-A</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Category Pills Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-8 scrollbar-none border-b border-border/40">
                <button
                    onClick={() => {
                        setSelectedCategory(null);
                        navigate("/products");
                    }}
                    className={`px-4 py-2 rounded-full text-xs md:text-sm font-semibold shrink-0 transition-all ${
                        selectedCategory === null
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                >
                    All Products
                </button>
                {categories?.map((category: string) => {
                    const catLower = category.toLowerCase();
                    const selLower = selectedCategory?.toLowerCase() || "";
                    const isCatActive = selectedCategory === category || 
                        (selLower === catLower) ||
                        (selLower.includes("peptide") && catLower.includes("peptide")) ||
                        ((selLower.includes("water") || selLower.includes("bac") || selLower.includes("reconstitution")) &&
                         (catLower.includes("water") || catLower.includes("reconstitution"))) ||
                        (selLower.includes("bulk") && catLower.includes("bulk"));

                    return (
                        <button
                            key={category}
                            onClick={() => {
                                setSelectedCategory(category);
                                navigate(`/products?category=${encodeURIComponent(category)}`);
                            }}
                            className={`px-4 py-2 rounded-full text-xs md:text-sm font-semibold shrink-0 transition-all flex items-center gap-1.5 ${
                                isCatActive
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                        >
                            <span>{category}</span>
                            {category.toLowerCase().includes("peptide") && (
                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                                    isCatActive ? "bg-amber-400 text-slate-900" : "bg-amber-500 text-white"
                                }`}>
                                    NEW
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Product Grid / Category Sections */}
            {isError ? (
                <div className="text-center py-12 bg-red-50 rounded-lg border border-red-100">
                    <p className="text-red-500 mb-4 font-medium">Failed to load products. Please try again.</p>
                    <Button onClick={() => refetch()} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50">Retry</Button>
                </div>
            ) : isLoading ? (
                <div className="text-center py-20 flex flex-col items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                    <p className="text-muted-foreground">Loading products...</p>
                </div>
            ) : filteredProducts?.length === 0 ? (
                <div className="text-center py-20 bg-muted/20 rounded-lg border border-dashed">
                    <p className="text-muted-foreground font-medium">No products found matching your criteria.</p>
                    <Button variant="link" onClick={() => { setSearchQuery(""); setSelectedCategory(null); }} className="mt-2 text-primary">Clear all filters</Button>
                </div>
            ) : isGroupedView ? (
                <div className="space-y-12">
                    {groupedCategories.map((group) => (
                        <div key={group.key} className="space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3.5">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl p-2 bg-primary/10 rounded-xl">{group.icon}</span>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-2xl font-bold tracking-tight text-foreground">{group.name}</h2>
                                            <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 bg-muted/60">
                                                {group.products.length} {group.products.length === 1 ? 'item' : 'items'}
                                            </Badge>
                                        </div>
                                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{group.description}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedCategory(group.name);
                                        navigate(`/products?category=${encodeURIComponent(group.name)}`);
                                    }}
                                    className="text-xs font-medium text-primary hover:underline self-start sm:self-center"
                                >
                                    View only {group.name} &rarr;
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                {group.products.map(renderProductCard)}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-6">
                    {selectedCategory && (
                        <div className="flex items-center justify-between pb-2 border-b">
                            <h2 className="text-xl font-bold text-foreground">
                                {selectedCategory} ({filteredProducts.length})
                            </h2>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setSelectedCategory(null);
                                    navigate("/products");
                                }}
                                className="text-xs text-muted-foreground hover:text-foreground"
                            >
                                Show All Categories
                            </Button>
                        </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {sortProducts(filteredProducts, sortBy).map(renderProductCard)}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Products;
