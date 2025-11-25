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

interface Product {
  id: string;
  name: string;
}

interface VialType {
  id: string;
  name: string;
  size_ml: number;
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
  notes: string | null;
  raw_materials: {
    name: string;
    unit: string;
    usage_unit_id?: string | null;
    units_of_measurement?: {
      abbreviation: string;
    } | null;
  };
}

interface BoxConfiguration {
  id: string;
  variant_id: string;
  packs_per_box: number;
}

export function ManageProductionMaterialsDialog() {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [vialTypes, setVialTypes] = useState<VialType[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedVialTypeId, setSelectedVialTypeId] = useState<string>("");
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [configurations, setConfigurations] = useState<ProductionConfiguration[]>([]);
  const [loading, setLoading] = useState(false);

  const [boxConfig, setBoxConfig] = useState<BoxConfiguration | null>(null);
  const [boxConfigLoading, setBoxConfigLoading] = useState(false);

  const [newConfiguration, setNewConfiguration] = useState({
    material_id: "",
    quantity_per_unit: "",
    application_type: "per_unit",
    calculation_type: "fixed",
    percentage_of_material_id: "",
    percentage_value: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      fetchProducts();
      fetchVialTypes();
      fetchMaterials();
    }
  }, [open]);

  useEffect(() => {
    if (selectedProductId && selectedVialTypeId) {
      fetchConfigurations();
      fetchBoxConfig();
    }
  }, [selectedProductId, selectedVialTypeId]);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("Error fetching products:", error);
      toast.error("Failed to load products");
      return;
    }

    setProducts(data || []);
    if (data && data.length > 0 && !selectedProductId) {
      setSelectedProductId(data[0].id);
    }
  };

  const fetchVialTypes = async () => {
    const { data, error } = await supabase
      .from("vial_types")
      .select("*")
      .eq("active", true)
      .order("name");

    if (error) {
      console.error("Error fetching vial types:", error);
      toast.error("Failed to load vial types");
      return;
    }

    setVialTypes(data || []);
    if (data && data.length > 0 && !selectedVialTypeId) {
      setSelectedVialTypeId(data[0].id);
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
        )
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

  const fetchBoxConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("box_configurations" as any)
        .select("*")
        .eq("variant_id", selectedVialTypeId) // Assuming vial_type_id maps to variant_id for now
        .maybeSingle();

      if (error && error.code !== '42P01') { // Ignore table not found error
        console.error("Error fetching box config:", error);
      }

      setBoxConfig(data as any);
    } catch (error) {
      console.error("Error in fetchBoxConfig:", error);
    }
  };

  const saveBoxConfig = async (packsPerBox: number) => {
    setBoxConfigLoading(true);
    try {
      const { error } = await supabase
        .from("box_configurations" as any)
        .upsert({
          variant_id: selectedVialTypeId,
          packs_per_box: packsPerBox
        });

      if (error) throw error;

      toast.success("Box configuration saved");
      fetchBoxConfig();
    } catch (error) {
      console.error("Error saving box config:", error);
      toast.error("Failed to save box configuration");
    } finally {
      setBoxConfigLoading(false);
    }
  };

  const handleAddConfiguration = async () => {
    if (!newConfiguration.material_id || !selectedProductId || !selectedVialTypeId) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (newConfiguration.calculation_type === 'fixed' && !newConfiguration.quantity_per_unit) {
      toast.error("Please enter quantity per unit");
      return;
    }

    if (newConfiguration.calculation_type === 'percentage' && (!newConfiguration.percentage_of_material_id || !newConfiguration.percentage_value)) {
      toast.error("Please select a material and enter percentage value");
      return;
    }

    setLoading(true);
    try {
      const configData: any = {
        product_id: selectedProductId,
        vial_type_id: selectedVialTypeId,
        raw_material_id: newConfiguration.material_id,
        application_type: newConfiguration.application_type,
        calculation_type: newConfiguration.calculation_type,
        notes: newConfiguration.notes || null,
      };

      if (newConfiguration.calculation_type === 'fixed') {
        configData.quantity_per_unit = parseFloat(newConfiguration.quantity_per_unit);
      } else if (newConfiguration.calculation_type === 'percentage') {
        configData.percentage_of_material_id = newConfiguration.percentage_of_material_id;
        configData.percentage_value = parseFloat(newConfiguration.percentage_value);
        configData.quantity_per_unit = 0; // Calculated dynamically
      } else if (newConfiguration.calculation_type === 'per_box') {
        configData.quantity_per_unit = 1; // One per box
      }

      const { error } = await supabase
        .from("production_configurations")
        .insert([configData]);

      if (error) throw error;

      toast.success("Configuration added successfully");
      setNewConfiguration({
        material_id: "",
        quantity_per_unit: "",
        application_type: "per_unit",
        calculation_type: "fixed",
        percentage_of_material_id: "",
        percentage_value: "",
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
      const unit = config.raw_materials?.units_of_measurement?.abbreviation ||
        config.raw_materials?.unit ||
        "";
      return `${config.quantity_per_unit} ${unit}`;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Configure Materials
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Production Materials</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Product and Vial Type Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Product</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger>
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

            <div className="space-y-2">
              <Label>Vial Type</Label>
              <Select value={selectedVialTypeId} onValueChange={setSelectedVialTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vial type" />
                </SelectTrigger>
                <SelectContent>
                  {vialTypes.map((vialType) => (
                    <SelectItem key={vialType.id} value={vialType.id}>
                      {vialType.name} ({vialType.size_ml}ml)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedProductId && selectedVialTypeId && (
            <>
              {/* Box Configuration */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-4">Box Configuration</h3>
                <div className="flex items-end gap-4">
                  <div className="space-y-2 flex-1">
                    <Label>Packs per Box</Label>
                    <Input
                      type="number"
                      placeholder="Enter packs per box"
                      value={boxConfig?.packs_per_box || ""}
                      onChange={(e) => setBoxConfig(prev => prev ? { ...prev, packs_per_box: parseInt(e.target.value) || 0 } : { id: "", variant_id: selectedVialTypeId, packs_per_box: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <Button
                    onClick={() => saveBoxConfig(boxConfig?.packs_per_box || 0)}
                    disabled={boxConfigLoading}
                  >
                    Save Box Config
                  </Button>
                </div>
              </div>

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

                  {newConfiguration.calculation_type === 'fixed' && (
                    <div className="space-y-2">
                      <Label>Quantity per Unit</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Enter quantity"
                        value={newConfiguration.quantity_per_unit}
                        onChange={(e) => setNewConfiguration({ ...newConfiguration, quantity_per_unit: e.target.value })}
                      />
                    </div>
                  )}

                  {newConfiguration.calculation_type === 'percentage' && (
                    <>
                      <div className="space-y-2">
                        <Label>Percentage of Material</Label>
                        <Select
                          value={newConfiguration.percentage_of_material_id}
                          onValueChange={(value) => setNewConfiguration({ ...newConfiguration, percentage_of_material_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select reference material" />
                          </SelectTrigger>
                          <SelectContent>
                            {configurations.map((config) => (
                              <SelectItem key={config.raw_material_id} value={config.raw_material_id}>
                                {config.raw_materials.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Percentage Value (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Enter percentage"
                          value={newConfiguration.percentage_value}
                          onChange={(e) => setNewConfiguration({ ...newConfiguration, percentage_value: e.target.value })}
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label>Application Type</Label>
                    <Select
                      value={newConfiguration.application_type}
                      onValueChange={(value) => setNewConfiguration({ ...newConfiguration, application_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="per_unit">Per Unit</SelectItem>
                        <SelectItem value="per_batch">Per Batch</SelectItem>
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
                        <TableHead>Quantity</TableHead>
                        <TableHead>Application</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {configurations.map((config) => (
                        <TableRow key={config.id}>
                          <TableCell>{config.raw_materials.name}</TableCell>
                          <TableCell>
                            {getDisplayQuantity(config)}
                          </TableCell>
                          <TableCell className="capitalize">
                            {config.application_type.replace('_', ' ')}
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
