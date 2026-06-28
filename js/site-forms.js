/**
 * Submit marketing site forms → Google Sheet + email.
 * Partnership leads also sync to the brand portal database when configured.
 */
(function () {
  var endpoint = window.CADA_FORM_ENDPOINT || '/api/submit-form';

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
            if (formType === 'partnership' && window.CADA_PARTNERS_URL) {
              msg += ' You can also create your partner account using the link below.';
            }
            showStatus(statusEl, 'success', msg);
            form.reset();
          } else {
            showStatus(
              statusEl,
              'error',
              (res.data && res.data.error) || 'Something went wrong. Please try again.'
            );
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
