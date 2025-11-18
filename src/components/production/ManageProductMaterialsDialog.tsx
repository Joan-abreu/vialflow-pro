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

export function ManageProductMaterialsDialog() {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [productMaterials, setProductMaterials] = useState<ProductMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [newMaterial, setNewMaterial] = useState({
    material_id: "",
    quantity_per_unit: "",
  });

  useEffect(() => {
    if (open) {
      fetchProducts();
      fetchMaterials();
    }
  }, [open]);

  useEffect(() => {
    if (selectedProductId) {
      fetchProductMaterials();
    }
  }, [selectedProductId]);

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

  const handleAddMaterial = async () => {
    if (!newMaterial.material_id || !newMaterial.quantity_per_unit || !selectedProductId) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("product_materials")
        .insert([{
          product_id: selectedProductId,
          material_id: newMaterial.material_id,
          quantity_per_unit: parseFloat(newMaterial.quantity_per_unit),
        }]);

      if (error) throw error;

      toast.success("Material added successfully");
      setNewMaterial({ material_id: "", quantity_per_unit: "" });
      fetchProductMaterials();
    } catch (error) {
      console.error("Error adding material:", error);
      toast.error("Failed to add material");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMaterial = async (id: string) => {
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Settings className="mr-2 h-4 w-4" />
          Product Materials
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Product Materials (Bill of Materials)</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
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
                <h3 className="text-sm font-medium">Add Material</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Material</Label>
                    <Select
                      value={newMaterial.material_id}
                      onValueChange={(value) => setNewMaterial({ ...newMaterial, material_id: value })}
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
                      value={newMaterial.quantity_per_unit}
                      onChange={(e) => setNewMaterial({ ...newMaterial, quantity_per_unit: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <Button onClick={handleAddMaterial} disabled={loading}>
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
                                  <AlertDialogAction onClick={() => handleDeleteMaterial(pm.id)}>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
