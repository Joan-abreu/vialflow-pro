
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        console.log(`Supabase URL is ${supabaseUrl ? 'present' : 'MISSING'}`);
        console.log(`Supabase Key is ${supabaseKey ? 'present' : 'MISSING'}`);

        const supabase = createClient(
            supabaseUrl ?? "",
            supabaseKey ?? ""
        );

        let { codes, subtotal, shipping, userId } = await req.json();
        console.log(`Validating codes: ${JSON.stringify(codes)} for user: ${userId}`);
        
        // Ensure values are numbers
        subtotal = Number(subtotal) || 0;
        shipping = Number(shipping) || 0;
        console.log(`Subtotal: ${subtotal}, Shipping: ${shipping}`);

        if (!codes || !Array.isArray(codes)) {
            console.error("Invalid request body: codes is not an array");
            throw new Error("Invalid request: codes must be an array");
        }

        let currentSubtotal = subtotal;
        let currentShipping = shipping;
        const appliedDiscounts = [];

        for (const code of codes) {
            const trimmedCode = code.trim().toUpperCase();
            if (!trimmedCode) continue;

            console.log(`Checking code: ${trimmedCode}`);

            // 1. Check if it's a standard coupon
            const { data: coupon, error: couponError } = await supabase
                .from("coupons")
                .select("*")
                .eq("code", trimmedCode)
                .eq("is_active", true)
                .single();

            if (couponError && couponError.code !== 'PGRST116') {
                console.error(`Coupon search error: ${couponError.message}`);
            }

            if (coupon) {
                console.log(`Found standard coupon: ${JSON.stringify(coupon)}`);
                // Check expiry
                if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
                    continue;
                }
                // Check usage limit
                if (coupon.max_uses && coupon.times_used >= coupon.max_uses) {
                    continue;
                }

                // New Restriction: Check if restricted to specific users
                if (coupon.restricted_to_user_ids && Array.isArray(coupon.restricted_to_user_ids) && coupon.restricted_to_user_ids.length > 0) {
                    if (!userId) {
                        console.log(`Code ${trimmedCode} is restricted but no userId provided`);
                        continue;
                    }
                    if (!coupon.restricted_to_user_ids.includes(userId)) {
                        console.log(`Code ${trimmedCode} is restricted to [${coupon.restricted_to_user_ids.join(', ')}], but user is ${userId}`);
                        continue;
                    }
                }

                // New Restriction: One use per customer
                if (coupon.one_use_per_user && userId) {
                    const { data: previousUsage, error: usageError } = await supabase
                        .from("orders")
                        .select("id")
                        .eq("user_id", userId)
                        .not("status", "in", '("cancelled", "failed")')
                        .contains("applied_coupons", [trimmedCode])
                        .limit(1);

                    if (usageError) {
                        console.error(`Error checking previous usage for ${trimmedCode}:`, usageError);
                    } else if (previousUsage && previousUsage.length > 0) {
                        console.log(`Code ${trimmedCode} already used by user ${userId}`);
                        continue;
                    }
                }

                let discountAmount = 0;
                if (coupon.target === 'product' || coupon.target === 'all') {
                    const amount = coupon.type === 'percentage' 
                        ? (currentSubtotal * (coupon.value / 100)) 
                        : Math.min(coupon.value, currentSubtotal);
                    discountAmount += amount;
                    currentSubtotal = Math.max(0, currentSubtotal - amount);
                }

                if (coupon.target === 'shipping' || coupon.target === 'all') {
                    const amount = coupon.type === 'percentage' 
                        ? (currentShipping * (coupon.value / 100)) 
                        : Math.min(coupon.value, currentShipping);
                    discountAmount += amount;
                    currentShipping = Math.max(0, currentShipping - amount);
                }

                appliedDiscounts.push({
                    code: trimmedCode,
                    amount: discountAmount,
                    target: coupon.target,
                    message: "Coupon applied successfully"
                });
                continue;
            }

            // 2. Check if it's a referral code (Referrer Reward)
            // If the user is entering their OWN code to get their earned discount
            if (userId) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("referral_code, successful_referrals")
                    .eq("user_id", userId)
                    .single();

                if (profile && profile.referral_code === trimmedCode) {
                    // Block self-referral/self-reward as per user request
                    console.log(`User ${userId} tried to use their own referral code ${trimmedCode}`);
                    throw new Error("You cannot use your own referral code");
                }
            }

            const { data: otherProfile, error: otherProfileError } = await supabase
                .from("profiles")
                .select("user_id")
                .eq("referral_code", trimmedCode)
                .single();

            if (otherProfileError && otherProfileError.code !== 'PGRST116') {
                console.error(`Other profile search error: ${otherProfileError.message}`);
            }

            if (otherProfile) {
                console.log(`Found referee code owner: ${otherProfile.user_id}`);
                if (userId && otherProfile.user_id === userId) {
                    console.log(`Self-referral detected for user ${userId}`);
                    throw new Error("You cannot use your own referral code");
                }
                 // Referee gets no discount for now as per requirements
                 appliedDiscounts.push({
                    code: trimmedCode,
                    amount: 0,
                    target: 'none',
                    isReferralTracking: true,
                    message: "Referral code recognized"
                });
                continue;
            }
        }

        const total = Number((currentSubtotal + currentShipping).toFixed(2));

        return new Response(
            JSON.stringify({
                appliedDiscounts,
                subtotal: Number(currentSubtotal.toFixed(2)),
                shipping: Number(currentShipping.toFixed(2)),
                total
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        console.error(`Validation error caught: ${error.message}`);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
    }
});
