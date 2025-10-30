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
  const [formData, setFormData] = useState({
    shipment_number: "",
    fba_id: "",
    destination: "",
    batch_id: "",
    box_number: "",
    packs_per_box: "",
    bottles_per_box: "",
    packing_date: "",
    ups_delivery_date: "",
    weight_lb: "",
    dimension_length_in: "",
    dimension_width_in: "",
    dimension_height_in: "",
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast.error("User not authenticated");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("shipments").insert({
      shipment_number: formData.shipment_number.trim(),
      fba_id: formData.fba_id.trim() || null,
      destination: formData.destination.trim(),
      batch_id: formData.batch_id || null,
      box_number: formData.box_number ? parseInt(formData.box_number) : null,
      packs_per_box: formData.packs_per_box ? parseInt(formData.packs_per_box) : null,
      bottles_per_box: formData.bottles_per_box ? parseInt(formData.bottles_per_box) : null,
      packing_date: formData.packing_date || null,
      ups_delivery_date: formData.ups_delivery_date || null,
      weight_lb: formData.weight_lb ? parseFloat(formData.weight_lb) : null,
      dimension_length_in: formData.dimension_length_in ? parseFloat(formData.dimension_length_in) : null,
      dimension_width_in: formData.dimension_width_in ? parseFloat(formData.dimension_width_in) : null,
      dimension_height_in: formData.dimension_height_in ? parseFloat(formData.dimension_height_in) : null,
      created_by: user.id,
      status: "preparing",
    });

    setLoading(false);

    if (error) {
      toast.error("Error creating shipment: " + error.message);
    } else {
      toast.success("Shipment created successfully");
      setOpen(false);
      setFormData({
        shipment_number: "",
        fba_id: "",
        destination: "",
        batch_id: "",
        box_number: "",
        packs_per_box: "",
        bottles_per_box: "",
        packing_date: "",
        ups_delivery_date: "",
        weight_lb: "",
        dimension_length_in: "",
        dimension_width_in: "",
        dimension_height_in: "",
      });
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Shipment Box</DialogTitle>
            <DialogDescription>
              Record a new shipment box to Amazon FBA
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="shipment_number">Shipment Number *</Label>
                <Input
                  id="shipment_number"
                  value={formData.shipment_number}
                  onChange={(e) => setFormData({ ...formData, shipment_number: e.target.value })}
                  placeholder="e.g., SHIP-001"
                  required
                  maxLength={50}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="box_number">Box # *</Label>
                <Input
                  id="box_number"
                  type="number"
                  value={formData.box_number}
                  onChange={(e) => setFormData({ ...formData, box_number: e.target.value })}
                  placeholder="1"
                  required
                  min="1"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="batch_id">Batch</Label>
              <Select
                value={formData.batch_id}
                onValueChange={(value) => setFormData({ ...formData, batch_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select batch (optional)" />
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
                <Label htmlFor="packs_per_box">Packs per Box</Label>
                <Input
                  id="packs_per_box"
                  type="number"
                  value={formData.packs_per_box}
                  onChange={(e) => setFormData({ ...formData, packs_per_box: e.target.value })}
                  placeholder="150"
                  min="0"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bottles_per_box">Bottles per Box</Label>
                <Input
                  id="bottles_per_box"
                  type="number"
                  value={formData.bottles_per_box}
                  onChange={(e) => setFormData({ ...formData, bottles_per_box: e.target.value })}
                  placeholder="300"
                  min="0"
                />
              </div>
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
              <Label htmlFor="weight_lb">Weight (lb)</Label>
              <Input
                id="weight_lb"
                type="number"
                step="0.01"
                value={formData.weight_lb}
                onChange={(e) => setFormData({ ...formData, weight_lb: e.target.value })}
                placeholder="25.5"
                min="0"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dimension_length_in">Length (in)</Label>
                <Input
                  id="dimension_length_in"
                  type="number"
                  step="0.1"
                  value={formData.dimension_length_in}
                  onChange={(e) => setFormData({ ...formData, dimension_length_in: e.target.value })}
                  placeholder="20"
                  min="0"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dimension_width_in">Width (in)</Label>
                <Input
                  id="dimension_width_in"
                  type="number"
                  step="0.1"
                  value={formData.dimension_width_in}
                  onChange={(e) => setFormData({ ...formData, dimension_width_in: e.target.value })}
                  placeholder="16"
                  min="0"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dimension_height_in">Height (in)</Label>
                <Input
                  id="dimension_height_in"
                  type="number"
                  step="0.1"
                  value={formData.dimension_height_in}
                  onChange={(e) => setFormData({ ...formData, dimension_height_in: e.target.value })}
                  placeholder="12"
                  min="0"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Shipment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddShipmentDialog;
