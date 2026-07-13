/* Contact form.
 *
 * Posts to a Cloudflare Worker (free tier, no card). If that ever fails — the
 * Worker is down, the network is blocked, the request times out — the visitor's
 * message is NEVER lost: we hand them a pre-filled mailto: and copy the text to
 * their clipboard. A contact form that silently eats a message is worse than no
 * form at all.
 */
(function () {
  'use strict';

  var form = document.getElementById('contactForm');
  if (!form) return;

  var API = window.PORTFOLIO_API || '';
  var EMAIL = 'eyadamen588@gmail.com';

  var statusEl = document.getElementById('contactStatus');
  var submit = document.getElementById('contactSubmit');
  var rendered = Date.now();

  function setStatus(msg, kind) {
    statusEl.textContent = msg;
    statusEl.className = 'contact-status' + (kind ? ' ' + kind : '');
  }

  function mailtoFor(name, message) {
    return 'mailto:' + EMAIL +
      '?subject=' + encodeURIComponent('Portfolio contact from ' + name) +
      '&body=' + encodeURIComponent(message);
  }

  async function degrade(name, message) {
    try { await navigator.clipboard.writeText(message); } catch (e) { /* not fatal */ }
    var link = mailtoFor(name, message);
    setStatus('', 'warn');
    statusEl.innerHTML =
      'Couldn’t reach the form service. <a href="' + link + '">Send it from your email app instead</a> — ' +
      'your message has been copied to your clipboard, so nothing is lost.';
    statusEl.className = 'contact-status warn';
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    var name = form.name.value.trim();
    var email = form.email.value.trim();
    var message = form.message.value.trim();

    if (message.length < 20) {
      setStatus('A little more detail, please — at least 20 characters.', 'warn');
      return;
    }

    submit.disabled = true;
    setStatus('Sending…');

    if (!API) { await degrade(name, message); submit.disabled = false; return; }

    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, 20000);

    try {
      var res = await fetch(API + '/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctl.signal,
        body: JSON.stringify({
          name: name,
          email: email,
          message: message,
          company: form.company.value,          // honeypot: hidden, humans leave it empty
          elapsed_ms: Date.now() - rendered,
        }),
      });
      clearTimeout(timer);

      var data = await res.json().catch(function () { return {}; });

      if (res.ok && data.ok) {
        form.reset();
        rendered = Date.now();
        setStatus('Thanks — your message reached him. He’ll reply soon.', 'ok');
        if (window.trackEvent) window.trackEvent('contact-submit', 'Contact form submitted');
      } else if (data.fallback && data.fallback.mailto) {
        await degrade(name, message);
      } else {
        setStatus(data.message || 'That didn’t go through. Try again in a moment.', 'warn');
      }
    } catch (err) {
      clearTimeout(timer);
      await degrade(name, message);
    }

    submit.disabled = false;
  });
})();
