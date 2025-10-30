import { useState, useEffect } from "react";
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
import { Settings, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface VialType {
  id: string;
  name: string;
  size_ml: number;
  description: string | null;
  active: boolean;
}

const ManageVialTypesDialog = () => {
  const [open, setOpen] = useState(false);
  const [vialTypes, setVialTypes] = useState<VialType[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    size_ml: "",
    description: "",
  });

  useEffect(() => {
    if (open) fetchVialTypes();
  }, [open]);

  const fetchVialTypes = async () => {
    const { data } = await supabase
      .from("vial_types")
      .select("*")
      .order("size_ml");
    
    if (data) setVialTypes(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (editingId) {
      const { error } = await supabase
        .from("vial_types")
        .update({
          name: formData.name.trim(),
          size_ml: parseInt(formData.size_ml),
          description: formData.description.trim() || null,
        })
        .eq("id", editingId);

      if (error) {
        toast.error("Error updating vial type: " + error.message);
      } else {
        toast.success("Vial type updated successfully");
        resetForm();
        fetchVialTypes();
      }
    } else {
      const { error } = await supabase.from("vial_types").insert({
        name: formData.name.trim(),
        size_ml: parseInt(formData.size_ml),
        description: formData.description.trim() || null,
      });

      if (error) {
        toast.error("Error creating vial type: " + error.message);
      } else {
        toast.success("Vial type created successfully");
        resetForm();
        fetchVialTypes();
      }
    }

    setLoading(false);
  };

  const handleEdit = (vialType: VialType) => {
    setEditingId(vialType.id);
    setFormData({
      name: vialType.name,
      size_ml: vialType.size_ml.toString(),
      description: vialType.description || "",
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this vial type?")) return;

    const { error } = await supabase
      .from("vial_types")
      .update({ active: false })
      .eq("id", id);

    if (error) {
      toast.error("Error deleting vial type: " + error.message);
    } else {
      toast.success("Vial type deleted successfully");
      fetchVialTypes();
    }
  };

  const resetForm = () => {
    setFormData({ name: "", size_ml: "", description: "" });
    setEditingId(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="mr-2 h-4 w-4" />
          Manage Vial Types
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Vial Types</DialogTitle>
          <DialogDescription>
            Add, edit, or remove vial types for production batches
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 border-b pb-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Standard Vial"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="size_ml">Size (ml) *</Label>
            <Input
              id="size_ml"
              type="number"
              min="1"
              value={formData.size_ml}
              onChange={(e) => setFormData({ ...formData, size_ml: e.target.value })}
              placeholder="e.g., 10"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description"
              rows={2}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Update" : <><Plus className="mr-2 h-4 w-4" />Add</>}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
        </form>

        <div className="space-y-2">
          <h4 className="font-medium text-sm">Existing Vial Types</h4>
          {vialTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No vial types yet</p>
          ) : (
            <div className="space-y-2">
              {vialTypes.map((vialType) => (
                <div
                  key={vialType.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{vialType.name} ({vialType.size_ml}ml)</p>
                    {vialType.description && (
                      <p className="text-sm text-muted-foreground">{vialType.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Status: {vialType.active ? "Active" : "Inactive"}
                    </p>
                  </div>
                  {vialType.active && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(vialType)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(vialType.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManageVialTypesDialog;
