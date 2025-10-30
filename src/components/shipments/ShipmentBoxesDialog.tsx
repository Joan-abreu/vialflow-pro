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
import { Package, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ShipmentBox {
  id: string;
  box_number: number;
  packs_per_box: number | null;
  bottles_per_box: number | null;
  weight_lb: number | null;
  dimension_length_in: number | null;
  dimension_width_in: number | null;
  dimension_height_in: number | null;
}

interface ShipmentBoxesDialogProps {
  shipmentId: string;
  shipmentNumber: string;
}

export const ShipmentBoxesDialog = ({ shipmentId, shipmentNumber }: ShipmentBoxesDialogProps) => {
  const [open, setOpen] = useState(false);
  const [boxes, setBoxes] = useState<ShipmentBox[]>([]);
  const [boxMaterials, setBoxMaterials] = useState<Array<{ id: string; name: string; dimension_length_in: number | null; dimension_width_in: number | null; dimension_height_in: number | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBoxType, setSelectedBoxType] = useState("");
  const [newBox, setNewBox] = useState({
    box_number: "",
    packs_per_box: "",
    bottles_per_box: "",
    weight_lb: "",
    dimension_length_in: "",
    dimension_width_in: "",
    dimension_height_in: "",
  });
  const queryClient = useQueryClient();

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

  useEffect(() => {
    if (open) {
      fetchBoxes();
      fetchBoxMaterials();
    }
  }, [open, shipmentId]);

  const handleAddBox = async () => {
    if (!newBox.box_number) {
      toast.error("Box number is required");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("shipment_boxes").insert({
        shipment_id: shipmentId,
        box_number: parseInt(newBox.box_number),
        packs_per_box: newBox.packs_per_box ? parseInt(newBox.packs_per_box) : null,
        bottles_per_box: newBox.bottles_per_box ? parseInt(newBox.bottles_per_box) : null,
        weight_lb: newBox.weight_lb ? parseFloat(newBox.weight_lb) : null,
        dimension_length_in: newBox.dimension_length_in ? parseFloat(newBox.dimension_length_in) : null,
        dimension_width_in: newBox.dimension_width_in ? parseFloat(newBox.dimension_width_in) : null,
        dimension_height_in: newBox.dimension_height_in ? parseFloat(newBox.dimension_height_in) : null,
      });

      if (error) throw error;

      toast.success("Box added successfully");
      setNewBox({
        box_number: "",
        packs_per_box: "",
        bottles_per_box: "",
        weight_lb: "",
        dimension_length_in: "",
        dimension_width_in: "",
        dimension_height_in: "",
      });
      fetchBoxes();
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
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
                <Label htmlFor="packs_per_box">Packs</Label>
                <Input
                  id="packs_per_box"
                  type="number"
                  value={newBox.packs_per_box}
                  onChange={(e) => setNewBox({ ...newBox, packs_per_box: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bottles_per_box">Bottles</Label>
                <Input
                  id="bottles_per_box"
                  type="number"
                  value={newBox.bottles_per_box}
                  onChange={(e) => setNewBox({ ...newBox, bottles_per_box: e.target.value })}
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
                <Button onClick={handleAddBox} disabled={loading} className="w-full">
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
