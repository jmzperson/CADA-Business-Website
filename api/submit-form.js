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

  if (scriptUrl.includes('/api/submit-form')) {
    return res.status(503).json({
      ok: false,
      error:
        'GOOGLE_APPS_SCRIPT_URL is misconfigured (must be your Google Apps Script /exec URL, not this site).',
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
      data = null;
    }

    if (!upstream.ok || data?.ok === false) {
      let error =
        (data && data.error) ||
        'Could not save your submission. The Google Apps Script may need to be redeployed.';

      if (upstream.status === 404 || upstream.status === 405) {
        error =
          'Google Apps Script web app is not reachable (404/405). Redeploy the script as a web app and update GOOGLE_APPS_SCRIPT_URL in Vercel.';
      } else if (text.includes('Page Not Found') || text.includes('unable to open the file')) {
        error =
          'Google Apps Script deployment not found. Open Website Forms → Extensions → Apps Script → Deploy → New deployment (Web app, Anyone).';
      }

      return res.status(502).json({ ok: false, error });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Server error',
    });
  }
};
