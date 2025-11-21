import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useCart, Product } from "@/contexts/CartContext";

import { useNavigate } from "react-router-dom";

const Products = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const { addToCart } = useCart();

    const { data: products, isLoading } = useQuery({
        queryKey: ["public-products", selectedCategory],
        queryFn: async () => {
            const baseQuery = supabase
                .from("products")
                .select("*")
                .eq("is_active", true);

            const query = selectedCategory
                ? baseQuery.eq("category", selectedCategory)
                : baseQuery;

            const { data, error } = await (query as any);
            if (error) throw error;
            return data as unknown as Product[];
        },
    });

    const filteredProducts = products?.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" size="icon">
                        <Filter className="h-4 w-4" />
                    </Button>
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
                                        <span className="text-muted-foreground">No Image</span>
                                    )}
                                </div>
                                <div className="p-4">
                                    <div className="mb-2">
                                        <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-full">
                                            {product.category || "Product"}
                                        </span>
                                    </div>
                                    <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">{product.name}</h3>
                                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                                        {product.description}
                                    </p>
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-lg">${product.price}</span>
                                        <Button
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                addToCart(product);
                                            }}
                                        >
                                            Add to Cart
                                        </Button>
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
