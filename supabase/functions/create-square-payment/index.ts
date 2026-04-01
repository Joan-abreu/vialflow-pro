import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Client, Environment } from "https://esm.sh/square@38.1.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Initialize Square Client
// Use VITE_SQUARE_APP_ID environment to determine sandbox vs production.
// Usually, we just use SQUARE_ACCESS_TOKEN and SQUARE_ENVIRONMENT secrets.
const squareAccessToken = Deno.env.get("SQUARE_ACCESS_TOKEN") || "";
const isProduction = Deno.env.get("VITE_SQUARE_APP_ID")?.startsWith("sq0idp") || false;
const squareEnvironment = isProduction ? Environment.Production : Environment.Sandbox;

const square = new Client({
    accessToken: squareAccessToken,
    environment: squareEnvironment,
});

serve(async (req) => {
    // Handle CORS
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { sourceId, amount, currency = "USD", orderId, customerEmail, locationId, items, shippingAddress, shippingCost, tax } = await req.json();

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
