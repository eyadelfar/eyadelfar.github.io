import { next, total } from './room.suggest.js?v=225b9a71';
import * as TOOLS from './room.tools.js?v=d47b4115';

/* The card in the corner: where the visitor is, how much of the room they have
   seen, and what is worth doing next from where they stand. The suggestions
   are requests to the guide, so a click on one is carried out. */

export function start(room) {
  const where = document.getElementById('modeText');
  const chip = document.getElementById('fpsText');
  const count = document.getElementById('seenText');
  const bar = document.getElementById('seenBar');
  const list = document.getElementById('nextUp');
  if (!where || !list) return;
  const all = total(room.places, TOOLS);
  let shown = '';

  function nearest(state) {
    let found = null;
    let best = 2.2;
    for (const [id, place] of Object.entries(room.places)) {
      const d = Math.hypot(place.stand[0] - state.x, place.stand[1] - state.z);
      if (d < best && TOOLS.PLACES[id]) { best = d; found = id; }
    }
    return found;
  }

  function update() {
    const state = room.state();
    if (!state.entered) return;
    const guide = window.room?.state?.() || {};
    const at = nearest(state);

    let text = state.zone === 'quiet' ? 'In the quiet room' : 'In the main room';
    if (state.typing) text = 'Typing on the terminal';
    else if (state.seated) text = 'Seated at the workstation';
    else if (state.speed > 2.6) text = 'Jogging';
    else if (state.speed > 0.4) text = 'Walking';
    else if (at) text = `At ${TOOLS.PLACES[at].label}`;
    if (guide.busy) text = 'The guide is on it';
    where.textContent = text;
    chip.textContent = state.seated ? 'SEATED' : state.thirdPerson ? 'THIRD PERSON' : 'FIRST PERSON';

    const seen = room.seen().filter((id) => room.places[id] && id !== 'door' && id !== 'desk');
    if (count) count.textContent = seen.length ? `${seen.length} of ${all} seen` : `${all} things to see`;
    if (bar) bar.style.width = `${Math.round((seen.length / Math.max(1, all)) * 100)}%`;

    const offers = guide.busy ? [] : next({ state, seen: room.seen(), places: room.places, tables: TOOLS });
    const key = offers.map((offer) => offer.ask).join('|');
    if (key === shown) return;
    shown = key;
    list.hidden = !offers.length;
    list.innerHTML = '';
    for (const offer of offers) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = offer.label;
      button.dataset.ask = offer.ask;
      list.appendChild(button);
    }
  }

  /* Leaving by the door after looking at something: what was seen, what was not,
     and a way to send the list to Eyad. */
  const farewell = document.getElementById('farewell');
  if (farewell) {
    const close = () => { farewell.hidden = true; };
    room.onLeave((seenNow) => {
      const seen = seenNow.filter((id) => TOOLS.PLACES[id] && id !== 'door' && id !== 'desk');
      if (!seen.length) return false;
      document.getElementById('farewellTitle').textContent = seen.length === 1 ? 'You looked at one thing.' : `You looked at ${seen.length} of ${all} things.`;
      document.getElementById('farewellList').innerHTML = '';
      for (const id of seen) {
        const item = document.createElement('li');
        item.textContent = TOOLS.PLACES[id].label.replace(/^the /, '');
        document.getElementById('farewellList').appendChild(item);
      }
      const left = all - room.seen().filter((id) => room.places[id] && id !== 'door' && id !== 'desk').length;
      document.getElementById('farewellLeft').textContent = left > 0 ? `${left} more are still waiting in the room. If any of this is close to what you need, tell him.` : 'That is everything in the room. If any of it is close to what you need, tell him.';
      farewell.hidden = false;
      document.getElementById('farewellSend').focus();
      return true;
    });
    document.getElementById('farewellSend').addEventListener('click', () => {
      const seen = room.seenNow().filter((id) => TOOLS.PLACES[id] && id !== 'door' && id !== 'desk');
      try {
        sessionStorage.setItem('pf-draft', `Hi Eyad, I walked through your 3D room and looked at:\n${seen.map((id) => `- ${TOOLS.PLACES[id].label.replace(/^the /, '')}`).join('\n')}\n\n`);
      } catch { /* the form simply opens empty */ }
      window.trackEvent?.('room-farewell-send');
      location.href = 'index.html#contact';
    });
    document.getElementById('farewellGo').addEventListener('click', () => { close(); room.leave({ now: true }); });
    document.getElementById('farewellStay').addEventListener('click', close);
    farewell.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.stopPropagation(); close(); } });
  }

  list.addEventListener('click', (event) => {
    const ask = event.target.closest('[data-ask]')?.dataset.ask;
    if (ask) window.room?.run?.(ask);
  });

  update();
  setInterval(update, 300);
}
