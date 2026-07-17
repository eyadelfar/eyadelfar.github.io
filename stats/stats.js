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

const table = (rows, head, cells) => rows?.length
  ? `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${
      rows.map((r) => `<tr>${cells(r).map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  : '<p class="st-empty">Nothing yet.</p>';

function render(s) {
  const rating = s.rating || {};
  const quota = Object.fromEntries((s.usage_today || []).map((u) => [u.kind, u.count]));

  board.innerHTML = `
    <div class="st-head"><h1>Traffic</h1></div>
    <p class="st-sub">First-party, counted on my own Worker. Nothing here is public.</p>

    <div class="st-kpis">
      <div class="st-kpi"><b>${s.views.toLocaleString()}</b><span>Views</span></div>
      <div class="st-kpi"><b>${s.uniques.toLocaleString()}</b><span>Unique visitors</span></div>
      <div class="st-kpi"><b>${s.today}</b><span>Active today</span></div>
      <div class="st-kpi"><b>${rating.avg ?? '&ndash;'}</b><span>Avg rating (${rating.n || 0})</span></div>
      <div class="st-kpi"><b>${quota.chat || 0}</b><span>Chat today of ${s.limits.chat.siteDay}</span></div>
      <div class="st-kpi"><b>${s.chat_available ? 'Up' : 'Resting'}</b><span>Assistant</span></div>
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
  lock.hidden = true;
  board.hidden = false;
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
