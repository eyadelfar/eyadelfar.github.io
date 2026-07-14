(function () {
  'use strict';

  var form = document.getElementById('contactForm');
  if (!form) return;

  var API = window.PORTFOLIO_API || '';
  var EMAIL = 'eyadamen588@gmail.com';
  var TIMEOUT = 20000;

  var statusEl = document.getElementById('contactStatus');
  var submit = document.getElementById('contactSubmit');
  var rendered = Date.now();

  function setStatus(message, kind) {
    statusEl.textContent = message;
    statusEl.className = 'contact-status' + (kind ? ' ' + kind : '');
  }

  function mailtoFor(name, message) {
    return 'mailto:' + EMAIL +
      '?subject=' + encodeURIComponent('Portfolio contact from ' + name) +
      '&body=' + encodeURIComponent(message);
  }

  // Never lose the visitor's text. If the Worker is unreachable, hand them a
  // pre-filled mailto and put the message on their clipboard.
  async function degrade(name, message) {
    try { await navigator.clipboard.writeText(message); } catch (e) { /* not fatal */ }
    statusEl.className = 'contact-status warn';
    statusEl.innerHTML =
      'I could not reach the form service. <a href="' + mailtoFor(name, message) + '">Send it from your email app instead</a>. ' +
      'Your message is on your clipboard, so nothing is lost.';
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    var name = form.name.value.trim();
    var email = form.email.value.trim();
    var message = form.message.value.trim();

    if (message.length < 20) {
      setStatus('A little more detail, please. At least 20 characters.', 'warn');
      return;
    }

    submit.disabled = true;
    setStatus('Sending...');

    if (!API) {
      await degrade(name, message);
      submit.disabled = false;
      return;
    }

    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, TIMEOUT);

    try {
      var res = await fetch(API + '/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          name: name,
          email: email,
          message: message,
          company: form.company.value,
          elapsed_ms: Date.now() - rendered,
        }),
      });
      clearTimeout(timer);

      var data = await res.json().catch(function () { return {}; });

      if (res.ok && data.ok) {
        form.reset();
        rendered = Date.now();
        setStatus('Thanks. Your message reached him, and he will reply soon.', 'ok');
        window.trackEvent && window.trackEvent('contact-submit');
      } else if (data.fallback && data.fallback.mailto) {
        await degrade(name, message);
      } else {
        setStatus(data.message || 'That did not go through. Try again in a moment.', 'warn');
      }
    } catch (err) {
      clearTimeout(timer);
      await degrade(name, message);
    }

    submit.disabled = false;
  });
})();
