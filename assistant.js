/* Résumé assistant UI — text chat and live voice, in one conversation.
 *
 * The model runs on Eyad's own Cloudflare Worker, so opening this costs the
 * visitor one small script and nothing else. The engine (chat.js) and the voice
 * client are lazy-imported on first use.
 */
(function () {
  'use strict';

  var engine = null;
  var voice = null;
  var busy = false;
  var inCall = false;

  var launcher = document.getElementById('askBtn');
  var panel = document.getElementById('askPanel');
  if (!launcher || !panel) return;

  var heroAgent = document.querySelector('.hero-agent');

  var log = document.getElementById('askLog');
  var form = document.getElementById('askForm');
  var input = document.getElementById('askInput');
  var send = document.getElementById('askSend');
  var status = document.getElementById('askStatus');
  var suggests = document.getElementById('askSuggests');

  var callBtn = document.getElementById('askCall');
  var callbar = document.getElementById('askCallbar');
  var orb = document.getElementById('voiceOrb');
  var vState = document.getElementById('voiceState');
  var muteBtn = document.getElementById('voiceMute');
  var hangBtn = document.getElementById('voiceHang');

  function setStatus(text) { status.textContent = text || ''; }

  /* --------------------------------------------------- availability gate */
  /* The AI runs on a free daily quota. When it runs out, hide the entry points
     entirely — a button that leads to "sorry, I'm offline" is worse than no
     button, and the contact form is right there. */
  function applyAvailability(up) {
    var dead = up === false;
    launcher.hidden = dead;
    if (heroAgent) heroAgent.hidden = dead;
    if (dead && !panel.hidden) close();
  }

  if (!window.PORTFOLIO_API) { applyAvailability(false); return; }
  if (window.AI_AVAILABLE === false) applyAvailability(false);
  document.addEventListener('ai-availability', function (e) { applyAvailability(e.detail.up); });

  /* ------------------------------------------------------------ bubbles */

  function bubble(who, text) {
    var el = document.createElement('div');
    el.className = 'ask-msg ask-' + who;
    var body = document.createElement('span');
    body.className = 'msg-text';
    body.textContent = text || '';
    el.appendChild(body);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  var setText = function (el, text) { el.querySelector('.msg-text').textContent = text; };

  /* ---------------------------------------------------------- citations */

  /* bge-small scores off-topic text around 0.2-0.35 and a real match around
     0.5-0.75. Below this is noise — it's what made "hi" cite four unrelated
     projects. The server applies the same gate; this is belt and braces for any
     cached client still running the old engine. */
  var CITE_MIN = 0.42;

  function citations(el, hits, overridden) {
    var good = (hits || []).filter(function (h) {
      return h.score === undefined || h.score >= CITE_MIN;
    }).slice(0, 3);
    if (!good.length) return;

    var wrap = document.createElement('div');
    wrap.className = 'ask-cites';

    if (overridden) {
      var note = document.createElement('div');
      note.className = 'ask-note';
      note.textContent = 'That contradicted his résumé, so this shows the source text instead.';
      wrap.appendChild(note);
    }

    var label = document.createElement('span');
    label.className = 'ask-cites-label';
    label.textContent = 'Grounded in';
    wrap.appendChild(label);

    // One shared body per message: only one passage open at a time, which keeps a
    // 400px panel from turning into an accordion.
    var body = document.createElement('div');
    body.className = 'ask-cite-body';
    body.hidden = true;

    good.forEach(function (h) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'ask-cite';
      chip.setAttribute('aria-expanded', 'false');
      chip.textContent = h.title;

      if (h.score !== undefined) {
        var score = document.createElement('span');
        score.className = 'cite-score';
        score.textContent = h.score.toFixed(2);
        chip.appendChild(score);
      }

      chip.addEventListener('click', function () {
        var open = chip.getAttribute('aria-expanded') === 'true';
        wrap.querySelectorAll('.ask-cite').forEach(function (c) {
          c.setAttribute('aria-expanded', 'false');
        });
        if (open) {
          body.hidden = true;
        } else {
          chip.setAttribute('aria-expanded', 'true');
          body.textContent = h.text || '(passage unavailable)';
          body.hidden = false;
        }
        log.scrollTop = log.scrollHeight;
      });

      wrap.appendChild(chip);
    });

    wrap.appendChild(body);
    el.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
  }

  /* --------------------------------------------------------- call mode */
  /* A call is a MODE of the same conversation, not a takeover. The old version
     hid the transcript and the input behind an orb, which threw away all context
     and gave the visitor nowhere to go. */

  var LABEL = { idle: 'Ready', listening: 'Listening', thinking: 'Thinking', speaking: 'Speaking' };

  var callNodes = [];      // bubbles, index-aligned with the server's transcript
  var interimNode = null;

  function setCallMode(on) {
    inCall = on;
    panel.dataset.mode = on ? 'call' : 'chat';
    callbar.hidden = !on;
    if (suggests) suggests.hidden = on;
    callBtn.hidden = on;                       // End call in the bar owns hangup
    input.placeholder = on ? 'Talk — or type instead…' : 'Ask a question…';
    if (!on) {
      orb.dataset.state = 'idle';
      orb.style.setProperty('--level', 0);
      callbar.dataset.state = 'idle';
      callNodes = [];
      dropInterim();
    }
  }

  function dropInterim() {
    if (interimNode) { interimNode.remove(); interimNode = null; }
  }

  function lastBotBubble() {
    for (var i = callNodes.length - 1; i >= 0; i--) {
      if (callNodes[i] && callNodes[i].classList.contains('ask-bot')) return callNodes[i];
    }
    return null;
  }

  var ui = {
    orb: orb,

    onStatus: function (s) {
      vState.textContent = LABEL[s] || s;
      // Drives the hint swap: the moment it starts speaking, the bar tells you
      // you can cut it off.
      callbar.dataset.state = s;
    },

    onConnection: function (ok) {
      if (!ok && inCall) vState.textContent = 'Reconnecting…';
    },

    // A ghost bubble showing what it thinks you're saying, right now.
    onInterim: function (text) {
      if (!text) return;
      if (!interimNode) {
        interimNode = bubble('you', '');
        interimNode.classList.add('ask-interim');
      }
      setText(interimNode, text);
      log.scrollTop = log.scrollHeight;
    },

    // Diff-render the server's transcript into real bubbles in the real log.
    onTranscript: function (messages) {
      dropInterim();
      messages.forEach(function (m, i) {
        var who = m.role === 'assistant' ? 'bot' : 'you';
        if (!callNodes[i]) callNodes[i] = bubble(who, m.text);
        else if (callNodes[i].querySelector('.msg-text').textContent !== m.text) {
          setText(callNodes[i], m.text);
        }
      });
      log.scrollTop = log.scrollHeight;
    },

    onSources: function (titles) {
      var el = lastBotBubble();
      if (!el || el.querySelector('.ask-cites')) return;
      citations(el, (titles || []).map(function (t) {
        return typeof t === 'string' ? { title: t } : t;
      }), false);
    },

    // The barge-in made visible. This is the whole point of a live voice agent.
    onInterrupted: function () {
      dropInterim();
      var el = lastBotBubble();
      if (!el || el.querySelector('.cut')) return;
      var cut = document.createElement('span');
      cut.className = 'cut';
      cut.textContent = '— cut off —';
      el.appendChild(cut);
    },

    // Only brag when the number is good. A chip reading "2,400 ms" is an own goal.
    onLatency: function (ms) {
      if (ms > 1200) return;
      var el = lastBotBubble();
      if (!el || el.querySelector('.ask-latency')) return;
      var chip = document.createElement('span');
      chip.className = 'ask-latency';
      chip.textContent = '↯ first audio ' + Math.round(ms) + ' ms';
      el.appendChild(chip);
    },

    onMute: function (muted) {
      muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
      callbar.toggleAttribute('data-muted', muted);
    },

    onError: function (msg) {
      console.error('[voice]', msg);
      if (msg === 'rate_limited') {
        vState.textContent = 'Limit reached';
        bubble('bot', "I've taken enough calls for today. You can still type below, or use the contact form.");
        hangUp();
        return;
      }
      vState.textContent = 'Call failed';
      bubble('bot', /permission|denied|NotAllowed/i.test(msg)
        ? 'I need microphone access to talk. Allow it and press Call again.'
        : 'Something went wrong on the call — you can still type below.');
      setCallMode(false);
    },
  };

  function hangUp() {
    if (voice) voice.endCall();
    setCallMode(false);
    setStatus('Call ended.');
  }

  callBtn.addEventListener('click', async function () {
    if (inCall) return hangUp();
    try {
      if (!voice) voice = await import('./voice.js?v=2');
      if (!voice.isSupported()) {
        setStatus('Your browser can’t do voice calls — type instead.');
        callBtn.disabled = true;
        return;
      }
      setCallMode(true);
      vState.textContent = 'Connecting…';
      window.trackEvent && window.trackEvent('voice-call');
      await voice.startCall(ui);
    } catch (err) {
      console.error('[voice] call failed:', err);
      ui.onError(String(err && err.message ? err.message : err));
    }
  });

  hangBtn.addEventListener('click', hangUp);
  muteBtn.addEventListener('click', function () { if (voice) voice.toggleMute(); });

  /* ---------------------------------------------------------------- ask */

  var FALLBACK = 'I can’t reach the assistant right now. His résumé is at ' +
    'resume.pdf, and the contact form below reaches him directly.';

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var q = input.value.trim();
    if (!q || busy) return;
    input.value = '';

    // Mid-call, a typed question goes down the voice channel — the agent SPEAKS
    // the answer. No local bubble: the server echoes it back as a transcript
    // entry, and the diff-renderer paints it.
    if (inCall && voice) {
      voice.sendText(q);
      return;
    }

    bubble('you', q);
    busy = true;
    send.disabled = true;
    window.trackEvent && window.trackEvent('chat-message');

    var el = bubble('bot', '');
    el.classList.add('thinking');

    try {
      if (!engine) engine = await import('./chat.js?v=3');
      var out = await engine.ask(q);
      el.classList.remove('thinking');
      setText(el, out.reply);
      citations(el, out.hits, out.overridden);
    } catch (err) {
      el.classList.remove('thinking');
      setText(el, err && err.message ? err.message : FALLBACK);
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
    setStatus('Llama 3.3 70B · hybrid retrieval · on my own Cloudflare Worker.');
    window.trackEvent && window.trackEvent('chat-open');
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

  // The hero card is the above-the-fold entry point into the assistant.
  var heroAsk = document.querySelector('.js-agent-ask');
  var heroCall = document.querySelector('.js-agent-call');
  if (heroAsk) heroAsk.addEventListener('click', function () { if (panel.hidden) open(); });
  if (heroCall) {
    heroCall.addEventListener('click', function () {
      if (panel.hidden) open();
      if (!inCall) callBtn.click();
    });
  }
})();
