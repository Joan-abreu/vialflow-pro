import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;

if (!RESEND_API_KEY) {
  console.error("Missing RESEND_API_KEY in .env");
  process.exit(1);
}

const resend = new Resend(RESEND_API_KEY);

async function testResend() {
  console.log("Testing Resend with local .env key...");
  
  const { data, error } = await resend.emails.send({
    from: "sales@livwellresearchlabs.com",
    to: "joan.abreu2007@gmail.com", // User's email from logs
    subject: "🔍 Diagnostic Test",
    html: "<p>If you see this, your Resend API Key and Domain are working correctly for your verified domain.</p>"
  });

  if (error) {
    console.error("Local Test Failed:", error);
  } else {
    console.log("Local Test Success! ID:", data?.id);
  }
}

testResend();
