import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FolderOpen, Loader2, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ManageCategoriesDialogProps {
  onSuccess?: () => void;
}

interface Category {
  id: string;
  name: string;
  active: boolean;
}

const ManageCategoriesDialog = ({ onSuccess }: ManageCategoriesDialogProps) => {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from("material_categories")
      .select("*")
      .order("name");
    
    if (data) setCategories(data);
  };

  useEffect(() => {
    if (open) fetchCategories();
  }, [open]);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;

    setLoading(true);
    const { error } = await supabase
      .from("material_categories")
      .insert({ name: newCategory.trim().toLowerCase() });

    setLoading(false);

    if (error) {
      toast.error("Error creating category: " + error.message);
    } else {
      toast.success("Category created successfully");
      setNewCategory("");
      fetchCategories();
      onSuccess?.();
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase
      .from("material_categories")
      .delete()
      .eq("id", id);

    setDeleting(null);

    if (error) {
      toast.error("Cannot delete category: " + error.message);
    } else {
      toast.success("Category deleted successfully");
      fetchCategories();
      onSuccess?.();
    }
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase
      .from("material_categories")
      .update({ active: !active })
      .eq("id", id);

    if (error) {
      toast.error("Error updating category: " + error.message);
    } else {
      toast.success(`Category ${active ? 'disabled' : 'enabled'}`);
      fetchCategories();
      onSuccess?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FolderOpen className="mr-2 h-4 w-4" />
          Manage Categories
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Manage Material Categories</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Add, remove, or toggle categories for your materials
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 grid gap-1.5 sm:gap-2">
            <Label htmlFor="category-name" className="text-xs sm:text-sm">New Category</Label>
            <Input
              id="category-name"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="e.g., chemicals"
              maxLength={50}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={loading || !newCategory.trim()}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </>
              )}
            </Button>
          </div>
        </form>

        <div className="mt-4">
          <Label className="text-xs sm:text-sm">Existing Categories</Label>
          <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto">
            {categories.length === 0 ? (
              <p className="text-xs sm:text-sm text-muted-foreground py-4 text-center">
                No categories yet
              </p>
            ) : (
              categories.map((category) => (
                <div
                  key={category.id}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-3 border rounded-lg gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="capitalize font-medium text-xs sm:text-sm">{category.name}</span>
                    {!category.active && (
                      <Badge variant="secondary" className="text-[10px] sm:text-xs">Disabled</Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(category.id, category.active)}
                      className="flex-1 sm:flex-none text-xs"
                    >
                      {category.active ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteCategory(category.id)}
                      disabled={deleting === category.id}
                      className="flex-1 sm:flex-none"
                    >
                      {deleting === category.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManageCategoriesDialog;
