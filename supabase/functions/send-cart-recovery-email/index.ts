import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
        const fromEmail = Deno.env.get("FROM_SALES_EMAIL") || "Liv Well Research Labs <sales@livwellresearchlabs.com>";
        const siteDomain = Deno.env.get("DOMAIN") || "https://livwellresearchlabs.com";

        const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

        const { cart_session_id } = await req.json();
        if (!cart_session_id) {
            return new Response(JSON.stringify({ error: "cart_session_id is required" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            });
        }

        // 1. Fetch cart session
        const { data: cart, error: cErr } = await supabase
            .from("cart_sessions")
            .select("*")
            .eq("id", cart_session_id)
            .single();

        if (cErr || !cart) {
            throw new Error(`Cart session not found: ${cErr?.message || ""}`);
        }

        if (!cart.email) {
            throw new Error("No customer email associated with this cart session.");
        }

        // 2. Fetch recovery settings from app_settings
        const { data: settings } = await supabase
            .from("app_settings")
            .select("key, value")
            .in("key", [
                "recovery_email_subject",
                "recovery_email_custom_message",
                "recovery_discount_enabled",
                "recovery_discount_coupon_code",
                "recovery_discount_percentage"
            ]);

        let subject = "Did you forget something in your cart?";
        let customMessage = "We saved the items in your cart so you can easily complete your order whenever you are ready.";
        let discountEnabled = false;
        let couponCode = "COMEBACK10";
        let discountPercentage = "10";

        if (settings && Array.isArray(settings)) {
            settings.forEach((s: any) => {
                if (s.key === "recovery_email_subject" && s.value) subject = s.value;
                if (s.key === "recovery_email_custom_message" && s.value) customMessage = s.value;
                if (s.key === "recovery_discount_enabled") discountEnabled = s.value === "true";
                if (s.key === "recovery_discount_coupon_code" && s.value) couponCode = s.value;
                if (s.key === "recovery_discount_percentage" && s.value) discountPercentage = s.value;
            });
        }

        const recoveryUrl = `${siteDomain}/cart?recover=${cart.recovery_token}${discountEnabled ? `&ref=${couponCode}` : ''}`;
        const itemsList = (cart.items || []) as any[];

        // 3. Build HTML items table
        const itemsHtml = itemsList.map((item: any) => {
            const productName = item.variant?.product?.name || "Research Product";
            const vialName = item.variant?.vial_type?.name || `${item.variant?.vial_type?.capacity_ml || 10}ml`;
            const packSize = item.variant?.pack_size > 1 ? ` (${item.variant.pack_size}x Pack)` : '';
            const price = ((Number(item.variant?.price) || 0) * (Number(item.quantity) || 1)).toFixed(2);
            const imageUrl = item.variant?.image_url || item.variant?.product?.image_url || "";

            return `
                <tr>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; vertical-align: middle;">
                        ${imageUrl ? `<img src="${imageUrl}" alt="${productName}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1; display: inline-block; vertical-align: middle; margin-right: 12px;" />` : ''}
                        <div style="display: inline-block; vertical-align: middle;">
                            <strong style="color: #0f172a; font-size: 14px;">${productName}</strong><br />
                            <span style="color: #64748b; font-size: 12px;">${vialName}${packSize} &bull; Qty: ${item.quantity}</span>
                        </div>
                    </td>
                    <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #0f172a; vertical-align: middle;">
                        $${price} USD
                    </td>
                </tr>
            `;
        }).join("");

        // 4. Build Complete Email HTML
        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #334155; margin: 0; padding: 0; background-color: #f8fafc; }
                    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
                    .header { background: #0f172a; color: #ffffff; padding: 28px; text-align: center; }
                    .header h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; }
                    .content { padding: 32px 28px; }
                    .btn { display: block; width: 100%; box-sizing: border-box; text-align: center; background: #2563eb; color: #ffffff !important; padding: 14px 20px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 24px 0; }
                    .discount-box { background: #ecfdf5; border: 1px dashed #10b981; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0; }
                    .footer { padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; background: #f8fafc; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Liv Well Research Labs</h1>
                    </div>
                    <div class="content">
                        <h2 style="color: #0f172a; font-size: 18px; margin-top: 0;">${subject}</h2>
                        <p style="color: #475569; font-size: 14px;">
                            ${cart.customer_name ? `Hi ${cart.customer_name},` : 'Hello,'}
                        </p>
                        <p style="color: #475569; font-size: 14px;">
                            ${customMessage}
                        </p>

                        ${discountEnabled ? `
                            <div class="discount-box">
                                <span style="font-size: 12px; font-weight: bold; color: #065f46; text-transform: uppercase; letter-spacing: 1px;">Exclusive Promo Code</span>
                                <div style="font-size: 22px; font-weight: 900; color: #047857; margin: 6px 0; font-family: monospace;">${couponCode}</div>
                                <span style="font-size: 13px; color: #065f46;">Use this code to get <strong>${discountPercentage}% OFF</strong> your reserved order!</span>
                            </div>
                        ` : ''}

                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <thead>
                                <tr style="background: #f1f5f9;">
                                    <th style="padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #475569;">Items Reserved</th>
                                    <th style="padding: 10px 12px; text-align: right; font-size: 12px; text-transform: uppercase; color: #475569;">Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHtml}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td style="padding: 14px 12px; font-weight: bold; color: #0f172a; font-size: 15px;">Subtotal:</td>
                                    <td style="padding: 14px 12px; text-align: right; font-weight: 900; color: #2563eb; font-size: 16px;">$${(Number(cart.subtotal) || 0).toFixed(2)} USD</td>
                                </tr>
                            </tfoot>
                        </table>

                        <a href="${recoveryUrl}" class="btn">
                            Restore Cart & Complete Order &rarr;
                        </a>

                        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 16px;">
                            If you have any questions or need specialized research assistance, simply reply directly to this email.
                        </p>
                    </div>
                    <div class="footer">
                        &copy; ${new Date().getFullYear()} Liv Well Research Labs. All items strictly for laboratory & research use only.
                    </div>
                </div>
            </body>
            </html>
        `;

        // 5. Send via Resend API if API Key is configured
        let resendStatus = "mocked";
        if (resendApiKey) {
            const resendResp = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${resendApiKey}`,
                },
                body: JSON.stringify({
                    from: fromEmail,
                    to: [cart.email],
                    subject: subject,
                    html: emailHtml,
                }),
            });

            const resendResult = await resendResp.json();
            if (!resendResp.ok) {
                console.error("Resend API error:", resendResult);
                throw new Error(resendResult.message || "Failed to send email via Resend");
            }
            resendStatus = "sent";
        } else {
            console.warn("RESEND_API_KEY is not set. Email logged without external SMTP dispatch.");
        }

        // 6. Update cart session tracking
        await supabase
            .from("cart_sessions")
            .update({
                recovery_email_sent_count: (cart.recovery_email_sent_count || 0) + 1,
                last_recovery_email_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", cart.id);

        // 7. Log email communication in email_logs
        await supabase
            .from("email_logs")
            .insert({
                recipient: cart.email,
                subject: subject,
                content: emailHtml,
                status: "sent",
                type: "abandoned_cart_recovery",
                metadata: {
                    cart_session_id: cart.id,
                    subtotal: cart.subtotal,
                    items_count: itemsList.length,
                    coupon_applied: discountEnabled ? couponCode : null,
                }
            });

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Recovery email sent to ${cart.email}`,
            status: resendStatus 
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (err: any) {
        console.error("send-cart-recovery-email error:", err);
        return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
