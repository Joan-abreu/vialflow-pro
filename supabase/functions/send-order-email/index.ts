import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { getOrderConfirmationEmail, getAdminNotificationEmail, getOrderStatusUpdateEmail } from "../_shared/email-templates.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_SALES_EMAIL = Deno.env.get("FROM_SALES_EMAIL") || "Liv Well Research Labs <sales@livwellresearchlabs.com>";

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
  type: "customer_confirmation" | "admin_notification" | "status_update" | "shipped" | "in_transit" | "out_for_delivery" | "delivered";
  status_details?: string;
  status_date?: string;
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

    const { order_id, type, status_details, status_date }: OrderEmailRequest = await req.json();

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
            vial_type:vial_types(name, capacity_ml, color, shape)
          )
        ),
        order_shipments(*)
      `)
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      console.error("Order fetch error:", orderError);
      throw new Error("Order not found");
    }

    // Resolve Customer Name
    let customerName = "Customer";
    let customerEmail = order.customer_email || "";

    if (order.user_id) {
        // Fetch full_name from profiles
        const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", order.user_id)
            .single();
        
        if (profile?.full_name) {
            customerName = profile.full_name;
        } else if (customerEmail) {
            customerName = customerEmail.split('@')[0];
        }
    } else if (customerEmail) {
        customerName = customerEmail.split('@')[0];
    }

    let emailTo: string[] = [];
    let subject = "";
    let htmlContent = "";

    // CUSTOMER CONFIRMATION
    if (type === "customer_confirmation") {
      if (!customerEmail) {
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
        customerName: customerName,
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
        customerName: customerName,
        customerEmail: customerEmail || "N/A",
        items,
        total: order.total_amount,
      });
    }

    // STATUS UPDATE (GENERIC OR SPECIFIC SHIPMENT STAGES)
    else if (type === "status_update" || type === "shipped" || type === "in_transit" || type === "out_for_delivery" || type === "delivered") {
      if (!customerEmail) {
        throw new Error("No customer email available");
      }

      emailTo = [customerEmail];
      
      // Map internal type to status wording
      const displayStatus = 
        type === "shipped" ? "Shipped" : 
        type === "in_transit" ? "In Transit" : 
        type === "out_for_delivery" ? "Out for Delivery" : 
        type === "delivered" ? "Delivered" : 
        order.status;

      subject = `Order Update #${order.id.slice(0, 8)} - ${displayStatus}`;

      // Generate Tracking URL
      let trackingUrl = undefined;
      const activeShipment = order.order_shipments?.find((s: any) => s.status !== 'cancelled' && s.tracking_url);
      
      if (activeShipment?.tracking_url) {
        trackingUrl = activeShipment.tracking_url;
      } else if (order.tracking_number) {
        // We can try to be smart about the carrier
        const carrier = order.shipping_carrier?.toLowerCase();
        if (carrier === "fedex") {
          trackingUrl = `https://www.fedex.com/fedextrack/?trknbr=${order.tracking_number}`;
        } else if (carrier === "ups") {
          trackingUrl = `https://www.ups.com/track?tracknum=${order.tracking_number}`;
        } else if (carrier === "usps") {
          trackingUrl = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${order.tracking_number}`;
        } else if (carrier === "dhl") {
          trackingUrl = `https://www.dhl.com/en/express/tracking.html?AWB=${order.tracking_number}`;
        } else {
          // Fallback to a generic tracking aggregator or just show the number
          trackingUrl = `https://www.google.com/search?q=track+${order.tracking_number}`;
        }
      }

      htmlContent = getOrderStatusUpdateEmail({
        orderNumber: order.id.slice(0, 8),
        customerName: customerName,
        status: displayStatus,
        trackingUrl,
        statusDetails: status_details,
        statusDate: status_date,
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
        from: FROM_SALES_EMAIL,
        to: emailTo,
        subject,
        html: htmlContent,
      }),
    });

    const data = await res.json();
    const status = res.ok ? "sent" : "failed";

    console.log(`[Order Email] Type: ${type}, Status: ${status}, Recipients: ${emailTo.join(", ")}`);
    console.log(`[Auth Profile] Using RESEND_API_KEY starting with: ${RESEND_API_KEY.substring(0, 7)}...`);

    if (!res.ok) {
      console.error(`[Resend Error] Payload:`, JSON.stringify(data));
      
      // Sandbox Fallback: If we can't send to customer, try to alert admin
      if (data.message?.includes("testing emails to your own email address") && !emailTo.every(r => ADMIN_EMAILS.includes(r))) {
          console.log("[Fallback] Detected Sandbox restriction. Attempting to send copy to Administrator instead.");
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: FROM_SALES_EMAIL,
              to: ADMIN_EMAILS,
              subject: `[FALLBACK] ${subject}`,
              html: `<strong>SANDBOX ALERT:</strong> Resend rejected the email to ${emailTo.join(", ")} because your domain is not fully verified or in Sandbox mode.<br/><br/>${htmlContent}`,
            }),
          });
      }
    }

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
