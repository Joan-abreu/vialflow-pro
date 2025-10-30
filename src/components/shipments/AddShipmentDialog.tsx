import { useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";

interface AddShipmentDialogProps {
  onSuccess: () => void;
}

const AddShipmentDialog = ({ onSuccess }: AddShipmentDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    shipment_number: "",
    fba_id: "",
    destination: "",
  });

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
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Shipment</DialogTitle>
            <DialogDescription>
              Create a new shipment to Amazon FBA
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
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
              <Label htmlFor="fba_id">Amazon FBA ID</Label>
              <Input
                id="fba_id"
                value={formData.fba_id}
                onChange={(e) => setFormData({ ...formData, fba_id: e.target.value })}
                placeholder="Optional"
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
