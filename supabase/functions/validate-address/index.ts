import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { UPSCarrier } from '../_shared/carriers/ups.ts'

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
        
        if (upsSettings) {
            const ups = new UPSCarrier(upsSettings);
            const result = await ups.validateAddress(address);
            
            return new Response(
                JSON.stringify(result),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        } else {
             // Fallback if UPS is not active
             return new Response(
                JSON.stringify({ valid: true, suggestions: [], note: "Skipped UPS validation (using fallback)" }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

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
