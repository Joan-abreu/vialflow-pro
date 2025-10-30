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

interface AddShipmentDialogProps {
  onSuccess: () => void;
}

interface Batch {
  id: string;
  batch_number: string;
  quantity: number;
}

const AddShipmentDialog = ({ onSuccess }: AddShipmentDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [step, setStep] = useState<"initial" | "boxes">("initial");
  const [numBoxes, setNumBoxes] = useState("");
  const [formData, setFormData] = useState({
    fba_id: "",
    destination: "",
    batch_id: "",
    packing_date: "",
    ups_delivery_date: "",
  });
  const [boxes, setBoxes] = useState<Array<{
    packs_per_box: string;
    bottles_per_box: string;
    weight_lb: string;
    dimension_length_in: string;
    dimension_width_in: string;
    dimension_height_in: string;
  }>>([]);

  useEffect(() => {
    if (open) {
      fetchBatches();
    }
  }, [open]);

  const fetchBatches = async () => {
    const { data, error } = await supabase
      .from("production_batches")
      .select("id, batch_number, quantity")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setBatches(data);
    }
  };

  const handleContinue = () => {
    if (!formData.batch_id) {
      toast.error("Please select a batch");
      return;
    }
    
    if (!formData.destination.trim()) {
      toast.error("Please enter a destination");
      return;
    }

    const count = parseInt(numBoxes);
    if (count > 0 && count <= 20) {
      setBoxes(Array(count).fill(null).map(() => ({
        packs_per_box: "",
        bottles_per_box: "",
        weight_lb: "",
        dimension_length_in: "",
        dimension_width_in: "",
        dimension_height_in: "",
      })));
      setStep("boxes");
    } else {
      toast.error("Please enter a valid number of boxes (1-20)");
    }
  };

  const updateBox = (index: number, field: string, value: string) => {
    const newBoxes = [...boxes];
    newBoxes[index] = { ...newBoxes[index], [field]: value };
    setBoxes(newBoxes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast.error("User not authenticated");
      setLoading(false);
      return;
    }

    // Generate shipment number
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    
    // Get count of today's shipments to generate unique number
    const { data: todayShipments } = await supabase
      .from("shipments")
      .select("shipment_number")
      .like("shipment_number", `SHIP-${dateStr}-%`);
    
    const shipmentCount = todayShipments?.length || 0;
    const shipmentNumber = `SHIP-${dateStr}-${String(shipmentCount + 1).padStart(3, '0')}`;

    // Create all boxes as separate shipment records
    const shipments = boxes.map((box, index) => ({
      shipment_number: shipmentNumber,
      fba_id: formData.fba_id.trim() || null,
      destination: formData.destination.trim(),
      batch_id: formData.batch_id,
      box_number: index + 1,
      packs_per_box: box.packs_per_box ? parseInt(box.packs_per_box) : null,
      bottles_per_box: box.bottles_per_box ? parseInt(box.bottles_per_box) : null,
      packing_date: formData.packing_date || null,
      ups_delivery_date: formData.ups_delivery_date || null,
      weight_lb: box.weight_lb ? parseFloat(box.weight_lb) : null,
      dimension_length_in: box.dimension_length_in ? parseFloat(box.dimension_length_in) : null,
      dimension_width_in: box.dimension_width_in ? parseFloat(box.dimension_width_in) : null,
      dimension_height_in: box.dimension_height_in ? parseFloat(box.dimension_height_in) : null,
      created_by: user.id,
      status: "preparing",
    }));

    const { error } = await supabase.from("shipments").insert(shipments);

    setLoading(false);

    if (error) {
      toast.error("Error creating shipments: " + error.message);
    } else {
      toast.success(`Shipment ${shipmentNumber} with ${boxes.length} boxes created successfully`);
      setOpen(false);
      setStep("initial");
      setNumBoxes("");
      setFormData({
        fba_id: "",
        destination: "",
        batch_id: "",
        packing_date: "",
        ups_delivery_date: "",
      });
      setBoxes([]);
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Shipment
        </Button>
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
                  onValueChange={(value) => setFormData({ ...formData, batch_id: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {batches.map((batch) => (
                      <SelectItem key={batch.id} value={batch.id}>
                        {batch.batch_number} ({batch.quantity} units)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="packing_date">Packing Date</Label>
                  <Input
                    id="packing_date"
                    type="date"
                    value={formData.packing_date}
                    onChange={(e) => setFormData({ ...formData, packing_date: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ups_delivery_date">UPS Delivery Date</Label>
                  <Input
                    id="ups_delivery_date"
                    type="date"
                    value={formData.ups_delivery_date}
                    onChange={(e) => setFormData({ ...formData, ups_delivery_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="fba_id">FBA Shipment ID</Label>
                <Input
                  id="fba_id"
                  value={formData.fba_id}
                  onChange={(e) => setFormData({ ...formData, fba_id: e.target.value })}
                  placeholder="e.g., FBA15GZKNNJ8"
                  maxLength={100}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="destination">Destination *</Label>
                <Input
                  id="destination"
                  value={formData.destination}
                  onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  placeholder="e.g., FBA Warehouse - CA"
                  required
                  maxLength={200}
                />
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
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleContinue}>
                Continue to Box Details
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Box Details</DialogTitle>
              <DialogDescription>
                Enter details for each of the {boxes.length} boxes
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              {boxes.map((box, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  <h3 className="font-semibold text-lg">Box #{index + 1}</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor={`packs_${index}`}>Packs per Box</Label>
                      <Input
                        id={`packs_${index}`}
                        type="number"
                        value={box.packs_per_box}
                        onChange={(e) => updateBox(index, "packs_per_box", e.target.value)}
                        placeholder="150"
                        min="0"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`bottles_${index}`}>Bottles per Box</Label>
                      <Input
                        id={`bottles_${index}`}
                        type="number"
                        value={box.bottles_per_box}
                        onChange={(e) => updateBox(index, "bottles_per_box", e.target.value)}
                        placeholder="300"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor={`weight_${index}`}>Weight (lb)</Label>
                    <Input
                      id={`weight_${index}`}
                      type="number"
                      step="0.01"
                      value={box.weight_lb}
                      onChange={(e) => updateBox(index, "weight_lb", e.target.value)}
                      placeholder="25.5"
                      min="0"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor={`length_${index}`}>Length (in)</Label>
                      <Input
                        id={`length_${index}`}
                        type="number"
                        step="0.1"
                        value={box.dimension_length_in}
                        onChange={(e) => updateBox(index, "dimension_length_in", e.target.value)}
                        placeholder="20"
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
                        placeholder="16"
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
                        placeholder="12"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep("initial")}>
                Back
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create {boxes.length} Boxes
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AddShipmentDialog;
