import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";

interface AddMaterialDialogProps {
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

const AddMaterialDialog = ({ onSuccess }: AddMaterialDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    unit: "",
    current_stock: "",
    min_stock_level: "",
    cost_per_unit: "",
    qty_per_box: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      const [unitsResponse, categoriesResponse] = await Promise.all([
        supabase
          .from("units_of_measurement")
          .select("*")
          .eq("active", true)
          .order("name"),
        supabase
          .from("material_categories")
          .select("*")
          .eq("active", true)
          .order("name")
      ]);
      
      if (unitsResponse.data) setUnits(unitsResponse.data);
      if (categoriesResponse.data) setCategories(categoriesResponse.data);
    };
    
    if (open) fetchData();
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from("raw_materials").insert({
      name: formData.name.trim(),
      category: formData.category,
      unit: formData.unit,
      current_stock: parseFloat(formData.current_stock) || 0,
      min_stock_level: parseFloat(formData.min_stock_level) || 0,
      cost_per_unit: formData.cost_per_unit ? parseFloat(formData.cost_per_unit) : null,
      qty_per_box: formData.qty_per_box && formData.unit.toLowerCase().includes('box') ? parseInt(formData.qty_per_box) : null,
    });

    setLoading(false);

    if (error) {
      toast.error("Error creating material: " + error.message);
    } else {
      toast.success("Material created successfully");
      setOpen(false);
      setFormData({
        name: "",
        category: "",
        unit: "",
        current_stock: "",
        min_stock_level: "",
        cost_per_unit: "",
        qty_per_box: "",
      });
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Material
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Material</DialogTitle>
            <DialogDescription>
              Add a new raw material to your inventory
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Material Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                maxLength={100}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
                required
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.name}>
                      <span className="capitalize">{category.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="unit">Unit of Measurement *</Label>
              <Select
                value={formData.unit}
                onValueChange={(value) => setFormData({ ...formData, unit: value, qty_per_box: "" })}
                required
              >
                <SelectTrigger id="unit">
                  <SelectValue placeholder="Select unit" />
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
            {formData.unit.toLowerCase().includes('box') && (
              <div className="grid gap-2">
                <Label htmlFor="qty_per_box">Quantity per Box *</Label>
                <Input
                  id="qty_per_box"
                  type="number"
                  min="1"
                  value={formData.qty_per_box}
                  onChange={(e) => setFormData({ ...formData, qty_per_box: e.target.value })}
                  required
                  placeholder="Enter units per box"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="current_stock">Current Stock</Label>
                <Input
                  id="current_stock"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.current_stock}
                  onChange={(e) => setFormData({ ...formData, current_stock: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="min_stock_level">Min Stock Level</Label>
                <Input
                  id="min_stock_level"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.min_stock_level}
                  onChange={(e) => setFormData({ ...formData, min_stock_level: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cost_per_unit">Cost per Unit (optional)</Label>
              <Input
                id="cost_per_unit"
                type="number"
                step="0.01"
                min="0"
                value={formData.cost_per_unit}
                onChange={(e) => setFormData({ ...formData, cost_per_unit: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Material
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddMaterialDialog;
