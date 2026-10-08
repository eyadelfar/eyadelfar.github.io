/* Sound for the room, made in the browser: there are no audio files. Footsteps
   land when a foot does, and there is a very quiet room tone under everything.
   Nothing plays until the visitor has done something, and one button stops it. */

const STORE = 'pf-room-sound';
const STRIDE = 0.74;

export function start(room) {
  const toggle = document.getElementById('soundToggle');
  let on = true;
  try { on = localStorage.getItem(STORE) !== '0'; } catch { /* private mode */ }
  let audio = null;
  let master = null;
  let noise = null;
  let walked = 0;
  let last = null;

  function build() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return false;
    audio = new Context();
    master = audio.createGain();
    master.gain.value = on ? 1 : 0;
    master.connect(audio.destination);

    // One second of noise, reused for every footstep and looped for the room tone.
    noise = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const data = noise.getChannelData(0);
    let drift = 0;
    for (let i = 0; i < data.length; i++) {
      drift = (drift + (Math.random() * 2 - 1) * 0.06) * 0.985;
      data[i] = (Math.random() * 2 - 1) * 0.5 + drift;
    }

    const tone = audio.createBufferSource();
    tone.buffer = noise;
    tone.loop = true;
    const low = audio.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 180;
    const level = audio.createGain();
    level.gain.value = 0.05;
    tone.connect(low).connect(level).connect(master);
    tone.start();
    return true;
  }

  function wake() {
    if (!audio && !build()) return;
    if (audio.state === 'suspended') audio.resume().catch(() => {});
  }
  for (const event of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(event, wake, { passive: true });

  function footstep(foot = 0, running = false) {
    if (!audio || !on || audio.state !== 'running') return;
    const now = audio.currentTime;
    const loud = running ? 0.2 : 0.13;

    // The scuff of a sole: a short burst of noise, duller for a heel than a toe.
    const scuff = audio.createBufferSource();
    scuff.buffer = noise;
    const band = audio.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 520 + Math.random() * 260;
    band.Q.value = 0.9;
    const scuffLevel = audio.createGain();
    scuffLevel.gain.setValueAtTime(loud, now);
    scuffLevel.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    const side = audio.createStereoPanner ? audio.createStereoPanner() : null;
    if (side) side.pan.value = foot === 0 ? 0.18 : -0.18;
    scuff.connect(band).connect(scuffLevel);
    (side ? scuffLevel.connect(side) : scuffLevel).connect(master);
    scuff.start(now, Math.random() * 0.8, 0.1);

    // And the weight behind it.
    const thump = audio.createOscillator();
    thump.frequency.setValueAtTime(95, now);
    thump.frequency.exponentialRampToValueAtTime(48, now + 0.08);
    const thumpLevel = audio.createGain();
    thumpLevel.gain.setValueAtTime(loud * 0.9, now);
    thumpLevel.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    thump.connect(thumpLevel).connect(master);
    thump.start(now);
    thump.stop(now + 0.12);
  }

  // In third person the character says when a foot lands.
  room.onStep(footstep);

  // In first person there are no feet to watch, so steps are counted by distance.
  let foot = 0;
  room.onFrame(() => {
    const s = room.state();
    if (s.thirdPerson || s.seated) { last = null; return; }
    if (last) {
      walked += Math.hypot(s.x - last[0], s.z - last[1]);
      if (walked > STRIDE) {
        walked = 0;
        foot = 1 - foot;
        footstep(foot, s.speed > 2.4);
      }
    }
    last = [s.x, s.z];
  });

  function set(next) {
    on = next;
    try { localStorage.setItem(STORE, on ? '1' : '0'); } catch { /* private mode */ }
    if (master) master.gain.setTargetAtTime(on ? 1 : 0, audio.currentTime, 0.05);
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(on));
      toggle.title = on ? 'Sound is on' : 'Sound is off';
    }
  }
  toggle?.addEventListener('click', () => set(!on));
  set(on);

  window.room = Object.assign(window.room || {}, { sound: set });
}
