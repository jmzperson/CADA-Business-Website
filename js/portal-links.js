/**
 * Brand portal base URL for signup / login links on the marketing site.
 * Override anytime: window.CADA_PARTNERS_URL = 'https://...';
 */
(function () {
  if (window.CADA_PARTNERS_URL) return;
  var host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    window.CADA_PARTNERS_URL = 'http://localhost:3000';
    return;
  }
  // Production partner portal (update if your Vercel URL differs)
  window.CADA_PARTNERS_URL = 'https://partners.cadaapp.com';
})();
