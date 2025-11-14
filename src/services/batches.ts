import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

export const updateBatchStatus = async (batchId: string) => {
  console.log(`Updating status for batch ${batchId}`);

  try {
    if (!batchId) throw new Error("Batch ID is required");

    // 1️⃣ Obtener el batch
    const { data: batchData, error: batchError } = await supabase
      .from<Tables<"production_batches">>("production_batches")
      .select("id, status, started_at")
      .eq("id", batchId)
      .single();

    if (batchError) throw batchError;
    const batch = batchData;

    // 2️⃣ Obtener los shipments del batch
    const { data: shipments, error: shipmentsError } = await supabase
      .from<Tables<"shipments">>("shipments")
      .select("id, status, created_at")
      .eq("batch_id", batchId);

    if (shipmentsError) throw shipmentsError;

    // 3️⃣ Encontrar el primer shipment pending
    const firstPendingShipment = shipments
      ?.filter((s) => s.status === "pending")
      ?.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];

    // 4️⃣ Obtener las cajas
    const shipmentIds = shipments?.map((s) => s.id) || [];
    const { data: boxes, error: boxesError } = await supabase
      .from<Tables<"shipment_boxes">>("shipment_boxes")
      .select("packs_per_box, bottles_per_box")
      .in("shipment_id", shipmentIds);

    if (boxesError) throw boxesError;

    // 5️⃣ Calcular shipped_units (suponiendo que tienes saleType en contexto)
    const shippedUnits =
      boxes?.reduce((sum, box) => {
        if (saleType === "pack") return sum + (box.packs_per_box || 0);
        return sum + (box.bottles_per_box || 0);
      }, 0) || 0;

    // 6️⃣ Determinar estado del batch
    let newStatus: Tables<"production_batches">["status"] = "pending";

    // Si NO hay shipments → el batch está vacío, sigue pending
    if (!shipments || shipments.length === 0) {
        newStatus = "pending";
    }

    // Si TODOS están delivered → completed
    else if (shipments.every((s) => s.status === "delivered")) {
        newStatus = "completed";
    }

    // Si ALGUNO está pending → in_progress
    else if (shipments.some((s) => s.status === "pending" || s.status === "preparing")) {
        newStatus = "in_progress";
    }
    // 7️⃣ Construir objeto de update
    const updateData: any = {
      status: newStatus,
      shipped_units: shippedUnits,
    };

    // Si no tiene started_at y hay un shipment pending → marcar started_at
    if (!batch.started_at && firstPendingShipment) {
      updateData.started_at = firstPendingShipment.created_at;
    }

    // Si está completed → marcar completed_at
    updateData.completed_at =
      newStatus === "completed" ? new Date().toISOString() : null;

    // 8️⃣ Actualizar batch
    const { error: updateError } = await supabase
      .from("production_batches")
      .update(updateData)
      .eq("id", batchId);

    if (updateError) throw updateError;

    console.log("Batch updated successfully:", updateData);
  } catch (error) {
    console.error("Error updating batch:", error);
  }
};
