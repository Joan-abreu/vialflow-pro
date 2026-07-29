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

        const supabase = createClient(
            supabaseUrl ?? "",
            supabaseKey ?? ""
        );

        let { codes, subtotal, shipping, userId, email, shippingAddress } = await req.json();
        
        // Ensure values are numbers
        subtotal = Number(subtotal) || 0;
        shipping = Number(shipping) || 0;

        if (!codes || !Array.isArray(codes)) {
            throw new Error("Invalid request: codes must be an array");
        }

        let userEmail = (email || "").trim().toLowerCase();
        if (!userEmail && userId) {
            const { data: profile } = await supabase
                .from("profiles")
                .select("email")
                .eq("user_id", userId)
                .maybeSingle();
            if (profile?.email) {
                userEmail = profile.email.trim().toLowerCase();
            }
        }

        let currentSubtotal = subtotal;
        let currentShipping = shipping;
        const appliedDiscounts = [];

        for (const code of codes) {
            const trimmedCode = code.trim().toUpperCase();
            if (!trimmedCode) continue;

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
                // Check expiry
                if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
                    throw new Error(`Coupon ${trimmedCode} has expired.`);
                }
                // Check global usage limit
                if (coupon.max_uses && coupon.times_used >= coupon.max_uses) {
                    throw new Error(`Coupon ${trimmedCode} has reached its maximum global usage limit.`);
                }

                // Restriction Check: Specific Customer / Email
                const userRestrictions = Array.isArray(coupon.restricted_to_user_ids) ? coupon.restricted_to_user_ids : [];
                const emailRestrictions = Array.isArray(coupon.restricted_to_emails) ? coupon.restricted_to_emails : [];
                const allRestrictions = [...userRestrictions, ...emailRestrictions].map((r: string) => r.trim().toLowerCase());

                if (allRestrictions.length > 0) {
                    let isAllowed = false;

                    // Match 1: Directly matches userId
                    if (userId && allRestrictions.includes(userId.toLowerCase())) {
                        isAllowed = true;
                    }

                    // Match 2: Directly matches email address
                    if (!isAllowed && userEmail && allRestrictions.includes(userEmail)) {
                        isAllowed = true;
                    }

                    // Match 3: If restriction is a user_id UUID, check if user's email matches profile
                    if (!isAllowed && userEmail && userRestrictions.length > 0) {
                        const { data: restrictedProfiles } = await supabase
                            .from("profiles")
                            .select("email")
                            .in("user_id", userRestrictions);
                        
                        if (restrictedProfiles && restrictedProfiles.some((p: any) => p.email?.trim().toLowerCase() === userEmail)) {
                            isAllowed = true;
                        }
                    }

                    if (!isAllowed) {
                        throw new Error(`Coupon ${trimmedCode} is restricted to specific customer email address(es).`);
                    }
                }

                // Anti-Fraud & Single-Use Check (by Email, User ID, and Shipping Address)
                if (coupon.one_use_per_user) {
                    let isAlreadyUsed = false;

                    // Check by email
                    if (userEmail) {
                        const { data: emailUsage } = await supabase
                            .from("orders")
                            .select("id")
                            .ilike("customer_email", userEmail)
                            .not("status", "in", '("cancelled", "failed")')
                            .contains("applied_coupons", [trimmedCode])
                            .limit(1);

                        if (emailUsage && emailUsage.length > 0) {
                            isAlreadyUsed = true;
                        }
                    }

                    // Check by user ID
                    if (!isAlreadyUsed && userId) {
                        const { data: userUsage } = await supabase
                            .from("orders")
                            .select("id")
                            .eq("user_id", userId)
                            .not("status", "in", '("cancelled", "failed")')
                            .contains("applied_coupons", [trimmedCode])
                            .limit(1);

                        if (userUsage && userUsage.length > 0) {
                            isAlreadyUsed = true;
                        }
                    }

                    // Anti-fraud check by shipping address (prevents creating duplicate accounts to re-use coupon)
                    if (!isAlreadyUsed && shippingAddress?.line1 && (shippingAddress?.zip || shippingAddress?.postal_code)) {
                        const cleanLine1 = shippingAddress.line1.trim().toLowerCase();
                        const cleanZip = (shippingAddress.zip || shippingAddress.postal_code || "").trim().substring(0, 5);

                        const { data: addressOrders } = await supabase
                            .from("orders")
                            .select("id, shipping_address")
                            .not("status", "in", '("cancelled", "failed")')
                            .contains("applied_coupons", [trimmedCode])
                            .limit(25);

                        if (addressOrders && addressOrders.length > 0) {
                            const addressMatch = addressOrders.some((o: any) => {
                                const addr = o.shipping_address || {};
                                const oLine1 = (addr.line1 || addr.street1 || "").trim().toLowerCase();
                                const oZip = (addr.postal_code || addr.zip || "").trim().substring(0, 5);
                                return oLine1 === cleanLine1 && oZip === cleanZip;
                            });

                            if (addressMatch) {
                                isAlreadyUsed = true;
                            }
                        }
                    }

                    if (isAlreadyUsed) {
                        throw new Error(`This single-use coupon (${trimmedCode}) has already been redeemed for this email address or shipping address.`);
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
            if (userId) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("referral_code, successful_referrals")
                    .eq("user_id", userId)
                    .single();

                if (profile && profile.referral_code === trimmedCode) {
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
                if (userId && otherProfile.user_id === userId) {
                    throw new Error("You cannot use your own referral code");
                }
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
