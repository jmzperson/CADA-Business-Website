/**
 * Vercel serverless proxy → Google Apps Script (Sheet + email).
 * Set GOOGLE_APPS_SCRIPT_URL in Vercel project environment variables.
 */
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  if (!scriptUrl) {
    return res.status(503).json({
      ok: false,
      error: 'Form handler not configured. Set GOOGLE_APPS_SCRIPT_URL in Vercel.',
    });
  }

  try {
    const upstream = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      redirect: 'follow',
    });

    const text = await upstream.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: upstream.ok };
    }

    if (!upstream.ok || data.ok === false) {
      return res.status(502).json({
        ok: false,
        error: data.error || 'Upstream form handler failed',
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Server error',
    });
  }
};
