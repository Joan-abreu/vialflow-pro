import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const { weight, address } = await req.json()

        console.log(`Calculating shipping for weight: ${weight}, address: ${JSON.stringify(address)}`);

        // Mock UPS Logic (Test Data)
        // specific logic for test data requested by user

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));

        let shippingCost = 10.0;

        // Simple logic to simulate "Real Time" variance based on distance (using State as proxy)
        // West Coast states (farther from hypothetical East Coast warehouse) = more expensive
        const westCoast = ['CA', 'OR', 'WA', 'NV', 'AZ'];
        const midWest = ['IL', 'OH', 'MI', 'IN'];

        const state = address?.state?.toUpperCase() || '';

        let zoneMultiplier = 1.0;
        if (westCoast.includes(state)) {
            zoneMultiplier = 1.5;
        } else if (midWest.includes(state)) {
            zoneMultiplier = 1.2;
        }

        // Base Calculation: $10 base + $1 per lb
        const baseRate = 10.0 + (weight * 1.0);

        // Apply Zone Multiplier
        shippingCost = baseRate * zoneMultiplier;

        // Return "Real-Time" Rates
        const rates = [
            {
                service: "UPS Ground",
                rate: Number(shippingCost.toFixed(2)),
                delivery_days: westCoast.includes(state) ? 5 : 3
            },
            {
                service: "UPS 2nd Day Air",
                rate: Number((shippingCost * 2.5).toFixed(2)),
                delivery_days: 2
            },
            {
                service: "UPS Next Day Air",
                rate: Number((shippingCost * 4.0).toFixed(2)),
                delivery_days: 1
            }
        ];

        return new Response(
            JSON.stringify({ rates }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        console.error(error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
