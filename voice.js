import { VoiceClient } from './voice-client.js?v=1';

const HOST = 'portfolio-contact.eyadelfar.workers.dev';
const CONNECT_TIMEOUT = 15000;
const IDLE_TIMEOUT = 60000;
const CALIBRATION_MS = 700;

const MIC = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
};

let client = null;
let idleTimer = null;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// The client's 0.04 RMS silence default assumes a quiet room. Above that floor it
// never detects silence, so the turn never ends. Measure the real room instead.
async function noiseFloor() {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: MIC });
  } catch {
    return null;
  }

  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
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

    await ctx.close();

    samples.sort((a, b) => a - b);
    return samples[Math.floor(samples.length * 0.9)] || 0;
  } catch {
    return null;
  } finally {
    for (const track of stream.getTracks()) track.stop();
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

export function isSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.WebSocket);
}

export async function startCall(ui) {
  const tuning = gates(await noiseFloor());

  client = new VoiceClient({
    agent: 'VoiceAgent',
    name: `web-${Math.random().toString(36).slice(2, 10)}`,
    host: HOST,
    ...tuning,
  });

  const goIdle = () => {
    ui.onIdle();
    endCall();
  };
  const keepAlive = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(goIdle, IDLE_TIMEOUT);
  };

  client.addEventListener('statuschange', (state) => {
    ui.orb.dataset.state = state;
    ui.onStatus(state);
    if (state !== 'listening') keepAlive();
  });

  client.addEventListener('audiolevelchange', (level) => {
    const boost = Math.min(1, Math.pow(level || 0, 0.6) * 2.4);
    ui.orb.style.setProperty('--level', boost.toFixed(3));
    if (tuning.silenceThreshold && level > tuning.silenceThreshold) keepAlive();
  });

  client.addEventListener('interimtranscript', (text) => ui.onInterim(text || ''));
  client.addEventListener('transcriptchange', (messages) => ui.onTranscript(messages || []));
  client.addEventListener('mutechange', (muted) => ui.onMute(!!muted));
  client.addEventListener('error', (err) => err && ui.onError(String(err)));

  client.addEventListener('metricschange', (metrics) => {
    if (metrics?.first_audio_ms) ui.onLatency(metrics.first_audio_ms);
  });

  client.addEventListener('custommessage', (raw) => {
    try {
      const message = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (message?.type === 'sources') ui.onSources(message.sources || []);
      if (message?.type === 'interrupted') ui.onInterrupted();
      if (message?.type === 'rate_limited') ui.onError('rate_limited');
    } catch { /* ignore */ }
  });

  // connect() returns before the socket opens. startCall() straight after throws
  // "not connected", so wait for the connection event.
  const opened = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out connecting to the voice agent.')), CONNECT_TIMEOUT);
    client.addEventListener('connectionchange', (connected) => {
      ui.onConnection(!!connected);
      if (connected) {
        clearTimeout(timer);
        resolve();
      }
    });
  });

  client.connect();
  await opened;
  await client.startCall();
  keepAlive();
}

export function sendText(text) {
  if (client && text) client.sendText(text);
}

export function toggleMute() {
  client?.toggleMute();
}

export function endCall() {
  clearTimeout(idleTimer);
  idleTimer = null;
  if (!client) return;
  try { client.endCall(); } catch { /* ignore */ }
  try { client.disconnect(); } catch { /* ignore */ }
  client = null;
}
