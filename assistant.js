import { renderCitations } from './citations.js?v=1';

const launcher = document.getElementById('askBtn');
const panel = document.getElementById('askPanel');
const embed = window.PF_EMBED || '';

if (launcher && panel && window.PORTFOLIO_API && (!embed || embed === 'browser')) {
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
  const CALL_STAGE = {
    microphone: 'Asking for the microphone…',
    calibrating: 'Measuring the room…',
    connecting: 'Connecting…',
    reconnecting: 'Reconnecting…',
  };
  const CALL_ENDED = {
    idle: 'I did not hear anything for a while, so I hung up. Press Call whenever you want to pick it back up.',
    'mic-denied': 'I need microphone access to talk. Allow it and press Call again.',
    unreachable: 'I could not reach the voice agent. You can still type below, or press Call to try again.',
    dropped: 'The call dropped. Press Call to pick it back up.',
    'rate-limited': 'I have taken enough calls for today. You can still type below, or use the contact form.',
    busy: 'A call is already running in another tab or window. End that one first.',
    'server-ended': 'The call ended on my side. Press Call to start again.',
    refused: 'I could not start the call. You can still type below.',
    unsupported: 'Your browser cannot do voice calls. Type instead.',
  };
  const CHAT_STAGE = {
    retrieving: 'Searching his résumé',
    generating: 'Writing',
    warming: 'The model is waking up',
  };
  const NO_RETRY = new Set(['daily_limit', 'quota_exhausted']);
  const OFFLINE = 'I cannot reach the assistant right now. His resume is at resume.pdf, and the contact form below reaches him directly.';
  const DEFAULT_STATUS = 'Llama 3.3 70B, hybrid retrieval, on my own Cloudflare Worker.';
  const WAKING_MS = 4000;

  let engine = null;
  let voice = null;
  let busy = false;
  let inCall = false;
  let startSeq = 0;
  let wakeTimer = null;
  let callNodes = [];
  let interimNode = null;

  const track = (name) => window.trackEvent && window.trackEvent(name);
  const atBottom = () => log.scrollHeight - log.scrollTop - log.clientHeight < 48;
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
    const down = up === false;
    launcher.hidden = down;
    if (heroAgent) heroAgent.dataset.ai = down ? 'down' : up === true ? 'live' : 'checking';
    if (down && !panel.hidden) closePanel();
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
      clearTimeout(wakeTimer);
      orb.dataset.state = 'idle';
      orb.style.setProperty('--level', 0);
      callbar.dataset.state = 'idle';
      callbar.removeAttribute('data-muted');
      muteBtn.setAttribute('aria-pressed', 'false');
      callNodes = [];
      dropInterim();
    }
  }

  function hangUp() {
    startSeq++;
    voice?.endCall();
    if (!inCall) return;
    setCallMode(false);
    setStatus(DEFAULT_STATUS);
  }

  const callUi = {
    orb,

    onCallState(state, reason) {
      clearTimeout(wakeTimer);

      if (state === 'ended') {
        if (reason === 'restart') return;
        if (CALL_ENDED[reason]) bubble('bot', CALL_ENDED[reason]);
        setCallMode(false);
        setStatus(DEFAULT_STATUS);
        return;
      }

      if (!inCall) setCallMode(true);
      if (state === 'live') {
        setStatus('Talk normally. Silence ends your turn, and talking over me cuts me off.');
        return;
      }

      voiceState.textContent = CALL_STAGE[state] || 'Connecting…';
      callbar.dataset.state = 'idle';
      orb.dataset.state = 'idle';
      setStatus('');
      if (state === 'connecting') {
        wakeTimer = setTimeout(() => { voiceState.textContent = 'Waking the agent…'; }, WAKING_MS);
      }
    },

    onStatus(state) {
      voiceState.textContent = STATE_LABEL[state] || state;
      callbar.dataset.state = state;
    },

    onStall(level) {
      if (level === 'slow') voiceState.textContent = 'Still thinking…';
      else bubble('bot', 'That took too long, so I stopped. Could you ask it again?');
    },

    onNotice(message) {
      console.warn('[voice]', message);
      voiceState.textContent = 'Small hiccup, still on the line';
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
  };

  async function startCall() {
    if (inCall) return;
    const seq = ++startSeq;
    setCallMode(true);
    voiceState.textContent = 'Starting…';
    setStatus('');

    try {
      voice ??= await import('./voice.js?v=5');
      if (seq !== startSeq) return;
      if (!voice.isSupported()) {
        callBtn.disabled = true;
        callUi.onCallState('ended', 'unsupported');
        return;
      }
      track('voice-call');
      await voice.startCall(callUi);
    } catch (err) {
      console.error('[voice] call failed:', err);
      if (seq !== startSeq) return;
      voice?.endCall();
      if (inCall) callUi.onCallState('ended', 'refused');
    }
  }

  function retryButton(el, question) {
    const again = document.createElement('button');
    again.type = 'button';
    again.className = 'ask-retry';
    again.textContent = 'Try again';
    again.addEventListener('click', () => {
      if (busy) return;
      again.remove();
      ask(question, el);
    });
    el.appendChild(again);
  }

  async function ask(question, reuse) {
    if (!reuse) bubble('you', question);
    busy = true;
    send.disabled = true;
    track('chat-message');

    const el = reuse || bubble('bot', '');
    el.classList.add('thinking');
    setText(el, CHAT_STAGE.retrieving);
    let streamed = false;

    try {
      engine ??= await import('./chat.js?v=5');
      const answer = await engine.ask(question, {
        stage(name) {
          if (!streamed && CHAT_STAGE[name]) setText(el, CHAT_STAGE[name]);
        },
        text(soFar) {
          const follow = atBottom();
          streamed = true;
          el.classList.remove('thinking');
          el.classList.add('streaming');
          setText(el, soFar);
          if (follow) scrollDown();
        },
      });

      const follow = atBottom();
      el.classList.remove('thinking', 'streaming');
      setText(el, answer.reply);
      renderCitations(el, answer.hits, answer.overridden);
      if (follow) scrollDown();
    } catch (err) {
      el.classList.remove('thinking', 'streaming');
      if (err?.code === 'cancelled') {
        if (streamed) el.classList.add('ask-stopped');
        else el.remove();
      } else {
        setText(el, err?.message || OFFLINE);
        if (!NO_RETRY.has(err?.code)) retryButton(el, question);
        scrollDown();
      }
    }

    busy = false;
    send.disabled = false;
    if (!panel.hidden) input.focus();
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
    engine?.cancel();
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
      if (next === rail.scrollLeft) return;
      e.preventDefault();
      rail.scrollLeft = next;
    }, { passive: false });

    rail.addEventListener('scroll', sync, { passive: true });
    new ResizeObserver(sync).observe(rail);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const question = input.value.trim();
    if (!question || busy) return;
    input.value = '';

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
    startCall();
  });

  document.addEventListener('ai-availability', (e) => setAvailable(e.detail.up));
  setAvailable(window.AI_AVAILABLE);
  initSuggestScroller(suggests);
} else if (launcher) {
  launcher.hidden = true;
}
