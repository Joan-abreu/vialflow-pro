import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const squareSignatureKey = Deno.env.get("SQUARE_WEBHOOK_SIGNATURE_KEY") || "";
const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const authNetSignatureKey = Deno.env.get("AUTHORIZENET_SIGNATURE_KEY") || "";
const cloverWebhookSecret = Deno.env.get("CLOVER_WEBHOOK_SECRET") || "";
const nmiSecurityKey = Deno.env.get("NMI_SECURITY_KEY") || "";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature, x-square-hmacsha256-signature, x-anet-signature",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Helper: send order notification emails via unified notification engine
const sendOrderNotifications = async (orderId: string) => {
    const sendNotification = async (type: "order_confirmation" | "admin_order_notification") => {
        try {
            await fetch(`${supabaseUrl}/functions/v1/send-system-notification`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${supabaseServiceRoleKey}`,
                    "apikey": supabaseServiceRoleKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    type: type,
                    data: { order_id: orderId },
                    related_id: orderId
                }),
            });
        } catch (err) {
            console.error(`Error sending ${type} notification:`, err);
        }
    };

    await Promise.allSettled([
        sendNotification("order_confirmation"),
        sendNotification("admin_order_notification")
    ]);
};

// Helper: mark order as processing if not already processed
const markOrderAsPaid = async (orderId: string, providerName: string, transactionId?: string) => {
    const { data: order } = await supabase
        .from("orders")
        .select("id, status, applied_coupons")
        .eq("id", orderId)
        .single();

    if (!order) {
        console.warn(`[Webhook] Order ${orderId} not found in database.`);
        return;
    }

    if (order.status === "processing" || order.status === "shipped" || order.status === "delivered") {
        console.log(`[Webhook] Order ${orderId} already in status ${order.status}. No status change needed.`);
        return;
    }

    const updates: any = {
        status: "processing",
        payment_method: providerName,
    };
    if (transactionId) updates.payment_intent_id = transactionId;

    await supabase.from("orders").update(updates).eq("id", orderId);
    console.log(`[Webhook] Order ${orderId} marked as 'processing' via ${providerName}`);

    // Coupons & referral counters
    if (order.applied_coupons && Array.isArray(order.applied_coupons)) {
        for (const code of order.applied_coupons) {
            const trimmed = code.trim().toUpperCase();
            await supabase.rpc('increment_coupon_usage', { coupon_code: trimmed });
            const { data: profile } = await supabase.from('profiles').select('user_id').eq('referral_code', trimmed).single();
            if (profile) {
                await supabase.rpc('increment_referral_count', { referrer_user_id: profile.user_id });
            }
        }
    }

    await sendOrderNotifications(orderId);
};

// Helper: mark order as refunded
const markOrderAsRefunded = async (orderId: string, providerName: string) => {
    await supabase.from("orders").update({ status: "refunded" }).eq("id", orderId);
    console.log(`[Webhook] Order ${orderId} marked as 'refunded' via ${providerName}`);
};

// Helper: mark order as disputed / chargeback
const markOrderAsDisputed = async (orderId: string, providerName: string) => {
    await supabase.from("orders").update({ status: "disputed" }).eq("id", orderId);
    console.warn(`[Webhook Alert] Order ${orderId} marked as 'disputed' via ${providerName}`);
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const queryProvider = url.searchParams.get("provider");
        const bodyText = await req.text();

        // -------------------------------------------------------------
        // 1. Stripe Webhook Handler
        // -------------------------------------------------------------
        const stripeSig = req.headers.get("stripe-signature");
        if (stripeSig || queryProvider === "stripe") {
            const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
                apiVersion: "2023-10-16",
            });

            let event = JSON.parse(bodyText);
            if (stripeWebhookSecret && stripeSig) {
                try {
                    event = await stripe.webhooks.constructEventAsync(bodyText, stripeSig, stripeWebhookSecret);
                } catch (e: any) {
                    console.warn("Stripe signature verification failed:", e.message);
                }
            }

            if (event.type === "payment_intent.succeeded") {
                const pi = event.data.object;
                const orderId = pi.metadata?.orderId || pi.metadata?.order_id;
                if (orderId) await markOrderAsPaid(orderId, "stripe", pi.id);
            } else if (event.type === "charge.refunded") {
                const charge = event.data.object;
                const orderId = charge.metadata?.orderId || charge.metadata?.order_id;
                if (orderId) await markOrderAsRefunded(orderId, "stripe");
            } else if (event.type === "charge.dispute.created") {
                const dispute = event.data.object;
                const orderId = dispute.metadata?.orderId;
                if (orderId) await markOrderAsDisputed(orderId, "stripe");
            }

            return new Response(JSON.stringify({ received: true, provider: "stripe" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // -------------------------------------------------------------
        // 2. Square Webhook Handler
        // -------------------------------------------------------------
        const squareSig = req.headers.get("x-square-hmacsha256-signature");
        if (squareSig || queryProvider === "square") {
            const event = JSON.parse(bodyText);
            const eventType = event?.type;

            if (eventType === "payment.updated" || eventType === "payment.created") {
                const payment = event.data?.object?.payment;
                const orderId = payment?.reference_id || payment?.note?.replace("Order ID: ", "");
                if (orderId && (payment?.status === "COMPLETED" || payment?.status === "APPROVED")) {
                    await markOrderAsPaid(orderId, "square", payment.id);
                }
            } else if (eventType === "refund.updated" || eventType === "refund.created") {
                const refund = event.data?.object?.refund;
                const paymentId = refund?.payment_id;
                if (paymentId) {
                    const { data: order } = await supabase.from("orders").select("id").eq("payment_intent_id", paymentId).single();
                    if (order) await markOrderAsRefunded(order.id, "square");
                }
            }

            return new Response(JSON.stringify({ received: true, provider: "square" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // -------------------------------------------------------------
        // 3. Authorize.Net Webhook Handler
        // -------------------------------------------------------------
        const anetSig = req.headers.get("x-anet-signature");
        if (anetSig || queryProvider === "authorizenet") {
            const payload = JSON.parse(bodyText);
            const eventType = payload?.eventType;
            const txId = payload?.payload?.id;
            const invoiceNumber = payload?.payload?.invoiceNumber;

            if (eventType === "net.authorize.payment.authcapture.created" || eventType === "net.authorize.payment.capture.created") {
                const orderId = invoiceNumber || payload?.payload?.refId;
                if (orderId) {
                    await markOrderAsPaid(orderId, "authorizenet", txId);
                } else if (txId) {
                    const { data: order } = await supabase.from("orders").select("id").eq("payment_intent_id", txId).single();
                    if (order) await markOrderAsPaid(order.id, "authorizenet", txId);
                }
            } else if (eventType === "net.authorize.payment.refund.created") {
                if (invoiceNumber) await markOrderAsRefunded(invoiceNumber, "authorizenet");
            }

            return new Response(JSON.stringify({ received: true, provider: "authorizenet" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // -------------------------------------------------------------
        // 4. NMI Webhook Handler
        // -------------------------------------------------------------
        if (queryProvider === "nmi" || req.headers.get("x-nmi-webhook")) {
            let nmiData: any = {};
            try {
                nmiData = JSON.parse(bodyText);
            } catch (e) {
                // Parse URL Encoded if direct post
                const params = new URLSearchParams(bodyText);
                nmiData = Object.fromEntries(params.entries());
            }

            const orderId = nmiData.orderid || nmiData.order_id;
            const transactionId = nmiData.transactionid || nmiData.transaction_id;
            const responseCode = nmiData.response || nmiData.action_type;

            if (orderId && (responseCode === "1" || responseCode === "sale" || responseCode === "capture")) {
                await markOrderAsPaid(orderId, "nmi", transactionId);
            } else if (orderId && (responseCode === "refund" || responseCode === "void")) {
                await markOrderAsRefunded(orderId, "nmi");
            }

            return new Response(JSON.stringify({ received: true, provider: "nmi" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // -------------------------------------------------------------
        // 5. Clover Webhook Handler
        // -------------------------------------------------------------
        if (queryProvider === "clover" || req.headers.get("x-clover-auth")) {
            const cloverData = JSON.parse(bodyText);
            const merchants = cloverData?.merchants;

            if (merchants) {
                for (const mId in merchants) {
                    const events = merchants[mId];
                    if (Array.isArray(events)) {
                        for (const ev of events) {
                            if (ev.objectId && (ev.type === "CREATE" || ev.type === "UPDATE")) {
                                const { data: order } = await supabase.from("orders").select("id").eq("payment_intent_id", ev.objectId).single();
                                if (order) await markOrderAsPaid(order.id, "clover", ev.objectId);
                            }
                        }
                    }
                }
            }

            return new Response(JSON.stringify({ received: true, provider: "clover" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // -------------------------------------------------------------
        // 6. PayPal Webhook Handler
        // -------------------------------------------------------------
        if (queryProvider === "paypal" || req.headers.get("paypal-transmission-id")) {
            const ppData = JSON.parse(bodyText);
            const eventType = ppData?.event_type;
            const resource = ppData?.resource;

            if (eventType === "PAYMENT.CAPTURE.COMPLETED" || eventType === "CHECKOUT.ORDER.APPROVED") {
                const orderId = resource?.custom_id || resource?.invoice_id;
                const txId = resource?.id;
                if (orderId) {
                    await markOrderAsPaid(orderId, "paypal", txId);
                }
            } else if (eventType === "PAYMENT.CAPTURE.REFUNDED") {
                const orderId = resource?.custom_id || resource?.invoice_id;
                if (orderId) await markOrderAsRefunded(orderId, "paypal");
            }

            return new Response(JSON.stringify({ received: true, provider: "paypal" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // Fallback generic response
        return new Response(JSON.stringify({ received: true, message: "Webhook acknowledged" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error: any) {
        console.error("Universal Webhook Error:", error);
        return new Response(JSON.stringify({ error: error.message || "Webhook processing failed" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
