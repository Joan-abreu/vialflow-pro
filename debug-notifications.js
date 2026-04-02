import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Error: Missing env vars (VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY)");
  console.log("Please add VITE_SUPABASE_SERVICE_ROLE_KEY to your .env file temporarily to run this script.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkRecentLogs() {
  console.log("\n--- RECENT EMAIL NOTIFICATION LOGS ---\n");
  
  const { data, error } = await supabase
    .from('email_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (error) {
    console.error("Database query error:", error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log("No logs found in the last 10 entries.");
    return;
  }

  data.forEach((log, index) => {
    const resendResponse = log.metadata?.resend_response;
    const errorMessage = resendResponse?.message || resendResponse?.error?.message || "None";
    
    console.log(`[${index + 1}] ${log.created_at}`);
    console.log(`    Recipients: ${log.recipient}`);
    console.log(`    Type:       ${log.type}`);
    console.log(`    Status:     ${log.status.toUpperCase()}`);
    console.log(`    Resend Msg: ${errorMessage}`);
    console.log(`    Subject:    ${log.subject}`);
    console.log('------------------------------------------');
  });
}

checkRecentLogs();
