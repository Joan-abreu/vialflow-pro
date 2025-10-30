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
  box_number: number | null;
  packs_per_box: number | null;
  bottles_per_box: number | null;
  packing_date: string | null;
  ups_delivery_date: string | null;
  weight_lb: number | null;
  dimension_length_in: number | null;
  dimension_width_in: number | null;
  dimension_height_in: number | null;
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
    box_number: shipment.box_number?.toString() || "",
    packs_per_box: shipment.packs_per_box?.toString() || "",
    bottles_per_box: shipment.bottles_per_box?.toString() || "",
    packing_date: shipment.packing_date ? new Date(shipment.packing_date).toISOString().split('T')[0] : "",
    ups_delivery_date: shipment.ups_delivery_date ? new Date(shipment.ups_delivery_date).toISOString().split('T')[0] : "",
    weight_lb: shipment.weight_lb?.toString() || "",
    dimension_length_in: shipment.dimension_length_in?.toString() || "",
    dimension_width_in: shipment.dimension_width_in?.toString() || "",
    dimension_height_in: shipment.dimension_height_in?.toString() || "",
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
        box_number: formData.box_number ? parseInt(formData.box_number) : null,
        packs_per_box: formData.packs_per_box ? parseInt(formData.packs_per_box) : null,
        bottles_per_box: formData.bottles_per_box ? parseInt(formData.bottles_per_box) : null,
        packing_date: formData.packing_date || null,
        ups_delivery_date: formData.ups_delivery_date || null,
        weight_lb: formData.weight_lb ? parseFloat(formData.weight_lb) : null,
        dimension_length_in: formData.dimension_length_in ? parseFloat(formData.dimension_length_in) : null,
        dimension_width_in: formData.dimension_width_in ? parseFloat(formData.dimension_width_in) : null,
        dimension_height_in: formData.dimension_height_in ? parseFloat(formData.dimension_height_in) : null,
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
              <Label htmlFor="box_number">Número de Caja</Label>
              <Input
                id="box_number"
                type="number"
                value={formData.box_number}
                onChange={(e) => setFormData({ ...formData, box_number: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="packs_per_box">Paquetes por Caja</Label>
              <Input
                id="packs_per_box"
                type="number"
                value={formData.packs_per_box}
                onChange={(e) => setFormData({ ...formData, packs_per_box: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bottles_per_box">Botellas por Caja</Label>
              <Input
                id="bottles_per_box"
                type="number"
                value={formData.bottles_per_box}
                onChange={(e) => setFormData({ ...formData, bottles_per_box: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="weight_lb">Peso (lb)</Label>
              <Input
                id="weight_lb"
                type="number"
                step="0.01"
                value={formData.weight_lb}
                onChange={(e) => setFormData({ ...formData, weight_lb: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="packing_date">Fecha de Empaque</Label>
              <Input
                id="packing_date"
                type="date"
                value={formData.packing_date}
                onChange={(e) => setFormData({ ...formData, packing_date: e.target.value })}
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
              <Label htmlFor="dimension_length_in">Largo (in)</Label>
              <Input
                id="dimension_length_in"
                type="number"
                step="0.01"
                value={formData.dimension_length_in}
                onChange={(e) => setFormData({ ...formData, dimension_length_in: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dimension_width_in">Ancho (in)</Label>
              <Input
                id="dimension_width_in"
                type="number"
                step="0.01"
                value={formData.dimension_width_in}
                onChange={(e) => setFormData({ ...formData, dimension_width_in: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dimension_height_in">Alto (in)</Label>
              <Input
                id="dimension_height_in"
                type="number"
                step="0.01"
                value={formData.dimension_height_in}
                onChange={(e) => setFormData({ ...formData, dimension_height_in: e.target.value })}
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
