/* Chat widget UI. The engine (chat.js) and its ~600MB of model weights are only
   imported once someone actually opens the panel — the landing page must not pay
   for a feature most visitors never touch. */
(function () {
  'use strict';

  var engine = null;      // the chat.js module, once imported
  var state = 'idle';     // idle | loading | ready | nogpu | failed
  var busy = false;

  var launcher = document.getElementById('askBtn');
  var panel = document.getElementById('askPanel');
  if (!launcher || !panel) return;

  var log = document.getElementById('askLog');
  var form = document.getElementById('askForm');
  var input = document.getElementById('askInput');
  var send = document.getElementById('askSend');
  var mic = document.getElementById('askMic');
  var status = document.getElementById('askStatus');
  var bar = document.getElementById('askBarFill');
  var progress = document.getElementById('askProgress');

  /* ------------------------------------------------------------ rendering */

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
      // Be honest about it rather than quietly swapping the answer.
      note.textContent = 'The model’s answer contradicted his resume, so this shows the source text instead.';
      wrap.appendChild(note);
    }

    hits.forEach(function (h) {
      var chip = document.createElement('span');
      chip.className = 'ask-cite';
      chip.textContent = h.title;
      chip.title = h.text;
      wrap.appendChild(chip);
    });
    el.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
  }

  function setStatus(text) { status.textContent = text || ''; }

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
        input.value = e.results[0][0].transcript;
        // Deliberately not auto-sent: let them fix "rag" -> "RAG" first.
        input.focus();
      };
      rec.onerror = function () { setStatus('Could not hear that.'); };
      rec.onend = function () { mic.classList.remove('listening'); setStatus(''); };
      rec.start();
    });
  }

  /* --------------------------------------------------------------- boot */

  async function boot() {
    if (state === 'loading' || state === 'ready' || state === 'nogpu') return;
    state = 'loading';
    progress.hidden = false;
    send.disabled = true;

    try {
      engine = await import('./chat.js?v=1');

      if (!(await engine.webgpuAvailable())) {
        // No WebGPU (Firefox, older Safari, some mobiles). Rather than showing a
        // dead widget, fall back to retrieval-only: real answers, no generation.
        state = 'nogpu';
        progress.hidden = true;
        send.disabled = false;
        setStatus('Search mode — your browser has no WebGPU, so answers quote his resume directly.');
        return;
      }

      await engine.init(function (r) {
        bar.style.width = Math.round((r.progress || 0) * 100) + '%';
        setStatus(r.text || 'Loading…');
      });

      state = 'ready';
      progress.hidden = true;
      send.disabled = false;
      setStatus('Running Qwen3.5-0.8B locally in your browser.');
    } catch (err) {
      // Never leave a dead widget: retrieval-only still answers from the resume.
      state = 'nogpu';
      progress.hidden = true;
      send.disabled = false;
      setStatus('Model unavailable — answering from his résumé directly instead.');
    }
  }

  /* --------------------------------------------------------------- ask */

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var q = input.value.trim();
    if (!q || busy) return;

    input.value = '';
    bubble('you', q);
    busy = true;
    send.disabled = true;
    if (window.trackEvent) window.trackEvent('chat-message', 'Resume chat');

    var el = bubble('bot', '');
    el.classList.add('thinking');

    try {
      if (state === 'nogpu' || state === 'failed') {
        var res = await engine.answerWithoutLLM(q);
        el.classList.remove('thinking');
        el.textContent = res.reply;
        citations(el, res.hits, false);
      } else {
        var out = await engine.ask(q, function (partial) {
          el.classList.remove('thinking');
          el.textContent = partial;
          log.scrollTop = log.scrollHeight;
        });
        el.classList.remove('thinking');
        el.textContent = out.reply;
        citations(el, out.hits, out.overridden);
        speak(out.reply);
      }
    } catch (err) {
      el.classList.remove('thinking');
      el.textContent = 'Something went wrong. His resume is at resume.pdf, and the contact form below reaches him directly.';
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
    boot();
    if (window.trackEvent) window.trackEvent('chat-open', 'Resume chat opened');
  }
  function close() {
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
  }

  launcher.addEventListener('click', function () {
    panel.hidden ? open() : close();
  });
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
