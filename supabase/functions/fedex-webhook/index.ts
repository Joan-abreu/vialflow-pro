import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FEDEX_WEBHOOK_SECRET = Deno.env.get("FEDEX_WEBHOOK_SECRET");

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

serve(async (req) => {
    // 1. Verify Request Method
    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    // 2. Verify Secret (Optional but recommended)
    // FedEx allows setting a custom header or key. We'll verify if configured.
    if (FEDEX_WEBHOOK_SECRET) {
        const authHeader = req.headers.get("Authorization");
        const secretHeader = req.headers.get("X-FedEx-Secret"); // Custom header example

        // Check if either matches (flexible implementation)
        const matches = (authHeader === `Bearer ${FEDEX_WEBHOOK_SECRET}`) || (secretHeader === FEDEX_WEBHOOK_SECRET);

        if (!matches) {
            console.error("Unauthorized FedEx Webhook Access Attempt");
            return new Response("Unauthorized", { status: 401 });
        }
    }

    try {
        const body = await req.json();
        console.log("FedEx Webhook Payload:", JSON.stringify(body));

        // 3. Parse FedEx Event
        // FedEx Track Notification payload structure varies, but typically includes 'TrackNotification'
        // We'll handle standard JSON notifications.

        const notifications = body.TrackNotification || body.notifications || [];

        if (!Array.isArray(notifications)) {
            // It might be a single object or different format
            console.log("No notifications array found, checking root object");
            // Fallback logic if needed, or just return success to acknowledge
        }

        const eventsToProcess = Array.isArray(notifications) ? notifications : [body];

        for (const event of eventsToProcess) {
            const trackingNumber = event.trackingNumber || event.TrackingNumber;
            const notificationType = event.notificationType || event.NotificationType;
            const statusDetail = event.statusDetail || event.StatusDetail;

            // Map FedEx Status Code to our internal status
            // Code examples: 'PU' (Picked Up), 'DL' (Delivered), 'IT' (In Transit), 'OD' (Out for Delivery)
            const statusCode = statusDetail?.code || statusDetail?.Code;
            const statusDescription = statusDetail?.description || statusDetail?.Description;

            if (!trackingNumber) {
                console.warn("Event missing tracking number", event);
                continue;
            }

            console.log(`Processing event for ${trackingNumber}: ${statusCode} - ${statusDescription}`);

            let newStatus = null;
            let emailType = null;

            // STATUS MAPPING LOGIC
            // 'PU' (Picked Up) -> Shipped (or custom 'processing' -> 'shipped')
            // 'OC' (Order Created) -> Label Created (usually we do this manually, but good to know)
            // 'DL' (Delivered) -> Delivered
            // 'OD' (Out for Delivery) -> Maybe notify?
            // 'IT' (In Transit) -> Info only

            if (['PU', 'PX', 'SF', 'DP'].includes(statusCode)) {
                // Picked Up, Picked up (Express), Departed FedEx location, Departed
                newStatus = "shipped";
                emailType = "status_update";
            } else if (['DL'].includes(statusCode)) {
                // Delivered
                newStatus = "delivered";
                emailType = "status_update";
            } else if (['SE', 'DE', 'CA'].includes(statusCode)) {
                // Shipment Exception, Delivery Exception, Cancelled
                // Maybe we want to handle exceptions? For now, we ignore or log.
                console.warn(`Shipment exception for ${trackingNumber}: ${statusDescription}`);
            }

            if (newStatus) {
                // 4. Update Order in Database
                // We need to find the order by tracking number.
                const { data: orders, error: searchError } = await supabase
                    .from("orders")
                    .select("id, status, user_id, customer_email")
                    .eq("tracking_number", trackingNumber); // Assuming one order per tracking number for now

                if (searchError) {
                    console.error("Error searching order:", searchError);
                    continue;
                }

                if (!orders || orders.length === 0) {
                    console.warn(`No order found for tracking number: ${trackingNumber}`);
                    continue;
                }

                const order = orders[0];

                // Prevent redundant updates (e.g., repeating 'shipped')
                if (order.status === newStatus) {
                    console.log(`Order ${order.id} is already ${newStatus}, skipping update.`);
                    continue;
                }

                // Update Status
                const { error: updateError } = await supabase
                    .from("orders")
                    .update({
                        status: newStatus,
                        // Optionally record status history here if we had a table
                    })
                    .eq("id", order.id);

                if (updateError) {
                    console.error(`Failed to update order ${order.id}:`, updateError);
                    continue;
                }

                console.log(`Order ${order.id} updated to ${newStatus}`);

                // 5. Send Email Notification
                if (emailType) {
                    await fetch(`${supabaseUrl}/functions/v1/send-order-email`, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${supabaseServiceRoleKey}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            order_id: order.id,
                            type: emailType,
                        }),
                    });
                    console.log(`Emal notification triggered for ${order.id}`);
                }
            }
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        });

    } catch (err: any) {
        console.error("Webhook Handler Error:", err);
        return new Response(`Error: ${err.message}`, { status: 500 });
    }
});
