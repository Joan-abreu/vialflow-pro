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
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Missing Supabase configuration in Edge Function" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { email, password, fullName, phone, redirectTo }: RegisterRequest = await req.json();

    console.log(`[Register User] Creating user: ${email}`);

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Check if email already exists in profiles (using admin client to bypass RLS)
    const { data: existingProfileEmail } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfileEmail) {
      return new Response(JSON.stringify({ error: "Email already registered. Please use a different email or sign in." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if phone number already exists in profiles
    if (phone) {
      const { data: existingProfilePhone } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();

      if (existingProfilePhone) {
        return new Response(JSON.stringify({ error: "Phone number already registered." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 2. Create the user via Admin API
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        full_name: fullName,
        phone: phone
      }
    });

    if (createError) {
      console.error("[Register User] Create Error:", createError);
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    // 3. Generate verification link
    const targetRedirect = redirectTo || `${SUPABASE_URL}/auth/v1/verify?type=signup`;
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email: email,
      options: { redirectTo: targetRedirect }
    });

    if (linkError) {
      console.error("[Register User] Link Generation Error:", linkError);
      return new Response(JSON.stringify({ error: linkError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Send email via Resend if RESEND_API_KEY is configured
    let resData = null;
    if (RESEND_API_KEY) {
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

      resData = await res.json();
      const status = res.ok ? "sent" : "failed";

      // Log to email_logs
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
        console.warn("[Register User] Resend Error:", resData);
      }
    } else {
      console.warn("[Register User] RESEND_API_KEY not configured, skipped sending confirmation email.");
    }

    return new Response(JSON.stringify({ success: true, userId, resData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[Register User] Fatal Error:", error);
    return new Response(JSON.stringify({ error: error.message || "An unexpected error occurred during registration" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
