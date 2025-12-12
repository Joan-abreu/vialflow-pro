
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { FedExCarrier } from "../_shared/carriers/fedex.ts"
import { UPSCarrier } from "../_shared/carriers/ups.ts"
import { ICarrier } from "../_shared/carriers/types.ts"

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

        // Initialize Supabase Client
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Fetch Carrier Settings
        const { data: settingsData, error: settingsError } = await supabase
            .from('carrier_settings')
            .select('*')
            .eq('is_active', true);

        if (settingsError) {
            console.error("Error fetching carrier settings:", settingsError);
            throw new Error("Failed to load shipping configurations");
        }

        const carriers: ICarrier[] = [];

        // 2. Initialize Enabled Carriers
        settingsData.forEach((setting: any) => {
            try {
                if (setting.carrier === 'FEDEX') {
                    carriers.push(new FedExCarrier(setting));
                } else if (setting.carrier === 'UPS') {
                    carriers.push(new UPSCarrier(setting));
                }
            } catch (e) {
                console.error(`Error initializing carrier ${setting.carrier}:`, e);
            }
        });

        if (carriers.length === 0) {
            // Fallback if no carriers configured (or allow mock?)
            console.warn("No active carriers found. Returning empty rates.");
            return new Response(
                JSON.stringify({ rates: [] }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 3. Prepare Shipment Object
        // Hardcoded Fallback Shipper Address (Miami Warehouse) for testing if DB setting is missing
        const defaultShipper = {
            name: "VialFlow Shipping",
            phone: "3055550123",
            address: {
                line1: "123 Warehouse Blvd",
                city: "Miami",
                state: "FL",
                postal_code: "33172",
                country: "US"
            }
        };

        const shipment = {
            shipper: defaultShipper, // Pass this explicitly so carriers use it if their own settings are empty
            recipient: {
                name: address.name || "Valued Customer",
                address: {
                    line1: address.line1,
                    city: address.city,
                    state: address.state,
                    postal_code: address.postal_code,
                    country: "US"
                }
            },
            packages: [
                {
                    weight: Math.max(0.1, weight),
                    length: 6,
                    width: 4,
                    height: 4
                }
            ]
        };

        // 4. Fetch Rates in Parallel
        const ratePromises = carriers.map(c => c.getRates(shipment).catch(e => {
            console.error("Error getting rates from carrier:", e);
            const errorMessage = e instanceof Error ? e.message : String(e);
            return { success: false, rates: [], error: errorMessage };
        }));

        const results = await Promise.all(ratePromises);

        // 5. Aggregate Results
        let allRates: any[] = [];
        results.forEach(result => {
            if (result.success && result.rates) {
                allRates = [...allRates, ...result.rates];
            } else if (result.error) {
                console.warn("Carrier error:", result.error);
            }
        });

        // Sort by cost ascending
        allRates.sort((a, b) => a.cost - b.cost);

        console.log(`Found ${allRates.length} shipping rates.`);

        return new Response(
            JSON.stringify({ rates: allRates }),
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
