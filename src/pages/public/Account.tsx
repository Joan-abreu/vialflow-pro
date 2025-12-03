import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { User, Package, Settings, ChevronDown, ChevronUp } from "lucide-react";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Order {
    id: string;
    total_amount: number;
    status: string;
    created_at: string;
    order_items: {
        id: string;
        quantity: number;
        price_at_time: number;
        variant?: {
            image_url: string | null;
            pack_size: number;
            product: {
                name: string;
                image_url: string | null;
            };
            vial_type: {
                name: string;
                size_ml: number;
            };
        };
    }[];
}

const Account = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [updating, setUpdating] = useState(false);
    const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

    useEffect(() => {
        checkUser();
        fetchOrders();
    }, []);

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            navigate("/login");
            return;
        }

        setUser(user);

        // Fetch profile
        const { data: profileData } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", user.id)
            .single();

        setProfile(profileData);
        setFullName(profileData?.full_name || "");
        setPhone(profileData?.phone || "");
        setLoading(false);
    };

    const fetchOrders = async () => {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return;

        const { data, error } = await supabase
            .from("orders" as any)
            .select(`
                *,
                order_items (
                    id,
                    quantity,
                    price_at_time,
                    variant:product_variants (
                        image_url,
                        pack_size,
                        product:products (
                            name,
                            image_url
                        ),
                        vial_type:vial_types (
                            name,
                            size_ml
                        )
                    )
                )
            `)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        if (!error && data) {
            setOrders(data as unknown as Order[]);
        }
    };

    const handleUpdateProfile = async () => {
        setUpdating(true);
        try {
            const { error } = await supabase
                .from("profiles")
                .update({ full_name: fullName, phone: phone } as any)
                .eq("user_id", user.id);

            if (error) throw error;

            toast.success("Profile updated successfully");
            setProfile({ ...profile, full_name: fullName, phone: phone });
        } catch (error: any) {
            toast.error("Failed to update profile");
            console.error(error);
        } finally {
            setUpdating(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "pending": return "bg-yellow-100 text-yellow-800";
            case "processing": return "bg-blue-100 text-blue-800";
            case "shipped": return "bg-purple-100 text-purple-800";
            case "delivered": return "bg-green-100 text-green-800";
            case "cancelled": return "bg-red-100 text-red-800";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    const toggleOrderExpand = (orderId: string) => {
        const newExpanded = new Set(expandedOrders);
        if (newExpanded.has(orderId)) {
            newExpanded.delete(orderId);
        } else {
            newExpanded.add(orderId);
        }
        setExpandedOrders(newExpanded);
    };

    if (loading) {
        return (
            <div className="container py-12 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="container py-12">
            <h1 className="text-3xl font-bold mb-8">My Account</h1>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Profile Section */}
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            Profile
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label className="text-sm text-muted-foreground">Email</Label>
                            <p className="font-medium">{user?.email}</p>
                        </div>
                        <div>
                            <Label className="text-sm text-muted-foreground">Full Name</Label>
                            <p className="font-medium">{profile?.full_name || "Not set"}</p>
                        </div>
                        <div>
                            <Label className="text-sm text-muted-foreground">Phone</Label>
                            <p className="font-medium">{profile?.phone || "Not set"}</p>
                        </div>
                        <div>
                            <Label className="text-sm text-muted-foreground">Member Since</Label>
                            <p className="font-medium">
                                {user?.created_at ? format(new Date(user.created_at), "MMMM yyyy") : "-"}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Account Settings */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Settings className="h-5 w-5" />
                            Account Settings
                        </CardTitle>
                        <CardDescription>Update your account information</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="fullName">Full Name</Label>
                            <Input
                                id="fullName"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Enter your full name"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number</Label>
                            <Input
                                id="phone"
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+1 (555) 000-0000"
                            />
                        </div>
                        <Button onClick={handleUpdateProfile} disabled={updating}>
                            {updating ? "Updating..." : "Update Profile"}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <Separator className="my-8" />

            {/* Order History */}
            <div>
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                    <Package className="h-6 w-6" />
                    Order History
                </h2>

                {orders.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">No orders yet</p>
                            <Button className="mt-4" onClick={() => navigate("/products")}>
                                Start Shopping
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {orders.map((order) => (
                            <Card key={order.id}>
                                <Collapsible>
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-1">
                                                <CardTitle className="text-lg">
                                                    Order #{order.id.slice(0, 8)}
                                                </CardTitle>
                                                <CardDescription>
                                                    {format(new Date(order.created_at), "MMMM d, yyyy 'at' h:mm a")}
                                                </CardDescription>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <Badge variant="secondary" className={getStatusColor(order.status)}>
                                                    {order.status}
                                                </Badge>
                                                <div className="text-right">
                                                    <p className="text-sm text-muted-foreground">Total</p>
                                                    <p className="text-lg font-bold">${order.total_amount.toFixed(2)}</p>
                                                </div>
                                                <CollapsibleTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => toggleOrderExpand(order.id)}
                                                    >
                                                        {expandedOrders.has(order.id) ? (
                                                            <ChevronUp className="h-4 w-4" />
                                                        ) : (
                                                            <ChevronDown className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </CollapsibleTrigger>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CollapsibleContent>
                                        <CardContent>
                                            <div className="space-y-3">
                                                <h4 className="font-semibold text-sm">Order Items:</h4>
                                                {order.order_items.map((item) => {
                                                    const variant = item.variant;
                                                    const product = variant?.product;
                                                    const displayImage = variant?.image_url || product?.image_url;

                                                    return (
                                                        <div key={item.id} className="flex items-center gap-4 py-2 border-b last:border-0">
                                                            <div className="h-16 w-16 bg-muted rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                                                                {displayImage ? (
                                                                    <img
                                                                        src={displayImage}
                                                                        alt={product?.name || "Product"}
                                                                        className="h-full w-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <Package className="h-6 w-6 text-muted-foreground" />
                                                                )}
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className="font-medium">{product?.name || "Unknown Product"}</p>
                                                                <p className="text-sm text-muted-foreground">
                                                                    {variant?.vial_type?.size_ml}ml
                                                                    {variant?.pack_size && variant.pack_size > 1 ? ` (${variant.pack_size}x Pack)` : ''}
                                                                </p>
                                                                <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                                                            </div>
                                                            <p className="font-medium">${item.price_at_time.toFixed(2)}</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </CardContent>
                                    </CollapsibleContent>
                                </Collapsible>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Account;
