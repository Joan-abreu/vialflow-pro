import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle2, ShieldCheck, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";

const Home = () => {
    const { data: featuredProducts, isLoading } = useQuery({
        queryKey: ["featured-products"],
        queryFn: async () => {
            // Fetch published variants with product info
            const { data, error } = await (supabase
                .from("product_variants" as any)
                .select(`
                    *,
                    product:products!inner(id, slug, name, description, image_url, is_published, product_categories(name)),
                    vial_type:vial_types!inner(name, size_ml)
                `)
                .eq("is_published", true)
                .eq("product.is_published", true) as any);

            if (error) throw error;

            // Group by product and collect all variants
            const grouped: Record<string, any> = {};
            (data as any[])?.forEach((variant: any) => {
                const productId = variant.product.id;
                if (!grouped[productId]) {
                    grouped[productId] = {
                        id: productId,
                        slug: variant.product.slug,
                        name: variant.product.name,
                        description: variant.product.description,
                        image_url: variant.product.image_url,
                        category: variant.product.product_categories?.name || null,
                        price: variant.price,
                        size_ml: variant.vial_type.size_ml,
                        pack_size: variant.pack_size,
                        variants: [variant],
                    };
                } else {
                    grouped[productId].variants.push(variant);
                    // Keep the lowest price
                    if (variant.price < grouped[productId].price) {
                        grouped[productId].price = variant.price;
                    }
                }
            });

            return Object.values(grouped).slice(0, 4);
        },
    });

    return (
        <div className="flex flex-col min-h-screen">
            <SEO
                title="Home"
                description="Premium Research Peptides and Water for Laboratory Research. High purity, lab-verified products with fast shipping."
            />
            {/* Hero Section */}
            <section className="relative py-20 md:py-32 overflow-hidden bg-gradient-to-b from-primary/5 to-background">
                <div className="container px-4 md:px-6 relative z-10">
                    <div className="flex flex-col items-center text-center space-y-8">
                        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground">
                            Premium Research Materials for <span className="text-primary">Scientific Excellence</span>
                        </h1>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                            Liv Well Research Labs provides high-purity peptides and sterile water for laboratory research.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link to="/products">
                                <Button size="lg" className="h-12 px-8 text-lg">
                                    Shop Products <ArrowRight className="ml-2 h-5 w-5" />
                                </Button>
                            </Link>
                            <Link to="/about">
                                <Button variant="outline" size="lg" className="h-12 px-8 text-lg">
                                    Learn More
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-20 bg-muted/30">
                <div className="container px-4 md:px-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="flex flex-col items-center text-center p-6 bg-card rounded-xl shadow-sm border">
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
                                <CheckCircle2 className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">99% Purity Guaranteed</h3>
                            <p className="text-muted-foreground">Every batch is rigorously tested to ensure the highest standards of purity for your research.</p>
                        </div>
                        <div className="flex flex-col items-center text-center p-6 bg-card rounded-xl shadow-sm border">
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
                                <Truck className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Fast & Secure Shipping</h3>
                            <p className="text-muted-foreground">Discreet packaging and expedited shipping options to ensure your materials arrive safely.</p>
                        </div>
                        <div className="flex flex-col items-center text-center p-6 bg-card rounded-xl shadow-sm border">
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
                                <ShieldCheck className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Lab Verified</h3>
                            <p className="text-muted-foreground">Third-party HPLC and Mass Spectrometry analysis reports available for all products.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Featured Products Preview */}
            <section className="py-20">
                <div className="container px-4 md:px-6">
                    <div className="flex justify-between items-end mb-10">
                        <div>
                            <h2 className="text-3xl font-bold mb-2">Featured Products</h2>
                            <p className="text-muted-foreground">Our most popular research materials</p>
                        </div>
                        <Link to="/products" className="text-primary hover:underline hidden md:flex items-center">
                            View all products <ArrowRight className="ml-1 h-4 w-4" />
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {isLoading ? (
                            <div className="col-span-full text-center py-12">Loading featured products...</div>
                        ) : featuredProducts?.length === 0 ? (
                            <div className="col-span-full text-center py-12">No products found.</div>
                        ) : (
                            featuredProducts?.map((product: any) => (
                                <Link
                                    key={product.id}
                                    to={`/products/${product.slug || product.id}`}
                                    className="group relative bg-card rounded-xl border overflow-hidden hover:shadow-lg transition-all block"
                                >
                                    <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                                        {product.image_url ? (
                                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                        ) : (
                                            <span className="text-muted-foreground">No Image</span>
                                        )}
                                    </div>
                                    <div className="p-4">
                                        <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">{product.name}</h3>
                                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{product.description}</p>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-bold text-lg">${product.price}+</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {product.variants?.length > 1 && (
                                                <span className="text-xs text-muted-foreground">
                                                    {product.variants.length} sizes available
                                                </span>
                                            )}
                                            {product.pack_size > 1 && (
                                                <Badge variant="secondary" className="text-xs">
                                                    Pack of {product.pack_size} units
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>

                    <div className="mt-8 text-center md:hidden">
                        <Link to="/products">
                            <Button variant="outline" className="w-full">View all products</Button>
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Home;
