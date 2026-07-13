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
  var status = document.getElementById('askStatus');

  var callBtn = document.getElementById('askCall');
  var stage = document.getElementById('askVoice');
  var orb = document.getElementById('voiceOrb');
  var vState = document.getElementById('voiceState');
  var vCaption = document.getElementById('voiceCaption');
  var vCites = document.getElementById('voiceCites');
  var vHang = document.getElementById('voiceHang');

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

  /* ------------------------------------------------------- voice call */
  /* A live call, not text-to-speech. Audio streams both ways over a WebSocket to
     a Durable Object; talking over the agent cuts it off mid-sentence. The old
     version used the browser's speechSynthesis, which is a robot reading a
     finished answer aloud — not a conversation. */

  var voice = null;      // the voice.js module, imported on first call
  var inCall = false;

  var LABEL = {
    idle: 'Ready',
    listening: 'Listening',
    thinking: 'Thinking',
    speaking: 'Speaking',
  };

  function showStage(on) {
    inCall = on;
    stage.hidden = !on;
    log.hidden = on;
    form.hidden = on;
    if (!on) {
      orb.dataset.state = 'idle';
      orb.style.setProperty('--level', 0);
      vCaption.textContent = '';
      vCites.innerHTML = '';
    }
  }

  var ui = {
    orb: orb,
    onStatus: function (s) { vState.textContent = LABEL[s] || s; },
    onConnection: function (ok) {
      if (!ok && inCall) vState.textContent = 'Reconnecting…';
    },
    onInterim: function (text) {
      if (text) vCaption.innerHTML = '<b>' + text.replace(/</g, '&lt;') + '</b>';
    },
    onTranscript: function (messages) {
      var last = messages[messages.length - 1];
      if (!last) return;
      vCaption.textContent = last.text;
    },
    onSources: function (titles) {
      vCites.innerHTML = '';
      titles.slice(0, 3).forEach(function (t) {
        var chip = document.createElement('span');
        chip.className = 'ask-cite';
        chip.textContent = t;
        vCites.appendChild(chip);
      });
    },
    onError: function (msg) {
      console.error('[voice] error event:', msg);
      vState.textContent = 'Call failed';
      vCaption.textContent = msg.indexOf('permission') > -1 || msg.indexOf('denied') > -1
        ? 'I need microphone access to talk. Allow it and press Call again.'
        : 'Something went wrong on the call. You can still type below.';
    },
  };

  async function hangUp() {
    if (voice) voice.endCall();
    showStage(false);
    setStatus('Call ended.');
  }

  callBtn.addEventListener('click', async function () {
    if (inCall) return hangUp();

    try {
      if (!voice) voice = await import('./voice.js?v=1');
      if (!voice.isSupported()) {
        setStatus('Your browser can’t do voice calls — type instead.');
        callBtn.disabled = true;
        return;
      }
      showStage(true);
      vState.textContent = 'Connecting…';
      vCaption.textContent = 'Say hello — and feel free to talk over me.';
      if (window.trackEvent) window.trackEvent('voice-call', 'Voice call started');
      await voice.startCall(ui);
    } catch (err) {
      // Log the cause: a voice feature that fails silently is one nobody fixes.
      console.error('[voice] call failed:', err);
      ui.onError(String(err && err.message ? err.message : err));
    }
  });

  vHang.addEventListener('click', hangUp);

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
    // Never leave a call running behind a closed panel — the mic would stay hot.
    if (inCall) hangUp();
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
