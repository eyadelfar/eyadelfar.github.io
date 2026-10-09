import { PLACES } from './room.tools.js?v=d47b4115';

/* A small plan of the room, drawn from the same obstacle and place data the
   room walks by, so it cannot disagree with it. Click a dot to be walked there. */

const STORE = 'pf-room-map';
const PAD = 0.6;
const DOT = 9;

export function start(room) {
  const BOUNDS = room.bounds;
  const { main, door, zen } = room.plan;
  // On a phone the map is a sheet of its own, as large as the screen allows.
  const spanX = BOUNDS.maxX - BOUNDS.minX + PAD * 2;
  const spanZ = BOUNDS.maxZ - BOUNDS.minZ + PAD * 2;
  const scale = room.touch ? Math.max(5, Math.min(13, (window.innerWidth - 56) / spanX, (window.innerHeight - 150) / spanZ)) : 6.6;
  const reach = room.touch ? 26 : DOT;
  const minX = BOUNDS.minX - PAD;
  const minZ = BOUNDS.minZ - PAD;
  const width = Math.round((BOUNDS.maxX - BOUNDS.minX + PAD * 2) * scale);
  const height = Math.round((BOUNDS.maxZ - BOUNDS.minZ + PAD * 2) * scale);
  const ratio = Math.min(window.devicePixelRatio || 1, 2);

  const wrap = document.createElement('div');
  wrap.className = 'minimap';
  wrap.hidden = true;
  wrap.innerHTML = `${room.touch ? '<div class="minimap-head"><b>Tap a dot to see what it is</b><button type="button" class="minimap-go" hidden>Walk there</button><button type="button" class="minimap-x" aria-label="Close the map">×</button></div>' : ''}
    <div class="minimap-plan"><canvas aria-label="Map of the room. Choose a place to walk there."></canvas><span class="minimap-label" hidden></span></div>`;
  document.body.appendChild(wrap);
  const canvas = wrap.querySelector('canvas');
  const label = wrap.querySelector('.minimap-label');
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');

  const px = (x) => (x - minX) * scale;
  const py = (z) => (z - minZ) * scale;
  const name = (id) => PLACES[id].label.replace(/^the /, '');
  const places = Object.entries(room.places).filter(([id]) => PLACES[id]);

  // A phone has no room for a map that is always open: there it is asked for.
  let shown = !room.touch;
  if (!room.touch) try { shown = localStorage.getItem(STORE) !== '0'; } catch { /* private mode */ }
  let hovered = null;
  let since = 1;

  function draw() {
    const s = room.state();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // The floor plan: the main room, the round quiet room, and the passage between them.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(px(main.minX), py(main.minZ), (main.maxX - main.minX) * scale, (main.maxZ - main.minZ) * scale, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
    ctx.strokeStyle = 'rgba(129, 140, 248, 0.55)';
    ctx.beginPath();
    ctx.arc(px(zen.x), py(zen.z), zen.r * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(px(door.x - door.half), py(zen.z + zen.r) - 1, door.half * 2 * scale, (main.minZ - zen.z - zen.r) * scale + 2);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.13)';
    for (const o of room.obstacles) {
      ctx.beginPath();
      ctx.roundRect(px(o.minX), py(o.minZ), (o.maxX - o.minX) * scale, (o.maxZ - o.minZ) * scale, 2);
      ctx.fill();
    }

    const route = room.walker.route();
    if (route.length) {
      ctx.strokeStyle = 'rgba(129, 140, 248, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(px(s.x), py(s.z));
      for (const [x, z] of route) ctx.lineTo(px(x), py(z));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const [id, place] of places) {
      const on = id === hovered;
      ctx.fillStyle = on ? '#a5b4fc' : 'rgba(255, 255, 255, 0.78)';
      ctx.beginPath();
      ctx.arc(px(place.at[0]), py(place.at[1]), (on ? 3.6 : 2.3) * (room.touch ? 1.7 : 1), 0, Math.PI * 2);
      ctx.fill();
    }

    // You: an arrow pointing the way the character faces.
    ctx.save();
    ctx.translate(px(s.x), py(s.z));
    ctx.rotate(Math.atan2(-Math.sin(s.yaw), Math.cos(s.yaw)));
    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.2, 4.5);
    ctx.lineTo(0, 2.4);
    ctx.lineTo(-4.2, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function placeAt(event) {
    const box = canvas.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    let best = null;
    let nearest = reach;
    for (const [id, place] of places) {
      const d = Math.hypot(px(place.at[0]) - x, py(place.at[1]) - y);
      if (d < nearest) { nearest = d; best = id; }
    }
    return { id: best, x: x / scale + minX, z: y / scale + minZ, left: x, top: y };
  }

  canvas.addEventListener('pointermove', (event) => {
    if (room.touch) return;
    const at = placeAt(event);
    hovered = at.id;
    canvas.style.cursor = at.id ? 'pointer' : 'crosshair';
    label.hidden = !at.id;
    if (at.id) {
      label.textContent = name(at.id);
      label.style.left = `${Math.min(width - 8, Math.max(8, at.left))}px`;
      label.style.top = `${at.top}px`;
    }
    since = 1;
  });
  canvas.addEventListener('pointerleave', () => { if (room.touch) return; hovered = null; label.hidden = true; since = 1; });
  // With no pointer to hover, a phone names the place first and walks on a second tap.
  const title = wrap.querySelector('.minimap-head b');
  const go = wrap.querySelector('.minimap-go');
  let chosen = null;
  function choose(id) {
    chosen = id;
    hovered = id;
    since = 1;
    if (title) title.textContent = id ? name(id) : 'Tap a dot to see what it is';
    if (go) go.hidden = !id;
  }
  canvas.addEventListener('click', (event) => {
    const at = placeAt(event);
    if (!room.touch) {
      if (at.id) room.goTo(at.id);
      else room.walkTo([at.x, at.z]);
      return;
    }
    if (at.id) { choose(at.id); return; }
    choose(null);
    room.walkTo([at.x, at.z]);
    setTimeout(() => show(false), 250);
  });
  go?.addEventListener('click', () => {
    if (chosen) room.goTo(chosen);
    show(false);
  });
  wrap.querySelector('.minimap-x')?.addEventListener('click', () => show(false));

  function show(on) {
    shown = on;
    if (!room.touch) try { localStorage.setItem(STORE, on ? '1' : '0'); } catch { /* private mode */ }
    wrap.hidden = !(shown && room.state().entered);
    document.body.classList.toggle('map-open', !wrap.hidden);
    if (room.touch && wrap.hidden) choose(null);
    document.getElementById('tMap')?.setAttribute('aria-pressed', String(!wrap.hidden));
    since = 1;
  }

  window.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyM' || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    const s = room.state();
    if (s.entered && !s.typing) show(!shown);
  });

  // Ten times a second is plenty for a map.
  room.onFrame((dt) => {
    if (wrap.hidden) {
      if (shown && room.state().entered) wrap.hidden = false;
      return;
    }
    since += dt;
    if (since < 0.1) return;
    since = 0;
    draw();
  });

  window.room = Object.assign(window.room || {}, {
    map: show,
    mapShown: () => !wrap.hidden,
    // Where a place is drawn on the map, in page coordinates.
    mapPoint(id) {
      const box = canvas.getBoundingClientRect();
      const place = room.places[id];
      return place ? { x: box.left + px(place.at[0]), y: box.top + py(place.at[1]) } : null;
    },
  });
}
