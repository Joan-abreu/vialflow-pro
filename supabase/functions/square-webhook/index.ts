import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const signatureKey = Deno.env.get("SQUARE_WEBHOOK_SIGNATURE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

serve(async (req) => {
    const signature = req.headers.get("x-square-hmacsha256-signature");

    if (!signature || !signatureKey) {
        console.error("Missing signature or signature key");
        return new Response("Webhook Error: Missing signature or secret", { status: 400 });
    }

    try {
        const body = await req.text();
        
        // --- Webhook Verification ---
        // Square signature verification requires the notification URL + raw body
        // Note: In Supabase Edge Functions, the URL might need adjustment depending on how it's called
        const url = req.url;
        const encoder = new TextEncoder();
        const keyData = encoder.encode(signatureKey);
        const messageData = encoder.encode(url + body);

        const cryptoKey = await crypto.subtle.importKey(
            "raw",
            keyData,
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["verify"]
        );

        const signatureBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
        const isValid = await crypto.subtle.verify(
            "HMAC",
            cryptoKey,
            signatureBytes,
            messageData
        );

        if (!isValid) {
            console.error("Invalid signature");
            // During development/debugging, you might want to log more info, 
            // but for security we just return 400.
            return new Response("Invalid signature", { status: 400 });
        }

        const event = JSON.parse(body);
        console.log(`Received Square event: ${event.type}`);

        // Handle the event
        if (event.type === "payment.updated" || event.type === "payment.created") {
            const payment = event.data.object.payment;
            const orderId = payment.reference_id;
            const status = payment.status;

            if (orderId && status === "COMPLETED") {
                console.log(`Payment COMPLETED for order: ${orderId}`);

                // Update order status to 'processing'
                const { error: updateError } = await supabase
                    .from("orders")
                    .update({ status: "processing" })
                    .eq("id", orderId);

                if (updateError) {
                    console.error(`Error updating order status: ${updateError.message}`);
                } else {
                    console.log(`Order ${orderId} updated to processing`);

                    // Trigger Unified Notification Engine
                    const sendNotification = async (type: "order_confirmation" | "admin_order_notification") => {
                        try {
                            const response = await fetch(`${supabaseUrl}/functions/v1/send-system-notification`, {
                                method: "POST",
                                headers: {
                                    "Authorization": `Bearer ${supabaseServiceRoleKey}`,
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                    type: type,
                                    data: {
                                        order_id: orderId,
                                    },
                                    related_id: orderId
                                }),
                            });

                            if (!response.ok) {
                                const errorText = await response.text();
                                console.error(`Notification Error (${type}): HTTP ${response.status} - ${errorText}`);
                            } else {
                                console.log(`Notification triggered: ${type} for order ${orderId}`);
                            }
                        } catch (err) {
                            console.error(`Fetch error triggering notification (${type}):`, err);
                        }
                    };

                    // Send notifications in parallel
                    await Promise.all([
                        sendNotification("order_confirmation"),
                        sendNotification("admin_order_notification")
                    ]);
                }
            } else {
                console.log(`Payment event for order ${orderId} has status ${status}. No action taken.`);
            }
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        });

    } catch (err) {
        console.error(`Webhook Error processing: ${err.message}`);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }
});
