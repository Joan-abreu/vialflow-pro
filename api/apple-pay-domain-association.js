const SOURCE =
  "https://cdn.basistheory.com/.well-known/apple-developer-merchantid-domain-association";

export default async function handler(req, res) {
  try {
    const upstream = await fetch(SOURCE, { cache: "no-store" });
    if (!upstream.ok) return res.status(502).send("association_unavailable");
    const body = await upstream.text();
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    // 12h: long enough to absorb Apple re-checks, short enough that a
    // certificate rotation lands the same day.
    res.setHeader("Cache-Control", "public, max-age=43200, s-maxage=43200");
    return res.status(200).send(body); // send, not json — no re-encoding
  } catch {
    return res.status(502).send("association_unavailable");
  }
}
