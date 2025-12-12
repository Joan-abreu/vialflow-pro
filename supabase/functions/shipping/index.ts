import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Import carrier-specific modules
import { UPSCarrier } from "./carriers/ups.ts";
import { FedExCarrier } from "./carriers/fedex.ts";

// Carrier interface that all carriers must implement
interface ICarrier {
    getRates(shipment: any): Promise<any>;
    createShipment(shipment: any): Promise<any>;
    schedulePickup(pickup: any): Promise<any>;
    trackShipment(trackingNumber: string): Promise<any>;
    cancelShipment(trackingNumber: string): Promise<any>;
    cancelPickup(confirmationNumber: string, scheduledDate?: string, serviceCode?: string): Promise<any>;
}

// Carrier factory
function getCarrier(carrierName: string, settings: any): ICarrier {
    switch (carrierName.toUpperCase()) {
        case "UPS":
            return new UPSCarrier(settings);
        case "FEDEX":
            return new FedExCarrier(settings);
        // Add more carriers here
        // case "USPS":
        //   return new USPSCarrier(settings);
        default:
            throw new Error(`Unsupported carrier: ${carrierName}`);
    }
}

const handler = async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
        const { carrier, action, data } = await req.json();

        if (!carrier) {
            throw new Error("Carrier is required");
        }

        // Fetch carrier settings from database
        const { data: carrierSettings, error: settingsError } = await supabase
            .from("carrier_settings")
            .select("*")
            .eq("carrier", carrier.toUpperCase())
            .eq("is_active", true)
            .single();

        if (settingsError || !carrierSettings) {
            throw new Error(`Carrier ${carrier} is not configured or not active`);
        }

        // Get carrier instance
        const carrierInstance = getCarrier(carrier, carrierSettings);

        let result;

        switch (action) {
            case "get_rates":
                result = await carrierInstance.getRates(data);
                break;

            case "create_shipment": {
                result = await carrierInstance.createShipment(data);

                // Save shipment to database
                if (result.success) {
                    const { data: savedShipment, error: insertError } = await supabase
                        .from("order_shipments")
                        .insert({
                            order_id: data.orderId,
                            carrier: carrier.toUpperCase(),
                            carrier_account_id: carrierSettings.account_number,
                            service_code: data.serviceCode || carrierSettings.default_service_code,
                            service_name: result.serviceName,
                            tracking_number: result.trackingNumber,
                            tracking_url: result.trackingUrl,
                            label_data: result.labelData,
                            label_format: result.labelFormat || "PDF",
                            label_url: result.labelUrl,
                            weight: data.packages?.[0]?.weight,
                            weight_unit: "LBS",
                            length: data.packages?.[0]?.length,
                            width: data.packages?.[0]?.width,
                            height: data.packages?.[0]?.height,
                            dimension_unit: "IN",
                            ship_from: carrierSettings.shipper_address,
                            ship_to: data.recipient,
                            shipping_cost: result.shippingCost,
                            total_cost: result.totalCost,
                            currency: "USD",
                            status: "label_created",
                            carrier_response: result.rawResponse,
                        })
                        .select()
                        .single();

                    if (insertError) {
                        console.error("Error saving shipment:", insertError);
                    } else {
                        // Update order with tracking number
                        const { error: orderUpdateError } = await supabase
                            .from("orders")
                            .update({
                                status: "shipped",
                                tracking_number: result.trackingNumber,
                            })
                            .eq("id", data.orderId);

                        if (orderUpdateError) {
                            console.error("Error updating order status:", orderUpdateError);
                        } else {
                            console.log(`Order ${data.orderId} updated to shipped`);
                        }

                        // Add shipmentId to result so it can be used for pickup scheduling
                        if (savedShipment) {
                            result.shipmentId = savedShipment.id;
                        }
                    }
                }
                break;
            }

            case "schedule_pickup":
                result = await carrierInstance.schedulePickup(data);

                // Update shipment with pickup info
                if (result.success && data.shipmentId) {
                    await supabase
                        .from("order_shipments")
                        .update({
                            pickup_confirmation: result.confirmationNumber,
                            pickup_date: data.date,
                            pickup_ready_time: data.readyTime,
                            pickup_close_time: data.closeTime,
                        })
                        .eq("id", data.shipmentId);
                }
                break;

            case "track_shipment":
                result = await carrierInstance.trackShipment(data.trackingNumber);

                // Update shipment status
                if (result.success && data.shipmentId) {
                    await supabase
                        .from("order_shipments")
                        .update({
                            status: result.status,
                            actual_delivery_date: result.deliveredAt,
                        })
                        .eq("id", data.shipmentId);
                }
                break;

            case "cancel_shipment": {
                // Fetch shipment to get tracking number
                const { data: shipmentToCancel, error: fetchError } = await supabase
                    .from("order_shipments")
                    .select("tracking_number, order_id")
                    .eq("id", data.shipmentId)
                    .single();

                if (fetchError || !shipmentToCancel) {
                    throw new Error("Shipment not found");
                }

                result = await carrierInstance.cancelShipment(shipmentToCancel.tracking_number);

                if (result.success) {
                    // Delete the shipment record entirely
                    await supabase
                        .from("order_shipments")
                        .delete()
                        .eq("id", data.shipmentId);

                    // Check if there are any other active shipments for this order
                    if (shipmentToCancel.order_id) {
                        const { count, error: countError } = await supabase
                            .from("order_shipments")
                            .select("*", { count: "exact", head: true })
                            .eq("order_id", shipmentToCancel.order_id);

                        if (!countError && count === 0) {
                            // No other shipments, revert order status
                            await supabase
                                .from("orders")
                                .update({
                                    status: "ready_to_ship",
                                    tracking_number: null
                                })
                                .eq("id", shipmentToCancel.order_id);

                            console.log(`Order ${shipmentToCancel.order_id} reverted to ready_to_ship`);
                        }
                    }
                }
                break;
            }

            case "cancel_pickup": {
                // Fetch shipment to get details for cancellation (like service code)
                const { data: shipment, error: fetchError } = await supabase
                    .from("order_shipments")
                    .select("service_code")
                    .eq("id", data.shipmentId)
                    .single();

                if (fetchError) {
                    // Fallback if shipment not found (shouldn't happen usually)
                    console.warn("Could not fetch shipment for pickup cancellation:", fetchError);
                }

                result = await carrierInstance.cancelPickup(data.confirmationNumber, data.date, shipment?.service_code);

                // Clear pickup info
                if (result.success && data.shipmentId) {
                    await supabase
                        .from("order_shipments")
                        .update({
                            pickup_confirmation: null,
                            pickup_date: null,
                            pickup_ready_time: null,
                            pickup_close_time: null,
                        })
                        .eq("id", data.shipmentId);
                }
                break;
            }

            default:
                throw new Error(`Unknown action: ${action}`);
        }

        return new Response(JSON.stringify({ success: true, data: result }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error: any) {
        console.error("Shipping API Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
};

serve(handler);
