/* Live voice call with the résumé agent.
 *
 * Real-time, not text-to-speech: mic audio streams as 16kHz PCM over a WebSocket
 * to a Durable Object, Deepgram Nova-3 transcribes it live, the LLM answers
 * grounded in the résumé, and Deepgram Aura-1 streams speech back. Talking over
 * the agent interrupts it, like a phone call.
 */
import { VoiceClient } from './voice-client.js?v=1';

const HOST = 'portfolio-contact.eyadelfar.workers.dev';

let client = null;

/* The orb is driven by two things: the agent's state machine
   (idle → listening → thinking → speaking) and the live mic RMS, which scales it
   in real time so it visibly reacts to your voice rather than just blinking. */
function paint(el, status, level) {
  el.dataset.state = status;
  // A little compression: raw RMS barely moves for normal speech.
  var boost = Math.min(1, Math.pow(level || 0, 0.6) * 2.4);
  el.style.setProperty('--level', boost.toFixed(3));
}

export function isSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.WebSocket);
}

export async function startCall(ui) {
  // A fresh Durable Object per call — no session leaks between visitors.
  var session = 'web-' + Math.random().toString(36).slice(2, 10);

  client = new VoiceClient({
    agent: 'VoiceAgent',
    name: session,
    host: HOST,
  });

  client.addEventListener('statuschange', function (status) {
    paint(ui.orb, status, 0);
    ui.onStatus(status);
  });

  client.addEventListener('audiolevelchange', function (level) {
    paint(ui.orb, ui.orb.dataset.state || 'listening', level);
  });

  // Partial transcript as you speak — proves it's listening, and lets you see
  // it mishear "RAG" before the answer comes back.
  client.addEventListener('interimtranscript', function (text) {
    ui.onInterim(text || '');
  });

  client.addEventListener('transcriptchange', function (messages) {
    ui.onTranscript(messages || []);
  });

  client.addEventListener('custommessage', function (msg) {
    try {
      var data = typeof msg === 'string' ? JSON.parse(msg) : msg;
      if (!data) return;
      // The agent tells us which résumé sections it used, so a call cites too.
      if (data.type === 'sources') ui.onSources(data.sources || []);
      // Barge-in. The server has been broadcasting this all along and the UI threw
      // it away — so the agent's best feature was invisible.
      if (data.type === 'interrupted') ui.onInterrupted();
      if (data.type === 'rate_limited') ui.onError('rate_limited');
    } catch (e) { /* ignore */ }
  });

  // first_audio_ms is the number that proves the streaming pipeline is real.
  client.addEventListener('metricschange', function (m) {
    if (m && m.first_audio_ms) ui.onLatency(m.first_audio_ms);
  });

  client.addEventListener('mutechange', function (muted) {
    ui.onMute(!!muted);
  });

  client.addEventListener('error', function (err) {
    if (err) ui.onError(String(err));
  });

  // connect() opens the WebSocket but returns immediately — it does not await the
  // handshake. Calling startCall() straight after throws "not connected". Wait for
  // the connection event before starting the call.
  var opened = new Promise(function (resolve, reject) {
    var timer = setTimeout(function () {
      reject(new Error('Timed out connecting to the voice agent.'));
    }, 15000);

    client.addEventListener('connectionchange', function (connected) {
      ui.onConnection(!!connected);
      if (connected) {
        clearTimeout(timer);
        resolve();
      }
    });
  });

  client.connect();
  await opened;
  await client.startCall();   // prompts for mic permission
}

/* Typing during a live call. The server treats a text message exactly like a
   transcribed utterance — it thinks, and then SPEAKS the answer back. This has
   worked end-to-end since the first deploy and was simply unreachable. */
export function sendText(text) {
  if (client && text) client.sendText(text);
}

export function toggleMute() {
  if (client) client.toggleMute();
}

export function endCall() {
  if (!client) return;
  try { client.endCall(); } catch (e) { /* ignore */ }
  try { client.disconnect(); } catch (e) { /* ignore */ }
  client = null;
}
