import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShoppingCart, Check, ShieldCheck, Truck } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";

interface Product {
    id: string;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
    category: string;
    stock_quantity: number;
}

const ProductDetails = () => {
    const { id } = useParams<{ id: string }>();
    const { addToCart } = useCart();

    const { data: product, isLoading, error } = useQuery({
        queryKey: ["product", id],
        queryFn: async () => {
            if (!id) throw new Error("Product ID is required");

            const { data, error } = await supabase
                .from("products")
                .select("*")
                .eq("id", id)
                .single();

            if (error) throw error;
            return data as unknown as Product;
        },
        enabled: !!id,
    });

    const handleAddToCart = () => {
        if (product) {
            addToCart(product);
            toast.success("Added to cart");
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

    if (error || !product) {
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
                    {product.image_url ? (
                        <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-contain hover:scale-105 transition-transform duration-500"
                        />
                    ) : (
                        <div className="text-center text-muted-foreground">
                            <span className="block text-6xl mb-4">📦</span>
                            <span>No image available</span>
                        </div>
                    )}
                </div>

                {/* Product Info */}
                <div className="flex flex-col justify-center space-y-8">
                    <div>
                        <div className="inline-block px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4">
                            {product.category}
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">{product.name}</h1>
                        <p className="text-2xl font-semibold text-primary mb-6">${product.price.toFixed(2)}</p>
                        <p className="text-lg text-muted-foreground leading-relaxed">
                            {product.description || "No description available for this product."}
                        </p>
                    </div>

                    <div className="space-y-6 pt-6 border-t">
                        <div className="flex items-center gap-4">
                            <Button size="lg" className="flex-1 h-14 text-lg" onClick={handleAddToCart}>
                                <ShoppingCart className="mr-2 h-5 w-5" />
                                Add to Cart
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <Check className="h-5 w-5 text-green-500" />
                                <span>In Stock ({product.stock_quantity} units)</span>
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
