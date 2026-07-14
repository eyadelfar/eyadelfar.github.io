import { renderCitations } from './citations.js?v=1';

const launcher = document.getElementById('askBtn');
const panel = document.getElementById('askPanel');
if (launcher && panel && window.PORTFOLIO_API) {
  const heroAgent = document.querySelector('.hero-agent');
  const log = document.getElementById('askLog');
  const form = document.getElementById('askForm');
  const input = document.getElementById('askInput');
  const send = document.getElementById('askSend');
  const status = document.getElementById('askStatus');
  const suggests = document.getElementById('askSuggests');
  const callBtn = document.getElementById('askCall');
  const callbar = document.getElementById('askCallbar');
  const orb = document.getElementById('voiceOrb');
  const voiceState = document.getElementById('voiceState');
  const muteBtn = document.getElementById('voiceMute');
  const hangBtn = document.getElementById('voiceHang');

  const STATE_LABEL = {
    idle: 'Ready',
    listening: 'Listening',
    thinking: 'Thinking',
    speaking: 'Speaking',
  };
  const OFFLINE = 'I cannot reach the assistant right now. His resume is at resume.pdf, and the contact form below reaches him directly.';
  const DEFAULT_STATUS = 'Llama 3.3 70B, hybrid retrieval, on my own Cloudflare Worker.';

  let engine = null;
  let voice = null;
  let busy = false;
  let inCall = false;
  let callNodes = [];
  let interimNode = null;

  const track = (name) => window.trackEvent && window.trackEvent(name);
  const scrollDown = () => { log.scrollTop = log.scrollHeight; };
  const setStatus = (text) => { status.textContent = text || ''; };

  function bubble(who, text) {
    const el = document.createElement('div');
    el.className = `ask-msg ask-${who}`;
    const body = document.createElement('span');
    body.className = 'msg-text';
    body.textContent = text || '';
    el.appendChild(body);
    log.appendChild(el);
    scrollDown();
    return el;
  }

  const setText = (el, text) => { el.querySelector('.msg-text').textContent = text; };

  function setAvailable(up) {
    const offline = up === false;
    launcher.hidden = offline;
    if (heroAgent) heroAgent.hidden = offline;
    if (offline && !panel.hidden) closePanel();
  }

  function lastBotBubble() {
    for (let i = callNodes.length - 1; i >= 0; i--) {
      if (callNodes[i]?.classList.contains('ask-bot')) return callNodes[i];
    }
    return null;
  }

  function dropInterim() {
    interimNode?.remove();
    interimNode = null;
  }

  function setCallMode(on) {
    inCall = on;
    panel.dataset.mode = on ? 'call' : 'chat';
    callbar.hidden = !on;
    suggests.hidden = on;
    callBtn.hidden = on;
    input.placeholder = on ? 'Talk, or type instead...' : 'Ask a question...';
    if (!on) {
      orb.dataset.state = 'idle';
      orb.style.setProperty('--level', 0);
      callbar.dataset.state = 'idle';
      callNodes = [];
      dropInterim();
    }
  }

  function hangUp() {
    voice?.endCall();
    setCallMode(false);
    setStatus(DEFAULT_STATUS);
  }

  const callUi = {
    orb,

    onStatus(state) {
      voiceState.textContent = STATE_LABEL[state] || state;
      callbar.dataset.state = state;
    },

    onConnection(connected) {
      if (!connected && inCall) voiceState.textContent = 'Reconnecting...';
    },

    onInterim(text) {
      if (!text) return;
      if (!interimNode) {
        interimNode = bubble('you', '');
        interimNode.classList.add('ask-interim');
      }
      setText(interimNode, text);
      scrollDown();
    },

    onTranscript(messages) {
      dropInterim();
      messages.forEach((message, i) => {
        const who = message.role === 'assistant' ? 'bot' : 'you';
        if (!callNodes[i]) callNodes[i] = bubble(who, message.text);
        else if (callNodes[i].querySelector('.msg-text').textContent !== message.text) {
          setText(callNodes[i], message.text);
        }
      });
      scrollDown();
    },

    onSources(sources) {
      const el = lastBotBubble();
      if (!el || el.querySelector('.ask-cites')) return;
      renderCitations(el, sources, false);
      scrollDown();
    },

    onInterrupted() {
      dropInterim();
      const el = lastBotBubble();
      if (!el || el.querySelector('.cut')) return;
      const cut = document.createElement('span');
      cut.className = 'cut';
      cut.textContent = 'cut off';
      el.appendChild(cut);
    },

    onLatency(ms) {
      if (ms > 1200) return;
      const el = lastBotBubble();
      if (!el || el.querySelector('.ask-latency')) return;
      const chip = document.createElement('span');
      chip.className = 'ask-latency';
      chip.textContent = `first audio ${Math.round(ms)} ms`;
      el.appendChild(chip);
    },

    onMute(muted) {
      muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
      callbar.toggleAttribute('data-muted', muted);
    },

    onIdle() {
      bubble('bot', 'I did not hear anything for a while, so I hung up. Press Call whenever you want to pick it back up.');
      setCallMode(false);
      setStatus(DEFAULT_STATUS);
    },

    onError(message) {
      console.error('[voice]', message);
      if (message === 'rate_limited') {
        voiceState.textContent = 'Limit reached';
        bubble('bot', 'I have taken enough calls for today. You can still type below, or use the contact form.');
        hangUp();
        return;
      }
      voiceState.textContent = 'Call failed';
      bubble('bot', /permission|denied|NotAllowed/i.test(message)
        ? 'I need microphone access to talk. Allow it and press Call again.'
        : 'Something went wrong on the call. You can still type below.');
      setCallMode(false);
    },
  };

  async function startCall() {
    if (inCall) return hangUp();
    try {
      voice ??= await import('./voice.js?v=4');
      if (!voice.isSupported()) {
        setStatus('Your browser cannot do voice calls. Type instead.');
        callBtn.disabled = true;
        return;
      }
      setCallMode(true);
      voiceState.textContent = 'Connecting...';
      setStatus('Calibrating to your room...');
      track('voice-call');
      await voice.startCall(callUi);
      setStatus('Talk normally. Silence ends your turn, and talking over me cuts me off.');
    } catch (err) {
      console.error('[voice] call failed:', err);
      callUi.onError(String(err?.message || err));
    }
  }

  async function ask(question) {
    bubble('you', question);
    busy = true;
    send.disabled = true;
    track('chat-message');

    const el = bubble('bot', '');
    el.classList.add('thinking');

    try {
      engine ??= await import('./chat.js?v=4');
      const answer = await engine.ask(question);
      el.classList.remove('thinking');
      setText(el, answer.reply);
      renderCitations(el, answer.hits, answer.overridden);
      scrollDown();
    } catch (err) {
      el.classList.remove('thinking');
      setText(el, err?.message || OFFLINE);
    }

    busy = false;
    send.disabled = false;
    input.focus();
  }

  function openPanel() {
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    input.focus();
    setStatus(DEFAULT_STATUS);
    track('chat-open');
  }

  function closePanel() {
    if (inCall) hangUp();
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
  }

  function initSuggestScroller(rail) {
    const sync = () => {
      const max = rail.scrollWidth - rail.clientWidth;
      rail.dataset.edge = max < 2 ? 'none'
        : rail.scrollLeft < 2 ? 'end'
          : rail.scrollLeft > max - 2 ? 'start'
            : 'both';
    };

    rail.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const step = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      const max = rail.scrollWidth - rail.clientWidth;
      const next = Math.min(max, Math.max(0, rail.scrollLeft + step));
      // At either edge, hand the wheel back or the page cannot scroll past the rail.
      if (next === rail.scrollLeft) return;
      e.preventDefault();
      rail.scrollLeft = next;
    }, { passive: false });

    rail.addEventListener('scroll', sync, { passive: true });
    // The panel starts hidden, so scrollWidth is 0. Measure on resize, not once.
    new ResizeObserver(sync).observe(rail);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const question = input.value.trim();
    if (!question || busy) return;
    input.value = '';

    // Mid-call, a typed question goes down the voice channel and is spoken back.
    // The server echoes it as a transcript entry, so we add no local bubble.
    if (inCall && voice) voice.sendText(question);
    else ask(question);
  });

  launcher.addEventListener('click', () => (panel.hidden ? openPanel() : closePanel()));
  document.getElementById('askClose').addEventListener('click', closePanel);
  callBtn.addEventListener('click', startCall);
  hangBtn.addEventListener('click', hangUp);
  muteBtn.addEventListener('click', () => voice?.toggleMute());
  log.addEventListener('cite-toggle', scrollDown);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) closePanel();
  });

  for (const chip of document.querySelectorAll('.ask-suggest')) {
    chip.addEventListener('click', () => {
      input.value = chip.textContent;
      form.requestSubmit();
    });
  }

  document.querySelector('.js-agent-ask')?.addEventListener('click', () => {
    if (panel.hidden) openPanel();
  });
  document.querySelector('.js-agent-call')?.addEventListener('click', () => {
    if (panel.hidden) openPanel();
    if (!inCall) startCall();
  });

  document.addEventListener('ai-availability', (e) => setAvailable(e.detail.up));
  if (window.AI_AVAILABLE === false) setAvailable(false);
  initSuggestScroller(suggests);
} else if (launcher) {
  launcher.hidden = true;
}
