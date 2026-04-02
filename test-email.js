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
  console.log("Probando envío de correo a través de send-system-notification...");
  
  // Vamos a usar el tipo 'generic' que envía desde info@livwellresearchlabs.com
  const { data, error } = await supabase.functions.invoke('send-system-notification', {
    body: {
      type: "generic",
      recipient: "joan.abreu2007@gmail.com", // Puedes cambiar esto al correo a donde quieres que llegue la prueba
      data: {
        subject: "🎉 Prueba Exitosa: Notificaciones Liv Well Research",
        title: "El sistema de correos está funcionando",
        message: "¡Hola! Este es un correo de prueba generado usando tu nuevo dominio configurado y verificado en Namecheap con Resend.",
        buttonText: "Visitar la App",
        buttonUrl: "https://livwellresearchlabs.com"
      }
    }
  });

  if (error) {
    console.error("❌ Error al invocar la función:", error);
  } else {
    console.log("✅ Función ejecutada con éxito. Respuesta:", data);
    console.log("Revisa la bandeja de entrada del correo receptor.");
  }
}

testEmail();
