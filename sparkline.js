const SERIES = {
  uniques: { label: 'Unique views', color: 'var(--accent)' },
  views: { label: 'Views', color: 'var(--cyan)' },
};

const svg = (tag, attrs) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

const TICKS = 4;

const niceMax = (n) => {
  if (n <= TICKS) return TICKS;
  const rough = n / TICKS;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough);
  return Math.ceil(step) * TICKS;
};

const dayLabel = (day) =>
  new Date(day + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function path(points) {
  return points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

export function sparkline(series, key, width = 84, height = 24) {
  const days = series.length === 1 ? [series[0], series[0]] : series;
  const values = days.map((d) => d[key]);
  const max = Math.max(1, ...values);
  const pad = 2;
  const step = (width - pad * 2) / (values.length - 1);

  const points = values.map((v, i) => ({
    x: pad + i * step,
    y: height - pad - (v / max) * (height - pad * 2),
  }));

  const root = svg('svg', { viewBox: `0 0 ${width} ${height}`, width, height, 'aria-hidden': 'true' });
  const line = path(points);

  root.appendChild(svg('path', {
    d: `${line} L${points[points.length - 1].x.toFixed(1)} ${height} L${points[0].x.toFixed(1)} ${height} Z`,
    fill: SERIES[key].color,
    opacity: '.12',
  }));
  root.appendChild(svg('path', {
    d: line,
    fill: 'none',
    stroke: SERIES[key].color,
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }));
  const last = points[points.length - 1];
  root.appendChild(svg('circle', { cx: last.x, cy: last.y, r: '2.5', fill: SERIES[key].color }));

  return root;
}

export function chart(host, series) {
  host.textContent = '';
  if (!series.length) return;

  const W = 560;
  const H = 220;
  const M = { top: 14, right: 16, bottom: 26, left: 34 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  const max = niceMax(Math.max(1, ...series.flatMap((d) => [d.uniques, d.views])));
  const single = series.length === 1;
  const step = single ? 0 : plotW / (series.length - 1);
  const xOf = (i) => (single ? M.left + plotW / 2 : M.left + i * step);
  const yOf = (v) => M.top + plotH - (v / max) * plotH;

  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg', role: 'img' });

  for (let t = 0; t <= TICKS; t++) {
    const value = (max / TICKS) * t;
    const y = yOf(value);
    root.appendChild(svg('line', {
      x1: M.left, x2: W - M.right, y1: y, y2: y, class: 'chart-grid',
    }));
    const label = svg('text', { x: M.left - 8, y: y + 3.5, class: 'chart-tick', 'text-anchor': 'end' });
    label.textContent = Math.round(value);
    root.appendChild(label);
  }

  const ticks = series.length <= 6 ? series.map((_, i) => i) : [0, Math.floor(series.length / 2), series.length - 1];
  for (const i of ticks) {
    const label = svg('text', { x: xOf(i), y: H - 8, class: 'chart-tick', 'text-anchor': 'middle' });
    label.textContent = dayLabel(series[i].day);
    root.appendChild(label);
  }

  for (const key of ['views', 'uniques']) {
    const points = series.map((d, i) => ({ x: xOf(i), y: yOf(d[key]) }));
    if (!single) {
      root.appendChild(svg('path', {
        d: path(points),
        fill: 'none',
        stroke: SERIES[key].color,
        'stroke-width': '2',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      }));
    }
    for (const p of points) {
      root.appendChild(svg('circle', {
        cx: p.x, cy: p.y, r: '3.5',
        fill: SERIES[key].color,
        stroke: 'var(--glass)', 'stroke-width': '2',
      }));
    }
  }

  const crosshair = svg('line', {
    y1: M.top, y2: M.top + plotH, class: 'chart-crosshair', opacity: '0',
  });
  root.appendChild(crosshair);
  host.appendChild(root);

  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  tip.hidden = true;
  host.appendChild(tip);

  const nearest = (clientX) => {
    const box = root.getBoundingClientRect();
    const x = ((clientX - box.left) / box.width) * W;
    const i = Math.round((x - M.left) / (step || 1));
    return Math.max(0, Math.min(series.length - 1, i));
  };

  const move = (e) => {
    const i = nearest(e.clientX);
    const d = series[i];
    crosshair.setAttribute('x1', xOf(i));
    crosshair.setAttribute('x2', xOf(i));
    crosshair.setAttribute('opacity', '1');
    tip.hidden = false;
    tip.innerHTML =
      `<b>${dayLabel(d.day)}</b>` +
      `<span><i class="swatch swatch-uniques"></i>Unique views<em>${d.uniques}</em></span>` +
      `<span><i class="swatch swatch-views"></i>Views<em>${d.views}</em></span>`;
    tip.style.left = `${(xOf(i) / W) * 100}%`;
  };

  root.addEventListener('mousemove', move);
  root.addEventListener('mouseleave', () => {
    crosshair.setAttribute('opacity', '0');
    tip.hidden = true;
  });
}
