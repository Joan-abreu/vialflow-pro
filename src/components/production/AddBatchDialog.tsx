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
import { Plus, Loader2 } from "lucide-react";

interface AddBatchDialogProps {
  onSuccess: () => void;
}

interface VialType {
  id: string;
  name: string;
  size_ml: number;
}

const AddBatchDialog = ({ onSuccess }: AddBatchDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vialTypes, setVialTypes] = useState<VialType[]>([]);
  const [formData, setFormData] = useState({
    batch_number: "",
    vial_type_id: "",
    quantity: "",
  });

  useEffect(() => {
    const generateBatchNumber = async () => {
      // Get today's date in YYYYMMDD format
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      
      // Get the count of batches created today
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();
      
      const { count } = await supabase
        .from("production_batches")
        .select("*", { count: 'exact', head: true })
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay);
      
      const nextNumber = (count || 0) + 1;
      const batchNumber = `BATCH-${dateStr}-${String(nextNumber).padStart(3, '0')}`;
      
      setFormData(prev => ({ ...prev, batch_number: batchNumber }));
    };

    const fetchVialTypes = async () => {
      const { data } = await supabase
        .from("vial_types")
        .select("*")
        .eq("active", true)
        .order("size_ml");
      
      if (data) setVialTypes(data);
    };
    
    if (open) {
      fetchVialTypes();
      generateBatchNumber();
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast.error("User not authenticated");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("production_batches").insert({
      batch_number: formData.batch_number.trim(),
      vial_type_id: formData.vial_type_id,
      quantity: parseInt(formData.quantity),
      created_by: user.id,
      status: "pending",
    });

    setLoading(false);

    if (error) {
      toast.error("Error creating batch: " + error.message);
    } else {
      toast.success("Production batch created successfully");
      setOpen(false);
      setFormData({
        batch_number: "",
        vial_type_id: "",
        quantity: "",
      });
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Batch
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Production Batch</DialogTitle>
            <DialogDescription>
              Start a new production batch
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="batch_number">Batch Number (Auto-generated)</Label>
              <Input
                id="batch_number"
                value={formData.batch_number}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vial_type">Vial Type *</Label>
              <Select
                value={formData.vial_type_id}
                onValueChange={(value) => setFormData({ ...formData, vial_type_id: value })}
                required
              >
                <SelectTrigger id="vial_type">
                  <SelectValue placeholder="Select vial type" />
                </SelectTrigger>
                <SelectContent>
                  {vialTypes.map((vial) => (
                    <SelectItem key={vial.id} value={vial.id}>
                      {vial.name} ({vial.size_ml}ml)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Batch
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddBatchDialog;
