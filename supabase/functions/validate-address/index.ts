import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { UPSCarrier } from '../_shared/carriers/ups.ts'
import { ShippoCarrier } from '../_shared/carriers/shippo.ts'

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { address } = await req.json()

        if (!address) {
            throw new Error('Address is required');
        }

        // Initialize Supabase Client
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Fetch ACTIVE carrier settings
        const { data: carriersData, error: carriersError } = await supabase
            .from('carrier_settings')
            .select('*')
            .eq('is_active', true);

        if (carriersError) throw carriersError;
        
        if (!carriersData || carriersData.length === 0) {
            // No active carriers - return valid: true to bypass blocking checkout
            return new Response(
                JSON.stringify({ valid: true, suggestions: [], note: "No active carriers to validate address." }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const upsSettings = carriersData.find(c => c.carrier === 'UPS');
        const shippoSettings = carriersData.find(c => c.carrier === 'SHIPPO');
        
        let result: any = { valid: true, suggestions: [], note: "Validation skipped (no suitable carrier found)" };

        // 1. Try Shippo first (requested by user for stability)
        if (shippoSettings && shippoSettings.api_key) {
            try {
                const shippo = new ShippoCarrier(shippoSettings);
                const shippoResult = await shippo.validateAddress(address);
                
                result = {
                    valid: shippoResult.valid,
                    suggestions: shippoResult.suggestions || [],
                    note: shippoResult.note || "Validation by Shippo"
                };

                // If Shippo says it's perfectly valid, we might still want UPS to double-check if available
            } catch (e: any) {
                console.warn("Shippo validation failed:", e.message);
            }
        }

        // 2. Try UPS as second source or correction
        if (upsSettings && upsSettings.client_id && upsSettings.client_secret) {
            try {
                const ups = new UPSCarrier(upsSettings);
                const upsResult = await ups.validateAddress(address);
                
                // If result was already valid but UPS has MORE suggestions, merge them
                // Or if Shippo failed, use UPS
                if (result.valid === false || result.suggestions.length === 0) {
                   const normalizedUpsSugg = (upsResult.suggestions || []).map((s: any) => {
                       const sugg = s.AddressKeyFormat;
                       const line = Array.isArray(sugg?.AddressLine) ? sugg.AddressLine.join(', ') : (sugg?.AddressLine || "");
                       return {
                            line1: line,
                            city: sugg?.PoliticalDivision2 || '',
                            state: sugg?.PoliticalDivision1 || '',
                            postal_code: sugg?.PostcodePrimaryLow || '',
                            country: sugg?.CountryCode || 'US',
                            source: "UPS"
                       };
                   });

                   result.suggestions = [...result.suggestions, ...normalizedUpsSugg];
                   
                   // If UPS says it's invalid but Shippo didn't have a verdict yet, or UPS found a hard error
                   if (upsResult.valid === false) {
                       result.valid = false;
                       result.note = (upsResult as any).note || result.note || "UPS could not verify this address.";
                   }
                }
            } catch (e: any) {
                console.warn("UPS validation failed:", e.message);
            }
        }

        return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        console.error("DEBUG: Address validation failed:", error.stack || error.message || error);
        return new Response(
            JSON.stringify({ 
                error: error.message,
                details: error.stack,
                hint: "Ensure SUPABASE_SERVICE_ROLE_KEY is set in your Edge Function secrets." 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
