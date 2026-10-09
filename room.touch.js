import { next } from './room.suggest.js?v=225b9a71';
import * as TOOLS from './room.tools.js?v=d47b4115';

/* The room on a phone. There is no keyboard, so everything a key does on a
   desk has a place under a thumb here: one large button that always does the
   next sensible thing, the map and sound at the top, the workstation's keys as
   buttons when he sits, and a first-visit note saying where the thumbs go. */

const COACH = 'pf-room-coach';
const NEAR = 3.4;
const buzz = (ms = 8) => { try { navigator.vibrate?.(ms); } catch { /* not on this phone */ } };

export function start(room) {
  const $ = (id) => document.getElementById(id);
  const main = $('tMain');
  const mainText = $('tMainText');
  const caption = $('tCaption');
  const seat = $('tSeat');
  const where = $('tWhere');
  const seenEl = $('tSeen');
  if (!main) return;
  const guide = () => window.room || {};
  let job = null;

  /* ---------- the large button ---------- */
  function nearest(state) {
    let found = null;
    let best = NEAR;
    for (const [id, place] of Object.entries(room.places)) {
      if (!TOOLS.PLACES[id]) continue;
      const d = Math.hypot(place.stand[0] - state.x, place.stand[1] - state.z);
      if (d < best) { best = d; found = id; }
    }
    return found;
  }

  /* What the button would do right now: { label, note, tone, run }. */
  function decide() {
    const state = room.state();
    const busy = guide().state?.().busy || room.walker.busy;
    if (busy) return { label: 'Stop', tone: 'stop', run: () => { guide().stop?.(); room.walker.stop(); } };
    if (state.open) return { label: 'Close', run: () => room.closeAll() };
    if (state.seated) return { label: 'Stand', run: () => room.stand() };
    if (!state.thirdPerson) {
      const aimed = room.aimed();
      if (aimed) return { label: aimed.kind === 'chair' ? 'Sit' : aimed.kind === 'door' ? 'Leave' : 'Open', note: 'What you are looking at', run: () => room.use() };
    }
    const at = nearest(state);
    if (at === 'desk') return { label: 'Sit', note: 'the workstation', run: async () => { if (await room.goTo('desk')) room.sit(); } };
    if (at === 'door') return { label: 'Leave', note: 'back to the portfolio', run: () => room.leave() };
    if (at) return { label: 'Open', note: TOOLS.PLACES[at].label, run: () => room.goTo(at) };
    const offer = next({ state, seen: room.seen(), places: room.places, tables: TOOLS }, 1)[0];
    if (offer) return { label: 'Go', note: offer.label.replace(/^(Next|Open): ?/i, '').replace(/^Open /, ''), run: () => guide().run?.(offer.ask, { quiet: true }) };
    return { label: 'Ask', run: () => guide().ask?.() };
  }

  function refresh() {
    const state = room.state();
    if (!state.entered) return;
    job = decide();
    if (mainText.textContent !== job.label) mainText.textContent = job.label;
    main.dataset.tone = job.tone || '';
    caption.hidden = !job.note;
    if (job.note && caption.textContent !== job.note) caption.textContent = job.note;

    where.textContent = $('modeText')?.textContent || '';
    seenEl.textContent = ($('seenText')?.textContent || '').replace(' things to see', ' to see');
    $('tSound').setAttribute('aria-pressed', $('soundToggle')?.getAttribute('aria-pressed') || 'true');
    $('tBtnView').setAttribute('aria-pressed', String(!state.thirdPerson));
    renderSeat(state);
    document.body.classList.toggle('seated', state.seated);
  }
  main.addEventListener('click', () => {
    buzz();
    (job || decide()).run();
    setTimeout(refresh, 60);
  });

  /* ---------- the top row ---------- */
  $('tExit').addEventListener('click', () => { buzz(); room.leave(); });
  $('tMap').addEventListener('click', () => { buzz(); guide().map?.(!guide().mapShown?.()); });
  $('tSound').addEventListener('click', () => { buzz(); guide().sound?.($('tSound').getAttribute('aria-pressed') !== 'true'); setTimeout(refresh, 60); });
  $('tHelp').addEventListener('click', () => { buzz(); guide().run?.('what are the controls'); });
  $('tBtnGuide').addEventListener('click', () => buzz());
  $('tBtnView').addEventListener('click', () => buzz());

  /* ---------- the workstation, without a keyboard ---------- */
  let seatKey = '';
  function renderSeat(state) {
    const key = !state.seated || state.open ? '' : state.booted ? 'on' : 'off';
    if (key === seatKey) return;
    seatKey = key;
    seat.hidden = !key;
    seat.innerHTML = '';
    if (!key) return;
    const add = (label, run, kind = '') => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      if (kind) button.className = kind;
      button.addEventListener('click', () => { buzz(); run(); setTimeout(refresh, 80); });
      seat.appendChild(button);
    };
    if (key === 'off') {
      add('Switch the screen on', () => room.boot(), 'lead');
      return;
    }
    add('Browser', () => room.browser('portfolio'), 'lead');
    add('Next page', () => room.nextPage());
    for (const command of TOOLS.TERMINAL.filter((name) => name !== 'help' && name !== 'clear')) {
      add(command, () => room.type(command));
    }
  }

  /* ---------- where the thumbs go, shown once ---------- */
  const coach = $('tCoach');
  let coached = false;
  try { coached = localStorage.getItem(COACH) === '1'; } catch { /* private mode */ }
  function showCoach() {
    if (coached || !coach) return;
    coach.hidden = false;
    const done = () => {
      coach.hidden = true;
      coached = true;
      try { localStorage.setItem(COACH, '1'); } catch { /* private mode */ }
    };
    coach.addEventListener('pointerdown', done, { once: true });
    setTimeout(done, 9000);
  }

  const arrived = setInterval(() => {
    if (!room.state().entered) return;
    clearInterval(arrived);
    document.body.classList.add('touch-live');
    refresh();
    showCoach();
  }, 200);
  setInterval(refresh, 300);

  // Turning the phone moves everything: let the page settle, then draw to the new shape.
  window.addEventListener('orientationchange', () => setTimeout(() => window.dispatchEvent(new Event('resize')), 250));

  window.room = Object.assign(window.room || {}, { touch: { main: () => decide().label, press: () => main.click(), zoom: () => room.orbit({}).distance } });
}
