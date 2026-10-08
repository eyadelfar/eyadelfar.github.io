import { PLACES } from './room.tools.js?v=5782d604';

/* A small plan of the room, drawn from the same obstacle and place data the
   room walks by, so it cannot disagree with it. Click a dot to be walked there. */

const STORE = 'pf-room-map';
const PAD = 0.6;
const DOT = 9;

export function start(room) {
  const BOUNDS = room.bounds;
  const { main, door, zen } = room.plan;
  const scale = room.touch ? 4.4 : 6.6;
  const minX = BOUNDS.minX - PAD;
  const minZ = BOUNDS.minZ - PAD;
  const width = Math.round((BOUNDS.maxX - BOUNDS.minX + PAD * 2) * scale);
  const height = Math.round((BOUNDS.maxZ - BOUNDS.minZ + PAD * 2) * scale);
  const ratio = Math.min(window.devicePixelRatio || 1, 2);

  const wrap = document.createElement('div');
  wrap.className = 'minimap';
  wrap.hidden = true;
  wrap.innerHTML = '<canvas aria-label="Map of the room. Click a place to walk there."></canvas><span class="minimap-label" hidden></span>';
  document.body.appendChild(wrap);
  const canvas = wrap.firstChild;
  const label = wrap.lastChild;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');

  const px = (x) => (x - minX) * scale;
  const py = (z) => (z - minZ) * scale;
  const name = (id) => PLACES[id].label.replace(/^the /, '');
  const places = Object.entries(room.places).filter(([id]) => PLACES[id]);

  let shown = true;
  try { shown = localStorage.getItem(STORE) !== '0'; } catch { /* private mode */ }
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
      ctx.arc(px(place.at[0]), py(place.at[1]), on ? 3.6 : 2.3, 0, Math.PI * 2);
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
    let nearest = DOT;
    for (const [id, place] of places) {
      const d = Math.hypot(px(place.at[0]) - x, py(place.at[1]) - y);
      if (d < nearest) { nearest = d; best = id; }
    }
    return { id: best, x: x / scale + minX, z: y / scale + minZ, left: x, top: y };
  }

  canvas.addEventListener('pointermove', (event) => {
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
  canvas.addEventListener('pointerleave', () => { hovered = null; label.hidden = true; since = 1; });
  canvas.addEventListener('click', (event) => {
    const at = placeAt(event);
    if (at.id) room.goTo(at.id);
    else room.walkTo([at.x, at.z]);
  });

  function show(on) {
    shown = on;
    try { localStorage.setItem(STORE, on ? '1' : '0'); } catch { /* private mode */ }
    wrap.hidden = !(shown && room.state().entered);
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
    // Where a place is drawn on the map, in page coordinates.
    mapPoint(id) {
      const box = canvas.getBoundingClientRect();
      const place = room.places[id];
      return place ? { x: box.left + px(place.at[0]), y: box.top + py(place.at[1]) } : null;
    },
  });
}
