import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Client, Environment } from "https://esm.sh/square@38.1.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Get the access token from edge function environment
const squareAccessToken = Deno.env.get("SQUARE_ACCESS_TOKEN") || "";
serve(async (req) => {
    // Handle CORS
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { sourceId, amount, currency = "USD", orderId, customerEmail, locationId, isProduction, items, shippingAddress, shippingCost, tax, applied_coupons, discounts } = await req.json();


        // 1. Skip Square if amount is 0 (Free Order)
        if (amount <= 0) {
            // Update order status to 'processing'
            await supabase.from("orders").update({ status: "processing", applied_coupons }).eq("id", orderId);

            // Handle Referral and Coupon Usage Tracking (Only on success)
            if (applied_coupons && Array.isArray(applied_coupons)) {
                for (const code of applied_coupons) {
                    const trimmedCode = code.trim().toUpperCase();
                    await supabase.rpc('increment_coupon_usage', { coupon_code: trimmedCode });
                    const { data: profile } = await supabase.from('profiles').select('user_id').eq('referral_code', trimmedCode).single();
                    if (profile) {
                        await supabase.rpc('increment_referral_count', { referrer_user_id: profile.user_id });
                    }
                }
            }

            // Send Email Notifications
            const sendEmail = async (type: string) => {
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
            };

            await Promise.allSettled([
                sendEmail("order_confirmation"),
                sendEmail("admin_order_notification")
            ]);

            return new Response(JSON.stringify({
                success: true,
                status: "COMPLETED",
                message: "Free order processed successfully"
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // Dynamically instantiate the Square Client based on the frontend's environment explicit request
        const squareEnvironment = isProduction ? Environment.Production : Environment.Sandbox;
        const square = new Client({
            accessToken: squareAccessToken,
            environment: squareEnvironment,
        });

        if (!sourceId || !amount) {
            throw new Error("Missing sourceId or amount");
        }

        if (!squareAccessToken) {
            throw new Error("Missing Square Access Token in environment");
        }

        // Generate a unique idempotency key
        const idempotencyKey = crypto.randomUUID();

        // Convert decimal amount to smallest denomination (e.g., cents)
        const amountInCents = Math.round(parseFloat(amount.toString()) * 100);

        let squareOrderId = undefined;

        // 1. Create a Square Order if items are provided
        if (items && items.length > 0 && locationId) {
            try {
                const orderResponse = await square.ordersApi.createOrder({
                    order: {
                        locationId: locationId,
                        referenceId: orderId,
                        lineItems: items.map((item: any) => ({
                            name: item.name,
                            quantity: item.quantity.toString(),
                            basePriceMoney: {
                                amount: BigInt(Math.round(Number(item.basePriceMoney.amount))),
                                currency: item.basePriceMoney.currency
                            }
                        })),
                        // Square uses 'service_charges' for things like shipping
                        serviceCharges: shippingCost > 0 ? [{
                            name: "Shipping",
                            amountMoney: {
                                amount: BigInt(Math.round(Number(shippingCost) * 100)),
                                currency: currency
                            },
                            calculationPhase: "TOTAL_PHASE"
                        }] : undefined,
                        // Square uses 'taxes' for sales tax
                        taxes: tax > 0 ? [{
                            name: "Tax",
                            type: "ADDITIVE",
                            appliedMoney: {
                                amount: BigInt(Math.round(Number(tax) * 100)),
                                currency: currency
                            },
                            scope: "ORDER"
                        }] : undefined,
                        // Square uses 'discounts' for coupons
                        discounts: (discounts && discounts.length > 0) ? discounts.filter((d: any) => d.amount > 0).map((d: any) => ({
                            name: `Discount: ${d.code}`,
                            amountMoney: {
                                amount: BigInt(Math.round(Number(d.amount) * 100)),
                                currency: currency
                            },
                            scope: "ORDER"
                        })) : undefined,
                    }
                });
                squareOrderId = orderResponse.result.order?.id;
                console.log(`Created Square Order: ${squareOrderId}`);
            } catch (orderError: any) {
                console.error("Error creating Square Order:", orderError);
                // We continue even if order creation fails, to at least process the payment
            }
        }

        // 2. Process the payment
        const paymentResponse = await square.paymentsApi.createPayment({
            sourceId: sourceId,
            idempotencyKey: idempotencyKey,
            amountMoney: {
                amount: BigInt(amountInCents),
                currency: currency,
            },
            orderId: squareOrderId,
            locationId: locationId,
            referenceId: orderId,
            buyerEmailAddress: customerEmail,
            note: `Order ID: ${orderId}`,
            shippingAddress: shippingAddress,
        });

        // The response contains the payment details
        const payment = paymentResponse.result.payment;

        if (payment?.status === "COMPLETED" || payment?.status === "APPROVED") {
             // Update order status to 'processing' and save coupons used
             await supabase.from("orders").update({ 
                status: "processing",
                applied_coupons: applied_coupons || []
             }).eq("id", orderId);

             // Handle Referral and Coupon Usage Tracking (Only on success)
             if (applied_coupons && Array.isArray(applied_coupons)) {
                for (const code of applied_coupons) {
                    const trimmedCode = code.trim().toUpperCase();
                    await supabase.rpc('increment_coupon_usage', { coupon_code: trimmedCode });
                    const { data: profile } = await supabase.from('profiles').select('user_id').eq('referral_code', trimmedCode).single();
                    if (profile) {
                        await supabase.rpc('increment_referral_count', { referrer_user_id: profile.user_id });
                    }
                }
             }

             // Send Email Notifications
             const sendEmail = async (type: string) => {
                 const response = await fetch(`${supabaseUrl}/functions/v1/send-system-notification`, {
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
                 if (!response.ok) {
                     console.error(`Error triggering ${type}:`, await response.text());
                 }
             };

             // Wait for emails to be sent so the Deno context is not destroyed prematurely
             await Promise.allSettled([
                 sendEmail("order_confirmation"),
                 sendEmail("admin_order_notification")
             ]);

             return new Response(JSON.stringify({
                success: true,
                paymentId: payment.id,
                status: payment.status
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        } else {
             return new Response(JSON.stringify({
                success: false,
                error: `Payment failed with status: ${payment?.status}`
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

    } catch (error: any) {
        console.error("Square Payment Error:", error);
        
        let errorMessage = error.message;
        
        // If it's an API error from Square SDK
        if (error.errors && error.errors.length > 0) {
            errorMessage = error.errors[0].detail || error.errors[0].code;
        }

        return new Response(JSON.stringify({ 
            success: false, 
            error: errorMessage || "Payment processing failed" 
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    }
});
