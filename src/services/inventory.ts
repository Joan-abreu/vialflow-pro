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

export const deductBatchMaterials = async (batchId: string) => {
  console.log(`Deducting materials for batch ${batchId}`);

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

  const productVariant = batch.product_id as any;
  if (!productVariant) throw new Error("Product variant not found");

  // Calculate quantity in packs (for material calculation)
  const quantity = batch.sale_type === "pack" && batch.pack_quantity
    ? batch.quantity / batch.pack_quantity
    : batch.quantity;

  // Fetch production configurations
  const { data: configurations, error: configError } = await supabase
    .from("production_configurations")
    .select(`
      raw_material_id,
      quantity_per_unit,
      quantity_usage,
      application_basis,
      calculation_type,
      percentage_value,
      percentage_of_material_id,
      raw_materials!production_configurations_raw_material_id_fkey (
        id,
        name,
        current_stock,
        unit,
        purchase_unit_id,
        usage_unit_id,
        qty_per_container
      )
    `)
    .eq("product_id", productVariant.product_id)
    .eq("vial_type_id", productVariant.vial_type_id);

  if (configError) throw new Error(`Error fetching configurations: ${configError.message}`);

  // Check stock and calculate needed quantities
  const insufficientMaterials: string[] = [];
  const materialUpdates: Array<{ id: string; newStock: number }> = [];

  for (const vm of configurations || []) {
    const material = vm.raw_materials as any;

    if (!material) {
      console.warn(`Material not found for configuration ${vm.raw_material_id}`);
      continue;
    }

    let neededQuantity = 0;

    // Calculate needed quantity based on application basis
    if (vm.calculation_type === 'fixed') {
      if (vm.application_basis === 'per_batch') {
        neededQuantity = vm.quantity_usage || 0;
      } else {
        neededQuantity = quantity * vm.quantity_per_unit;
      }
    } else if (vm.calculation_type === 'per_box') {
      neededQuantity = quantity * vm.quantity_per_unit;
    } else if (vm.calculation_type === 'percentage') {
      console.warn("Percentage calculation not fully implemented in batch creation yet");
    }

    if (neededQuantity > 0) {
      // Get current stock in usage units
      const { data: stockData, error: stockError } = await supabase
        .rpc('get_material_stock_in_usage_units', { material_id: material.id });

      if (stockError) {
        throw new Error(`Error checking stock for ${material.name}`);
      }

      const availableStock = stockData || 0;

      if (availableStock < neededQuantity) {
        insufficientMaterials.push(
          `${material.name}: need ${neededQuantity.toFixed(2)} ${material.unit}, available ${availableStock.toFixed(2)}`
        );
      } else {
        // Calculate new stock in purchase units
        const conversionFactor = material.qty_per_container || 1;
        const stockInPurchaseUnits = material.current_stock;
        const neededInPurchaseUnits = neededQuantity / conversionFactor;

        materialUpdates.push({
          id: material.id,
          newStock: stockInPurchaseUnits - neededInPurchaseUnits
        });
      }
    }
  }

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

  console.log("Materials deducted successfully");
  return { success: true, materialsDeducted: materialUpdates.length };
};

