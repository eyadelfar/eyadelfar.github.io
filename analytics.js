/* First-party analytics + the live visitor pill.
 *
 * This used to be GoatCounter. Two things killed it: its counter endpoint sits
 * behind a ~10-hour CDN cache (so a new visit couldn't show up for most of a
 * day), and `gc.zgo.at` is on every ad-blocker list — so any recruiter running
 * uBlock or Brave was never counted at all.
 *
 * This talks to Eyad's own Worker instead: real-time, uncached, unblockable, and
 * privacy-preserving (the server keys on a salted hash of IP+UA and never stores
 * an IP). Nothing here may ever throw into the page.
 */
(function () {
  'use strict';

  var API = window.PORTFOLIO_API || '';
  var CACHE_KEY = 'pf:visit';

  /* ---- engagement events ---------------------------------------------- */
  /* sendBeacon survives the page being unloaded, which is exactly when the
     interesting clicks happen (outbound links, résumé downloads). */
  window.trackEvent = function (name) {
    if (!API || !name) return;
    try {
      var body = JSON.stringify({ name: name });
      if (navigator.sendBeacon) {
        // MUST be text/plain. application/json makes this a non-simple CORS
        // request, and sendBeacon cannot send a preflight — so every event would
        // silently fail. The Worker parses the body regardless of content type.
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

  // Anything with data-track="name" reports itself on click.
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-track]');
    if (el) window.trackEvent(el.getAttribute('data-track'));
  }, { passive: true });

  /* ---- visitor pill ---------------------------------------------------- */

  function show(count) {
    var num = document.getElementById('visitorNum');
    var pill = document.getElementById('visitorPill');
    if (!num || !pill || !count) return;
    num.textContent = Number(count).toLocaleString();
    pill.hidden = false;
  }

  /* The AI runs on a free daily quota. When it's gone, the Ask button and the
     hero agent card hide themselves — a dead button is worse than no button. */
  function setAvailability(up) {
    window.AI_AVAILABLE = up;
    document.dispatchEvent(new CustomEvent('ai-availability', { detail: { up: up } }));
  }

  function visit() {
    if (!API) return;

    // Show the cached number instantly so the pill doesn't pop in late; the live
    // value overwrites it a moment later.
    try {
      var cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (cached) { show(cached.visitors); setAvailability(cached.chat); }
    } catch (e) { /* ignore */ }

    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, 6000);

    fetch(API + '/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referrer: document.referrer || '' }),
      signal: ctl.signal,
    })
      .then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error(res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data) return;
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
        // Render nothing rather than a misleading "0".
        show(data.visitors);
        setAvailability(!!data.chat);
      })
      .catch(function () {
        // Offline or the Worker is down: leave the pill hidden, and assume the AI
        // is up so we don't hide a working feature over a flaky network.
        clearTimeout(timer);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', visit);
  } else {
    visit();
  }
})();
