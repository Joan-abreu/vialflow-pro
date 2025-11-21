import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CreditCard, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";

interface StripeCheckoutProps {
    amount: number;
    onSuccess: () => void;
}

const StripeCheckout = ({ amount, onSuccess }: StripeCheckoutProps) => {
    const [loading, setLoading] = useState(false);
    const [cardNumber, setCardNumber] = useState("");
    const [expiry, setExpiry] = useState("");
    const [cvc, setCvc] = useState("");
    const { items, clearCart } = useCart();

    const handlePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 1. Simulate Stripe Payment
            if (cardNumber.length < 16) {
                throw new Error("Invalid card number");
            }

            // Simulate processing delay
            await new Promise(resolve => setTimeout(resolve, 1500));

            // 2. Create Order in Supabase
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                throw new Error("You must be logged in to place an order");
            }

            const { data: order, error: orderError } = await supabase
                .from("orders" as any)
                .insert({
                    user_id: user.id,
                    total_amount: amount,
                    status: "processing",
                    shipping_address: {
                        // Mock address for now, ideally passed from parent
                        line1: "123 Main St",
                        city: "New York",
                        state: "NY",
                        postal_code: "10001",
                        country: "US"
                    }
                })
                .select()
                .single();

            if (orderError) throw orderError;

            const orderData = order as any;

            // 3. Create Order Items
            const orderItems = items.map(item => ({
                order_id: orderData.id,
                product_id: item.variant.product_id,
                variant_id: item.variant.id,
                quantity: item.quantity,
                price_at_time: item.variant.price
            }));

            const { error: itemsError } = await supabase
                .from("order_items" as any)
                .insert(orderItems);

            if (itemsError) throw itemsError;

            // 4. Trigger Email Notification
            try {
                await supabase.functions.invoke("send-order-email", {
                    body: {
                        order_id: orderData.id,
                        type: "confirmation"
                    }
                });
            } catch (emailError) {
                console.error("Failed to send email:", emailError);
                // Don't fail the order if email fails, just log it
            }

            toast.success("Payment successful! Order placed.");
            onSuccess();

        } catch (error: any) {
            console.error("Payment error:", error);
            toast.error(error.message || "Payment failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Payment Details</CardTitle>
                <CardDescription>Enter your card information to complete the purchase.</CardDescription>
            </CardHeader>
            <form onSubmit={handlePayment}>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="card-number">Card Number</Label>
                        <div className="relative">
                            <CreditCard className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="card-number"
                                placeholder="0000 0000 0000 0000"
                                className="pl-9"
                                value={cardNumber}
                                onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                                required
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="expiry">Expiry Date</Label>
                            <Input
                                id="expiry"
                                placeholder="MM/YY"
                                value={expiry}
                                onChange={(e) => setExpiry(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cvc">CVC</Label>
                            <Input
                                id="cvc"
                                placeholder="123"
                                maxLength={3}
                                value={cvc}
                                onChange={(e) => setCvc(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <div className="pt-4">
                        <div className="flex justify-between text-sm font-medium">
                            <span>Total Amount</span>
                            <span>${amount.toFixed(2)}</span>
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button className="w-full" type="submit" disabled={loading}>
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            `Pay $${amount.toFixed(2)}`
                        )}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
};

export default StripeCheckout;
