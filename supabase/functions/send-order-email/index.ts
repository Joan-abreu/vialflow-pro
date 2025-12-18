import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { getOrderConfirmationEmail, getAdminNotificationEmail, getOrderStatusUpdateEmail } from "../_shared/email-templates.ts";

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
    // Auth Check
    // Auth Check
    const authHeader = req.headers.get("Authorization");
    const isServiceKey = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;

    console.log(`[Auth Debug] Header Present: ${!!authHeader}`);
    console.log(`[Auth Debug] Is Service Key: ${isServiceKey}`);

    if (!isServiceKey) {
      if (!authHeader) {
        console.error("[Auth Error] Missing Authorization header");
        return new Response(JSON.stringify({ error: "Unauthorized - Missing Header" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Create a client with the incoming auth header to verify the user
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
      console.log(`[Auth Debug] Using Anon Key: ${!!anonKey}`);

      const supabaseAuth = createClient(
        SUPABASE_URL!,
        anonKey,
        { global: { headers: { Authorization: authHeader } } }
      );

      // Extract the token to pass explicitly to getUser
      const token = authHeader.replace(/^Bearer\s+/i, "");
      const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);

      console.log(`[Auth Debug] getUser result: ${user?.id ? 'Success' : 'Failure'}`);

      if (userError || !user) {
        console.error("[Auth Error] User validation failed:", userError);
        return new Response(JSON.stringify({ error: "Unauthorized", details: userError }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
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

      // Prepare order data for template
      const items = order.order_items.map((item: any) => ({
        name: `${item.variant?.product?.name || "Product"} - ${item.variant?.vial_type?.name || ""}`,
        quantity: item.quantity,
        price: item.quantity * item.price_at_time
      }));

      htmlContent = getOrderConfirmationEmail({
        orderNumber: order.id.slice(0, 8),
        customerName: customerEmail.split('@')[0], // Use email username as fallback
        items,
        subtotal: order.total_amount - (order.shipping_cost || 0),
        shipping: order.shipping_cost || 0,
        total: order.total_amount,
      });
    }

    // ADMIN NOTIFICATION
    else if (type === "admin_notification") {
      emailTo = ADMIN_EMAILS;

      if (!emailTo.length) {
        throw new Error("No admin emails configured");
      }

      subject = `🎉 New Order Received #${order.id.slice(0, 8)}`;

      // Prepare order data for template
      const items = order.order_items.map((item: any) => ({
        name: `${item.variant?.product?.name || "Product"} - ${item.variant?.vial_type?.name || ""}`,
        quantity: item.quantity,
        price: item.quantity * item.price_at_time
      }));

      htmlContent = getAdminNotificationEmail({
        orderNumber: order.id.slice(0, 8),
        customerName: order.customer_email?.split('@')[0] || "Customer",
        customerEmail: order.customer_email || "N/A",
        items,
        total: order.total_amount,
      });
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

      // Generate Tracking URL
      let trackingUrl = undefined;
      if (order.tracking_number) {
        // Default to FedEx, but could check order.shipping_carrier
        trackingUrl = `https://www.fedex.com/fedextrack/?trknbr=${order.tracking_number}`;
      }

      htmlContent = getOrderStatusUpdateEmail({
        orderNumber: order.id.slice(0, 8),
        customerName: customerEmail.split('@')[0],
        status: order.status,
        trackingUrl,
      });
    }

    // Send using Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Liv Well Research Labs <onboarding@resend.dev>",
        to: emailTo,
        subject,
        html: htmlContent,
      }),
    });

    const data = await res.json();
    const status = res.ok ? "sent" : "failed";

    // Log to email_logs table
    const { error: logError } = await supabase
      .from("email_logs")
      .insert({
        recipient: emailTo.join(", "),
        subject,
        content: htmlContent,
        status,
        type,
        related_id: order.id,
        metadata: { resend_response: data }
      });

    if (logError) {
      console.error("Error logging email:", logError);
    }

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
