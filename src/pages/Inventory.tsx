import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, GripVertical } from "lucide-react";
import AddMaterialDialog from "@/components/inventory/AddMaterialDialog";
import AddUnitDialog from "@/components/inventory/AddUnitDialog";
import ManageCategoriesDialog from "@/components/inventory/ManageCategoriesDialog";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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

interface SortableRowProps {
  material: RawMaterial;
  isLowStock: boolean;
}

const SortableRow = ({ material, isLowStock }: SortableRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: material.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="w-10">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
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
        {isLowStock ? (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Low Stock
          </Badge>
        ) : (
          <Badge variant="secondary">OK</Badge>
        )}
      </TableCell>
    </TableRow>
  );
};

const Inventory = () => {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = materials.findIndex((m) => m.id === active.id);
    const newIndex = materials.findIndex((m) => m.id === over.id);

    const newMaterials = arrayMove(materials, oldIndex, newIndex);
    setMaterials(newMaterials);

    // Update order_index in database
    try {
      const updates = newMaterials.map((material, index) =>
        supabase
          .from("raw_materials")
          .update({ order_index: index })
          .eq("id", material.id)
      );

      await Promise.all(updates);
      toast.success("Order updated successfully");
    } catch (error) {
      toast.error("Error updating order");
      fetchMaterials(); // Revert on error
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
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Current Stock</TableHead>
                      <TableHead>Min Level</TableHead>
                      <TableHead>Cost/Unit</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <SortableContext
                      items={materials.map((m) => m.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {materials.map((material) => (
                        <SortableRow
                          key={material.id}
                          material={material}
                          isLowStock={isLowStock(material)}
                        />
                      ))}
                    </SortableContext>
                  </TableBody>
                </Table>
              </DndContext>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Inventory;
