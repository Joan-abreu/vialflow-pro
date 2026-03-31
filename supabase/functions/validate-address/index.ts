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
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        // Fetch ACTIVE carrier settings (we'll prefer UPS for validation right now)
        const { data: carriersData, error: carriersError } = await supabase
            .from('carrier_settings')
            .select('*')
            .eq('is_active', true);

        if (carriersError) throw carriersError;
        if (!carriersData || carriersData.length === 0) {
            throw new Error("No active shipping carriers configured.");
        }

        const upsSettings = carriersData.find(c => c.carrier_name === 'UPS');
        
        if (upsSettings) {
            const ups = new UPSCarrier(upsSettings);
            const result = await ups.validateAddress(address);
            
            return new Response(
                JSON.stringify(result),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        } else {
             // Fallback if UPS is not active, maybe FedEx could do it or just return true to skip validation
             return new Response(
                JSON.stringify({ valid: true, suggestions: [], note: "Skipped validation (UPS not active)" }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

    } catch (error: any) {
        console.error(error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
