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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface AddBatchDialogProps {
  onSuccess: () => void;
}

interface VialType {
  id: string;
  name: string;
  size_ml: number;
}

interface Product {
  id: string;
  name: string;
}

const AddBatchDialog = ({ onSuccess }: AddBatchDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vialTypes, setVialTypes] = useState<VialType[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [formData, setFormData] = useState({
    batch_number: "",
    product_id: "",
    vial_type_id: "",
    quantity: "",
    sale_type: "individual",
    units_per_pack: "2",
    started_at: null as Date | null,
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

    const fetchProducts = async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
      
      if (data) setProducts(data);
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
      fetchProducts();
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

    if (!formData.product_id) {
      toast.error("Please select a product");
      setLoading(false);
      return;
    }

    if (!formData.vial_type_id) {
      toast.error("Please select a vial type");
      setLoading(false);
      return;
    }

    // Validate and calculate materials needed
    const unitsPerPack = formData.sale_type === "pack" ? parseInt(formData.units_per_pack) : 1;
    const numberOfPacks = formData.sale_type === "pack" ? parseInt(formData.quantity) : parseInt(formData.quantity);

    if (formData.sale_type === "pack") {
      if (isNaN(numberOfPacks) || numberOfPacks <= 0) {
        toast.error("Please enter a valid number of packs");
        setLoading(false);
        return;
      }
      if (isNaN(unitsPerPack) || unitsPerPack <= 0) {
        toast.error("Please enter a valid units per pack");
        setLoading(false);
        return;
      }
    } else {
      if (isNaN(numberOfPacks) || numberOfPacks <= 0) {
        toast.error("Please enter a valid quantity");
        setLoading(false);
        return;
      }
    }

    // Calculate total bottles
    const totalBottles = formData.sale_type === "pack" 
      ? numberOfPacks * unitsPerPack 
      : numberOfPacks;

    // Fetch vial type materials
    const { data: vialMaterials, error: materialsError } = await supabase
      .from("vial_type_materials")
      .select(`
        raw_material_id,
        quantity_per_unit,
        application_type,
        raw_materials (
          id,
          name,
          current_stock,
          unit,
          purchase_unit_id,
          usage_unit_id,
          qty_per_container
        )
      `)
      .eq("vial_type_id", formData.vial_type_id);

    if (materialsError) {
      toast.error("Error fetching materials: " + materialsError.message);
      setLoading(false);
      return;
    }

    // Check stock and calculate needed quantities
    const insufficientMaterials: string[] = [];
    const materialUpdates: Array<{ id: string; newStock: number }> = [];

    for (const vm of vialMaterials || []) {
      const material = vm.raw_materials as any;
      
      // Skip if material doesn't exist
      if (!material) {
        console.warn(`Material not found for vial type material ${vm.raw_material_id}`);
        continue;
      }
      
      let neededQuantity = 0;

      // Calculate based on application type (skip per_box as those are used in shipments)
      if (vm.application_type === 'per_unit') {
        neededQuantity = totalBottles * vm.quantity_per_unit;
      } else if (vm.application_type === 'per_pack') {
        neededQuantity = numberOfPacks * vm.quantity_per_unit;
      }

      if (neededQuantity > 0) {
        // Get current stock in usage units
        const { data: stockData, error: stockError } = await supabase
          .rpc('get_material_stock_in_usage_units', { material_id: material.id });

        if (stockError) {
          toast.error(`Error checking stock for ${material.name}`);
          setLoading(false);
          return;
        }

        const availableStock = stockData || 0;

        if (availableStock < neededQuantity) {
          insufficientMaterials.push(
            `${material.name}: need ${neededQuantity.toFixed(2)} ${material.unit}, available ${availableStock.toFixed(2)}`
          );
        } else {
          // Calculate new stock in purchase units
          const conversionFactor = material.qty_per_container || 1;
          const stockInPurchaseUnits = material.current_stock;
          const neededInPurchaseUnits = neededQuantity / conversionFactor;
          
          materialUpdates.push({
            id: material.id,
            newStock: stockInPurchaseUnits - neededInPurchaseUnits
          });
        }
      }
    }

    if (insufficientMaterials.length > 0) {
      toast.error("Insufficient materials:\n" + insufficientMaterials.join("\n"), {
        duration: 8000,
      });
      setLoading(false);
      return;
    }

    // Create the batch
    const { error } = await supabase.from("production_batches").insert({
      batch_number: formData.batch_number.trim(),
      vial_type_id: formData.vial_type_id,
      product_id: formData.product_id,
      quantity: totalBottles,
      sale_type: formData.sale_type,
      pack_quantity: unitsPerPack,
      created_by: user.id,
      status: formData.started_at ? "in_progress" : "pending",
      started_at: formData.started_at ? formData.started_at.toISOString() : null,
    });

    setLoading(false);

    if (error) {
      toast.error("Error creating batch: " + error.message);
    } else {
      // Update material stocks
      for (const update of materialUpdates) {
        const { error: updateError } = await supabase
          .from("raw_materials")
          .update({ current_stock: update.newStock })
          .eq("id", update.id);

        if (updateError) {
          console.error("Error updating material stock:", updateError);
        }
      }

      toast.success("Production batch created and materials deducted from inventory");
      setOpen(false);
      setFormData({
        batch_number: "",
        product_id: "",
        vial_type_id: "",
        quantity: "",
        sale_type: "individual",
        units_per_pack: "2",
        started_at: null,
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
              <Label htmlFor="product">Product *</Label>
              <Select
                value={formData.product_id}
                onValueChange={(value) => setFormData({ ...formData, product_id: value })}
              >
                <SelectTrigger id="product">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vial_type">Vial Type *</Label>
              <Select
                value={formData.vial_type_id}
                onValueChange={(value) => setFormData({ ...formData, vial_type_id: value })}
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
              <Label>Production Start Date</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      type="button"
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
            <div className="grid gap-2">
              <Label>Sale Type *</Label>
              <RadioGroup
                value={formData.sale_type}
                onValueChange={(value) => setFormData({ ...formData, sale_type: value })}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="individual" id="individual" />
                  <Label htmlFor="individual" className="font-normal cursor-pointer">
                    Individual
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pack" id="pack" />
                  <Label htmlFor="pack" className="font-normal cursor-pointer">
                    Pack
                  </Label>
                </div>
              </RadioGroup>
            </div>
            {formData.sale_type === "pack" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="quantity">Number of Packs *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="units_per_pack">Units per Pack *</Label>
                  <Input
                    id="units_per_pack"
                    type="number"
                    min="1"
                    value={formData.units_per_pack}
                    onChange={(e) => setFormData({ ...formData, units_per_pack: e.target.value })}
                    required
                  />
                </div>
              </>
            )}
            {formData.sale_type === "individual" && (
              <div className="grid gap-2">
                <Label htmlFor="quantity">Quantity (bottles) *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  required
                />
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto text-xs sm:text-sm">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto text-xs sm:text-sm">
              {loading && <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />}
              Create Batch
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddBatchDialog;
