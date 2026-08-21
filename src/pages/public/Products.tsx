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
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryParam || null);
    const [sortBy, setSortBy] = useState<string>("featured");
    const { addToCart } = useCart();

    useEffect(() => {
        setSelectedCategory(categoryParam || null);
    }, [categoryParam]);

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
    console.log("VIP Status from useQuery:", userVipStatus, "isVip:", isVip);

    const { data: productsWithVariants, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["public-product-variants", isVip],
        staleTime: 0,
        queryFn: async () => {
            console.log("Products: Fetching product variants...");
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
                .order('position', { ascending: true })
                .order('position', { foreignTable: 'product_variants', ascending: true });

            if (!isVip) {
                query = query.or("is_private.eq.false,is_private.is.null")
                             .or('is_private.eq.false,is_private.is.null', { foreignTable: 'product_categories' });
            }

            const { data, error } = await query;
            console.log("Fetched raw products:", data);

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

    const filteredProducts = productsWithVariants?.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
        const targetCategory = selectedCategory?.toLowerCase();
        const productCategory = product.category?.toLowerCase() || "";
        const productName = product.name?.toLowerCase() || "";

        let matchesCategory = true;
        if (targetCategory) {
            if (targetCategory === "peptides" || targetCategory.includes("peptide")) {
                matchesCategory = productCategory.includes("peptide") || productName.includes("peptide");
            } else if (
                targetCategory === "water" ||
                targetCategory.includes("water") ||
                targetCategory.includes("bac") ||
                targetCategory.includes("reconstitution")
            ) {
                matchesCategory =
                    productCategory.includes("water") ||
                    productCategory.includes("reconstitution") ||
                    productCategory.includes("solution") ||
                    productName.includes("water") ||
                    productName.includes("bacteriostatic") ||
                    productName.includes("reconstitution");
            } else {
                matchesCategory =
                    productCategory === targetCategory ||
                    productCategory.includes(targetCategory) ||
                    targetCategory.includes(productCategory);
            }
        }
        return matchesSearch && matchesCategory;
    });

    console.log("Products Page Debug:", {
        selectedCategory,
        allFetched: productsWithVariants?.length,
        filtered: filteredProducts?.length,
        firstProductCategory: productsWithVariants?.[0]?.category
    });

    // Get the lowest price variant for display
    const getLowestPrice = (variants: ProductVariant[]) => {
        return Math.min(...variants.map(v => v.price));
    };

    // Fetch categories for sidebar
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
                                <SelectItem value="featured">Featured</SelectItem>
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

            {/* Mobile & Desktop Horizontal Category Pills Bar */}
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
                         (catLower.includes("water") || catLower.includes("reconstitution")));

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

            {/* Product Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {isError ? (
                        <div className="col-span-full text-center py-12 bg-red-50 rounded-lg border border-red-100">
                            <p className="text-red-500 mb-4 font-medium">Failed to load products. Please try again.</p>
                            <Button onClick={() => refetch()} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50">Retry</Button>
                        </div>
                    ) : isLoading ? (
                        <div className="col-span-full text-center py-20 flex flex-col items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                            <p className="text-muted-foreground">Loading products...</p>
                        </div>
                    ) : filteredProducts?.length === 0 ? (
                        <div className="col-span-full text-center py-20 bg-muted/20 rounded-lg border border-dashed">
                            <p className="text-muted-foreground font-medium">No products found matching your criteria.</p>
                            <Button variant="link" onClick={() => { setSearchQuery(""); setSelectedCategory(null); }} className="mt-2 text-primary">Clear all filters</Button>
                        </div>
                    ) : (
                        (() => {
                            const sorted = [...(filteredProducts || [])].sort((a, b) => {
                                switch (sortBy) {
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
                                        // Prioritize private/VIP products, then sort by position
                                        if (a.is_private !== b.is_private) {
                                            return a.is_private ? -1 : 1;
                                        }
                                        return (a.position || 0) - (b.position || 0);
                                }
                            });

                            return sorted.map((product) => (
                                <div
                                    key={product.id}
                                    className="group relative bg-card rounded-xl border overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col h-full"
                                    onClick={() => navigate(`/products/${product.slug || product.id}`)}
                                >
                                    <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden relative">
                                        {(() => {
                                             const displayImage = product.image_url ||
                                                 (product.images && product.images.length > 0 ? product.images[0] : null) ||
                                                 product.variants?.find((v: any) => (v.images && v.images.length > 0) || v.image_url)?.images?.[0] ||
                                                 product.variants?.find((v: any) => v.image_url)?.image_url;
                                            const packSize = product.default_pack_size || 
                                                           (product.variants.length > 0 && product.variants.every(v => v.pack_size === product.variants[0].pack_size) 
                                                            ? product.variants[0].pack_size 
                                                            : null);

                                            return (
                                                <>
                                                    {displayImage ? (
                                                        <img src={displayImage} alt={product.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                                    ) : (
                                                        <div className="text-muted-foreground opacity-50 font-medium">No image</div>
                                                    )}
                                                    
                                                    {packSize && packSize > 1 && (
                                                        <div className="absolute top-3 right-3 z-10">
                                                            <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold border-none shadow-lg py-1 px-3 rounded-full">
                                                                Pack {packSize}
                                                            </Badge>
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
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
                                        <p className="text-xs text-muted-foreground mb-4">
                                            <span className="font-bold text-slate-600">{product.sales_count}+</span> bought in past month
                                        </p>
                                        {product.description && (
                                            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                                {product.description}
                                            </p>
                                        )}
                                        {product.variants && product.variants.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-4">
                                                {product.variants.map((v) => {
                                                    const rawName = v.vial_type?.name || v.sku || "";
                                                    const cleanName = rawName.replace(/\s+(Tall|Short)\s+Vial/gi, "").replace(/\s+Vial/gi, "").trim();
                                                    return (
                                                        <Badge key={v.id} variant="secondary" className="text-[10px] px-2 py-0.5 font-semibold bg-muted/80 text-foreground">
                                                            {cleanName}
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
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                                                <Search className="h-5 w-5" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ));
                        })()
                    )}
                </div>
        </div>
    );
};

export default Products;
