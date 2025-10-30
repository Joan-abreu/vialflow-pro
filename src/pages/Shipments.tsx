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

interface Shipment {
  id: string;
  shipment_number: string;
  fba_id: string | null;
  destination: string;
  status: string;
  created_at: string;
}

const Shipments = () => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchShipments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("shipments")
      .select("*")
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Shipments</h1>
            <p className="text-muted-foreground">
              Track shipments to Amazon FBA
            </p>
          </div>
          <AddShipmentDialog onSuccess={fetchShipments} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Active Shipments</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : shipments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No shipments yet. Click "New Shipment" to create your first one.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shipment Number</TableHead>
                    <TableHead>FBA ID</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipments.map((shipment) => (
                    <TableRow key={shipment.id}>
                      <TableCell className="font-medium">{shipment.shipment_number}</TableCell>
                      <TableCell>{shipment.fba_id || "-"}</TableCell>
                      <TableCell>{shipment.destination}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(shipment.status)} className="capitalize">
                          {shipment.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(shipment.created_at), "PP")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Shipments;
