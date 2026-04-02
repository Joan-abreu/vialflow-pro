import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY; // Fallback para probar

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Faltan variables de entorno (VITE_SUPABASE_URL o VITE_SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testEmail() {
  console.log("Probando envío de correo...");
  
  const { data: orderData } = await supabase.from('orders').select('id').limit(1).single();
  const orderId = orderData ? orderData.id : "missing-order-id";
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-system-notification`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: "order_confirmation",
      data: { order_id: orderId },
      related_id: orderId
    })
  });

  const text = await response.text();
  console.log(`STATUS: ${response.status}`);
  console.log(`BODY: ${text}`);
}

testEmail();
