import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { 
    getOrderConfirmationEmail, 
    getAdminNotificationEmail, 
    getOrderStatusUpdateEmail,
    getLowStockAlertEmail,
    getUserInvitationEmail,
    getGenericNotificationEmail,
    getContactFormEmail
} from "../_shared/email-templates.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "info@livwellresearchlabs.com";
const FROM_SALES_EMAIL = Deno.env.get("FROM_SALES_EMAIL") || "sales@livwellresearchlabs.com";

const ADMIN_EMAILS = Deno.env.get("ADMIN_EMAILS")
  ?.split(",")
  .map((email) => email.trim())
  .filter(Boolean) || [];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: "order_confirmation" | "order_status_update" | "admin_order_notification" | "low_stock_alert" | "user_invitation" | "password_reset" | "generic" | "contact_form";
  recipient: string | string[];
  data: any;
  related_id?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { type, recipient, data, related_id }: NotificationRequest = await req.json();

    let subject = "";
    let htmlContent = "";
    let finalRecipients = Array.isArray(recipient) ? recipient : [recipient];

    const formatAddress = (address: any) => {
        if (!address) return "N/A";
        if (typeof address === 'string') return address;
        
        // Handle common address object structures (Stripe/Square/Internal)
        const addr = address.address || address; // Handle nested 'address' property if exists
        const line1 = addr.line1 || addr.addressLine1 || addr.street_address || "";
        const line2 = addr.line2 || addr.addressLine2 || "";
        const city = addr.city || addr.locality || "";
        const state = addr.state || addr.administrative_area || addr.region || "";
        const zip = addr.postal_code || addr.postalCode || addr.zip || "";
        const country = addr.country || "";

        const parts = [
            line1,
            line2,
            `${city}${city && state ? ', ' : ''}${state} ${zip}`,
            country
        ].filter(p => p && p.trim() !== "");
        
        return parts.length > 0 ? parts.join('<br>') : JSON.stringify(address);
    };

    switch (type) {
        case "order_confirmation":
        case "order_status_update":
        case "admin_order_notification": {
            const orderId = data.order_id;
            if (!orderId) throw new Error("Missing order_id in data");

            // Fetch full order details
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
            )
          `)
                .eq("id", orderId)
                .single();

            if (orderError) throw new Error(`Error fetching order ${orderId}: ${JSON.stringify(orderError)}`);
            if (!order) throw new Error(`Order ${orderId} not found`);

            const orderNumber = order.id.slice(0, 8);
            const customerEmail = order.customer_email || (order.user_id ? (await supabase.auth.admin.getUserById(order.user_id)).data.user?.email : null);

            const items = order.order_items.map((item: any) => ({
                name: `${item.variant?.product?.name || "Product"} - ${item.variant?.vial_type?.name || ""}`,
                quantity: item.quantity,
                price: item.quantity * item.price_at_time
            }));

            if (type === "order_confirmation") {
                if (!customerEmail) {
                    console.error(`[Notification Error] No customer email found for order ${orderId}`);
                    throw new Error("No customer email available to send confirmation");
                }

                subject = `Order Confirmation #${orderNumber}`;
                htmlContent = getOrderConfirmationEmail({
                    orderNumber,
                    customerName: customerEmail.split('@')[0] || "Customer",
                    items,
                    subtotal: order.total_amount - (order.shipping_cost || 0),
                    shipping: order.shipping_cost || 0,
                    total: order.total_amount,
                });
                finalRecipients = [customerEmail];
            } else if (type === "order_status_update") {
                subject = `Order Update #${orderNumber} - ${order.status.toUpperCase()}`;
                const trackingUrl = order.tracking_number ? `https://www.fedex.com/fedextrack/?trknbr=${order.tracking_number}` : undefined;
                htmlContent = getOrderStatusUpdateEmail({
                    orderNumber,
                    customerName: customerEmail?.split('@')[0] || "Customer",
                    status: order.status,
                    trackingUrl,
                });
                finalRecipients = [customerEmail!];
            } else if (type === "admin_order_notification") {
                subject = `🎉 New Order Received #${orderNumber}`;
                htmlContent = getAdminNotificationEmail({
                    orderNumber,
                    customerName: customerEmail?.split('@')[0] || "Customer",
                    customerEmail: customerEmail || "N/A",
                    items,
                    total: order.total_amount,
                    shippingAddress: formatAddress(order.shipping_address),
                    shippingCost: order.shipping_cost,
                    shippingCarrier: order.shipping_carrier,
                    shippingService: order.shipping_service
                });
                finalRecipients = ADMIN_EMAILS;
            }
            break;
        }
      case "low_stock_alert":
        subject = `⚠️ Low Stock Alert: ${data.productName}`;
        htmlContent = getLowStockAlertEmail(data);
        finalRecipients = ADMIN_EMAILS;
        break;
      case "user_invitation":
        subject = `You've been invited to join the team`;
        htmlContent = getUserInvitationEmail(data);
        break;
      case "password_reset": {
        const targetRedirect = data.redirectTo || `${SUPABASE_URL}/auth/v1/verify?type=recovery`;
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
          type: 'recovery',
          email: finalRecipients[0],
          options: { redirectTo: targetRedirect }
        });
        
        if (linkError) {
            console.error(`[Link Generation Error] Redirecting to: ${targetRedirect}`, linkError);
            throw linkError;
        }

        console.log(`[Notification Engine] Generated Recovery Link for ${finalRecipients[0]}`);
        console.log(`[Notification Engine] Redirect URL requested: ${targetRedirect}`);
        console.log(`[Notification Engine] Action Link delivered to user: ${linkData.properties.action_link}`);
        
        subject = `Reset Your Password`;
        htmlContent = getGenericNotificationEmail({
            title: "Reset Your Password",
            message: "We received a request to reset your password for your account at Liv Well Research Labs.\n\nClick the button below to choose a new password. This link will expire in 60 minutes.",
            buttonText: "Reset Password",
            buttonUrl: linkData.properties.action_link
        });
        break;
      }
      case "generic":
        subject = data.subject || "System Notification";
        htmlContent = getGenericNotificationEmail(data);
        break;
      case "contact_form":
        subject = `New Web Inquiry: ${data.subject}`;
        htmlContent = getContactFormEmail(data);
        // Send to sales and admins
        finalRecipients = ["sales@livwellresearchlabs.com", ...ADMIN_EMAILS];
        break;
      default:
        throw new Error(`Invalid notification type: ${type}`);
    }

    let fromEmail = FROM_EMAIL;
    if (["order_confirmation", "order_status_update", "admin_order_notification"].includes(type)) {
      fromEmail = FROM_SALES_EMAIL;
    }

    // Send using Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: finalRecipients,
        subject,
        html: htmlContent,
      }),
    });

    const resData = await res.json();
    const status = res.ok ? "sent" : "failed";

    console.log(`[Notification Engine] Type: ${type}, Status: ${status}, Recipients: ${finalRecipients.join(", ")}`);
    console.log(`[Auth Profile] Using RESEND_API_KEY starting with: ${RESEND_API_KEY.substring(0, 7)}...`);
    
    if (!res.ok) {
      console.error(`[Resend Error] Payload:`, JSON.stringify(resData));
      
      // Sandbox Fallback: If we can't send to customer, try to alert admin
      if (resData.message?.includes("testing emails to your own email address") && !finalRecipients.every(r => ADMIN_EMAILS.includes(r))) {
          console.log("[Fallback] Detected Sandbox restriction. Attempting to send copy to Administrator instead.");
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: fromEmail,
              to: ADMIN_EMAILS,
              subject: `[FALLBACK] ${subject}`,
              html: `<strong>SANDBOX ALERT:</strong> Resend rejected the email to ${finalRecipients.join(", ")} because your domain is not fully verified or in Sandbox mode.<br/><br/>${htmlContent}`,
            }),
          });
      }
    }

    // Log to email_logs
    await supabase.from("email_logs").insert({
      recipient: finalRecipients.join(", "),
      subject,
      content: htmlContent,
      status,
      type,
      related_id,
      metadata: { resend_response: resData, event_data: data }
    });

    if (!res.ok) throw new Error(`Resend API Error: ${JSON.stringify(resData)}`);

    return new Response(JSON.stringify({ success: true, resData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Notification Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
