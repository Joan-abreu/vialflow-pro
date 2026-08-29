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
  return newStock;
};

export const deductMaterialsForProduction = async (
  materials: MaterialRequirement[],
  totalUnits: number
) => {
  for (const material of materials) {
    const totalRequired = material.required_quantity * totalUnits;
    await updateMaterialStock(material.material_id, totalRequired, "deduct");
  }
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
};

export const deductBatchMaterials = async (batchId: string) => {
  // Fetch batch details
  const { data: batch, error: batchError } = await supabase
    .from("production_batches")
    .select(`
      id,
      quantity,
      sale_type,
      pack_quantity,
      product_id (
        id,
        product_id,
        vial_type_id
      )
    `)
    .eq("id", batchId)
    .single();

  if (batchError) throw new Error(`Error fetching batch: ${batchError.message}`);
  if (!batch) throw new Error("Batch not found");

  const productVariant = batch.product_id;
  if (!productVariant) throw new Error("Product variant not found for batch");

  // Fetch production configurations (materials) for this variant and vial type
  const { data: configurations, error: configError } = await supabase
    .from("production_configurations")
    .select(`
      id,
      raw_material_id,
      quantity_per_unit,
      quantity_usage,
      application_basis,
      calculation_type,
      units_per_box,
      raw_materials (
        id,
        name,
        current_stock,
        unit
      )
    `)
    .eq("vial_type_id", productVariant.vial_type_id)
    .eq("product_id", productVariant.id);

  if (configError) throw new Error(`Error fetching material configurations: ${configError.message}`);
  if (!configurations || configurations.length === 0) {
    return { success: true, materialsDeducted: 0, message: "No materials configured for this product" };
  }

  // Calculate quantity in packs (for material calculation)
  const quantityInPacks = batch.sale_type === "pack" && batch.pack_quantity
    ? batch.quantity / batch.pack_quantity
    : batch.quantity;

  // Track updates to be made
  const materialUpdates: { id: string; name: string; currentStock: number; requiredQty: number; newStock: number }[] = [];
  const insufficientMaterials: string[] = [];

  for (const config of configurations) {
    const rawMaterial = config.raw_materials as any;
    if (!rawMaterial) continue;

    let totalQty = 0;

    // Calculation logic matching BillOfMaterials.tsx
    if (config.calculation_type === 'usage') {
      const usage = config.quantity_usage || 0;
      if (config.application_basis === 'box' && config.units_per_box) {
        const fullBoxes = Math.floor(batch.quantity / config.units_per_box);
        const remainder = batch.quantity % config.units_per_box;
        totalQty = (fullBoxes * usage) + (remainder > 0 ? (remainder / config.units_per_box) * usage : 0);
      } else {
        totalQty = usage * batch.quantity;
      }
    } else {
      const perUnit = config.quantity_per_unit || 0;
      if (config.application_basis === 'unit') {
        totalQty = perUnit * batch.quantity;
      } else if (config.application_basis === 'pack') {
        totalQty = perUnit * quantityInPacks;
      } else if (config.application_basis === 'box' && config.units_per_box) {
        totalQty = (batch.quantity / config.units_per_box) * perUnit;
      } else {
        totalQty = perUnit * batch.quantity;
      }
    }

    const currentStock = rawMaterial.current_stock || 0;
    const newStock = currentStock - totalQty;

    if (newStock < 0) {
      insufficientMaterials.push(
        `${rawMaterial.name}: Needs ${totalQty.toFixed(2)} ${rawMaterial.unit || 'units'}, but only ${currentStock} available (Short by ${Math.abs(newStock).toFixed(2)})`
      );
    }

    materialUpdates.push({
      id: rawMaterial.id,
      name: rawMaterial.name,
      currentStock,
      requiredQty: totalQty,
      newStock
    });
  }

  // If any material is insufficient, abort the whole operation
  if (insufficientMaterials.length > 0) {
    throw new Error("Insufficient materials:\n" + insufficientMaterials.join("\n"));
  }

  // Update material stocks
  for (const update of materialUpdates) {
    const { error } = await supabase
      .from("raw_materials")
      .update({ current_stock: update.newStock })
      .eq("id", update.id);

    if (error) throw new Error(`Error updating stock: ${error.message}`);
  }

  return { success: true, materialsDeducted: materialUpdates.length };
};
