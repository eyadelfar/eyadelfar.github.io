/* Chat widget UI.
 *
 * The engine (chat.js) is lazy-imported on first open. It is a thin client: the
 * model runs on Eyad's Cloudflare Worker, so opening this costs the visitor one
 * small script and nothing else — no model download.
 */
(function () {
  'use strict';

  var engine = null;
  var busy = false;

  var launcher = document.getElementById('askBtn');
  var panel = document.getElementById('askPanel');
  if (!launcher || !panel) return;

  // Until the Worker URL is configured, the assistant has nowhere to go. Show
  // nothing rather than a button that leads to a dead end.
  if (!window.PORTFOLIO_API) {
    launcher.hidden = true;
    return;
  }

  var log = document.getElementById('askLog');
  var form = document.getElementById('askForm');
  var input = document.getElementById('askInput');
  var send = document.getElementById('askSend');
  var mic = document.getElementById('askMic');
  var status = document.getElementById('askStatus');

  function setStatus(text) { status.textContent = text || ''; }

  function bubble(who, text) {
    var el = document.createElement('div');
    el.className = 'ask-msg ask-' + who;
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function citations(el, hits, overridden) {
    if (!hits || !hits.length) return;
    var wrap = document.createElement('div');
    wrap.className = 'ask-cites';

    if (overridden) {
      var note = document.createElement('div');
      note.className = 'ask-note';
      // Say so, rather than quietly swapping the answer out.
      note.textContent = 'That contradicted his résumé, so this shows the source text instead.';
      wrap.appendChild(note);
    }

    hits.forEach(function (h) {
      var chip = document.createElement('span');
      chip.className = 'ask-cite';
      chip.textContent = h.title;
      wrap.appendChild(chip);
    });
    el.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
  }

  /* ------------------------------------------------------------- speech */

  function speak(text) {
    if (!window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      window.speechSynthesis.speak(u);
    } catch (e) { /* speech is a bonus, never a blocker */ }
  }

  var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    mic.hidden = true;
  } else {
    mic.addEventListener('click', function () {
      var rec = new Recognition();
      rec.lang = 'en-US';
      rec.interimResults = false;
      mic.classList.add('listening');
      setStatus('Listening…');
      rec.onresult = function (e) {
        // Not auto-sent: let them fix "rag" -> "RAG" before it costs a request.
        input.value = e.results[0][0].transcript;
        input.focus();
      };
      rec.onerror = function () { setStatus('Could not hear that.'); };
      rec.onend = function () { mic.classList.remove('listening'); setStatus(''); };
      rec.start();
    });
  }

  /* ---------------------------------------------------------------- ask */

  var FALLBACK = 'I can’t reach the assistant right now. His résumé is at ' +
    'resume.pdf, and the contact form below reaches him directly.';

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var q = input.value.trim();
    if (!q || busy) return;

    input.value = '';
    bubble('you', q);
    busy = true;
    send.disabled = true;
    if (window.trackEvent) window.trackEvent('chat-message', 'Résumé chat');

    var el = bubble('bot', '');
    el.classList.add('thinking');

    try {
      if (!engine) engine = await import('./chat.js?v=2');
      var out = await engine.ask(q);
      el.classList.remove('thinking');
      el.textContent = out.reply;
      citations(el, out.hits, out.overridden);
      speak(out.reply);
    } catch (err) {
      el.classList.remove('thinking');
      el.textContent = FALLBACK;
      setStatus('');
    }

    busy = false;
    send.disabled = false;
    input.focus();
  });

  /* ------------------------------------------------------------- toggle */

  function open() {
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    input.focus();
    setStatus(window.PORTFOLIO_API
      ? 'Llama 3.3 70B + hybrid retrieval, on my own Cloudflare Worker.'
      : 'The assistant isn’t connected yet — use the contact form below.');
    if (window.trackEvent) window.trackEvent('chat-open', 'Résumé chat opened');
  }
  function close() {
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
  }

  launcher.addEventListener('click', function () { panel.hidden ? open() : close(); });
  document.getElementById('askClose').addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.hidden) close();
  });

  document.querySelectorAll('.ask-suggest').forEach(function (b) {
    b.addEventListener('click', function () {
      input.value = b.textContent;
      form.dispatchEvent(new Event('submit'));
    });
  });
})();
