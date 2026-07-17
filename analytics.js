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

  function setAvailability(up) {
    window.AI_AVAILABLE = up;
    document.dispatchEvent(new CustomEvent('ai-availability', { detail: { up: up } }));
  }

  function cached() {
    try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; }
  }

  var charts = null;
  var loading = null;
  function charting() {
    loading = loading || import('./sparkline.js?v=1').then(function (mod) { charts = mod; });
    return loading;
  }

  var wired = false;

  function setNum(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = Number(value).toLocaleString();
  }

  function render(data) {
    var pill = document.getElementById('visitorPill');
    if (!pill || !data || !data.uniques) return;

    setNum('visitorUniques', data.uniques);
    setNum('visitorViews', data.views || data.uniques);
    pill.hidden = false;

    var series = data.series || [];
    // render() runs twice: once from cache, once from the network.
    if (!series.length || wired) return;
    wired = true;

    var peek = document.getElementById('visitorPeek');
    var panel = document.getElementById('visitorPanel');

    Array.prototype.forEach.call(pill.querySelectorAll('.visitor-stat'), function (stat) {
      var key = stat.dataset.series;

      stat.addEventListener('mouseenter', function () {
        charting().then(function () {
          peek.textContent = '';
          peek.appendChild(charts.sparkline(series, key));
          peek.hidden = false;
        });
      });
      stat.addEventListener('mouseleave', function () { peek.hidden = true; });

      if (!panel) return;
      stat.addEventListener('click', function () {
        charting().then(function () {
          charts.chart(document.getElementById('visitorChart'), series);
          panel.hidden = false;
          peek.hidden = true;
          window.trackEvent('traffic-open');
        });
      });
    });

    if (!panel) return;
    document.getElementById('visitorClose').addEventListener('click', function () {
      panel.hidden = true;
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') panel.hidden = true;
    });
    panel.addEventListener('click', function (e) {
      if (e.target === panel) panel.hidden = true;
    });
  }

  function visit() {
    if (!API) return;

    var prior = cached();
    if (prior) { render(prior); setAvailability(prior.chat); }

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
        if (!data || !data.uniques) return;
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
        render(data);
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
