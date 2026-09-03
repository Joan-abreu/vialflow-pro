import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Cloudflare / Supabase connection headers
    const ip = req.headers.get("cf-connecting-ip") || 
               req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
               req.headers.get("x-real-ip") || 
               null;
    const country_code = req.headers.get("cf-ipcountry") || null;
    const city = req.headers.get("cf-ipcity") || null;
    const region = req.headers.get("cf-region") || null;

    let country = country_code === "US" ? "United States" : country_code;

    // 2. If city/country is not populated by CF, perform a server-side lookup
    // (Server-side fetch is NEVER blocked by browser CSP or client adblockers)
    if (ip && (!city || !country)) {
      try {
        const geoRes = await fetch(`https://ipwho.is/${ip}`);
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData.success) {
            return new Response(JSON.stringify({
              ip_address: ip,
              country: geoData.country || country,
              country_code: geoData.country_code || country_code,
              city: geoData.city || city,
              region: geoData.region || region,
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }
        }
      } catch {
        // Fallback to headers
      }
    }

    return new Response(JSON.stringify({
      ip_address: ip,
      country: country,
      country_code: country_code,
      city: city,
      region: region,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
