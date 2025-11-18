import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface ProductMaterial {
  id: string;
  material_id: string;
  quantity_per_unit: number;
  raw_materials: {
    name: string;
    unit: string;
  };
}

interface VialTypeMaterial {
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
  const [productMaterials, setProductMaterials] = useState<ProductMaterial[]>([]);
  const [vialTypeMaterials, setVialTypeMaterials] = useState<VialTypeMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [newProductMaterial, setNewProductMaterial] = useState({
    material_id: "",
    quantity_per_unit: "",
  });

  const [newVialMaterial, setNewVialMaterial] = useState({
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
    if (selectedProductId) {
      fetchProductMaterials();
    }
  }, [selectedProductId]);

  useEffect(() => {
    if (selectedVialTypeId) {
      fetchVialTypeMaterials();
    }
  }, [selectedVialTypeId]);

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

  const fetchProductMaterials = async () => {
    const { data, error } = await supabase
      .from("product_materials")
      .select("*, raw_materials(name, unit)")
      .eq("product_id", selectedProductId);

    if (error) {
      console.error("Error fetching product materials:", error);
      toast.error("Failed to load product materials");
      return;
    }

    setProductMaterials(data || []);
  };

  const fetchVialTypeMaterials = async () => {
    const { data, error } = await supabase
      .from("vial_type_materials")
      .select("*, raw_materials(name, unit)")
      .eq("vial_type_id", selectedVialTypeId);

    if (error) {
      console.error("Error fetching vial materials:", error);
      toast.error("Failed to load vial materials");
      return;
    }

    setVialTypeMaterials(data || []);
  };

  const handleAddProductMaterial = async () => {
    if (!newProductMaterial.material_id || !newProductMaterial.quantity_per_unit || !selectedProductId) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("product_materials")
        .insert([{
          product_id: selectedProductId,
          material_id: newProductMaterial.material_id,
          quantity_per_unit: parseFloat(newProductMaterial.quantity_per_unit),
        }]);

      if (error) throw error;

      toast.success("Material added successfully");
      setNewProductMaterial({ material_id: "", quantity_per_unit: "" });
      fetchProductMaterials();
    } catch (error) {
      console.error("Error adding material:", error);
      toast.error("Failed to add material");
    } finally {
      setLoading(false);
    }
  };

  const handleAddVialMaterial = async () => {
    if (!newVialMaterial.material_id || !newVialMaterial.quantity_per_unit || !selectedVialTypeId) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("vial_type_materials")
        .insert([{
          vial_type_id: selectedVialTypeId,
          raw_material_id: newVialMaterial.material_id,
          quantity_per_unit: parseFloat(newVialMaterial.quantity_per_unit),
          application_type: newVialMaterial.application_type,
          notes: newVialMaterial.notes || null,
        }]);

      if (error) throw error;

      toast.success("Material added successfully");
      setNewVialMaterial({ material_id: "", quantity_per_unit: "", application_type: "per_unit", notes: "" });
      fetchVialTypeMaterials();
    } catch (error) {
      console.error("Error adding material:", error);
      toast.error("Failed to add material");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProductMaterial = async (id: string) => {
    try {
      const { error } = await supabase
        .from("product_materials")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Material removed successfully");
      fetchProductMaterials();
    } catch (error) {
      console.error("Error deleting material:", error);
      toast.error("Failed to remove material");
    }
  };

  const handleDeleteVialMaterial = async (id: string) => {
    try {
      const { error } = await supabase
        .from("vial_type_materials")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Material removed successfully");
      fetchVialTypeMaterials();
    } catch (error) {
      console.error("Error deleting material:", error);
      toast.error("Failed to remove material");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Settings className="mr-2 h-4 w-4" />
          Configure Materials
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Production Materials</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="product" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="product">Product Materials</TabsTrigger>
            <TabsTrigger value="vial">Vial Type Materials</TabsTrigger>
          </TabsList>

          <TabsContent value="product" className="space-y-6">
            <div className="space-y-2">
              <Label>Select Product</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a product" />
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

            {selectedProductId && (
              <>
                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-sm font-medium">Add Product Material</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Material (Active Ingredients)</Label>
                      <Select
                        value={newProductMaterial.material_id}
                        onValueChange={(value) => setNewProductMaterial({ ...newProductMaterial, material_id: value })}
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
                        value={newProductMaterial.quantity_per_unit}
                        onChange={(e) => setNewProductMaterial({ ...newProductMaterial, quantity_per_unit: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <Button onClick={handleAddProductMaterial} disabled={loading}>
                    Add Material
                  </Button>
                </div>

                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead>Quantity per Unit</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productMaterials.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            No materials assigned to this product
                          </TableCell>
                        </TableRow>
                      ) : (
                        productMaterials.map((pm) => (
                          <TableRow key={pm.id}>
                            <TableCell className="font-medium">{pm.raw_materials.name}</TableCell>
                            <TableCell>
                              {pm.quantity_per_unit} {pm.raw_materials.unit}
                            </TableCell>
                            <TableCell className="text-right">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove Material</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to remove this material from the product?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteProductMaterial(pm.id)}>
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="vial" className="space-y-6">
            <div className="space-y-2">
              <Label>Select Vial Type</Label>
              <Select value={selectedVialTypeId} onValueChange={setSelectedVialTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a vial type" />
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

            {selectedVialTypeId && (
              <>
                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-sm font-medium">Add Vial Material</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Material (Vial, Cap, Label, etc.)</Label>
                      <Select
                        value={newVialMaterial.material_id}
                        onValueChange={(value) => setNewVialMaterial({ ...newVialMaterial, material_id: value })}
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
                        value={newVialMaterial.quantity_per_unit}
                        onChange={(e) => setNewVialMaterial({ ...newVialMaterial, quantity_per_unit: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Application Type</Label>
                      <Select
                        value={newVialMaterial.application_type}
                        onValueChange={(value) => setNewVialMaterial({ ...newVialMaterial, application_type: value })}
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
                        value={newVialMaterial.notes}
                        onChange={(e) => setNewVialMaterial({ ...newVialMaterial, notes: e.target.value })}
                        placeholder="Optional notes"
                      />
                    </div>
                  </div>
                  <Button onClick={handleAddVialMaterial} disabled={loading}>
                    Add Material
                  </Button>
                </div>

                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Application</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vialTypeMaterials.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            No materials assigned to this vial type
                          </TableCell>
                        </TableRow>
                      ) : (
                        vialTypeMaterials.map((vm) => (
                          <TableRow key={vm.id}>
                            <TableCell className="font-medium">{vm.raw_materials.name}</TableCell>
                            <TableCell>
                              {vm.quantity_per_unit} {vm.raw_materials.unit}
                            </TableCell>
                            <TableCell className="capitalize">
                              {vm.application_type.replace("_", " ")}
                            </TableCell>
                            <TableCell>{vm.notes || "-"}</TableCell>
                            <TableCell className="text-right">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove Material</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to remove this material from the vial type?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteVialMaterial(vm.id)}>
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
