import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import crypto from "node:crypto";
import { Buffer } from "node:buffer";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const squareSignatureKey = Deno.env.get("SQUARE_WEBHOOK_SIGNATURE_KEY") || "";
const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const authNetSignatureKey = Deno.env.get("AUTHORIZENET_SIGNATURE_KEY") || "";
const cloverWebhookSecret = Deno.env.get("CLOVER_WEBHOOK_SECRET") || "";
const nmiSecurityKey = Deno.env.get("NMI_SECURITY_KEY") || "";
const veyraWebhookSecretEnv = Deno.env.get("VEYRA_WEBHOOK_SECRET") || "";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature, x-square-hmacsha256-signature, x-anet-signature, veyragate-signature",
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
        payment_provider: providerName,
        payment_status: "paid",
    };
    if (transactionId) updates.payment_intent_id = transactionId;

    await supabase.from("orders").update(updates).eq("id", orderId);
    console.log(`[Webhook] Order ${orderId} marked as 'processing' via ${providerName}`);

    // Coupons, referral counters & affiliate commissions
    if (order.applied_coupons && Array.isArray(order.applied_coupons)) {
        for (const code of order.applied_coupons) {
            const trimmed = typeof code === 'string' ? code.trim().toUpperCase() : (code?.code || '').trim().toUpperCase();
            if (trimmed) {
                await supabase.rpc('increment_coupon_usage', { coupon_code: trimmed });
                const { data: profile } = await supabase.from('profiles').select('user_id').eq('referral_code', trimmed).single();
                if (profile) {
                    await supabase.rpc('increment_referral_count', { referrer_user_id: profile.user_id });
                }
            }
        }
    }

    // Process affiliate commission for this order
    try {
        await supabase.rpc('process_order_affiliate_commission', { p_order_id: orderId });
    } catch (affErr) {
        console.warn(`[Affiliate Commission] Error processing affiliate commission for order ${orderId}:`, affErr);
    }

    await sendOrderNotifications(orderId);
};

// Helper: mark order as refunded
const markOrderAsRefunded = async (orderId: string, providerName: string) => {
    await supabase.from("orders").update({ status: "refunded" }).eq("id", orderId);
    console.log(`[Webhook] Order ${orderId} marked as 'refunded' via ${providerName}`);
    try {
        await supabase.rpc('process_order_affiliate_commission', { p_order_id: orderId });
    } catch (e) {
        console.warn(`[Affiliate Commission] Error updating refunded status for order ${orderId}:`, e);
    }
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

        // -------------------------------------------------------------
        // 7. TagadaPay / KashuPay Webhook Handler (Official Spec)
        // -------------------------------------------------------------
        const tagadaSig = req.headers.get("tagadapay-signature") || req.headers.get("x-tagada-signature");
        if (queryProvider === "tagadapay" || queryProvider === "kashupay" || tagadaSig || req.headers.get("x-tagadapay-webhook")) {
            const event = JSON.parse(bodyText);
            const eventType = event?.type || event?.event;
            const eventId = event?.id;
            const dataObj = event?.data?.object || event?.data?.payment || event?.data?.order || event?.data;

            console.log(`[Kashu/Tagada Webhook] Processing event: ${eventType} (ID: ${eventId || "N/A"})`);
            console.log(`[Kashu/Tagada Webhook] Full Payload:`, bodyText);

            // Extract order identification from all potential payload structures
            const orderId = 
                event?.data?.order?.metadata?.orderId ||
                event?.data?.order?.metadata?.order_id ||
                event?.data?.order?.referenceId ||
                event?.data?.payment?.metadata?.orderId ||
                event?.data?.payment?.metadata?.order_id ||
                event?.data?.payment?.referenceId ||
                dataObj?.metadata?.orderId || 
                dataObj?.metadata?.order_id || 
                dataObj?.referenceId || 
                dataObj?.orderId ||
                dataObj?.externalRef ||
                event?.metadata?.orderId ||
                event?.orderId ||
                event?.referenceId;

            const paymentId = 
                event?.data?.payment?.id ||
                dataObj?.id || 
                dataObj?.paymentId || 
                dataObj?.payment_intent || 
                eventId;

            const statusLower = String(dataObj?.status || event?.data?.order?.status || event?.data?.payment?.status || "").toLowerCase();

            const isPaymentSuccess = 
                eventType === "order/paid" ||
                eventType === "order.paid" ||
                eventType === "payment/succeeded" ||
                eventType === "payment.succeeded" ||
                eventType === "payment_intent.succeeded" ||
                eventType === "charge.succeeded" ||
                (eventType === "payment.updated" && (statusLower === "succeeded" || statusLower === "completed" || statusLower === "paid" || statusLower === "approved")) ||
                (eventType === "payment.created" && (statusLower === "succeeded" || statusLower === "paid")) ||
                (eventType === "order/updated" && (statusLower === "paid" || statusLower === "completed")) ||
                statusLower === "succeeded" ||
                statusLower === "paid" ||
                dataObj?.latest_charge?.status === "succeeded" ||
                dataObj?.latest_charge?.paid === true;

            const customerEmail = dataObj?.customer?.email || event?.data?.customer?.email || event?.customer?.email;

            if (isPaymentSuccess) {
                if (orderId) {
                    await markOrderAsPaid(orderId, "tagadapay", paymentId);
                } else if (paymentId) {
                    const { data: order } = await supabase.from("orders").select("id").eq("payment_intent_id", paymentId).maybeSingle();
                    if (order) {
                        await markOrderAsPaid(order.id, "tagadapay", paymentId);
                    } else if (customerEmail) {
                        const { data: pendingOrder } = await supabase
                            .from("orders")
                            .select("id")
                            .eq("status", "pending_payment")
                            .ilike("customer_email", customerEmail.trim())
                            .order("created_at", { ascending: false })
                            .limit(1)
                            .maybeSingle();

                        if (pendingOrder) {
                            console.log(`[Tagada Webhook] Matched pending order ${pendingOrder.id} for email ${customerEmail}`);
                            await markOrderAsPaid(pendingOrder.id, "tagadapay", paymentId);
                        }
                    }
                }
            } else if (eventType === "charge.refunded" || eventType === "payment.refunded" || eventType === "order/refunded" || eventType === "charge/refunded") {
                if (orderId) {
                    await markOrderAsRefunded(orderId, "tagadapay");
                } else if (paymentId) {
                    const { data: order } = await supabase.from("orders").select("id").eq("payment_intent_id", paymentId).maybeSingle();
                    if (order) await markOrderAsRefunded(order.id, "tagadapay");
                }
            } else if (eventType === "charge.dispute.created" || eventType === "payment.disputed" || eventType === "dispute.created" || eventType === "charge/disputed") {
                if (orderId) {
                    await markOrderAsDisputed(orderId, "tagadapay");
                } else if (paymentId) {
                    const { data: order } = await supabase.from("orders").select("id").eq("payment_intent_id", paymentId).maybeSingle();
                    if (order) await markOrderAsDisputed(order.id, "tagadapay");
                }
            }

            // Immediately ACK with 2xx to satisfy the 10s SLA and prevent retries
            return new Response(JSON.stringify({ 
                received: true, 
                provider: "tagadapay", 
                eventId: eventId,
                status: "acknowledged" 
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // -------------------------------------------------------------
        // 8. Veyra Webhook Handler (Official Spec)
        // -------------------------------------------------------------
        const veyraSig = req.headers.get("veyragate-signature") || req.headers.get("Veyragate-Signature");
        if (queryProvider === "veyra" || veyraSig) {
            let veyraWebhookSecret = veyraWebhookSecretEnv;
            if (!veyraWebhookSecret) {
                const { data: sData } = await supabase.from("app_settings").select("value").eq("key", "payment_veyra_config").maybeSingle();
                if (sData?.value) {
                    try {
                        const parsed = JSON.parse(sData.value);
                        veyraWebhookSecret = parsed.webhookSecret || "";
                    } catch (_) {}
                }
            }

            // Verify HMAC-SHA256 signature if secret and signature header are present
            if (veyraSig && veyraWebhookSecret) {
                try {
                    const parts = Object.fromEntries(veyraSig.split(",").map((p: string) => p.split("=")));
                    const t = Number(parts.t);
                    if (!t || Math.abs(Date.now() / 1000 - t) > 300) {
                        console.warn("[Veyra Webhook] Timestamp expired or missing:", t);
                        return new Response(JSON.stringify({ error: "Timestamp expired" }), { status: 400, headers: corsHeaders });
                    }
                    const expected = crypto.createHmac("sha256", veyraWebhookSecret)
                        .update(`${t}.${bodyText}`).digest("hex");
                    const a = Buffer.from(expected);
                    const b = Buffer.from(parts.v1 || "");
                    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
                        console.warn("[Veyra Webhook] Invalid signature verification.");
                        return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: corsHeaders });
                    }
                } catch (sigErr) {
                    console.warn("[Veyra Webhook] Error during signature verification:", sigErr);
                }
            }

            const event = JSON.parse(bodyText);
            const eventType = String(event?.type || event?.event || "").toLowerCase();
            const eventId = event?.id || event?.event_id;
            const dataObj = event?.data?.object || event?.data || event;

            console.log(`[Veyra Webhook] Processing event: ${eventType} (ID: ${eventId || "N/A"})`);
            console.log(`[Veyra Webhook] Payload:`, bodyText);

            const orderId = 
                dataObj?.metadata?.order_id ||
                dataObj?.metadata?.orderId ||
                event?.metadata?.order_id ||
                event?.metadata?.orderId ||
                dataObj?.order_id ||
                dataObj?.orderId;

            const txId = dataObj?.transaction_id || event?.transaction_id;
            const sessId = dataObj?.session_id || event?.session_id;
            const paymentId = txId || sessId || eventId;

            // Robust multi-key lookup to guarantee order identification
            const findOrder = async () => {
                if (orderId) {
                    const { data: byId } = await supabase.from("orders").select("id").eq("id", orderId).maybeSingle();
                    if (byId) return byId;
                }
                if (txId) {
                    const { data: byTx } = await supabase.from("orders").select("id").eq("payment_intent_id", txId).maybeSingle();
                    if (byTx) return byTx;
                }
                if (sessId) {
                    const { data: bySess } = await supabase.from("orders").select("id").eq("payment_intent_id", sessId).maybeSingle();
                    if (bySess) return bySess;
                }
                if (paymentId) {
                    const { data: byPayment } = await supabase.from("orders").select("id").eq("payment_intent_id", paymentId).maybeSingle();
                    if (byPayment) return byPayment;
                }
                return null;
            };

            if (eventType === "charge.succeeded" || eventType === "payment.succeeded" || eventType === "checkout.session.completed") {
                const targetOrder = await findOrder();
                if (targetOrder) {
                    await markOrderAsPaid(targetOrder.id, "veyra", paymentId);
                } else {
                    console.warn(`[Veyra Webhook] Could not match order for event ${eventId}. OrderId: ${orderId}, TxId: ${txId}, SessId: ${sessId}`);
                }
            } else if (eventType === "charge.refunded" || eventType === "payment.refunded") {
                const targetOrder = await findOrder();
                if (targetOrder) {
                    await markOrderAsRefunded(targetOrder.id, "veyra");
                }
            } else if (eventType === "dispute.created" || eventType === "charge.dispute.created") {
                const targetOrder = await findOrder();
                if (targetOrder) {
                    await markOrderAsDisputed(targetOrder.id, "veyra");
                }
            } else if (eventType === "charge.failed") {
                console.warn(`[Veyra Webhook] Charge failed for order ${orderId || 'N/A'}:`, dataObj?.message || dataObj?.failure_message);
            }

            return new Response(JSON.stringify({ 
                received: true, 
                provider: "veyra", 
                eventId: eventId,
                status: "acknowledged" 
            }), {
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
