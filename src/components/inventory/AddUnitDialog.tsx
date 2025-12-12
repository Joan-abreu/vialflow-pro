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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Settings, Loader2, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface AddUnitDialogProps {
  onSuccess: () => void;
}

interface Unit {
  id: string;
  name: string;
  abbreviation: string;
  category: string;
  active: boolean;
}

const AddUnitDialog = ({ onSuccess }: AddUnitDialogProps) => {
  const [open, setOpen] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingUnit, setDeletingUnit] = useState<Unit | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    abbreviation: "",
    category: "",
  });

  const fetchUnits = async () => {
    const { data } = await supabase
      .from("units_of_measurement")
      .select("*")
      .order("category")
      .order("name");

    if (data) setUnits(data);
  };

  useEffect(() => {
    if (open) fetchUnits();
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from("units_of_measurement").insert({
      name: formData.name.trim(),
      abbreviation: formData.abbreviation.trim(),
      category: formData.category,
    });

    setLoading(false);

    if (error) {
      toast.error("Error creating unit: " + error.message);
    } else {
      toast.success("Unit created successfully");
      setFormData({
        name: "",
        abbreviation: "",
        category: "",
      });
      fetchUnits();
      onSuccess();
    }
  };

  const handleDeleteUnit = async () => {
    if (!deletingUnit) return;

    const { error } = await supabase
      .from("units_of_measurement")
      .delete()
      .eq("id", deletingUnit.id);

    if (error) {
      toast.error("Cannot delete unit: " + error.message);
    } else {
      toast.success("Unit deleted successfully");
      fetchUnits();
      onSuccess();
    }

    setDeletingUnit(null);
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase
      .from("units_of_measurement")
      .update({ active: !active })
      .eq("id", id);

    if (error) {
      toast.error("Error updating unit: " + error.message);
    } else {
      toast.success(`Unit ${active ? 'disabled' : 'enabled'}`);
      fetchUnits();
      onSuccess();
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      weight: "bg-blue-100 text-blue-800",
      volume: "bg-green-100 text-green-800",
      quantity: "bg-purple-100 text-purple-800",
      length: "bg-orange-100 text-orange-800",
    };
    return colors[category] || "bg-gray-100 text-gray-800";
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg">
          <Settings className="mr-2 h-4 w-4" />
          Manage Units
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Manage Units of Measurement</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Add, remove, or toggle units for inventory management
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-xs sm:text-sm">Unit Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Pallets"
                required
                maxLength={50}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="abbreviation" className="text-xs sm:text-sm">Abbreviation *</Label>
              <Input
                id="abbreviation"
                value={formData.abbreviation}
                onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
                placeholder="e.g., plt"
                required
                maxLength={10}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category" className="text-xs sm:text-sm">Category *</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
              required
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weight">Weight</SelectItem>
                <SelectItem value="volume">Volume</SelectItem>
                <SelectItem value="quantity">Quantity</SelectItem>
                <SelectItem value="length">Length</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add Unit
              </>
            )}
          </Button>
        </form>

        <div className="mt-4">
          <Label className="text-xs sm:text-sm">Existing Units</Label>
          <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto">
            {units.length === 0 ? (
              <p className="text-xs sm:text-sm text-muted-foreground py-4 text-center">
                No units yet
              </p>
            ) : (
              units.map((unit) => (
                <div
                  key={unit.id}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-3 border rounded-lg gap-2"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-xs sm:text-sm">{unit.name}</span>
                    <Badge variant="outline" className="text-[10px] sm:text-xs">
                      {unit.abbreviation}
                    </Badge>
                    <Badge className={`text-[10px] sm:text-xs capitalize ${getCategoryColor(unit.category)}`}>
                      {unit.category}
                    </Badge>
                    {!unit.active && (
                      <Badge variant="secondary" className="text-[10px] sm:text-xs">Disabled</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`active-${unit.id}`}
                        checked={unit.active}
                        onCheckedChange={() => handleToggleActive(unit.id, unit.active)}
                      />
                      <Label htmlFor={`active-${unit.id}`} className="text-xs sm:text-sm cursor-pointer">
                        Active
                      </Label>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingUnit(unit)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingUnit} onOpenChange={(open) => !open && setDeletingUnit(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Unit</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the unit "{deletingUnit?.name} ({deletingUnit?.abbreviation})"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUnit}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default AddUnitDialog;
