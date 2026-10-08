/* Push-to-talk capture: the microphone is read only between start() and stop(),
   and what comes out is a small 16 kHz WAV with the silence cut off both ends.
   A press with no speech in it yields nothing, so nothing is sent. */

const RATE = 16000;
const MAX_SECONDS = 12;
const FRAME = 320;
const IDLE_RELEASE_MS = 45000;
const MIC = { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 };

let stream = null;
let context = null;
let node = null;
let chunks = null;
let captured = 0;
let releaseTimer = null;

export const supported = () => Boolean(navigator.mediaDevices?.getUserMedia && window.AudioWorkletNode);

async function ready() {
  clearTimeout(releaseTimer);
  if (stream && context?.state !== 'closed') {
    if (context.state === 'suspended') await context.resume();
    return;
  }
  stream = await navigator.mediaDevices.getUserMedia({ audio: MIC });
  context = new (window.AudioContext || window.webkitAudioContext)();
  await context.audioWorklet.addModule('room.mic.worklet.js?v=1ac59957');
  node = new AudioWorkletNode(context, 'room-capture');
  node.port.onmessage = (event) => {
    if (!chunks || captured >= context.sampleRate * MAX_SECONDS) return;
    chunks.push(event.data);
    captured += event.data.length;
  };
  context.createMediaStreamSource(stream).connect(node);
}

export function release() {
  clearTimeout(releaseTimer);
  for (const track of stream?.getTracks() || []) track.stop();
  try { context?.close(); } catch { /* already closed */ }
  stream = null;
  context = null;
  node = null;
  chunks = null;
}

export async function start() {
  await ready();
  chunks = [];
  captured = 0;
}

function resample(samples, from) {
  if (from === RATE) return samples;
  const ratio = from / RATE;
  const out = new Float32Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    // Average the source samples under each output sample: a cheap low-pass.
    const begin = Math.floor(i * ratio);
    const end = Math.min(samples.length, Math.max(begin + 1, Math.floor((i + 1) * ratio)));
    let sum = 0;
    for (let j = begin; j < end; j++) sum += samples[j];
    out[i] = sum / (end - begin);
  }
  return out;
}

function trimSilence(samples) {
  const frames = Math.floor(samples.length / FRAME);
  const loud = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let i = f * FRAME; i < (f + 1) * FRAME; i++) sum += samples[i] * samples[i];
    loud[f] = Math.sqrt(sum / FRAME);
  }
  const sorted = [...loud].sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.2)] || 0;
  const gate = Math.max(0.012, floor * 3);
  let first = 0;
  let last = frames - 1;
  while (first < frames && loud[first] < gate) first++;
  while (last > first && loud[last] < gate) last--;
  if (last - first < 8) return null;
  const pad = 6;
  return samples.subarray(Math.max(0, first - pad) * FRAME, Math.min(frames, last + pad + 1) * FRAME);
}

function wav(samples) {
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const text = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  text(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true); view.setUint32(28, RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(view.buffer);
}

function base64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/* Ends the recording. Resolves to { audio, seconds } or null when nobody spoke. */
export async function stop() {
  const taken = chunks;
  chunks = null;
  releaseTimer = setTimeout(release, IDLE_RELEASE_MS);
  if (!taken?.length || !context) return null;

  const joined = new Float32Array(captured);
  let offset = 0;
  for (const chunk of taken) {
    joined.set(chunk.subarray(0, Math.min(chunk.length, captured - offset)), offset);
    offset += chunk.length;
    if (offset >= captured) break;
  }
  const speech = trimSilence(resample(joined, context.sampleRate));
  if (!speech) return null;
  return { audio: base64(wav(speech)), seconds: speech.length / RATE };
}
