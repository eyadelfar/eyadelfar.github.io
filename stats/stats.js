import { chart } from '../sparkline.js?v=1';

const API = window.PORTFOLIO_API;
const STORE = 'pf:stats-key';

const lock = document.getElementById('lock');
const board = document.getElementById('board');
const form = document.getElementById('lockForm');
const input = document.getElementById('lockKey');
const err = document.getElementById('lockErr');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const day = (iso) =>
  new Date(iso.slice(0, 10) + 'T00:00:00Z')
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const stars = (n) => `<span class="st-stars">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>`;

const dur = (ms) => {
  if (!ms) return '&ndash;';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
};

const PAGE = { portfolio: 'Portfolio', room: 'Playground' };

const when = (iso) => new Date(iso).toLocaleString('en-GB', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
});

const table = (rows, head, cells) => rows?.length
  ? `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${
      rows.map((r) => `<tr>${cells(r).map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  : '<p class="st-empty">Nothing yet.</p>';

function render(s) {
  const rating = s.rating || {};
  const quota = Object.fromEntries((s.usage_today || []).map((u) => [u.kind, u.count]));
  const sessions = s.sessions || [];
  const room = sessions.find((x) => x.page === 'room');
  const site = sessions.find((x) => x.page === 'portfolio');

  board.innerHTML = `
    <div class="st-head">
      <h1>Traffic</h1>
      <button type="button" class="st-reset" id="stReset">Reset</button>
    </div>
    <p class="st-sub">First-party, counted on my own Worker. Nothing here is public.</p>

    <div class="st-kpis">
      <div class="st-kpi"><b>${s.views.toLocaleString()}</b><span>Views</span></div>
      <div class="st-kpi"><b>${s.uniques.toLocaleString()}</b><span>Unique visitors</span></div>
      <div class="st-kpi"><b>${s.today}</b><span>Active today</span></div>
      <div class="st-kpi"><b>${rating.avg ?? '&ndash;'}</b><span>Avg rating (${rating.n || 0})</span></div>
      <div class="st-kpi"><b>${quota.chat || 0}</b><span>Chat today of ${s.limits.chat.siteDay}</span></div>
      <div class="st-kpi"><b>${s.chat_available ? 'Up' : 'Resting'}</b><span>Assistant</span></div>
      <div class="st-kpi"><b>${room?.people ?? 0}</b><span>Joined the playground</span></div>
      <div class="st-kpi"><b>${dur(site?.median)}</b><span>Median visit</span></div>
      <div class="st-kpi"><b>${dur(room?.median)}</b><span>Median playground</span></div>
      <div class="st-kpi"><b>${s.weak?.n ?? 0}</b><span>Weak retrievals</span></div>
    </div>

    <div class="st-card">
      <h2>Last 30 days</h2>
      <div class="st-legend">
        <span><i class="swatch swatch-uniques"></i>Unique visitors</span>
        <span><i class="swatch swatch-views"></i>Views</span>
      </div>
      <div class="visitor-chart" id="stChart"></div>
    </div>

    <div class="st-card">
      <h2>Every session <span class="st-note">engaged time, so a backgrounded tab does not count</span></h2>
      ${s.recent?.length
        ? `<table class="st-sessions"><thead><tr><th>Page</th><th>Country</th><th>When</th><th>Time on page</th></tr></thead>
           <tbody>${s.recent.map((r) => `<tr>
             <td><span class="st-tag st-${r.page}">${PAGE[r.page] || esc(r.page)}</span></td>
             <td class="st-when">${esc(r.country || '??')}</td>
             <td class="st-when">${when(r.started)}</td>
             <td><span class="st-dur" style="--w:${Math.min(100, (r.ms / 300000) * 100)}%">${dur(r.ms)}</span></td>
           </tr>`).join('')}</tbody></table>`
        : '<p class="st-empty">No sessions recorded yet.</p>'}
      ${sessions.length
        ? `<p class="st-foot">${sessions.map((r) => `${PAGE[r.page] || r.page}: ${r.people} ${r.people === 1 ? 'person' : 'people'}, ${r.sessions} sessions, median ${dur(r.median)}, longest ${dur(r.longest)}`).join(' &middot; ')}${
            site?.people && room?.people ? ` &middot; ${Math.round((room.people / site.people) * 100)}% go into the playground` : ''}</p>`
        : ''}
    </div>

    <div class="st-card">
      <h2>What people asked <span class="st-note">last ${(s.turns || []).length}, newest first. A low score means retrieval struggled.</span></h2>
      ${s.turns?.length
        ? `<table class="st-turns"><tbody>${s.turns.map((t) => `<tr>
            <td class="st-kind"><span class="st-tag st-${t.kind.replace(' ', '-')}">${t.kind}</span></td>
            <td>
              <div class="st-q">${esc(t.question)}</div>
              ${t.reply ? `<div class="st-a">${esc(t.reply)}</div>` : ''}
            </td>
            <td class="st-when">
              ${t.score != null ? `<span class="st-score ${t.score < 0.45 ? 'weak' : ''}">${t.score.toFixed(2)}</span><br>` : ''}
              ${t.overridden ? '<span class="st-flag">overridden</span><br>' : ''}
              ${esc(t.country || '??')} &middot; ${when(t.ts)}
            </td>
          </tr>`).join('')}</tbody></table>`
        : '<p class="st-empty">Nobody has asked anything yet.</p>'}
    </div>

    <div class="st-card">
      <h2>Feedback</h2>
      ${s.feedback?.length
        ? `<table><tbody>${s.feedback.map((f) => `<tr>
            <td style="width:92px">${stars(f.rating)}</td>
            <td>${f.comment ? esc(f.comment) : '<span class="st-empty">No comment</span>'}</td>
            <td class="st-when">${esc(f.country || '??')} &middot; ${day(f.ts)}</td>
          </tr>`).join('')}</tbody></table>`
        : '<p class="st-empty">No feedback yet.</p>'}
    </div>

    <div class="st-cols">
      <div class="st-card">
        <h2>Countries</h2>
        ${table(s.countries, ['Country', 'Visitors'], (r) => [esc(r.country), r.n])}
      </div>
      <div class="st-card">
        <h2>Referrers</h2>
        ${table(s.referrers, ['Source', 'Visitors'], (r) => [esc(r.referrer), r.n])}
      </div>
    </div>

    <div class="st-card">
      <h2>Engagement</h2>
      ${table(s.events, ['Event', 'Count'], (r) => [esc(r.name), r.n])}
    </div>`;

  chart(document.getElementById('stChart'), s.series || []);
  document.getElementById('stReset').addEventListener('click', reset);
  lock.hidden = true;
  board.hidden = false;
}

async function reset() {
  if (!confirm('Wipe sessions, questions, feedback and events?\n\nView and visitor counts are kept. This cannot be undone.')) return;
  const res = await fetch(`${API}/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: localStorage.getItem(STORE), confirm: 'reset' }),
  });
  if (res.ok) location.reload();
  else alert('Reset failed.');
}

async function open(key) {
  err.textContent = '';
  const res = await fetch(`${API}/stats?key=${encodeURIComponent(key)}`);

  if (res.status === 429) {
    err.textContent = 'Too many attempts. Wait a minute.';
    return false;
  }
  if (!res.ok) {
    err.textContent = 'Wrong password.';
    localStorage.removeItem(STORE);
    return false;
  }

  localStorage.setItem(STORE, key);
  render(await res.json());
  return true;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const key = input.value.trim();
  if (key) await open(key);
});

const remembered = localStorage.getItem(STORE) || decodeURIComponent(location.hash.slice(1));
if (remembered) open(remembered).catch(() => {});
