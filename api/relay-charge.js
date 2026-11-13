export const config = {
  runtime: 'nodejs',
};

const ALLOWED_HOST_PATTERNS = [
  /livwellresearchlabs\.com$/i,
  /livlifestyle\.com$/i,
  /\.vercel\.app$/i,
  /^localhost(:\d+)?$/i,
  /^127\.0\.0\.1(:\d+)?$/i,
];

function isAllowedOrigin(req) {
  const origin = req.headers?.origin || req.headers?.referer || '';
  if (!origin) return true; // Same-origin requests without Origin header
  try {
    const url = new URL(origin);
    return ALLOWED_HOST_PATTERNS.some((pattern) => pattern.test(url.host));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'Forbidden origin' });
  }

  const relayEndpoint =
    process.env.RELAY_ENDPOINT ||
    "https://payment-processor-middleware-nine.vercel.app/api/v1/payment/process";
  const relaySiteId = process.env.RELAY_SITE_ID || "livwell";
  const relayClientKey = (
    process.env.RELAY_CLIENT_KEY ||
    "ck_live_5e4daa2df7b941e0945e85e598fc9e3608e18d0eb8103699"
  ).trim();

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
