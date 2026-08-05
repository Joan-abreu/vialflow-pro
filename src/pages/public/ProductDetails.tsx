import { useParams, Link, useNavigate } from "react-router-dom";
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
import SEO from "@/components/SEO";
import { Checkbox } from "@/components/ui/checkbox";
import { getSEOConfig } from "@/config/seoConfig";

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
    slug?: string;
}

const ProductDetails = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
    const [quantity, setQuantity] = useState<number | "">(1);
    const [isBulk, setIsBulk] = useState<boolean>(false);
    const [withLabels, setWithLabels] = useState<boolean>(false);
    const [customLabelImageUrl, setCustomLabelImageUrl] = useState<string | null>(null);
    const [customLabelInstructions, setCustomLabelInstructions] = useState<string>("");
    const [labelUploading, setLabelUploading] = useState(false);

    const handleLabelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate File Size (Max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error("File is too large. Maximum size allowed is 5MB.");
            return;
        }

        // Validate File Format / Extension
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        const allowedExtensions = ['png', 'jpg', 'jpeg', 'svg', 'webp', 'pdf'];
        if (!fileExt || !allowedExtensions.includes(fileExt)) {
            toast.error(`Invalid format. Allowed formats: ${allowedExtensions.join(', ').toUpperCase()}`);
            return;
        }

        setLabelUploading(true);
        try {
            const fileName = `custom-labels/${crypto.randomUUID()}.${fileExt}`;
            
            const { data, error } = await supabase.storage
                .from("product-images")
                .upload(fileName, file, {
                    upsert: false,
                    cacheControl: "31536000",
                });

            if (error) {
                toast.error(`Upload failed: ${error.message}`);
                return;
            }

            const { data: publicData } = supabase.storage.from("product-images").getPublicUrl(data.path);
            setCustomLabelImageUrl(publicData?.publicUrl || "");
            toast.success("Label artwork uploaded successfully!");
        } catch (err: any) {
            toast.error(`Upload error: ${err.message}`);
        } finally {
            setLabelUploading(false);
        }
    };

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

            // Check user authentication role for admin previews
            const { data: { session } } = await supabase.auth.getSession();
            let isAdmin = false;
            if (session?.user?.id) {
                const { data: userRole } = await supabase
                    .from("user_roles")
                    .select("role")
                    .eq("user_id", session.user.id)
                    .single();
                isAdmin = userRole?.role === "admin" || userRole?.role === "manager" || userRole?.role === "staff";
            }

            // Check if product is published
            if (!productData.is_published && !isAdmin) {
                throw new Error("Product not found"); // Hide unpublished products from public
            }

            // Check VIP access for private products
            const isProductPrivate = productData.is_private || (productData as any).product_categories?.is_private;
            if (isProductPrivate && !isAdmin) {
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
            let variantsQuery = supabase
                .from("product_variants")
                .select(`
                    *,
                    vial_type:vial_types(name, capacity_ml, color, shape)
                `)
                .eq("product_id", productData.id);

            // If not admin/staff, only fetch published variants
            if (!isAdmin) {
                variantsQuery = variantsQuery.eq("is_published", true);
            }

            const { data: variantsData, error: variantsError } = await variantsQuery.order('position', { ascending: true });

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
                bulk_price: v.bulk_price ? Number(v.bulk_price) : null,
                bulk_min_qty: v.bulk_min_qty || 100,
                bulk_label_fee: v.bulk_label_fee ? Number(v.bulk_label_fee) : 0.15,
                bulk_only: !!v.bulk_only,
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
                slug: productData.slug,
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

    // Reset or enforce bulk status when variant changes
    useEffect(() => {
        if (selectedVariant) {
            if (selectedVariant.bulk_only) {
                setIsBulk(true);
                const minQty = selectedVariant.bulk_min_qty || 100;
                setQuantity(minQty);
            } else {
                setIsBulk(false);
                setQuantity(1);
            }
        }
    }, [selectedVariantId]);


    const scrollTo = (index: number) => {
        emblaApi?.scrollTo(index);
    };

    const handleAddToCart = () => {
        if (selectedVariant) {
            if (isBulk && withLabels && !customLabelImageUrl) {
                toast.error("Please upload your custom label design (artwork/logo) before adding to cart.");
                return;
            }

            const minLimit = (selectedVariant?.bulk_only) ? (selectedVariant.bulk_min_qty || 100) : (isBulk ? (selectedVariant.bulk_min_qty || 100) : 1);
            const finalQuantity = quantity === "" ? minLimit : Number(quantity);

            if (finalQuantity < minLimit) {
                toast.error(`Minimum order quantity is ${minLimit} units.`);
                setQuantity(minLimit);
                return;
            }

            addToCart(
                selectedVariant, 
                finalQuantity, 
                isBulk, 
                isBulk ? withLabels : false, 
                isBulk && withLabels ? customLabelImageUrl : null, 
                isBulk && withLabels ? customLabelInstructions : null
            );
            // Toast is handled in CartContext
            setQuantity(isBulk ? (selectedVariant.bulk_min_qty || 100) : 1); // Reset quantity after adding
            setCustomLabelImageUrl(null);
            setCustomLabelInstructions("");
        }
    };

    const handleBuyNow = () => {
        if (selectedVariant) {
            if (isBulk && withLabels && !customLabelImageUrl) {
                toast.error("Please upload your custom label design (artwork/logo) before proceeding to checkout.");
                return;
            }

            const minLimit = (selectedVariant?.bulk_only) ? (selectedVariant.bulk_min_qty || 100) : (isBulk ? (selectedVariant.bulk_min_qty || 100) : 1);
            const finalQuantity = quantity === "" ? minLimit : Number(quantity);

            if (finalQuantity < minLimit) {
                toast.error(`Minimum order quantity is ${minLimit} units.`);
                setQuantity(minLimit);
                return;
            }

            addToCart(
                selectedVariant, 
                finalQuantity, 
                isBulk, 
                isBulk ? withLabels : false, 
                isBulk && withLabels ? customLabelImageUrl : null, 
                isBulk && withLabels ? customLabelInstructions : null
            );
            navigate("/checkout");
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

    const seoInfo = getSEOConfig(product?.slug || id, product?.name, product?.description);

    return (
        <div className="container py-12 md:py-20">
            {product && <SEO title={seoInfo.title} description={seoInfo.description} image={product.image_url || undefined} />}
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
                                                loading="lazy"
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
                                    <img src={img} alt="" loading="lazy" className="w-full h-full object-cover" />
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
                        <div className="flex flex-col gap-1 mb-6">
                            <p className="text-3xl font-bold text-primary">
                                ${(() => {
                                    const bulkPrice = selectedVariant?.bulk_price ?? null;
                                    const labelFee = (isBulk && withLabels) ? (selectedVariant?.bulk_label_fee ?? 0.15) : 0;
                                    const displayUnitPrice = (isBulk && bulkPrice !== null) 
                                        ? (bulkPrice + labelFee) 
                                        : (selectedVariant?.price || 0);
                                    return displayUnitPrice.toFixed(2);
                                })()}
                                <span className="text-sm font-normal text-muted-foreground ml-1">/ unit</span>
                            </p>
                            {isBulk && selectedVariant && (
                                <p className="text-sm text-muted-foreground">
                                    Total: ${(() => {
                                        const bulkPrice = selectedVariant?.bulk_price ?? null;
                                        const labelFee = withLabels ? (selectedVariant?.bulk_label_fee ?? 0.15) : 0;
                                        const displayUnitPrice = bulkPrice !== null ? (bulkPrice + labelFee) : selectedVariant.price;
                                        const qtyValue = quantity === "" ? 0 : quantity;
                                        return (displayUnitPrice * qtyValue).toFixed(2);
                                    })()}
                                </p>
                            )}
                        </div>


                        {selectedVariant && selectedVariant.pack_size > 1 && (
                            <div className="mt-4 flex items-center gap-2">
                                <Badge variant="secondary" className="text-sm py-1.5 px-3">
                                    Pack of {selectedVariant.pack_size} units
                                </Badge>
                            </div>
                        )}
                    </div>

                    <div className="space-y-6 pt-6 border-t">
                        {/* Purchase Mode (Retail vs Bulk) */}
                        {selectedVariant && selectedVariant.bulk_price && !selectedVariant.bulk_only && (
                            <div className="space-y-3">
                                <label className="block text-sm font-semibold tracking-wide uppercase text-muted-foreground">Purchase Mode</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsBulk(false);
                                            setQuantity(1);
                                        }}
                                        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                                            !isBulk 
                                                ? 'border-primary bg-primary/5 text-primary shadow-sm' 
                                                : 'border-border hover:border-primary/50 text-muted-foreground'
                                        }`}
                                    >
                                        <span className="font-bold text-base">Retail</span>
                                        <span className="text-xs opacity-80">${selectedVariant.price.toFixed(2)} / unit</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsBulk(true);
                                            setQuantity(selectedVariant.bulk_min_qty || 100);
                                        }}
                                        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                                            isBulk 
                                                ? 'border-primary bg-primary/5 text-primary shadow-sm' 
                                                : 'border-border hover:border-primary/50 text-muted-foreground'
                                        }`}
                                    >
                                        <span className="font-bold text-base">Bulk ({(selectedVariant.bulk_min_qty || 100)}+ qty)</span>
                                        <span className="text-xs opacity-80">${Number(selectedVariant.bulk_price).toFixed(2)} / unit</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {selectedVariant && selectedVariant.bulk_only && (
                            <div className="space-y-3">
                                <label className="block text-sm font-semibold tracking-wide uppercase text-muted-foreground">Bulk Customization</label>
                                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 text-xs text-blue-800 leading-normal">
                                    This product is sold exclusively as a <strong>Wholesale Bulk Order</strong>. Minimum order quantity is <strong>{selectedVariant.bulk_min_qty || 100} units</strong>.
                                </div>
                            </div>
                        )}

                        {isBulk && selectedVariant && (
                            <div className="bg-muted/50 border rounded-xl p-4 space-y-3 animate-in fade-in duration-300">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <label htmlFor="bulk-labels" className="font-semibold text-sm cursor-pointer select-none">
                                            Add Custom Printed Labels
                                        </label>
                                        <p className="text-xs text-muted-foreground">
                                            Printed & applied to all vials for <strong className="font-bold text-primary">+{selectedVariant.bulk_label_fee ? `$${selectedVariant.bulk_label_fee.toFixed(2)}` : '$0.15'}/unit</strong>
                                        </p>
                                    </div>
                                    <Checkbox
                                        id="bulk-labels"
                                        checked={withLabels}
                                        onCheckedChange={(checked) => setWithLabels(checked === true)}
                                    />
                                </div>

                                {withLabels && (
                                    <div className="pt-3 border-t border-border/60 space-y-4 animate-in slide-in-from-top-2 duration-300">
                                        <div className="space-y-2">
                                            <label className="block text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                                                Upload Label Artwork (Logo/Design)
                                            </label>
                                            {customLabelImageUrl ? (
                                                <div className="relative inline-block border rounded-lg overflow-hidden group bg-background p-2">
                                                    <img 
                                                        src={customLabelImageUrl} 
                                                        alt="Label Artwork Preview" 
                                                        className="h-20 w-auto object-contain max-w-[200px]" 
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setCustomLabelImageUrl(null)}
                                                        className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full h-5 w-5 flex items-center justify-center shadow-sm transition-colors text-xs font-bold"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="relative border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center justify-center bg-background hover:bg-muted/30 transition-colors cursor-pointer">
                                                    <input
                                                        type="file"
                                                        accept="image/*,.pdf"
                                                        onChange={handleLabelUpload}
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                        disabled={labelUploading}
                                                    />
                                                    {labelUploading ? (
                                                        <div className="flex flex-col items-center gap-2">
                                                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                                            <span className="text-xs text-muted-foreground">Uploading label design...</span>
                                                        </div>
                                                    ) : (
                                                        <div className="text-center space-y-1">
                                                            <span className="text-xs font-medium text-primary hover:underline">Choose file</span>
                                                            <p className="text-[10px] text-muted-foreground">PNG, JPG, SVG, or PDF (Max 5MB)</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <label htmlFor="custom-label-instructions" className="block text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                                                Label Instructions & Details
                                            </label>
                                            <textarea
                                                id="custom-label-instructions"
                                                value={customLabelInstructions}
                                                onChange={(e) => setCustomLabelInstructions(e.target.value)}
                                                placeholder="Describe text to print, colors, glossy/matte finish, or layout specifications..."
                                                className="w-full min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Quantity Selector */}
                        <div>
                            <label className="block text-sm font-medium mb-3">Quantity</label>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center border rounded-lg">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-12 w-12 rounded-none"
                                        onClick={() => {
                                            const currentVal = quantity === "" ? 0 : quantity;
                                            const minLimit = (selectedVariant?.bulk_only) ? (selectedVariant.bulk_min_qty || 100) : (isBulk ? (selectedVariant.bulk_min_qty || 100) : 1);
                                            setQuantity(Math.max(minLimit, currentVal - 1));
                                        }}
                                        disabled={quantity === "" || quantity <= ((selectedVariant?.bulk_only) ? (selectedVariant.bulk_min_qty || 100) : (isBulk ? (selectedVariant.bulk_min_qty || 100) : 1))}
                                    >
                                        <Minus className="h-4 w-4" />
                                    </Button>
                                    <Input
                                        type="number"
                                        min={((selectedVariant?.bulk_only) ? (selectedVariant.bulk_min_qty || 100) : (isBulk ? (selectedVariant.bulk_min_qty || 100) : 1)).toString()}
                                        value={quantity}
                                        onChange={(e) => {
                                            if (e.target.value === '') {
                                                setQuantity('');
                                                return;
                                            }
                                            const val = parseInt(e.target.value);
                                            if (!isNaN(val)) {
                                                setQuantity(val);
                                            }
                                        }}
                                        onBlur={() => {
                                            const minLimit = (selectedVariant?.bulk_only) ? (selectedVariant.bulk_min_qty || 100) : (isBulk ? (selectedVariant.bulk_min_qty || 100) : 1);
                                            if (quantity === "" || quantity < minLimit) {
                                                setQuantity(minLimit);
                                            }
                                        }}
                                        className="w-24 px-1 h-12 text-center text-lg font-medium border-0 rounded-none focus-visible:ring-0"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-12 w-12 rounded-none"
                                        onClick={() => {
                                            const currentVal = quantity === "" ? 0 : quantity;
                                            setQuantity(currentVal + 1);
                                        }}
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                                {selectedVariant && selectedVariant.pack_size > 1 && !isBulk && !selectedVariant.bulk_only && (
                                    <span className="text-sm font-medium text-muted-foreground bg-muted/40 px-3 py-2 rounded-lg border">
                                        Total: <strong className="text-foreground">{(quantity === "" ? 0 : quantity) * selectedVariant.pack_size}</strong> viales
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Button
                                variant="outline"
                                className="flex-1 h-14 text-lg font-semibold border-primary text-primary hover:bg-primary/5"
                                onClick={handleAddToCart}
                                disabled={!selectedVariant || selectedVariant.stock_quantity === 0}
                            >
                                <ShoppingCart className="mr-2 h-5 w-5" />
                                {selectedVariant?.stock_quantity === 0 ? 'Out of Stock' : 'Add to Cart'}
                            </Button>
                            <Button
                                className="flex-1 h-14 text-lg font-semibold"
                                onClick={handleBuyNow}
                                disabled={!selectedVariant || selectedVariant.stock_quantity === 0}
                            >
                                Buy Now
                            </Button>
                        </div>

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
