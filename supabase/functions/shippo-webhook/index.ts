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

    // 2. Map Shippo status to our internal status
    let internalStatus = shipment.status;
    let emailType: string | null = null;

    if (status === "delivered") {
      internalStatus = "delivered";
      emailType = "delivered";
    } else if (substatus === "out_for_delivery") {
      internalStatus = "out_for_delivery";
      emailType = "out_for_delivery";
    } else if (status === "transit") {
      internalStatus = "shipped";
      // Only send shipped email if it wasn't already marked as shipped
      if (currentOrderStatus !== "shipped") {
        emailType = "shipped";
      }
    }

    // 3. Update order_shipments
    const { error: updateShipmentError } = await supabase
      .from("order_shipments")
      .update({
        status: internalStatus,
        updated_at: new Date().toISOString(),
        carrier_response: data // Update with latest full tracking data
      })
      .eq("id", shipment.id);

    if (updateShipmentError) throw updateShipmentError;

    // 4. Update order status if it changed
    if (internalStatus !== currentOrderStatus) {
      const { error: updateOrderError } = await supabase
        .from("orders")
        .update({
          status: internalStatus
        })
        .eq("id", orderId);

      if (updateOrderError) throw updateOrderError;

      // 5. Trigger email if we have a type
      if (emailType) {
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
            }),
          }
        );

        if (!emailResponse.ok) {
          const emailError = await emailResponse.text();
          console.error(`[Shippo Webhook] Failed to send email: ${emailError}`);
        }
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
