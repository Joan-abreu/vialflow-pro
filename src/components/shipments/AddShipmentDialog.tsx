import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import BarcodeScanner from "./BarcodeScanner";
import { LabelImageScanner } from "./LabelImageScanner";
import { updateBatchStatus } from "@/services/batches";

interface AddShipmentDialogProps {
  onSuccess: () => void;
  initialBatchId?: string;
  trigger?: React.ReactNode;
}

interface Batch {
  id: string;
  batch_number: string;
  quantity: number;
  sale_type: string;
  pack_quantity: number;
  status: string;
}

interface BoxMaterial {
  id: string;
  name: string;
  dimension_length_in: number | null;
  dimension_width_in: number | null;
  dimension_height_in: number | null;
}

const AddShipmentDialog = ({ onSuccess, initialBatchId, trigger }: AddShipmentDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [boxes, setBoxes] = useState<BoxMaterial[]>([]);
  const [step, setStep] = useState<"initial" | "boxes">("initial");
  const [numBoxes, setNumBoxes] = useState("");
  const [selectedBoxType, setSelectedBoxType] = useState("");
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [createdShipmentId, setCreatedShipmentId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    batch_id: "",
    ups_delivery_date: "",
  });
  const [boxesData, setBoxesData] = useState<Array<{
    packs_per_box: string;
    bottles_per_box: string;
    weight_lb: string;
    dimension_length_in: string;
    dimension_width_in: string;
    dimension_height_in: string;
    destination: string;
    ups_tracking_number: string;
    fba_id: string;
  }>>([]);

  useEffect(() => {
    if (open) {
      fetchBatches();
      fetchBoxes();
      
      // Set initial batch if provided
      if (initialBatchId && formData.batch_id === "") {
        setFormData(prev => ({ ...prev, batch_id: initialBatchId }));
        const batch = batches.find(b => b.id === initialBatchId);
        if (batch) {
          setSelectedBatch(batch);
        }
      }
    }
  }, [open, initialBatchId]);
  
  useEffect(() => {
    // Update selected batch when batches are loaded and initialBatchId is set
    if (initialBatchId && batches.length > 0 && !selectedBatch) {
      const batch = batches.find(b => b.id === initialBatchId);
      if (batch) {
        setSelectedBatch(batch);
        setFormData(prev => ({ ...prev, batch_id: initialBatchId }));
      }
    }
  }, [batches, initialBatchId, selectedBatch]);

  const fetchBatches = async () => {
    const { data, error } = await supabase
      .from("production_batches")
      .select("id, batch_number, quantity, sale_type, pack_quantity, status")
      .neq("status", "completed")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setBatches(data);
    }
  };

  const fetchBoxes = async () => {
    const { data, error } = await supabase
      .from("raw_materials")
      .select("id, name, dimension_length_in, dimension_width_in, dimension_height_in")
      .eq("category", "packaging")
      .not("dimension_length_in", "is", null)
      .order("name");

    if (!error && data) {
      setBoxes(data);
    }
  };

  const handleContinue = async () => {
    if (!formData.batch_id) {
      toast.error("Please select a batch");
      return;
    }

    const count = parseInt(numBoxes);
    if (!count || count <= 0 || count > 20) {
      toast.error("Please enter a valid number of boxes (1-20)");
      return;
    }

    // Create the shipment first
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast.error("User not authenticated");
      return;
    }

    try {
      setLoading(true);

      // Generate shipment number
      const date = new Date();
      const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
      
      const { data: todayShipments } = await supabase
        .from("shipments")
        .select("shipment_number")
        .like("shipment_number", `SHIP-${dateStr}-%`);
      
      const shipmentCount = todayShipments?.length || 0;
      const shipmentNumber = `SHIP-${dateStr}-${String(shipmentCount + 1).padStart(3, '0')}`;

      const insertData: any = {
        shipment_number: shipmentNumber,
        batch_id: formData.batch_id || null,
        ups_delivery_date: formData.ups_delivery_date || null,
        created_by: user.id,
        status: "preparing",
      };

      const { data: shipmentData, error } = await supabase
        .from("shipments")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      setCreatedShipmentId(shipmentData.id);

      // Get selected box dimensions
      const selectedBox = boxes.find(b => b.id === selectedBoxType);
      const defaultDimensions = selectedBox ? {
        dimension_length_in: selectedBox.dimension_length_in?.toString() || "",
        dimension_width_in: selectedBox.dimension_width_in?.toString() || "",
        dimension_height_in: selectedBox.dimension_height_in?.toString() || "",
      } : {
        dimension_length_in: "",
        dimension_width_in: "",
        dimension_height_in: "",
      };

      setBoxesData(Array(count).fill(null).map(() => ({
        packs_per_box: "",
        bottles_per_box: "",
        weight_lb: "",
        destination: "",
        ups_tracking_number: "",
        fba_id: "",
        ...defaultDimensions,
      })));

      // Update batch
      await updateBatchStatus(formData.batch_id);
      
      setStep("boxes");
    } catch (error: any) {
      toast.error("Error creating shipment: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLabelDataExtracted = (index: number, extractedData: any) => {
    const newBoxes = [...boxesData];
    
    if (extractedData.destination) {
      newBoxes[index].destination = extractedData.destination;
    }
    if (extractedData.ups_tracking_number) {
      newBoxes[index].ups_tracking_number = extractedData.ups_tracking_number;
    }
    if (extractedData.fba_id) {
      newBoxes[index].fba_id = extractedData.fba_id;
    }
    if (extractedData.weight_lb) {
      newBoxes[index].weight_lb = extractedData.weight_lb.toString();
    }
    if (extractedData.dimension_length_in) {
      newBoxes[index].dimension_length_in = extractedData.dimension_length_in.toString();
    }
    if (extractedData.dimension_width_in) {
      newBoxes[index].dimension_width_in = extractedData.dimension_width_in.toString();
    }
    if (extractedData.dimension_height_in) {
      newBoxes[index].dimension_height_in = extractedData.dimension_height_in.toString();
    }
    
    // Handle quantity based on batch sale_type
    if (extractedData.qty && selectedBatch) {
      const qty = parseInt(extractedData.qty);
      if (selectedBatch.sale_type === "pack") {
        // For pack batches: qty goes to packs_per_box, calculate bottles_per_box
        newBoxes[index].packs_per_box = qty.toString();
        newBoxes[index].bottles_per_box = (qty * (selectedBatch.pack_quantity || 1)).toString();
      } else {
        // For individual batches: qty goes to bottles_per_box
        newBoxes[index].bottles_per_box = qty.toString();
      }
    }

    setBoxesData(newBoxes);
  };

  const updateBox = (index: number, field: string, value: string) => {
    const newBoxes = [...boxesData];
    newBoxes[index] = { ...newBoxes[index], [field]: value };
    
    // Auto-calculate bottles_per_box only when packs_per_box changes in pack-type batches
    if (field === "packs_per_box" && selectedBatch?.sale_type === "pack") {
      const packsPerBox = parseInt(value) || 0;
      const bottlesPerBox = packsPerBox * (selectedBatch.pack_quantity || 1);
      newBoxes[index].bottles_per_box = bottlesPerBox.toString();
    }
    
    setBoxesData(newBoxes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!createdShipmentId) {
        throw new Error("Shipment ID not found");
      }

      const { data: batchData, error: batchError } = await supabase
        .from("production_batches")
        .select("sale_type, quantity")
        .eq("id", formData.batch_id)
        .single();

      if (batchError) throw batchError;
      if (!batchData) throw new Error("Batch not found");

      const { sale_type, quantity } = batchData;

      const totalUnitsInBoxes = boxesData.reduce((sum, box) => {
        if (sale_type === "pack") {
          return sum + (box.packs_per_box ? parseInt(box.packs_per_box) : 0);
        }
        return sum + (box.bottles_per_box ? parseInt(box.bottles_per_box) : 0);
      }, 0);

      if (totalUnitsInBoxes > quantity) {
        throw new Error(
          `The total units in boxes (${totalUnitsInBoxes}) cannot exceed the batch quantity (${quantity}).`
        );
      }

      // Create all boxes
      const boxesInsertData = boxesData.map((box, index) => ({
        shipment_id: createdShipmentId,
        box_number: index + 1,
        packs_per_box: box.packs_per_box ? parseInt(box.packs_per_box) : null,
        bottles_per_box: box.bottles_per_box ? parseInt(box.bottles_per_box) : null,
        weight_lb: box.weight_lb ? parseFloat(box.weight_lb) : null,
        dimension_length_in: box.dimension_length_in ? parseFloat(box.dimension_length_in) : null,
        dimension_width_in: box.dimension_width_in ? parseFloat(box.dimension_width_in) : null,
        dimension_height_in: box.dimension_height_in ? parseFloat(box.dimension_height_in) : null,
        destination: box.destination || null,
        ups_tracking_number: box.ups_tracking_number || null,
        fba_id: box.fba_id || null,
      }));

      const { error } = await supabase.from("shipment_boxes").insert(boxesInsertData);

      if (error) throw error;

      updateBatchStatus(formData.batch_id);

      toast.success(`Shipment created successfully with ${boxesData.length} boxes`);
      setOpen(false);
      setStep("initial");
      setNumBoxes("");
      setSelectedBoxType("");
      setCreatedShipmentId(null);
      setFormData({
        batch_id: "",
        ups_delivery_date: "",
      });
      setBoxesData([]);
      onSuccess();
    } catch (error: any) {
      toast.error("Error creating boxes: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setOpen(false);
    setStep("initial");
    setNumBoxes("");
    setSelectedBoxType("");
    setCreatedShipmentId(null);
    setFormData({
      batch_id: "",
      ups_delivery_date: "",
    });
    setBoxesData([]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Shipment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        {step === "initial" ? (
          <div>
            <DialogHeader>
              <DialogTitle>Create New Shipment</DialogTitle>
              <DialogDescription>
                Enter shipment details and number of boxes
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="batch_id">Batch *</Label>
                <Select
                  value={formData.batch_id}
                  onValueChange={(value) => {
                    setFormData({ ...formData, batch_id: value });
                    const batch = batches.find(b => b.id === value);
                    setSelectedBatch(batch || null);
                  }}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {batches.map((batch) => (
                      <SelectItem key={batch.id} value={batch.id}>
                        {batch.batch_number} ({batch.sale_type === 'pack' 
                          ? `${batch.quantity / batch.pack_quantity} packs (${batch.pack_quantity} units per pack)` 
                          : `${batch.quantity} units - individual`})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="ups_delivery_date">UPS Delivery Date (optional)</Label>
                <Input
                  id="ups_delivery_date"
                  type="date"
                  value={formData.ups_delivery_date}
                  onChange={(e) => setFormData({ ...formData, ups_delivery_date: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="box_type">Box Type (optional)</Label>
                <Select
                  value={selectedBoxType}
                  onValueChange={(value) => setSelectedBoxType(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select box type for default dimensions" />
                  </SelectTrigger>
                  <SelectContent>
                    {boxes.map((box) => (
                      <SelectItem key={box.id} value={box.id}>
                        {box.name} ({box.dimension_length_in}" x {box.dimension_width_in}" x {box.dimension_height_in}")
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="num_boxes">Number of Boxes *</Label>
                <Input
                  id="num_boxes"
                  type="number"
                  min="1"
                  max="20"
                  value={numBoxes}
                  onChange={(e) => setNumBoxes(e.target.value)}
                  placeholder="How many boxes?"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="button" onClick={handleContinue} disabled={loading}>
                {loading ? "Creating..." : "Continue to Box Details"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Box Details</DialogTitle>
              <DialogDescription>
                Enter details for each of the {boxesData.length} boxes
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              {boxesData.map((box, index) => (
                <div key={index} className={`border rounded-lg p-4 space-y-4 ${index % 2 === 0 ? 'bg-muted/50' : 'bg-background'}`}>
                  <h3 className="font-semibold text-lg">Box #{index + 1}</h3>
                  
                  {/* Label Scanner */}
                  <div className="mb-4 p-4 border rounded-lg bg-primary/5">
                    <h4 className="text-sm font-medium mb-3">Scan Shipping Label</h4>
                    <LabelImageScanner onDataExtracted={(data) => handleLabelDataExtracted(index, data)} />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {selectedBatch?.sale_type === "pack" && (
                      <div className="grid gap-2">
                        <Label htmlFor={`packs_${index}`}>Packs per Box *</Label>
                        <Input
                          id={`packs_${index}`}
                          type="number"
                          value={box.packs_per_box}
                          onChange={(e) => updateBox(index, "packs_per_box", e.target.value)}
                          placeholder="Enter packs quantity"
                          min="0"
                          required
                        />
                      </div>
                    )}
                    {selectedBatch?.sale_type === "individual" && (
                      <div className="grid gap-2">
                        <Label htmlFor={`bottles_${index}`}>Bottles per Box *</Label>
                        <Input
                          id={`bottles_${index}`}
                          type="number"
                          value={box.bottles_per_box}
                          onChange={(e) => updateBox(index, "bottles_per_box", e.target.value)}
                          placeholder="Enter bottles quantity"
                          min="0"
                          required
                        />
                      </div>
                    )}
                    <div className="grid gap-2">
                      <Label htmlFor={`bottles_calc_${index}`}>Bottles per Box (calculated)</Label>
                      <Input
                        id={`bottles_calc_${index}`}
                        type="number"
                        value={box.bottles_per_box}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor={`length_${index}`}>Length (in)</Label>
                      <Input
                        id={`length_${index}`}
                        type="number"
                        step="0.1"
                        value={box.dimension_length_in}
                        onChange={(e) => updateBox(index, "dimension_length_in", e.target.value)}
                        placeholder="Length"
                        min="0"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`width_${index}`}>Width (in)</Label>
                      <Input
                        id={`width_${index}`}
                        type="number"
                        step="0.1"
                        value={box.dimension_width_in}
                        onChange={(e) => updateBox(index, "dimension_width_in", e.target.value)}
                        placeholder="Width"
                        min="0"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`height_${index}`}>Height (in)</Label>
                      <Input
                        id={`height_${index}`}
                        type="number"
                        step="0.1"
                        value={box.dimension_height_in}
                        onChange={(e) => updateBox(index, "dimension_height_in", e.target.value)}
                        placeholder="Height"
                        min="0"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`weight_${index}`}>Weight (lb) *</Label>
                      <Input
                        id={`weight_${index}`}
                        type="number"
                        step="0.01"
                        value={box.weight_lb}
                        onChange={(e) => updateBox(index, "weight_lb", e.target.value)}
                        placeholder="Weight"
                        min="0"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor={`ups_tracking_${index}`}>UPS Tracking Number</Label>
                      <Input
                        id={`ups_tracking_${index}`}
                        value={box.ups_tracking_number}
                        onChange={(e) => updateBox(index, "ups_tracking_number", e.target.value)}
                        placeholder="1Z..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`fba_id_${index}`}>FBA ID</Label>
                      <Input
                        id={`fba_id_${index}`}
                        value={box.fba_id}
                        onChange={(e) => updateBox(index, "fba_id", e.target.value)}
                        placeholder="FBA..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`destination_${index}`}>Destination *</Label>
                      <Input
                        id={`destination_${index}`}
                        value={box.destination}
                        onChange={(e) => updateBox(index, "destination", e.target.value)}
                        placeholder="e.g., IN, FL, CA"
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create {boxesData.length} Boxes
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AddShipmentDialog;
