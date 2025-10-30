import { useState, useEffect } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pencil, Loader2 } from "lucide-react";

interface EditMaterialDialogProps {
  material: {
    id: string;
    name: string;
    category: string;
    unit: string;
    current_stock: number;
    min_stock_level: number;
    cost_per_unit: number | null;
  };
  onSuccess: () => void;
}

interface Unit {
  id: string;
  name: string;
  abbreviation: string;
}

interface Category {
  id: string;
  name: string;
}

const EditMaterialDialog = ({ material, onSuccess }: EditMaterialDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    name: material.name,
    category: material.category,
    unit: material.unit,
    current_stock: material.current_stock,
    min_stock_level: material.min_stock_level,
    cost_per_unit: material.cost_per_unit || 0,
  });

  useEffect(() => {
    if (open) {
      fetchUnits();
      fetchCategories();
    }
  }, [open]);

  const fetchUnits = async () => {
    const { data } = await supabase
      .from("units_of_measurement")
      .select("*")
      .eq("active", true);
    if (data) setUnits(data);
  };

  const fetchCategories = async () => {
    const { data } = await supabase
      .from("material_categories")
      .select("*")
      .eq("active", true);
    if (data) setCategories(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from("raw_materials")
      .update({
        name: formData.name,
        category: formData.category,
        unit: formData.unit,
        current_stock: formData.current_stock,
        min_stock_level: formData.min_stock_level,
        cost_per_unit: formData.cost_per_unit,
      })
      .eq("id", material.id);

    setLoading(false);

    if (error) {
      toast.error("Error updating material");
    } else {
      toast.success("Material updated successfully");
      setOpen(false);
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Material</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.name}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="unit">Unit</Label>
            <Select
              value={formData.unit}
              onValueChange={(value) => setFormData({ ...formData, unit: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {units.map((unit) => (
                  <SelectItem key={unit.id} value={unit.abbreviation}>
                    {unit.name} ({unit.abbreviation})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="current_stock">Current Stock</Label>
            <Input
              id="current_stock"
              type="number"
              step="0.01"
              value={formData.current_stock}
              onChange={(e) =>
                setFormData({ ...formData, current_stock: parseFloat(e.target.value) })
              }
              required
            />
          </div>
          <div>
            <Label htmlFor="min_stock_level">Minimum Stock Level</Label>
            <Input
              id="min_stock_level"
              type="number"
              step="0.01"
              value={formData.min_stock_level}
              onChange={(e) =>
                setFormData({ ...formData, min_stock_level: parseFloat(e.target.value) })
              }
              required
            />
          </div>
          <div>
            <Label htmlFor="cost_per_unit">Cost per Unit</Label>
            <Input
              id="cost_per_unit"
              type="number"
              step="0.01"
              value={formData.cost_per_unit}
              onChange={(e) =>
                setFormData({ ...formData, cost_per_unit: parseFloat(e.target.value) })
              }
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditMaterialDialog;
