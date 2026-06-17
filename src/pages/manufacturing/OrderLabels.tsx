import { useEffect, useState, useMemo } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { Printer, Search, Download, ExternalLink, Package, Truck } from "lucide-react";
import { toast } from "sonner";
import CopyCell from "@/components/CopyCell";
import { Link } from "react-router-dom";

interface OrderShipment {
    id: string;
    order_id: string;
    carrier: string;
    service_code: string;
    service_name?: string;
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
    pickup_confirmation?: string;
    pickup_date?: string;
    pickup_ready_time?: string;
    pickup_close_time?: string;
    orders?: {
        created_at: string;
        shipping_service?: string;
    };
}

interface GroupedPickup {
    confirmationNumber: string;
    carrier: string;
    date: string;
    readyTime: string;
    closeTime: string;
    shipments: OrderShipment[];
}

export default function OrderLabels() {
    const [labels, setLabels] = useState<OrderShipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [activeTab, setActiveTab] = useState<"labels" | "pickups">("labels");

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
                    service_name,
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
                    pickup_confirmation,
                    pickup_date,
                    pickup_ready_time,
                    pickup_close_time,
                    orders(created_at, shipping_service)
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

    const formatServiceLevel = (code: string) => {
        if (!code) return "Unknown Service";
        
        // If it's a raw Shippo Rate ID (32 hex characters), hide the hash
        if (/^[a-fA-F0-9]{32}$/.test(code)) {
            return "Standard Service";
        }

        const mapped: Record<string, string> = {
            'usps_ground_advantage': 'USPS Ground Advantage',
            'usps_priority': 'USPS Priority Mail',
            'usps_priority_express': 'USPS Priority Mail Express',
            'ups_ground': 'UPS Ground',
            'ups_next_day_air': 'UPS Next Day Air',
            'fedex_ground': 'FedEx Ground',
            'fedex_home_delivery': 'FedEx Home Delivery'
        };
        // Fallback: usps_something -> USPS Something
        return mapped[code.toLowerCase()] || 
            code.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    const formatPickupDate = (dateStr: string) => {
        if (!dateStr) return "N/A";
        if (/^\d{8}$/.test(dateStr)) {
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            try {
                return format(new Date(`${year}-${month}-${day}T12:00:00`), 'PPP');
            } catch (e) {
                return `${year}-${month}-${day}`;
            }
        }
        try {
            const date = dateStr.includes('T') ? new Date(dateStr) : new Date(`${dateStr}T12:00:00`);
            return format(date, 'PPP');
        } catch (e) {
            return dateStr;
        }
    };

    const formatPickupTime = (timeStr: string) => {
        if (!timeStr) return "N/A";
        if (timeStr.includes('T')) {
            try {
                return format(new Date(timeStr), 'p');
            } catch (e) {
                return timeStr;
            }
        }
        return timeStr;
    };

    const groupedPickups = useMemo(() => {
        const groups: Record<string, GroupedPickup> = {};
        
        labels.forEach(label => {
            if (label.pickup_confirmation) {
                const key = `${label.carrier}_${label.pickup_confirmation}_${label.pickup_date || ''}`;
                if (!groups[key]) {
                    groups[key] = {
                        confirmationNumber: label.pickup_confirmation,
                        carrier: label.carrier,
                        date: label.pickup_date || "",
                        readyTime: label.pickup_ready_time || "",
                        closeTime: label.pickup_close_time || "",
                        shipments: []
                    };
                }
                groups[key].shipments.push(label);
            }
        });

        return Object.values(groups).sort((a, b) => {
            // Safe fallback sort for dates that are not valid dates
            const timeA = isNaN(new Date(a.date).getTime()) ? 0 : new Date(a.date).getTime();
            const timeB = isNaN(new Date(b.date).getTime()) ? 0 : new Date(b.date).getTime();
            return timeB - timeA;
        });
    }, [labels]);

    const filteredPickups = useMemo(() => {
        if (!searchQuery) return groupedPickups;
        const query = searchQuery.toLowerCase();
        return groupedPickups.filter(pickup => {
            const matchesConfirmation = pickup.confirmationNumber.toLowerCase().includes(query);
            const matchesCarrier = pickup.carrier.toLowerCase().includes(query);
            const matchesShipment = pickup.shipments.some(s => {
                const shortOrderId = s.order_id?.slice(0, 8) || "";
                const tracking = s.tracking_number?.toLowerCase() || "";
                const customerName = (s.ship_to?.name || s.ship_to?.full_name || "").toLowerCase();
                return shortOrderId.includes(query) || tracking.includes(query) || customerName.includes(query);
            });
            return matchesConfirmation || matchesCarrier || matchesShipment;
        });
    }, [groupedPickups, searchQuery]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Shipping & Pickups 📦</h1>
                    <p className="text-muted-foreground mt-2">
                        View and manage shipping labels and scheduled carrier pickups for customer orders.
                    </p>
                </div>
            </div>            <Card>
                <CardHeader className="flex flex-col gap-4 pb-4 border-b">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <CardTitle>Shipping Directory</CardTitle>
                        <div className="flex items-center gap-2 w-full md:w-96">
                            <div className="relative w-full flex items-center">
                                <Search className="w-4 h-4 text-muted-foreground ml-3 absolute pointer-events-none" />
                                <Input
                                    placeholder="Search by Order ID, Tracking #, Customer or Confirmation #"
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="w-full pl-9"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                        <Button
                            variant={activeTab === "labels" ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                                setActiveTab("labels");
                                setCurrentPage(1);
                            }}
                            className="text-xs font-semibold px-4 py-1.5"
                        >
                            All Labels ({filteredLabels.length})
                        </Button>
                        <Button
                            variant={activeTab === "pickups" ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                                setActiveTab("pickups");
                                setCurrentPage(1);
                            }}
                            className="text-xs font-semibold px-4 py-1.5"
                        >
                            Scheduled Pickups ({filteredPickups.length})
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    {activeTab === "labels" ? (
                        <>
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
                                                                    <span className="text-xs text-muted-foreground truncate max-w-[150px]" title={label.orders?.shipping_service || label.service_code}>
                                                                        {(label.service_name && label.service_name !== 'Shippo Shipment') ? label.service_name : 
                                                                            (label.orders?.shipping_service || formatServiceLevel(label.service_code))}
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
                        </>
                    ) : (
                        // Pickups Tab Content
                        <>
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <span className="text-muted-foreground text-sm">Loading pickups...</span>
                                </div>
                            ) : filteredPickups.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <Truck className="h-10 w-10 text-muted-foreground mb-4" />
                                    <h3 className="text-lg font-medium">No scheduled pickups found</h3>
                                    <p className="text-sm text-muted-foreground mt-1 max-w-md">
                                        {searchQuery ? "No scheduled pickups match your search criteria." : "There are currently no scheduled pickups."}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {filteredPickups.map((pickup, index) => {
                                        const totalWeight = pickup.shipments.reduce((sum, s) => sum + (s.weight || 0), 0);
                                        return (
                                            <Card key={index} className="border border-muted-foreground/20 overflow-hidden shadow-sm hover:shadow transition-shadow">
                                                <CardHeader className="bg-muted/30 py-4 px-6 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                                    <div className="space-y-1 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <Badge className="bg-primary hover:bg-primary/95 text-xs px-2 py-0.5">
                                                                {pickup.carrier}
                                                            </Badge>
                                                            <span className="text-xs text-muted-foreground">|</span>
                                                            <span className="font-semibold text-sm text-foreground">
                                                                Pickup Date: {formatPickupDate(pickup.date)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-0.5">
                                                            <span className="font-medium">Time Window:</span>
                                                            <span>{formatPickupTime(pickup.readyTime)} - {formatPickupTime(pickup.closeTime)}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col md:items-end gap-1.5">
                                                        <div className="flex items-center gap-1.5 border px-2.5 py-1 rounded bg-background w-fit">
                                                            <span className="text-xs font-semibold text-muted-foreground mr-1 uppercase">Confirmation:</span>
                                                            <span className="font-mono text-xs font-bold text-foreground">{pickup.confirmationNumber}</span>
                                                            <CopyCell value={pickup.confirmationNumber} size={12} />
                                                        </div>
                                                        <div className="flex gap-3 text-xs text-muted-foreground px-1">
                                                            <span>Packages: <strong className="text-foreground">{pickup.shipments.length}</strong></span>
                                                            <span>|</span>
                                                            <span>Total Weight: <strong className="text-foreground">{totalWeight.toFixed(2)} lbs</strong></span>
                                                        </div>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="p-0">
                                                    <Table>
                                                        <TableHeader className="bg-muted/10">
                                                            <TableRow>
                                                                <TableHead className="pl-6">Order #</TableHead>
                                                                <TableHead>Customer</TableHead>
                                                                <TableHead>Service Level</TableHead>
                                                                <TableHead>Tracking Number</TableHead>
                                                                <TableHead className="pr-6" align="right">Weight</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {pickup.shipments.map((shipment) => (
                                                                <TableRow key={shipment.id} className="hover:bg-muted/5 border-b last:border-0">
                                                                    <TableCell className="pl-6 font-mono text-sm font-medium">
                                                                        {shipment.order_id ? shipment.order_id.slice(0, 8) : "N/A"}
                                                                    </TableCell>
                                                                    <TableCell className="font-medium text-sm">
                                                                        {shipment.ship_to?.name || shipment.ship_to?.full_name || "Unknown"}
                                                                    </TableCell>
                                                                    <TableCell className="text-xs text-muted-foreground">
                                                                        {(shipment.service_name && shipment.service_name !== 'Shippo Shipment') ? shipment.service_name : 
                                                                            (shipment.orders?.shipping_service || formatServiceLevel(shipment.service_code))}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div className="flex items-center gap-1.5 border px-2 py-0.5 rounded bg-muted/10 w-fit">
                                                                            <span className="font-mono text-xs text-muted-foreground">{shipment.tracking_number}</span>
                                                                            <CopyCell value={shipment.tracking_number} size={11} />
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="pr-6 font-medium text-sm" align="right">
                                                                        {shipment.weight} {shipment.weight_unit || 'LBS'}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
