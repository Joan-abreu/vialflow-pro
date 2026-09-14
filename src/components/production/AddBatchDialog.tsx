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
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2, RefreshCw, Dices, ShieldCheck, Sparkles } from "lucide-react";
import {
  generateBatchNumber,
  generateUniqueBatchNumber,
  BatchStrategy,
  extractProductPrefix,
} from "@/utils/batchGenerator";

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
  vial_types: {
    name: string;
    capacity_ml: number;
    color: string | null;
    shape: string | null;
  };
}

const AddBatchDialog = ({ onSuccess }: AddBatchDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [strategy, setStrategy] = useState<BatchStrategy>("hybrid");
  const [preRegisterCoa, setPreRegisterCoa] = useState<boolean>(true);
  const [supplierNotes, setSupplierNotes] = useState<string>("");

  const [formData, setFormData] = useState({
    batch_number: "",
    variant_id: "",
    quantity: "",
  });

  const getSelectedVariant = () => {
    return variants.find((v) => v.id === formData.variant_id);
  };

  const regenerateBatch = async (strat: BatchStrategy = strategy, selectedVar?: ProductVariant) => {
    setIsGenerating(true);
    try {
      const activeVariant = selectedVar || getSelectedVariant();
      const productName = activeVariant?.products?.name || "Peptide";

      let nextSeq = 1;
      if (strat === "sequential_date") {
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
        const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

        const { data: latestBatches } = await supabase
          .from("production_batches")
          .select("batch_number")
          .gte("created_at", startOfDay)
          .lte("created_at", endOfDay)
          .order("created_at", { ascending: false })
          .limit(1);

        if (latestBatches && latestBatches.length > 0) {
          const lastBatch = latestBatches[0].batch_number;
          const parts = lastBatch.split("-");
          if (parts.length >= 3) {
            const lastSeq = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
          }
        }
      }

      const newBatch = await generateUniqueBatchNumber({
        productName,
        strategy: strat,
        sequentialNumber: nextSeq,
      });

      setFormData((prev) => ({ ...prev, batch_number: newBatch }));
    } catch (err) {
      console.error("Error generating batch:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
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
          vial_types(name, capacity_ml, color, shape)
        `)
        .order("created_at", { ascending: false });

      if (data) setVariants(data as any);
    };

    if (open) {
      fetchVariants();
      regenerateBatch("hybrid");
    }
  }, [open]);

  // When variant changes, adapt batch number prefix
  const handleVariantChange = (variantId: string) => {
    const chosen = variants.find((v) => v.id === variantId);
    setFormData((prev) => ({ ...prev, variant_id: variantId }));
    if (chosen) {
      regenerateBatch(strategy, chosen);
    }
  };

  const handleStrategyChange = (newStrat: BatchStrategy) => {
    setStrategy(newStrat);
    regenerateBatch(newStrat);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

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

    const selectedVariant = variants.find((v) => v.id === formData.variant_id);
    if (!selectedVariant) {
      toast.error("Invalid variant selected");
      setLoading(false);
      return;
    }

    const cleanBatchNumber = formData.batch_number.trim().toUpperCase();
    if (!cleanBatchNumber) {
      toast.error("Please enter or generate a batch number");
      setLoading(false);
      return;
    }

    const quantity = parseInt(formData.quantity, 10);
    if (isNaN(quantity) || quantity <= 0) {
      toast.error("Please enter a valid quantity");
      setLoading(false);
      return;
    }

    // Calculate total bottles
    const totalBottles =
      selectedVariant.sale_type === "pack"
        ? quantity * selectedVariant.pack_size
        : quantity;

    // Check if batch number already exists
    const { data: existingBatch } = await supabase
      .from("production_batches")
      .select("id")
      .eq("batch_number", cleanBatchNumber)
      .maybeSingle();

    if (existingBatch) {
      toast.error(`Batch number "${cleanBatchNumber}" is already in use. Please generate another.`);
      setLoading(false);
      return;
    }

    // 1. Create the production batch
    const { data: createdBatch, error: batchError } = await supabase
      .from("production_batches")
      .insert({
        batch_number: cleanBatchNumber,
        product_id: selectedVariant.id,
        variant_id: selectedVariant.id,
        quantity: totalBottles,
        sale_type: selectedVariant.sale_type,
        pack_quantity: selectedVariant.sale_type === "pack" ? selectedVariant.pack_size : 1,
        created_by: user.id,
        status: "pending",
        started_at: null,
        waste_notes: supplierNotes ? `Supplier Intake: ${supplierNotes}` : null,
      })
      .select("id")
      .single();

    if (batchError) {
      toast.error("Error creating batch: " + batchError.message);
      setLoading(false);
      return;
    }

    // 2. Optionally pre-register draft COA for tracking testing status
    if (preRegisterCoa) {
      try {
        const todayStr = new Date().toISOString().split("T")[0];
        await supabase.from("product_coas" as any).insert({
          batch_number: cleanBatchNumber,
          product_id: selectedVariant.product_id,
          product_ids: [selectedVariant.product_id],
          test_date: todayStr,
          pdf_url: "",
          sterility_status: "Pending Test",
          lab_name: "3rd Party Accredited US Lab",
          is_active: false,
          is_featured: false,
        });
      } catch (coaErr) {
        console.warn("Could not pre-register COA draft:", coaErr);
      }
    }

    setLoading(false);
    toast.success(`Batch ${cleanBatchNumber} created successfully!`);
    setOpen(false);
    setFormData({
      batch_number: "",
      variant_id: "",
      quantity: "",
    });
    setSupplierNotes("");
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="font-bold">
          <Plus className="mr-2 h-4 w-4" />
          New Batch
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[540px] max-h-[92vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                📦
              </span>
              Create Production / Supplier Batch
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Assign a certified lot number to incoming or manufactured peptide vials.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-3 text-xs sm:text-sm">
            {/* Variant Selector */}
            <div className="grid gap-1.5">
              <Label htmlFor="variant" className="font-bold">
                Product Variant *
              </Label>
              <Select
                value={formData.variant_id}
                onValueChange={handleVariantChange}
              >
                <SelectTrigger id="variant" className="h-9">
                  <SelectValue placeholder="Select product variant" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {variants.map((variant) => {
                    const saleTypeText =
                      variant.sale_type === "pack"
                        ? `Pack (${variant.pack_size}x)`
                        : "Individual";
                    return (
                      <SelectItem key={variant.id} value={variant.id}>
                        {variant.products.name} - {variant.vial_types.name} (
                        {variant.vial_types.capacity_ml}ml
                        {variant.vial_types.color ? ` - ${variant.vial_types.color}` : ""}
                        {variant.vial_types.shape ? ` - ${variant.vial_types.shape}` : ""}
                        ) - {saleTypeText}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Batch Strategy & Generator Box */}
            <div className="p-3 bg-muted/40 border rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Lot Number Generator
                </span>
                <span className="text-[11px] font-semibold text-primary">
                  US Laboratory Standard
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => handleStrategyChange("hybrid")}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    strategy === "hybrid"
                      ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                      : "bg-background hover:bg-muted text-muted-foreground border-border"
                  }`}
                >
                  <p className="font-bold leading-tight text-[11px]">Híbrido Lab</p>
                  <p className="text-[9.5px] opacity-80 mt-0.5 font-mono">BPC-2609-7X2</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleStrategyChange("random_safe")}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    strategy === "random_safe"
                      ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                      : "bg-background hover:bg-muted text-muted-foreground border-border"
                  }`}
                >
                  <p className="font-bold leading-tight text-[11px]">Aleatorio Safe</p>
                  <p className="text-[9.5px] opacity-80 mt-0.5 font-mono">BPC-8K9N2W</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleStrategyChange("sequential_date")}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    strategy === "sequential_date"
                      ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                      : "bg-background hover:bg-muted text-muted-foreground border-border"
                  }`}
                >
                  <p className="font-bold leading-tight text-[11px]">Secuencial</p>
                  <p className="text-[9.5px] opacity-80 mt-0.5 font-mono">BPC-260914-01</p>
                </button>
              </div>

              {/* Editable Batch Input + Regenerate Button */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    id="batch_number"
                    value={formData.batch_number}
                    onChange={(e) =>
                      setFormData({ ...formData, batch_number: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. BPC-2609-7X2"
                    className="font-mono font-bold text-sm uppercase tracking-wider h-10 bg-background"
                    required
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => regenerateBatch(strategy)}
                  disabled={isGenerating}
                  title="Generate new random batch number"
                  className="h-10 w-10 shrink-0 border-primary/30 text-primary hover:bg-primary/10"
                >
                  <RefreshCw className={`h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
                </Button>
              </div>

              <p className="text-[11px] text-muted-foreground">
                {strategy === "hybrid" &&
                  "✨ Combina el prefijo del producto, año/mes de recepción y 3 caracteres aleatorios (Crockford Base32) para total privacidad comercial."}
                {strategy === "random_safe" &&
                  "🔒 6 caracteres alfanuméricos criptográficamente seguros excluyendo caracteres ambiguos (0, O, 1, I, L)."}
                {strategy === "sequential_date" &&
                  "📅 Formato cGMP cronológico estándar basado en fecha calendario y correlativo diario."}
              </p>
            </div>

            {/* Quantity */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="quantity" className="font-bold">
                  Quantity (Units / Packs) *
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="e.g. 50"
                  className="h-9"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="supplierNotes" className="font-bold">
                  Supplier / PO Ref (Optional)
                </Label>
                <Input
                  id="supplierNotes"
                  value={supplierNotes}
                  onChange={(e) => setSupplierNotes(e.target.value)}
                  placeholder="e.g. PO #1049 - Supplier Lot"
                  className="h-9"
                />
              </div>
            </div>

            {/* Pre-register COA Draft Option */}
            <div className="flex items-start gap-2.5 p-2.5 border rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40">
              <Checkbox
                id="preRegisterCoa"
                checked={preRegisterCoa}
                onCheckedChange={(checked) => setPreRegisterCoa(!!checked)}
                className="mt-0.5"
              />
              <div className="grid gap-0.5 leading-none">
                <label
                  htmlFor="preRegisterCoa"
                  className="text-xs font-bold text-emerald-900 dark:text-emerald-300 cursor-pointer"
                >
                  Pre-registrar borrador en COAs ("Sample Sent to Lab")
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Crea automáticamente el registro del lote en el módulo de COAs para cuando recibas el reporte analítico del laboratorio.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="w-full sm:w-auto text-xs sm:text-sm"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto text-xs sm:text-sm font-bold bg-primary"
            >
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
