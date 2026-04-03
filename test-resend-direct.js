import dotenv from "dotenv";

dotenv.config();

const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;

if (!RESEND_API_KEY) {
  console.error("Missing RESEND_API_KEY in .env");
  process.exit(1);
}

async function testResend() {
  console.log("Testing Resend API via direct fetch...");
  console.log("Using Key starting with:", RESEND_API_KEY.substring(0, 7));

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "sales@livwellresearchlabs.com",
        to: "joan.abreu2007@gmail.com",
        subject: "🔍 Direct API Test",
        html: "<p>Testing domain verification via direct API call.</p>",
      }),
    });

    const data = await res.json();
    console.log("Response Status:", res.status);
    console.log("Response Data:", JSON.stringify(data, null, 2));

    if (res.ok) {
      console.log("SUCCESS: The API key and domain are working correctly.");
    } else {
      console.log("FAILURE: Resend rejected the request.");
    }
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}

testResend();
