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
    purchase_unit_id?: string | null;
    usage_unit_id?: string | null;
    qty_per_container?: number | null;
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
    purchase_unit_id: material.purchase_unit_id || "",
    usage_unit_id: material.usage_unit_id || "",
    qty_per_container: material.qty_per_container || 0,
    current_stock: material.current_stock,
    min_stock_level: material.min_stock_level,
    cost_per_unit: material.cost_per_unit || 0,
    dimension_length_in: (material as any).dimension_length_in || 0,
    dimension_width_in: (material as any).dimension_width_in || 0,
    dimension_height_in: (material as any).dimension_height_in || 0,
  });

  useEffect(() => {
    if (open) {
      setFormData({
        name: material.name,
        category: material.category,
        unit: material.unit,
        purchase_unit_id: material.purchase_unit_id || "",
        usage_unit_id: material.usage_unit_id || "",
        qty_per_container: material.qty_per_container || 0,
        current_stock: material.current_stock,
        min_stock_level: material.min_stock_level,
        cost_per_unit: material.cost_per_unit || 0,
        dimension_length_in: (material as any).dimension_length_in || 0,
        dimension_width_in: (material as any).dimension_width_in || 0,
        dimension_height_in: (material as any).dimension_height_in || 0,
      });
      fetchUnits();
      fetchCategories();
    }
  }, [open, material]);

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
        purchase_unit_id: formData.purchase_unit_id || null,
        usage_unit_id: formData.usage_unit_id || null,
        qty_per_container: formData.qty_per_container || null,
        current_stock: formData.current_stock,
        min_stock_level: formData.min_stock_level,
        cost_per_unit: formData.cost_per_unit,
        dimension_length_in: formData.unit.toLowerCase().includes('box') && formData.dimension_length_in ? formData.dimension_length_in : null,
        dimension_width_in: formData.unit.toLowerCase().includes('box') && formData.dimension_width_in ? formData.dimension_width_in : null,
        dimension_height_in: formData.unit.toLowerCase().includes('box') && formData.dimension_height_in ? formData.dimension_height_in : null,
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
        <Button variant="ghost" size="sm" title="Edit">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Edit Material</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
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
                    <span className="capitalize">{cat.name}</span>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <Label htmlFor="purchase_unit">Purchase Unit</Label>
              <Select
                value={formData.purchase_unit_id}
                onValueChange={(value) => setFormData({ ...formData, purchase_unit_id: value })}
              >
                <SelectTrigger id="purchase_unit">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name} ({unit.abbreviation})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="usage_unit">Usage Unit</Label>
              <Select
                value={formData.usage_unit_id}
                onValueChange={(value) => setFormData({ ...formData, usage_unit_id: value })}
              >
                <SelectTrigger id="usage_unit">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name} ({unit.abbreviation})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="qty_per_container">Quantity per Container</Label>
            <Input
              id="qty_per_container"
              type="number"
              step="0.01"
              min="0"
              value={formData.qty_per_container}
              onChange={(e) =>
                setFormData({ ...formData, qty_per_container: parseFloat(e.target.value) })
              }
              placeholder="E.g., 12 bottles per case"
            />
          </div>
          {formData.unit.toLowerCase().includes('box') && (
            <>
              <div>
                <Label>Box Dimensions (inches)</Label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="dimension_length_in">Length</Label>
                  <Input
                    id="dimension_length_in"
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.dimension_length_in}
                    onChange={(e) =>
                      setFormData({ ...formData, dimension_length_in: parseFloat(e.target.value) })
                    }
                    placeholder="20"
                  />
                </div>
                <div>
                  <Label htmlFor="dimension_width_in">Width</Label>
                  <Input
                    id="dimension_width_in"
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.dimension_width_in}
                    onChange={(e) =>
                      setFormData({ ...formData, dimension_width_in: parseFloat(e.target.value) })
                    }
                    placeholder="16"
                  />
                </div>
                <div>
                  <Label htmlFor="dimension_height_in">Height</Label>
                  <Input
                    id="dimension_height_in"
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.dimension_height_in}
                    onChange={(e) =>
                      setFormData({ ...formData, dimension_height_in: parseFloat(e.target.value) })
                    }
                    placeholder="12"
                  />
                </div>
              </div>
            </>
          )}
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
