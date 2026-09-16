import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!
    );

    const payload = await req.json();
    console.log("[Shippo Webhook] Received payload:", JSON.stringify(payload));

    const { event, data } = payload;

    if (event !== "track_updated") {
      return new Response(JSON.stringify({ message: "Event ignored" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trackingNumber = data.tracking_number;
    const trackingStatus = data.tracking_status;
    const status = trackingStatus?.status?.toLowerCase();
    const substatus = trackingStatus?.substatus?.code;

    if (!trackingNumber) {
      throw new Error("Missing tracking number in webhook payload");
    }

    // 1. Find the shipment
    const { data: shipment, error: shipmentError } = await supabase
      .from("order_shipments")
      .select("*, orders(*)")
      .eq("tracking_number", trackingNumber)
      .maybeSingle();

    if (shipmentError || !shipment) {
      console.warn(`[Shippo Webhook] Shipment not found for tracking number: ${trackingNumber}`);
      return new Response(JSON.stringify({ message: "Shipment not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderId = shipment.order_id;
    const currentOrderStatus = shipment.orders?.status;
    const rawStatusDetails = payload.data.tracking_status?.status_details || "";
    const detailText = rawStatusDetails.toLowerCase();

    // Helper: Detect carrier exceptions, law enforcement seizures, or counterfeit postage flags
    const checkCarrierException = (st?: string, sub?: string, details?: string) => {
      const s = (st || "").toLowerCase();
      const sb = (sub || "").toLowerCase();
      const d = (details || "").toLowerCase();

      if (
        d.includes("seized") ||
        d.includes("cntrft") ||
        d.includes("counterfeit") ||
        d.includes("law enforcement") ||
        d.includes("confiscated")
      ) {
        return { isException: true, reason: "Seized by Law Enforcement / Counterfeit Postage" };
      }

      if (
        d.includes("return to sender") ||
        d.includes("returned to sender") ||
        d.includes("undeliverable") ||
        d.includes("damaged in transit") ||
        d.includes("destroyed") ||
        sb.includes("return_to_sender") ||
        sb.includes("package_damaged")
      ) {
        return { isException: true, reason: "Delivery Exception / Return to Sender" };
      }

      if (
        s === "failure" ||
        sb.includes("exception") ||
        sb.includes("failure") ||
        sb === "action_required"
      ) {
        return { isException: true, reason: "Carrier Exception / Failure" };
      }

      return { isException: false, reason: "" };
    };

    const exceptionCheck = checkCarrierException(status, substatus, detailText);

    // 2. Map Shippo status to our internal status
    let internalShipmentStatus = shipment.status;
    let targetOrderStatus = currentOrderStatus;
    let emailType: string | null = null;

    if (exceptionCheck.isException) {
      console.warn(`[Shippo Webhook] 🚨 CARRIER EXCEPTION DETECTED on order ${orderId}: ${exceptionCheck.reason} - ${rawStatusDetails}`);
      internalShipmentStatus = "exception";
      targetOrderStatus = "carrier_exception";
      emailType = null; // NEVER send "In Transit" or regular customer update on carrier exceptions!
    } else if (status === "delivered") {
      internalShipmentStatus = "delivered";
      targetOrderStatus = "delivered";
      emailType = "delivered";
    } else if (substatus === "out_for_delivery" || status === "out_for_delivery" || detailText.includes("out for delivery")) {
      internalShipmentStatus = "out_for_delivery";
      targetOrderStatus = "out_for_delivery";
      emailType = "out_for_delivery";
    } else if (status === "transit") {
      internalShipmentStatus = "in_transit";
      targetOrderStatus = "in_transit";
      // Only send in_transit email if it wasn't already marked as in_transit
      if (currentOrderStatus !== "in_transit" && currentOrderStatus !== "out_for_delivery" && currentOrderStatus !== "delivered") {
        emailType = "in_transit";
      }
    } else {
      // pre_transit or shipped -> shipped
      if (currentOrderStatus === "pickup_scheduled") {
        internalShipmentStatus = "pickup_scheduled";
        targetOrderStatus = "pickup_scheduled";
      } else {
        internalShipmentStatus = "shipped";
        targetOrderStatus = "shipped";
        // Only send shipped email if it wasn't already marked as shipped or further
        if (
          currentOrderStatus !== "shipped" && 
          currentOrderStatus !== "in_transit" && 
          currentOrderStatus !== "out_for_delivery" && 
          currentOrderStatus !== "delivered"
        ) {
          emailType = "shipped";
        }
      }
    }

    // Merge rather than overwrite to preserve original transaction details like object_id
    const currentResponse = shipment.carrier_response;
    const mergedResponse = {
      ...(typeof currentResponse === "object" && currentResponse !== null ? currentResponse : {}),
      tracking_update: data,
      last_exception: exceptionCheck.isException ? {
        reason: exceptionCheck.reason,
        details: rawStatusDetails,
        date: payload.data.tracking_status?.status_date || new Date().toISOString()
      } : (currentResponse?.last_exception || null)
    };

    // 3. Update order_shipments
    const { error: updateShipmentError } = await supabase
      .from("order_shipments")
      .update({
        status: internalShipmentStatus,
        updated_at: new Date().toISOString(),
        carrier_response: mergedResponse
      })
      .eq("id", shipment.id);

    if (updateShipmentError) throw updateShipmentError;

    // 4. Update order status if changed
    if (targetOrderStatus !== currentOrderStatus) {
      const { error: updateOrderError } = await supabase
        .from("orders")
        .update({
          status: targetOrderStatus
        })
        .eq("id", orderId);

      if (updateOrderError) throw updateOrderError;
    }

    // 5. If Carrier Exception: Add internal note & trigger admin alert email
    if (exceptionCheck.isException) {
      // Insert internal order note
      try {
        await supabase.from("order_notes").insert({
          order_id: orderId,
          author_name: "Carrier System (USPS/Shippo)",
          note: `🚨 CARRIER EXCEPTION: [${rawStatusDetails || exceptionCheck.reason}]. Tracking: ${trackingNumber}. Automated customer notification suppressed.`,
        });
      } catch (noteErr) {
        console.error("[Shippo Webhook] Failed to insert exception note:", noteErr);
      }

      // Send alert email to admins
      try {
        console.log(`[Shippo Webhook] Dispatching carrier_exception_alert to admin for order ${orderId}`);
        await fetch(`${SUPABASE_URL}/functions/v1/send-order-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            order_id: orderId,
            type: "carrier_exception_alert",
            carrier: shipment.carrier || payload.data.tracking_status?.carrier || "USPS",
            tracking_number: trackingNumber,
            exception_reason: exceptionCheck.reason,
            status_details: rawStatusDetails,
            status_date: payload.data.tracking_status?.status_date,
          }),
        });
      } catch (alertErr) {
        console.error("[Shippo Webhook] Failed to send admin exception alert:", alertErr);
      }
    } else if (emailType && targetOrderStatus !== currentOrderStatus) {
      // Regular customer notification if status progressed
      console.log(`[Shippo Webhook] Triggering ${emailType} email for order ${orderId}`);
      
      const emailResponse = await fetch(
        `${SUPABASE_URL}/functions/v1/send-order-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            order_id: orderId,
            type: emailType,
            status_details: payload.data.tracking_status?.status_details,
            status_date: payload.data.tracking_status?.status_date,
          }),
        }
      );

      if (!emailResponse.ok) {
        const emailError = await emailResponse.text();
        console.error(`[Shippo Webhook] Failed to send email: ${emailError}`);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[Shippo Webhook] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
