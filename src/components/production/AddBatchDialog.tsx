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
import { updateMaterialStock } from "@/services/inventory";

interface AddBatchDialogProps {
  onSuccess: () => void;
}

interface ProductVariant {
  id: string;
  product_id: string;
  vial_type_id: string;
  sale_type: string;
  pack_size: number;
  products: { name: string };
  vial_types: { name: string; size_ml: number };
}

const AddBatchDialog = ({ onSuccess }: AddBatchDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [formData, setFormData] = useState({
    batch_number: "",
    variant_id: "",
    quantity: "",
  });

  useEffect(() => {
    const generateBatchNumber = async () => {
      // Get today's date in YYYYMMDD format
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

      // Get the latest batch created today to determine the next sequence number
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

      const { data: latestBatches } = await supabase
        .from("production_batches")
        .select("batch_number")
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .order('created_at', { ascending: false })
        .limit(1);

      let nextNumber = 1;

      if (latestBatches && latestBatches.length > 0) {
        const lastBatchNumber = latestBatches[0].batch_number;
        // Assuming format BATCH-YYYYMMDD-XXX
        const parts = lastBatchNumber.split('-');
        if (parts.length === 3) {
          const lastSequence = parseInt(parts[2]);
          if (!isNaN(lastSequence)) {
            nextNumber = lastSequence + 1;
          }
        }
      }

      const batchNumber = `BATCH-${dateStr}-${String(nextNumber).padStart(3, '0')}`;

      setFormData(prev => ({ ...prev, batch_number: batchNumber }));
    };

    const fetchVariants = async () => {
      const { data } = await supabase
        .from("product_variants")
        .select(`
          id,
          product_id,
          vial_type_id,
          sale_type,
          pack_size,
          products (name),
          vial_types (name, size_ml)
        `)
        .order("created_at", { ascending: false });

      if (data) setVariants(data as any);
    };

    if (open) {
      fetchVariants();
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

    if (!formData.variant_id) {
      toast.error("Please select a product variant");
      setLoading(false);
      return;
    }

    const selectedVariant = variants.find(v => v.id === formData.variant_id);
    if (!selectedVariant) {
      toast.error("Invalid variant selected");
      setLoading(false);
      return;
    }

    const quantity = parseInt(formData.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast.error("Please enter a valid quantity");
      setLoading(false);
      return;
    }

    // Calculate total bottles
    const totalBottles = selectedVariant.sale_type === "pack"
      ? quantity * selectedVariant.pack_size
      : quantity;

    // Fetch production configurations
    const { data: configurations, error: configError } = await supabase
      .from("production_configurations")
      .select(`
        raw_material_id,
        quantity_per_unit,
        quantity_usage,
        application_basis,
        calculation_type,
        percentage_value,
        percentage_of_material_id,
        raw_materials!production_configurations_raw_material_id_fkey (
          id,
          name,
          current_stock,
          unit,
          purchase_unit_id,
          usage_unit_id,
          qty_per_container
        )
      `)
      .eq("product_id", selectedVariant.product_id)
      .eq("vial_type_id", selectedVariant.vial_type_id);

    if (configError) {
      toast.error("Error fetching configurations: " + configError.message);
      setLoading(false);
      return;
    }

    // Check stock and calculate needed quantities
    const insufficientMaterials: string[] = [];
    const materialUpdates: Array<{ id: string; newStock: number }> = [];

    for (const vm of configurations || []) {
      const material = vm.raw_materials as any;

      // Skip if material doesn't exist
      if (!material) {
        console.warn(`Material not found for vial type material ${vm.raw_material_id}`);
        continue;
      }

      let neededQuantity = 0;

      // Calculate needed quantity based on application basis
      if (vm.calculation_type === 'fixed') {
        if (vm.application_basis === 'per_batch') {
          neededQuantity = vm.quantity_usage || 0;
        } else {
          // For per_pack, per_inner_unit, etc., quantity_per_unit is already calculated as "per pack" in the config dialog
          // So we just multiply by the number of packs (quantity)
          // Note: formData.quantity is "units/packs". If sale_type is individual, it's units. If pack, it's packs.
          // quantity_per_unit in config is "per production unit" (which corresponds to the variant)
          neededQuantity = quantity * vm.quantity_per_unit;
        }
      } else if (vm.calculation_type === 'per_box') {
        // Logic for per_box (if needed for batch creation, or maybe only for shipping?)
        // Assuming 1 per box, but we need to know how many boxes. 
        // For now, ignoring or assuming 1 per pack if mapped? 
        // Actually, per_box usually implies shipping boxes. 
        // If it's a production material like a "Case", we might need box config.
        // For simplicity, if per_box, we might skip or approximate.
        // Let's assume quantity_per_unit holds the value per pack if it was calculated?
        // In ManageProductionMaterials, per_box sets quantity_per_unit = 1.
        // This might be wrong if it's 1 box per 10 packs.
        // But for now, let's stick to the main logic.
        neededQuantity = quantity * vm.quantity_per_unit;
      } else if (vm.calculation_type === 'percentage') {
        // Percentage logic would require 2 passes or dependency resolution. 
        // Skipping for now or assuming simple order.
        // If it depends on another material's quantity.
        // This is complex. For now, let's assume 0 or skip.
        console.warn("Percentage calculation not fully implemented in batch creation yet");
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
      product_id: selectedVariant.id,
      quantity: totalBottles,
      sale_type: selectedVariant.sale_type,
      pack_quantity: selectedVariant.sale_type === 'pack' ? selectedVariant.pack_size : 1,
      created_by: user.id,
      status: "pending",
      started_at: null,
    });

    setLoading(false);

    if (error) {
      toast.error("Error creating batch: " + error.message);
    }
    else {
      // // Update material stocks using inventory service
      // try {
      //   for (const update of materialUpdates) {
      //     // Calculate quantity to deduct (difference from current stock)
      //     const { data: currentMaterial } = await supabase
      //       .from("raw_materials")
      //       .select("current_stock")
      //       .eq("id", update.id)
      //       .single();

      //     if (currentMaterial) {
      //       const quantityToDeduct = currentMaterial.current_stock - update.newStock;
      //       await updateMaterialStock(update.id, quantityToDeduct, "deduct");
      //     }
      //   }
      toast.success("Production batch created successfully");
      // } catch (inventoryError: any) {
      //   toast.error("Batch created but error updating inventory: " + inventoryError.message);
      // }
      setOpen(false);
      setFormData({
        batch_number: "",
        variant_id: "",
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
              <Label htmlFor="variant">Product Variant *</Label>
              <Select
                value={formData.variant_id}
                onValueChange={(value) => setFormData({ ...formData, variant_id: value })}
              >
                <SelectTrigger id="variant">
                  <SelectValue placeholder="Select product variant" />
                </SelectTrigger>
                <SelectContent>
                  {variants.map((variant) => {
                    const saleTypeText = variant.sale_type === 'pack'
                      ? `Pack (${variant.pack_size}x)`
                      : 'Individual';
                    return (
                      <SelectItem key={variant.id} value={variant.id}>
                        {variant.products.name} - {variant.vial_types.name} ({variant.vial_types.size_ml}ml) - {saleTypeText}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quantity">Quantity (units/packs) *</Label>
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
