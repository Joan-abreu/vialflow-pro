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
import { useToast } from "@/hooks/use-toast";
import { PackageOpen } from "lucide-react";

interface CreateShipmentDialogProps {
  batch: {
    id: string;
    batch_number: string;
    quantity: number;
    shipped_quantity?: number;
  };
  onSuccess: () => void;
}

const CreateShipmentDialog = ({ batch, onSuccess }: CreateShipmentDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    quantity: "",
    fba_id: "",
    destination: "Amazon FBA",
  });

  const remainingQuantity = batch.quantity - (batch.shipped_quantity || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const quantity = parseInt(formData.quantity);
    if (quantity > remainingQuantity) {
      toast({
        title: "Error",
        description: `Cannot ship more than ${remainingQuantity} kits remaining`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Generate shipment number
    const timestamp = Date.now().toString().slice(-6);
    const shipment_number = `SHP-${timestamp}`;

    // Create shipment
    const { data: shipment, error: shipmentError } = await supabase
      .from("shipments")
      .insert({
        shipment_number,
        fba_id: formData.fba_id,
        destination: formData.destination,
        created_by: user.id,
        status: "preparing",
      })
      .select()
      .single();

    if (shipmentError) {
      toast({
        title: "Error",
        description: shipmentError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Create shipment item
    const { error: itemError } = await supabase
      .from("shipment_items")
      .insert({
        shipment_id: shipment.id,
        batch_id: batch.id,
        quantity,
      });

    if (itemError) {
      toast({
        title: "Error",
        description: itemError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Update batch status
    const newShippedQuantity = (batch.shipped_quantity || 0) + quantity;
    let newStatus = "in_progress";
    if (newShippedQuantity >= batch.quantity) {
      newStatus = "completed";
    } else if (newShippedQuantity > 0) {
      newStatus = "in_progress";
    }

    await supabase
      .from("production_batches")
      .update({
        status: newStatus,
        started_at: batch.shipped_quantity === 0 ? new Date().toISOString() : undefined,
        completed_at: newStatus === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", batch.id);

    toast({
      title: "Success",
      description: `Shipment ${shipment_number} created successfully`,
    });

    setLoading(false);
    setOpen(false);
    setFormData({
      quantity: "",
      fba_id: "",
      destination: "Amazon FBA",
    });
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <PackageOpen className="h-4 w-4 mr-2" />
          Ship
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Shipment</DialogTitle>
            <DialogDescription>
              Batch {batch.batch_number} - {remainingQuantity} kits remaining
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="quantity">Quantity (kits) *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                max={remainingQuantity}
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                required
              />
              <p className="text-sm text-muted-foreground">
                Max: {remainingQuantity} kits
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fba_id">FBA Shipment ID *</Label>
              <Input
                id="fba_id"
                placeholder="e.g., FBA15XXXXXX"
                value={formData.fba_id}
                onChange={(e) => setFormData({ ...formData, fba_id: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="destination">Destination</Label>
              <Input
                id="destination"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Shipment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateShipmentDialog;
