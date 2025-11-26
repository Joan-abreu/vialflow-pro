import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface ProductVariant {
  id: string;
  product_id: string;
  vial_type_id: string;
  pack_size: number;
  sale_type: string;
  products: { name: string; sale_type: string };
  vial_types: { name: string; size_ml: number };
}

interface RawMaterial {
  id: string;
  name: string;
  unit: string;
}

interface ProductionConfiguration {
  id: string;
  raw_material_id: string;
  quantity_per_unit: number;
  application_type: string;
  calculation_type: "fixed" | "percentage" | "per_box";
  percentage_of_material_id: string | null;
  percentage_value: number | null;
  units_per_box: number | null;
  notes: string | null;
  application_basis: "per_pack" | "per_inner_unit" | "per_batch" | "per_volume_of_inner_unit" | "per_weight_of_inner_unit" | null;
  usage_uom_id: string | null;
  quantity_usage: number | null;
  raw_materials: {
    name: string;
    unit: string;
    usage_unit_id?: string | null;
    units_of_measurement?: {
      abbreviation: string;
    } | null;
  };
  usage_uom?: {
    name: string;
    abbreviation: string;
  } | null;
}

interface UnitOfMeasurement {
  id: string;
  name: string;
  abbreviation: string;
  category: string;
}

interface BoxConfiguration {
  id: string;
  variant_id: string;
  packs_per_box: number;
}

export function ManageProductionMaterialsDialog() {
  const [open, setOpen] = useState(false);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedVialTypeId, setSelectedVialTypeId] = useState<string>("");
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [configurations, setConfigurations] = useState<ProductionConfiguration[]>([]);
  const [uoms, setUoms] = useState<UnitOfMeasurement[]>([]);
  const [loading, setLoading] = useState(false);

  const [newConfiguration, setNewConfiguration] = useState({
    material_id: "",
    quantity_per_unit: "", // Keeping for backward compatibility or as fallback
    quantity_usage: "",
    application_type: "per_unit", // Deprecated but kept for now
    application_basis: "per_inner_unit",
    usage_uom_id: "",
    calculation_type: "fixed",
    percentage_of_material_id: "",
    percentage_value: "",
    units_per_box: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      fetchVariants();
      fetchMaterials();
      fetchUOMs();
    }
  }, [open]);

  useEffect(() => {
    if (selectedVariantId) {
      const variant = variants.find(v => v.id === selectedVariantId);
      if (variant) {
        setSelectedProductId(variant.product_id);
        setSelectedVialTypeId(variant.vial_type_id);
      }
    }
  }, [selectedVariantId, variants]);

  useEffect(() => {
    if (selectedProductId && selectedVialTypeId) {
      fetchConfigurations();
    }
  }, [selectedProductId, selectedVialTypeId]);

  const fetchVariants = async () => {
    const { data, error } = await supabase
      .from("product_variants")
      .select(`
        id,
        product_id,
        vial_type_id,
        pack_size,
        sale_type,
        products!inner(name, sale_type),
        vial_types!inner(name, size_ml)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching variants:", error);
      toast.error("Failed to load variants");
      return;
    }

    setVariants((data as any) || []);
    if (data && data.length > 0 && !selectedVariantId) {
      setSelectedVariantId(data[0].id);
    }
  };

  const fetchMaterials = async () => {
    const { data, error } = await supabase
      .from("raw_materials")
      .select("id, name, unit")
      .order("name");

    if (error) {
      console.error("Error fetching materials:", error);
      return;
    }

    setMaterials(data || []);
  };

  const fetchUOMs = async () => {
    const { data, error } = await supabase
      .from("units_of_measurement")
      .select("id, name, abbreviation, category")
      .eq("active", true)
      .order("name");

    if (error) {
      console.error("Error fetching UOMs:", error);
      return;
    }

    setUoms(data || []);
  };

  const fetchConfigurations = async () => {
    const { data, error } = await supabase
      .from("production_configurations")
      .select(`
        *,
        raw_materials!production_configurations_raw_material_id_fkey(
          name, 
          unit,
          usage_unit_id,
          units_of_measurement:usage_unit_id(abbreviation)
        ),
        usage_uom:usage_uom_id(name, abbreviation)
      `)
      .eq("product_id", selectedProductId)
      .eq("vial_type_id", selectedVialTypeId);

    if (error) {
      console.error("Error fetching configurations:", error);
      toast.error("Failed to load configurations");
      return;
    }

    setConfigurations((data as any) || []);
  };



  const handleAddConfiguration = async () => {
    if (!newConfiguration.material_id || !selectedProductId || !selectedVialTypeId) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (newConfiguration.calculation_type === 'fixed' && !newConfiguration.quantity_usage) {
      toast.error("Please enter quantity");
      return;
    }

    setLoading(true);
    try {
      const configData: any = {
        product_id: selectedProductId,
        vial_type_id: selectedVialTypeId,
        raw_material_id: newConfiguration.material_id,
        application_type: newConfiguration.application_basis === 'per_batch' ? 'per_batch' : 'per_unit', // Legacy mapping
        application_basis: newConfiguration.application_basis,
        usage_uom_id: newConfiguration.usage_uom_id || null,
        calculation_type: newConfiguration.calculation_type,
        notes: newConfiguration.notes || null,
        quantity_usage: parseFloat(newConfiguration.quantity_usage),
      };

      // Calculate quantity_per_unit (Total per Pack) for backward compatibility
      const variant = variants.find(v => v.id === selectedVariantId);
      const packSize = variant?.pack_size || 1;
      const vialSize = variant?.vial_types?.size_ml || 0;
      const qtyUsage = parseFloat(newConfiguration.quantity_usage);

      let calculatedQtyPerUnit = 0;

      if (newConfiguration.calculation_type === 'fixed') {
        switch (newConfiguration.application_basis) {
          case 'per_pack':
            calculatedQtyPerUnit = qtyUsage;
            break;
          case 'per_inner_unit':
            calculatedQtyPerUnit = qtyUsage * packSize;
            break;
          case 'per_volume_of_inner_unit':
            // Assuming usage is per mL, so usage * volume * count
            calculatedQtyPerUnit = qtyUsage * vialSize * packSize;
            break;
          case 'per_weight_of_inner_unit':
            // We don't have weight info easily, defaulting to usage * packSize for now or 0
            calculatedQtyPerUnit = qtyUsage * packSize;
            break;
          case 'per_batch':
            calculatedQtyPerUnit = 0; // Handled at batch level
            break;
        }
        configData.quantity_per_unit = calculatedQtyPerUnit;
      } else if (newConfiguration.calculation_type === 'percentage') {
        configData.percentage_of_material_id = newConfiguration.percentage_of_material_id;
        configData.percentage_value = parseFloat(newConfiguration.percentage_value);
        configData.quantity_per_unit = 0; // Calculated dynamically
        configData.quantity_usage = 0;
      } else if (newConfiguration.calculation_type === 'per_box') {
        configData.quantity_per_unit = 1; // One per box
        configData.quantity_usage = 1;
      }

      // Add units_per_box if material unit is 'box'
      const selectedMaterial = materials.find(m => m.id === newConfiguration.material_id);
      if (selectedMaterial?.unit.toLowerCase() === 'box' && newConfiguration.units_per_box) {
        configData.units_per_box = parseInt(newConfiguration.units_per_box);
      }

      const { error } = await supabase
        .from("production_configurations")
        .insert([configData]);

      if (error) throw error;

      toast.success("Configuration added successfully");
      setNewConfiguration({
        material_id: "",
        quantity_per_unit: "",
        quantity_usage: "",
        application_type: "per_unit",
        application_basis: "per_inner_unit",
        usage_uom_id: "",
        calculation_type: "fixed",
        percentage_of_material_id: "",
        percentage_value: "",
        units_per_box: "",
        notes: "",
      });
      fetchConfigurations();
    } catch (error) {
      console.error("Error adding configuration:", error);
      toast.error("Failed to add configuration");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfiguration = async (id: string) => {
    try {
      const { error } = await supabase
        .from("production_configurations")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Configuration removed successfully");
      fetchConfigurations();
    } catch (error) {
      console.error("Error deleting configuration:", error);
      toast.error("Failed to remove configuration");
    }
  };

  const getDisplayQuantity = (config: ProductionConfiguration) => {
    if (config.calculation_type === "percentage") {
      const refMaterial = materials.find(m => m.id === config.percentage_of_material_id);
      return `${config.percentage_value}% of ${refMaterial?.name || 'material'}`;
    } else if (config.calculation_type === "per_box") {
      return "1 per box";
    } else {
      const unit = config.usage_uom?.abbreviation ||
        config.raw_materials?.units_of_measurement?.abbreviation ||
        config.raw_materials?.unit ||
        "";
      return `${config.quantity_usage || config.quantity_per_unit} ${unit}`;
    }
  };

  const getCalculatedResult = (config: ProductionConfiguration) => {
    if (config.calculation_type !== 'fixed') return '-';

    const unit = config.raw_materials?.units_of_measurement?.abbreviation || config.raw_materials?.unit || "";

    // If we have a calculated quantity_per_unit (total per pack), use it
    if (config.quantity_per_unit) {
      return `${config.quantity_per_unit} ${unit} per pack`;
    }
    return '-';
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Settings className="h-4 w-4 mr-2" />
          Configure Materials
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Production Materials</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Variant Selection */}
          <div className="space-y-2">
            <Label>Product Variant *</Label>
            <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
              <SelectTrigger>
                <SelectValue placeholder="Select variant" />
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
            {selectedVariantId && (
              <div className="text-sm text-muted-foreground mt-1">
                Variant contains: {variants.find(v => v.id === selectedVariantId)?.pack_size} inner units
              </div>
            )}
          </div>

          {selectedVariantId && (
            <>

              {/* Add New Material Configuration */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-4">Add Material</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Raw Material</Label>
                    <Select
                      value={newConfiguration.material_id}
                      onValueChange={(value) => setNewConfiguration({ ...newConfiguration, material_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select material" />
                      </SelectTrigger>
                      <SelectContent>
                        {materials.map((material) => (
                          <SelectItem key={material.id} value={material.id}>
                            {material.name} ({material.unit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Calculation Type</Label>
                    <Select
                      value={newConfiguration.calculation_type}
                      onValueChange={(value: any) => setNewConfiguration({ ...newConfiguration, calculation_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed Quantity</SelectItem>
                        <SelectItem value="percentage">Percentage of Material</SelectItem>
                        <SelectItem value="per_box">Per Box</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Application Basis</Label>
                    <Select
                      value={newConfiguration.application_basis}
                      onValueChange={(value: any) => setNewConfiguration({ ...newConfiguration, application_basis: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="per_pack">Per Pack</SelectItem>
                        <SelectItem value="per_inner_unit">Per Inner Unit</SelectItem>
                        <SelectItem value="per_batch">Per Batch</SelectItem>
                        <SelectItem value="per_volume_of_inner_unit">Per Volume of Inner Unit</SelectItem>
                        <SelectItem value="per_weight_of_inner_unit">Per Weight of Inner Unit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {newConfiguration.calculation_type === 'fixed' && (
                    <div className="space-y-2">
                      <Label>Quantity (Usage)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Enter quantity"
                        value={newConfiguration.quantity_usage}
                        onChange={(e) => setNewConfiguration({ ...newConfiguration, quantity_usage: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Usage UOM</Label>
                    <Select
                      value={newConfiguration.usage_uom_id}
                      onValueChange={(value) => setNewConfiguration({ ...newConfiguration, usage_uom_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select UOM" />
                      </SelectTrigger>
                      <SelectContent>
                        {uoms.map((uom) => (
                          <SelectItem key={uom.id} value={uom.id}>
                            {uom.name} ({uom.abbreviation})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Notes (Optional)</Label>
                    <Input
                      placeholder="Add notes"
                      value={newConfiguration.notes}
                      onChange={(e) => setNewConfiguration({ ...newConfiguration, notes: e.target.value })}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleAddConfiguration}
                  disabled={loading}
                  className="mt-4"
                >
                  Add Material
                </Button>
              </div>

              {/* Materials List */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-4">Configured Materials</h3>
                {configurations.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No materials configured for this product and vial type combination.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead>Basis</TableHead>
                        <TableHead>Qty (Usage)</TableHead>
                        <TableHead>Result (per Pack)</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {configurations.map((config) => (
                        <TableRow key={config.id}>
                          <TableCell>{config.raw_materials.name}</TableCell>
                          <TableCell className="capitalize">
                            {config.application_basis ? config.application_basis.replace(/_/g, ' ') : config.application_type.replace('_', ' ')}
                          </TableCell>
                          <TableCell>
                            {getDisplayQuantity(config)}
                          </TableCell>
                          <TableCell>
                            {getCalculatedResult(config)}
                          </TableCell>
                          <TableCell>{config.notes || '-'}</TableCell>
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove Material?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will remove {config.raw_materials.name} from this configuration.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteConfiguration(config.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
