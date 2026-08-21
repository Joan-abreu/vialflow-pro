import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const tagadaApiKeyEnv = Deno.env.get("TAGADAPAY_API_KEY") || "";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body = await req.json().catch(() => ({}));
        let { storeId, apiKey } = body;

        // 1. If not provided in body, load from app_settings
        if (!storeId || !apiKey) {
            const { data: settings } = await supabase
                .from("app_settings")
                .select("key, value")
                .eq("key", "payment_tagadapay_config")
                .single();

            if (settings?.value) {
                try {
                    const parsed = JSON.parse(settings.value);
                    if (!storeId && parsed.storeId) storeId = parsed.storeId;
                } catch (_) {}
            }
        }

        const effectiveApiKey = apiKey || tagadaApiKeyEnv;

        if (!effectiveApiKey) {
            return new Response(JSON.stringify({
                error: "TagadaPay API Key / Access Token is not configured. Please provide it or set TAGADAPAY_API_KEY."
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400
            });
        }

        if (!storeId) {
            return new Response(JSON.stringify({
                error: "Tagada Store ID is required. Please set it in Site Settings > TagadaPay."
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400
            });
        }

        // 2. Fetch all products and their variants from Supabase
        const { data: products, error: prodErr } = await supabase
            .from("products")
            .select(`
                id,
                name,
                description,
                image_url,
                is_active,
                product_variants (
                    id,
                    sku,
                    price,
                    vial_type_id,
                    vial_types (
                        name,
                        capacity_ml
                    )
                )
            `)
            .order("name");

        if (prodErr) throw prodErr;

        if (!products || products.length === 0) {
            return new Response(JSON.stringify({
                message: "No products found to sync.",
                synced: 0
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200
            });
        }

        const tagadaBaseUrl = Deno.env.get("TAGADAPAY_BASE_URL") || "https://api.tagadapay.io/api/public/v1";
        const results: any[] = [];
        let successCount = 0;
        let failCount = 0;

        // 3. Iterate through each product and register in TagadaPay CRM
        for (const product of products) {
            const rawVariants = product.product_variants || [];
            
            // Build variants payload
            let formattedVariants: any[] = [];

            if (rawVariants.length > 0) {
                formattedVariants = rawVariants.map((v: any, idx: number) => {
                    const variantName = v.vial_types?.name 
                        ? `${v.vial_types.name}${v.vial_types.capacity_ml ? ` (${v.vial_types.capacity_ml}ml)` : ''}`
                        : `Standard Option ${idx + 1}`;

                    const priceInCents = Math.max(100, Math.round(Number(v.price || 1) * 100));

                    return {
                        name: variantName,
                        description: product.description || product.name,
                        sku: v.sku || `SKU-${product.id.slice(0, 6)}-${idx + 1}`,
                        active: true,
                        default: idx === 0,
                        imageUrl: product.image_url || undefined,
                        prices: [
                            {
                                currencyOptions: {
                                    USD: {
                                        amount: priceInCents,
                                        currency: "USD"
                                    }
                                },
                                recurring: false,
                                billingTiming: "usage",
                                interval: null,
                                intervalCount: 1,
                                default: true
                            }
                        ]
                    };
                });
            } else {
                // Fallback single default variant if no variants exist
                formattedVariants = [
                    {
                        name: "Default Variant",
                        description: product.description || product.name,
                        sku: `SKU-${product.id.slice(0, 8)}`,
                        active: true,
                        default: true,
                        imageUrl: product.image_url || undefined,
                        prices: [
                            {
                                currencyOptions: {
                                    USD: {
                                        amount: 1000,
                                        currency: "USD"
                                    }
                                },
                                recurring: false,
                                default: true
                            }
                        ]
                    }
                ];
            }

            const tagadaProductPayload = {
                storeId: storeId.trim(),
                name: product.name,
                description: product.description || `${product.name} - Research Grade Formulation`,
                active: product.is_active !== false,
                isShippable: true,
                isTaxable: true,
                variants: formattedVariants
            };

            const candidateEndpoints = [
                "https://api.tagada.io/api/public/v1/products/create",
                "https://api.tagada.io/api/public/v1/products",
                "https://app.tagada.io/api/public/v1/products/create",
                "https://app.tagadapay.com/api/public/v1/products/create",
                "https://api.tagadapay.io/api/public/v1/products/create"
            ];

            let createdSuccessfully = false;
            let lastError = "Route not found";
            let tagadaId = null;

            for (const endpoint of candidateEndpoints) {
                try {
                    const res = await fetch(endpoint, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${effectiveApiKey.trim()}`,
                            "Content-Type": "application/json",
                            "Accept": "application/json"
                        },
                        body: JSON.stringify(tagadaProductPayload)
                    });

                    const resData = await res.json().catch(() => ({}));

                    if (res.ok && (resData.id || resData.product?.id || resData.success || resData.name)) {
                        createdSuccessfully = true;
                        tagadaId = resData.id || resData.product?.id || "synced";
                        break;
                    } else {
                        lastError = resData.message || resData.error || `HTTP ${res.status}`;
                    }
                } catch (err: any) {
                    lastError = err.message || "Network error";
                }
            }

            if (createdSuccessfully) {
                successCount++;
                results.push({
                    productId: product.id,
                    name: product.name,
                    status: "success",
                    tagadaId: tagadaId
                });
            } else {
                failCount++;
                results.push({
                    productId: product.id,
                    name: product.name,
                    status: "failed",
                    error: lastError
                });
            }
        }

        return new Response(JSON.stringify({
            success: true,
            totalProducts: products.length,
            successful: successCount,
            failed: failCount,
            details: results
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200
        });

    } catch (error: any) {
        console.error("Tagada Product Sync Error:", error);
        return new Response(JSON.stringify({
            error: error.message || "Failed to sync products with TagadaPay CRM"
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500
        });
    }
});
