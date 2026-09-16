
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { FedExCarrier } from "../_shared/carriers/fedex.ts"
import { UPSCarrier } from "../_shared/carriers/ups.ts"
import { ShippoCarrier } from "../_shared/carriers/shippo.ts"
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
        const { weight, address, items, subtotal } = await req.json()

        console.log(`Calculating shipping for weight: ${weight}, subtotal: ${subtotal}, address: ${JSON.stringify(address)}`);

        // Initialize Supabase Client
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Fetch Carrier Settings & Free Shipping Store Settings in parallel
        const [settingsResult, appSettingsResult] = await Promise.all([
            supabase.from('carrier_settings').select('*').eq('is_active', true),
            supabase.from('app_settings').select('key, value').in('key', ['shipping_free_enabled', 'shipping_free_threshold'])
        ]);

        const settingsData = settingsResult.data || [];
        if (settingsResult.error) {
            console.error("Error fetching carrier settings:", settingsResult.error);
            throw new Error("Failed to load shipping configurations");
        }

        const appSettings = appSettingsResult.data || [];
        const isFreeShippingEnabled = appSettings.find((s: any) => s.key === 'shipping_free_enabled')?.value !== 'false';
        const freeShippingThreshold = parseFloat(appSettings.find((s: any) => s.key === 'shipping_free_threshold')?.value || '100');

        const activeCarriers: { instance: ICarrier, settings: any }[] = [];

        // 2. Initialize Enabled Carriers
        settingsData.forEach((setting: any) => {
            try {
                if (setting.carrier === 'FEDEX') {
                    activeCarriers.push({ instance: new FedExCarrier(setting), settings: setting });
                } else if (setting.carrier === 'UPS') {
                    activeCarriers.push({ instance: new UPSCarrier(setting), settings: setting });
                } else if (setting.carrier === 'SHIPPO') {
                    activeCarriers.push({ instance: new ShippoCarrier(setting), settings: setting });
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

        // 3. Prepare Packages list (Multi-Parcel Packing)
        const packagesList: any[] = [];

        // Separate bulk items and retail items
        const bulkItems = (items || []).filter((item: any) => item.is_bulk);
        const retailItems = (items || []).filter((item: any) => !item.is_bulk);

        // Fetch Box Configurations
        const variantIds = (items || []).map((item: any) => item.variant_id).filter(Boolean);
        let boxConfigs: any[] = [];
        if (variantIds.length > 0) {
            const { data, error } = await supabase
                .from('box_configurations')
                .select('*')
                .in('variant_id', variantIds);
            if (error) {
                console.error("Error fetching box configurations:", error);
            } else if (data) {
                boxConfigs = data;
            }
        }

        // Process Bulk Items
        bulkItems.forEach((item: any) => {
            const variantId = item.variant_id;
            const config = boxConfigs.find((bc: any) => bc.variant_id === variantId);
            
            const packsPerBox = config?.packs_per_box || 100;
            const boxL = Number(config?.box_length) || 12;
            const boxW = Number(config?.box_width) || 12;
            const boxH = Number(config?.box_height) || 12;
            const boxWgt = Number(config?.box_weight) || 0.5;
            const itemWgt = Number(item.weight) || 0.1;

            const qty = Number(item.quantity) || 1;
            
            const fullBoxes = Math.floor(qty / packsPerBox);
            const remainder = qty % packsPerBox;

            // Full boxes
            for (let i = 0; i < fullBoxes; i++) {
                const boxWeight = parseFloat(((packsPerBox * itemWgt) + boxWgt).toFixed(2));
                packagesList.push({
                    weight: Math.max(0.1, boxWeight),
                    length: boxL,
                    width: boxW,
                    height: boxH
                });
            }

            // Remainder box
            if (remainder > 0) {
                const boxWeight = parseFloat(((remainder * itemWgt) + boxWgt).toFixed(2));
                // Scale height based on remainder ratio
                const scaledHeight = Math.max(2, Math.min(boxH, Math.ceil((remainder / packsPerBox) * boxH)));
                packagesList.push({
                    weight: Math.max(0.1, boxWeight),
                    length: boxL,
                    width: boxW,
                    height: scaledHeight
                });
            }
        });

        // Process Retail Items (stacked combined box, original logic)
        if (retailItems.length > 0) {
            let maxL = 0;
            let maxW = 0;
            let totalH = 0;
            let totalWeight = 0;

            retailItems.forEach((item: any) => {
                const l = Number(item.length) || 6;
                const w = Number(item.width) || 4;
                const h = Number(item.height) || 4;
                const wgt = Number(item.weight) || 0.1;
                const qty = Number(item.quantity) || 1;

                const dims = [l, w, h].sort((a, b) => b - a);
                const itemL = dims[0];
                const itemW = dims[1];
                const itemH = dims[2];

                if (itemL > maxL) maxL = itemL;
                if (itemW > maxW) maxW = itemW;
                totalH += (itemH * qty);
                totalWeight += (wgt * qty);
            });

            const finalLength = Math.min(Math.ceil(maxL || 6), 27);
            const finalWidth = Math.min(Math.ceil(maxW || 4), 15);
            const finalHeight = Math.min(Math.ceil(totalH || 4), 17);
            const boxWeight = Math.max(0.3, totalWeight * 0.1);
            const calculatedWeight = parseFloat((totalWeight + boxWeight).toFixed(2));

            packagesList.push({
                weight: Math.max(0.1, calculatedWeight),
                length: finalLength,
                width: finalWidth,
                height: finalHeight
            });
        }

        // Fallback if packagesList is empty
        if (packagesList.length === 0) {
            packagesList.push({
                weight: Math.max(0.1, Number(weight) || 1.0),
                length: 6,
                width: 4,
                height: 4
            });
        }

        const baseShipment = {
            shipper: defaultShipper,
            recipient: {
                name: address.full_name || address.name || "Customer",
                address: {
                    line1: address.line1,
                    city: address.city,
                    state: address.state,
                    postal_code: address.postal_code,
                    country: "US"
                }
            },
            packages: packagesList
        };

        // --- DEBUG LOG FOR PACKAGE DIMENSIONS ---
        console.log("📦 CALCULATED PACKAGE FOR SHIPPING:", JSON.stringify(baseShipment.packages[0], null, 2));
        // ----------------------------------------

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
        const carrierErrors: string[] = [];

        results.forEach((result, idx) => {
            const carrierSetting = activeCarriers[idx].settings;
            if (result.success && result.rates) {
                const ratesWithProvider = result.rates.map((r: any) => ({
                    ...r,
                    carrier: r.carrier || carrierSetting.carrier
                }));
                allRates = [...allRates, ...ratesWithProvider];
            } else if ((result as any).error) {
                console.warn(`Carrier error (${carrierSetting.carrier}):`, (result as any).error);
                carrierErrors.push(`${carrierSetting.carrier}: ${(result as any).error}`);
            }
        });

        // Sort by cost ascending
        allRates.sort((a, b) => a.cost - b.cost);

        // 6. Apply Free Shipping Threshold if qualified
        // Free shipping applies STRICTLY to the cheapest Ground / Standard Economy service.
        // Express, 2-Day, Overnight, and Priority Mail Express ALWAYS remain at full carrier cost.
        const orderSubtotal = typeof subtotal === 'number' ? subtotal : null;
        
        if (isFreeShippingEnabled && orderSubtotal !== null && orderSubtotal >= freeShippingThreshold && allRates.length > 0) {
            const isExpressOrOvernight = (rate: any) => {
                const text = ((rate.serviceName || rate.service || "") + " " + (rate.serviceCode || rate.service_code || "")).toUpperCase();
                return (
                    text.includes("EXPRESS") ||
                    text.includes("OVERNIGHT") ||
                    text.includes("2DAY") ||
                    text.includes("2_DAY") ||
                    text.includes("NEXT DAY") ||
                    text.includes("NEXT_DAY") ||
                    text.includes("1DAY") ||
                    text.includes("SAME DAY") ||
                    text.includes("SAME_DAY") ||
                    text.includes("PRIORITY MAIL EXPRESS") ||
                    text.includes("AIR")
                );
            };

            // Find the lowest cost ground/standard rate (allRates is sorted by cost ascending)
            const groundRate = allRates.find((r: any) => !isExpressOrOvernight(r));
            if (groundRate) {
                groundRate.original_cost = groundRate.cost;
                groundRate.cost = 0;
                groundRate.is_free = true;
                groundRate.free_shipping_reason = `Free standard shipping on orders over $${freeShippingThreshold}`;
                console.log(`🎉 Free shipping applied to ${groundRate.serviceName || groundRate.service} (Subtotal: $${orderSubtotal} >= Threshold: $${freeShippingThreshold})`);
                
                // Re-sort so the free ground rate is guaranteed first
                allRates.sort((a, b) => a.cost - b.cost);
            }
        }

        console.log(`Found ${allRates.length} shipping rates.`);

        if (allRates.length === 0 && carrierErrors.length > 0) {
            return new Response(
                JSON.stringify({ error: "Carrier errors: " + carrierErrors.join(" | ") }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        return new Response(
            JSON.stringify({ rates: allRates }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error: any) {
        console.error(error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
