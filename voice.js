import { VoiceClient } from './voice-client.js?v=1';

const API = String(window.PORTFOLIO_API || 'https://portfolio-contact.eyadelfar.workers.dev').replace(/\/+$/, '');
const SOCKET_BASE = `${API.replace(/^http/, 'ws')}/agents/voice-agent/`;

const CONNECT_DEADLINE = 15000;
const ATTEMPT_TIMEOUT = 7000;
const RETRY_DELAYS = [400, 1500];
const IDLE_TIMEOUT = 60000;
const CALIBRATION_MS = 700;
const THINKING_SLOW = 6000;
const THINKING_GIVE_UP = 15000;
const LOCK_NAME = 'pf-voice-call';

const MIC = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
};

let generation = 0;
let current = null;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const randomId = () => Math.random().toString(36).slice(2, 10);

class CallSocket {
  onopen = null;
  onclose = null;
  onerror = null;
  onmessage = null;

  #url;
  #onGiveUp;
  #socket = null;
  #closed = false;
  #retries = 0;
  #retryTimer = null;
  #attemptTimer = null;
  #dropAudio = false;

  constructor(url, onGiveUp) {
    this.#url = url;
    this.#onGiveUp = onGiveUp;
  }

  get connected() {
    return this.#socket?.readyState === WebSocket.OPEN;
  }

  sendJSON(data) {
    if (!this.connected) return;
    if (data?.type === 'interrupt') this.#dropAudio = true;
    this.#socket.send(JSON.stringify(data));
  }

  sendBinary(data) {
    if (this.connected) this.#socket.send(data);
  }

  connect() {
    if (this.#socket || this.#closed) return;
    this.#open();
  }

  disconnect() {
    this.#closed = true;
    clearTimeout(this.#retryTimer);
    clearTimeout(this.#attemptTimer);
    const socket = this.#socket;
    this.#socket = null;
    try { socket?.close(); } catch { /* already closed */ }
  }

  #open() {
    const socket = new WebSocket(this.#url);
    socket.binaryType = 'arraybuffer';
    this.#socket = socket;

    this.#attemptTimer = setTimeout(() => {
      try { socket.close(); } catch { /* ignore */ }
    }, ATTEMPT_TIMEOUT);

    socket.onopen = () => {
      if (this.#socket !== socket) return;
      clearTimeout(this.#attemptTimer);
      this.#retries = 0;
      this.#dropAudio = false;
      this.onopen?.();
    };

    socket.onmessage = (event) => {
      if (this.#socket !== socket) return;
      if (typeof event.data !== 'string') {
        if (!this.#dropAudio) this.onmessage?.(event.data);
        return;
      }
      if (this.#dropAudio && event.data.includes('"listening"')) this.#dropAudio = false;
      this.onmessage?.(event.data);
    };

    socket.onclose = () => {
      if (this.#socket !== socket) return;
      clearTimeout(this.#attemptTimer);
      this.#socket = null;
      this.onclose?.();
      if (this.#closed) return;

      if (this.#retries >= RETRY_DELAYS.length) {
        this.#closed = true;
        this.#onGiveUp();
        return;
      }
      this.#retryTimer = setTimeout(() => this.#open(), RETRY_DELAYS[this.#retries++]);
    };
  }
}

async function noiseFloor(stream) {
  let ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);

    const buffer = new Float32Array(analyser.fftSize);
    const samples = [];
    const started = performance.now();

    while (performance.now() - started < CALIBRATION_MS) {
      analyser.getFloatTimeDomainData(buffer);
      let sum = 0;
      for (const v of buffer) sum += v * v;
      samples.push(Math.sqrt(sum / buffer.length));
      await new Promise((r) => setTimeout(r, 40));
    }

    samples.sort((a, b) => a - b);
    return samples[Math.floor(samples.length * 0.9)] || 0;
  } catch {
    return null;
  } finally {
    try { await ctx?.close(); } catch { /* ignore */ }
  }
}

function gates(floor) {
  if (floor === null) return {};
  return {
    silenceThreshold: clamp(floor * 1.8, 0.02, 0.14),
    silenceDurationMs: 700,
    interruptThreshold: clamp(floor * 4, 0.09, 0.3),
    interruptChunks: 3,
  };
}

const stopStream = (stream) => {
  for (const track of stream?.getTracks?.() || []) track.stop();
};

function acquireCallLock() {
  if (navigator.locks?.request) {
    return new Promise((resolve) => {
      navigator.locks.request(LOCK_NAME, { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(null);
          return undefined;
        }
        return new Promise((release) => resolve(release));
      }).catch(() => resolve(() => {}));
    });
  }

  if (typeof BroadcastChannel !== 'function') return Promise.resolve(() => {});

  return new Promise((resolve) => {
    const channel = new BroadcastChannel(LOCK_NAME);
    const id = randomId();
    let holding = false;
    const timer = setTimeout(() => {
      holding = true;
      resolve(() => channel.close());
    }, 180);

    channel.onmessage = (event) => {
      const message = event.data || {};
      if (message.type === 'claim' && holding) channel.postMessage({ type: 'busy', to: message.id });
      if (message.type === 'busy' && message.to === id && !holding) {
        clearTimeout(timer);
        channel.close();
        resolve(null);
      }
    };
    channel.postMessage({ type: 'claim', id });
  });
}

export function isSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.WebSocket);
}

function finish(reason) {
  const call = current;
  if (!call) return;
  current = null;
  generation++;

  clearTimeout(call.idleTimer);
  clearTimeout(call.deadline);
  clearTimeout(call.slowTimer);
  clearTimeout(call.giveUpTimer);
  try { call.client?.endCall(); } catch { /* ignore */ }
  try { call.client?.disconnect(); } catch { /* ignore */ }
  stopStream(call.probe);
  call.release?.();
  call.wake?.();

  call.ui.onCallState('ended', reason);
}

export async function startCall(ui) {
  finish('restart');

  const gen = ++generation;
  const call = { gen, ui, client: null, probe: null, release: null, acknowledged: false, opened: false };
  current = call;
  const alive = () => generation === gen;
  const state = (name) => { if (alive()) ui.onCallState(name); };

  call.release = await acquireCallLock();
  if (!alive()) {
    call.release?.();
    return;
  }
  if (!call.release) return finish('busy');

  state('microphone');
  try {
    call.probe = await navigator.mediaDevices.getUserMedia({ audio: MIC });
  } catch {
    if (alive()) finish('mic-denied');
    return;
  }
  if (!alive()) return stopStream(call.probe);

  state('calibrating');
  const tuning = gates(await noiseFloor(call.probe));
  if (!alive()) return;

  state('connecting');
  const id = randomId();
  const transport = new CallSocket(
    `${SOCKET_BASE}web-${id}?_pk=${id}${randomId()}`,
    () => { if (alive()) finish(call.acknowledged ? 'dropped' : 'unreachable'); },
  );
  const client = new VoiceClient({ agent: 'VoiceAgent', transport, ...tuning });
  call.client = client;

  const on = (event, handler) => client.addEventListener(event, (data) => { if (alive()) handler(data); });

  const stayAwake = () => {
    clearTimeout(call.idleTimer);
    call.idleTimer = setTimeout(() => { if (alive()) finish('idle'); }, IDLE_TIMEOUT);
  };

  const watchThinking = (thinking) => {
    clearTimeout(call.slowTimer);
    clearTimeout(call.giveUpTimer);
    if (!thinking) return;
    call.slowTimer = setTimeout(() => { if (alive()) ui.onStall('slow'); }, THINKING_SLOW);
    call.giveUpTimer = setTimeout(() => {
      if (!alive()) return;
      client.sendJSON({ type: 'interrupt' });
      ui.onStall('gave-up');
    }, THINKING_GIVE_UP);
  };

  on('statuschange', (status) => {
    watchThinking(status === 'thinking');

    if (status === 'idle') {
      if (call.acknowledged || call.refused) finish(call.limited ? 'rate-limited' : call.acknowledged ? 'server-ended' : 'refused');
      return;
    }

    if (!call.acknowledged) {
      call.acknowledged = true;
      clearTimeout(call.deadline);
    }
    ui.onCallState('live');
    ui.orb.dataset.state = status;
    ui.onStatus(status);
    if (status !== 'listening') stayAwake();
  });

  on('audiolevelchange', (level) => {
    const boost = Math.min(1, Math.pow(level || 0, 0.6) * 2.4);
    ui.orb.style.setProperty('--level', boost.toFixed(3));
    if (tuning.silenceThreshold && level > tuning.silenceThreshold) stayAwake();
  });

  on('interimtranscript', (text) => ui.onInterim(text || ''));
  on('transcriptchange', (messages) => ui.onTranscript(messages || []));
  on('mutechange', (muted) => ui.onMute(!!muted));

  on('error', (message) => {
    if (!message) return;
    if (!call.acknowledged) call.refused = true;
    else ui.onNotice(String(message));
  });

  on('metricschange', (metrics) => {
    if (metrics?.first_audio_ms) ui.onLatency(metrics.first_audio_ms);
  });

  on('custommessage', (raw) => {
    let message = raw;
    try { if (typeof raw === 'string') message = JSON.parse(raw); } catch { return; }
    if (message?.type === 'sources') ui.onSources(message.sources || []);
    if (message?.type === 'interrupted') ui.onInterrupted();
    if (message?.type === 'rate_limited') {
      call.limited = true;
      call.refused = true;
    }
  });

  const opened = new Promise((resolve) => {
    call.wake = resolve;
    on('connectionchange', (connected) => {
      if (connected) {
        call.opened = true;
        resolve();
        return;
      }
      if (call.opened) ui.onCallState('reconnecting');
    });
  });

  call.deadline = setTimeout(() => { if (alive()) finish('unreachable'); }, CONNECT_DEADLINE);

  client.connect();
  await opened;
  if (!alive()) return;

  await client.startCall();
  stopStream(call.probe);
  call.probe = null;
  if (!alive()) return;

  stayAwake();
}

export function sendText(text) {
  if (current?.client && text) current.client.sendText(text);
}

export function toggleMute() {
  current?.client?.toggleMute();
}

export function endCall() {
  finish('hangup');
}

window.addEventListener('pagehide', () => finish('pagehide'));
window.addEventListener('message', (event) => {
  if (event.source === window.parent && event.data?.type === 'portfolio:hangup') finish('hangup');
});
