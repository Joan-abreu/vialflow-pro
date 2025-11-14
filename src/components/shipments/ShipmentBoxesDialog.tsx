import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Package, Trash2, Plus, Truck } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import BarcodeScanner from "./BarcodeScanner";
import { LabelImageScanner } from "./LabelImageScanner";

interface ShipmentBox {
  id: string;
  box_number: number;
  packs_per_box: number | null;
  bottles_per_box: number | null;
  weight_lb: number | null;
  dimension_length_in: number | null;
  dimension_width_in: number | null;
  dimension_height_in: number | null;
  destination: string | null;
  ups_tracking_number: string | null;
  fba_id: string | null;
}

interface ShipmentBoxesDialogProps {
  shipmentId: string;
  shipmentNumber: string;
  onSuccess?: () => void;
}

export const ShipmentBoxesDialog = ({ shipmentId, shipmentNumber, onSuccess }: ShipmentBoxesDialogProps) => {
  const [open, setOpen] = useState(false);
  const [boxes, setBoxes] = useState<ShipmentBox[]>([]);
  const [boxMaterials, setBoxMaterials] = useState<Array<{ id: string; name: string; dimension_length_in: number | null; dimension_width_in: number | null; dimension_height_in: number | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBoxType, setSelectedBoxType] = useState("");
  const [batchInfo, setBatchInfo] = useState<{ sale_type: string; pack_quantity: number } | null>(null);
  const [newBox, setNewBox] = useState({
    box_number: "",
    packs_per_box: "",
    bottles_per_box: "",
    weight_lb: "",
    dimension_length_in: "",
    dimension_width_in: "",
    dimension_height_in: "",
    destination: "",
    ups_tracking_number: "",
    fba_id: "",
  });
  const queryClient = useQueryClient();

  const parseShippingLabel = (scannedText: string) => {
    console.log("Scanned text:", scannedText);
    
    // Extract UPS tracking number (1Z format)
    const upsMatch = scannedText.match(/1Z[A-Z0-9]{16}/);
    
    // Extract FBA Shipment ID
    const fbaMatch = scannedText.match(/FBA[A-Z0-9]{10,}/i);
    
    // Extract state code from address (2-letter state abbreviations)
    const stateMatch = scannedText.match(/\b([A-Z]{2})\s+\d{5}/);
    
    const updates: Partial<typeof newBox> = {};
    
    if (upsMatch) {
      updates.ups_tracking_number = upsMatch[0];
      toast.success("UPS tracking number detected");
    }
    
    if (fbaMatch) {
      updates.fba_id = fbaMatch[0];
      toast.success("FBA ID detected");
    }
    
    if (stateMatch) {
      updates.destination = stateMatch[1];
      toast.success("Destination detected");
    }
    
    if (Object.keys(updates).length > 0) {
      setNewBox(prev => ({ ...prev, ...updates }));
    } else {
      toast.error("No shipping label data found");
    }
  };

  const handleLabelDataExtracted = (extractedData: any) => {
    const updates: Partial<typeof newBox> = {};
    
    if (extractedData.box_number) {
      updates.box_number = extractedData.box_number.toString();
    }
    if (extractedData.destination) {
      updates.destination = extractedData.destination;
    }
    if (extractedData.ups_tracking_number) {
      updates.ups_tracking_number = extractedData.ups_tracking_number;
    }
    if (extractedData.fba_id) {
      updates.fba_id = extractedData.fba_id;
    }
    if (extractedData.weight_lb) {
      updates.weight_lb = extractedData.weight_lb.toString();
    }
    if (extractedData.dimension_length_in) {
      updates.dimension_length_in = extractedData.dimension_length_in.toString();
    }
    if (extractedData.dimension_width_in) {
      updates.dimension_width_in = extractedData.dimension_width_in.toString();
    }
    if (extractedData.dimension_height_in) {
      updates.dimension_height_in = extractedData.dimension_height_in.toString();
    }
    
    // Handle quantity based on batch sale_type
    if (extractedData.qty && batchInfo) {
      const qty = parseInt(extractedData.qty);
      if (batchInfo.sale_type === "pack") {
        // For pack batches: qty goes to packs_per_box, calculate bottles_per_box
        updates.packs_per_box = qty.toString();
        updates.bottles_per_box = (qty * batchInfo.pack_quantity).toString();
      } else {
        // For individual batches: qty goes to bottles_per_box
        updates.bottles_per_box = qty.toString();
      }
    }

    setNewBox(prev => ({ ...prev, ...updates }));
  };

  const fetchBoxes = async () => {
    const { data, error } = await supabase
      .from("shipment_boxes")
      .select("*")
      .eq("shipment_id", shipmentId)
      .order("box_number");

    if (!error && data) {
      setBoxes(data);
    }
  };

  const fetchBoxMaterials = async () => {
    const { data, error } = await supabase
      .from("raw_materials")
      .select("id, name, dimension_length_in, dimension_width_in, dimension_height_in")
      .eq("category", "packaging")
      .not("dimension_length_in", "is", null)
      .order("name");

    if (!error && data) {
      setBoxMaterials(data);
    }
  };

  const fetchBatchInfo = async () => {
    const { data: shipment } = await supabase
      .from("shipments")
      .select("batch_id")
      .eq("id", shipmentId)
      .single();

    if (shipment?.batch_id) {
      const { data: batch } = await supabase
        .from("production_batches")
        .select("sale_type, pack_quantity")
        .eq("id", shipment.batch_id)
        .single();

      if (batch) {
        setBatchInfo(batch);
      }
    }
  };

  useEffect(() => {
    if (open) {
      fetchBoxes();
      fetchBoxMaterials();
      fetchBatchInfo();
      // Reset form when dialog opens
      setNewBox({
        box_number: "",
        packs_per_box: "",
        bottles_per_box: "",
        weight_lb: "",
        dimension_length_in: "",
        dimension_width_in: "",
        dimension_height_in: "",
        destination: "",
        ups_tracking_number: "",
        fba_id: "",
      });
      setSelectedBoxType("");
    }
  }, [open, shipmentId]);

  const handleAddBox = async () => {
    if (!newBox.box_number) {
      toast.error("Box number is required");
      return;
    }

    setLoading(true);
    try {
      // Get shipment details to find batch
      const { data: shipment, error: shipmentError } = await supabase
        .from("shipments")
        .select("batch_id")
        .eq("id", shipmentId)
        .single();

      if (shipmentError) throw shipmentError;

      if (!shipment?.batch_id) {
        toast.error("Shipment has no associated batch");
        setLoading(false);
        return;
      }

      // Get batch details to find vial type
      const { data: batch, error: batchError } = await supabase
        .from("production_batches")
        .select("vial_type_id")
        .eq("id", shipment.batch_id)
        .single();

      if (batchError) throw batchError;

      // Get per_box materials for this vial type
      const { data: perBoxMaterials, error: materialsError } = await supabase
        .from("vial_type_materials")
        .select(`
          raw_material_id,
          quantity_per_unit,
          raw_materials (
            id,
            name,
            current_stock,
            unit,
            purchase_unit_id,
            usage_unit_id,
            qty_per_container
          )
        `)
        .eq("vial_type_id", batch.vial_type_id)
        .eq("application_type", "per_box");

      if (materialsError) throw materialsError;

      // Check stock for per_box materials
      const insufficientMaterials: string[] = [];
      const materialUpdates: Array<{ id: string; newStock: number }> = [];

      for (const vm of perBoxMaterials || []) {
        const material = vm.raw_materials as any;
        
        // Skip if material doesn't exist
        if (!material) {
          console.warn(`Material not found for vial type material ${vm.raw_material_id}`);
          continue;
        }
        
        const neededQuantity = vm.quantity_per_unit; // 1 box = quantity_per_unit of material

        // Get current stock in usage units
        const { data: stockData, error: stockError } = await supabase
          .rpc('get_material_stock_in_usage_units', { material_id: material.id });

        if (stockError) throw stockError;

        const availableStock = stockData || 0;

        if (availableStock < neededQuantity) {
          insufficientMaterials.push(
            `${material.name}: need ${neededQuantity.toFixed(2)} ${material.unit}, available ${availableStock.toFixed(2)}`
          );
        } else {
          // Calculate new stock in purchase units
          const conversionFactor = material.qty_per_container || 1;
          const stockInPurchaseUnits = material.current_stock;
          const neededInPurchaseUnits = neededQuantity / conversionFactor;
          
          materialUpdates.push({
            id: material.id,
            newStock: stockInPurchaseUnits - neededInPurchaseUnits
          });
        }
      }

      if (insufficientMaterials.length > 0) {
        toast.error("Insufficient materials for box:\n" + insufficientMaterials.join("\n"), {
          duration: 8000,
        });
        setLoading(false);
        return;
      }

      // Insert the box
      const { error } = await supabase.from("shipment_boxes").insert({
        shipment_id: shipmentId,
        box_number: parseInt(newBox.box_number),
        packs_per_box: newBox.packs_per_box ? parseInt(newBox.packs_per_box) : null,
        bottles_per_box: newBox.bottles_per_box ? parseInt(newBox.bottles_per_box) : null,
        weight_lb: newBox.weight_lb ? parseFloat(newBox.weight_lb) : null,
        dimension_length_in: newBox.dimension_length_in ? parseFloat(newBox.dimension_length_in) : null,
        dimension_width_in: newBox.dimension_width_in ? parseFloat(newBox.dimension_width_in) : null,
        dimension_height_in: newBox.dimension_height_in ? parseFloat(newBox.dimension_height_in) : null,
        destination: newBox.destination || null,
        ups_tracking_number: newBox.ups_tracking_number || null,
        fba_id: newBox.fba_id || null,
      });

      if (error) throw error;

      // Update material stocks
      for (const update of materialUpdates) {
        const { error: updateError } = await supabase
          .from("raw_materials")
          .update({ current_stock: update.newStock })
          .eq("id", update.id);

        if (updateError) {
          console.error("Error updating material stock:", updateError);
        }
      }

      toast.success("Box added and per-box materials deducted from inventory");
      setNewBox({
        box_number: "",
        packs_per_box: "",
        bottles_per_box: "",
        weight_lb: "",
        dimension_length_in: "",
        dimension_width_in: "",
        dimension_height_in: "",
        destination: "",
        ups_tracking_number: "",
        fba_id: "",
      });
      fetchBoxes();
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Error adding box");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBox = async (boxId: string) => {
    try {
      const { error } = await supabase
        .from("shipment_boxes")
        .delete()
        .eq("id", boxId);

      if (error) throw error;

      toast.success("Box deleted successfully");
      fetchBoxes();
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      onSuccess?.();
    } catch (error: any) {
      toast.error("Error deleting box");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Package className="mr-2 h-4 w-4" />
          View Boxes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Boxes for Shipment {shipmentNumber}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Lista de cajas existentes */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Existing Boxes</h3>
            {boxes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No boxes added yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Box #</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>UPS Tracking</TableHead>
                      <TableHead>FBA ID</TableHead>
                      <TableHead>Packs</TableHead>
                      <TableHead>Bottles</TableHead>
                      <TableHead>Weight (lb)</TableHead>
                      <TableHead>Dimensions (in)</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {boxes.map((box) => (
                      <TableRow key={box.id}>
                        <TableCell className="font-medium">{box.box_number}</TableCell>
                        <TableCell>{box.destination || "-"}</TableCell>
                        <TableCell className="text-xs">
                          {box.ups_tracking_number ? (
                            <div className="flex items-center gap-2">
                              <span>{box.ups_tracking_number}</span>
                              <a
                                href={`https://www.ups.com/track?tracknum=${box.ups_tracking_number}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary/80"
                                title="Track package on UPS"
                              >
                                <Truck className="h-4 w-4" />
                              </a>
                            </div>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-xs">{box.fba_id || "-"}</TableCell>
                        <TableCell>{box.packs_per_box || "-"}</TableCell>
                        <TableCell>{box.bottles_per_box || "-"}</TableCell>
                        <TableCell>{box.weight_lb || "-"}</TableCell>
                        <TableCell>
                          {box.dimension_length_in && box.dimension_width_in && box.dimension_height_in
                            ? `${box.dimension_length_in} × ${box.dimension_width_in} × ${box.dimension_height_in}`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Box</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete Box #{box.box_number}? 
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteBox(box.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Formulario para agregar nueva caja */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Add New Box</h3>
            
            {/* Label Image Scanner */}
            <div className="mb-6 p-4 border rounded-lg bg-muted/50">
              <h4 className="text-sm font-medium mb-3">Scan Shipping Label</h4>
              <LabelImageScanner onDataExtracted={handleLabelDataExtracted} />
            </div>

            {/* Barcode Scanner - Hidden but kept in code for future use */}
            {false && (
              <div className="mb-6 p-4 border rounded-lg bg-muted/50">
                <h4 className="text-sm font-medium mb-3">Or Scan Barcode</h4>
                <BarcodeScanner onScan={parseShippingLabel} />
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="box_type">Box Type (optional)</Label>
                <Select
                  value={selectedBoxType}
                  onValueChange={(value) => {
                    setSelectedBoxType(value);
                    const selectedBox = boxMaterials.find(b => b.id === value);
                    if (selectedBox) {
                      setNewBox({
                        ...newBox,
                        dimension_length_in: selectedBox.dimension_length_in?.toString() || "",
                        dimension_width_in: selectedBox.dimension_width_in?.toString() || "",
                        dimension_height_in: selectedBox.dimension_height_in?.toString() || "",
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select box type" />
                  </SelectTrigger>
                  <SelectContent>
                    {boxMaterials.map((box) => (
                      <SelectItem key={box.id} value={box.id}>
                        {box.name} ({box.dimension_length_in}" x {box.dimension_width_in}" x {box.dimension_height_in}")
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="box_number">Box Number *</Label>
                <Input
                  id="box_number"
                  type="number"
                  value={newBox.box_number}
                  onChange={(e) => setNewBox({ ...newBox, box_number: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="destination">Destination *</Label>
                <Input
                  id="destination"
                  value={newBox.destination}
                  onChange={(e) => setNewBox({ ...newBox, destination: e.target.value })}
                  placeholder="e.g., IN, FL, CA"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ups_tracking_number">UPS Tracking</Label>
                <Input
                  id="ups_tracking_number"
                  value={newBox.ups_tracking_number}
                  onChange={(e) => setNewBox({ ...newBox, ups_tracking_number: e.target.value })}
                  placeholder="1Z..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fba_id">FBA ID</Label>
                <Input
                  id="fba_id"
                  value={newBox.fba_id}
                  onChange={(e) => setNewBox({ ...newBox, fba_id: e.target.value })}
                  placeholder="FBA..."
                />
              </div>

              {batchInfo?.sale_type === "pack" && (
                <div className="space-y-2">
                  <Label htmlFor="packs_per_box">Packs per Box</Label>
                  <Input
                    id="packs_per_box"
                    type="number"
                    value={newBox.packs_per_box}
                    onChange={(e) => {
                      const packs = e.target.value;
                      const bottles = packs && batchInfo ? (parseInt(packs) * batchInfo.pack_quantity).toString() : "";
                      setNewBox({ ...newBox, packs_per_box: packs, bottles_per_box: bottles });
                    }}
                  />
                </div>
              )}

              {batchInfo?.sale_type === "individual" && (
                <div className="space-y-2">
                  <Label htmlFor="bottles_per_box">Bottles per Box</Label>
                  <Input
                    id="bottles_per_box"
                    type="number"
                    value={newBox.bottles_per_box}
                    onChange={(e) => setNewBox({ ...newBox, bottles_per_box: e.target.value })}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="bottles_per_box_calc">Bottles per Box (calculated)</Label>
                <Input
                  id="bottles_per_box_calc"
                  type="number"
                  value={newBox.bottles_per_box}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight_lb">Weight (lb)</Label>
                <Input
                  id="weight_lb"
                  type="number"
                  step="0.01"
                  value={newBox.weight_lb}
                  onChange={(e) => setNewBox({ ...newBox, weight_lb: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dimension_length_in">Length (in)</Label>
                <Input
                  id="dimension_length_in"
                  type="number"
                  step="0.01"
                  value={newBox.dimension_length_in}
                  onChange={(e) => setNewBox({ ...newBox, dimension_length_in: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dimension_width_in">Width (in)</Label>
                <Input
                  id="dimension_width_in"
                  type="number"
                  step="0.01"
                  value={newBox.dimension_width_in}
                  onChange={(e) => setNewBox({ ...newBox, dimension_width_in: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dimension_height_in">Height (in)</Label>
                <Input
                  id="dimension_height_in"
                  type="number"
                  step="0.01"
                  value={newBox.dimension_height_in}
                  onChange={(e) => setNewBox({ ...newBox, dimension_height_in: e.target.value })}
                />
              </div>

              <div className="flex items-end">
                <Button 
                  onClick={handleAddBox} 
                  disabled={loading} 
                  className="w-full"
                  type="button"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Box
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
