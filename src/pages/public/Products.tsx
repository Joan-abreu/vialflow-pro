import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useCart, ProductVariant } from "@/contexts/CartContext";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

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
}

const Products = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const { addToCart } = useCart();

    const { data: productsWithVariants, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["public-product-variants"],
        queryFn: async () => {
            console.log("Products: Fetching product variants...");
            // Fetch all published variants with their product and vial type info
            const { data, error } = await supabase
                .from("products")
                .select(`
                    *,
                    product_categories(name),
                    variants:product_variants(
                        *,
                        vial_type:vial_types(name, capacity_ml, color, shape)
                    )
                `)
                .eq("is_published", true)
                .order('position', { ascending: true })
                .order('position', { foreignTable: 'product_variants', ascending: true });

            if (error) {
                console.error("Error fetching products:", error);
                throw error;
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
                variants: product.variants.map((v: any) => ({
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
                    },
                    vial_type: {
                        name: v.vial_type.name,
                        capacity_ml: v.vial_type.capacity_ml,
                        color: v.vial_type.color,
                        shape: v.vial_type.shape,
                    },
                })).sort((a: any, b: any) => a.position - b.position)
            })).filter(product =>
                !product.name.toLowerCase().includes('peptide') &&
                !(product.category?.toLowerCase().includes('peptide'))
            );
        },
    });

    const filteredProducts = productsWithVariants?.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory ? product.category === selectedCategory : true;
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
        queryKey: ["product-categories"],
        queryFn: async () => {
            const { data } = await supabase
                .from("product_categories" as any)
                .select("name")
                .eq("active", true)
                .order("name");
            return (data || [])
                .map((c: any) => c.name)
                .filter((name: string) => !name.toLowerCase().includes('peptide'));
        }
    });

    return (
        <div className="container py-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Our Products</h1>
                    <p className="text-muted-foreground">Browse our complete catalog of research materials.</p>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search products..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8">
                {/* Sidebar Filters */}
                <div className="hidden md:block space-y-6">
                    <div>
                        <h3 className="font-semibold mb-4">Categories</h3>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    id="cat-all"
                                    name="category"
                                    className="rounded border-gray-300"
                                    checked={selectedCategory === null}
                                    onChange={() => setSelectedCategory(null)}
                                />
                                <label htmlFor="cat-all" className="text-sm cursor-pointer">All Products</label>
                            </div>
                            {categories?.map((category: string) => (
                                <div key={category} className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        id={`cat-${category}`}
                                        name="category"
                                        className="rounded border-gray-300"
                                        checked={selectedCategory === category}
                                        onChange={() => setSelectedCategory(category)}
                                    />
                                    <label htmlFor={`cat-${category}`} className="text-sm cursor-pointer">{category}</label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Product Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {isError ? (
                        <div className="col-span-full text-center py-12">
                            <p className="text-red-500 mb-4">Failed to load products. Please try again.</p>
                            <Button onClick={() => refetch()} variant="outline">Retry</Button>
                        </div>
                    ) : isLoading ? (
                        <div className="col-span-full text-center py-12">Loading products...</div>
                    ) : filteredProducts?.length === 0 ? (
                        <div className="col-span-full text-center py-12">No products found.</div>
                    ) : (
                        filteredProducts?.map((product) => (
                            <div
                                key={product.id}
                                className="group relative bg-card rounded-xl border overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                                onClick={() => navigate(`/products/${product.slug || product.id}`)}
                            >
                                <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden relative">
                                    {(() => {
                                        // Use product image or fallback to first variant with image
                                        const displayImage = product.image_url || product.variants.find(v => v.image_url)?.image_url;
                                        
                                        // Detect pack size: check product level or if all variants share the same pack size
                                        const packSize = product.default_pack_size || 
                                                       (product.variants.length > 0 && product.variants.every(v => v.pack_size === product.variants[0].pack_size) 
                                                        ? product.variants[0].pack_size 
                                                        : null);

                                        return (
                                            <>
                                                {displayImage ? (
                                                    <img src={displayImage} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                                ) : (
                                                    <div className="text-muted-foreground">No image</div>
                                                )}
                                                
                                                {packSize && packSize > 1 && (
                                                    <div className="absolute top-2 right-2">
                                                        <Badge className="bg-[#f59e0b] hover:bg-[#d97706] text-white font-bold border-none shadow-md py-1 px-2">
                                                            Pack {packSize}
                                                        </Badge>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                                <div className="p-4">
                                    <h3 className={`font-semibold mb-1 transition-all duration-300 ${
                                        product.name.length > 70 
                                            ? 'text-sm' 
                                            : product.name.length > 40 
                                                ? 'text-base' 
                                                : 'text-lg'
                                    }`}>
                                        {product.name}
                                    </h3>
                                    {product.description && (
                                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                            {product.description}
                                        </p>
                                    )}
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <p className="text-2xl font-bold text-primary">
                                                ${getLowestPrice(product.variants).toFixed(2)}
                                                {product.variants.length > 1 && <span className="text-sm text-muted-foreground">+</span>}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {product.variants.length} size{product.variants.length > 1 ? 's' : ''} available
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default Products;
