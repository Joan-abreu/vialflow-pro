import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRight, Truck } from "lucide-react";
import { toast } from "sonner";
import BarcodeScanner from "./BarcodeScanner";
import { updateBatchStatus } from "@/services/batches";

interface Shipment {
  id: string;
  shipment_number: string;
  status: string;
  batch_id: string | null;
  ups_delivery_date: string | null;
  delivered_at: string | null;
}

interface EditShipmentDialogProps {
  shipment: Shipment;
  onSuccess?: () => void;
}

export const EditShipmentDialog = ({ shipment, onSuccess }: EditShipmentDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    shipment_number: shipment.shipment_number,
    status: shipment.status,
    ups_delivery_date: shipment.ups_delivery_date ? new Date(shipment.ups_delivery_date).toISOString().split('T')[0] : "",
  });

  useEffect(() => {
    if (open) {
      setFormData({
        shipment_number: shipment.shipment_number,
        status: shipment.status,
        ups_delivery_date: shipment.ups_delivery_date
          ? new Date(shipment.ups_delivery_date).toISOString().split("T")[0]
          : "",
      });
    } else {
      setFormData({
        shipment_number: "",
        status: "",
        ups_delivery_date: "",
      });
    }
  }, [open, shipment]);

  useEffect(() => {
    if (!formData.ups_delivery_date) {
      setFormData((prev) => ({ ...prev, status: "preparing" }));
    } else {
      setFormData((prev) => ({ ...prev, status: "delivered" }));
    }
  }, [formData.ups_delivery_date]);

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);

  try {
    let newStatus = formData.status;

    if (!formData.ups_delivery_date) {
      newStatus = "preparing";
    } else if (formData.ups_delivery_date && formData.status === "preparing") {
      newStatus = "delivered";
    }

    const updateData: any = {
      status: newStatus,
      ups_delivery_date: formData.ups_delivery_date || null,
    };

    // Update status timestamps
    if (newStatus === "delivered" && !shipment.delivered_at) {
      updateData.delivered_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("shipments")
      .update(updateData)
      .eq("id", shipment.id);

    if (error) throw error;

    updateBatchStatus(shipment.batch_id);

    toast.success("Shipment updated successfully");
    queryClient.invalidateQueries({ queryKey: ["shipments"] });
    onSuccess?.();
    setOpen(false);
  } catch (error: any) {
    toast.error("Error updating shipment");
    console.error("Error:", error);
  } finally {
    setLoading(false);
  }
  };


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title={shipment.ups_delivery_date ? "Edit Delivery Info" : "Mark as Delivered"}>
          <Truck
            className={`h-4 w-4 ${
              shipment.ups_delivery_date ? "text-green-600" : "text-blue-500"
            }`}
          />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Edit Delivery Info</DialogTitle>
          <DialogDescription>
            Edit shipment delivery information.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-8rem)]">
          <form onSubmit={handleSubmit} className="space-y-4 px-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shipment_number">Shipment Number</Label>
                <Input
                  id="shipment_number"
                  value={formData.shipment_number}
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ups_delivery_date">UPS Delivery Date</Label>
                <Input
                  id="ups_delivery_date"
                  type="date"
                  value={formData.ups_delivery_date}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      ups_delivery_date: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto"
              >
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
