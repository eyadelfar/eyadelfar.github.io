(function () {
  'use strict';

  var form = document.getElementById('rateForm');
  if (!form) return;

  var API = window.PORTFOLIO_API || '';
  if (!API) { form.hidden = true; return; }

  var starsEl = document.getElementById('rateStars');
  var summaryEl = document.getElementById('rateSummary');
  var mineEl = document.getElementById('rateMine');
  var more = document.getElementById('rateMore');
  var comment = document.getElementById('rateComment');
  var contact = document.getElementById('rateContact');
  var send = document.getElementById('rateSend');
  var statusEl = document.getElementById('rateStatus');
  var rendered = Date.now();
  var STORE = 'pf-rating';
  var LABELS = ['Bad', 'Poor', 'Fine', 'Good', 'Great'];

  var saved = { token: '', rating: 0 };
  try { saved = JSON.parse(localStorage.getItem(STORE) || 'null') || saved; } catch (e) { /* private mode */ }
  if (!/^[a-z0-9-]{12,64}$/i.test(saved.token || '')) {
    saved = {
      token: window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12),
      rating: 0,
    };
  }
  var rating = saved.rating || 0;
  var busy = false;

  function remember() {
    try { localStorage.setItem(STORE, JSON.stringify({ token: saved.token, rating: rating })); } catch (e) { /* private mode */ }
  }

  function paint(active) {
    Array.prototype.forEach.call(starsEl.children, function (star, i) {
      star.classList.toggle('on', i < active);
      star.setAttribute('aria-checked', i + 1 === rating ? 'true' : 'false');
    });
  }

  function say(text, warn) {
    statusEl.textContent = text || '';
    statusEl.className = 'rate-status' + (warn ? ' warn' : '');
  }

  function showSummary(summary) {
    if (!summary || !summaryEl) return;
    summaryEl.hidden = false;
    if (!summary.count) {
      summaryEl.textContent = 'No ratings yet. Be the first.';
      return;
    }
    summaryEl.innerHTML = '<b></b> <span></span>';
    summaryEl.firstChild.textContent = '★ ' + Number(summary.avg).toFixed(1);
    summaryEl.lastChild.textContent = 'from ' + summary.count + (summary.count === 1 ? ' rating' : ' ratings');
  }

  function showMine() {
    mineEl.hidden = !rating;
    more.hidden = !rating;
    if (rating) mineEl.firstElementChild.textContent = 'You rated ' + rating + ' of 5. Pick another star to change it.';
    paint(rating);
  }

  function post(path, body) {
    return fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        data.http = res.status;
        return data;
      });
    });
  }

  function submit(value, note) {
    if (busy) return;
    busy = true;
    send.disabled = true;
    say(note ? 'Sending...' : 'Saving...');
    post('/feedback', {
      token: saved.token,
      rating: value,
      comment: note ? comment.value.trim() : '',
      contact: note ? contact.value.trim() : '',
      referrer: document.referrer || '',
      company: form.company.value,
      elapsed_ms: Date.now() - rendered,
    }).then(function (data) {
      // A reply without a summary means the rating was not counted.
      if (data.http !== 200 || !data.ok || !data.summary) {
        say(data.message || 'That did not go through. Try again in a moment.', true);
        paint(rating);
        return;
      }
      var first = !rating;
      rating = value;
      remember();
      showSummary(data.summary);
      showMine();
      if (note) {
        comment.value = '';
        say('Thanks, I read every one of these.');
      } else {
        say(LABELS[value - 1] + (first ? '. Counted. Anything you want to add?' : '. Changed.'));
      }
      window.trackEvent && window.trackEvent('feedback-' + value);
    }).catch(function () {
      say('I could not reach the server. The contact form still works.', true);
      paint(rating);
    }).then(function () {
      busy = false;
      send.disabled = false;
    });
  }

  for (var i = 1; i <= 5; i++) {
    var star = document.createElement('button');
    star.type = 'button';
    star.className = 'rate-star';
    star.dataset.value = i;
    star.setAttribute('role', 'radio');
    star.setAttribute('aria-checked', 'false');
    star.setAttribute('aria-label', i + ' out of 5, ' + LABELS[i - 1]);
    star.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z"/></svg>';
    starsEl.appendChild(star);
  }

  starsEl.addEventListener('mouseover', function (e) {
    var star = e.target.closest('.rate-star');
    if (star) paint(Number(star.dataset.value));
  });
  starsEl.addEventListener('mouseleave', function () { paint(rating); });

  starsEl.addEventListener('click', function (e) {
    var star = e.target.closest('.rate-star');
    if (!star) return;
    var value = Number(star.dataset.value);
    if (value === rating) return;
    paint(value);
    // A person takes a moment to decide. Anything faster is treated as a script.
    var wait = Math.max(0, 3200 - (Date.now() - rendered));
    setTimeout(function () { submit(value, false); }, wait);
  });

  document.getElementById('rateUndo').addEventListener('click', function () {
    if (busy || !rating) return;
    busy = true;
    say('Removing...');
    post('/feedback/undo', { token: saved.token }).then(function (data) {
      if (data.http !== 200 || !data.ok) {
        say(data.message || 'That did not go through. Try again in a moment.', true);
        return;
      }
      rating = 0;
      remember();
      showSummary(data.summary);
      showMine();
      say('Removed. It no longer counts.');
    }).catch(function () {
      say('I could not reach the server.', true);
    }).then(function () { busy = false; });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (rating && comment.value.trim()) submit(rating, true);
  });

  showMine();

  function load() {
    post('/rating', { token: saved.token }).then(function (data) {
      if (!data.ok) return;
      showSummary(data.summary);
      // The server is the record. If it no longer has this rating, neither do we.
      if ((data.mine || 0) !== rating) {
        rating = data.mine || 0;
        remember();
        showMine();
      }
    }).catch(function () { /* the stars still work */ });
  }

  if ('IntersectionObserver' in window) {
    var seen = new IntersectionObserver(function (entries) {
      if (!entries.some(function (entry) { return entry.isIntersecting; })) return;
      seen.disconnect();
      load();
    }, { rootMargin: '600px' });
    seen.observe(form);
  } else {
    load();
  }
})();
