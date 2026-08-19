import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// --- AES-256-GCM Helpers ---
async function getCryptoKey(secret: string) {
    const enc = new TextEncoder();
    const keyData = enc.encode(secret.padEnd(32, "0").slice(0, 32));
    return await crypto.subtle.importKey("raw", keyData, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptJSON(data: any, secret: string): Promise<string> {
    const key = await getCryptoKey(secret);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(data)));
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
}

async function decryptJSON(base64Str: string, secret: string): Promise<any> {
    const key = await getCryptoKey(secret);
    const combined = Uint8Array.from(atob(base64Str), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted));
}

function detectCardBrand(number: string): string {
    const cleaned = number.replace(/\D/g, "");
    if (/^4/.test(cleaned)) return "Visa";
    if (/^5[1-5]|^2[2-7]/.test(cleaned)) return "Mastercard";
    if (/^3[47]/.test(cleaned)) return "Amex";
    if (/^6(?:011|5)/.test(cleaned)) return "Discover";
    return "Card";
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { action, orderId, cardPayload, reason } = body;

        if (!action || !orderId) {
            throw new Error("Missing required parameters: action and orderId");
        }

        // Action 1: encrypt_and_save (Called during customer checkout)
        if (action === "encrypt_and_save") {
            if (!cardPayload || !cardPayload.cardNumber) {
                throw new Error("Invalid card payload provided");
            }

            const cleanedNumber = cardPayload.cardNumber.replace(/\D/g, "");
            const last4 = cleanedNumber.slice(-4) || "0000";
            const cardBrand = detectCardBrand(cleanedNumber);

            // Encrypt card payload with AES-256-GCM
            const encryptedPayload = await encryptJSON(cardPayload, supabaseServiceRoleKey);

            // 1. Delete existing vault entry for order if retrying
            await supabase.from("pending_card_vault").delete().eq("order_id", orderId);

            // 2. Insert into pending_card_vault
            const { error: vaultErr } = await supabase.from("pending_card_vault").insert({
                order_id: orderId,
                encrypted_payload: encryptedPayload,
                card_brand: cardBrand,
                last_4: last4,
                status: "pending"
            });

            if (vaultErr) throw vaultErr;

            // 3. Update order status to pending_payment
            await supabase.from("orders").update({
                status: "pending_payment",
                payment_method: "manual_terminal",
                payment_intent_id: `VAULT-${orderId.slice(0, 8)}`,
            }).eq("id", orderId);

            // 4. Send Email 1: Order Received — Payment Processing
            const sendEmail = async (type: string) => {
                await fetch(`${supabaseUrl}/functions/v1/send-order-email`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${supabaseServiceRoleKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        order_id: orderId,
                        type: type
                    }),
                }).catch(err => console.warn("Failed sending order email:", err));
            };

            await Promise.allSettled([
                sendEmail("payment_pending"),
                sendEmail("admin_notification")
            ]);

            return new Response(JSON.stringify({
                success: true,
                status: "PENDING_MANUAL_CHARGE",
                orderId: orderId,
                message: "Card encrypted & saved to vault. Order placed in pending payment state."
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // Action 2: decrypt_for_terminal (Called by Admin Virtual Terminal Modal)
        if (action === "decrypt_for_terminal") {
            const { data: vaultEntry, error: fetchErr } = await supabase
                .from("pending_card_vault")
                .select("*")
                .eq("order_id", orderId)
                .single();

            if (fetchErr || !vaultEntry) {
                throw new Error("No vaulted card details found for this order");
            }

            if (vaultEntry.status === "processed" || vaultEntry.status === "purged" || vaultEntry.encrypted_payload.startsWith("[REDACTED")) {
                return new Response(JSON.stringify({
                    success: false,
                    isPurged: true,
                    last4: vaultEntry.last_4,
                    cardBrand: vaultEntry.card_brand,
                    message: "Card details have already been processed and redacted for PCI compliance."
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200,
                });
            }

            // Decrypt payload
            const decryptedPayload = await decryptJSON(vaultEntry.encrypted_payload, supabaseServiceRoleKey);

            return new Response(JSON.stringify({
                success: true,
                isPurged: false,
                cardBrand: vaultEntry.card_brand,
                last4: vaultEntry.last_4,
                cardDetails: decryptedPayload
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // Action 3: mark_as_processed (Admin clicks 'Mark as Successfully Charged')
        if (action === "mark_as_processed") {
            const { data: vaultEntry } = await supabase
                .from("pending_card_vault")
                .select("*")
                .eq("order_id", orderId)
                .single();

            const last4 = vaultEntry?.last_4 || "0000";
            const cardBrand = vaultEntry?.card_brand || "Card";

            // 1. Update order status to processing
            await supabase.from("orders").update({
                status: "processing",
                payment_method: "manual_terminal",
                payment_intent_id: `CHARGED-${orderId.slice(0, 8)}`,
                paid_at: new Date().toISOString()
            }).eq("id", orderId);

            // 2. Redact sensitive card info from pending_card_vault
            await supabase.from("pending_card_vault").update({
                encrypted_payload: "[REDACTED_UPON_PROCESSING]",
                status: "processed",
                processed_at: new Date().toISOString()
            }).eq("order_id", orderId);

            // 3. Trigger Email 2: Payment Confirmed & Order Approved
            await fetch(`${supabaseUrl}/functions/v1/send-order-email`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${supabaseServiceRoleKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    order_id: orderId,
                    type: "payment_confirmed",
                    card_brand: cardBrand,
                    last_4: last4
                }),
            }).catch(err => console.warn("Failed sending payment confirmed email:", err));

            return new Response(JSON.stringify({
                success: true,
                status: "PROCESSED",
                message: "Order marked as paid. Sensitive card details redacted and confirmation email sent."
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // Action 4: mark_as_declined (Admin clicks 'Decline / Reject Card')
        if (action === "mark_as_declined") {
            const declineReason = reason || "Declined by issuing bank or invalid credentials";

            // 1. Update order status to payment_failed
            await supabase.from("orders").update({
                status: "payment_failed"
            }).eq("id", orderId);

            // 2. Redact sensitive card info from vault
            await supabase.from("pending_card_vault").update({
                encrypted_payload: "[REDACTED_UPON_DECLINE]",
                status: "declined",
                decline_reason: declineReason,
                processed_at: new Date().toISOString()
            }).eq("order_id", orderId);

            // 3. Trigger Email 3: Payment Declined
            await fetch(`${supabaseUrl}/functions/v1/send-order-email`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${supabaseServiceRoleKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    order_id: orderId,
                    type: "payment_declined",
                    reason: declineReason
                }),
            }).catch(err => console.warn("Failed sending payment declined email:", err));

            return new Response(JSON.stringify({
                success: true,
                status: "DECLINED",
                message: "Order marked as declined and customer notification email triggered."
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        throw new Error(`Unsupported action: ${action}`);

    } catch (error: any) {
        console.error("Vault Card Payment Error:", error);
        return new Response(JSON.stringify({
            error: error.message || "Failed to process vault card action"
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
