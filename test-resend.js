import { execSync } from 'child_process';
import fetch from 'node-fetch'; // No es estrictamente necesario en Node.js 18+

async function test() {
  const keyOutput = execSync('npx supabase secrets get RESEND_API_KEY').toString().trim();
  console.log('Got API Key, prefix:', keyOutput.substring(0, 5));
  
  async function send(email) {
    console.log(`\nTesting with from: ${email}`);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${keyOutput}`,
      },
      body: JSON.stringify({
        from: email,
        to: ["joan.abreu2007@gmail.com"],
        subject: "Test Domain Verification",
        html: "<p>Test</p>"
      })
    });
    
    console.log(`STATUS: ${res.status}`);
    console.log(`BODY: ${await res.text()}`);
  }
  
  await send("Liv Well Research Labs <info@livwellresearchlabs.com>");
  await send("Liv Well Research Labs <sales@livwellresearchlabs.com>");
}

test();
