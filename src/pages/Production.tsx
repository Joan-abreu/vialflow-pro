import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { format } from "date-fns";
import { toast } from "sonner";
import AddBatchDialog from "@/components/production/AddBatchDialog";
import ManageVialTypesDialog from "@/components/production/ManageVialTypesDialog";
import ManageVialMaterialsDialog from "@/components/production/ManageVialMaterialsDialog";
import { ManageProductsDialog } from "@/components/production/ManageProductsDialog";
import { ManageProductMaterialsDialog } from "@/components/production/ManageProductMaterialsDialog";
import AddShipmentDialog from "@/components/shipments/AddShipmentDialog";
import EditBatchDialog from "@/components/production/EditBatchDialog";
import { Package, Trash2, FileText } from "lucide-react";

interface ProductionBatch {
  id: string;
  batch_number: string;
  quantity: number;
  status: string;
  sale_type: string;
  pack_quantity: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  shipped_units: number;
  units_in_progress: number;
  vial_type_id: string;
  product_id: string | null;
  vial_types: {
    name: string;
    size_ml: number;
  };
  products?: {
    name: string;
  } | null;
}

const Production = () => {
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBatches = async () => {
    setLoading(true);
    
    // Fetch batches with vial types, products and shipped_units
    const { data: batchData, error } = await supabase
      .from("production_batches")
      .select("*, vial_types(name, size_ml), products(name)")
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

  const handleDeleteBatch = async (batchId: string, batchNumber: string) => {
    try {
      const { error } = await supabase
        .from("production_batches")
        .delete()
        .eq("id", batchId);

      if (error) throw error;

      toast.success(`Batch ${batchNumber} deleted successfully`);
      fetchBatches();
    } catch (error: any) {
      toast.error("Error deleting batch");
      console.error("Error:", error);
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
            <ManageProductsDialog />
            <ManageProductMaterialsDialog />
            <ManageVialTypesDialog />
            <ManageVialMaterialsDialog />
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
                      <TableHead>Started</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {batches.map((batch) => {
                    const unitsInProgress = batch.units_in_progress || 0;
                    const shippedUnits = batch.shipped_units || 0;
                    
                    // For pack sale type, convert bottles to packs for display
                    const inProgress = batch.sale_type === "pack" && batch.pack_quantity 
                      ? unitsInProgress / batch.pack_quantity 
                      : unitsInProgress;
                    const shipped = batch.sale_type === "pack" && batch.pack_quantity 
                      ? shippedUnits / batch.pack_quantity 
                      : shippedUnits;
                    const total = batch.sale_type === "pack" && batch.pack_quantity
                      ? batch.quantity / batch.pack_quantity
                      : batch.quantity;
                    const progress = total > 0 ? (inProgress / total) * 100 : 0;
                    
                    return (
                      <TableRow key={batch.id}>
                        <TableCell className="font-medium">{batch.batch_number}</TableCell>
                        <TableCell>
                          {batch.products?.name || "-"}
                        </TableCell>
                        <TableCell>
                          {batch.vial_types.name} ({batch.vial_types.size_ml}ml)
                        </TableCell>
                        <TableCell>
                          {batch.sale_type === "pack" && batch.pack_quantity
                            ? `${(batch.quantity / batch.pack_quantity).toFixed(0)} packs`
                            : batch.quantity
                          }
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 min-w-[120px]">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                {inProgress.toFixed(0)} / {total.toFixed(0)}
                                {batch.sale_type === "pack" ? " packs" : ""}
                              </span>
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
                        <TableCell>
                          {batch.started_at ? (
                            <span className="text-sm">
                              {format(new Date(batch.started_at), "PP p")}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {batch.completed_at ? (
                            <span className="text-sm">
                              {format(new Date(batch.completed_at), "PP p")}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{format(new Date(batch.created_at), "PP")}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <EditBatchDialog
                              batch={batch}
                              onSuccess={fetchBatches}
                            />
                            {shipped < total && (
                              <AddShipmentDialog
                                initialBatchId={batch.id}
                                onSuccess={fetchBatches}
                                trigger={
                                  <Button variant="ghost" size="icon" title="New Shipment">
                                    <Package className="h-4 w-4" />
                                  </Button>
                                }
                              />
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => window.open(`/bom/${batch.id}`, '_blank')}
                              title="Generate Bill of Materials"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" title="Delete">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Batch</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete batch "{batch.batch_number}"? 
                                    This will also delete all related shipments and boxes. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteBatch(batch.id, batch.batch_number)}
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
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Production;
