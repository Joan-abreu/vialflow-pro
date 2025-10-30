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
import { Plus } from "lucide-react";
import BarcodeScanner from "./BarcodeScanner";

interface AddShipmentDialogProps {
  onSuccess: () => void;
}

interface Batch {
  id: string;
  batch_number: string;
  quantity: number;
  sale_type: string;
  pack_quantity: number;
}

const AddShipmentDialog = ({ onSuccess }: AddShipmentDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [formData, setFormData] = useState({
    shipment_number: "",
    destination: "",
    batch_id: "",
    ups_tracking_number: "",
    fba_id: "",
    ups_delivery_date: "",
  });

  useEffect(() => {
    if (open) {
      fetchBatches();
    }
  }, [open]);

  const fetchBatches = async () => {
    const { data, error } = await supabase
      .from("production_batches")
      .select("id, batch_number, quantity, sale_type, pack_quantity")
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
      toast.error("Usuario no autenticado");
      setLoading(false);
      return;
    }

    try {
      // Generate shipment number if not provided
      let shipmentNumber = formData.shipment_number;
      if (!shipmentNumber) {
        const date = new Date();
        const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
        
        const { data: todayShipments } = await supabase
          .from("shipments")
          .select("shipment_number")
          .like("shipment_number", `SHIP-${dateStr}-%`);
        
        const shipmentCount = todayShipments?.length || 0;
        shipmentNumber = `SHIP-${dateStr}-${String(shipmentCount + 1).padStart(3, '0')}`;
      }

      const insertData: any = {
        shipment_number: shipmentNumber,
        destination: formData.destination || null,
        batch_id: formData.batch_id || null,
        ups_tracking_number: formData.ups_tracking_number || null,
        fba_id: formData.fba_id || null,
        ups_delivery_date: formData.ups_delivery_date || null,
        created_by: user.id,
        status: "preparing",
      };

      const { error } = await supabase.from("shipments").insert(insertData);

      if (error) throw error;

      toast.success("Envío creado correctamente. Ahora puedes agregar cajas.");
      setFormData({
        shipment_number: "",
        destination: "",
        batch_id: "",
        ups_tracking_number: "",
        fba_id: "",
        ups_delivery_date: "",
      });
      setOpen(false);
      onSuccess();
    } catch (error: any) {
      toast.error("Error al crear el envío: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Envío
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Envío</DialogTitle>
            <DialogDescription>
              Ingresa los detalles del envío. Podrás agregar las cajas después.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="shipment_number">Número de Envío (opcional)</Label>
              <Input
                id="shipment_number"
                value={formData.shipment_number}
                onChange={(e) => setFormData({ ...formData, shipment_number: e.target.value })}
                placeholder="Se generará automáticamente si se deja vacío"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="batch_id">Lote *</Label>
              <Select
                value={formData.batch_id}
                onValueChange={(value) => setFormData({ ...formData, batch_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un lote" />
                </SelectTrigger>
                <SelectContent>
                  {batches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.batch_number} ({batch.quantity} unidades)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="destination">Destino *</Label>
              <Input
                id="destination"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                placeholder="ej., Almacén FBA - CA"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ups_tracking_number">Número de Rastreo UPS</Label>
              <Input
                id="ups_tracking_number"
                value={formData.ups_tracking_number}
                onChange={(e) => setFormData({ ...formData, ups_tracking_number: e.target.value })}
                placeholder="Ingrese o escanee el código"
              />
              <BarcodeScanner 
                onScan={(code) => setFormData({ ...formData, ups_tracking_number: code })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="fba_id">FBA Shipment ID</Label>
              <Input
                id="fba_id"
                value={formData.fba_id}
                onChange={(e) => setFormData({ ...formData, fba_id: e.target.value })}
                placeholder="ej., FBA15GZKNNJ8"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ups_delivery_date">Fecha de Entrega UPS</Label>
              <Input
                id="ups_delivery_date"
                type="date"
                value={formData.ups_delivery_date}
                onChange={(e) => setFormData({ ...formData, ups_delivery_date: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear Envío"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddShipmentDialog;
