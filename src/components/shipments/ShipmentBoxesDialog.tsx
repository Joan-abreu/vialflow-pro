// Cleaned ShipmentBoxesDialog component
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
import { updateBatchStatus } from "@/services/batches";
import { updateMaterialStock } from "@/services/inventory";

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

export const ShipmentBoxesDialog = ({
  shipmentId,
  shipmentNumber,
  onSuccess,
}: ShipmentBoxesDialogProps) => {
  const [open, setOpen] = useState(false);
  const [boxes, setBoxes] = useState<ShipmentBox[]>([]);
  const [boxMaterials, setBoxMaterials] = useState<
    Array<{ id: string; name: string; dimension_length_in: number | null; dimension_width_in: number | null; dimension_height_in: number | null }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [selectedBoxType, setSelectedBoxType] = useState("");
  const [batchInfo, setBatchInfo] = useState<
    { sale_type: string; pack_quantity: number; product_id: string; quantity: number } | null
  >(null);
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
  const [selectedBoxDetail, setSelectedBoxDetail] = useState<ShipmentBox | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const queryClient = useQueryClient();

  // Helper functions -------------------------------------------------------
  const parseShippingLabel = (scannedText: string) => {
    const upsMatch = scannedText.match(/1Z[A-Z0-9]{16}/);
    const fbaMatch = scannedText.match(/FBA[A-Z0-9]{10,}/i);
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
      setNewBox((prev) => ({ ...prev, ...updates }));
    } else {
      toast.error("No shipping label data found");
    }
  };

  const handleLabelDataExtracted = (extractedData: any) => {
    const updates: Partial<typeof newBox> = {};
    if (extractedData.box_number) updates.box_number = extractedData.box_number.toString();
    if (extractedData.destination) updates.destination = extractedData.destination;
    if (extractedData.ups_tracking_number) updates.ups_tracking_number = extractedData.ups_tracking_number;
    if (extractedData.fba_id) updates.fba_id = extractedData.fba_id;
    if (extractedData.weight_lb) updates.weight_lb = extractedData.weight_lb.toString();
    if (extractedData.dimension_length_in) updates.dimension_length_in = extractedData.dimension_length_in.toString();
    if (extractedData.dimension_width_in) updates.dimension_width_in = extractedData.dimension_width_in.toString();
    if (extractedData.dimension_height_in) updates.dimension_height_in = extractedData.dimension_height_in.toString();
    // Quantity handling based on batchInfo
    if (extractedData.qty && batchInfo) {
      const qty = parseInt(extractedData.qty);
      if (batchInfo.sale_type === "pack") {
        updates.packs_per_box = qty.toString();
        updates.bottles_per_box = (qty * batchInfo.pack_quantity).toString();
      } else {
        updates.bottles_per_box = qty.toString();
      }
    }
    setNewBox((prev) => ({ ...prev, ...updates }));
  };

  // Data fetching ----------------------------------------------------------
  const fetchBoxes = async () => {
    const { data, error } = await supabase
      .from("shipment_boxes")
      .select("*")
      .eq("shipment_id", shipmentId)
      .order("box_number");
    if (!error && data) setBoxes(data);
  };

  const fetchBoxMaterials = async () => {
    const { data, error } = await supabase
      .from("raw_materials")
      .select("id, name, dimension_length_in, dimension_width_in, dimension_height_in")
      .eq("category", "packaging")
      .not("dimension_length_in", "is", null)
      .order("name");
    if (!error && data) setBoxMaterials(data);
  };

  const fetchBatchInfo = async () => {
    const { data: shipment, error: shipmentError } = await supabase
      .from("shipments")
      .select("batch_id")
      .eq("id", shipmentId)
      .single();
    if (shipmentError) return;
    if (shipment?.batch_id) {
      const { data: batch, error: batchError } = await supabase
        .from("production_batches")
        .select("sale_type, pack_quantity, product_id, quantity")
        .eq("id", shipment.batch_id)
        .single();
      if (!batchError && batch) setBatchInfo(batch);
    }
  };

  useEffect(() => {
    if (open) {
      fetchBoxes();
      fetchBoxMaterials();
      fetchBatchInfo();
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
      setSelectedBoxDetail(null);
      setDetailOpen(false);
    }
  }, [open]);

  // Add / Delete handlers ---------------------------------------------------
  const handleAddBox = async () => {
    if (!newBox.box_number) {
      toast.error("Box number is required");
      return;
    }
    setLoading(true);
    try {
      // Get shipment to find batch
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

      // Get batch details (including product_id)
      const { data: batch, error: batchError } = await supabase
        .from("production_batches")
        .select("product_id, sale_type, pack_quantity, quantity")
        .eq("id", shipment.batch_id)
        .single();
      if (batchError) throw batchError;
      const { product_id, sale_type, pack_quantity, quantity: batchQuantity } = batch;

      // Get variant to obtain vial_type_id
      const { data: variant, error: variantError } = await supabase
        .from("product_variants")
        .select("vial_type_id")
        .eq("id", product_id)
        .single();
      if (variantError) throw variantError;
      const vialTypeId = variant.vial_type_id;

      // Get per_box materials for this vial type
      const { data: perBoxMaterials, error: materialsError } = await supabase
        .from("vial_type_materials")
        .select(`
          raw_material_id,
          quantity_per_unit,
          raw_materials(
            id,
            name,
            current_stock,
            unit,
            qty_per_container
          )
        `)
        .eq("vial_type_id", vialTypeId)
        .eq("application_type", "per_box");
      if (materialsError) throw materialsError;

      // Calculate current units in existing boxes
      const currentUnits = boxes.reduce((sum, box) => {
        if (sale_type === "pack") {
          return sum + (box.packs_per_box || 0);
        }
        return sum + (box.bottles_per_box || 0);
      }, 0);

      const newUnits = sale_type === "pack" ? parseInt(newBox.packs_per_box || "0") : parseInt(newBox.bottles_per_box || "0");
      const totalUnits = currentUnits + newUnits;

      if (totalUnits > batchQuantity) {
        toast.error(`The total units(${totalUnits}) exceed the batch quantity(${batchQuantity}).`);
        setLoading(false);
        return;
      }

      // Check stock for per_box materials
      const insufficientMaterials: string[] = [];
      const materialUpdates: Array<{ id: string; newStock: number }> = [];
      for (const vm of perBoxMaterials || []) {
        const material = vm.raw_materials as any;
        if (!material) {
          console.warn(`Material not found for vial type material ${vm.raw_material_id}`);
          continue;
        }
        const neededQuantity = vm.quantity_per_unit;
        const { data: stockData, error: stockError } = await supabase
          .rpc("get_material_stock_in_usage_units", { material_id: material.id });
        if (stockError) throw stockError;
        const availableStock = stockData || 0;
        if (availableStock < neededQuantity) {
          insufficientMaterials.push(`${material.name}: need ${neededQuantity.toFixed(2)} ${material.unit}, available ${availableStock.toFixed(2)}`);
        } else {
          const conversionFactor = material.qty_per_container || 1;
          const stockInPurchaseUnits = material.current_stock;
          const neededInPurchaseUnits = neededQuantity / conversionFactor;
          materialUpdates.push({ id: material.id, newStock: stockInPurchaseUnits - neededInPurchaseUnits });
        }
      }

      if (insufficientMaterials.length > 0) {
        toast.error("Insufficient materials for box:\n" + insufficientMaterials.join("\n"), { duration: 8000 });
        setLoading(false);
        return;
      }

      // Insert the box
      const { error: insertError } = await supabase.from("shipment_boxes").insert({
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
      if (insertError) throw insertError;

      await updateBatchStatus(shipment.batch_id);

      // Update material stocks
      try {
        for (const update of materialUpdates) {
          const { data: currentMaterial } = await supabase
            .from("raw_materials")
            .select("current_stock")
            .eq("id", update.id)
            .single();
          if (currentMaterial) {
            const quantityToDeduct = currentMaterial.current_stock - update.newStock;
            await updateMaterialStock(update.id, quantityToDeduct, "deduct");
          }
        }
        toast.success("Box added and per-box materials deducted from inventory");
      } catch (inventoryError: any) {
        toast.error("Box added but error updating inventory: " + inventoryError.message);
      }

      // Reset form
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
      const { data: boxInfo, error: boxInfoError } = await supabase
        .from("shipment_boxes")
        .select("shipment_id, shipments(batch_id)")
        .eq("id", boxId)
        .single();
      if (boxInfoError) throw boxInfoError;
      const shipmentIdDel = boxInfo.shipment_id;
      const batchId = boxInfo.shipments?.batch_id;
      if (!batchId || !shipmentIdDel) throw new Error("Missing batch or shipment");

      const { error: deleteError } = await supabase
        .from("shipment_boxes")
        .delete()
        .eq("id", boxId);
      if (deleteError) throw deleteError;

      const { data: remainingBoxes, error: remainingError } = await supabase
        .from("shipment_boxes")
        .select("id")
        .eq("shipment_id", shipmentIdDel);
      if (remainingError) throw remainingError;

      if (remainingBoxes.length === 0) {
        await supabase
          .from("shipments")
          .update({ status: "preparing", ups_delivery_date: null, shipped_at: null, delivered_at: null })
          .eq("id", shipmentIdDel);
      }

      await updateBatchStatus(batchId);
      toast.success("Box deleted successfully");
      fetchBoxes();
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      onSuccess?.();
      if (selectedBoxDetail?.id === boxId) {
        setSelectedBoxDetail(null);
        setDetailOpen(false);
      }
    } catch (error: any) {
      toast.error("Error deleting box");
    }
  };

  // Render ---------------------------------------------------------------
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Package className="mr-2 h-4 w-4" />
            View Boxes
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-[1200px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Boxes for Shipment {shipmentNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Existing Boxes */}
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
                          <TableCell className="flex space-x-2">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Box</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete Box #{box.box_number}?\nThis action cannot be undone.
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
                            <Button variant="outline" size="sm" onClick={() => { setSelectedBoxDetail(box); setDetailOpen(true); }}>
                              Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
            {/* Add New Box Form */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Add New Box</h3>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm font-medium">Scan Label:</span>
                <LabelImageScanner onDataExtracted={handleLabelDataExtracted} />
              </div>
              {false && (
                <div className="mb-6 p-4 border rounded-lg bg-muted/50">
                  <h4 className="text-sm font-medium mb-3">Or Scan Barcode</h4>
                  <BarcodeScanner onScan={parseShippingLabel} />
                </div>
              )}
              <div className="grid grid-cols-12 gap-2 mb-4">
                <div className="space-y-1">
                  <Label htmlFor="box_type" className="text-xs">Box Type</Label>
                  <Select
                    value={selectedBoxType}
                    onValueChange={(value) => {
                      setSelectedBoxType(value);
                      const selectedBox = boxMaterials.find((b) => b.id === value);
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
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Select" />
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
                <div className="space-y-1">
                  <Label htmlFor="box_number" className="text-xs">Box # *</Label>
                  <Input
                    id="box_number"
                    type="number"
                    value={newBox.box_number}
                    onChange={(e) => setNewBox({ ...newBox, box_number: e.target.value })}
                    className="h-8 text-sm"
                    placeholder="1"
                  />
                </div>
                {batchInfo?.sale_type === "pack" && (
                  <div className="space-y-1">
                    <Label htmlFor="packs_per_box" className="text-xs">Packs</Label>
                    <Input
                      id="packs_per_box"
                      type="number"
                      value={newBox.packs_per_box}
                      onChange={(e) => {
                        const packs = e.target.value;
                        const bottles = packs && batchInfo ? (parseInt(packs) * batchInfo.pack_quantity).toString() : "";
                        setNewBox({ ...newBox, packs_per_box: packs, bottles_per_box: bottles });
                      }}
                      className="h-8 text-sm"
                      placeholder="0"
                    />
                  </div>
                )}
                {batchInfo?.sale_type === "individual" && (
                  <div className="space-y-1">
                    <Label htmlFor="bottles_per_box" className="text-xs">Bottles</Label>
                    <Input
                      id="bottles_per_box"
                      type="number"
                      value={newBox.bottles_per_box}
                      onChange={(e) => setNewBox({ ...newBox, bottles_per_box: e.target.value })}
                      className="h-8 text-sm"
                      placeholder="0"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="weight_lb" className="text-xs">Weight (lb)</Label>
                  <Input
                    id="weight_lb"
                    type="number"
                    step="0.01"
                    value={newBox.weight_lb}
                    onChange={(e) => setNewBox({ ...newBox, weight_lb: e.target.value })}
                    className="h-8 text-sm"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dimension_length_in" className="text-xs">L (in)</Label>
                  <Input
                    id="dimension_length_in"
                    type="number"
                    step="0.01"
                    value={newBox.dimension_length_in}
                    onChange={(e) => setNewBox({ ...newBox, dimension_length_in: e.target.value })}
                    className="h-8 text-sm"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dimension_width_in" className="text-xs">W (in)</Label>
                  <Input
                    id="dimension_width_in"
                    type="number"
                    step="0.01"
                    value={newBox.dimension_width_in}
                    onChange={(e) => setNewBox({ ...newBox, dimension_width_in: e.target.value })}
                    className="h-8 text-sm"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dimension_height_in" className="text-xs">H (in)</Label>
                  <Input
                    id="dimension_height_in"
                    type="number"
                    step="0.01"
                    value={newBox.dimension_height_in}
                    onChange={(e) => setNewBox({ ...newBox, dimension_height_in: e.target.value })}
                    className="h-8 text-sm"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label htmlFor="ups_tracking_number" className="text-xs">UPS Tracking</Label>
                  <Input
                    id="ups_tracking_number"
                    value={newBox.ups_tracking_number}
                    onChange={(e) => setNewBox({ ...newBox, ups_tracking_number: e.target.value })}
                    placeholder="1Z..."
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fba_id" className="text-xs">FBA ID</Label>
                  <Input
                    id="fba_id"
                    value={newBox.fba_id}
                    onChange={(e) => setNewBox({ ...newBox, fba_id: e.target.value })}
                    placeholder="FBA..."
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="destination" className="text-xs">Dest</Label>
                  <Input
                    id="destination"
                    value={newBox.destination}
                    onChange={(e) => setNewBox({ ...newBox, destination: e.target.value })}
                    placeholder="IN"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-end">
                <Button onClick={handleAddBox} disabled={loading} className="w-full" type="button">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Box
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Box Details Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Box Details #{selectedBoxDetail?.box_number}</DialogTitle>
          </DialogHeader>
          {selectedBoxDetail && (
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Destination</TableCell>
                  <TableCell>{selectedBoxDetail.destination || "-"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">UPS Tracking</TableCell>
                  <TableCell>{selectedBoxDetail.ups_tracking_number || "-"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">FBA ID</TableCell>
                  <TableCell>{selectedBoxDetail.fba_id || "-"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Packs per Box</TableCell>
                  <TableCell>{selectedBoxDetail.packs_per_box ?? "-"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Bottles per Box</TableCell>
                  <TableCell>{selectedBoxDetail.bottles_per_box ?? "-"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Weight (lb)</TableCell>
                  <TableCell>{selectedBoxDetail.weight_lb ?? "-"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Dimensions (in)</TableCell>
                  <TableCell>
                    {selectedBoxDetail.dimension_length_in && selectedBoxDetail.dimension_width_in && selectedBoxDetail.dimension_height_in
                      ? `${selectedBoxDetail.dimension_length_in} × ${selectedBoxDetail.dimension_width_in} × ${selectedBoxDetail.dimension_height_in}`
                      : "-"}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
