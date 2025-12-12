import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2023-10-16",
});

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { amount, currency = "usd", paymentIntentId } = await req.json();

        if (!amount) {
            throw new Error("Amount is required");
        }

        let paymentIntent;

        if (paymentIntentId) {
            // Update existing PaymentIntent
            paymentIntent = await stripe.paymentIntents.update(paymentIntentId, {
                amount: Math.round(amount * 100),
            });
        } else {
            // Create a PaymentIntent with the order amount and currency
            paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(amount * 100), // Stripe expects amount in cents
                currency: currency,
                automatic_payment_methods: {
                    enabled: true,
                },
            });
        }

        return new Response(
            JSON.stringify({
                clientSecret: paymentIntent.client_secret,
                id: paymentIntent.id
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            }
        );
    }
});
