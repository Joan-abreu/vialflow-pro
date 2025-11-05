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
import { useToast } from "@/hooks/use-toast";
import { Pencil, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface VialType {
  id: string;
  name: string;
  size_ml: number;
}

interface EditBatchDialogProps {
  batch: {
    id: string;
    batch_number: string;
    quantity: number;
    status: string;
    sale_type: string;
    pack_quantity: number | null;
    vial_type_id: string;
    started_at: string | null;
  };
  onSuccess: () => void;
}

const EditBatchDialog = ({ batch, onSuccess }: EditBatchDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vialTypes, setVialTypes] = useState<VialType[]>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    vial_type_id: batch.vial_type_id,
    quantity: batch.sale_type === "pack" && batch.pack_quantity 
      ? (batch.quantity / batch.pack_quantity).toString() 
      : batch.quantity.toString(),
    status: batch.status,
    sale_type: batch.sale_type,
    pack_quantity: batch.pack_quantity?.toString() || "2",
    started_at: batch.started_at ? new Date(batch.started_at) : new Date(),
  });

  useEffect(() => {
    if (open) {
      fetchVialTypes();
    }
  }, [open]);

  const fetchVialTypes = async () => {
    const { data, error } = await supabase
      .from("vial_types")
      .select("*")
      .eq("active", true)
      .order("name");

    if (!error && data) {
      setVialTypes(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const inputQuantity = parseInt(formData.quantity);
    const pack_quantity = formData.sale_type === "pack" ? parseInt(formData.pack_quantity) : null;

    if (isNaN(inputQuantity) || inputQuantity <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid quantity",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (formData.sale_type === "pack" && (!pack_quantity || pack_quantity <= 0)) {
      toast({
        title: "Error",
        description: "Please enter a valid pack quantity",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // If sale type is pack, convert packs to bottles
    const totalBottles = formData.sale_type === "pack" && pack_quantity 
      ? inputQuantity * pack_quantity 
      : inputQuantity;

    const { error } = await supabase
      .from("production_batches")
      .update({
        vial_type_id: formData.vial_type_id,
        quantity: totalBottles,
        status: formData.status,
        sale_type: formData.sale_type,
        pack_quantity,
        started_at: formData.started_at.toISOString(),
      })
      .eq("id", batch.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update batch",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Batch updated successfully",
      });
      setOpen(false);
      onSuccess();
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Batch</DialogTitle>
          <DialogDescription>
            Update batch details for {batch.batch_number}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="vial_type">Vial Type</Label>
              <Select
                value={formData.vial_type_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, vial_type_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vial type" />
                </SelectTrigger>
                <SelectContent>
                  {vialTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name} ({type.size_ml}ml)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="sale_type">Sale Type</Label>
              <Select
                value={formData.sale_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, sale_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="pack">Pack</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Production Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !formData.started_at && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.started_at ? format(formData.started_at, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.started_at}
                    onSelect={(date) => setFormData({ ...formData, started_at: date || new Date() })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {formData.sale_type === "pack" && (
              <div className="grid gap-2">
                <Label htmlFor="pack_quantity">Units per Pack</Label>
                <Input
                  id="pack_quantity"
                  type="number"
                  min="1"
                  value={formData.pack_quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, pack_quantity: e.target.value })
                  }
                  required
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="quantity">
                Total Quantity {formData.sale_type === "pack" ? "(packs)" : "(bottles)"}
              </Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({ ...formData, quantity: e.target.value })
                }
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditBatchDialog;
