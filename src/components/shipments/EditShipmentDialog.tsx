import { useState } from "react";
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
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import BarcodeScanner from "./BarcodeScanner";

interface Shipment {
  id: string;
  shipment_number: string;
  status: string;
  batch_id: string | null;
  ups_delivery_date: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
}

interface EditShipmentDialogProps {
  shipment: Shipment;
}

export const EditShipmentDialog = ({ shipment }: EditShipmentDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    shipment_number: shipment.shipment_number,
    status: shipment.status,
    ups_delivery_date: shipment.ups_delivery_date ? new Date(shipment.ups_delivery_date).toISOString().split('T')[0] : "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updateData: any = {
        status: formData.status,
        ups_delivery_date: formData.ups_delivery_date || null,
      };

      // Update status timestamps
      if (formData.status === "shipped" && !shipment.shipped_at) {
        updateData.shipped_at = new Date().toISOString();
      }
      if (formData.status === "delivered" && !shipment.delivered_at) {
        updateData.delivered_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("shipments")
        .update(updateData)
        .eq("id", shipment.id);

      if (error) throw error;

      toast.success("Shipment updated successfully");
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
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
        <Button variant="ghost" size="sm">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Edit Shipment</DialogTitle>
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
                <Label htmlFor="status">Status *</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preparing">Preparing</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="ups_delivery_date">UPS Delivery Date</Label>
                <Input
                  id="ups_delivery_date"
                  type="date"
                  value={formData.ups_delivery_date}
                  onChange={(e) => setFormData({ ...formData, ups_delivery_date: e.target.value })}
                />
              </div>
            </div>

            <div className="text-sm text-muted-foreground mb-4">
              <p><strong>Note:</strong> Destinations, UPS Tracking Numbers, and FBA IDs are now managed per box. Use the "View Boxes" button to add/edit these details for each individual box.</p>
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
              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
