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
    started_at: batch.started_at ? new Date(batch.started_at) : null as Date | null,
    waste_quantity: "0",
    waste_notes: "",
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

    const waste_quantity = parseInt(formData.waste_quantity) || 0;

    const { error } = await supabase
      .from("production_batches")
      .update({
        vial_type_id: formData.vial_type_id,
        quantity: totalBottles,
        status: formData.started_at ? "in_progress" : "pending",
        sale_type: formData.sale_type,
        pack_quantity,
        started_at: formData.started_at ? formData.started_at.toISOString() : null,
        waste_quantity,
        waste_notes: formData.waste_notes || null,
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
        <Button variant="ghost" size="icon" title="Edit">
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
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-left font-normal",
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
                      selected={formData.started_at || undefined}
                      onSelect={(date) => setFormData({ ...formData, started_at: date || null })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {formData.started_at && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFormData({ ...formData, started_at: null })}
                  >
                    Clear
                  </Button>
                )}
              </div>
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

            <div className="grid gap-2">
              <Label htmlFor="waste_quantity">Waste Quantity</Label>
              <Input
                id="waste_quantity"
                type="number"
                min="0"
                value={formData.waste_quantity}
                onChange={(e) =>
                  setFormData({ ...formData, waste_quantity: e.target.value })
                }
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Number of units lost during production (broken vials, bottles, caps, labels, etc.)
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="waste_notes">Waste Notes</Label>
              <Input
                id="waste_notes"
                value={formData.waste_notes}
                onChange={(e) =>
                  setFormData({ ...formData, waste_notes: e.target.value })
                }
                placeholder="e.g., 5 vials broken, 3 labels damaged"
              />
              <p className="text-xs text-muted-foreground">
                Describe what materials were wasted
              </p>
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
