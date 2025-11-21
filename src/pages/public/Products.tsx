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
    name: string;
    description: string | null;
    image_url: string | null;
    category: string | null;
    variants: ProductVariant[];
}

const Products = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const { addToCart } = useCart();

    const { data: productsWithVariants, isLoading } = useQuery({
        queryKey: ["public-product-variants", selectedCategory],
        queryFn: async () => {
            // Fetch all published variants with their product and vial type info
            let query = supabase
                .from("product_variants")
                .select(`
                    *,
                    product:products!inner(id, name, description, image_url, category, is_published),
                    vial_type:vial_types!inner(name, size_ml)
                `)
                .eq("is_published", true)
                .eq("product.is_published", true);

            if (selectedCategory) {
                query = query.eq("product.category", selectedCategory);
            }

            const { data, error } = await (query as any);
            if (error) throw error;

            // Group variants by product
            const grouped: Record<string, ProductWithVariants> = {};

            (data as any[])?.forEach((variant: any) => {
                const productId = variant.product.id;

                if (!grouped[productId]) {
                    grouped[productId] = {
                        id: productId,
                        name: variant.product.name,
                        description: variant.product.description,
                        image_url: variant.product.image_url,
                        category: variant.product.category,
                        variants: [],
                    };
                }

                grouped[productId].variants.push({
                    id: variant.id,
                    product_id: variant.product_id,
                    vial_type_id: variant.vial_type_id,
                    sku: variant.sku,
                    price: variant.price,
                    stock_quantity: variant.stock_quantity,
                    product: {
                        name: variant.product.name,
                        image_url: variant.product.image_url,
                        description: variant.product.description,
                        category: variant.product.category,
                    },
                    vial_type: {
                        name: variant.vial_type.name,
                        size_ml: variant.vial_type.size_ml,
                    },
                });
            });

            return Object.values(grouped);
        },
    });

    const filteredProducts = productsWithVariants?.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Get the lowest price variant for display
    const getLowestPrice = (variants: ProductVariant[]) => {
        return Math.min(...variants.map(v => v.price));
    };

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
                            <div className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    id="cat-peptides"
                                    name="category"
                                    className="rounded border-gray-300"
                                    checked={selectedCategory === "Peptides"}
                                    onChange={() => setSelectedCategory("Peptides")}
                                />
                                <label htmlFor="cat-peptides" className="text-sm cursor-pointer">Peptides</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    id="cat-water"
                                    name="category"
                                    className="rounded border-gray-300"
                                    checked={selectedCategory === "Water"}
                                    onChange={() => setSelectedCategory("Water")}
                                />
                                <label htmlFor="cat-water" className="text-sm cursor-pointer">Water</label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Product Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {isLoading ? (
                        <div className="col-span-full text-center py-12">Loading products...</div>
                    ) : filteredProducts?.length === 0 ? (
                        <div className="col-span-full text-center py-12">No products found.</div>
                    ) : (
                        filteredProducts?.map((product) => (
                            <div
                                key={product.id}
                                className="group relative bg-card rounded-xl border overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                                onClick={() => navigate(`/products/${product.id}`)}
                            >
                                <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                                    {product.image_url ? (
                                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-muted-foreground">No image</div>
                                    )}
                                </div>
                                <div className="p-4">
                                    <h3 className="font-semibold text-lg mb-1">{product.name}</h3>
                                    {product.description && (
                                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                            {product.description}
                                        </p>
                                    )}
                                    <div className="flex items-center justify-between">
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
