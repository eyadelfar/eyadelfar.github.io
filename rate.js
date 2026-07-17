(function () {
  'use strict';

  var form = document.getElementById('rateForm');
  if (!form) return;

  var API = window.PORTFOLIO_API || '';
  if (!API) { form.hidden = true; return; }

  var starsEl = document.getElementById('rateStars');
  var more = document.getElementById('rateMore');
  var comment = document.getElementById('rateComment');
  var contact = document.getElementById('rateContact');
  var send = document.getElementById('rateSend');
  var statusEl = document.getElementById('rateStatus');
  var rendered = Date.now();
  var rating = 0;

  var LABELS = ['Bad', 'Poor', 'Fine', 'Good', 'Great'];

  function paint(active) {
    Array.prototype.forEach.call(starsEl.children, function (star, i) {
      star.classList.toggle('on', i < active);
      star.setAttribute('aria-checked', i + 1 === rating ? 'true' : 'false');
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
    rating = Number(star.dataset.value);
    paint(rating);
    more.hidden = false;
    statusEl.textContent = LABELS[rating - 1] + '. Anything you want to add?';
    statusEl.className = 'rate-status';
    comment.focus();
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!rating) return;

    send.disabled = true;
    statusEl.textContent = 'Sending...';

    try {
      var res = await fetch(API + '/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: rating,
          comment: comment.value.trim(),
          contact: contact.value.trim(),
          referrer: document.referrer || '',
          company: form.company.value,
          elapsed_ms: Date.now() - rendered,
        }),
      });
      var data = await res.json().catch(function () { return {}; });

      if (res.ok && data.ok) {
        form.innerHTML = '<p class="rate-done">Thanks, that means a lot.</p>';
        window.trackEvent && window.trackEvent('feedback-' + rating);
      } else {
        statusEl.textContent = data.message || 'That did not go through. Try again in a moment.';
        statusEl.className = 'rate-status warn';
        send.disabled = false;
      }
    } catch (err) {
      statusEl.textContent = 'I could not reach the server. The contact form still works.';
      statusEl.className = 'rate-status warn';
      send.disabled = false;
    }
  });
})();
