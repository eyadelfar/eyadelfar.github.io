import { isStop, parse } from './room.intents.js?v=3151bd01';
import { complete, next } from './room.suggest.js?v=225b9a71';
import * as TOOLS from './room.tools.js?v=d47b4115';

const API = String(window.PORTFOLIO_API || '').replace(/\/+$/, '');
const DWELL_MS = 3600;
const REQUEST_MS = 20000;
const MIN_HOLD_MS = 280;
const TALK_KEY = 'KeyP';
const CHAT_KEYS = new Set(['KeyC', 'Slash']);
// Said by someone describing work they want done, as opposed to asking about his.
const NEED = /\b(i|we) (need|want|would like|am looking for|are looking for|have to)\b|\bfor (my|our) (business|company|team|clinic|store|shop|startup|agency|firm|practice|customers|clients)\b|\bcan he (build|make|automate|create)\b/i;
const STARTERS = [["I'm a founder", 'give me the founder tour'], ['I run a sales team', 'give me the sales tour'], ["I'm an engineer", 'give me the engineer tour'], ['I have a project', 'I have a project']];

const NOT_HEARD = window.matchMedia('(pointer: coarse)').matches ? 'I did not hear anything. Tap the mic, talk, then tap it again.' : 'I did not hear anything. Hold P down while you talk.';
const CANNOT_HEAR = 'I cannot listen right now. Type what you want to see instead.';
const LIMITED = 'I can only follow simple requests right now. Try: show me the voice agents.';
const NO_MIC = 'I could not use the microphone. You can type instead.';
const NO_VOICE = 'Voice is not available in this browser. Type what you want instead.';

const MIC_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/></svg>';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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
    case 'zoom': return `zoom ${action.mode}`;
    case 'turn': return action.mode === 'around' ? 'turn around' : `turn ${action.mode}`;
    case 'pace': return action.mode === 'jog' ? 'pick up the pace' : 'slow to a walk';
    case 'cycle': return `step ${place}`;
    case 'gesture': return action.mode === 'nod' ? 'nod' : 'shake his head';
    case 'map': return action.mode === 'on' ? 'show the map' : 'hide the map';
    case 'sound': return action.mode === 'on' ? 'turn the sound on' : 'turn the sound off';
    case 'leave': return 'walk out to the portfolio';
    case 'tour': return `start ${TOOLS.TOURS[action.mode]?.name || 'the tour'}`;
    case 'brief': return 'take your brief to the contact form';
    default: return 'close what is open';
  }
}

export function start(room) {
  const { nav, walker } = room;
  const speech = { supported: false, module: null };
  let run = null;
  let voice = null;
  let recording = null;
  let history = [];
  let pace = 'walk';
  // What the visitor said they want built, and the place the guide matched it to.
  let need = null;
  const counted = new Set();
  const count = (name) => { if (!counted.has(name)) { counted.add(name); window.trackEvent?.(name); } };

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
      <button type="button" class="guide-chip" data-act="tools" aria-expanded="false">What can I ask?</button>
      <button type="button" class="guide-x" data-act="off" aria-label="Close the guide" title="Close (Esc)">×</button>
    </header>
    <div class="guide-body" aria-live="polite">
      <p class="guide-heard" dir="auto" hidden></p>
      <p class="guide-say" dir="auto" hidden></p>
      <ol class="guide-trace" hidden></ol>
      <p class="guide-result" hidden></p>
      <div class="guide-starters">${STARTERS.map(([label, ask]) => `<button type="button" data-ask="${ask}">${label}</button>`).join('')}</div>
      <button type="button" class="guide-offer" data-act="brief" hidden>Send this to Eyad, as I wrote it</button>
    </div>
    <ul class="guide-tools" hidden>${TOOLS.TOOLS.map((tool) => `<li><button type="button" data-ask="${tool.example}">“${tool.example}”</button><span>${tool.does}${tool.keys ? ` By hand: ${tool.keys}.` : ''}</span></li>`).join('')}</ul>
    <ul class="guide-suggest" role="listbox" aria-label="Suggestions" hidden></ul>
    <form class="guide-form">
      <button type="button" class="guide-mic" aria-label="Hold to talk" title="Hold to talk">${MIC_ICON}</button>
      <input class="guide-input" type="text" dir="auto" enterkeyhint="send" maxlength="300" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Ask, or say where to go" aria-label="Tell the guide what to do" aria-autocomplete="list">
      <button type="submit" class="guide-send">Send</button>
    </form>
    <p class="guide-note">Your voice is transcribed to answer you and is not stored. Requests are logged without your name.</p>`;
  document.body.appendChild(dock);

  const el = (name) => dock.querySelector(`.guide-${name}`);
  const statusEl = el('status');
  const heardEl = el('heard');
  const sayEl = el('say');
  const traceEl = el('trace');
  const resultEl = el('result');
  const toolsEl = el('tools');
  const suggestEl = el('suggest');
  const startersEl = el('starters');
  const offerEl = el('offer');
  const input = el('input');
  const micBtn = el('mic');

  const greeting = () => (room.touch
    ? `Tell me where to go or what to show you, or ask how anything here works.${speech.supported ? ' Tap the mic to talk.' : ''}`
    : `Tell me where to go or what to show you, or ask how anything here works. ${speech.supported ? 'Hold P to talk, ' : ''}C to type, Esc to close.`);
  const idleHint = () => (room.touch
    ? (speech.supported ? 'Tap the mic to talk, or type' : 'Type what you want to see')
    : (speech.supported ? 'Hold P to talk · C to type' : 'Press C to type'));

  function setState(state, text) {
    dock.dataset.state = state;
    statusEl.textContent = text || (state === 'listening' ? (room.touch ? 'Listening… tap the mic to send' : 'Listening…') : state === 'thinking' ? 'Thinking…' : idleHint());
  }
  function show(node, text) {
    node.hidden = !text;
    node.textContent = text || '';
  }

  const isOpen = () => !dock.hidden;
  function openDock({ focus = false } = {}) {
    if (!room.state().entered) return false;
    if (dock.hidden) {
      dock.hidden = false;
      document.body.classList.add('guide-open');
      setState(dock.dataset.state === 'idle' ? 'idle' : dock.dataset.state);
      if (!sayEl.textContent && !heardEl.textContent) show(sayEl, greeting());
    }
    if (focus) {
      document.exitPointerLock?.();
      input.focus();
    }
    return true;
  }
  function closeDock() {
    cancel();
    input.blur();
    dock.hidden = true;
    toolsEl.hidden = true;
    document.body.classList.remove('guide-open');
    speech.module?.release();
  }

  /* ---------- moving the avatar ---------- */
  const speed = () => (pace === 'jog' ? room.speeds.run : room.speeds.walk);
  async function goTo(id, job) {
    const place = room.places[id];
    if (!place) return false;
    room.closeAll();
    if (room.state().seated) room.stand();
    // The visitor keeps the view they chose: in first person they are walked there through his eyes.
    room.thirdPerson(room.state().prefers === 'third_person');
    const third = room.state().thirdPerson;
    await walker.to(place.stand, { speed: speed(), follow: third });
    if (job.cancelled) return false;
    if (third) await walker.present(place.at[0], place.at[1]);
    else await walker.face(place.at[0], place.at[1]);
    return !job.cancelled;
  }

  /* ---------- the tools ---------- */
  const extra = (name, value) => {
    if (typeof window.room?.[name] !== 'function') return false;
    window.room[name](value);
    return true;
  };
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
      room.sit();
      return room.state().seated;
    },
    stand() {
      room.stand();
      return !room.state().seated;
    },
    view(action) {
      room.closeAll();
      return room.thirdPerson(action.mode === 'third_person', { chosen: true });
    },
    zoom: (action) => room.zoom(action.mode),
    async turn(action) {
      if (room.state().seated) return false;
      const yaw = room.state().yaw + (action.mode === 'left' ? Math.PI / 2 : action.mode === 'right' ? -Math.PI / 2 : Math.PI);
      await walker.heading(yaw);
      return true;
    },
    pace(action) {
      pace = action.mode;
      return true;
    },
    async cycle(action, job) {
      if (!await goTo(action.place, job)) return false;
      return room.cycle(action.place);
    },
    async gesture(action, job) {
      if (room.state().seated) return false;
      room.closeAll();
      if (!room.thirdPerson(true)) return false;
      const seconds = room.gesture(action.mode);
      if (!seconds) return false;
      const until = performance.now() + seconds * 1000;
      while (performance.now() < until && !job.cancelled) await wait(100);
      return true;
    },
    map: (action) => extra('map', action.mode === 'on'),
    sound: (action) => extra('sound', action.mode === 'on'),
    close() {
      room.closeAll();
      return room.state().open === null;
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
    async brief(action, job) {
      const said = need?.text || (NEED.test(action.summary) ? action.summary : '');
      if (!said) {
        show(sayEl, 'Tell me first what you want built, in a sentence or two, and I will pass it on as you wrote it.');
        return false;
      }
      const matched = need?.place && TOOLS.PLACES[need.place] ? `\nThe guide pointed me to ${TOOLS.PLACES[need.place].label}.\n` : '';
      try {
        sessionStorage.setItem('pf-draft', `Hi Eyad, in your 3D room I told the guide what I need:\n- ${said}\n${matched}\n`);
      } catch { /* the form simply opens empty */ }
      count('room-brief-sent');
      await wait(900);
      if (job.cancelled) return false;
      location.href = 'index.html#contact';
      return true;
    },
    async leave(action, job) {
      if (room.places.door && !await goTo('door', job)) return false;
      if (job.cancelled) return false;
      room.leave();
      return true;
    },
  };

  /* Runs the actions in order and returns the ones that did not happen. */
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

    const failed = [];
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
        if (!ok && !job.cancelled) failed.push(action);
        if (!job.cancelled && i < actions.length - 1 && room.state().open) {
          const until = performance.now() + DWELL_MS;
          while (performance.now() < until && !job.cancelled) await wait(120);
        }
      }
    } finally {
      for (const row of rows) if (row.dataset.state === 'queued' || row.dataset.state === 'running') row.dataset.state = 'stopped';
      room.busy(false);
    }
    return failed;
  }

  function cancel() {
    if (!run) return false;
    run.cancelled = true;
    run.abort?.abort();
    run = null;
    walker.stop();
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
    return { at, seated: s.seated, open: s.open, zone: s.zone, touch: Boolean(room.touch), view: s.thirdPerson ? 'third_person' : 'first_person', x: Number(s.x.toFixed(2)), z: Number(s.z.toFixed(2)) };
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

  const rules = (text, options) => parse(text, TOOLS, { touch: room.touch, ...options });

  async function request({ text = '', audio = null, quiet = false }) {
    cancel();
    if (!quiet || isOpen()) openDock();
    hideSuggestions();
    startersEl.hidden = true;
    offerEl.hidden = true;
    count(audio ? 'room-guide-spoken' : 'room-guide-typed');
    const job = { cancelled: false, abort: null };
    run = job;
    pace = 'walk';
    show(sayEl, '');
    show(resultEl, '');
    show(heardEl, text);
    traceEl.hidden = true;

    let plan = text && !isStop(text) ? rules(text) : null;
    let heard = text;
    if (text && isStop(text)) plan = { say: 'Stopped.', actions: [], via: 'rules' };

    if (!plan) {
      setState('thinking');
      try {
        plan = await askWorker(audio ? { audio } : { text }, job);
        heard = plan.heard || heard;
        if (isStop(heard)) plan = { say: 'Stopped.', actions: [], via: 'rules' };
        // What was heard is read again here, so a spoken command runs the same steps a typed one does.
        const local = audio && heard ? rules(heard) : null;
        if (local) plan = local.say === plan.say ? { ...plan, actions: local.actions } : local;
      } catch (err) {
        if (job.cancelled) return;
        heard = err.heard || heard;
        plan = (heard && rules(heard, { loose: true })) || { say: heard ? LIMITED : CANNOT_HEAR, actions: [], via: 'rules' };
        plan.loose = true;
        if (!heard) input.focus();
      }
    }
    if (job.cancelled) return;

    show(heardEl, heard);
    show(sayEl, plan.say);
    if (quiet && !isOpen() && plan.say) room.notice(plan.say);
    if (heard && plan.say) history = [...history, { role: 'user', content: heard }, { role: 'assistant', content: plan.say }].slice(-4);
    speak(plan, job);
    const valid = TOOLS.validActions(plan.actions);
    for (const action of valid) if (action.tool === 'tour') count(`room-tour-${action.mode}`);
    const actions = valid.flatMap((action) => (action.tool === 'tour'
      ? TOOLS.TOURS[action.mode].stops.filter((id) => room.places[id]).map((place) => ({ tool: 'present', place }))
      : [action]));
    // Someone describing work they want done is offered a way to send it, in their own words.
    const described = plan.brief === true || (plan.via !== 'rules' && NEED.test(heard)) || (plan.loose === true && NEED.test(heard));
    // A model that reaches for the contact form on its own is held back: the visitor is shown the match and chooses.
    if (plan.via !== 'rules') {
      for (let i = actions.length - 1; i >= 0; i--) {
        if (actions[i].tool === 'brief' || (described && actions[i].tool === 'contact')) actions.splice(i, 1);
      }
    }
    if (described && heard && !actions.some((action) => action.tool === 'contact' || action.tool === 'brief')) {
      need = { text: heard.slice(0, 300), place: actions.find((action) => action.place)?.place || null };
      offerEl.hidden = false;
      count('room-brief-offered');
    }
    const failed = await execute(actions, job);
    // The guide only ever reports what the room really did.
    if (!job.cancelled) {
      if (failed.length) show(resultEl, `I could not ${failed.map(describe).join(', or ')}.`);
      else if (!actions.length && plan.via !== 'rules') show(resultEl, 'That was an answer only. Nothing in the room was changed.');
    }
    if (run === job) run = null;
    if (!job.cancelled || !run) setState('idle');
  }

  /* ---------- suggestions ---------- */
  let offered = [];
  let active = -1;
  function hideSuggestions() {
    suggestEl.hidden = true;
    offered = [];
    active = -1;
    input.removeAttribute('aria-activedescendant');
  }
  function renderSuggestions() {
    const typed = input.value;
    const state = room.state();
    const base = typed.trim()
      ? complete(typed, TOOLS)
      : next({ state, seen: room.seen(), places: room.places, tables: TOOLS }, 4).map((item) => item.ask);
    offered = base.filter((text) => isStop(text) || rules(text));
    active = -1;
    suggestEl.innerHTML = '';
    suggestEl.hidden = !offered.length;
    offered.forEach((text, i) => {
      const item = document.createElement('li');
      item.id = `guide-s${i}`;
      item.setAttribute('role', 'option');
      item.textContent = text;
      item.dataset.i = String(i);
      suggestEl.appendChild(item);
    });
  }
  function highlight(index) {
    active = index;
    [...suggestEl.children].forEach((item, i) => item.setAttribute('aria-selected', String(i === active)));
    if (active >= 0) input.setAttribute('aria-activedescendant', `guide-s${active}`);
    else input.removeAttribute('aria-activedescendant');
  }
  function submit(text) {
    const asked = String(text || '').trim();
    if (!asked) return;
    input.value = '';
    input.blur();
    request({ text: asked });
  }

  input.addEventListener('input', renderSuggestions);
  input.addEventListener('focus', renderSuggestions);
  input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== input) hideSuggestions(); }, 150));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && offered.length) { e.preventDefault(); highlight((active + 1) % offered.length); return; }
    if (e.key === 'ArrowUp' && offered.length) { e.preventDefault(); highlight(active <= 0 ? offered.length - 1 : active - 1); return; }
    if (e.key === 'Tab' && offered.length) {
      e.preventDefault();
      input.value = offered[Math.max(0, active)];
      renderSuggestions();
      return;
    }
    if (e.key === 'Enter' && active >= 0) { e.preventDefault(); submit(offered[active]); return; }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (!suggestEl.hidden && input.value) hideSuggestions();
      else input.blur();
    }
  });
  suggestEl.addEventListener('pointerdown', (e) => {
    const item = e.target.closest('[data-i]');
    if (!item) return;
    e.preventDefault();
    submit(offered[Number(item.dataset.i)]);
  });

  /* ---------- push to talk ---------- */
  async function beginTalking() {
    if (recording) return;
    if (!openDock()) return;
    if (!speech.supported) {
      show(sayEl, NO_VOICE);
      input.focus();
      return;
    }
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

  window.addEventListener('keydown', (e) => {
    if (!room.state().entered || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const s = room.state();
    if (s.typing || s.open === 'browser' || s.open === 'lightbox') return;
    if (e.code === TALK_KEY) {
      e.preventDefault();
      if (!e.repeat) beginTalking();
    } else if (CHAT_KEYS.has(e.code)) {
      e.preventDefault();
      openDock({ focus: true });
    }
  });
  window.addEventListener('keyup', (e) => { if (e.code === TALK_KEY) endTalking(); });
  window.addEventListener('blur', () => endTalking());

  if (room.touch) {
    let limit = null;
    micBtn.addEventListener('click', () => {
      clearTimeout(limit);
      if (recording) { endTalking(); return; }
      beginTalking();
      limit = setTimeout(() => endTalking(), 20000);
    });
    // The sheet stays clear of the on-screen keyboard.
    const lift = () => {
      const view = window.visualViewport;
      const under = view ? Math.max(0, window.innerHeight - view.height - view.offsetTop) : 0;
      dock.style.setProperty('--keyboard', `${Math.round(under)}px`);
    };
    window.visualViewport?.addEventListener('resize', lift);
    window.visualViewport?.addEventListener('scroll', lift);
  } else {
    micBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); micBtn.setPointerCapture(e.pointerId); beginTalking(); });
    micBtn.addEventListener('pointerup', () => endTalking());
    micBtn.addEventListener('pointercancel', () => endTalking());
  }

  dock.querySelector('.guide-form').addEventListener('submit', (e) => {
    e.preventDefault();
    submit(input.value);
  });

  dock.addEventListener('click', (e) => {
    const ask = e.target.closest('[data-ask]')?.dataset.ask;
    if (ask) {
      toolsEl.hidden = true;
      dock.querySelector('[data-act="tools"]').setAttribute('aria-expanded', 'false');
      submit(ask);
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'off') closeDock();
    if (act === 'brief') request({ text: 'send him my brief' });
    if (act === 'tools') {
      toolsEl.hidden = !toolsEl.hidden;
      e.target.closest('[data-act]').setAttribute('aria-expanded', String(!toolsEl.hidden));
    }
  });
  document.getElementById('tBtnGuide')?.addEventListener('click', () => (isOpen() ? closeDock() : openDock()));

  room.onInput((what) => {
    if (what === 'move') cancel();
    if (what !== 'escape') return false;
    if (run) {
      cancel();
      setState('idle');
      return true;
    }
    if (isOpen() && !room.state().open) {
      closeDock();
      return true;
    }
    return false;
  });

  speech.supported = Boolean(API && navigator.mediaDevices?.getUserMedia && window.AudioWorkletNode);
  micBtn.hidden = !speech.supported;
  room.keys.talk = speech.supported;
  room.keys.chat = true;
  setState('idle');

  /* How the visit starts: a link can name a place to stand at or a tour to take,
     and the entry card offers the tours too. */
  const query = new URLSearchParams(location.search);
  const start = { go: room.places[query.get('go')] ? query.get('go') : null, tour: TOOLS.TOURS[query.get('tour')] ? query.get('tour') : null };
  const startNote = document.getElementById('entryStart');
  if (startNote && (start.go || start.tour)) {
    startNote.textContent = start.go ? `You will start at ${TOOLS.PLACES[start.go].label}.` : `You will start with ${TOOLS.TOURS[start.tour].name}.`;
    startNote.hidden = false;
  }
  for (const button of document.querySelectorAll('[data-tour]')) {
    button.addEventListener('click', () => {
      start.tour = button.dataset.tour;
      start.go = null;
      document.getElementById('enterBtn')?.click();
    });
  }
  const arrived = setInterval(() => {
    if (!room.state().entered) return;
    clearInterval(arrived);
    if (start.go) {
      count(`room-link-${start.go}`);
      room.startAt(start.go);
      setTimeout(() => room.open(start.go), 900);
    } else if (start.tour) {
      request({ text: start.tour === 'short' ? 'give me a tour' : `give me the ${start.tour} tour` });
    } else if (query.has('guide')) {
      openDock();
    }
  }, 200);

  // Where a visit ends, counted when the page goes away.
  window.addEventListener('pagehide', () => {
    if (!room.state().entered) return;
    count(`room-end-at-${room.lastPlace() || 'nothing'}`);
    count(`room-seen-${Math.min(room.seenNow().length, 12)}`);
  });

  window.room = Object.assign(window.room || {}, {
    state: () => ({ ...snapshot(), guide: isOpen(), busy: Boolean(run) }),
    places: Object.keys(room.places),
    tools: TOOLS.TOOLS.map((tool) => `${tool.name}${tool.arg ? `(${tool.arg})` : '()'}  ${tool.does}`),
    stats: room.stats,
    route(place) {
      const s = room.state();
      return room.places[place] ? nav.path([s.x, s.z], room.places[place].stand) : null;
    },
    run: (text, options = {}) => request({ text: String(text), quiet: options.quiet === true }),
    stop: () => { const was = cancel(); if (was) setState('idle'); return was; },
    guideOpen: isOpen,
    closeGuide: closeDock,
    ask: () => openDock({ focus: true }),
  });
}
