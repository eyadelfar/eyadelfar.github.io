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
  /* GoatCounter returns count (pageviews) and count_unique (visitors). We show
     UNIQUES — "1,200 visitors" is the honest number; pageviews flatter. The raw
     pageview count goes in the tooltip for anyone who hovers. */
  function show(unique, views) {
    var num = document.getElementById('visitorNum');
    var pill = document.getElementById('visitorPill');
    if (!num || !pill) return;
    num.textContent = unique;
    if (views && views !== unique) {
      pill.title = unique + ' unique visitors · ' + views + ' page views';
    }
    pill.hidden = false;
  }

  function cacheGet() {
    try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; }
  }
  function cacheSet(v) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(v)); } catch (e) { /* ignore */ }
  }

  function renderVisitors() {
    if (!document.getElementById('visitorPill')) return;

    var cached = cacheGet();
    if (cached) { show(cached.u, cached.v); return; }

    // Requires "Allow adding visitor counts to your website" in GoatCounter's
    // site settings. Without it this 403s — and the pill just stays hidden.
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, 4000);

    fetch(GC_HOST + '/counter/TOTAL.json', { signal: ctl.signal })
      .then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error(res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data) return;
        var unique = data.count_unique || data.count;
        // Render nothing rather than a misleading "0".
        if (!unique) return;
        cacheSet({ u: unique, v: data.count });
        show(unique, data.count);
      })
      .catch(function () { /* blocked, offline, or counter disabled: stay hidden */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderVisitors);
  } else {
    renderVisitors();
  }
})();
