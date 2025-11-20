import { supabase } from "@/integrations/supabase/client";

export interface MaterialRequirement {
  material_id: string;
  material_name: string;
  required_quantity: number;
  available_stock: number;
  usage_unit?: string;
}

export const getMaterialStock = async (materialId: string): Promise<number> => {
  const { data, error } = await supabase
    .from("raw_materials")
    .select("current_stock")
    .eq("id", materialId)
    .single();

  if (error) throw error;
  return data?.current_stock || 0;
};

export const updateMaterialStock = async (
  materialId: string,
  quantityChange: number,
  operation: "add" | "deduct"
) => {
  console.log(`${operation === "add" ? "Adding" : "Deducting"} ${quantityChange} units for material ${materialId}`);

  const currentStock = await getMaterialStock(materialId);
  const newStock = operation === "add" 
    ? currentStock + quantityChange 
    : currentStock - quantityChange;

  if (newStock < 0) {
    throw new Error(`Insufficient stock for material ${materialId}. Available: ${currentStock}, Required: ${quantityChange}`);
  }

  const { error } = await supabase
    .from("raw_materials")
    .update({ current_stock: newStock })
    .eq("id", materialId);

  if (error) throw error;

  console.log(`Material ${materialId} stock updated: ${currentStock} -> ${newStock}`);
  return newStock;
};

export const deductMaterialsForProduction = async (
  materials: MaterialRequirement[],
  totalUnits: number
) => {
  console.log(`Deducting materials for ${totalUnits} units`);

  for (const material of materials) {
    const totalRequired = material.required_quantity * totalUnits;
    await updateMaterialStock(material.material_id, totalRequired, "deduct");
  }

  console.log("All materials deducted successfully");
};

export const checkMaterialsAvailability = async (
  materials: MaterialRequirement[],
  totalUnits: number
): Promise<{ available: boolean; insufficient: MaterialRequirement[] }> => {
  const insufficient: MaterialRequirement[] = [];

  for (const material of materials) {
    const totalRequired = material.required_quantity * totalUnits;
    if (material.available_stock < totalRequired) {
      insufficient.push(material);
    }
  }

  return {
    available: insufficient.length === 0,
    insufficient,
  };
};

export const addMaterialStock = async (
  materialId: string,
  quantity: number
) => {
  return updateMaterialStock(materialId, quantity, "add");
};

export const restoreMaterialsForBatch = async (batchId: string) => {
  console.log(`Restoring materials for batch ${batchId}`);

  const { data: batch, error: batchError } = await supabase
    .from("production_batches")
    .select("quantity, vial_type_id")
    .eq("id", batchId)
    .single();

  if (batchError) throw batchError;

  const { data: materials, error: materialsError } = await supabase
    .from("vial_type_materials")
    .select(`
      quantity_per_unit,
      raw_material_id,
      raw_materials (
        name,
        current_stock,
        usage_unit_id,
        units_of_measurement!raw_materials_usage_unit_id_fkey (
          abbreviation
        )
      )
    `)
    .eq("vial_type_id", batch.vial_type_id);

  if (materialsError) throw materialsError;

  for (const material of materials) {
    const totalUsed = material.quantity_per_unit * batch.quantity;
    await updateMaterialStock(material.raw_material_id, totalUsed, "add");
  }

  console.log("Materials restored successfully");
};
