import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Trash2, GripVertical } from "lucide-react";
import AddMaterialDialog from "@/components/inventory/AddMaterialDialog";
import AddUnitDialog from "@/components/inventory/AddUnitDialog";
import ManageCategoriesDialog from "@/components/inventory/ManageCategoriesDialog";
import EditMaterialDialog from "@/components/inventory/EditMaterialDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface RawMaterial {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  min_stock_level: number;
  cost_per_unit: number | null;
  order_index: number;
}


const Inventory = () => {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const fetchMaterials = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("raw_materials")
      .select("*")
      .order("order_index")
      .order("name");

    if (!error && data) {
      setMaterials(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const isLowStock = (material: RawMaterial) => {
    return material.current_stock < material.min_stock_level;
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === index) return;

    const newMaterials = [...materials];
    const draggedItem = newMaterials[draggedIndex];
    
    newMaterials.splice(draggedIndex, 1);
    newMaterials.splice(index, 0, draggedItem);
    
    setMaterials(newMaterials);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null) return;

    try {
      const updates = materials.map((material, idx) =>
        supabase
          .from("raw_materials")
          .update({ order_index: idx })
          .eq("id", material.id)
      );

      await Promise.all(updates);
      toast.success("Order updated");
    } catch (error) {
      toast.error("Error updating order");
      fetchMaterials();
    }
    
    setDraggedIndex(null);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("raw_materials")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Error deleting material");
    } else {
      toast.success("Material deleted");
      fetchMaterials();
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
            <p className="text-muted-foreground">
              Track raw materials and stock levels
            </p>
          </div>
          <div className="flex gap-2">
            <ManageCategoriesDialog onSuccess={fetchMaterials} />
            <AddUnitDialog onSuccess={fetchMaterials} />
            <AddMaterialDialog onSuccess={fetchMaterials} />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Raw Materials</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : materials.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No materials yet. Click "Add Material" to create your first one.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Current Stock</TableHead>
                    <TableHead>Min Level</TableHead>
                    <TableHead>Cost/Unit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials.map((material, index) => (
                    <TableRow 
                      key={material.id}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className="cursor-move"
                    >
                      <TableCell>
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell className="font-medium">{material.name}</TableCell>
                      <TableCell className="capitalize">{material.category}</TableCell>
                      <TableCell>
                        {material.current_stock} {material.unit}
                      </TableCell>
                      <TableCell>
                        {material.min_stock_level} {material.unit}
                      </TableCell>
                      <TableCell>
                        {material.cost_per_unit
                          ? `$${material.cost_per_unit.toFixed(2)}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {isLowStock(material) ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Low Stock
                          </Badge>
                        ) : (
                          <Badge variant="secondary">OK</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <EditMaterialDialog
                            material={material}
                            onSuccess={fetchMaterials}
                          />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Material</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{material.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(material.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Inventory;
