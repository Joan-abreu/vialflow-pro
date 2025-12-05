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
import { Factory, Loader2, Eye, Tag } from "lucide-react";

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
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);
    const [showProductionDialog, setShowProductionDialog] = useState(false);
    const queryClient = useQueryClient();
    const itemsPerPage = 10;

    const { data: orders, isLoading } = useQuery({
        queryKey: ["orders"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("orders")
                .select(`
                    *,
                    order_items (
                        *,
                        variant:product_variants (
                            *,
                            product:products (*),
                            vial_type:vial_types (*)
                        )
                    )
                `)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data as any as Order[];
        },
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
            const { error } = await supabase
                .from("orders")
                .update({ status })
                .eq("id", orderId);

            if (error) throw error;

            if (status !== 'processing' && status !== 'in_production') {
                await supabase.functions.invoke("send-order-email", {
                    body: { orderId, type: "status_update" },
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            toast.success("Order status updated");
        },
        onError: (error) => {
            toast.error("Failed to update status: " + error.message);
        },
    });

    const sendToProductionMutation = useMutation({
        mutationFn: async (order: Order) => {
            // This is where we would ideally create production batches
            // For now, we'll mark the order as sent to production
            const { error } = await supabase
                .from("orders")
                .update({
                    sent_to_production: true,
                    sent_to_production_at: new Date().toISOString(),
                    status: 'in_production'
                })
                .eq("id", order.id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            setShowProductionDialog(false);
            toast.success("Order sent to production");
        },
        onError: (error) => {
            toast.error("Failed to send to production: " + error.message);
        },
    });

    const handleStatusChange = (orderId: string, status: string) => {
        updateStatusMutation.mutate({ orderId, status });
    };

    const handleViewDetails = (order: Order) => {
        setSelectedOrder(order);
        setShowDetailsDialog(true);
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

    const getVariantGroups = (order: Order | null) => {
        if (!order || !order.order_items) return [];
        const groups: Record<string, { variant: any, totalQuantity: number }> = {};

        order.order_items.forEach(item => {
            if (!item.variant) return;
            const key = item.variant_id;
            if (!groups[key]) {
                groups[key] = { variant: item.variant, totalQuantity: 0 };
            }
            groups[key].totalQuantity += item.quantity;
        });

        return Object.values(groups);
    };

    const filteredOrders = orders?.filter((order) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            order.id.toLowerCase().includes(query) ||
            order.customer_email.toLowerCase().includes(query) ||
            order.status.toLowerCase().includes(query)
        );
    });

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
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleViewDetails(order)}
                                                        title="View Details"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
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
                                                </div>
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

            <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Order Details</DialogTitle>
                        <DialogDescription>
                            Order #{selectedOrder?.id}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedOrder && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h4 className="font-semibold text-sm text-muted-foreground mb-1">Customer Info</h4>
                                    <p className="text-sm">{selectedOrder.customer_email}</p>
                                    {selectedOrder.shipping_address && (
                                        <div className="mt-2 text-sm text-muted-foreground">
                                            <p>{selectedOrder.shipping_address.line1}</p>
                                            <p>{selectedOrder.shipping_address.city}, {selectedOrder.shipping_address.state} {selectedOrder.shipping_address.postal_code}</p>
                                            <p>{selectedOrder.shipping_address.country}</p>
                                        </div>
                                    )}
                                </div>
                                <div className="text-right">
                                    <h4 className="font-semibold text-sm text-muted-foreground mb-1">Order Status</h4>
                                    <Badge variant="secondary" className={getStatusColor(selectedOrder.status)}>
                                        {selectedOrder.status}
                                    </Badge>
                                    <p className="text-sm text-muted-foreground mt-2">
                                        Date: {format(new Date(selectedOrder.created_at), "PPP p")}
                                    </p>
                                </div>
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead>Product</TableHead>
                                            <TableHead>SKU</TableHead>
                                            <TableHead className="text-right">Price</TableHead>
                                            <TableHead className="text-center">Qty</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedOrder.order_items?.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded bg-muted overflow-hidden flex-shrink-0">
                                                            {item.variant?.product?.image_url || item.variant?.image_url ? (
                                                                <img
                                                                    src={item.variant?.product?.image_url || item.variant?.image_url || ""}
                                                                    alt={item.variant?.product?.name}
                                                                    className="h-full w-full object-cover"
                                                                />
                                                            ) : (
                                                                <div className="h-full w-full flex items-center justify-center bg-gray-100">
                                                                    <Tag className="h-4 w-4 text-gray-400" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-sm">{item.variant?.product?.name}</div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {item.variant?.vial_type?.name} ({item.variant?.vial_type?.size_ml}ml)
                                                                {item.variant?.sale_type === 'pack' ? ` - Pack of ${item.variant?.pack_size}` : ''}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">{item.variant?.sku || "N/A"}</TableCell>
                                                <TableCell className="text-right">${item.price_at_time.toFixed(2)}</TableCell>
                                                <TableCell className="text-center">{item.quantity}</TableCell>
                                                <TableCell className="text-right font-medium">
                                                    ${(item.price_at_time * item.quantity).toFixed(2)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="flex justify-end">
                                <div className="w-1/3 space-y-2">
                                    <div className="flex justify-between border-t pt-4">
                                        <span className="font-bold text-lg">Total</span>
                                        <span className="font-bold text-lg">${selectedOrder.total_amount.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setShowDetailsDialog(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
