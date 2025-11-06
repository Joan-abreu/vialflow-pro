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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Settings, Trash2, Plus } from "lucide-react";

interface VialType {
  id: string;
  name: string;
  size_ml: number;
}

interface Material {
  id: string;
  name: string;
  unit: string;
}

interface VialMaterial {
  id: string;
  vial_type_id: string;
  raw_material_id: string;
  quantity_per_unit: number;
  application_type: 'per_unit' | 'per_pack' | 'per_box';
  raw_materials: {
    name: string;
    unit: string;
  };
}

export default function ManageVialMaterialsDialog() {
  const [open, setOpen] = useState(false);
  const [vialTypes, setVialTypes] = useState<VialType[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedVialType, setSelectedVialType] = useState<string>("");
  const [vialMaterials, setVialMaterials] = useState<VialMaterial[]>([]);
  const [loading, setLoading] = useState(false);

  // New material form
  const [selectedMaterial, setSelectedMaterial] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");
  const [applicationType, setApplicationType] = useState<'per_unit' | 'per_pack' | 'per_box'>('per_unit');

  useEffect(() => {
    if (open) {
      fetchVialTypes();
      fetchMaterials();
    }
  }, [open]);

  useEffect(() => {
    if (selectedVialType) {
      fetchVialMaterials();
    }
  }, [selectedVialType]);

  const fetchVialTypes = async () => {
    const { data, error } = await supabase
      .from("vial_types")
      .select("id, name, size_ml")
      .eq("active", true)
      .order("name");

    if (error) {
      toast.error("Error loading vial types");
      return;
    }

    setVialTypes(data || []);
    if (data && data.length > 0 && !selectedVialType) {
      setSelectedVialType(data[0].id);
    }
  };

  const fetchMaterials = async () => {
    const { data, error } = await supabase
      .from("raw_materials")
      .select("id, name, unit")
      .order("name");

    if (error) {
      toast.error("Error loading materials");
      return;
    }

    setMaterials(data || []);
  };

  const fetchVialMaterials = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("vial_type_materials")
      .select(`
        id,
        vial_type_id,
        raw_material_id,
        quantity_per_unit,
        application_type,
        raw_materials (
          name,
          unit
        )
      `)
      .eq("vial_type_id", selectedVialType);

    if (error) {
      toast.error("Error loading vial materials");
      setLoading(false);
      return;
    }

    setVialMaterials((data || []) as VialMaterial[]);
    setLoading(false);
  };

  const handleAddMaterial = async () => {
    if (!selectedMaterial || !quantity || parseFloat(quantity) <= 0) {
      toast.error("Please select a material and enter a valid quantity");
      return;
    }

    const { error } = await supabase
      .from("vial_type_materials")
      .insert({
        vial_type_id: selectedVialType,
        raw_material_id: selectedMaterial,
        quantity_per_unit: parseFloat(quantity),
        application_type: applicationType,
      });

    if (error) {
      if (error.code === "23505") {
        toast.error("This material is already added to this vial type");
      } else {
        toast.error("Error adding material");
      }
      return;
    }

    toast.success("Material added successfully");
    setSelectedMaterial("");
    setQuantity("1");
    setApplicationType('per_unit');
    fetchVialMaterials();
  };

  const handleDeleteMaterial = async (id: string) => {
    const { error } = await supabase
      .from("vial_type_materials")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Error deleting material");
      return;
    }

    toast.success("Material removed");
    fetchVialMaterials();
  };

  const availableMaterials = materials.filter(
    (m) => !vialMaterials.some((vm) => vm.raw_material_id === m.id)
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Settings className="w-4 h-4 mr-2" />
          Configure Materials
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Vial Materials</DialogTitle>
          <DialogDescription>
            Define which materials are needed for each vial type and their quantities per unit
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Vial Type Selector */}
          <div className="space-y-2">
            <Label>Select Vial Type</Label>
            <Select value={selectedVialType} onValueChange={setSelectedVialType}>
              <SelectTrigger>
                <SelectValue placeholder="Select a vial type" />
              </SelectTrigger>
              <SelectContent>
                {vialTypes.map((vt) => (
                  <SelectItem key={vt.id} value={vt.id}>
                    {vt.name} ({vt.size_ml}ml)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Add Material Form */}
          {selectedVialType && (
            <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
              <h3 className="font-semibold">Add Material</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Material</Label>
                  <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select material" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMaterials.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} ({m.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Qty per Unit</Label>
                  <Input
                    type="number"
                    step="0.000001"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Application Type</Label>
                <Select value={applicationType} onValueChange={(value: 'per_unit' | 'per_pack' | 'per_box') => setApplicationType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_unit">Per Unit (cada producto individual)</SelectItem>
                    <SelectItem value="per_pack">Per Pack (uno por cada paquete)</SelectItem>
                    <SelectItem value="per_box">Per Box (uno por cada caja de envío)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddMaterial} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Material
              </Button>
            </div>
          )}

          {/* Materials Table */}
          {selectedVialType && (
            <div className="space-y-2">
              <h3 className="font-semibold">Current Materials</h3>
              {loading ? (
                <div className="text-center py-4">Loading...</div>
              ) : vialMaterials.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  No materials configured for this vial type
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Qty per Unit</TableHead>
                      <TableHead>Application</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vialMaterials.map((vm) => (
                      <TableRow key={vm.id}>
                        <TableCell>{vm.raw_materials.name}</TableCell>
                        <TableCell>{vm.raw_materials.unit}</TableCell>
                        <TableCell className="text-right">
                          {vm.quantity_per_unit < 0.01 
                            ? vm.quantity_per_unit.toFixed(6).replace(/\.?0+$/, '')
                            : vm.quantity_per_unit.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {vm.application_type === 'per_unit' ? 'Per Unit' : 
                           vm.application_type === 'per_pack' ? 'Per Pack' : 'Per Box'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteMaterial(vm.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
