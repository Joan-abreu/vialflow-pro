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
import { updateBatchStatus } from "@/services/batches";

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
        batch_id: batch.id,
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
    await updateBatchStatus(batch.id);

    toast({
      title: "Success",
      description: `Shipment ${shipment_number} created successfully`,
    });

    setLoading(false);
    setOpen(false);
    setFormData({
      quantity: "",
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
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Create Shipment</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
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
            <div className="text-sm text-muted-foreground border-t pt-4">
              <p><strong>Note:</strong> After creating the shipment, you can add boxes with their specific destinations, FBA IDs, and tracking numbers from the Shipments page.</p>
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
