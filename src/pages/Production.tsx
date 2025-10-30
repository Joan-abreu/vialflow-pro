import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import AddBatchDialog from "@/components/production/AddBatchDialog";
import ManageVialTypesDialog from "@/components/production/ManageVialTypesDialog";
import CreateShipmentDialog from "@/components/production/CreateShipmentDialog";

interface ProductionBatch {
  id: string;
  batch_number: string;
  quantity: number;
  status: string;
  sale_type: string;
  pack_quantity: number | null;
  created_at: string;
  shipped_units: number;
  vial_types: {
    name: string;
    size_ml: number;
  };
}

const Production = () => {
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBatches = async () => {
    setLoading(true);
    
    // Fetch batches with vial types and shipped_units
    const { data: batchData, error } = await supabase
      .from("production_batches")
      .select("*, vial_types(name, size_ml)")
      .order("created_at", { ascending: false });

    if (!error && batchData) {
      setBatches(batchData as any);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "secondary";
      case "in_progress":
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
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Production</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Manage production batches and workflows
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ManageVialTypesDialog />
            <AddBatchDialog onSuccess={fetchBatches} />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Production Batches</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : batches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No batches yet. Click "New Batch" to create your first one.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch Number</TableHead>
                      <TableHead>Vial Type</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Sale Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {batches.map((batch) => {
                    const shipped = batch.shipped_units || 0;
                    const progress = batch.quantity > 0 ? (shipped / batch.quantity) * 100 : 0;
                    
                    return (
                      <TableRow key={batch.id}>
                        <TableCell className="font-medium">{batch.batch_number}</TableCell>
                        <TableCell>
                          {batch.vial_types.name} ({batch.vial_types.size_ml}ml)
                        </TableCell>
                        <TableCell>{batch.quantity}</TableCell>
                        <TableCell>
                          <div className="space-y-1 min-w-[120px]">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">{shipped} / {batch.quantity}</span>
                              <span className="text-muted-foreground">{progress.toFixed(0)}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">
                          {batch.sale_type}
                          {batch.sale_type === "pack" && batch.pack_quantity && (
                            <span className="text-muted-foreground text-sm ml-1">
                              ({batch.pack_quantity} units)
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(batch.status)} className="capitalize">
                            {batch.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(batch.created_at), "PP")}</TableCell>
                        <TableCell>
                          {shipped < batch.quantity && (
                            <CreateShipmentDialog
                              batch={batch}
                              onSuccess={fetchBatches}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

export default Production;
