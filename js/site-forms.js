/**
 * Submit marketing site forms → Google Sheet + email.
 * Partnership leads also sync to the brand portal database when configured.
 */
(function () {
  function resolveEndpoint() {
    if (window.CADA_FORM_ENDPOINT) return window.CADA_FORM_ENDPOINT;
    var host = window.location.hostname;
    var protocol = window.location.protocol;
    // Static preview (python -m http.server, etc.) has no /api — use production proxy.
    if (
      protocol === 'file:' ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.local')
    ) {
      return 'https://www.cadaapp.org/api/submit-form';
    }
    return '/api/submit-form';
  }

  var endpoint = resolveEndpoint();

  function showStatus(el, type, message) {
    if (!el) return;
    el.classList.remove('hidden');
    var base = 'rounded-card px-4 py-3 text-sm font-medium border-2 ';
    if (type === 'success') {
      el.className = base + 'bg-teal-light text-teal-dark border-teal/20';
    } else {
      el.className = base + 'bg-coral-light text-coral-dark border-coral/20';
    }
    el.textContent = message;
  }

  function payloadFromForm(form, formType) {
    var data = new FormData(form);
    var body = {
      form_type: formType,
      page_url: window.location.href,
    };
    data.forEach(function (value, key) {
      if (String(value).trim()) body[key] = String(value).trim();
    });
    return body;
  }

  function syncPartnershipLead(body) {
    var portal = window.CADA_PARTNERS_URL;
    if (!portal || body.form_type !== 'partnership') {
      return Promise.resolve();
    }
    return fetch(portal + '/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: body.company_name,
        email: body.email,
        message: body.message,
      }),
    }).catch(function () {
      return null;
    });
  }

  function bindForm(form) {
    var formType = form.getAttribute('data-cada-form');
    if (!formType) return;

    var statusEl = form.querySelector('[data-form-status]');
    var submitBtn = form.querySelector('[type="submit"]');
    var defaultLabel = submitBtn ? submitBtn.textContent : 'SUBMIT';

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'SENDING…';
      }
      if (statusEl) statusEl.className = 'hidden';

      var body = payloadFromForm(form, formType);

      Promise.all([
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).then(function (r) {
          return r.json().then(function (d) {
            return { ok: r.ok, data: d };
          });
        }),
        syncPartnershipLead(body),
      ])
        .then(function (results) {
          var res = results[0];
          if (res.ok && res.data.ok !== false) {
            var msg = "Thanks! We'll be in touch soon.";
            if (formType === 'support') {
              msg = "Thanks! We received your question and will get back to you soon.";
            } else if (formType === 'partnership') {
              msg += " If we're a fit, we'll email you a partner invite.";
            }
            showStatus(statusEl, 'success', msg);
            form.reset();
          } else {
            var errMsg =
              (res.data && res.data.error) || 'Something went wrong. Please try again.';
            if (errMsg === 'Method not allowed') {
              errMsg =
                'Form could not be sent (server rejected the request). If you are testing locally, use the live site or run vercel dev.';
            }
            showStatus(statusEl, 'error', errMsg);
          }
        })
        .catch(function () {
          showStatus(
            statusEl,
            'error',
            'Could not send your message. Please email james@cadaapp.com directly.'
          );
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = defaultLabel;
          }
        });
    });
  }

  document.querySelectorAll('form[data-cada-form]').forEach(bindForm);
})();
