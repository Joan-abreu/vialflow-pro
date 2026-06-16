import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Trash2, Plus, Minus, ArrowRight, AlertTriangle } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const Cart = () => {
    const { items, removeFromCart, updateQuantity, cartTotal } = useCart();
    const [requireResearchAck, setRequireResearchAck] = useState(false);
    const [ackResearch, setAckResearch] = useState(false);
    const [ackTerms, setAckTerms] = useState(false);

    useEffect(() => {
        const fetchAckSetting = async () => {
            try {
                const { data } = await supabase
                    .from("app_settings" as any)
                    .select("value")
                    .eq("key", "require_research_acknowledgment")
                    .maybeSingle();
                if (data) {
                    setRequireResearchAck(data.value === "true");
                }
            } catch (err) {
                console.error("Error fetching require_research_acknowledgment setting:", err);
            }
        };
        fetchAckSetting();
    }, []);

    return (
        <div className="container py-12">
            <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>

            {items.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-muted-foreground mb-4">Your cart is empty.</p>
                    <Link to="/products">
                        <Button>Browse Products</Button>
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    <div className="lg:col-span-2 space-y-6">
                        {/* Cart Items */}
                        {items.map((item) => (
                            <div key={item.variant.id} className="flex gap-4 p-4 bg-card border rounded-lg">
                                <Link to={`/products/${item.variant.product.slug || item.variant.product_id}`} className="h-24 w-24 bg-muted rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden hover:opacity-80 transition-opacity">
                                    {(() => {
                                        const displayImage = item.variant.image_url || item.variant.product.image_url;
                                        return displayImage ? (
                                            <img src={displayImage} alt={item.variant.product.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-xs text-muted-foreground">No Image</span>
                                        );
                                    })()}
                                </Link>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <Link to={`/products/${item.variant.product.slug || item.variant.product_id}`} className="hover:underline">
                                                <h3 className="font-semibold">{item.variant.product.name}</h3>
                                            </Link>
                                            <p className="text-sm text-muted-foreground">
                                                {item.variant.vial_type.capacity_ml}ml{item.variant.vial_type.color ? ` - ${item.variant.vial_type.color}` : ''}{item.variant.vial_type.shape ? ` - ${item.variant.vial_type.shape}` : ''}
                                                {item.variant.pack_size > 1 && ` (${item.variant.pack_size}x Pack)`}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => removeFromCart(item.variant.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-4">{item.variant.product.category || "Product"}</p>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center border rounded-md">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-none"
                                                onClick={() => updateQuantity(item.variant.id, item.quantity - 1)}
                                            >
                                                <Minus className="h-3 w-3" />
                                            </Button>
                                            <span className="w-8 text-center text-sm">{item.quantity}</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-none"
                                                onClick={() => updateQuantity(item.variant.id, item.quantity + 1)}
                                            >
                                                <Plus className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <span className="font-bold">${(item.variant.price * item.quantity).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="lg:col-span-1">
                        <div className="bg-card border rounded-lg p-6 sticky top-24">
                            <h3 className="font-semibold text-lg mb-4">Order Summary</h3>
                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span>${cartTotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Shipping</span>
                                    <span>Calculated at checkout</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Tax</span>
                                    <span>$0.00</span>
                                </div>
                                <div className="border-t pt-3 flex justify-between font-bold">
                                    <span>Total</span>
                                    <span>${cartTotal.toFixed(2)}</span>
                                </div>
                            </div>
                            {requireResearchAck && (
                                <div className="mb-6 p-4 rounded-lg border-l-4 border-destructive bg-destructive/5 space-y-3 text-left shadow-sm">
                                    <div className="flex items-center gap-2 text-destructive font-semibold text-xs uppercase tracking-wider">
                                        <AlertTriangle className="h-4 w-4" />
                                        Research Use Only — Required Acknowledgment
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        By proceeding to checkout, you confirm that:
                                    </p>
                                    
                                    <div className="space-y-3">
                                        <div className="flex items-start space-x-2">
                                            <Checkbox 
                                                id="cart-ruo-ack" 
                                                checked={ackResearch} 
                                                onCheckedChange={(checked) => setAckResearch(checked === true)} 
                                                className="mt-1 flex-shrink-0"
                                            />
                                            <Label htmlFor="cart-ruo-ack" className="text-xs text-muted-foreground font-normal leading-normal cursor-pointer select-none">
                                                I am a qualified researcher, scientist, or institutional professional purchasing on behalf of a licensed research institution, laboratory, or organization. I understand that all products are exclusively for <strong>laboratory research use only (RUO)</strong> and are <strong>not approved or intended for use in humans or animals</strong>, nor for clinical, diagnostic, or therapeutic purposes.
                                            </Label>
                                        </div>

                                        <div className="flex items-start space-x-2">
                                            <Checkbox 
                                                id="cart-terms-ack" 
                                                checked={ackTerms} 
                                                onCheckedChange={(checked) => setAckTerms(checked === true)}
                                                className="mt-1 flex-shrink-0"
                                            />
                                            <Label htmlFor="cart-terms-ack" className="text-xs text-muted-foreground font-normal leading-normal cursor-pointer select-none">
                                                I have read and agree to the <Link to="/terms" target="_blank" className="text-primary hover:underline font-medium">Terms & Conditions</Link>.
                                            </Label>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {(!requireResearchAck || (ackResearch && ackTerms)) ? (
                                <Link to="/checkout">
                                    <Button className="w-full shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all font-semibold" size="lg">
                                        Proceed to Checkout <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            ) : (
                                <Button className="w-full cursor-not-allowed opacity-50 font-semibold" size="lg" disabled>
                                    Proceed to Checkout <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            )}
                            <p className="text-xs text-muted-foreground text-center mt-4">
                                Secure checkout powered by Square
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Cart;
