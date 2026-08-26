import { useParams, Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import useEmblaCarousel from 'embla-carousel-react';
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ShoppingCart, Check, ShieldCheck, Truck, Plus, Minus, ArrowRight, Sparkles, Bell } from "lucide-react";
import RestockNotificationModal from "@/components/public/RestockNotificationModal";
import { useCart, ProductVariant } from "@/contexts/CartContext";
import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { RICH_TEXT_STYLES } from "@/lib/rich-text-styles";
import { Image as ImageIcon } from "lucide-react";
import { Helmet } from "react-helmet-async";
import SEO from "@/components/SEO";
import { Checkbox } from "@/components/ui/checkbox";
import { getSEOConfig } from "@/config/seoConfig";
import ProductShippingPerks from "@/components/public/ProductShippingPerks";
import { getBaseSalesCount } from "@/utils/salesCount";

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
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const { addToCart } = useCart();
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
    const [quantity, setQuantity] = useState<number | "">(1);
    const [isBulk, setIsBulk] = useState<boolean>(false);
    const [withLabels, setWithLabels] = useState<boolean>(false);
    const [customLabelImageUrl, setCustomLabelImageUrl] = useState<string | null>(null);
    const [customLabelInstructions, setCustomLabelInstructions] = useState<string>("");
    const [labelUploading, setLabelUploading] = useState(false);
    const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);

    // Fetch stock enforcement settings
    const { data: stockSettings } = useQuery({
        queryKey: ["app-settings-stock-control"],
        staleTime: 60000,
        queryFn: async () => {
            const { data } = await supabase
                .from("app_settings" as any)
                .select("key, value")
                .in("key", ["enable_strict_stock_enforcement", "enable_restock_notifications"]);

            const map = {
                enable_strict_stock_enforcement: true,
                enable_restock_notifications: true
            };
            if (data && Array.isArray(data)) {
                data.forEach((s: any) => {
                    if (s.key === "enable_strict_stock_enforcement") map.enable_strict_stock_enforcement = s.value === "true";
                    if (s.key === "enable_restock_notifications") map.enable_restock_notifications = s.value === "true";
                });
            }
            return map;
        }
    });

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
        staleTime: 0,
        queryFn: async () => {
            if (!id) throw new Error("Product ID or Slug is required");
            const cleanId = id.trim();

            console.log(`[ProductDetails] Initiating lookup for: "${cleanId}"`);

            // Check if id is a valid UUID
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

            let productData: any = null;
            let productError: any = null;

            if (isUuid) {
                const res = await supabase
                    .from("products")
                    .select("*, product_categories(name, is_private)")
                    .eq("id", cleanId)
                    .maybeSingle();
                productData = res.data;
                productError = res.error;
            } else {
                // 1. Try exact slug match
                const res = await supabase
                    .from("products")
                    .select("*, product_categories(name, is_private)")
                    .ilike("slug", cleanId)
                    .maybeSingle();
                productData = res.data;
                productError = res.error;

                // 2. Fallback: try partial slug match
                if (!productData && !productError) {
                    const normalized = cleanId.replace(/[^a-zA-Z0-9]/g, "");
                    const altRes = await supabase
                        .from("products")
                        .select("*, product_categories(name, is_private)")
                        .or(`slug.ilike.%${cleanId}%,slug.ilike.%${normalized}%`)
                        .limit(1)
                        .maybeSingle();
                    if (altRes.data) productData = altRes.data;
                }

                // 3. Fallback: try product name match
                if (!productData && !productError) {
                    const searchName = cleanId.replace(/-/g, " ");
                    const nameRes = await supabase
                        .from("products")
                        .select("*, product_categories(name, is_private)")
                        .ilike("name", `%${searchName}%`)
                        .limit(1)
                        .maybeSingle();
                    if (nameRes.data) productData = nameRes.data;
                }
            }

            if (productError) {
                console.error("[ProductDetails] Database error fetching product:", productError);
                throw productError;
            }

            if (!productData) {
                console.warn(`[ProductDetails] No product found in database matching "${cleanId}"`);
                throw new Error("Product not found");
            }

            console.log(`[ProductDetails] Successfully loaded product "${productData.name}" (id: ${productData.id}, slug: ${productData.slug})`);

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

            // Check if product is published or archived (only block if not admin)
            if ((productData.is_published === false || (productData as any).is_archived === true) && !isAdmin) {
                console.warn(`[ProductDetails] Product "${productData.name}" is draft or archived.`);
                throw new Error("Product not found");
            }

            // Check VIP access for private products (only if product is explicitly marked private)
            const isProductPrivate = productData.is_private === true;

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
                    console.warn(`[ProductDetails] Access denied to private VIP product "${productData.name}".`);
                    throw new Error("Product not found");
                }
            }

            // Fetch variants safely matching Products.tsx query
            let variantsData: any[] = [];
            try {
                const { data, error: vErr } = await supabase
                    .from("product_variants")
                    .select(`
                        *,
                        vial_type:vial_types(name, capacity_ml, color, shape)
                    `)
                    .eq("product_id", productData.id)
                    .order("position", { ascending: true });

                if (!vErr && data) {
                    variantsData = data;
                } else if (vErr) {
                    console.warn("[ProductDetails] Non-fatal error fetching variants:", vErr);
                }
            } catch (err) {
                console.warn("[ProductDetails] Exception fetching variants:", err);
            }

            // Fetch real sales count for this product
            let realSales = 0;
            try {
                const { data: orderItems } = await supabase
                    .from("order_items")
                    .select("quantity")
                    .eq("product_id", productData.id);
                realSales = orderItems?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0;
            } catch (e) {
                console.warn("[ProductDetails] Non-fatal error fetching sales count:", e);
            }

            const salesCount = realSales + getBaseSalesCount(productData.id, productData.is_private, productData.name, (productData as any).product_categories?.name || productData.category);

            let variants: ProductVariant[] = (variantsData || []).map((v: any) => ({
                id: v.id,
                product_id: v.product_id,
                vial_type_id: v.vial_type_id,
                sku: v.sku || '',
                price: Number(v.price) || 0,
                stock_quantity: v.stock_quantity ?? 999,
                max_online_quantity: v.max_online_quantity,
                weight: v.weight,
                image_url: v.image_url,
                images: v.images || [],
                pack_size: v.pack_size || 1,
                position: v.position ?? 0,
                bulk_price: v.bulk_price ? Number(v.bulk_price) : null,
                bulk_min_qty: v.bulk_min_qty || 100,
                bulk_label_fee: v.bulk_label_fee ? Number(v.bulk_label_fee) : 0.15,
                bulk_only: !!v.bulk_only,
                product: {
                    name: productData.name,
                    slug: productData.slug,
                    image_url: productData.image_url,
                    description: productData.description,
                    category: (productData as any).product_categories?.name || productData.category,
                    is_private: productData.is_private || false,
                },
                vial_type: {
                    name: v.vial_type?.name || 'Standard',
                    capacity_ml: v.vial_type?.capacity_ml || 10,
                    color: v.vial_type?.color || 'Clear',
                    shape: v.vial_type?.shape || 'Round',
                },
            })).sort((a, b) => {
                // 1. Sort by position if distinct
                const posA = a.position ?? 0;
                const posB = b.position ?? 0;
                if (posA !== posB) return posA - posB;

                // 2. Numerical capacity / dosage
                const capA = a.vial_type?.capacity_ml ?? 0;
                const capB = b.vial_type?.capacity_ml ?? 0;
                if (capA !== capB && capA > 0 && capB > 0) return capA - capB;

                // 3. Extract numbers from dosage name or sku (e.g. 10mg vs 30mg vs 60mg)
                const getNum = (item: any) => {
                    const str = `${item.vial_type?.name || ''} ${item.sku || ''}`;
                    const m = str.match(/(\d+(?:\.\d+)?)\s*(?:mg|ml|g|mcg|pack|pk|units?)/i) || str.match(/\b(\d+(?:\.\d+)?)\b/);
                    return m ? parseFloat(m[1]) : 0;
                };
                const numA = getNum(a);
                const numB = getNum(b);
                if (numA !== numB && numA > 0 && numB > 0) return numA - numB;

                // 4. Pack size
                if ((a.pack_size || 1) !== (b.pack_size || 1)) return (a.pack_size || 1) - (b.pack_size || 1);

                // 5. Price
                return (a.price || 0) - (b.price || 0);
            });

            // Fallback if product has no variants in product_variants
            if (variants.length === 0) {
                variants = [{
                    id: productData.id,
                    product_id: productData.id,
                    vial_type_id: null,
                    sku: productData.slug || productData.id.slice(0, 8),
                    price: (productData as any).price ? Number((productData as any).price) : 0,
                    stock_quantity: (productData as any).stock_quantity ?? 999,
                    max_online_quantity: null,
                    weight: null,
                    image_url: productData.image_url,
                    images: (productData as any).images || [],
                    pack_size: productData.default_pack_size || 1,
                    bulk_price: null,
                    bulk_min_qty: 100,
                    bulk_label_fee: 0.15,
                    bulk_only: false,
                    product: {
                        name: productData.name,
                        slug: productData.slug,
                        image_url: productData.image_url,
                        description: productData.description,
                        category: (productData as any).product_categories?.name || productData.category,
                        is_private: productData.is_private || false,
                    },
                    vial_type: {
                        name: 'Standard',
                        capacity_ml: 10,
                        color: 'Clear',
                        shape: 'Round',
                    },
                }];
            }

            console.log(`[ProductDetails] Returning complete product object for "${productData.name}" with ${variants.length} variant(s).`);

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

    console.log("[ProductDetails] Render state:", {
        id,
        isLoading,
        hasProduct: !!product,
        variantsCount: product?.variants?.length,
        errorMessage: error instanceof Error ? error.message : String(error || "")
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

    const variantImages = selectedVariant?.images && selectedVariant.images.length > 0
        ? selectedVariant.images
        : (selectedVariant?.image_url ? [selectedVariant.image_url] : []);

    const productFallbackImages = product?.images && product.images.length > 0
        ? product.images
        : (product?.image_url ? [product.image_url] : []);

    const images = variantImages.length > 0 ? variantImages : productFallbackImages;

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

            {(() => {
                const activeCategory = searchParams.get("fromCategory") || location.state?.fromCategory || product?.category;
                const categoryBackUrl = activeCategory ? `/products?category=${encodeURIComponent(activeCategory)}` : "/products";
                
                return (
                    <Link to={categoryBackUrl} className="inline-flex items-center text-muted-foreground hover:text-primary mb-8 transition-colors text-sm font-medium">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        <span>Back to Products</span>
                        {activeCategory && (
                            <>
                                <span className="mx-1.5 text-muted-foreground/50">/</span>
                                <span className="font-bold text-foreground hover:text-primary transition-colors">{activeCategory}</span>
                            </>
                        )}
                    </Link>
                );
            })()}

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
                            <Link 
                                to={`/products?category=${encodeURIComponent(product.category)}`}
                                className="inline-block px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-full text-sm font-medium mb-4 transition-colors cursor-pointer"
                            >
                                {product.category}
                            </Link>
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
                        {/* Variant / Dosage Selector (e.g. 10mg, 30mg, 60mg) */}
                        {product && product.variants && product.variants.length > 1 && (
                            <div className="space-y-3">
                                <label className="block text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                                    Select Dosage / Option
                                </label>
                                <div className="flex flex-wrap gap-3">
                                    {product.variants.map((v) => {
                                        const isSelected = v.id === selectedVariantId;
                                        const rawName = v.vial_type?.name || (v.sku ? `SKU: ${v.sku}` : `Option`);
                                        const labelName = rawName.replace(/\s+(Tall|Short)\s+Vial/gi, "").replace(/\s+Vial/gi, "").trim();
                                        return (
                                            <button
                                                key={v.id}
                                                type="button"
                                                onClick={() => setSelectedVariantId(v.id)}
                                                className={`flex flex-col items-center justify-center px-5 py-3 rounded-xl border-2 transition-all min-w-[100px] ${
                                                    isSelected
                                                        ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm ring-2 ring-primary/20'
                                                        : 'border-border hover:border-primary/50 text-foreground bg-background'
                                                }`}
                                            >
                                                <span className="text-base font-bold">{labelName}</span>
                                                <span className="text-xs opacity-80">${v.price.toFixed(2)}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

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
                                                const maxStock = selectedVariant?.stock_quantity ?? 999;
                                                if (maxStock > 0 && val > maxStock) {
                                                    toast.error(`Only ${maxStock} units available in stock.`);
                                                    setQuantity(maxStock);
                                                    return;
                                                }
                                                setQuantity(val);
                                            }
                                        }}
                                        onBlur={() => {
                                            const minLimit = (selectedVariant?.bulk_only) ? (selectedVariant.bulk_min_qty || 100) : (isBulk ? (selectedVariant.bulk_min_qty || 100) : 1);
                                            const maxStock = selectedVariant?.stock_quantity ?? 999;
                                            if (quantity === "" || quantity < minLimit) {
                                                setQuantity(Math.min(minLimit, maxStock));
                                            } else if (maxStock > 0 && quantity > maxStock) {
                                                toast.error(`Only ${maxStock} units available in stock.`);
                                                setQuantity(maxStock);
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
                                            const maxStock = selectedVariant?.stock_quantity ?? 999;
                                            if (maxStock > 0 && currentVal + 1 > maxStock) {
                                                toast.error(`Only ${maxStock} units available in stock.`);
                                                return;
                                            }
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

                        {/* Action Buttons & Stock Logic */}
                        {(() => {
                            const isStrictStock = stockSettings?.enable_strict_stock_enforcement ?? true;
                            const isRestockNotify = stockSettings?.enable_restock_notifications ?? true;
                            const isOutOfStock = isStrictStock && selectedVariant && selectedVariant.stock_quantity <= 0;

                            if (isOutOfStock) {
                                return isRestockNotify ? (
                                    <Button
                                        className="w-full h-14 text-lg font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md transition-all flex items-center justify-center gap-2"
                                        onClick={() => setIsRestockModalOpen(true)}
                                    >
                                        <Bell className="h-5 w-5" />
                                        Notify Me When Restocked
                                    </Button>
                                ) : (
                                    <Button disabled className="w-full h-14 text-lg font-bold">
                                        Out of Stock
                                    </Button>
                                );
                            }

                            return (
                                <div className="space-y-2">
                                    {isStrictStock && selectedVariant && selectedVariant.stock_quantity > 0 && selectedVariant.stock_quantity < 10 && (
                                        <p className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                                            <span>⚡ Only {selectedVariant.stock_quantity} left in stock - order soon</span>
                                        </p>
                                    )}
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <Button
                                            variant="outline"
                                            className="flex-1 h-14 text-lg font-semibold border-primary text-primary hover:bg-primary/5"
                                            onClick={handleAddToCart}
                                            disabled={!selectedVariant}
                                        >
                                            <ShoppingCart className="mr-2 h-5 w-5" />
                                            Add to Cart
                                        </Button>
                                        <Button
                                            className="flex-1 h-14 text-lg font-semibold"
                                            onClick={handleBuyNow}
                                            disabled={!selectedVariant}
                                        >
                                            Buy Now
                                        </Button>
                                    </div>
                                </div>
                            );
                        })()}

                        <RestockNotificationModal
                            isOpen={isRestockModalOpen}
                            onClose={() => setIsRestockModalOpen(false)}
                            product={product}
                            selectedVariant={selectedVariant}
                        />

                        {/* Trust & Shipping Perks */}
                        <ProductShippingPerks className="mt-2" freeShippingThreshold={100} />

                        {/* Research Peptides Promotion Banner for Ad Traffic */}
                        <div className="bg-gradient-to-br from-primary/10 via-emerald-500/10 to-teal-500/15 border-2 border-primary/25 rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
                            <div className="flex items-center gap-2">
                                <Badge className="bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-wider">
                                    <Sparkles className="h-3 w-3 mr-1" /> NOW AVAILABLE
                                </Badge>
                                <span className="text-xs text-primary font-bold uppercase tracking-wider">Expanded Catalog</span>
                            </div>
                            <div className="space-y-1.5">
                                <h3 className="text-lg md:text-xl font-bold tracking-tight text-foreground">
                                    Looking for Research Peptides? 🧪
                                </h3>
                                <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                                    Pair your reconstitution solution with our newly launched line of high-purity research peptides. Available for immediate shipping.
                                </p>
                            </div>
                            <Link to="/products?category=peptides" className="inline-block w-full">
                                <Button className="w-full font-bold shadow-sm group h-11 text-sm">
                                    Browse Peptides Catalog
                                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </Button>
                            </Link>
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
