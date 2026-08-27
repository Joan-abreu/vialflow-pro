import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Client as SquareClient, Environment as SquareEnvironment } from "https://esm.sh/square@38.1.0";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const squareAccessToken = Deno.env.get("SQUARE_ACCESS_TOKEN") || "";
const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
const authNetTransactionKey = Deno.env.get("AUTHORIZENET_TRANSACTION_KEY") || "";
const cloverPrivateToken = Deno.env.get("CLOVER_API_KEY") || "";
const nmiSecurityKeyEnv = Deno.env.get("NMI_SECURITY_KEY") || "";
const paypalSecretEnv = Deno.env.get("PAYPAL_CLIENT_SECRET") || "";
const tagadaApiKeyEnv = Deno.env.get("TAGADAPAY_API_KEY") || "";

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
        const {
            provider = "square",
            sourceId,
            paymentIntentId,
            paypalOrderId,
            opaqueData,
            amount,
            currency = "USD",
            orderId,
            customerEmail,
            locationId,
            apiLoginId,
            merchantId,
            nmiSecurityKey,
            storeId,
            paymentFlowId,
            tagadaApiKey,
            cardDetails,
            isProduction = false,
            items,
            shippingAddress,
            shippingCost = 0,
            tax = 0,
            applied_coupons,
            discounts,
            manualReference
        } = body;

        // 1. Handle Free Orders ($0) regardless of gateway
        if (amount <= 0) {
            let productDiscount = 0;
            let shippingDiscount = 0;
            if (discounts && Array.isArray(discounts)) {
                discounts.forEach((d: any) => {
                    if (d.target === 'shipping') {
                        shippingDiscount += Number(d.amount);
                    } else {
                        productDiscount += Number(d.amount);
                    }
                });
            }

            await supabase.from("orders").update({ 
                status: "processing", 
                payment_method: "free",
                applied_coupons,
                product_discount: productDiscount,
                shipping_discount: shippingDiscount
            }).eq("id", orderId);

            if (applied_coupons && Array.isArray(applied_coupons)) {
                for (const code of applied_coupons) {
                    const trimmedCode = code.trim().toUpperCase();
                    await supabase.rpc('increment_coupon_usage', { coupon_code: trimmedCode });
                    const { data: profile } = await supabase.from('profiles').select('user_id').eq('referral_code', trimmedCode).single();
                    if (profile) {
                        await supabase.rpc('increment_referral_count', { referrer_user_id: profile.user_id });
                    }
                }
            }

            const sendEmail = async (type: string) => {
                await fetch(`${supabaseUrl}/functions/v1/send-system-notification`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${supabaseServiceRoleKey}`,
                        "apikey": supabaseServiceRoleKey,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        type: type,
                        data: { order_id: orderId },
                        related_id: orderId
                    }),
                });
            };

            await Promise.allSettled([
                sendEmail("order_confirmation"),
                sendEmail("admin_order_notification")
            ]);

            return new Response(JSON.stringify({
                success: true,
                status: "COMPLETED",
                provider: "free",
                message: "Free order processed successfully"
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // Helper to complete order on successful payment
        const completeSuccessfulOrder = async (providerName: string, transactionId: string) => {
            let productDiscount = 0;
            let shippingDiscount = 0;
            if (discounts && Array.isArray(discounts)) {
                discounts.forEach((d: any) => {
                    if (d.target === 'shipping') {
                        shippingDiscount += Number(d.amount);
                    } else {
                        productDiscount += Number(d.amount);
                    }
                });
            }

            const updatePayload: any = {
                status: "processing",
                payment_method: providerName,
                payment_provider: providerName,
                payment_status: "paid",
            };
            if (transactionId) updatePayload.payment_intent_id = transactionId;
            if (applied_coupons) updatePayload.applied_coupons = applied_coupons;
            if (productDiscount > 0) updatePayload.product_discount = productDiscount;
            if (shippingDiscount > 0) updatePayload.shipping_discount = shippingDiscount;

            console.log(`[OrderUpdate] Updating order ${orderId} to 'processing'...`, updatePayload);

            const { data: updatedOrders, error: updateErr } = await supabase
                .from("orders")
                .update(updatePayload)
                .eq("id", orderId)
                .select();

            if (updateErr) {
                console.error("❌ Failed to update order status in Supabase DB with full payload:", updateErr);
                // Fallback minimal update
                const { error: fallbackErr } = await supabase
                    .from("orders")
                    .update({ status: "processing", payment_method: providerName, payment_status: "paid" })
                    .eq("id", orderId);

                if (fallbackErr) {
                    console.error("❌ Fallback order status update also failed:", fallbackErr);
                } else {
                    console.log("✅ Order status updated to 'processing' via fallback.");
                }
            } else {
                console.log("✅ Order status successfully updated to 'processing' in Supabase DB:", updatedOrders);
            }

            if (applied_coupons && Array.isArray(applied_coupons)) {
                for (const code of applied_coupons) {
                    const trimmedCode = code.trim().toUpperCase();
                    await supabase.rpc('increment_coupon_usage', { coupon_code: trimmedCode });
                    const { data: profile } = await supabase.from('profiles').select('user_id').eq('referral_code', trimmedCode).single();
                    if (profile) {
                        await supabase.rpc('increment_referral_count', { referrer_user_id: profile.user_id });
                    }
                }
            }

            const sendEmail = async (type: string) => {
                await fetch(`${supabaseUrl}/functions/v1/send-system-notification`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${supabaseServiceRoleKey}`,
                        "apikey": supabaseServiceRoleKey,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        type: type,
                        data: { order_id: orderId },
                        related_id: orderId
                    }),
                });
            };

            await Promise.allSettled([
                sendEmail("order_confirmation"),
                sendEmail("admin_order_notification")
            ]);
        };

        // 2. Square Processing
        if (provider === "square") {
            const squareEnvironment = isProduction ? SquareEnvironment.Production : SquareEnvironment.Sandbox;
            const square = new SquareClient({
                accessToken: squareAccessToken,
                environment: squareEnvironment,
            });

            const amountInCents = Math.round(parseFloat(amount.toString()) * 100);
            const idempotencyKey = crypto.randomUUID();

            let squareOrderId = undefined;
            if (items && items.length > 0 && locationId) {
                try {
                    const orderResponse = await square.ordersApi.createOrder({
                        order: {
                            locationId: locationId,
                            referenceId: orderId,
                            lineItems: items.map((item: any) => ({
                                name: item.name,
                                quantity: item.quantity.toString(),
                                basePriceMoney: {
                                    amount: BigInt(Math.round(Number(item.basePriceMoney?.amount || item.price * 100))),
                                    currency: currency
                                }
                            })),
                            serviceCharges: shippingCost > 0 ? [{
                                name: "Shipping",
                                amountMoney: {
                                    amount: BigInt(Math.round(Number(shippingCost) * 100)),
                                    currency: currency
                                },
                                calculationPhase: "TOTAL_PHASE"
                            }] : undefined,
                            taxes: tax > 0 ? [{
                                name: "Tax",
                                type: "ADDITIVE",
                                appliedMoney: {
                                    amount: BigInt(Math.round(Number(tax) * 100)),
                                    currency: currency
                                },
                                scope: "ORDER"
                            }] : undefined,
                        }
                    });
                    squareOrderId = orderResponse.result.order?.id;
                } catch (e) {
                    console.warn("Non-fatal error creating Square order container:", e);
                }
            }

            const paymentResponse = await square.paymentsApi.createPayment({
                sourceId: sourceId,
                idempotencyKey: idempotencyKey,
                amountMoney: {
                    amount: BigInt(amountInCents),
                    currency: currency,
                },
                orderId: squareOrderId,
                locationId: locationId,
                referenceId: orderId,
                buyerEmailAddress: customerEmail,
                note: `Order ID: ${orderId}`,
                shippingAddress: shippingAddress,
            });

            const payment = paymentResponse.result.payment;
            if (payment?.status === "COMPLETED" || payment?.status === "APPROVED") {
                await completeSuccessfulOrder("square", payment.id || "");
                return new Response(JSON.stringify({
                    success: true,
                    status: "COMPLETED",
                    provider: "square",
                    paymentId: payment.id,
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200,
                });
            } else {
                throw new Error(`Square payment status: ${payment?.status || "FAILED"}`);
            }
        }

        // 3. Stripe Processing
        if (provider === "stripe") {
            const stripe = new Stripe(stripeSecretKey, {
                apiVersion: "2023-10-16",
            });

            const amountInCents = Math.round(parseFloat(amount.toString()) * 100);

            if (paymentIntentId) {
                const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
                if (intent.status === "succeeded") {
                    await completeSuccessfulOrder("stripe", intent.id);
                    return new Response(JSON.stringify({
                        success: true,
                        status: "COMPLETED",
                        provider: "stripe",
                        paymentId: intent.id,
                    }), {
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                        status: 200,
                    });
                }
            }

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amountInCents,
                currency: currency.toLowerCase(),
                receipt_email: customerEmail,
                metadata: {
                    orderId: orderId,
                },
                automatic_payment_methods: {
                    enabled: true,
                },
            });

            return new Response(JSON.stringify({
                success: true,
                provider: "stripe",
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // 3.5. TagadaPay Processing (Tokenized BasisTheory Card & 3DS Gateway)
        if (provider === "tagadapay") {
            const effectiveApiKey = tagadaApiKey || tagadaApiKeyEnv;
            if (!effectiveApiKey) {
                throw new Error("TagadaPay API key is not configured (TAGADAPAY_API_KEY).");
            }

            const candidateBaseUrls = [
                Deno.env.get("TAGADAPAY_BASE_URL"),
                "https://api.tagada.io/api/public/v1",
                "https://app.tagadapay.com/api/public/v1",
                "https://api.tagadapay.com/api/public/v1"
            ].filter(Boolean) as string[];

            const amountInCents = Math.round(parseFloat(amount.toString()) * 100);

            let paymentInstrumentId = sourceId;
            let tagadaCustomerId: string | undefined = undefined;

            // If sourceId is a base64 TagadaToken, create the payment instrument first
            if (sourceId && (sourceId.startsWith("ey") || sourceId.length > 50)) {
                const firstName = shippingAddress?.firstName || customerEmail?.split("@")[0] || "Customer";
                const lastName = shippingAddress?.lastName || "Order";

                let instrumentCreated = false;
                let lastInstrumentErr = "Failed to create Tagada payment instrument";

                for (const baseUrl of candidateBaseUrls) {
                    try {
                        const instrumentRes = await fetch(`${baseUrl}/payment-instruments/create-from-token`, {
                            method: "POST",
                            headers: {
                                "Authorization": `Bearer ${effectiveApiKey}`,
                                "Content-Type": "application/json",
                                "Accept": "application/json"
                            },
                            body: JSON.stringify({
                                tagadaToken: sourceId,
                                storeId: storeId,
                                customerData: {
                                    email: customerEmail,
                                    firstName,
                                    lastName
                                }
                            })
                        });

                        const instrumentData = await instrumentRes.json().catch(() => ({}));
                        if (instrumentRes.ok && (instrumentData.paymentInstrument?.id || instrumentData.id)) {
                            paymentInstrumentId = instrumentData.paymentInstrument?.id || instrumentData.id;
                            tagadaCustomerId = instrumentData.customer?.id || instrumentData.customerId;
                            instrumentCreated = true;
                            break;
                        } else if (instrumentRes.status !== 404) {
                            lastInstrumentErr = instrumentData.message || instrumentData.error || lastInstrumentErr;
                            break;
                        }
                    } catch (err: any) {
                        lastInstrumentErr = err.message || lastInstrumentErr;
                    }
                }

                if (!instrumentCreated && !paymentInstrumentId) {
                    throw new Error(lastInstrumentErr);
                }
            }

            const defaultReturnUrl = (body.returnUrl && !body.returnUrl.includes("localhost") && !body.returnUrl.includes("127.0.0.1"))
                ? body.returnUrl
                : `https://livlifestyle.com/order-confirmation?orderId=${orderId}`;

            const processPayload: any = {
                amount: amountInCents,
                currency: (currency || "USD").toUpperCase(),
                storeId: storeId,
                paymentInstrumentId: paymentInstrumentId,
                paymentMethod: "card",
                mode: "purchase",
                referenceId: orderId,
                returnUrl: defaultReturnUrl,
                metadata: {
                    orderId: orderId,
                    customerEmail: customerEmail
                }
            };

            if (tagadaCustomerId) {
                processPayload.customerId = tagadaCustomerId;
            }

            const effectivePaymentFlowId = paymentFlowId || Deno.env.get("TAGADAPAY_PAYMENT_FLOW_ID");
            if (effectivePaymentFlowId) {
                processPayload.paymentFlowId = effectivePaymentFlowId;
            }

            console.log("👉 [TagadaPay] Sending Process Payload to TagadaPay:", JSON.stringify(processPayload, null, 2));

            let payRes: Response | null = null;
            let payData: any = null;

            for (const baseUrl of candidateBaseUrls) {
                try {
                    payRes = await fetch(`${baseUrl}/payments/process`, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${effectiveApiKey}`,
                            "Content-Type": "application/json",
                            "Accept": "application/json"
                        },
                        body: JSON.stringify(processPayload)
                    });

                    payData = await payRes.json().catch(() => ({}));
                    if (payRes.status !== 404) {
                        break;
                    }
                } catch (err) {
                    console.warn(`TagadaPay request to ${baseUrl} failed:`, err);
                }
            }

            if (!payRes || !payData) {
                throw new Error("Unable to connect to TagadaPay payment processing server.");
            }

            console.log("👈 [TagadaPay] Received Process Response:", JSON.stringify(payData, null, 2));
            const payment = payData.payment || payData.data || payData;

            const statusLower = String(
                payment.status || 
                payData.status || 
                payment.latest_charge?.status || 
                payData.latest_charge?.status || 
                ""
            ).toLowerCase();

            const isSuccessStatus = 
                payRes.ok && (
                    ["succeeded", "completed", "paid", "approved", "success", "captured", "authorized", "processing"].includes(statusLower) ||
                    payment.paid === true ||
                    payData.paid === true ||
                    payment.latest_charge?.paid === true ||
                    payment.latest_charge?.captured === true ||
                    payment.outcome?.seller_message === "Payment complete." ||
                    payData.outcome?.seller_message === "Payment complete."
                );

            const resolvedPaymentId = 
                payment.paymentId || 
                payData.paymentId || 
                payData.data?.paymentId || 
                payment.id || 
                payData.id || 
                payment.latest_charge?.id || 
                payData.latest_charge?.id || 
                payment.metadata?.payment_id || 
                "";

            if (isSuccessStatus) {
                await completeSuccessfulOrder("tagadapay", resolvedPaymentId);
                return new Response(JSON.stringify({
                    success: true,
                    status: "COMPLETED",
                    provider: "tagadapay",
                    paymentId: resolvedPaymentId,
                    orderId: orderId
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200,
                });
            } else if (payRes.ok && (payment.requireAction === "threeds_auth" || payment.requireAction === "redirect")) {
                return new Response(JSON.stringify({
                    success: false,
                    status: "PENDING_3DS",
                    provider: "tagadapay",
                    requireAction: payment.requireAction,
                    requireActionData: payment.requireActionData || payment,
                    paymentId: resolvedPaymentId,
                    orderId: orderId
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200,
                });
            } else {
                let errMsg = payment.error || payData.message || payData.error;
                if (!errMsg && payData.fieldErrors) {
                    const firstErr = Object.values(payData.fieldErrors)[0];
                    errMsg = Array.isArray(firstErr) ? firstErr[0] : String(firstErr);
                }
                if (!errMsg) {
                    errMsg = `Tagada transaction ${payment.status || "declined"}`;
                }
                throw new Error(errMsg);
            }
        }

        // 4. Authorize.Net Processing (Accept.js Tokenized Charge)
        if (provider === "authorizenet") {
            const endpoint = isProduction 
                ? "https://api.authorize.net/xml/v1/request.api"
                : "https://apitest.authorize.net/xml/v1/request.api";

            const authNetPayload = {
                createTransactionRequest: {
                    merchantAuthentication: {
                        name: apiLoginId || Deno.env.get("AUTHORIZENET_API_LOGIN_ID") || "",
                        transactionKey: authNetTransactionKey || Deno.env.get("AUTHORIZENET_TRANSACTION_KEY") || ""
                    },
                    refId: orderId.slice(0, 20),
                    transactionRequest: {
                        transactionType: "authCaptureTransaction",
                        amount: Number(amount).toFixed(2),
                        payment: {
                            opaqueData: {
                                dataDescriptor: opaqueData?.dataDescriptor || "COMMON.ACCEPT.INAPP.PAYMENT",
                                dataValue: opaqueData?.dataValue || sourceId
                            }
                        },
                        order: {
                            invoiceNumber: orderId.slice(0, 20),
                            description: `Order ${orderId}`
                        },
                        customer: {
                            email: customerEmail
                        },
                        billTo: {
                            firstName: shippingAddress?.firstName || "Customer",
                            lastName: shippingAddress?.lastName || "Order",
                            address: shippingAddress?.addressLine1 || "",
                            city: shippingAddress?.locality || "",
                            state: shippingAddress?.administrativeDistrictLevel1 || "",
                            zip: shippingAddress?.postalCode || "",
                            country: shippingAddress?.country || "US"
                        }
                    }
                }
            };

            const authNetRes = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(authNetPayload)
            });

            const authNetData = await authNetRes.json();
            const txResponse = authNetData?.transactionResponse;

            if (txResponse && (txResponse.responseCode === "1" || txResponse.responseCode === 1)) {
                await completeSuccessfulOrder("authorizenet", txResponse.transId);
                return new Response(JSON.stringify({
                    success: true,
                    status: "COMPLETED",
                    provider: "authorizenet",
                    paymentId: txResponse.transId
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200,
                });
            } else {
                const errorMsg = txResponse?.errors?.[0]?.errorText || authNetData?.messages?.message?.[0]?.text || "Authorize.Net transaction failed";
                throw new Error(errorMsg);
            }
        }

        // 5. Clover Processing
        if (provider === "clover") {
            const cloverBaseUrl = isProduction
                ? "https://api.clover.com"
                : "https://apisandbox.dev.clover.com";

            const effectiveToken = cloverPrivateToken || Deno.env.get("CLOVER_API_KEY") || "";
            const amountInCents = Math.round(parseFloat(amount.toString()) * 100);

            const cloverRes = await fetch(`${cloverBaseUrl}/v3/merchants/${merchantId}/charges`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${effectiveToken}`,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    amount: amountInCents,
                    currency: "USD",
                    source: sourceId,
                    metadata: {
                        orderId: orderId,
                        customerEmail: customerEmail
                    }
                })
            });

            const cloverData = await cloverRes.json();

            if (cloverRes.ok && (cloverData.status === "PAID" || cloverData.status === "SUCCESS" || cloverData.paid === true)) {
                await completeSuccessfulOrder("clover", cloverData.id);
                return new Response(JSON.stringify({
                    success: true,
                    status: "COMPLETED",
                    provider: "clover",
                    paymentId: cloverData.id
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200,
                });
            } else {
                throw new Error(cloverData.message || cloverData.error || "Clover transaction declined");
            }
        }

        // 6. NMI (Network Merchants Inc.) Processing
        if (provider === "nmi") {
            const effectiveKey = nmiSecurityKey || nmiSecurityKeyEnv;
            const params = new URLSearchParams();
            params.append("security_key", effectiveKey);
            params.append("type", "sale");
            params.append("amount", Number(amount).toFixed(2));
            params.append("orderid", orderId.slice(0, 30));
            params.append("email", customerEmail || "");
            
            if (sourceId) {
                params.append("payment_token", sourceId);
            } else if (cardDetails) {
                params.append("ccnumber", cardDetails.number.replace(/\s+/g, ''));
                params.append("ccexp", `${cardDetails.expMonth.padStart(2, '0')}${cardDetails.expYear.slice(-2)}`);
                params.append("cvv", cardDetails.cvv);
            }

            if (shippingAddress) {
                params.append("first_name", shippingAddress.firstName || "");
                params.append("last_name", shippingAddress.lastName || "");
                params.append("address1", shippingAddress.addressLine1 || "");
                params.append("city", shippingAddress.locality || "");
                params.append("state", shippingAddress.administrativeDistrictLevel1 || "");
                params.append("zip", shippingAddress.postalCode || "");
                params.append("country", shippingAddress.country || "US");
            }

            const nmiRes = await fetch("https://secure.nmi.com/api/transact.php", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: params.toString()
            });

            const nmiText = await nmiRes.text();
            const nmiParams = new URLSearchParams(nmiText);
            const responseCode = nmiParams.get("response");
            const transactionId = nmiParams.get("transactionid") || "";
            const responseText = nmiParams.get("responsetext") || "Transaction declined";

            if (responseCode === "1") {
                await completeSuccessfulOrder("nmi", transactionId);
                return new Response(JSON.stringify({
                    success: true,
                    status: "COMPLETED",
                    provider: "nmi",
                    paymentId: transactionId
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200,
                });
            } else {
                throw new Error(`NMI error: ${responseText} (Code: ${responseCode})`);
            }
        }

        // 7. PayPal Processing
        if (provider === "paypal") {
            const effectiveTxId = paypalOrderId || sourceId || `PAYPAL-${orderId.slice(0, 8)}`;
            await completeSuccessfulOrder("paypal", effectiveTxId);
            return new Response(JSON.stringify({
                success: true,
                status: "COMPLETED",
                provider: "paypal",
                paymentId: effectiveTxId
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // 9. Manual Virtual Terminal / Offline Card Vault Processing
        if (provider === "manual_terminal" || provider === "offline_card") {
            const vaultRes = await fetch(`${supabaseUrl}/functions/v1/vault-card-payment`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${supabaseServiceRoleKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    action: "encrypt_and_save",
                    orderId: orderId,
                    cardPayload: cardDetails || {
                        cardNumber: body.cardNumber || sourceId,
                        expMonth: body.expMonth,
                        expYear: body.expYear,
                        cvv: body.cvv,
                        cardholderName: body.cardholderName,
                        billingZip: body.billingZip
                    }
                })
            });

            const vaultData = await vaultRes.json();
            if (!vaultRes.ok || vaultData.error) {
                throw new Error(vaultData.error || "Failed to vault card for offline manual terminal processing");
            }

            return new Response(JSON.stringify({
                success: true,
                status: "PENDING_MANUAL_CHARGE",
                provider: "manual_terminal",
                message: "Order placed in pending payment state for admin virtual terminal processing"
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        // 10. Direct P2P Payment Processing (Zelle, Venmo, Cash App, Manual)

        if (provider === "manual" || provider === "p2p" || provider === "zelle" || provider === "venmo" || provider === "cashapp") {
            let productDiscount = 0;
            let shippingDiscount = 0;
            if (discounts && Array.isArray(discounts)) {
                discounts.forEach((d: any) => {
                    if (d.target === 'shipping') {
                        shippingDiscount += Number(d.amount);
                    } else {
                        productDiscount += Number(d.amount);
                    }
                });
            }

            await supabase.from("orders").update({
                status: "pending_payment",
                p2p_status: "pending_submission",
                payment_method: provider,
                payment_gateway: provider,
                applied_coupons,
                product_discount: productDiscount,
                shipping_discount: shippingDiscount
            }).eq("id", orderId);

            const sendEmail = async (type: string) => {
                try {
                    await fetch(`${supabaseUrl}/functions/v1/send-system-notification`, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${supabaseServiceRoleKey}`,
                            "apikey": supabaseServiceRoleKey,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            type: type,
                            data: { order_id: orderId },
                            related_id: orderId
                        }),
                    });
                } catch (e) {
                    console.error(`Failed to send email notification ${type}:`, e);
                }
            };

            await Promise.allSettled([
                sendEmail("order_confirmation"),
                sendEmail("admin_order_notification")
            ]);

            return new Response(JSON.stringify({
                success: true,
                status: "PENDING_P2P_PAYMENT",
                provider: provider,
                message: "P2P order created successfully and awaiting payment proof submission"
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        throw new Error(`Unsupported payment provider: ${provider}`);


    } catch (error: any) {
        console.error("Universal Payment Processing Error:", error);

        const errMessage = String(error?.message || error || "");
        const isCriticalAccountError = 
            errMessage.includes("UNAUTHORIZED") ||
            errMessage.includes("ACCOUNT_DISABLED") ||
            errMessage.includes("RESTRICTED") ||
            errMessage.includes("SUSPENDED") ||
            errMessage.includes("INVALID_ACCESS_TOKEN") ||
            errMessage.includes("Authentication Failed") ||
            errMessage.includes("Security Key Invalid") ||
            errMessage.includes("Merchant disabled") ||
            errMessage.includes("TAGADAPAY_API_KEY") ||
            errMessage.includes("Invalid API Key") ||
            errMessage.includes("Store not found");

        if (isCriticalAccountError) {
            console.warn("[Auto-Failover Alert] Critical payment gateway exception detected:", errMessage);
        }

        return new Response(JSON.stringify({
            error: error.message || "Failed to process payment",
            isCriticalAccountError,
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
