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

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { action, orderId, p2pProvider, p2pSenderHandle, declaredAmount, proofFileHash, proofFileBase64, proofFileName, reason, actorId } = body;

        if (!action || !orderId) {
            throw new Error("Missing required parameters: action and orderId");
        }

        // Fetch Order
        const { data: order, error: orderErr } = await supabase
            .from("orders")
            .select("*")
            .eq("id", orderId)
            .single();

        if (orderErr || !order) {
            throw new Error("Order not found");
        }

        // ACTION 1: submit_proof (Customer uploads payment proof)
        if (action === "submit_proof") {
            if (!proofFileHash || !proofFileBase64) {
                throw new Error("Missing proof file or file hash");
            }

            // Anti-Fraud 1: Check duplicate hash for same provider
            if (p2pProvider) {
                const { data: existingDup } = await supabase
                    .from("orders")
                    .select("id, id")
                    .eq("p2p_provider", p2pProvider)
                    .eq("p2p_proof_file_hash", proofFileHash)
                    .neq("id", orderId)
                    .maybeSingle();

                if (existingDup) {
                    return new Response(JSON.stringify({
                        error: "This payment receipt image has already been submitted for another order. Please provide a valid receipt."
                    }), {
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                        status: 400
                    });
                }
            }

            // Decode base64 file and upload to private payment-receipts bucket
            const base64Data = proofFileBase64.replace(/^data:[^;]+;base64,/, "");
            const fileBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            const ext = (proofFileName || "receipt.png").split('.').pop() || 'png';
            const storagePath = `${orderId}/${Date.now()}_receipt.${ext}`;

            // Ensure payment-receipts bucket exists
            try {
                await supabase.storage.createBucket("payment-receipts", { public: false });
            } catch (_) {}

            const { error: uploadErr } = await supabase.storage
                .from("payment-receipts")
                .upload(storagePath, fileBytes, {
                    contentType: ext === 'pdf' ? 'application/pdf' : `image/${ext}`,
                    upsert: true
                });

            if (uploadErr) {
                console.error("Storage upload error:", uploadErr);
                throw new Error(`Storage upload failed: ${uploadErr.message || JSON.stringify(uploadErr)}`);
            }


            const currentSubmissions = Number(order.p2p_submission_count || 0) + 1;

            // Update order
            const { error: updateErr } = await supabase.from("orders").update({
                p2p_provider: p2pProvider || order.p2p_provider || "manual",
                p2p_sender_handle: p2pSenderHandle || null,
                p2p_proof_url: storagePath,
                p2p_proof_file_hash: proofFileHash,
                p2p_declared_amount: declaredAmount ? Number(declaredAmount) : null,
                p2p_status: "pending_verification",
                p2p_submission_count: currentSubmissions,
                status: "pending_payment"
            }).eq("id", orderId);

            if (updateErr) throw updateErr;

            // Log Audit Entry
            await supabase.from("p2p_verification_log").insert({
                order_id: orderId,
                action: "submitted",
                actor_id: actorId || null,
                reason: `Customer submitted proof of payment (Amount: $${declaredAmount || order.total_amount})`
            });

            // Trigger Admin Email Alert
            await fetch(`${supabaseUrl}/functions/v1/send-system-notification`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${supabaseServiceRoleKey}`,
                    "apikey": supabaseServiceRoleKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    type: "admin_order_notification",
                    data: { order_id: orderId },
                    related_id: orderId
                }),
            }).catch(err => console.warn("Failed triggering admin receipt alert:", err));


            return new Response(JSON.stringify({
                success: true,
                p2p_status: "pending_verification",
                message: "Payment proof uploaded successfully and queued for admin verification."
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200
            });
        }

        // ACTION 2: get_signed_receipt_url (Admin views proof image)
        if (action === "get_signed_receipt_url") {
            if (!order.p2p_proof_url) {
                return new Response(JSON.stringify({
                    success: false,
                    message: "No proof image uploaded for this order"
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200
                });
            }

            const { data: signedData, error: signedErr } = await supabase.storage
                .from("payment-receipts")
                .createSignedUrl(order.p2p_proof_url, 3600); // 1 hour expiry

            if (signedErr || !signedData?.signedUrl) {
                throw new Error("Failed to generate secure signed URL for payment receipt");
            }

            return new Response(JSON.stringify({
                success: true,
                signedUrl: signedData.signedUrl,
                expiresInSeconds: 3600
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200
            });
        }

        // ACTION 3: approve (Admin confirms P2P payment received)
        if (action === "approve") {
            let validActorId: string | null = null;
            if (actorId && typeof actorId === "string" && actorId.length > 20) {
                // Check if actorId is valid UUID
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actorId);
                if (isUuid) validActorId = actorId;
            }

            // Update order status to processing
            let { error: updateErr } = await supabase.from("orders").update({
                status: "processing",
                p2p_status: "verified",
                p2p_verified_at: new Date().toISOString(),
                p2p_verified_by: validActorId,
                paid_at: new Date().toISOString()
            }).eq("id", orderId);

            if (updateErr) {
                console.warn("Order approve update with verified_by failed, retrying without FK:", updateErr);
                const retryRes = await supabase.from("orders").update({
                    status: "processing",
                    p2p_status: "verified",
                    p2p_verified_at: new Date().toISOString(),
                    paid_at: new Date().toISOString()
                }).eq("id", orderId);

                if (retryRes.error) {
                    console.error("Order approve retry failed:", retryRes.error);
                    throw new Error(`Failed to update order status in DB: ${retryRes.error.message}`);
                }
            }

            // Log Audit Entry
            await supabase.from("p2p_verification_log").insert({
                order_id: orderId,
                action: "approved",
                actor_id: validActorId,
                reason: "Payment verified & approved by admin"
            }).catch(e => console.warn("Audit log insert warning:", e));

            // Trigger Email 2: Payment Confirmed & Order Approved
            await fetch(`${supabaseUrl}/functions/v1/send-system-notification`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${supabaseServiceRoleKey}`,
                    "apikey": supabaseServiceRoleKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    type: "order_status_update",
                    data: { order_id: orderId },
                    related_id: orderId
                }),
            }).catch(err => console.warn("Failed sending payment confirmed email:", err));

            return new Response(JSON.stringify({
                success: true,
                status: "VERIFIED",
                message: "P2P payment approved! Order moved to processing and receipt email sent."
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200
            });
        }

        // ACTION 4: reject (Admin rejects P2P payment receipt)
        if (action === "reject") {
            const rejectionReason = reason || "Payment proof mismatch or illegible receipt";
            const maxSubmissions = body.maxProofResubmissions || 2;
            const currentSubmissions = Number(order.p2p_submission_count || 1);

            const isMaxReached = currentSubmissions >= maxSubmissions;

            let validActorId: string | null = null;
            if (actorId && typeof actorId === "string" && actorId.length > 20) {
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actorId);
                if (isUuid) validActorId = actorId;
            }

            if (isMaxReached) {
                // Update order to payment_failed
                const { error: updateErr } = await supabase.from("orders").update({
                    status: "payment_failed",
                    p2p_status: "rejected",
                    p2p_rejection_reason: rejectionReason
                }).eq("id", orderId);

                if (updateErr) throw new Error(`Failed updating order rejection: ${updateErr.message}`);

                // Audit log
                await supabase.from("p2p_verification_log").insert({
                    order_id: orderId,
                    action: "rejected",
                    actor_id: validActorId,
                    reason: `${rejectionReason} (Max retry submissions limit reached: ${currentSubmissions}/${maxSubmissions})`
                }).catch(e => console.warn("Audit log error:", e));

                // Send Email: Max retries exceeded
                await fetch(`${supabaseUrl}/functions/v1/send-system-notification`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${supabaseServiceRoleKey}`,
                        "apikey": supabaseServiceRoleKey,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        type: "order_status_update",
                        data: { order_id: orderId, reason: rejectionReason },
                        related_id: orderId
                    }),
                }).catch(err => console.warn("Failed sending max retries email:", err));

            } else {
                // Update order to pending_payment with p2p_status: rejected
                const { error: updateErr } = await supabase.from("orders").update({
                    status: "pending_payment",
                    p2p_status: "rejected",
                    p2p_rejection_reason: rejectionReason
                }).eq("id", orderId);

                if (updateErr) throw new Error(`Failed updating order rejection: ${updateErr.message}`);

                // Audit log
                await supabase.from("p2p_verification_log").insert({
                    order_id: orderId,
                    action: "rejected",
                    actor_id: validActorId,
                    reason: rejectionReason
                }).catch(e => console.warn("Audit log error:", e));

                // Send Email: Rejection Notice with re-upload link
                await fetch(`${supabaseUrl}/functions/v1/send-system-notification`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${supabaseServiceRoleKey}`,
                        "apikey": supabaseServiceRoleKey,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        type: "order_status_update",
                        data: { order_id: orderId, reason: rejectionReason },
                        related_id: orderId
                    }),
                }).catch(err => console.warn("Failed sending rejection notice email:", err));
            }


            return new Response(JSON.stringify({
                success: true,
                status: isMaxReached ? "PAYMENT_FAILED" : "REJECTED",
                isMaxReached: isMaxReached,
                message: isMaxReached 
                    ? "Max retries reached. Order marked as payment_failed requiring manual intervention." 
                    : "Payment receipt rejected. Customer notified via email to resubmit proof."
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200
            });
        }

        throw new Error(`Unsupported action: ${action}`);

    } catch (error: any) {
        console.error("P2P Payment Verifier Error:", error);
        return new Response(JSON.stringify({
            error: error.message || "Failed to process P2P verification action"
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400
        });
    }
});
