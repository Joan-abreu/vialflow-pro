import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { getSignupConfirmationEmail } from "../_shared/email-templates.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "info@livwellresearchlabs.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RegisterRequest {
  email: string;
  password?: string;
  fullName: string;
  phone: string;
  redirectTo?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing Supabase configuration");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { email, password, fullName, phone, redirectTo }: RegisterRequest = await req.json();

    console.log(`[Register User] Creating user: ${email}`);

    // 1. Check if user already exists (optional check)
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    if (existingUser?.users.some(u => u.email?.toLowerCase() === email?.trim().toLowerCase())) {
        return new Response(JSON.stringify({ 
            error: "This email address is already registered. Please sign in or use a different email.",
            code: "email_exists"
        }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // 2. Create the user via Admin API (This bypasses the internal Supabase SMTP limits)
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // We'll send the confirmation link ourselves
      user_metadata: {
        full_name: fullName,
        phone: phone
      }
    });

    if (createError) {
      console.error("[Register User] Create Error:", createError);
      const isEmailExists = 
        createError?.code === "email_exists" ||
        createError?.message?.toLowerCase().includes("already been registered") ||
        createError?.message?.toLowerCase().includes("already registered") ||
        createError?.message?.toLowerCase().includes("user already exists");

      if (isEmailExists) {
        return new Response(JSON.stringify({ 
          error: "This email address is already registered. Please sign in or use a different email.",
          code: "email_exists" 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw createError;
    }

    const userId = userData.user.id;

    // 3. Generate the verification link
    const targetRedirect = redirectTo || `${SUPABASE_URL}/auth/v1/verify?type=signup`;
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email: email,
      options: { redirectTo: targetRedirect }
    });

    if (linkError) {
      console.error("[Register User] Link Generation Error:", linkError);
      throw linkError;
    }

    // 4. Send the verification email via Resend
    const subject = `Confirm Your Email - Liv Well Research Labs`;
    const htmlContent = getSignupConfirmationEmail({
      confirmationUrl: linkData.properties.action_link
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject,
        html: htmlContent,
      }),
    });

    const resData = await res.json();
    const status = res.ok ? "sent" : "failed";

    // 5. Log to email_logs
    await supabase.from("email_logs").insert({
      recipient: email,
      subject,
      content: htmlContent,
      status,
      type: "signup_confirmation",
      related_id: userId,
      metadata: { resend_response: resData, registration_data: { fullName, phone } }
    });

    if (!res.ok) {
        console.error("[Register User] Resend Error:", resData);
        // We still return success for creation, but warn about email
        return new Response(JSON.stringify({ 
            success: true, 
            message: "User created but error sending email", 
            userId,
            resData 
        }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ success: true, userId, resData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[Register User] Fatal Error:", error);
    const isEmailExists = 
      error?.code === "email_exists" ||
      error?.message?.toLowerCase().includes("already been registered") ||
      error?.message?.toLowerCase().includes("already registered") ||
      error?.message?.toLowerCase().includes("user already exists");

    const message = isEmailExists
      ? "This email address is already registered. Please sign in or use a different email."
      : (error?.message || "An error occurred during registration");

    return new Response(JSON.stringify({ 
      error: message, 
      code: isEmailExists ? "email_exists" : error?.code 
    }), {
      status: isEmailExists ? 400 : (error?.status && error.status >= 400 && error.status < 600 ? error.status : 400),
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
