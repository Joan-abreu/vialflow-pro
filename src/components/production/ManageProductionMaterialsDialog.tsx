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
  notes: string | null;
  raw_materials: {
    name: string;
    unit: string;
  };
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
  
  const [newConfiguration, setNewConfiguration] = useState({
    material_id: "",
    quantity_per_unit: "",
    application_type: "per_unit",
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
      .select("*, raw_materials(name, unit)")
      .eq("product_id", selectedProductId)
      .eq("vial_type_id", selectedVialTypeId);

    if (error) {
      console.error("Error fetching configurations:", error);
      toast.error("Failed to load configurations");
      return;
    }

    setConfigurations(data || []);
  };

  const handleAddConfiguration = async () => {
    if (!newConfiguration.material_id || !newConfiguration.quantity_per_unit || !selectedProductId || !selectedVialTypeId) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("production_configurations")
        .insert([{
          product_id: selectedProductId,
          vial_type_id: selectedVialTypeId,
          raw_material_id: newConfiguration.material_id,
          quantity_per_unit: parseFloat(newConfiguration.quantity_per_unit),
          application_type: newConfiguration.application_type,
          notes: newConfiguration.notes || null,
        }]);

      if (error) throw error;

      toast.success("Configuration added successfully");
      setNewConfiguration({ material_id: "", quantity_per_unit: "", application_type: "per_unit", notes: "" });
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

          {/* Add New Material Configuration */}
          {selectedProductId && selectedVialTypeId && (
            <>
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
                    <Label>Quantity per Unit</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Enter quantity"
                      value={newConfiguration.quantity_per_unit}
                      onChange={(e) => setNewConfiguration({ ...newConfiguration, quantity_per_unit: e.target.value })}
                    />
                  </div>

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
                            {config.quantity_per_unit} {config.raw_materials.unit}
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
