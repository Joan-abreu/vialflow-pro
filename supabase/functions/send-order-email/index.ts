import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// Multiple admins supported (comma-separated list in .env)
const ADMIN_EMAILS = Deno.env.get("ADMIN_EMAILS")
  ?.split(",")
  .map((email) => email.trim())
  .filter(Boolean) || [];

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const DOMAIN = Deno.env.get("DOMAIN");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface OrderEmailRequest {
  order_id: string;
  type: "customer_confirmation" | "admin_notification" | "status_update";
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("Missing RESEND_API_KEY");
    }

    // Manual Auth Check
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!
    );

    const { order_id, type }: OrderEmailRequest = await req.json();

    if (!order_id) {
      throw new Error("Missing order_id");
    }

    // Fetch order details with variants
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        *,
        order_items(
          *,
          variant:product_variants(
            *,
            product:products(name),
            vial_type:vial_types(name, size_ml)
          )
        )
      `)
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      console.error("Order fetch error:", orderError);
      throw new Error("Order not found");
    }

    let emailTo: string[] = [];
    let subject = "";
    let htmlContent = "";

    // CUSTOMER CONFIRMATION
    if (type === "customer_confirmation") {
      let customerEmail = "";

      if (order.customer_email) {
        customerEmail = order.customer_email;
      } else if (order.user_id) {
        const { data: { user }, error: userError } =
          await supabase.auth.admin.getUserById(order.user_id);

        if (userError || !user?.email) {
          console.error("User fetch error:", userError);
          throw new Error("Customer email not found");
        }
        customerEmail = user.email;
      } else {
        throw new Error("No customer email available");
      }

      emailTo = [customerEmail];
      subject = `Order Confirmation #${order.id.slice(0, 8)}`;
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 20px; background: #f9f9f9; border-radius: 0 0 8px 8px; }
            .order-item { padding: 10px; border-bottom: 1px solid #ddd; }
            .total { font-size: 1.2em; font-weight: bold; margin-top: 20px; padding: 15px; background: white; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Thank You for Your Order!</h1>
            </div>
            <div class="content">
              <p>Order #${order.id.slice(0, 8)} has been received and is being processed.</p>
              <p><strong>Order Date:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
              <p><strong>Status:</strong> ${order.status}</p>

              <h2>Order Items:</h2>
              ${order.order_items.map((item: any) => `
                <div class="order-item">
                  <strong>${item.variant?.product?.name || "Product"}</strong> - ${item.variant?.vial_type?.name || ""}
                  <br>
                  Quantity: ${item.quantity} × $${item.price_at_time} = $${(item.quantity * item.price_at_time).toFixed(2)}
                </div>
              `).join("")}

              <div class="total">
                Total: $${order.total_amount}
              </div>

              <p style="margin-top: 20px;">We will notify you when your order ships.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    // ADMIN NOTIFICATION
    else if (type === "admin_notification") {
      emailTo = ADMIN_EMAILS;

      if (!emailTo.length) {
        throw new Error("No admin emails configured");
      }

      subject = `🎉 New Order Received #${order.id.slice(0, 8)}`;
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #059669; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 20px; background: #f9f9f9; border-radius: 0 0 8px 8px; }
            .order-item { padding: 10px; border-bottom: 1px solid #ddd; background: white; margin: 5px 0; border-radius: 4px; }
            .alert { background: #FEF3C7; padding: 15px; border-left: 4px solid #F59E0B; margin: 20px 0; border-radius: 4px; }
            .button { background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 New Order Received!</h1>
            </div>
            <div class="content">
              <div class="alert">
                <strong>⚡ Action Required:</strong> A new customer order needs to be processed.
              </div>

              <p><strong>Order ID:</strong> ${order.id}</p>
              <p><strong>Order Number:</strong> #${order.id.slice(0, 8)}</p>
              <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
              <p><strong>Customer Email:</strong> ${order.customer_email || "N/A"}</p>
              <p><strong>Status:</strong> ${order.status}</p>

              <h2>Order Items:</h2>
              ${order.order_items.map((item: any) => `
                <div class="order-item">
                  <strong>${item.variant?.product?.name || "Product"}</strong> - ${item.variant?.vial_type?.name || ""}
                  <br>
                  Quantity: ${item.quantity} × $${item.price_at_time} = $${(item.quantity * item.price_at_time).toFixed(2)}
                </div>
              `).join("")}

              <p style="font-size: 1.2em; font-weight: bold; margin-top: 20px; padding: 15px; background: white; border-radius: 4px;">
                💰 Total Amount: $${order.total_amount}
              </p>

              <p style="margin-top: 20px;">
                <a href="${DOMAIN}/manufacturing/orders" class="button">
                  View Order in Dashboard →
                </a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    // STATUS UPDATE
    else if (type === "status_update") {
      let customerEmail = "";

      if (order.customer_email) {
        customerEmail = order.customer_email;
      } else if (order.user_id) {
        const { data: { user }, error: userError } =
          await supabase.auth.admin.getUserById(order.user_id);

        if (userError || !user?.email) {
          console.error("User fetch error:", userError);
          throw new Error("Customer email not found");
        }
        customerEmail = user.email;
      } else {
        throw new Error("No customer email available");
      }

      emailTo = [customerEmail];
      subject = `Order Update #${order.id.slice(0, 8)}`;
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 20px; background: #f9f9f9; border-radius: 0 0 8px 8px; }
            .status { background: #D1FAE5; color: #059669; padding: 15px; border-radius: 4px; font-size: 1.1em; font-weight: bold; text-align: center; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Order Status Update</h1>
            </div>
            <div class="content">
              <p>Your order #${order.id.slice(0, 8)} status has been updated.</p>
              <div class="status">
                New Status: ${order.status.toUpperCase()}
              </div>
              <p>Thank you for your patience!</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    // Send using Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "VialFlow Pro <onboarding@resend.dev>",
        to: emailTo,
        subject,
        html: htmlContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend API Error:", data);
      throw new Error("Failed to send email via Resend");
    }

    return new Response(JSON.stringify({ success: true, data }), {
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
