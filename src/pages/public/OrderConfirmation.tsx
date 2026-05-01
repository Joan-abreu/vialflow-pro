import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Package, Truck, MapPin, UserPlus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";

const OrderConfirmation = () => {
    const { orderId } = useParams();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const { clearCart } = useCart();
    const { session } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchOrder = async () => {
            if (!orderId) return;

            const { data, error } = await supabase
                .from("orders")
                .select(`
          *,
          order_items (
            *,
            variant:product_variants (
              *,
              product:products (name, image_url),
              vial_type:vial_types(name, capacity_ml, color, shape)
            )
          )
        `)
                .eq("id", orderId)
                .single();

            if (!error && data) {
                setOrder(data);
            }
            setLoading(false);
        };

        fetchOrder();
        // Clear cart when order confirmation loads
        clearCart();
    }, [orderId]);

    if (loading) {
        return (
            <div className="container py-12 space-y-8">
                <div className="text-center space-y-4">
                    <Skeleton className="h-12 w-12 rounded-full mx-auto" />
                    <Skeleton className="h-8 w-64 mx-auto" />
                    <Skeleton className="h-4 w-48 mx-auto" />
                </div>
                <div className="max-w-3xl mx-auto space-y-6">
                    <Skeleton className="h-64 w-full rounded-lg" />
                </div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="container py-12 text-center">
                <h1 className="text-2xl font-bold mb-4">Order not found</h1>
                <Link to="/">
                    <Button>Return to Home</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="container py-12 max-w-3xl">
            <div className="text-center mb-12 space-y-4">
                <div className="inline-flex items-center justify-center p-3 bg-green-100 rounded-full mb-4">
                    <CheckCircle2 className="h-12 w-12 text-green-600" />
                </div>
                <h1 className="text-4xl font-bold text-green-900">Order Confirmed!</h1>
                <p className="text-lg text-muted-foreground">
                    Thank you for your purchase. Your order #{order.id.slice(0, 8)} has been received.
                </p>
                <div className="flex justify-center gap-4 pt-4">
                    <Link to="/products">
                        <Button>Continue Shopping</Button>
                    </Link>
                </div>
            </div>

            <div className="grid gap-8">
                {/* Order Details Card */}
                <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-muted/30 p-6 border-b">
                        <div className="flex justify-between items-center">
                            <h2 className="font-semibold flex items-center gap-2">
                                <Package className="h-5 w-5" />
                                Order Details
                            </h2>
                            <span className="text-sm text-muted-foreground">
                                {new Date(order.created_at).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                    <div className="p-6 space-y-6">
                        {order.order_items.map((item: any) => (
                            <div key={item.id} className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="h-16 w-16 bg-muted rounded-md overflow-hidden border">
                                        {item.variant.product.image_url ? (
                                            <img
                                                src={item.variant.product.image_url}
                                                alt={item.variant.product.name}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">Img</div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-medium">{item.variant.product.name}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {item.variant.vial_type.capacity_ml}ml{item.variant.vial_type.color ? ` - ${item.variant.vial_type.color}` : ''}{item.variant.vial_type.shape ? ` - ${item.variant.vial_type.shape}` : ''} • Qty: {item.quantity}
                                        </p>
                                    </div>
                                </div>
                                <p className="font-medium">${(item.price_at_time * item.quantity).toFixed(2)}</p>
                            </div>
                        ))}

                        <div className="border-t pt-4 mt-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span>${(order.total_amount - (order.shipping_cost || 0) - (order.tax || 0) + (order.product_discount || 0) + (order.shipping_discount || 0)).toFixed(2)}</span>
                            </div>
                            {order.product_discount > 0 && (
                                <div className="flex justify-between text-sm text-green-600 font-medium">
                                    <span>Discount {order.applied_coupons?.length > 0 && `(${order.applied_coupons.join(", ")})`}</span>
                                    <span>-${order.product_discount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Shipping ({order.shipping_service || 'Standard'})</span>
                                <span>${(order.shipping_cost || 0).toFixed(2)}</span>
                            </div>
                            {order.shipping_discount > 0 && (
                                <div className="flex justify-between text-sm text-green-600 font-medium">
                                    <span>Shipping Discount</span>
                                    <span>-${order.shipping_discount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Tax</span>
                                <span>${(order.tax || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-lg pt-2 border-t mt-2">
                                <span>Total</span>
                                <span>${order.total_amount.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Shipping Info Card */}
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-card border rounded-lg p-6">
                        <h3 className="font-semibold flex items-center gap-2 mb-4">
                            <MapPin className="h-5 w-5" />
                            Shipping Address
                        </h3>
                        {order.shipping_address ? (
                            <div className="text-sm text-muted-foreground space-y-1">
                                <p>{order.shipping_address.line1}</p>
                                {order.shipping_address.line2 && <p>{order.shipping_address.line2}</p>}
                                <p>
                                    {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postal_code}
                                </p>
                                <p>{order.shipping_address.country}</p>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No shipping address provided</p>
                        )}
                    </div>

                    <div className="bg-card border rounded-lg p-6">
                        <h3 className="font-semibold flex items-center gap-2 mb-4">
                            <Truck className="h-5 w-5" />
                            Shipping Method
                        </h3>
                        <div className="text-sm text-muted-foreground space-y-1">
                            <p>{order.shipping_service || 'Standard Shipping'}</p>
                            {order.estimated_days ? (
                                <p className="font-medium text-green-700">
                                    Estimated delivery: {(() => {
                                        const date = new Date(order.created_at);
                                        date.setDate(date.getDate() + order.estimated_days);
                                        return date.toLocaleDateString('en-US', { 
                                            weekday: 'long', 
                                            month: 'long', 
                                            day: 'numeric' 
                                        });
                                    })()}
                                </p>
                            ) : (
                                <p>Estimated delivery: See carrier details</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {!session && (
                <div className="mt-12 bg-primary/5 border border-primary/20 rounded-xl p-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-6">
                        <UserPlus className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Save time on your next order</h2>
                    <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                        Create an account now to track your orders easily and stay updated with our latest news.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Button 
                            className="px-8 py-6 text-lg font-semibold shadow-lg hover:scale-105 transition-all"
                            onClick={() => navigate("/register", { 
                                state: { 
                                    email: order?.customer_email,
                                    fullName: order?.shipping_address?.full_name 
                                } 
                            })}
                        >
                            Create My Account
                        </Button>
                        <Link to="/products">
                            <Button variant="ghost" className="px-8 py-6 text-lg">
                                Maybe Later
                            </Button>
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrderConfirmation;
