import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

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
        const { variant_id } = await req.json();
        if (!variant_id) {
            return new Response(JSON.stringify({ error: "variant_id is required" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            });
        }

        // 1. Fetch pending notifications for this variant
        const { data: notifications, error: nErr } = await supabase
            .from("restock_notifications")
            .select("id, email, discount_offered")
            .eq("variant_id", variant_id)
            .eq("status", "pending");

        if (nErr) throw nErr;
        if (!notifications || notifications.length === 0) {
            return new Response(JSON.stringify({ success: true, message: "No pending restock notifications found.", count: 0 }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // 2. Fetch variant & product info
        const { data: variant, error: vErr } = await supabase
            .from("product_variants")
            .select(`
                id, price, pack_size, image_url,
                product:products(id, name, slug, image_url),
                vial_type:vial_types(name)
            `)
            .eq("id", variant_id)
            .single();

        if (vErr || !variant) throw new Error("Variant not found");

        const productName = (variant.product as any)?.name || "Product";
        const productSlug = (variant.product as any)?.slug || (variant.product as any)?.id;
        const sizeLabel = (variant.vial_type as any)?.name || "Standard";

        // 3. Fetch restock coupon settings
        const { data: settings } = await supabase
            .from("app_settings")
            .select("key, value")
            .in("key", ["restock_discount_percent", "restock_coupon_code"]);

        let discountPercent = "40";
        let couponCode = "RESTOCK40";
        if (settings && Array.isArray(settings)) {
            settings.forEach((s: any) => {
                if (s.key === "restock_discount_percent") discountPercent = s.value;
                if (s.key === "restock_coupon_code") couponCode = s.value;
            });
        }

        // 4. Ensure restock coupon exists in database
        const { data: existingCoupon } = await supabase
            .from("coupons")
            .select("id")
            .eq("code", couponCode.toUpperCase())
            .maybeSingle();

        if (!existingCoupon) {
            await supabase.from("coupons").insert({
                code: couponCode.toUpperCase(),
                discount_percent: Number(discountPercent),
                is_active: true,
                max_redemptions: 1000,
                redemptions_count: 0
            });
        }

        // 5. Send notification emails via Resend API
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
        let notifiedCount = 0;

        for (const notif of notifications) {
            const productUrl = `https://livwellresearchlabs.com/products/${productSlug}`;
            const emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded-lg: 12px; background-color: #ffffff;">
                    <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb;">
                        <h2 style="color: #059669; margin: 0;">Liv Well Research Labs</h2>
                        <p style="color: #6b7280; font-size: 14px; margin-top: 5px;">Restock Notification Alert</p>
                    </div>

                    <div style="padding: 25px 0;">
                        <h3 style="color: #111827; font-size: 20px; margin-top: 0;">Great news! ${productName} is back in stock 🎉</h3>
                        <p style="color: #4b5563; font-size: 15px; line-height: 1.5;">
                            Thank you for your patience while we replenished our inventory. <strong>${productName} (${sizeLabel})</strong> is now available for immediate order.
                        </p>

                        <div style="background-color: #ecfdf5; border: 1px border-emerald-200; border-radius: 8px; padding: 18px; text-align: center; margin: 20px 0;">
                            <p style="color: #047857; font-weight: bold; font-size: 16px; margin: 0 0 8px 0;">Your Exclusive ${discountPercent}% OFF Restock Discount</p>
                            <div style="display: inline-block; background-color: #ffffff; border: 2px dashed #059669; border-radius: 6px; padding: 10px 20px; font-size: 22px; font-weight: bold; color: #059669; letter-spacing: 1px;">
                                ${couponCode}
                            </div>
                            <p style="color: #065f46; font-size: 12px; margin-top: 8px;">Use this code at checkout to claim your ${discountPercent}% discount.</p>
                        </div>

                        <div style="text-align: center; margin-top: 25px;">
                            <a href="${productUrl}" style="display: inline-block; background-color: #059669; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 16px; padding: 14px 28px; border-radius: 8px; shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                                Order ${productName} Now &rarr;
                            </a>
                        </div>
                    </div>

                    <div style="border-top: 1px solid #e5e7eb; padding-top: 15px; text-align: center; font-size: 12px; color: #9ca3af;">
                        <p>Liv Well Research Labs &bull; Direct Laboratory Manufacturer & Supplier</p>
                    </div>
                </div>
            `;

            if (RESEND_API_KEY) {
                try {
                    await fetch("https://api.resend.com/emails", {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${RESEND_API_KEY}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            from: "Liv Well Research Labs <orders@livwellresearchlabs.com>",
                            to: [notif.email],
                            subject: `🎉 Back in Stock: ${productName} + ${discountPercent}% OFF Code!`,
                            html: emailHtml
                        })
                    });
                    notifiedCount++;
                } catch (e) {
                    console.error("Resend API error for", notif.email, e);
                }
            } else {
                console.log(`[Simulated Email] Sent restock alert to ${notif.email} for ${productName}`);
                notifiedCount++;
            }

            // Mark notification entry as notified
            await supabase
                .from("restock_notifications")
                .update({
                    status: "notified",
                    notified_at: new Date().toISOString()
                })
                .eq("id", notif.id);
        }

        return new Response(JSON.stringify({
            success: true,
            message: `Successfully notified ${notifiedCount} customer(s).`,
            count: notifiedCount
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error: any) {
        console.error("Send Restock Notification Error:", error);
        return new Response(JSON.stringify({ error: error.message || "Failed to send restock notifications" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
