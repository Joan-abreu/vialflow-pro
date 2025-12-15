import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import AddShipmentDialog from "@/components/shipments/AddShipmentDialog";
import { EditShipmentDialog } from "@/components/shipments/EditShipmentDialog";
import { ShipmentBoxesDialog } from "@/components/shipments/ShipmentBoxesDialog";
import { Button } from "@/components/ui/button";
import { Trash2, Truck, Search } from "lucide-react";
import { toast } from "sonner";
import { updateBatchStatus } from "@/services/batches";
import CopyCell from "@/components/CopyCell";
import { DataTablePagination } from "@/components/shared/DataTablePagination";

interface Shipment {
  id: string;
  shipment_number: string;
  status: string;
  created_at: string;
  batch_id: string | null;
  ups_delivery_date: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  production_batches?: {
    batch_number: string;
    sale_type: string;
    pack_quantity: number | null;
  };
  shipment_boxes?: Array<{
    id: string;
    box_number: number;
    packs_per_box: number | null;
    bottles_per_box: number | null;
    weight_lb: number | null;
    ups_tracking_number: string | null;
    fba_id: string | null;
    destination: string | null;
  }>;
}

const Shipments = () => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchShipments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("shipments")
      .select(`
        *,
        production_batches:batch_id (
          batch_number,
          sale_type,
          pack_quantity
        ),
        shipment_boxes (
          id,
          box_number,
          packs_per_box,
          bottles_per_box,
          weight_lb,
          ups_tracking_number,
          fba_id,
          destination
        )
      `)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setShipments(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchShipments();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "secondary";
      case "shipped":
        return "default";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  const filteredShipments = shipments.filter((shipment) => {
    const query = searchQuery.toLowerCase();
    // Search in shipment level fields and also in box-level tracking/fba/destination
    const hasBoxMatch = shipment.shipment_boxes?.some(box =>
      box.ups_tracking_number?.toLowerCase().includes(query) ||
      box.fba_id?.toLowerCase().includes(query) ||
      box.destination?.toLowerCase().includes(query)
    );
    return (
      shipment.shipment_number.toLowerCase().includes(query) ||
      shipment.production_batches?.batch_number.toLowerCase().includes(query) ||
      shipment.status.toLowerCase().includes(query) ||
      hasBoxMatch
    );
  });

  const handleDeleteShipment = async (shipmentId: string, shipmentNumber: string) => {
    try {
      const { data: shipmentData, error: fetchError } = await supabase
        .from("shipments")
        .select("id, batch_id")
        .eq("id", shipmentId)
        .single();

      if (fetchError || !shipmentData) throw fetchError || new Error("Shipment not found");

      const batchId = shipmentData.batch_id;

      const { error: deleteError } = await supabase
        .from("shipments")
        .delete()
        .eq("id", shipmentId);

      if (deleteError) throw deleteError;

      if (batchId) {
        await updateBatchStatus(batchId);
      }

      toast.success("Shipment deleted successfully");
      fetchShipments();
    } catch (error: any) {
      toast.error("Error deleting shipment");
      console.error("Error:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Shipments</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Track shipments to Amazon FBA
          </p>
        </div>
        <AddShipmentDialog onSuccess={fetchShipments} />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between space-y-0 pb-4">
          <CardTitle>All Shipments</CardTitle>
          <div className="flex items-center gap-2 w-full md:w-72">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search shipments..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full"
            />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : filteredShipments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {shipments.length === 0
                ? "No shipments yet. Click 'New Shipment' to create your first box."
                : "No shipments found matching your search."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shipment Number</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Destinations</TableHead>
                    <TableHead>UPS Tracking</TableHead>
                    <TableHead>FBA ID</TableHead>
                    <TableHead>Total Boxes</TableHead>
                    <TableHead>Delivery Date</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShipments
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((shipment) => {
                      // Get unique destinations from boxes
                      const destinations = [...new Set(
                        shipment.shipment_boxes
                          ?.map(box => box.destination)
                          .filter(Boolean)
                      )];

                      // Get unique tracking numbers from boxes
                      const trackingNumbers = [...new Set(
                        shipment.shipment_boxes
                          ?.map(box => box.ups_tracking_number)
                          .filter(Boolean)
                      )];

                      const fbaNumbers = [...new Set(
                        shipment.shipment_boxes
                          ?.map(box => box.fba_id)
                          .filter(Boolean)
                      )];

                      // Calculate total quantity based on sale type
                      const totalPacks = shipment.shipment_boxes?.reduce((sum, box) =>
                        sum + (box.packs_per_box || 0), 0) || 0;
                      const totalBottles = shipment.shipment_boxes?.reduce((sum, box) =>
                        sum + (box.bottles_per_box || 0), 0) || 0;

                      const saleType = shipment.production_batches?.sale_type || "individual";
                      const qtyDisplay = saleType === "pack"
                        ? `${totalPacks} Packs`
                        : `${totalBottles} Bottles`;

                      return (
                        <TableRow key={shipment.id}>
                          <TableCell className="font-medium">
                            {shipment.shipment_number}
                          </TableCell>
                          <TableCell>
                            {shipment.production_batches?.batch_number || "-"}
                            <CopyCell value={shipment.production_batches?.batch_number} size={14} />
                          </TableCell>
                          <TableCell>
                            {qtyDisplay}
                          </TableCell>
                          <TableCell>
                            {destinations.length > 0 ? destinations.join(", ") : "-"}
                          </TableCell>
                          <TableCell>
                            {trackingNumbers.length > 0 ? (
                              <div className="flex flex-col gap-1.5">
                                {trackingNumbers.map((trackingNum, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-xs">
                                    <span className="font-mono">{trackingNum}</span>
                                    <a
                                      href={`https://www.ups.com/track?tracknum=${trackingNum}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:text-primary/80 shrink-0"
                                      title="Track package on UPS"
                                    >
                                      <Truck className="h-3.5 w-3.5" />
                                    </a>
                                  </div>
                                ))}
                              </div>
                            ) : "-"}
                          </TableCell>
                          <TableCell>
                            {fbaNumbers.length > 0 ? (
                              <div className="flex flex-col gap-1.5">
                                {fbaNumbers.map((fbaNumber, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-xs">
                                    <span className="font-mono">{fbaNumber}</span>
                                    <CopyCell value={fbaNumber} size={10} />
                                  </div>
                                ))}
                              </div>
                            ) : "-"}
                          </TableCell>
                          <TableCell>
                            {shipment.shipment_boxes?.length || 0} boxes
                          </TableCell>
                          <TableCell>
                            {shipment.ups_delivery_date
                              ? shipment.ups_delivery_date.split("T")[0]
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {shipment.created_at.split("T")[0]}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusColor(shipment.status)} className="capitalize">
                              {shipment.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <ShipmentBoxesDialog
                                shipmentId={shipment.id}
                                shipmentNumber={shipment.shipment_number}
                                onSuccess={fetchShipments}
                              />
                              <EditShipmentDialog shipment={shipment} onSuccess={fetchShipments} />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" title="Delete">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Shipment</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete shipment "{shipment.shipment_number}"?
                                      This will also delete all boxes associated with it. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteShipment(shipment.id, shipment.shipment_number)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          )}
          {!loading && filteredShipments.length > 0 && (
            <DataTablePagination
              currentPage={currentPage}
              totalPages={Math.ceil(filteredShipments.length / itemsPerPage)}
              onPageChange={setCurrentPage}
              totalItems={filteredShipments.length}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Shipments;
