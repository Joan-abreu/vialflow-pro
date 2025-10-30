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
import { Pencil } from "lucide-react";
import { toast } from "sonner";

interface Shipment {
  id: string;
  shipment_number: string;
  destination: string | null;
  status: string;
  batch_id: string | null;
  ups_delivery_date: string | null;
  ups_tracking_number: string | null;
  fba_id: string | null;
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
    destination: shipment.destination || "",
    status: shipment.status,
    ups_delivery_date: shipment.ups_delivery_date ? new Date(shipment.ups_delivery_date).toISOString().split('T')[0] : "",
    ups_tracking_number: shipment.ups_tracking_number || "",
    fba_id: shipment.fba_id || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updateData: any = {
        shipment_number: formData.shipment_number,
        destination: formData.destination || null,
        status: formData.status,
        ups_delivery_date: formData.ups_delivery_date || null,
        ups_tracking_number: formData.ups_tracking_number || null,
        fba_id: formData.fba_id || null,
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

      toast.success("Envío actualizado correctamente");
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      setOpen(false);
    } catch (error: any) {
      toast.error("Error al actualizar el envío");
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Envío</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shipment_number">Número de Envío *</Label>
              <Input
                id="shipment_number"
                value={formData.shipment_number}
                onChange={(e) => setFormData({ ...formData, shipment_number: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Estado *</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preparing">Preparando</SelectItem>
                  <SelectItem value="shipped">Enviado</SelectItem>
                  <SelectItem value="delivered">Entregado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="destination">Destino</Label>
              <Input
                id="destination"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ups_delivery_date">Fecha de Entrega UPS</Label>
              <Input
                id="ups_delivery_date"
                type="date"
                value={formData.ups_delivery_date}
                onChange={(e) => setFormData({ ...formData, ups_delivery_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ups_tracking_number">Número de Rastreo UPS</Label>
              <Input
                id="ups_tracking_number"
                value={formData.ups_tracking_number}
                onChange={(e) => setFormData({ ...formData, ups_tracking_number: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fba_id">FBA ID</Label>
              <Input
                id="fba_id"
                value={formData.fba_id}
                onChange={(e) => setFormData({ ...formData, fba_id: e.target.value })}
              />
            </div>
          </div>

          <div className="text-sm text-muted-foreground mb-4">
            <p>Para gestionar las cajas de este envío, usa el botón "Ver Cajas".</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
