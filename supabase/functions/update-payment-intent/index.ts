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
        const { paymentIntentId, orderId } = await req.json();

        if (!paymentIntentId || !orderId) {
            throw new Error("PaymentIntent ID and Order ID are required");
        }

        // Update the PaymentIntent with the orderId in metadata
        const paymentIntent = await stripe.paymentIntents.update(paymentIntentId, {
            metadata: {
                order_id: orderId,
            },
        });

        return new Response(
            JSON.stringify({ success: true, paymentIntent }),
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
