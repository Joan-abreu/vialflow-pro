import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState } from "react";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Factory, Loader2 } from "lucide-react";

interface OrderItem {
    id: string;
    order_id: string;
    product_id: string;
    variant_id: string;
    quantity: number;
    price_at_time: number;
    variant?: {
        id: string;
        product_id: string;
        vial_type_id: string;
        sku: string;
        sale_type: string;
        pack_size: number;
        image_url: string | null;
        product: {
            name: string;
            image_url: string | null;
        };
        vial_type: {
            name: string;
            size_ml: number;
        };
    };
}

interface Order {
    id: string;
    total_amount: number;
    status: string;
    created_at: string;
    user_id: string;
    customer_email: string;
    shipping_address: any;
    sent_to_production: boolean;
    sent_to_production_at: string | null;
    order_items?: OrderItem[];
}

const OrderManagement = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [showProductionDialog, setShowProductionDialog] = useState(false);
    const itemsPerPage = 10;
    const queryClient = useQueryClient();

    const { data: orders, isLoading, refetch } = useQuery({
        queryKey: ["admin-orders"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("orders" as any)
                .select(`
                    *,
                    order_items(
                        *,
                        variant:product_variants(
                            *,
                            product:products(name),
                            vial_type:vial_types(name, size_ml)
                        )
                    )
                `)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data as unknown as Order[];
        },
    });

    const filteredOrders = orders?.filter((order) => {
        const query = searchQuery.toLowerCase();
        return (
            order.id.toLowerCase().includes(query) ||
            (order.customer_email && order.customer_email.toLowerCase().includes(query)) ||
            order.status.toLowerCase().includes(query)
        );
    });

    const sendToProductionMutation = useMutation({
        mutationFn: async (order: Order) => {
            if (!order.order_items || order.order_items.length === 0) {
                throw new Error("No order items found");
            }

            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            // Group order items by variant_id
            const variantGroups = order.order_items.reduce((acc, item) => {
                if (!item.variant_id) return acc;

                if (!acc[item.variant_id]) {
                    acc[item.variant_id] = {
                        variant: item.variant,
                        totalQuantity: 0,
                        items: []
                    };
                }
                acc[item.variant_id].totalQuantity += item.quantity;
                acc[item.variant_id].items.push(item);
                return acc;
            }, {} as Record<string, { variant: any; totalQuantity: number; items: OrderItem[] }>);

            // Create production batches for each variant
            const batches = Object.entries(variantGroups).map(([variantId, group], index) => {
                const batchNumber = `ORD-${order.id.slice(0, 8)}-${index + 1}`;
                return {
                    batch_number: batchNumber,
                    product_id: group.variant.id,
                    variant_id: variantId,
                    sale_type: group.variant.sale_type,
                    pack_quantity: group.variant.pack_size,
                    quantity: group.totalQuantity * group.variant.pack_size,
                    status: 'pending',
                    order_id: order.id,
                    created_by: user.id,
                };
            });

            console.log("Attempting to create batches:", batches);

            // Insert batches
            const { error: batchError } = await supabase
                .from("production_batches")
                .insert(batches);

            if (batchError) throw batchError;

            // Update order status
            const { error: orderError } = await supabase
                .from("orders" as any)
                .update({
                    sent_to_production: true,
                    sent_to_production_at: new Date().toISOString(),
                    status: 'in_production'
                })
                .eq("id", order.id);

            if (orderError) throw orderError;

            return batches.length;
        },
        onSuccess: (batchCount) => {
            toast.success(`Successfully created ${batchCount} production batch${batchCount > 1 ? 'es' : ''}`);
            setShowProductionDialog(false);
            setSelectedOrder(null);
            refetch();
            queryClient.invalidateQueries({ queryKey: ["production-batches"] });
        },
        onError: (error: any) => {
            toast.error(`Failed to send to production: ${error.message}`);
        },
    });

    const handleStatusChange = async (orderId: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from("orders" as any)
                .update({ status: newStatus })
                .eq("id", orderId);

            if (error) throw error;

            toast.success("Order status updated");

            // Trigger email notification
            // Skip email for 'processing' (handled by webhook) and 'in_production' (internal)
            if (!["processing", "in_production"].includes(newStatus)) {
                try {
                    await supabase.functions.invoke("send-order-email", {
                        body: {
                            order_id: orderId,
                            type: "status_update"
                        }
                    });
                } catch (emailError) {
                    console.error("Failed to send email:", emailError);
                }
            }

            refetch();
        } catch (error: any) {
            toast.error("Failed to update status");
            console.error(error);
        }
    };

    const handleSendToProduction = (order: Order) => {
        setSelectedOrder(order);
        setShowProductionDialog(true);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "pending": return "bg-yellow-100 text-yellow-800";
            case "processing": return "bg-blue-100 text-blue-800";
            case "in_production": return "bg-purple-100 text-purple-800";
            case "shipped": return "bg-indigo-100 text-indigo-800";
            case "delivered": return "bg-green-100 text-green-800";
            case "cancelled": return "bg-red-100 text-red-800";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    // Group items by variant for display in dialog
    const getVariantGroups = (order: Order | null) => {
        if (!order?.order_items) return [];

        const groups = order.order_items.reduce((acc, item) => {
            if (!item.variant_id) return acc;

            if (!acc[item.variant_id]) {
                acc[item.variant_id] = {
                    variant: item.variant,
                    totalQuantity: 0,
                };
            }
            acc[item.variant_id].totalQuantity += item.quantity;
            return acc;
        }, {} as Record<string, { variant: any; totalQuantity: number }>);

        return Object.values(groups);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Order Management</h1>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Recent Orders</CardTitle>
                        <div className="relative w-72">
                            <input
                                type="text"
                                placeholder="Search orders..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1); // Reset to first page on search
                                }}
                                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Order ID</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead>Actions</TableHead>
                                <TableHead>Production</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8">
                                        Loading orders...
                                    </TableCell>
                                </TableRow>
                            ) : filteredOrders?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8">
                                        No orders found matching your search.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredOrders
                                    ?.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                    .map((order) => (
                                        <TableRow key={order.id}>
                                            <TableCell className="font-mono text-xs">{order.id.slice(0, 8)}...</TableCell>
                                            <TableCell>{format(new Date(order.created_at), "MMMM d, yyyy 'at' h:mm a")}</TableCell>
                                            <TableCell>
                                                <div className="text-sm">
                                                    {order.customer_email || "N/A"}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className={getStatusColor(order.status)}>
                                                    {order.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">${order.total_amount.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Select
                                                    defaultValue={order.status}
                                                    onValueChange={(value) => handleStatusChange(order.id, value)}
                                                >
                                                    <SelectTrigger className="w-[130px] h-8">
                                                        <SelectValue placeholder="Status" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="pending">Pending</SelectItem>
                                                        <SelectItem value="processing">Processing</SelectItem>
                                                        <SelectItem value="in_production">In Production</SelectItem>
                                                        <SelectItem value="shipped">Shipped</SelectItem>
                                                        <SelectItem value="delivered">Delivered</SelectItem>
                                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                {order.sent_to_production ? (
                                                    <Badge variant="outline" className="bg-green-50 text-green-700">
                                                        ✓ Sent {order.sent_to_production_at && `on ${format(new Date(order.sent_to_production_at), "MMM d")}`}
                                                    </Badge>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleSendToProduction(order)}
                                                    >
                                                        <Factory className="h-4 w-4 mr-2" />
                                                        Send to Production
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                            )}
                        </TableBody>
                    </Table>
                    {!isLoading && filteredOrders && filteredOrders.length > 0 && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={Math.ceil(filteredOrders.length / itemsPerPage)}
                            onPageChange={setCurrentPage}
                        />
                    )}
                </CardContent>
            </Card>

            {/* Send to Production Dialog */}
            <Dialog open={showProductionDialog} onOpenChange={setShowProductionDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Send Order to Production</DialogTitle>
                        <DialogDescription>
                            This will create production batches for order #{selectedOrder?.id.slice(0, 8)}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm font-medium text-blue-900">
                                {getVariantGroups(selectedOrder).length} production batch{getVariantGroups(selectedOrder).length > 1 ? 'es' : ''} will be created:
                            </p>
                        </div>

                        <div className="space-y-2">
                            {getVariantGroups(selectedOrder).map((group, index) => (
                                <div key={index} className="border rounded-lg p-3 bg-gray-50">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="h-12 w-12 bg-muted rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                                                {(() => {
                                                    const displayImage = group.variant?.image_url || group.variant?.product?.image_url;
                                                    return displayImage ? (
                                                        <img
                                                            src={displayImage}
                                                            alt={group.variant?.product?.name}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <Factory className="h-6 w-6 text-muted-foreground" />
                                                    );
                                                })()}
                                            </div>
                                            <div>
                                                <p className="font-medium">
                                                    {group.variant?.product?.name || "Unknown Product"}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {group.variant?.vial_type?.size_ml}ml
                                                    {group.variant?.pack_size && group.variant.pack_size > 1 ? ` (${group.variant.pack_size}x Pack)` : ''}
                                                    {group.variant?.sale_type === 'pack' ? ' - Pack' : ' - Individual'}
                                                </p>
                                            </div>
                                        </div>
                                        <Badge variant="secondary">
                                            Qty: {group.totalQuantity}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowProductionDialog(false)}
                            disabled={sendToProductionMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => selectedOrder && sendToProductionMutation.mutate(selectedOrder)}
                            disabled={sendToProductionMutation.isPending}
                        >
                            {sendToProductionMutation.isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Create Production Batches
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default OrderManagement;
