import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { Printer, Search, Download, ExternalLink, Package } from "lucide-react";
import { toast } from "sonner";
import CopyCell from "@/components/CopyCell";
import { Link } from "react-router-dom";

interface OrderShipment {
    id: string;
    order_id: string;
    carrier: string;
    service_code: string;
    tracking_number: string;
    label_url: string;
    status: string;
    weight: number;
    weight_unit: string;
    length: number;
    width: number;
    height: number;
    dimension_unit: string;
    total_cost?: number;
    carrier_response?: any;
    created_at: string;
    metadata: any;
    ship_to: any;
    orders?: {
        created_at: string;
    };
}

export default function OrderLabels() {
    const [labels, setLabels] = useState<OrderShipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const fetchLabels = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("order_shipments")
                .select(`
                    id,
                    order_id,
                    carrier,
                    service_code,
                    tracking_number,
                    label_url,
                    status,
                    weight,
                    weight_unit,
                    length,
                    width,
                    height,
                    dimension_unit,
                    total_cost,
                    created_at,
                    metadata,
                    carrier_response,
                    ship_to,
                    orders(created_at)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setLabels(data || []);
        } catch (error: any) {
            console.error("Error fetching labels:", error);
            toast.error("Failed to load shipping labels");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLabels();
    }, []);

    const markAsPrinted = async (shipment: OrderShipment) => {
        const currentMetadata = shipment.metadata || {};
        const newMetadata = {
            ...currentMetadata,
            printed_at: new Date().toISOString()
        };

        try {
            const { error } = await supabase
                .from("order_shipments")
                .update({ metadata: newMetadata })
                .eq("id", shipment.id);

            if (error) throw error;
            // Optimistic UI update
            setLabels(prev => 
                prev.map(l => l.id === shipment.id ? { ...l, metadata: newMetadata } : l)
            );
        } catch (error) {
            console.error("Failed to update print status:", error);
        }
    };

    const handleDownloadLabel = (shipment: OrderShipment) => {
        if (!shipment.label_url && !shipment.metadata?.labelData) {
            toast.error("No valid label URL found");
            return;
        }

        const url = shipment.label_url || `data:application/pdf;base64,${shipment.metadata?.labelData}`;
        window.open(url, "_blank", "noopener,noreferrer");

        markAsPrinted(shipment);
    };

    const filteredLabels = labels.filter((label) => {
        const query = searchQuery.toLowerCase();
        const shortOrderId = label.order_id?.slice(0, 8) || "";
        const tracking = label.tracking_number?.toLowerCase() || "";
        const customerName = (label.ship_to?.name || label.ship_to?.full_name || "").toLowerCase();

        return (
            shortOrderId.includes(query) ||
            tracking.includes(query) ||
            customerName.includes(query) ||
            label.carrier.toLowerCase().includes(query)
        );
    });

    const getStatusVariant = (status: string) => {
        switch (status.toLowerCase()) {
            case "delivered":
                return "default";
            case "shipped":
            case "transit":
            case "in_transit":
                return "secondary";
            case "label_created":
                return "outline";
            default:
                return "secondary";
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Order Labels 📦</h1>
                    <p className="text-muted-foreground mt-2">
                        View and manage shipping labels generated for customer orders.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between space-y-0 pb-4">
                    <CardTitle>Shipping Labels Directory</CardTitle>
                    <div className="flex items-center gap-2 w-full md:w-96">
                        <Search className="w-4 h-4 text-muted-foreground ml-2 absolute" />
                        <Input
                            placeholder="Search by Order ID, Tracking # or Customer"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full pl-8"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <span className="text-muted-foreground text-sm">Loading labels...</span>
                        </div>
                    ) : filteredLabels.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Package className="h-10 w-10 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium">No shipping labels found</h3>
                            <p className="text-sm text-muted-foreground mt-1 max-w-md">
                                {searchQuery ? "No labels match your search criteria." : "There are currently no generated shipping labels."}
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead>Created Date</TableHead>
                                        <TableHead>Order #</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Carrier & Cost</TableHead>
                                        <TableHead>Dimensions / Weight</TableHead>
                                        <TableHead>Tracking</TableHead>
                                        <TableHead align="center">Print Status</TableHead>
                                        <TableHead align="right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredLabels
                                        .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                        .map((label) => (
                                            <TableRow key={label.id}>
                                                <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                                                    {format(new Date(label.created_at), "MMM d, yy p")}
                                                </TableCell>
                                                <TableCell className="font-mono text-sm font-medium">
                                                    {label.order_id ? label.order_id.slice(0, 8) : "N/A"}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-medium text-sm">
                                                        {label.ship_to?.name || label.ship_to?.full_name || "Unknown"}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1.5 items-start">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline" className="font-mono text-[10px]">
                                                                {label.carrier}
                                                            </Badge>
                                                            <span className="text-xs text-muted-foreground truncate max-w-[100px]" title={label.service_code}>
                                                                {label.service_code}
                                                            </span>
                                                        </div>
                                                        {(() => {
                                                            const cost = label.total_cost || label.carrier_response?.rate?.amount || label.carrier_response?.shippingCost || label.metadata?.rateAmount || null;
                                                            return cost ? (
                                                                <Badge variant="secondary" className="text-[10px] font-medium bg-green-50 text-green-700 hover:bg-green-100 border-green-200">
                                                                    ${parseFloat(cost).toFixed(2)}
                                                                </Badge>
                                                            ) : null;
                                                        })()}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {label.weight} {label.weight_unit || 'LBS'} <span className="opacity-50 mx-1">|</span> {label.length}x{label.width}x{label.height} {label.dimension_unit || "IN"}
                                                </TableCell>
                                                <TableCell>
                                                    {label.tracking_number ? (
                                                        <div className="flex items-center gap-1.5 border px-2 py-1 rounded bg-muted/20 w-fit">
                                                            <span className="font-mono text-xs">{label.tracking_number}</span>
                                                            <CopyCell value={label.tracking_number} size={12} />
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs italic">N/A</span>
                                                    )}
                                                    <div className="mt-1.5">
                                                        <Badge variant={getStatusVariant(label.status)} className="capitalize text-[10px]">
                                                            {label.status.replace(/_/g, " ")}
                                                        </Badge>
                                                    </div>
                                                </TableCell>
                                                <TableCell align="center">
                                                    {label.metadata?.printed_at ? (
                                                        <div className="flex flex-col items-center gap-1">
                                                            <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-[10px] w-fit">
                                                                Printed
                                                            </Badge>
                                                            <span className="text-[10px] text-muted-foreground font-medium">
                                                                {format(new Date(label.metadata.printed_at), "MMM d, p")}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="text-orange-500 border-orange-200 bg-orange-50 text-[10px] w-fit">
                                                            Not Printed
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="h-8 group hover:bg-primary/10 hover:text-primary"
                                                        onClick={() => handleDownloadLabel(label)}
                                                    >
                                                        {label.metadata?.printed_at ? (
                                                            <><Printer className="h-4 w-4 mr-2" /> Reprint</>
                                                        ) : (
                                                            <><Download className="h-4 w-4 mr-2" /> Print</>
                                                        )}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    }
                                </TableBody>
                            </Table>
                        </div>
                    )}
                    
                    {!loading && filteredLabels.length > 0 && (
                        <div className="mt-4">
                            <DataTablePagination
                                currentPage={currentPage}
                                totalPages={Math.ceil(filteredLabels.length / itemsPerPage)}
                                onPageChange={setCurrentPage}
                                totalItems={filteredLabels.length}
                                pageSize={itemsPerPage}
                                onPageSizeChange={(size) => {
                                    setItemsPerPage(size);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
