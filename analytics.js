/* GoatCounter helpers: the live visitor pill + engagement events.
   Loaded as a plain script on both index.html and interactive_room.html.
   Nothing in here may ever throw into the page — analytics is not load-bearing. */
(function () {
  'use strict';

  var GC_HOST = 'https://eyadelfar.goatcounter.com';
  var CACHE_KEY = 'gc:total';

  /* ---- engagement events ---------------------------------------------- */
  /* Links can also self-report with data-goatcounter-click="name"; count.js
     wires those up natively. trackEvent() is for things that aren't links. */
  window.trackEvent = function (path, title) {
    try {
      if (window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({ path: path, title: title || path, event: true });
      }
    } catch (e) { /* ignore */ }
  };

  /* ---- live visitor pill ---------------------------------------------- */
  function show(count) {
    var num = document.getElementById('visitorNum');
    var pill = document.getElementById('visitorPill');
    if (!num || !pill) return;
    num.textContent = count;
    pill.hidden = false;
  }

  function cacheGet() {
    try { return sessionStorage.getItem(CACHE_KEY); } catch (e) { return null; }
  }
  function cacheSet(v) {
    try { sessionStorage.setItem(CACHE_KEY, v); } catch (e) { /* ignore */ }
  }

  function renderVisitors() {
    if (!document.getElementById('visitorPill')) return;

    var cached = cacheGet();
    if (cached) { show(cached); return; }

    // Requires "Allow adding visitor counts on your website" in GoatCounter
    // settings. If it's off, this 403s — and the pill just stays hidden.
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, 4000);

    fetch(GC_HOST + '/counter/TOTAL.json', { signal: ctl.signal })
      .then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error(res.status);
        return res.json();
      })
      .then(function (data) {
        // Render nothing rather than a misleading "0".
        if (!data || !data.count) return;
        cacheSet(data.count);
        show(data.count);
      })
      .catch(function () { /* blocked, offline, or counter disabled: stay hidden */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderVisitors);
  } else {
    renderVisitors();
  }
})();
