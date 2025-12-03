import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ShoppingCart, Check, ShieldCheck, Truck, Plus, Minus } from "lucide-react";
import { useCart, ProductVariant } from "@/contexts/CartContext";
import { toast } from "sonner";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface ProductWithVariants {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    category: string | null;
    sale_type: string;
    default_pack_size: number | null;
    variants: ProductVariant[];
}

const ProductDetails = () => {
    const { id } = useParams<{ id: string }>();
    const { addToCart } = useCart();
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
    const [quantity, setQuantity] = useState<number>(1);

    const { data: product, isLoading, error } = useQuery({
        queryKey: ["product-with-variants", id],
        queryFn: async () => {
            if (!id) throw new Error("Product ID or Slug is required");

            // Check if id is a valid UUID
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

            let query = supabase.from("products").select("*");

            if (isUuid) {
                query = query.eq("id", id);
            } else {
                query = query.eq("slug", id);
            }

            const { data: productData, error: productError } = await query.single();

            if (productError) throw productError;
            if (!productData) throw new Error("Product not found");

            // Fetch variants
            const { data: variantsData, error: variantsError } = await supabase
                .from("product_variants")
                .select(`
                    *,
                    vial_type:vial_types(name, size_ml)
                `)
                .eq("product_id", productData.id)
                .eq("is_published", true)
                .order('position', { ascending: true });

            if (variantsError) throw variantsError;

            const variants: ProductVariant[] = (variantsData as any[])?.map((v: any) => ({
                id: v.id,
                product_id: v.product_id,
                vial_type_id: v.vial_type_id,
                sku: v.sku,
                price: v.price,
                stock_quantity: v.stock_quantity,
                image_url: v.image_url,
                pack_size: v.pack_size || 1,
                product: {
                    name: productData.name,
                    slug: productData.slug,
                    image_url: productData.image_url,
                    description: productData.description,
                    category: productData.category,
                },
                vial_type: {
                    name: v.vial_type.name,
                    size_ml: v.vial_type.size_ml,
                },
            })) || [];

            // Auto-select first variant
            if (variants.length > 0 && !selectedVariantId) {
                setSelectedVariantId(variants[0].id);
            }

            return {
                id: productData.id,
                name: productData.name,
                description: productData.description,
                image_url: productData.image_url,
                category: productData.category,
                sale_type: productData.sale_type || 'individual',
                default_pack_size: productData.default_pack_size,
                variants,
            } as ProductWithVariants;
        },
        enabled: !!id,
    });

    const selectedVariant = product?.variants.find(v => v.id === selectedVariantId);

    const handleAddToCart = () => {
        if (selectedVariant) {
            for (let i = 0; i < quantity; i++) {
                addToCart(selectedVariant);
            }
            toast.success(`Added ${quantity} item${quantity > 1 ? 's' : ''} to cart`);
            setQuantity(1); // Reset quantity after adding
        }
    };

    if (isLoading) {
        return (
            <div className="container py-20 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Loading product details...</p>
            </div>
        );
    }

    if (error || !product || product.variants.length === 0) {
        return (
            <div className="container py-20 text-center">
                <h2 className="text-2xl font-bold mb-4">Product not found</h2>
                <p className="text-muted-foreground mb-8">The product you are looking for does not exist or has been removed.</p>
                <Link to="/products">
                    <Button>Back to Products</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="container py-12 md:py-20">
            <Link to="/products" className="inline-flex items-center text-muted-foreground hover:text-primary mb-8 transition-colors">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Products
            </Link>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20">
                {/* Product Image */}
                <div className="bg-card rounded-2xl border overflow-hidden aspect-square flex items-center justify-center p-8">
                    {(() => {
                        const displayImage = selectedVariant?.image_url || product.image_url;
                        return displayImage ? (
                            <img
                                src={displayImage}
                                alt={product.name}
                                className="w-full h-full object-contain hover:scale-105 transition-transform duration-500"
                            />
                        ) : (
                            <div className="text-center text-muted-foreground">
                                <span className="block text-6xl mb-4">📦</span>
                                <span>No image available</span>
                            </div>
                        );
                    })()}
                </div>

                {/* Product Info */}
                <div className="flex flex-col justify-center space-y-8">
                    <div>
                        {product.category && (
                            <div className="inline-block px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4">
                                {product.category}
                            </div>
                        )}
                        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">{product.name}</h1>
                        <p className="text-2xl font-semibold text-primary mb-6">
                            ${selectedVariant?.price.toFixed(2) || '0.00'}
                        </p>
                        <p className="text-lg text-muted-foreground leading-relaxed">
                            {product.description || "No description available for this product."}
                        </p>
                        {selectedVariant && selectedVariant.pack_size > 1 && (
                            <div className="mt-4 flex items-center gap-2">
                                <Badge variant="secondary" className="text-sm py-1.5 px-3">
                                    Pack of {selectedVariant.pack_size} units
                                </Badge>
                            </div>
                        )}
                    </div>

                    <div className="space-y-6 pt-6 border-t">
                        {/* Size Selector */}
                        <div>
                            <label className="block text-sm font-medium mb-3">Select Size</label>
                            <div className="flex flex-wrap gap-3">
                                {product.variants.map((variant) => (
                                    <button
                                        key={variant.id}
                                        onClick={() => setSelectedVariantId(variant.id)}
                                        className={`px-6 py-3 rounded-lg border-2 transition-all ${selectedVariantId === variant.id
                                            ? 'border-primary bg-primary/10 text-primary font-semibold'
                                            : 'border-border hover:border-primary/50'
                                            }`}
                                    >
                                        <div className="text-sm font-medium">{variant.vial_type.size_ml}ml {variant.pack_size > 1 ? `(${variant.pack_size}x Pack)` : ''}</div>
                                        <div className="text-xs text-muted-foreground">${variant.price.toFixed(2)}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Quantity Selector */}
                        <div>
                            <label className="block text-sm font-medium mb-3">Quantity</label>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center border rounded-lg">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-12 w-12 rounded-none"
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        disabled={quantity <= 1}
                                    >
                                        <Minus className="h-4 w-4" />
                                    </Button>
                                    <Input
                                        type="number"
                                        min="1"
                                        max={selectedVariant?.stock_quantity}
                                        value={quantity}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (!isNaN(val) && val >= 1) {
                                                if (selectedVariant && val > selectedVariant.stock_quantity) {
                                                    setQuantity(selectedVariant.stock_quantity);
                                                    toast.error(`Only ${selectedVariant.stock_quantity} units available`);
                                                } else {
                                                    setQuantity(val);
                                                }
                                            } else if (e.target.value === '') {
                                                // Allow empty string temporarily for typing
                                                setQuantity(1);
                                            }
                                        }}
                                        className="w-16 h-12 text-center text-lg font-medium border-0 rounded-none focus-visible:ring-0"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-12 w-12 rounded-none"
                                        onClick={() => setQuantity(quantity + 1)}
                                        disabled={!selectedVariant || quantity >= selectedVariant.stock_quantity}
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <Button
                                size="lg"
                                className="flex-1 h-14 text-lg active:scale-95 transition-transform duration-100"
                                onClick={handleAddToCart}
                                disabled={!selectedVariant || selectedVariant.stock_quantity === 0}
                            >
                                <ShoppingCart className="mr-2 h-5 w-5" />
                                {selectedVariant?.stock_quantity === 0 ? 'Out of Stock' : 'Add to Cart'}
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <Check className={`h-5 w-5 ${selectedVariant && selectedVariant.stock_quantity > 0 ? 'text-green-500' : 'text-gray-400'}`} />
                                <span>
                                    {selectedVariant
                                        ? selectedVariant.stock_quantity > 0
                                            ? `In Stock (${selectedVariant.stock_quantity} units)`
                                            : 'Out of Stock'
                                        : 'Select a size'}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <ShieldCheck className="h-5 w-5 text-primary" />
                                <span>Lab Verified Purity</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <Truck className="h-5 w-5 text-primary" />
                                <span>Fast Shipping</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductDetails;
