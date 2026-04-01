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
        const { sourceId, amount, currency = "USD", orderId, customerEmail } = await req.json();

        if (!sourceId || !amount) {
            throw new Error("Missing sourceId or amount");
        }

        if (!squareAccessToken) {
            throw new Error("Missing Square Access Token in environment");
        }

        // Generate a unique idempotency key
        const idempotencyKey = crypto.randomUUID();

        // Convert decimal amount to smallest denomination (e.g., cents)
        // Ensure no floating point precision issues
        const amountInCents = Math.round(parseFloat(amount.toString()) * 100);

        // Process the payment
        const paymentResponse = await square.paymentsApi.createPayment({
            sourceId: sourceId,
            idempotencyKey: idempotencyKey,
            amountMoney: {
                amount: BigInt(amountInCents),
                currency: currency,
            },
            referenceId: orderId,
            buyerEmailAddress: customerEmail,
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
                error: `Payment failed with status: ${payment?.status}`
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            });
        }

    } catch (error: any) {
        console.error("Square Payment Error:", error);
        
        let errorMessage = error.message;
        
        // If it's an API error from Square SDK
        if (error.errors && error.errors.length > 0) {
            errorMessage = error.errors[0].detail || error.errors[0].code;
        }

        return new Response(JSON.stringify({ error: errorMessage || "Payment processing failed" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
