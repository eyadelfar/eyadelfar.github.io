import { isStop, parse } from './room.intents.js?v=84827262';
import { makeNav } from './room.nav.js?v=b4344da9';
import * as TOOLS from './room.tools.js?v=1619a99d';

const API = String(window.PORTFOLIO_API || '').replace(/\/+$/, '');
const STORE = 'pf-room-guide';
const WALK_SPEED = 1.5;
const ARRIVE = 0.12;
const WALK_LIMIT_S = 45;
const DWELL_MS = 3600;
const REQUEST_MS = 20000;
const MIN_HOLD_MS = 280;
const TALK_KEY = 'KeyP';

const GREETING = "I'm the guide. Ask me to show you something, like the voice agents, or say: give me a tour.";
const NOT_HEARD = 'I did not hear anything. Hold P down while you talk.';
const CANNOT_HEAR = 'I cannot listen right now. Type what you want to see instead.';
const LIMITED = 'I can only follow simple requests right now. Try: show me the voice agents.';
const NO_MIC = 'I could not use the microphone. You can type instead.';

const MIC_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/></svg>';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const lerp = (a, b, t) => a + (b - a) * Math.min(1, t);
function turnTo(from, to, t) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return { next: from + diff * Math.min(1, t), left: Math.abs(diff) };
}
const facing = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));

function describe(action) {
  const place = TOOLS.PLACES[action.place]?.label;
  switch (action.tool) {
    case 'go_to': return `walk to ${place}`;
    case 'present': return `show ${place}`;
    case 'terminal': return `run "${action.command}" on the terminal`;
    case 'browser': return `open ${action.tab} in the browser`;
    case 'contact': return 'take you to the contact form';
    case 'view': return action.mode === 'first_person' ? 'switch to first person' : 'switch to third person';
    case 'sit': return 'sit at the workstation';
    case 'stand': return 'stand up';
    default: return 'close what is open';
  }
}

export function start(room) {
  const nav = makeNav(room.viable);
  const speech = { supported: false, module: null };
  let on = false;
  let run = null;
  let walk = null;
  let settle = null;
  let voice = null;
  let recording = null;
  let history = [];

  /* ---------- the dock ---------- */
  const dock = document.createElement('section');
  dock.id = 'guide';
  dock.className = 'guide';
  dock.hidden = true;
  dock.dataset.state = 'idle';
  dock.setAttribute('aria-label', 'Room guide');
  dock.innerHTML = `
    <header class="guide-head">
      <span class="guide-orb" aria-hidden="true"></span>
      <strong>Guide</strong>
      <span class="guide-status" role="status"></span>
      <button type="button" class="guide-chip" data-act="tools" aria-expanded="false">Tools</button>
      <button type="button" class="guide-x" data-act="off" aria-label="Turn the guide off" title="Turn the guide off">×</button>
    </header>
    <div class="guide-body" aria-live="polite">
      <p class="guide-heard" hidden></p>
      <p class="guide-say" hidden></p>
      <ol class="guide-trace" hidden></ol>
    </div>
    <ul class="guide-tools" hidden>${TOOLS.TOOLS.map((tool) => `<li><code>${tool.name}${tool.arg ? `(${tool.arg})` : '()'}</code><span>${tool.does}</span><em>“${tool.example}”</em></li>`).join('')}</ul>
    <form class="guide-form">
      <button type="button" class="guide-mic" aria-label="Hold to talk" title="Hold to talk">${MIC_ICON}</button>
      <input class="guide-input" type="text" maxlength="300" autocomplete="off" spellcheck="false" placeholder="Tell the guide what to show you" aria-label="Tell the guide what to show you">
      <button type="submit" class="guide-send">Send</button>
    </form>
    <p class="guide-note">Your voice is transcribed to answer you and is not stored. Requests are logged without your name.</p>`;
  document.body.appendChild(dock);

  const el = (name) => dock.querySelector(`.guide-${name}`);
  const statusEl = el('status');
  const heardEl = el('heard');
  const sayEl = el('say');
  const traceEl = el('trace');
  const toolsEl = el('tools');
  const input = el('input');
  const micBtn = el('mic');
  const toggle = document.getElementById('guideToggle');
  const option = document.getElementById('guideOpt');

  const idleHint = () => (room.touch
    ? (speech.supported ? 'Hold the mic to talk, or type' : 'Type what you want to see')
    : (speech.supported ? 'Hold P to talk · / to type' : 'Press / to type'));

  function setState(state, text) {
    dock.dataset.state = state;
    statusEl.textContent = text || (state === 'listening' ? 'Listening…' : state === 'thinking' ? 'Thinking…' : idleHint());
  }
  function show(node, text) {
    node.hidden = !text;
    node.textContent = text || '';
  }

  /* ---------- moving the avatar ---------- */
  room.onFrame((dt) => {
    if (walk) stepWalk(dt);
    else if (settle) stepSettle(dt);
  });

  function stepWalk(dt) {
    const s = room.state();
    const [tx, tz] = walk.points[walk.index];
    const dx = tx - s.x;
    const dz = tz - s.z;
    const dist = Math.hypot(dx, dz);
    const last = walk.index === walk.points.length - 1;

    if (dist < (last ? ARRIVE : 0.32)) {
      if (last) return endWalk(true);
      walk.index++;
      return;
    }
    room.drive({ x: dx / dist, z: dz / dist, speed: last ? Math.max(0.6, Math.min(WALK_SPEED, dist * 2.4)) : WALK_SPEED });

    const orbit = room.orbit({});
    room.orbit({
      azimuth: turnTo(orbit.azimuth, Math.PI - s.yaw, dt * 2.4).next,
      elevation: lerp(orbit.elevation, 0.36, dt * 2),
      distance: lerp(orbit.distance, 4.1, dt * 2),
    });

    walk.clock += dt;
    if (walk.clock - walk.checked > 1.1) {
      const moved = Math.hypot(s.x - walk.mark[0], s.z - walk.mark[1]);
      walk.mark = [s.x, s.z];
      walk.checked = walk.clock;
      if (moved < 0.12) {
        // Stuck on something the map did not know about: plan again from here, once.
        const again = walk.replanned ? null : nav.path([s.x, s.z], walk.points[walk.points.length - 1]);
        if (!again) return endWalk(false);
        walk.points = again;
        walk.index = 0;
        walk.replanned = true;
      }
    }
    if (walk.clock > WALK_LIMIT_S) endWalk(false);
  }

  function endWalk(arrived) {
    const done = walk;
    walk = null;
    room.drive(null);
    done?.resolve(arrived);
  }

  function walkTo(point) {
    const s = room.state();
    const points = nav.path([s.x, s.z], point);
    if (!points || !points.length) return Promise.resolve(Math.hypot(s.x - point[0], s.z - point[1]) < 0.4);
    return new Promise((resolve) => {
      walk = { points, index: 0, resolve, clock: 0, checked: 0, mark: [s.x, s.z], replanned: false };
    });
  }

  /* On arrival the camera swings round to look at the exhibit over the avatar's
     shoulder, and the avatar turns to the visitor, the way a guide would. */
  function stepSettle(dt) {
    const s = room.state();
    const azimuth = Math.PI - settle.yaw + 0.42;
    const turn = turnTo(s.yaw, -azimuth, dt * 7);
    room.turn(turn.next);
    const orbit = room.orbit({});
    room.orbit({
      azimuth: turnTo(orbit.azimuth, azimuth, dt * 3).next,
      elevation: lerp(orbit.elevation, 0.22, dt * 3),
      distance: lerp(orbit.distance, 2.8, dt * 3),
    });
    settle.clock += dt;
    if ((turn.left < 0.04 && settle.clock > 0.7) || settle.clock > 1.6) {
      const done = settle;
      settle = null;
      done.resolve();
    }
  }
  const face = (yaw) => new Promise((resolve) => { settle = { yaw, clock: 0, resolve }; });

  async function goTo(id, job) {
    const place = room.places[id];
    if (!place) return false;
    room.closeAll();
    if (room.state().seated) room.stand();
    if (!room.thirdPerson(true)) return false;
    await walkTo(place.stand);
    if (job.cancelled) return false;
    const s = room.state();
    await face(facing(s.x, s.z, place.at[0], place.at[1]));
    return !job.cancelled;
  }

  /* ---------- the tools ---------- */
  const ACTIONS = {
    go_to: (action, job) => goTo(action.place, job),
    async present(action, job) {
      if (!await goTo(action.place, job)) return false;
      room.open(action.place);
      return true;
    },
    async terminal(action, job) {
      if (!room.state().seated && !await goTo('desk', job)) return false;
      return room.type(action.command, () => job.cancelled);
    },
    async browser(action, job) {
      if (!room.state().seated && !await goTo('desk', job)) return false;
      room.browser(action.tab);
      return true;
    },
    async sit(action, job) {
      if (room.state().seated) return true;
      if (!await goTo('desk', job)) return false;
      room.thirdPerson(false);
      room.sit();
      return true;
    },
    stand() {
      room.stand();
      return true;
    },
    view(action) {
      room.closeAll();
      if (room.state().seated) room.stand();
      return room.thirdPerson(action.mode === 'third_person');
    },
    close() {
      room.closeAll();
      return true;
    },
    async contact(action, job) {
      try {
        sessionStorage.setItem('pf-draft', `Hi Eyad, I was in your 3D room and asked the guide:\n- ${action.summary}\n\n`);
      } catch { /* the form simply opens empty */ }
      await wait(1500);
      if (job.cancelled) return false;
      location.href = 'index.html#contact';
      return true;
    },
  };

  async function execute(actions, job) {
    traceEl.innerHTML = '';
    traceEl.hidden = !actions.length;
    const rows = actions.map((action) => {
      const row = document.createElement('li');
      row.dataset.state = 'queued';
      row.innerHTML = `<code>${action.tool}</code><span></span>`;
      row.lastChild.textContent = describe(action);
      traceEl.appendChild(row);
      return row;
    });

    room.busy(true);
    try {
      for (const [i, action] of actions.entries()) {
        if (job.cancelled) break;
        rows[i].dataset.state = 'running';
        setState('acting', `${describe(action)[0].toUpperCase()}${describe(action).slice(1)}…`);
        let ok = false;
        try {
          ok = await ACTIONS[action.tool](action, job);
        } catch (err) {
          console.warn('[guide] action failed:', action, err);
        }
        rows[i].dataset.state = job.cancelled ? 'stopped' : ok ? 'done' : 'skipped';
        if (!job.cancelled && i < actions.length - 1 && room.state().open) {
          const until = performance.now() + DWELL_MS;
          while (performance.now() < until && !job.cancelled) await wait(120);
        }
      }
    } finally {
      for (const row of rows) if (row.dataset.state === 'queued' || row.dataset.state === 'running') row.dataset.state = 'stopped';
      room.busy(false);
    }
  }

  function cancel() {
    if (!run) return false;
    run.cancelled = true;
    run.abort?.abort();
    run = null;
    if (walk) endWalk(false);
    if (settle) { const done = settle; settle = null; done.resolve(); }
    try { voice?.pause(); } catch { /* nothing playing */ }
    voice = null;
    room.speaking(false);
    return true;
  }

  /* ---------- asking ---------- */
  function snapshot() {
    const s = room.state();
    let at = null;
    let nearest = 1.3;
    for (const [id, place] of Object.entries(room.places)) {
      const d = Math.hypot(place.stand[0] - s.x, place.stand[1] - s.z);
      if (d < nearest) { nearest = d; at = id; }
    }
    return { at, seated: s.seated, open: s.open, view: s.thirdPerson ? 'third_person' : 'first_person', x: Number(s.x.toFixed(2)), z: Number(s.z.toFixed(2)) };
  }

  async function askWorker(payload, job) {
    if (!API) throw new Error('offline');
    job.abort = new AbortController();
    const timer = setTimeout(() => job.abort.abort(), REQUEST_MS);
    try {
      const res = await fetch(`${API}/room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: job.abort.signal,
        body: JSON.stringify({ ...payload, state: snapshot(), history: history.slice(-4) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw Object.assign(new Error(data.code || 'failed'), { heard: data.heard });
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async function speak(plan, job) {
    if (!plan.sig || !plan.say || plan.voice === 'off') return;
    try {
      const res = await fetch(`${API}/room/say`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ say: plan.say, sig: plan.sig }),
      });
      if (res.status !== 200 || job.cancelled) return;
      const url = URL.createObjectURL(await res.blob());
      voice = new Audio(url);
      voice.addEventListener('ended', () => { URL.revokeObjectURL(url); room.speaking(false); }, { once: true });
      if (job.cancelled) return;
      await voice.play();
      room.speaking(true);
    } catch { /* the caption already says it */ }
  }

  async function request({ text = '', audio = null }) {
    cancel();
    const job = { cancelled: false, abort: null };
    run = job;
    show(sayEl, '');
    show(heardEl, text);
    traceEl.hidden = true;

    let plan = text && !isStop(text) ? parse(text, TOOLS) : null;
    let heard = text;
    if (text && isStop(text)) plan = { say: 'Stopped.', actions: [] };

    if (!plan) {
      setState('thinking');
      try {
        plan = await askWorker(audio ? { audio } : { text }, job);
        heard = plan.heard || heard;
        if (isStop(heard)) plan = { say: 'Stopped.', actions: [] };
      } catch (err) {
        if (job.cancelled) return;
        heard = err.heard || heard;
        plan = (heard && parse(heard, TOOLS, { loose: true })) || { say: heard ? LIMITED : CANNOT_HEAR, actions: [] };
        if (!heard) input.focus();
      }
    }
    if (job.cancelled) return;

    show(heardEl, heard);
    show(sayEl, plan.say);
    if (heard && plan.say) history = [...history, { role: 'user', content: heard }, { role: 'assistant', content: plan.say }].slice(-4);
    speak(plan, job);
    await execute(TOOLS.validActions(plan.actions), job);
    if (run === job) run = null;
    if (!job.cancelled || !run) setState('idle');
  }

  /* ---------- push to talk ---------- */
  async function beginTalking() {
    if (recording || !speech.supported) return;
    cancel();
    recording = { since: performance.now(), ready: null };
    setState('listening');
    recording.ready = (async () => {
      speech.module ??= await import('./room.mic.js?v=7acd6541');
      await speech.module.start();
    })().catch((err) => {
      console.warn('[guide] microphone:', err);
      recording = null;
      show(sayEl, NO_MIC);
      setState('idle');
    });
  }

  async function endTalking() {
    const taken = recording;
    if (!taken) return;
    recording = null;
    await taken.ready;
    if (!speech.module) return;
    const clip = await speech.module.stop();
    if (performance.now() - taken.since < MIN_HOLD_MS || !clip) {
      show(sayEl, NOT_HEARD);
      setState('idle');
      return;
    }
    request({ audio: clip.audio });
  }

  const usable = () => on && room.state().entered;
  window.addEventListener('keydown', (e) => {
    if (!usable() || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const s = room.state();
    if (s.typing || s.open === 'browser' || s.open === 'lightbox') return;
    if (e.code === TALK_KEY) {
      e.preventDefault();
      if (!e.repeat) beginTalking();
    } else if (e.code === 'Slash') {
      e.preventDefault();
      document.exitPointerLock?.();
      input.focus();
    }
  });
  window.addEventListener('keyup', (e) => { if (e.code === TALK_KEY) endTalking(); });
  window.addEventListener('blur', () => endTalking());

  micBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); micBtn.setPointerCapture(e.pointerId); beginTalking(); });
  micBtn.addEventListener('pointerup', () => endTalking());
  micBtn.addEventListener('pointercancel', () => endTalking());

  dock.querySelector('.guide-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.blur();
    request({ text });
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') input.blur(); });

  dock.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'off') setOn(false);
    if (act === 'tools') {
      toolsEl.hidden = !toolsEl.hidden;
      e.target.closest('[data-act]').setAttribute('aria-expanded', String(!toolsEl.hidden));
    }
  });

  room.onInput((what) => {
    if (what === 'move') cancel();
    if (what === 'escape' && run) {
      cancel();
      setState('idle');
      return true;
    }
    return false;
  });

  /* ---------- on and off ---------- */
  function setOn(next, { greet = false } = {}) {
    on = next;
    try { localStorage.setItem(STORE, on ? '1' : '0'); } catch { /* private mode */ }
    if (option) option.checked = on;
    toggle?.setAttribute('aria-pressed', String(on));
    document.body.classList.toggle('guide-on', on);
    dock.hidden = !(on && room.state().entered);
    if (!on) {
      cancel();
      speech.module?.release();
      return;
    }
    setState('idle');
    if (greet && !sayEl.textContent) show(sayEl, GREETING);
  }

  speech.supported = Boolean(API && navigator.mediaDevices?.getUserMedia && window.AudioWorkletNode);
  micBtn.hidden = !speech.supported;

  let stored = false;
  try { stored = localStorage.getItem(STORE) === '1'; } catch { /* private mode */ }
  if (new URLSearchParams(location.search).has('guide')) stored = true;
  setOn(stored);

  option?.addEventListener('change', () => setOn(option.checked));
  toggle?.addEventListener('click', () => setOn(!on, { greet: true }));

  // The dock belongs to the room, not to the entry screen.
  const arrived = setInterval(() => {
    if (!room.state().entered) return;
    clearInterval(arrived);
    if (on) setOn(true, { greet: true });
  }, 200);

  window.room = {
    state: () => ({ ...snapshot(), guide: on, busy: Boolean(run) }),
    places: Object.keys(room.places),
    tools: TOOLS.TOOLS.map((tool) => `${tool.name}${tool.arg ? `(${tool.arg})` : '()'}  ${tool.does}`),
    stats: room.stats,
    route(place) {
      const s = room.state();
      return room.places[place] ? nav.path([s.x, s.z], room.places[place].stand) : null;
    },
    run(text) {
      if (!on) setOn(true);
      return request({ text: String(text) });
    },
  };
}
