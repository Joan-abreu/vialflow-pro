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
import { Input } from "@/components/ui/input";
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
import { Factory, Loader2, Eye, Tag, Truck, Search, Package } from "lucide-react";
import { MultiCarrierShippingDialog } from "@/components/shipping/MultiCarrierShippingDialog";

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
    tracking_number?: string | null;
    order_items?: OrderItem[];
    order_shipments?: {
        carrier: string;
        tracking_number: string;
        tracking_url: string;
        label_url: string;
        status: string;
        pickup_confirmation?: string;
    }[];
}

const OrderManagement = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);
    const [showProductionDialog, setShowProductionDialog] = useState(false);
    const [showShippingDialog, setShowShippingDialog] = useState(false);
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
                    ),
                    order_shipments (*)
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

            if (status !== 'processing' && status !== 'in_production' && status !== 'ready_to_ship' && status !== 'label_created' && status !== 'pickup_scheduled') {
                await supabase.functions.invoke("send-order-email", {
                    body: { order_id: orderId, type: "status_update" },
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
            const variantGroups = getVariantGroups(order);
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) throw new Error("User not authenticated");

            // Create production batches for each variant group
            const batchInserts = variantGroups.map((group, index) => ({
                batch_number: `ORD-${order.id.slice(0, 8)}-${index + 1}`,
                product_id: group.variant.id,
                quantity: group.totalQuantity * group.variant.pack_size,
                sale_type: group.variant.sale_type,
                pack_quantity: group.variant.sale_type === 'pack' ? group.variant.pack_size : null,
                status: 'pending',
                order_id: order.id,
                created_by: user.id
            }));

            const { error: batchError } = await supabase
                .from("production_batches")
                .insert(batchInserts);

            if (batchError) throw batchError;

            // Mark the order as sent to production
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

    const handleCreateShippingLabel = (order: Order) => {
        setSelectedOrder(order);
        setShowShippingDialog(true);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "pending": return "bg-gray-100 text-gray-800";
            case "pending_payment": return "bg-yellow-100 text-yellow-800";
            case "processing": return "bg-blue-100 text-blue-800";
            case "in_production": return "bg-purple-100 text-purple-800";
            case "ready_to_ship": return "bg-orange-100 text-orange-800";
            case "label_created": return "bg-cyan-100 text-cyan-800";
            case "pickup_scheduled": return "bg-teal-100 text-teal-800";
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
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <CardTitle>Recent Orders</CardTitle>
                        <div className="flex items-center gap-2 w-full md:w-72">
                            <Search className="w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search orders..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1); // Reset to first page on search
                                }}
                                className="w-full"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
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
                                <TableHead>Shipping</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8">
                                        Loading orders...
                                    </TableCell>
                                </TableRow>
                            ) : filteredOrders?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8">
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
                                                    {order.status.replace(/_/g, " ")}
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
                                                        value={order.status}
                                                        onValueChange={(value) => handleStatusChange(order.id, value)}
                                                    >
                                                        <SelectTrigger className="w-[170px] h-8">
                                                            <SelectValue placeholder="Status" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="pending_payment">Pending Payment</SelectItem>
                                                            <SelectItem value="processing">Processing</SelectItem>
                                                            <SelectItem value="in_production">In Production</SelectItem>
                                                            <SelectItem value="ready_to_ship">Ready to Ship</SelectItem>
                                                            <SelectItem value="label_created">Label Created</SelectItem>
                                                            <SelectItem value="pickup_scheduled">Pickup Scheduled</SelectItem>
                                                            <SelectItem value="shipped">Shipped</SelectItem>
                                                            <SelectItem value="delivered">Delivered</SelectItem>
                                                            <SelectItem value="cancelled">Cancelled</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {order.status === 'in_production' ? (
                                                    <Button
                                                        size="sm"
                                                        variant="default"
                                                        className="bg-green-600 hover:bg-green-700 text-white"
                                                        onClick={() => handleStatusChange(order.id, 'ready_to_ship')}
                                                    >
                                                        <Package className="h-4 w-4 mr-2" />
                                                        Complete Production
                                                    </Button>
                                                ) : order.sent_to_production ? (
                                                    <Badge variant="outline" className="bg-green-50 text-green-700">
                                                        ✓ Sent {order.sent_to_production_at && `on ${format(new Date(order.sent_to_production_at), "MMM d")}`}
                                                    </Badge>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleSendToProduction(order)}
                                                        disabled={order.status !== 'processing'}
                                                        title={order.status !== 'processing' ? "Order must be Processing to send to production" : ""}
                                                    >
                                                        <Factory className="h-4 w-4 mr-2" />
                                                        Send to Production
                                                    </Button>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-2">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleCreateShippingLabel(order)}
                                                        disabled={!['ready_to_ship', 'label_created', 'pickup_scheduled', 'shipped'].includes(order.status)}
                                                        variant={['label_created', 'pickup_scheduled', 'shipped'].includes(order.status) ? "secondary" : "outline"}
                                                        title={!['ready_to_ship', 'label_created', 'pickup_scheduled', 'shipped'].includes(order.status) ? "Complete production first" : ""}
                                                    >
                                                        <Truck className="h-4 w-4 mr-2" />
                                                        {['label_created', 'pickup_scheduled', 'shipped'].includes(order.status) ? "Manage Shipping" : "Create Label"}
                                                    </Button>

                                                    {order.order_shipments && order.order_shipments.filter(s => s.status !== 'cancelled').length > 0 && (
                                                        <div className="flex flex-col gap-1 text-xs">
                                                            {order.order_shipments
                                                                .filter(s => s.status !== 'cancelled')
                                                                .map((shipment, idx) => (
                                                                    <div key={idx} className="flex flex-col items-start gap-1">
                                                                        <div className="flex items-center gap-1">
                                                                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{shipment.carrier}</Badge>
                                                                            {shipment.tracking_url ? (
                                                                                <a
                                                                                    href={shipment.tracking_url}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className="text-blue-600 hover:underline flex items-center gap-1"
                                                                                >
                                                                                    {shipment.tracking_number}
                                                                                    <Eye className="h-3 w-3" />
                                                                                </a>
                                                                            ) : (
                                                                                <span className="text-muted-foreground">{shipment.tracking_number}</span>
                                                                            )}
                                                                        </div>
                                                                        {shipment.pickup_confirmation && (
                                                                            <div className="flex items-center gap-1">
                                                                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-teal-50 text-teal-700 border-teal-200">
                                                                                    Pickup #: {shipment.pickup_confirmation}
                                                                                </Badge>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    )}
                                                </div>
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

            <MultiCarrierShippingDialog
                orderId={selectedOrder?.id || ""}
                open={showShippingDialog}
                onOpenChange={setShowShippingDialog}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["orders"] });
                }}
            />
        </div>
    );
};

export default OrderManagement;
