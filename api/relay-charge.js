export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const relayEndpoint =
    process.env.RELAY_ENDPOINT ||
    "https://payment-processor-middleware-nine.vercel.app/api/v1/payment/process";
  const relaySiteId = process.env.RELAY_SITE_ID || "livwell";
  const relayClientKey =
    process.env.RELAY_CLIENT_KEY ||
    "pk_livwell_c596d4580b6001ad0668af79b593d8c09f4fd27c";

  try {
    const rawPayload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    const upstreamRes = await fetch(relayEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Site-Id': relaySiteId,
        'X-Client-Key': relayClientKey,
      },
      body: rawPayload,
    });

    const data = await upstreamRes.json();
    return res.status(upstreamRes.status).json(data);
  } catch (error) {
    return res.status(502).json({
      success: false,
      error: 'gateway_unreachable',
      message: 'Secure payment gateway could not be reached.',
    });
  }
}
