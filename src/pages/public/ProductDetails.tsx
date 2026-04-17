import { useParams, Link } from "react-router-dom";
import useEmblaCarousel from 'embla-carousel-react';
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ShoppingCart, Check, ShieldCheck, Truck, Plus, Minus } from "lucide-react";
import { useCart, ProductVariant } from "@/contexts/CartContext";
import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { RICH_TEXT_STYLES } from "@/lib/rich-text-styles";
import { Image as ImageIcon } from "lucide-react";
import { getBaseSalesCount } from "@/utils/salesCount";
import { Helmet } from "react-helmet-async";

interface ProductWithVariants {
    id: string;
    name: string;
    description: string | null;
    rich_description?: string | null;
    image_url: string | null;
    images?: string[];
    category: string | null;
    sale_type: string;
    default_pack_size: number | null;
    variants: ProductVariant[];
    sales_count?: number;
    is_private?: boolean;
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

            let query = supabase.from("products").select("*, product_categories(name, is_private)");

            if (isUuid) {
                query = query.eq("id", id);
            } else {
                query = query.eq("slug", id);
            }

            const { data: productData, error: productError } = await query.single();

            if (productError) throw productError;
            if (!productData) throw new Error("Product not found");

            // Check VIP access for private products
            const isProductPrivate = productData.is_private || (productData as any).product_categories?.is_private;
            if (isProductPrivate) {
                const { data: { session } } = await supabase.auth.getSession();
                let hasAccess = false;
                if (session?.user?.id) {
                    const { data: profile } = await supabase
                        .from("profiles")
                        .select("can_view_private_products")
                        .eq("user_id", session.user.id)
                        .single();
                    hasAccess = profile?.can_view_private_products || false;
                }
                
                if (!hasAccess) {
                    throw new Error("Product not found"); // Triggers the generic 404 UI
                }
            }

            // Fetch variants
            const { data: variantsData, error: variantsError } = await supabase
                .from("product_variants")
                .select(`
                    *,
                    vial_type:vial_types(name, capacity_ml, color, shape)
                `)
                .eq("product_id", productData.id)
                .eq("is_published", true)
                .order('position', { ascending: true });

            if (variantsError) throw variantsError;

            // Fetch real sales count for this product
            const { data: orderItems } = await supabase
                .from("order_items")
                .select("quantity")
                .eq("product_id", productData.id);

            const realSales = orderItems?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0;
            const salesCount = realSales + getBaseSalesCount(productData.id, productData.is_private, productData.name);

            const variants: ProductVariant[] = (variantsData as any[])?.map((v: any) => ({
                id: v.id,
                product_id: v.product_id,
                vial_type_id: v.vial_type_id,
                sku: v.sku,
                price: v.price,
                stock_quantity: v.stock_quantity,
                max_online_quantity: v.max_online_quantity,
                weight: v.weight,
                image_url: v.image_url,
                pack_size: v.pack_size || 1,
                product: {
                    name: productData.name,
                    slug: productData.slug,
                    image_url: productData.image_url,
                    description: productData.description,
                    category: productData.category,
                    is_private: productData.is_private || false,
                },
                vial_type: {
                    name: v.vial_type.name,
                    capacity_ml: v.vial_type.capacity_ml,
                    color: v.vial_type.color,
                    shape: v.vial_type.shape,
                },
            })) || [];


            return {
                id: productData.id,
                name: productData.name,
                description: productData.description,
                rich_description: (productData as any).rich_description,
                image_url: productData.image_url,
                images: (productData as any).images || [],
                category: (productData as any).product_categories?.name || null,
                sale_type: productData.sale_type || 'individual',
                default_pack_size: productData.default_pack_size,
                variants,
                sales_count: salesCount,
                is_private: productData.is_private,
            } as ProductWithVariants;
        },
        enabled: !!id,
    });

    const selectedVariant = product?.variants.find(v => v.id === selectedVariantId);
    const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
    const [selectedIndex, setSelectedIndex] = useState(0);

    const onSelect = useCallback((api: any) => {
        setSelectedIndex(api.selectedScrollSnap());
    }, []);

    useEffect(() => {
        if (emblaApi) {
            onSelect(emblaApi);
            emblaApi.on('select', onSelect);
            emblaApi.on('reInit', onSelect);
        }
    }, [emblaApi, onSelect]);

    // Auto-select first variant when product loads or changes
    useEffect(() => {
        if (product?.variants && product.variants.length > 0) {
            // Verify if current selection is still valid for this product
            const isValid = product.variants.some(v => v.id === selectedVariantId);
            if (!selectedVariantId || !isValid) {
                setSelectedVariantId(product.variants[0].id);
            }
        }
    }, [product, id, selectedVariantId]);

    const scrollTo = (index: number) => {
        emblaApi?.scrollTo(index);
    };

    const handleAddToCart = () => {
        if (selectedVariant) {
            addToCart(selectedVariant, quantity);
            // Toast is handled in CartContext
            setQuantity(1); // Reset quantity after adding
        }
    };

    const images = [
        ...(selectedVariant?.image_url ? [selectedVariant.image_url] : []),
        ...(product?.images?.filter(img => img !== selectedVariant?.image_url) || [product?.image_url].filter(Boolean))
    ];

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
            {product?.is_private && (
                <Helmet>
                    <meta name="robots" content="noindex, nofollow" />
                </Helmet>
            )}
            <Link to="/products" className="inline-flex items-center text-muted-foreground hover:text-primary mb-8 transition-colors">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Products
            </Link>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20">
                {/* Product Image */}
                {/* Product Images Carousel */}
                <div className="space-y-4">
                    <div className="bg-card rounded-2xl border overflow-hidden aspect-square relative">
                        {images.length > 0 ? (
                            <div className="overflow-hidden h-full" ref={emblaRef}>
                                <div className="flex h-full">
                                    {images.map((img, idx) => (
                                        <div key={idx} className="flex-[0_0_100%] min-w-0 h-full flex items-center justify-center p-8">
                                            <img
                                                src={img}
                                                alt={`${product.name} - ${idx + 1}`}
                                                className="w-full h-full object-contain"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                <ImageIcon className="h-12 w-12 opacity-20 mb-2" />
                                <span>No images available</span>
                            </div>
                        )}
                    </div>

                    {/* Thumbnails */}
                    {images.length > 1 && (
                        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                            {images.map((img, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => emblaApi?.scrollTo(idx)}
                                    className={`relative flex-[0_0_80px] aspect-square rounded-lg border-2 overflow-hidden transition-all ${
                                        selectedIndex === idx ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-primary/50'
                                    }`}
                                >
                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Product Info */}
                <div className="flex flex-col justify-center space-y-8">
                    <div>
                        {product.category && (
                            <div className="inline-block px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4">
                                {product.category}
                            </div>
                        )}
                        <h1 className={`${
                            product.name.length > 70 
                                ? 'text-2xl md:text-3xl' 
                                : product.name.length > 40 
                                    ? 'text-3xl md:text-4xl' 
                                    : 'text-4xl md:text-5xl'
                        } font-bold text-foreground mb-2 transition-all duration-300`}>
                            {product.name}
                        </h1>
                        <p className="text-sm font-medium text-muted-foreground mb-4">{product.sales_count}+ bought in past month</p>
                        <p className="text-2xl font-semibold text-primary mb-6">
                            ${selectedVariant?.price.toFixed(2) || '0.00'}
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
                                        value={quantity}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (!isNaN(val) && val >= 1) {
                                                setQuantity(val);
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
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Add to Cart Button */}
                        <Button
                            className="w-full h-14 text-lg font-semibold"
                            onClick={handleAddToCart}
                            disabled={!selectedVariant || selectedVariant.stock_quantity === 0}
                        >
                            <ShoppingCart className="mr-2 h-5 w-5" />
                            {selectedVariant?.stock_quantity === 0 ? 'Out of Stock' : 'Add to Cart'}
                        </Button>

                        {/* Product Features */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t">
                            <div className="flex items-start gap-3">
                                <div className="bg-primary/10 p-2 rounded-lg">
                                    <Check className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <div className="font-medium">In Stock</div>
                                    <div className="text-sm text-muted-foreground">
                                        Available and ready to ship
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="bg-primary/10 p-2 rounded-lg">
                                    <Truck className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <div className="font-medium">Fast Shipping</div>
                                    <div className="text-sm text-muted-foreground">Fast and reliable delivery</div>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 sm:col-span-2">
                                <div className="bg-primary/10 p-2 rounded-lg">
                                    <ShieldCheck className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <div className="font-medium">Quality Guaranteed</div>
                                    <div className="text-sm text-muted-foreground">
                                        All products are tested and certified
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>




            <div className="mt-12 md:mt-16 border-t pt-8 md:pt-12">
                <h2 className="text-2xl font-bold mb-6">Description</h2>
                {product.rich_description ? (
                    <div
                        className={RICH_TEXT_STYLES}
                        dangerouslySetInnerHTML={{ __html: product.rich_description }}
                    />
                ) : (
                    <p className="text-lg text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {product.description || "No description available for this product."}
                    </p>
                )}
            </div>
        </div >
    );
};

export default ProductDetails;
