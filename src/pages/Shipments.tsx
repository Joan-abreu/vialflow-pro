import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import AddShipmentDialog from "@/components/shipments/AddShipmentDialog";
import { EditShipmentDialog } from "@/components/shipments/EditShipmentDialog";
import { ShipmentBoxesDialog } from "@/components/shipments/ShipmentBoxesDialog";

interface Shipment {
  id: string;
  shipment_number: string;
  fba_id: string | null;
  destination: string;
  status: string;
  created_at: string;
  batch_id: string | null;
  ups_delivery_date: string | null;
  ups_tracking_number: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  production_batches?: {
    batch_number: string;
  };
  shipment_boxes?: Array<{
    id: string;
    box_number: number;
    packs_per_box: number | null;
    bottles_per_box: number | null;
    weight_lb: number | null;
  }>;
}

const Shipments = () => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchShipments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("shipments")
      .select(`
        *,
        production_batches:batch_id (
          batch_number
        ),
        shipment_boxes (
          id,
          box_number,
          packs_per_box,
          bottles_per_box,
          weight_lb
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

  return (
    <Layout>
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
          <CardHeader>
            <CardTitle>Shipment Boxes</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : shipments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No shipments yet. Click "New Shipment" to create your first box.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shipment Number</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Total Boxes</TableHead>
                      <TableHead>FBA ID</TableHead>
                      <TableHead>UPS Tracking</TableHead>
                      <TableHead>Delivery Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shipments.map((shipment) => (
                      <TableRow key={shipment.id}>
                        <TableCell className="font-medium">
                          {shipment.shipment_number}
                        </TableCell>
                        <TableCell>
                          {shipment.production_batches?.batch_number || "-"}
                        </TableCell>
                        <TableCell>{shipment.destination || "-"}</TableCell>
                        <TableCell>
                          {shipment.shipment_boxes?.length || 0} boxes
                        </TableCell>
                        <TableCell>{shipment.fba_id || "-"}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {shipment.ups_tracking_number || "-"}
                        </TableCell>
                        <TableCell>
                          {shipment.ups_delivery_date 
                            ? format(new Date(shipment.ups_delivery_date), "PP") 
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(shipment.status)}>
                            {shipment.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <ShipmentBoxesDialog 
                              shipmentId={shipment.id}
                              shipmentNumber={shipment.shipment_number}
                            />
                            <EditShipmentDialog shipment={shipment} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Shipments;
