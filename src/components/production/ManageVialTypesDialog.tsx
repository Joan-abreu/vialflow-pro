import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

interface VialType {
  id: string;
  name: string;
  size_ml: number;
  description: string | null;
  active: boolean;
}

export default function ManageVialTypesDialog() {
  const [open, setOpen] = useState(false);
  const [vialTypes, setVialTypes] = useState<VialType[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<VialType | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    size_ml: "",
    description: "",
    active: true,
  });

  useEffect(() => {
    if (open) fetchVialTypes();
  }, [open]);

  const fetchVialTypes = async () => {
    const { data, error } = await supabase
      .from("vial_types")
      .select("*")
      .order("size_ml");

    if (error) {
      toast.error("Failed to load vial types");
      return;
    }

    setVialTypes(data || []);
  };

  const resetForm = () => {
    setEditing(null);
    setFormData({
      name: "",
      size_ml: "",
      description: "",
      active: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editing) {
        const { error } = await supabase
          .from("vial_types")
          .update({
            name: formData.name.trim(),
            size_ml: parseInt(formData.size_ml),
            description: formData.description.trim() || null,
            active: formData.active,
          })
          .eq("id", editing.id);

        if (error) throw error;

        toast.success("Vial updated");
      } else {
        const { error } = await supabase
          .from("vial_types")
          .insert({
            name: formData.name.trim(),
            size_ml: parseInt(formData.size_ml),
            description: formData.description.trim() || null,
            active: formData.active,
          });

        if (error) throw error;

        toast.success("Vial added");
      }

      resetForm();
      fetchVialTypes();
    } catch (err) {
      toast.error("Error saving vial type");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (vial: VialType) => {
    setEditing(vial);
    setFormData({
      name: vial.name,
      size_ml: vial.size_ml.toString(),
      description: vial.description || "",
      active: vial.active,
    });
  };

  const handleDelete = async (id: string) => {
    const { data: batches, error: batchError } = await supabase
      .from("production_batches")
      .select("id")
      .eq("vial_type_id", id);

    if (batchError) {
      toast.error("Error checking batches");
      return;
    }

    if (batches && batches.length > 0) {
      toast.error(
        `Cannot delete this vial type. It is used in ${batches.length} production batch(es).`
      );
      return;
    }

    const { error } = await supabase
      .from("vial_types")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Error deleting vial type");
    } else {
      toast.success("Vial type deleted");
      fetchVialTypes();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Manage Vials
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Vial Types</DialogTitle>
          <DialogDescription>
            Add, edit, or delete vial types
          </DialogDescription>
        </DialogHeader>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 border-b pb-8">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Size (ml) *</Label>
              <Input
                type="number"
                value={formData.size_ml}
                onChange={(e) => setFormData({ ...formData, size_ml: e.target.value })}
                required
              />
            </div>

            <div>
            <Label>Active</Label>
            <div className="flex items-center gap-2 pt-2">
              <Switch
                checked={formData.active}
                onCheckedChange={(v) => setFormData({ ...formData, active: v })}
              />
              <span>{formData.active ? "Active" : "Inactive"}</span>
            </div>
          </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : editing ? "Update Vial" : "Add Vial"}
            </Button>

            {editing && (
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
        </form>

        {/* Table of existing vial types */}
        <h4 className="font-medium text-lg mt-4">Existing Vial Types</h4>

        <div className="border rounded-lg mt-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Size (ml)</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {vialTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No vial types found
                  </TableCell>
                </TableRow>
              ) : (
                vialTypes.map((vial) => (
                  <TableRow key={vial.id}>
                    <TableCell>{vial.name}</TableCell>
                    <TableCell>{vial.size_ml} ml</TableCell>
                    <TableCell>{vial.description || "-"}</TableCell>
                    <TableCell>
                      <span className={vial.active ? "text-green-600" : "text-gray-400"}>
                        {vial.active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(vial)}>
                          <Pencil className="h-4 w-4" />
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>

                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Vial Type</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{vial.name}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>

                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleDelete(vial.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
