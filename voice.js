import { VoiceClient } from './voice-client.js?v=1';

const HOST = 'portfolio-contact.eyadelfar.workers.dev';
const CONNECT_TIMEOUT = 15000;

let client = null;

function paint(orb, state, level) {
  orb.dataset.state = state;
  const boost = Math.min(1, Math.pow(level || 0, 0.6) * 2.4);
  orb.style.setProperty('--level', boost.toFixed(3));
}

export function isSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.WebSocket);
}

export async function startCall(ui) {
  client = new VoiceClient({
    agent: 'VoiceAgent',
    name: `web-${Math.random().toString(36).slice(2, 10)}`,
    host: HOST,
  });

  client.addEventListener('statuschange', (state) => {
    paint(ui.orb, state, 0);
    ui.onStatus(state);
  });
  client.addEventListener('audiolevelchange', (level) => {
    paint(ui.orb, ui.orb.dataset.state || 'listening', level);
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
}

export function sendText(text) {
  if (client && text) client.sendText(text);
}

export function toggleMute() {
  client?.toggleMute();
}

export function endCall() {
  if (!client) return;
  try { client.endCall(); } catch { /* ignore */ }
  try { client.disconnect(); } catch { /* ignore */ }
  client = null;
}
