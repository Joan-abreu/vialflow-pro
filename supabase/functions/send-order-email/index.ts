import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

interface OrderEmailRequest {
    order_id: string;
    type: "confirmation" | "status_update";
}

const handler = async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        if (!RESEND_API_KEY) {
            throw new Error("Missing RESEND_API_KEY");
        }

        const supabase = createClient(
            SUPABASE_URL!,
            SUPABASE_SERVICE_ROLE_KEY!
        );

        const { order_id, type }: OrderEmailRequest = await req.json();

        if (!order_id) {
            throw new Error("Missing order_id");
        }

        // Fetch order details
        const { data: order, error: orderError } = await supabase
            .from("orders")
            .select("*, order_items(*, products(*))")
            .eq("id", order_id)
            .single();

        if (orderError || !order) {
            throw new Error("Order not found");
        }

        // Fetch user email
        const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(
            order.user_id
        );

        if (userError || !user || !user.email) {
            // Try to get email from shipping address if guest (not implemented yet, assuming registered users for now)
            // Or if user fetch fails
            console.error("User not found or no email", userError);
            throw new Error("User email not found");
        }

        const emailTo = user.email;
        let subject = "";
        let htmlContent = "";

        if (type === "confirmation") {
            subject = `Order Confirmation #${order.id.slice(0, 8)}`;
            htmlContent = `
        <h1>Thank you for your order!</h1>
        <p>Your order #${order.id.slice(0, 8)} has been received.</p>
        <h2>Order Details:</h2>
        <ul>
          ${order.order_items.map((item: any) => `
            <li>
              ${item.products?.name || "Product"} x ${item.quantity} - $${item.price_at_time}
            </li>
          `).join("")}
        </ul>
        <p><strong>Total: $${order.total_amount}</strong></p>
        <p>We will notify you when your order ships.</p>
      `;
        } else if (type === "status_update") {
            subject = `Order Update #${order.id.slice(0, 8)}`;
            htmlContent = `
        <h1>Order Update</h1>
        <p>Your order #${order.id.slice(0, 8)} status has been updated to: <strong>${order.status}</strong>.</p>
        <p>Thank you for shopping with us!</p>
      `;
        } else {
            throw new Error("Invalid email type");
        }

        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: "Liv Well <onboarding@resend.dev>", // Use default Resend testing domain
                to: [emailTo],
                subject: subject,
                html: htmlContent,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            console.error("Resend API Error:", data);
            throw new Error("Failed to send email via Resend");
        }

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error: any) {
        console.error("Error sending email:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
};

serve(handler);
