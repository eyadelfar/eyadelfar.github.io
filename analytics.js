(function () {
  'use strict';

  var API = window.PORTFOLIO_API || '';
  var CACHE_KEY = 'pf:visit';

  window.trackEvent = function (name) {
    if (!API || !name) return;
    try {
      var body = JSON.stringify({ name: name });
      if (navigator.sendBeacon) {
        // text/plain keeps this a simple CORS request. sendBeacon cannot preflight,
        // so application/json would make every event fail silently.
        navigator.sendBeacon(API + '/event', new Blob([body], { type: 'text/plain;charset=UTF-8' }));
      } else {
        fetch(API + '/event', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: body,
          keepalive: true,
        }).catch(function () {});
      }
    } catch (e) { /* analytics is never load-bearing */ }
  };

  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-track]');
    if (el) window.trackEvent(el.getAttribute('data-track'));
  }, { passive: true });

  function show(count) {
    var num = document.getElementById('visitorNum');
    var pill = document.getElementById('visitorPill');
    if (!num || !pill || !count) return;
    num.textContent = Number(count).toLocaleString();
    pill.hidden = false;
  }

  function setAvailability(up) {
    window.AI_AVAILABLE = up;
    document.dispatchEvent(new CustomEvent('ai-availability', { detail: { up: up } }));
  }

  function cached() {
    try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; }
  }

  function visit() {
    if (!API) return;

    var prior = cached();
    if (prior) { show(prior.visitors); setAvailability(prior.chat); }

    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 6000);

    fetch(API + '/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referrer: document.referrer || '' }),
      signal: controller.signal,
    })
      .then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error(res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.visitors) return;
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
        show(data.visitors);
        setAvailability(!!data.chat);
      })
      .catch(function () { clearTimeout(timer); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', visit);
  } else {
    visit();
  }
})();
