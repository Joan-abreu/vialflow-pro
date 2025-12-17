
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { FedExCarrier } from "../_shared/carriers/fedex.ts"
import { UPSCarrier } from "../_shared/carriers/ups.ts"
import { DEFAULT_SHIPPER } from "../_shared/config.ts"
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

        const activeCarriers: { instance: ICarrier, settings: any }[] = [];

        // 2. Initialize Enabled Carriers
        settingsData.forEach((setting: any) => {
            try {
                if (setting.carrier === 'FEDEX') {
                    activeCarriers.push({ instance: new FedExCarrier(setting), settings: setting });
                } else if (setting.carrier === 'UPS') {
                    activeCarriers.push({ instance: new UPSCarrier(setting), settings: setting });
                }
            } catch (e) {
                console.error(`Error initializing carrier ${setting.carrier}:`, e);
            }
        });

        if (activeCarriers.length === 0) {
            // Fallback if no carriers configured (or allow mock?)
            console.warn("No active carriers found. Returning empty rates.");
            return new Response(
                JSON.stringify({ rates: [] }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 3. Prepare Shipment Object
        // Default Shipper (Fallback)
        const defaultShipper = DEFAULT_SHIPPER;

        const baseShipment = {
            shipper: defaultShipper,
            recipient: {
                name: address.name || "Customer",
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
        const ratePromises = activeCarriers.map(({ instance, settings }) => {
            // Use configured shipper if available, otherwise default
            const carrierShipper = settings.shipper_address ? {
                name: settings.shipper_name || defaultShipper.name,
                phone: settings.shipper_phone || defaultShipper.phone,
                address: {
                    line1: settings.shipper_address.line1 || settings.shipper_address.address_line1,
                    city: settings.shipper_address.city,
                    state: settings.shipper_address.state_code || settings.shipper_address.state,
                    postal_code: settings.shipper_address.postal_code || settings.shipper_address.zip,
                    country: settings.shipper_address.country_code || settings.shipper_address.country || "US"
                }
            } : defaultShipper;

            const shipment = {
                ...baseShipment,
                shipper: carrierShipper
            };

            return instance.getRates(shipment).catch(e => {
                console.error("Error getting rates from carrier:", e);
                const errorMessage = e instanceof Error ? e.message : String(e);
                return { success: false, rates: [], error: errorMessage };
            });
        });

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
