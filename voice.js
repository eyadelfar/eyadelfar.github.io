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

  // The agent tells us which résumé sections it used, so the call can cite too.
  client.addEventListener('custommessage', function (msg) {
    try {
      var data = typeof msg === 'string' ? JSON.parse(msg) : msg;
      if (data && data.type === 'sources') ui.onSources(data.sources || []);
    } catch (e) { /* ignore */ }
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

export function endCall() {
  if (!client) return;
  try { client.endCall(); } catch (e) { /* ignore */ }
  try { client.disconnect(); } catch (e) { /* ignore */ }
  client = null;
}
