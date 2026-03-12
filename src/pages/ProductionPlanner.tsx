import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Calculator, Info, Printer } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface ProductVariant {
  id: string;
  product_id: string;
  vial_type_id: string;
  pack_size: number;
  sale_type: string;
  products: { name: string; sale_type: string };
  vial_types: {
    name: string;
    capacity_ml: number;
    color: string | null;
    shape: string | null;
  };
}

interface PlannedBatch {
  id: string;
  variant: ProductVariant;
  quantity: number;
}

interface AggregatedMaterial {
  id: string;
  name: string;
  unit: string;
  total_required: number;
  current_stock: number;
  shortfall: number;
  cost_per_unit: number;
  total_cost: number;
}

export default function ProductionPlanner() {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");
  const [plannedBatches, setPlannedBatches] = useState<PlannedBatch[]>([]);
  const [aggregatedMaterials, setAggregatedMaterials] = useState<AggregatedMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    fetchVariants();
  }, []);

  useEffect(() => {
    if (plannedBatches.length > 0) {
      calculateRequirements();
    } else {
      setAggregatedMaterials([]);
    }
  }, [plannedBatches]);

  const fetchVariants = async () => {
    const { data, error } = await (supabase
      .from("product_variants")
      .select(`
        id,
        product_id,
        vial_type_id,
        pack_size,
        sale_type,
        products!inner(name, sale_type),
        vial_types!inner(name, capacity_ml, color, shape)
      `)
      .order("created_at", { ascending: false }) as any);

    if (error) {
      console.error("Error fetching variants:", error);
      toast.error("Failed to load variants");
      return;
    }

    setVariants(data || []);
    if (data && data.length > 0) {
      setSelectedVariantId(data[0].id);
    }
  };

  const addBatch = () => {
    const variant = variants.find(v => v.id === selectedVariantId);
    if (!variant) return;

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    const newBatch: PlannedBatch = {
      id: crypto.randomUUID(),
      variant,
      quantity: qty,
    };

    setPlannedBatches([...plannedBatches, newBatch]);
    setQuantity("1");
    toast.success("Batch added to plan");
  };

  const removeBatch = (id: string) => {
    setPlannedBatches(plannedBatches.filter(b => b.id !== id));
  };

  const calculateRequirements = async () => {
    if (plannedBatches.length === 0) {
      setAggregatedMaterials([]);
      return;
    }

    setCalculating(true);
    try {
      const materialMap: Record<string, AggregatedMaterial> = {};

      for (const batch of plannedBatches) {
        // Fetch configurations for this variant
        const { data: configs, error } = await supabase
          .from("production_configurations")
          .select(`
            id,
            quantity_per_unit,
            application_basis,
            calculation_type,
            raw_materials!production_configurations_raw_material_id_fkey (
              id,
              name,
              unit,
              cost_per_unit,
              current_stock
            )
          `)
          .eq("product_id", batch.variant.id)
          .eq("vial_type_id", batch.variant.vial_type_id);

        if (error) throw error;

        // In my planner, quantity is "Number of packs" for pack variants, or "Units" for individual
        const quantityInPacks = batch.quantity; 

        for (const config of (configs as any[])) {
          let requiredQty = 0;
          if (config.calculation_type === 'fixed') {
            if (config.application_basis === 'per_batch') {
              requiredQty = config.quantity_usage || 0;
            } else {
              requiredQty = quantityInPacks * config.quantity_per_unit;
            }
          } else if (config.calculation_type === 'per_box') {
            requiredQty = quantityInPacks * config.quantity_per_unit;
          }

          const mat = config.raw_materials;
          const matId = mat.id;

          if (materialMap[matId]) {
            materialMap[matId].total_required += requiredQty;
          } else {
            materialMap[matId] = {
              id: matId,
              name: mat.name,
              unit: mat.unit,
              total_required: requiredQty,
              current_stock: mat.current_stock || 0,
              shortfall: 0,
              cost_per_unit: mat.cost_per_unit || 0,
              total_cost: 0,
            };
          }
        }
      }

      // Finalize calculations for all materials
      const results = Object.values(materialMap).map(item => {
        // Round up discrete items
        const unit = item.unit.toLowerCase();
        if (['units', 'unit', 'box', 'boxes'].includes(unit)) {
          item.total_required = Math.ceil(item.total_required);
        }

        item.shortfall = Math.max(0, item.total_required - item.current_stock);
        item.total_cost = item.total_required * item.cost_per_unit;
        return item;
      });

      setAggregatedMaterials(results);
      toast.success("Requirements calculated");
    } catch (error) {
      console.error("Error calculating requirements:", error);
      toast.error("Failed to calculate requirements");
    } finally {
      setCalculating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Production Planner</h1>
          <p className="text-muted-foreground">
            Plan multiple batches and calculate consolidated material requirements.
          </p>
        </div>
        {aggregatedMaterials.length > 0 && (
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Print Plan
          </Button>
        )}
      </div>

      <div className="hidden print:block text-center mb-8 border-b-2 border-gray-800 pb-4">
        <h1 className="text-3xl font-bold mb-2">PRODUCTION PLAN & REQUIREMENTS</h1>
        <p className="text-sm text-gray-600">Generated on {new Date().toLocaleDateString()}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:block">
        {/* Planner Sidebar */}
        <div className="space-y-6 print:mb-8">
          <Card className="print:hidden">
            <CardHeader>
              <CardTitle className="text-lg">Add Planned Batch</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Product Variant</Label>
                <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select variant" />
                  </SelectTrigger>
                  <SelectContent>
                    {variants.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.products.name} - {v.vial_types.name} ({v.vial_types.capacity_ml}ml) - {v.sale_type === 'pack' ? `Pack (${v.pack_size}x)` : 'Individual'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Quantity (Units or Packs)</Label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>

              <Button onClick={addBatch} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add to Plan
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Planned Batches</CardTitle>
            </CardHeader>
            <CardContent>
              {plannedBatches.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Info className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No batches planned yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {plannedBatches.map((batch) => (
                    <div key={batch.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{batch.variant.products.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {batch.variant.vial_types.name} ({batch.variant.vial_types.capacity_ml}ml) - {batch.variant.sale_type === 'pack' ? `Pack (${batch.variant.pack_size}x)` : 'Individual'}
                        </p>
                        <p className="text-xs font-semibold">
                          Qty: {batch.quantity} {batch.variant.sale_type === 'pack' ? 'Packs' : 'Units'}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeBatch(batch.id)} className="print:hidden">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Requirements Table */}
        <div className="lg:col-span-2 print:w-full">
          <Card className="h-full border-none shadow-none print:border-solid print:border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Consolidated Requirements</CardTitle>
              {aggregatedMaterials.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  Total Cost: ${aggregatedMaterials.reduce((sum, m) => sum + m.total_cost, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              {aggregatedMaterials.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Calculator className="h-12 w-12 mb-4 opacity-10" />
                  <p>Consolidate your batch list to see material needs.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead className="text-right">Total Req.</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="text-right text-red-500 font-bold">To Buy</TableHead>
                        <TableHead className="text-right">Total Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aggregatedMaterials.map((mat) => (
                        <TableRow key={mat.id}>
                          <TableCell className="font-medium">{mat.name}</TableCell>
                          <TableCell className="text-right">{mat.total_required.toLocaleString()}</TableCell>
                          <TableCell className="text-muted-foreground text-xs uppercase">{mat.unit}</TableCell>
                          <TableCell className="text-right">{mat.current_stock.toLocaleString()}</TableCell>
                          <TableCell className={`text-right font-bold ${mat.shortfall > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {mat.shortfall.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            ${mat.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <style>{`
        @media print {
          /* Force all containers to be visible and have auto height */
          html, body, #root, div[data-reactroot], .min-h-screen, main, .flex-1 {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            position: static !important;
            display: block !important;
          }
          
          /* Specifically target the Layout wrapper */
          main.overflow-y-auto {
            overflow: visible !important;
            height: auto !important;
          }

          body {
            background: white !important;
            padding: 0 !important;
          }
          
          .container {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            overflow: visible !important;
          }
          
          @page {
            margin: 1cm;
            size: auto;
          }
          
          .card {
            border: 1px solid #e2e8f0 !important;
            box-shadow: none !important;
            break-inside: avoid;
            margin-bottom: 2rem !important;
            page-break-inside: avoid;
            display: block !important;
          }
          
          tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          
          table {
            width: 100% !important;
            table-layout: auto !important;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:block {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}
