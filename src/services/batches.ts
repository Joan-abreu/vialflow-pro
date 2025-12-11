import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

export const updateBatchStatus = async (batchId: string) => {
  console.log(`Updating status for batch ${batchId}`);

  try {
    if (!batchId) throw new Error("Batch ID is required");

    // 1️⃣ Obtener el batch
    const { data: batchData, error: batchError } = await supabase
      .from("production_batches")
      .select("id, status, started_at, sale_type, quantity, pack_quantity, waste_quantity, order_id")
      .eq("id", batchId)
      .single();

    if (batchError) throw batchError;
    const batch = batchData;

    let newStatus = batch.status;
    let shippedUnits = 0;
    let totalProcessed = 0;

    // Si tiene order_id, ES UN PEDIDO DE ECOMMERCE.
    // No usamos la lógica de shipments para calcular el estado, ya que se gestiona diferente.
    // Si tiene order_id, ES UN PEDIDO DE ECOMMERCE.
    // Si tiene order_id, ES UN PEDIDO DE ECOMMERCE.
    if (batch.order_id) {
      // Consultamos shipments para ver el estado del envío asociado al batch
      const { data: orderShipments, error: orderShipmentsError } = await supabase
        .from("shipments")
        .select("status")
        .eq("batch_id", batchId);

      console.log("batchId: ", batchId);

      if (!orderShipmentsError && orderShipments && orderShipments.length > 0) {
        // Lógica simplificada: Si hay algún shipment, asumimos que afecta a todos los batches de la orden por igual

        const hasLabel = orderShipments.some(s => ['preparing'].includes(s.status));
        const isDelivered = orderShipments.every(s => s.status === 'delivered');

        if (isDelivered) {
          newStatus = 'completed';
          shippedUnits = batch.quantity / batch.pack_quantity; // Todo enviado
          totalProcessed = batch.quantity / batch.pack_quantity + (batch.waste_quantity || 0);
        } else if (hasLabel) {
          newStatus = 'in_progress';
          totalProcessed = batch.quantity / batch.pack_quantity + (batch.waste_quantity || 0); // Asumimos en proceso

          const isShipped = orderShipments.some(s => s.status === 'shipped');
          if (isShipped) {
            shippedUnits = batch.quantity / batch.pack_quantity;
          }
        }
      }

      // Si el status calculado (o mantenido) es completed, verificamos si todos los batches de la orden están completos
      if (newStatus === 'completed') {
        const { data: allBatches, error: allBatchesErr } = await supabase
          .from("production_batches")
          .select("id, status")
          .eq("order_id", batch.order_id);

        if (!allBatchesErr && allBatches) {
          // Todos deben estar completed (el actual lo consideramos completed por newStatus)
          const othersCompleted = allBatches.every(b => b.id === batchId || b.status === 'completed');

          if (othersCompleted) {
            console.log(`All batches for order ${batch.order_id} are completed (with current update). Updating order status.`);
            const { error: orderUpdateError } = await supabase
              .from("orders")
              .update({ status: 'ready_to_ship' })
              .eq("id", batch.order_id);

            if (orderUpdateError) {
              console.error("Error updating order status:", orderUpdateError);
            }
          }
        }
      }

      // PREPARAMOS DATA PARA UPDATE Y SALIMOS
      const updateDataEcommerce: any = {
        status: newStatus,
        shipped_units: shippedUnits,
        units_in_progress: totalProcessed,
      };

      if (newStatus === 'completed') {
        updateDataEcommerce.completed_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from("production_batches")
        .update(updateDataEcommerce)
        .eq("id", batchId);

      if (updateError) throw updateError;
      console.log("Batch (Ecommerce) updated successfully:", updateDataEcommerce);

      return;
    }

    // LÓGICA EXISTENTE PARA FBA / BATCHES SIN ORDER_ID

    // 2️⃣ Obtener los shipments del batch
    const { data: shipments, error: shipmentsError } = await supabase
      .from("shipments")
      .select("id, status, created_at")
      .eq("batch_id", batchId);

    if (shipmentsError) throw shipmentsError;

    // 3️⃣ Encontrar el primer shipment pending
    const firstPendingShipment = shipments
      ?.filter((s) => s.status === "pending")
      ?.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];

    // 4️⃣ Obtener las cajas de todos los shipments
    const shipmentIds = shipments?.map((s) => s.id) || [];
    const { data: boxes, error: boxesError } = await supabase
      .from("shipment_boxes")
      .select("packs_per_box, bottles_per_box, shipment_id")
      .in("shipment_id", shipmentIds);

    if (boxesError) throw boxesError;

    // 5️⃣ Calcular units_in_progress (preparing + pending)
    // const inProgressShipmentIds = shipments
    //   ?.filter((s) => s.status === "preparing" || s.status === "pending")
    //   ?.map((s) => s.id) || [];

    const inProgressBoxes = boxes?.filter((box) =>
      shipmentIds.includes(box.shipment_id)
    ) || [];

    const unitsInProgress = inProgressBoxes.reduce((sum, box) => {
      if (batch.sale_type === "pack") return sum + (box.packs_per_box || 0);
      return sum + (box.bottles_per_box || 0);
    }, 0);

    // Include waste_quantity in progress calculation
    const wasteQuantity = batch.waste_quantity / batch.pack_quantity || 0;
    totalProcessed = unitsInProgress + wasteQuantity;

    // 6️⃣ Calcular shipped_units (shipped + delivered)
    const shippedShipmentIds = shipments
      ?.filter((s) => s.status === "shipped" || s.status === "delivered")
      ?.map((s) => s.id) || [];

    const shippedBoxes = boxes?.filter((box) =>
      shippedShipmentIds.includes(box.shipment_id)
    ) || [];

    shippedUnits = shippedBoxes.reduce((sum, box) => {
      if (batch.sale_type === "pack") return sum + (box.packs_per_box || 0);
      return sum + (box.bottles_per_box || 0);
    }, 0);

    // 7️⃣ Determinar estado del batch
    newStatus = "pending";

    // Si NO hay shipments → el batch está vacío, sigue pending
    if (!shipments || shipments.length === 0) {
      newStatus = "pending";
    }

    // Si TODOS están delivered Y la cantidad procesada + waste = total → completed
    else if (shipments.every((s) => s.status === "delivered")) {
      // Verificar que el total procesado (shipments + waste) coincida con la cantidad del batch
      const batchQuantity = batch.quantity / batch.pack_quantity || 0;
      const totalAccountedFor = unitsInProgress + wasteQuantity;

      if (totalAccountedFor >= batchQuantity) {
        newStatus = "completed";
      } else {
        // Si no se ha procesado todo, mantener en in_progress
        newStatus = "in_progress";
      }
    }

    // Si ALGUNO está pending o preparing → in_progress
    else if (shipments.some((s) => s.status === "pending" || s.status === "preparing")) {
      newStatus = "in_progress";
    }

    // 8️⃣ Construir objeto de update
    const updateData: any = {
      status: newStatus,
      shipped_units: shippedUnits,
      units_in_progress: totalProcessed, // Include waste in progress
    };

    // Si no tiene started_at y hay un shipment pending → marcar started_at
    if (!batch.started_at && firstPendingShipment) {
      updateData.started_at = firstPendingShipment.created_at;
    }

    // Si está completed → marcar completed_at
    updateData.completed_at =
      newStatus === "completed" ? new Date().toISOString() : null;

    // 9️⃣ Actualizar batch
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
