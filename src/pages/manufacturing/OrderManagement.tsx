import { useQuery } from "@tanstack/react-query";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState } from "react";
import { DataTablePagination } from "@/components/shared/DataTablePagination";

interface Order {
    id: string;
    total_amount: number;
    status: string;
    created_at: string;
    user_id: string;
    shipping_address: any;
}

const OrderManagement = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const { data: orders, isLoading, refetch } = useQuery({
        queryKey: ["admin-orders"],
        queryFn: async () => {
            // Using "any" cast for table name as it might not be generated in types yet
            const { data, error } = await supabase
                .from("orders" as any)
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            if (error) throw error;
            return data as unknown as Order[];
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

            refetch();
        } catch (error: any) {
            toast.error("Failed to update status");
            console.error(error);
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

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Order Management</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Orders</CardTitle>
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
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">
                                        Loading orders...
                                    </TableCell>
                                </TableRow>
                            ) : orders?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">
                                        No orders found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                orders
                                    ?.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                    .map((order) => (
                                        <TableRow key={order.id}>
                                            <TableCell className="font-mono text-xs">{order.id.slice(0, 8)}...</TableCell>
                                            <TableCell>{format(new Date(order.created_at), "MMM d, yyyy")}</TableCell>
                                            <TableCell>{order.user_id ? "Registered User" : "Guest"}</TableCell>
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
                                                        <SelectItem value="shipped">Shipped</SelectItem>
                                                        <SelectItem value="delivered">Delivered</SelectItem>
                                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                        </TableRow>
                                    ))
                            )}
                        </TableBody>
                    </Table>
                    {!isLoading && orders && orders.length > 0 && (
                        <DataTablePagination
                            currentPage={currentPage}
                            totalPages={Math.ceil(orders.length / itemsPerPage)}
                            onPageChange={setCurrentPage}
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default OrderManagement;
