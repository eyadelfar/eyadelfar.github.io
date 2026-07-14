const SC_TEMPLATES = `

  <div id="tpl-keepquill">
    <div style="display:flex;gap:8px;justify-content:center;margin-bottom:18px">
      <button class="sc-tab active" data-kqtab="book" onclick="kqTab(this,'book')">&#128214; The Book</button>
      <button class="sc-tab" data-kqtab="readme" onclick="kqTab(this,'readme')">&#128196; README</button>
    </div>

    <div class="sc-pane active" data-kqpane="book">
      <div class="kq">
        <div class="kq-stage">
          <div class="kq-book">
            <div class="kq-leaf kq-cover"><div class="kq-page kq-page--center"><div class="kq-cover-frame">
              <div class="kq-mark">A KeepQuill Memory Book</div>
              <h4>Our Story</h4>
              <div class="kq-divider" style="background:rgba(212,165,116,.8)"></div>
              <div class="kq-names">Eyad &amp; Malak</div>
              <div class="kq-sub">2,700 days &amp; counting</div>
            </div></div><span class="kq-edge"></span></div>

            <div class="kq-leaf"><div class="kq-page kq-page--center">
              <div class="kq-eyebrow">Dedication</div>
              <div class="kq-divider"></div>
              <p class="kq-body-text" style="font-style:italic;font-size:1.2rem">For us, for every quiet moment we almost forgot, and every loud one we never could.</p>
              <div class="kq-pagenum">i</div>
            </div><span class="kq-edge"></span></div>

            <div class="kq-leaf"><div class="kq-page">
              <div class="kq-eyebrow">Chapter One</div>
              <h3 class="kq-h">The Beginning</h3>
              <div class="kq-photo" style="background:linear-gradient(135deg,#f3d9c6,#e7b59a)"><span>April 2018 &middot; the hallway</span></div>
              <p class="kq-body-text">I saw her in the school hallway. She didn't notice me at first, but I couldn't stop looking back. That day changed everything.</p>
              <div class="kq-pagenum">1</div>
            </div><span class="kq-edge"></span></div>

            <div class="kq-leaf"><div class="kq-page">
              <div class="kq-eyebrow">Chapter Two</div>
              <h3 class="kq-h">Every Single Day</h3>
              <div class="kq-photo" style="background:linear-gradient(135deg,#cfe0f0,#a9c4e6)"><span>day 2,700 of our streak</span></div>
              <p class="kq-body-text">August 4th, day one of our streak. Over 2,700 days of talking, never missed one. Through exams, distance, everything. Not a single day of silence.</p>
              <div class="kq-pagenum">2</div>
            </div><span class="kq-edge"></span></div>

            <div class="kq-leaf"><div class="kq-page">
              <div class="kq-eyebrow">Chapter Three</div>
              <h3 class="kq-h">The Surprise</h3>
              <div class="kq-photo" style="background:linear-gradient(135deg,#f0d2da,#dca7b8)"><span>flowers, and a flight she didn't know about</span></div>
              <p class="kq-body-text">She didn't know I was on that flight. I showed up at her door on her birthday, flowers in hand, heart pounding. Her face. I'll never forget it.</p>
              <div class="kq-pagenum">3</div>
            </div><span class="kq-edge"></span></div>

            <div class="kq-leaf"><div class="kq-page kq-page--center">
              <div class="kq-quote-mark">&#8220;</div>
              <p class="kq-quote">We slow-danced in the kitchen at 2 AM, no music, just her humming softly.</p>
              <div class="kq-divider"></div>
              <div class="kq-pagenum">4</div>
            </div><span class="kq-edge"></span></div>

            <div class="kq-leaf"><div class="kq-page">
              <div class="kq-eyebrow">Chapter Four</div>
              <h3 class="kq-h">The Long Way Home</h3>
              <div class="kq-photo" style="background:linear-gradient(135deg,#e9dcc4,#d2bd92)"><span>the longer route, on purpose</span></div>
              <p class="kq-body-text">She fell asleep on my shoulder during that long drive home. I took the longer route on purpose, because I wasn't ready for the night to end.</p>
              <div class="kq-pagenum">5</div>
            </div><span class="kq-edge"></span></div>

            <div class="kq-leaf kq-cover"><div class="kq-page kq-page--center"><div class="kq-cover-frame">
              <div class="kq-divider" style="background:rgba(212,165,116,.8)"></div>
              <h4 style="font-size:1.7rem">Forever Yours</h4>
              <div class="kq-sub" style="margin-top:6px">made with KeepQuill</div>
            </div></div></div>
          </div>
          <div class="kq-controls">
            <button class="kq-btn kq-prev" aria-label="Previous page"><svg viewBox="0 0 24 24" width="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
            <span class="kq-counter">Cover</span>
            <button class="kq-btn kq-next" aria-label="Next page"><svg viewBox="0 0 24 24" width="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>
          </div>
          <p style="color:var(--text2);font-size:.82rem">Tap the page or use the arrows to turn. AI arranges <em>your</em> photos and <em>your</em> words. It never replaces your feelings.</p>
        </div>
      </div>
    </div>

    <div class="sc-pane" data-kqpane="readme">
      <div class="readme">
        <h4>KeepQuill, an AI-Powered Memory Book Generator</h4>
        <p>Your photos and your own feelings, arranged into a beautiful, print-ready memory book in minutes. The words and moments are yours. KeepQuill just gives them shape. The AI <strong>structures and arranges</strong>; it never replaces the sender's emotions.</p>
        <div class="rm-grid">
          <div class="rm-stat"><b>16+</b><span>design templates</span></div>
          <div class="rm-stat"><b>7</b><span>book structures</span></div>
          <div class="rm-stat"><b>13</b><span>languages (RTL)</span></div>
          <div class="rm-stat"><b>&lt;5min</b><span>upload to preview</span></div>
        </div>
        <h4>How it works</h4>
        <div class="rm-flow">
          <span class="rm-step">Upload photos + story</span><span class="rm-arrow">&rarr;</span>
          <span class="rm-step">Smart clustering</span><span class="rm-arrow">&rarr;</span>
          <span class="rm-step">Plan chapters</span><span class="rm-arrow">&rarr;</span>
          <span class="rm-step">AI writes captions</span><span class="rm-arrow">&rarr;</span>
          <span class="rm-step">Edit &amp; export PDF</span>
        </div>
        <p>Photos are grouped by time, place, people and mood, distributed across chapters and spreads, then captioned and titled automatically. The editor is fully WYSIWYG: what you arrange on screen is exactly what gets printed.</p>
        <h4>Key features</h4>
        <ul>
          <li>Smart photo grouping with automatic quality &amp; duplicate detection</li>
          <li>WYSIWYG editor: edit text, crop/filter photos, drag-and-drop spreads</li>
          <li>Privacy-first, on-device background removal</li>
          <li>High-fidelity, print-ready vector PDF export</li>
          <li>Video export with page effects (720p / 4K)</li>
          <li>Voice story input</li>
          <li>Designer marketplace with approval workflow</li>
          <li>Audio QR codes, love-letter pages, hard-copy printing</li>
        </ul>
        <h4>Under the hood</h4>
        <p>A multi-service platform: a modern reactive web frontend, an asynchronous AI generation pipeline, and self-hosted, privacy-first processing. Core models and infrastructure are proprietary.</p>
      </div>
    </div>
  </div>

  <div id="tpl-favisra">
    <div class="dash fav">
      <div class="dash-side">
        <div class="dash-brand"><div class="dbm">F</div><div><b>Favisra</b><small>Performance OS</small></div></div>
        <div class="dash-navhead">Workspace</div>
        <div class="dash-nav on"><span>&#9632;</span> Overview</div>
        <div class="dash-nav"><span>&#9632;</span> Dashboards</div>
        <div class="dash-nav"><span>&#9632;</span> Reports</div>
        <div class="dash-navhead">Metrics</div>
        <div class="dash-nav"><span>&#9632;</span> Formulas</div>
        <div class="dash-nav"><span>&#9632;</span> Data Sources</div>
        <div class="dash-navhead">Media</div>
        <div class="dash-nav"><span>&#9632;</span> Slideshows</div>
        <div class="dash-nav"><span>&#9632;</span> Screens</div>
        <div class="dash-navhead">People</div>
        <div class="dash-nav"><span>&#9632;</span> Employees</div>
        <div class="dash-nav"><span>&#9632;</span> Audit Logs</div>
      </div>
      <div class="dash-main">
        <div class="dash-topbar">
          <div><div style="font-size:1rem;font-weight:700">Executive Overview</div><div style="color:var(--fdim);font-size:.72rem">Live operating picture &middot; refreshed 30s ago</div></div>
          <span class="fpill" style="margin-left:auto">&#9210; Live</span><span class="fpill">+ Add widget</span>
        </div>
        <div class="dash-kpis">
          <div class="fcard"><div class="fk-label">Live Sources</div><div class="fk-val good">7</div><div class="fk-trend"><b>&#9650; all synced</b></div></div>
          <div class="fcard"><div class="fk-label">Revenue (MTD)</div><div class="fk-val">&#163;284k</div><div class="fk-trend"><b>&#9650; 12%</b> vs target</div><div class="fk-prog"><i style="width:78%"></i></div></div>
          <div class="fcard warn"><div class="fk-label">Win Rate</div><div class="fk-val warn">41%</div><div class="fk-trend">target 48%</div><div class="fk-prog"><i style="width:41%;background:#fbbf24"></i></div></div>
          <div class="fcard crit"><div class="fk-label">Overdue Tasks</div><div class="fk-val crit">23</div><div class="fk-trend">SLA breach risk</div></div>
        </div>
        <div class="dash-row" style="grid-template-columns:1.4fr 1fr">
          <div class="fcard">
            <div class="ftitle">Revenue by month <small>2025</small></div>
            <div class="dash-bars">
              <i style="height:40%"></i><i style="height:55%"></i><i style="height:48%"></i><i style="height:62%"></i><i style="height:70%"></i><i style="height:58%"></i><i style="height:80%"></i><i style="height:74%"></i><i style="height:90%"></i><i style="height:85%"></i><i style="height:96%"></i><i style="height:100%"></i>
            </div>
            <div class="axis"><span>Jan</span><span>Apr</span><span>Jul</span><span>Oct</span><span>Dec</span></div>
          </div>
          <div class="fcard">
            <div class="ftitle">Integration health</div>
            <div style="display:grid;gap:7px">
              <div style="display:flex;justify-content:space-between"><span>HubSpot</span><span class="fchip">fresh &middot; 2m</span></div>
              <div style="display:flex;justify-content:space-between"><span>Xero</span><span class="fchip">fresh &middot; 5m</span></div>
              <div style="display:flex;justify-content:space-between"><span>Google Sheets</span><span class="fchip">fresh &middot; 1m</span></div>
              <div style="display:flex;justify-content:space-between"><span>SQL Warehouse</span><span class="fchip" style="background:rgba(251,191,36,.12);color:#fbbf24;border-color:rgba(251,191,36,.25)">syncing</span></div>
            </div>
          </div>
        </div>
        <div class="fcard">
          <div class="ftitle">Sales leaderboard <small>this quarter</small></div>
          <div class="lb">
            <div class="lb-card"><span class="lb-rank g">1</span><div class="lb-av" style="background:linear-gradient(135deg,#facc15,#f59e0b)">SK</div><div class="lb-name">Sara K.</div><div class="lb-val">&#163;92k</div></div>
            <div class="lb-card"><span class="lb-rank s">2</span><div class="lb-av" style="background:linear-gradient(135deg,#38bdf8,#4ade80)">MA</div><div class="lb-name">Mo A.</div><div class="lb-val">&#163;81k</div></div>
            <div class="lb-card"><span class="lb-rank b">3</span><div class="lb-av" style="background:linear-gradient(135deg,#a78bfa,#38bdf8)">LR</div><div class="lb-name">Lina R.</div><div class="lb-val">&#163;77k</div></div>
            <div class="lb-card"><span class="lb-rank">4</span><div class="lb-av" style="background:linear-gradient(135deg,#34d399,#10b981)">JD</div><div class="lb-name">James D.</div><div class="lb-val">&#163;64k</div></div>
            <div class="lb-card"><span class="lb-rank">5</span><div class="lb-av" style="background:linear-gradient(135deg,#60a5fa,#818cf8)">YN</div><div class="lb-name">Yara N.</div><div class="lb-val">&#163;59k</div></div>
          </div>
        </div>
      </div>
    </div>
    <div class="readme" style="margin-top:20px">
      <h4>About</h4>
      <p>Self-hosted platform that centralizes KPI dashboards and operational metrics. Runs on your own infrastructure and displays on office TVs, kiosk screens, or the web. Core innovation: a proprietary DSL formula engine for reusable, auditable KPI definitions with aggregations, conditional filtering, version history, and circular-reference detection.</p>
      <h4>Highlights</h4>
      <ul>
        <li>25+ widget types: charts, gauges, KPIs, forecasts</li>
        <li>Auto-rotating TV slideshow &amp; kiosk mode</li>
        <li>Connectors: HubSpot, Zoho, Xero, Sheets, SQL, REST, CSV</li>
        <li>Multi-tenancy with a 5-level role hierarchy</li>
        <li>Fernet-encrypted OAuth &amp; RS256-signed JWT licensing</li>
        <li>Auto PostgreSQL backups + Let's Encrypt SSL, full audit trail</li>
      </ul>
      <p style="color:var(--text2)"><strong style="color:var(--accent2)">React 18 &middot; TypeScript &middot; FastAPI &middot; PostgreSQL 16 &middot; Celery &middot; Redis &middot; ECharts &middot; Docker &middot; Turborepo</strong></p>
    </div>
  </div>

  <div id="tpl-cashflows">
    <div class="dash cf">
      <div class="dash-side">
        <div class="dash-brand"><div class="dbm">B&amp;C</div><div><b>Baron &amp; Cabot</b><small style="color:rgba(255,255,255,.6)">Investment Calculator</small></div></div>
        <div class="dash-navhead">Property</div>
        <div class="cf-field" style="margin-bottom:6px">Project <span class="v">Marina Vista</span></div>
        <div class="cf-field" style="margin-bottom:6px">Unit <span class="v">B-1204</span></div>
        <div class="dash-navhead">Financial Inputs</div>
        <div style="display:grid;gap:6px">
          <div class="cf-field">LTV <span class="v">65%</span></div>
          <div class="cf-field">Interest Rate <span class="v">5.25%</span></div>
          <div class="cf-field">Loan Term <span class="v">25 yrs</span></div>
          <div class="cf-field">Nationality <span class="v">Non-resident</span></div>
          <div class="cf-field">First-Time Buyer <span class="cf-toggle"></span></div>
          <div class="cf-field">Include Parking <span class="cf-toggle"></span></div>
        </div>
      </div>
      <div class="dash-main">
        <div class="dash-topbar">
          <div><div style="font-size:.95rem;font-weight:700">Marina Vista &middot; Unit B-1204</div></div>
          <span style="margin-left:auto;display:flex;gap:6px">
            <span class="cbtn">Brochure</span><span class="cbtn">Fact Sheet</span><span class="cbadge">GBP</span>
          </span>
        </div>
        <div class="dash-kpis">
          <div class="ccard"><div class="ck-label">5yr ROI</div><div class="ck-val pos">+62.4%</div></div>
          <div class="ccard"><div class="ck-label">10yr ROI</div><div class="ck-val pos">+148%</div></div>
          <div class="ccard"><div class="ck-label">Net / mo</div><div class="ck-val neg">-&#163;340</div></div>
          <div class="ccard"><div class="ck-label">Equity In</div><div class="ck-val">&#163;182k</div></div>
        </div>
        <div class="dash-row" style="grid-template-columns:1fr 1fr 1fr">
          <div class="ccard" style="padding:0;overflow:hidden">
            <div class="ctitle">Exchange</div>
            <table><tr><td>Deposit</td><td class="r neg">-&#163;105,000</td></tr><tr><td>Fees</td><td class="r neg">-&#163;6,300</td></tr><tr style="background:#f1f5f9"><td><b>Total</b></td><td class="r neg"><b>-&#163;111,300</b></td></tr></table>
          </div>
          <div class="ccard" style="padding:0;overflow:hidden">
            <div class="ctitle">Completion</div>
            <table><tr><td>Balance</td><td class="r neg">-&#163;245,000</td></tr><tr><td>Mortgage</td><td class="r pos">+&#163;195,000</td></tr><tr style="background:#f1f5f9"><td><b>Total</b></td><td class="r neg"><b>-&#163;50,000</b></td></tr></table>
          </div>
          <div class="ccard" style="padding:0;overflow:hidden">
            <div class="ctitle">Income (Yr 1)</div>
            <table><tr><td>Rent</td><td class="r pos">+&#163;28,000</td></tr><tr><td>Mortgage</td><td class="r neg">-&#163;14,100</td></tr><tr style="background:#f1f5f9"><td><b>Net</b></td><td class="r pos"><b>+&#163;9,920</b></td></tr></table>
          </div>
        </div>
        <div class="ccard" style="padding:0;overflow:hidden;margin-bottom:12px">
          <div class="ctitle">10-Year Forecast <span style="font-weight:500;color:var(--cmut)">5yr: +&#163;114k &middot; 10yr: +&#163;271k</span></div>
          <table>
            <tr class="fc-th"><td>Year</td><td class="r">Y1</td><td class="r">Y2</td><td class="r">Y3</td><td class="r">Y4</td><td class="r fc-hl">Y5</td><td class="r">Y6</td><td class="r">Y7</td><td class="r">Y8</td><td class="r">Y9</td><td class="r fc-hl">Y10</td></tr>
            <tr><td>Value</td><td class="r">287k</td><td class="r">301k</td><td class="r">316k</td><td class="r">332k</td><td class="r fc-hl">349k</td><td class="r">366k</td><td class="r">385k</td><td class="r">404k</td><td class="r">424k</td><td class="r fc-hl">445k</td></tr>
            <tr><td>Net/mo</td><td class="r neg">-340</td><td class="r neg">-120</td><td class="r pos">+90</td><td class="r pos">+310</td><td class="r pos fc-hl">+540</td><td class="r pos">+780</td><td class="r pos">+1.0k</td><td class="r pos">+1.3k</td><td class="r pos">+1.6k</td><td class="r pos fc-hl">+1.9k</td></tr>
          </table>
        </div>
        <div class="dash-row" style="grid-template-columns:1fr 1fr 1fr">
          <div class="ccard"><div class="ck-label" style="margin-bottom:8px">Equity vs Profit</div><div class="dash-bars" style="height:74px"><i style="height:55%"></i><i class="pos" style="height:90%"></i><i style="height:100%;background:#64748b"></i></div></div>
          <div class="ccard"><div class="ck-label" style="margin-bottom:8px">Monthly Net Cash</div><div class="dash-bars" style="height:74px"><i class="neg" style="height:30%"></i><i class="neg" style="height:14%"></i><i class="pos" style="height:20%"></i><i class="pos" style="height:45%"></i><i class="pos" style="height:70%"></i><i class="pos" style="height:100%"></i></div></div>
          <div class="ccard"><div class="ck-label" style="margin-bottom:8px">Capital Growth</div>
            <svg viewBox="0 0 120 60" style="width:100%;height:74px"><defs><linearGradient id="cfg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4af37" stop-opacity=".5"/><stop offset="1" stop-color="#d4af37" stop-opacity="0"/></linearGradient></defs><path d="M0,52 L24,44 L48,38 L72,28 L96,16 L120,6 L120,60 L0,60 Z" fill="url(#cfg)"/><path d="M0,52 L24,44 L48,38 L72,28 L96,16 L120,6" fill="none" stroke="#d4af37" stroke-width="2"/></svg>
          </div>
        </div>
      </div>
    </div>
    <div class="readme" style="margin-top:20px">
      <p style="text-align:center;color:var(--text2)">Property investment cashflow visualization &middot; CSV import &middot; real-time ROI, forecast &amp; disposal modeling across GBP / AED / THB. <strong style="color:var(--accent2)">Next.js 16 &middot; React 19 &middot; tRPC &middot; Drizzle ORM &middot; Recharts</strong></p>
    </div>
  </div>

  <div id="tpl-cashflowauto">
    <div class="cf" style="border-radius:14px;padding:24px;border:1px solid var(--cbord)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
        <b style="font-size:1rem;color:var(--ctext)">Monthly Cash Statement &rarr; structured data</b><span class="cbadge" style="margin-left:auto">Python automation</span>
      </div>
      <div class="cfa-flow">
        <div class="cfa-node"><div class="ic" style="background:#16a34a;color:#fff">XLS</div><b>Workbook</b><span>multi-sheet .xlsx</span></div>
        <div class="cfa-arrow">&rarr;</div>
        <div class="cfa-node"><div class="ic" style="background:var(--cnavy);color:var(--cgold)">&#8776;</div><b>Fuzzy match</b><span>field extraction</span></div>
        <div class="cfa-arrow">&rarr;</div>
        <div class="cfa-node"><div class="ic" style="background:var(--cgold);color:var(--cnavy)">&#10003;</div><b>Validate</b><span>normalize + check</span></div>
      </div>
      <div class="ccard" style="padding:0;overflow:hidden">
        <div class="ctitle">Extracted fields <span style="font-weight:500;color:var(--cmut)">confidence</span></div>
        <table>
          <tr><td>Opening Balance</td><td class="r">&#163;1,284,500</td><td class="r pos">98%</td></tr>
          <tr><td>Total Inflows</td><td class="r pos">+&#163;642,100</td><td class="r pos">96%</td></tr>
          <tr><td>Total Outflows</td><td class="r neg">-&#163;511,380</td><td class="r pos">95%</td></tr>
          <tr><td>"Misc. Recievables"</td><td class="r">&#163;18,200</td><td class="r" style="color:var(--cgold)">81% &middot; fuzzy</td></tr>
          <tr style="background:#f1f5f9"><td><b>Closing Balance</b></td><td class="r pos"><b>+&#163;1,415,220</b></td><td class="r pos"><b>99%</b></td></tr>
        </table>
      </div>
      <p style="margin-top:16px;color:var(--cmut);font-size:.8rem">Fuzzy field matching tolerates renamed, misspelled and reordered columns across months, so finance never re-maps a template by hand. Cleaned output feeds the Cashflows App dashboards.</p>
    </div>
    <div class="readme" style="margin-top:18px"><p style="text-align:center;color:var(--text2)"><strong style="color:var(--accent2)">Python &middot; openpyxl &middot; RapidFuzz</strong></p></div>
  </div>

  <div id="tpl-attendance">
    <video class="sc-video" src="videos/attendance.mp4" controls autoplay loop playsinline></video>
    <div class="readme" style="margin-top:18px">
      <p>One-shot face-recognition attendance pipeline (<strong>graduation thesis</strong>): YOLO detects faces, RetinaFace + MTCNN align them, and DeepFace embeddings match against a single enrollment photo per person, with no retraining needed to add someone. Marked attendance streams to MySQL via MS SSIS and a live Power BI dashboard.</p>
      <div class="rm-flow">
        <span class="rm-step">Camera</span><span class="rm-arrow">&rarr;</span>
        <span class="rm-step">YOLO detect</span><span class="rm-arrow">&rarr;</span>
        <span class="rm-step">RetinaFace + MTCNN</span><span class="rm-arrow">&rarr;</span>
        <span class="rm-step">DeepFace match</span><span class="rm-arrow">&rarr;</span>
        <span class="rm-step">MySQL / Power BI</span>
      </div>
      <p style="text-align:center"><a href="https://github.com/eyadelfar/Attendance-System" target="_blank" rel="noopener" style="color:var(--accent2);font-weight:600">301 commits &middot; View on GitHub &#8599;</a></p>
    </div>
  </div>

  <div id="tpl-creativity">
    <div class="cre-wrap">
      <div>
        <div class="cre-stage" id="creStage"></div>
        <div class="cre-thumbs" id="creThumbs"></div>
      </div>
      <div class="cre-scores" id="creScores"></div>
    </div>
    <div class="readme" style="margin-top:18px"><p style="text-align:center;color:var(--text2)">Custom TensorFlow RCNN (FocalLoss, PatchExtractor, PositionalEmbedding) scoring children's artwork across 6 creativity dimensions. <strong style="color:var(--accent2)">TensorFlow &middot; Custom Layers &middot; FastAPI</strong></p></div>
  </div>
`;
(function () { const t = document.getElementById('sc-templates'); if (t) t.innerHTML = SC_TEMPLATES; })();
(function(){
  const SHOWCASES = {
    keepquill:    { title:'KeepQuill',                  tag:'AI-Powered Memory Book Generator', color:'#D4A574' },
    favisra:      { title:'Favisra',                    tag:'Self-Hosted KPI Dashboard Platform', color:'#38bdf8' },
    cashflows:    { title:'Cashflows App',              tag:'Baron & Cabot · Investment Calculator', color:'#d4af37' },
    cashflowauto: { title:'Cashflow Automation',        tag:'Excel → structured data', color:'#16a34a' },
    attendance:   { title:'One-Shot Attendance System', tag:'Graduation Thesis · Face Recognition', color:'#f472b6' },
    creativity:   { title:'Creativity Assessment System', tag:'Custom RCNN · 6 dimensions', color:'#22d3ee' },
  };
  const modal = document.getElementById('sc-modal');
  const body  = document.getElementById('sc-body');

  let scFontsLoaded = false;
  function ensureShowcaseFonts(){
    if(scFontsLoaded) return; scFontsLoaded = true;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;0,800;1,500&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Dancing+Script:wght@600;700&family=JetBrains+Mono:wght@400;600&display=swap';
    document.head.appendChild(l);
  }

  window.openShowcase = function(key){
    const cfg = SHOWCASES[key]; if(!cfg) return;
    const tpl = document.getElementById('tpl-'+key); if(!tpl) return;
    ensureShowcaseFonts();
    document.getElementById('sc-dot').style.background = cfg.color;
    document.getElementById('sc-title').textContent = cfg.title;
    document.getElementById('sc-tag').textContent = cfg.tag;
    body.innerHTML = tpl.innerHTML;
    body.scrollTop = 0;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (window.trackEvent) window.trackEvent('showcase-' + key, 'Showcase: ' + cfg.title);
    if(key === 'keepquill')  initFlip(body);
    if(key === 'creativity') initCreativity(body);
  };
  window.closeShowcase = function(){
    modal.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(function(){ body.innerHTML = ''; }, 350); // stop video / reset
  };

  // Deep-link: open a showcase from the URL hash (used by the 3D room's frames via iframe).
  function openFromHash(){
    const k = (location.hash || '').replace('#','');
    if(SHOWCASES[k]){
      if(window.self !== window.top) document.body.classList.add('sc-embed');
      openShowcase(k);
    }
  }
  window.addEventListener('hashchange', openFromHash);
  openFromHash();
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && modal.classList.contains('open')) closeShowcase(); });

  (function(){
    const v = document.querySelector('.att-card-vid');
    if(!v) return;
    const host = v.closest('.preview') || v.parentElement;
    host.addEventListener('pointerenter', function(){ v.preload = 'auto'; const p = v.play(); if(p && p.catch) p.catch(function(){}); });
    host.addEventListener('pointerleave', function(){ v.pause(); });
  })();

  document.addEventListener('keydown', function(e){
    if((e.key === 'Enter' || e.key === ' ') && document.activeElement && document.activeElement.classList.contains('preview')){
      e.preventDefault(); document.activeElement.click();
    }
  });

  window.kqTab = function(btn, name){
    const root = btn.closest('#sc-body') || document;
    root.querySelectorAll('[data-kqtab]').forEach(function(b){ b.classList.toggle('active', b===btn); });
    root.querySelectorAll('[data-kqpane]').forEach(function(p){ p.classList.toggle('active', p.getAttribute('data-kqpane')===name); });
  };
  function initFlip(root){
    const bookEl = root.querySelector('.kq-book'); if(!bookEl) return;
    const leaves = Array.prototype.slice.call(bookEl.querySelectorAll('.kq-leaf'));
    const total = leaves.length;
    let cur = 0;
    const counter = root.querySelector('.kq-counter');
    const prev = root.querySelector('.kq-prev');
    const next = root.querySelector('.kq-next');
    function render(){
      leaves.forEach(function(lf,i){
        const flipped = i < cur;
        lf.classList.toggle('flipped', flipped);
        lf.style.zIndex = flipped ? i : (total - i);
      });
      counter.textContent = (cur === 0) ? 'Cover' : (cur + ' / ' + (total - 1));
      prev.disabled = (cur === 0);
      next.disabled = (cur >= total - 1);
    }
    next.addEventListener('click', function(){ if(cur < total-1){ cur++; render(); } });
    prev.addEventListener('click', function(){ if(cur > 0){ cur--; render(); } });
    bookEl.addEventListener('click', function(e){
      if(e.target.closest('.kq-controls')) return;
      if(cur < total-1){ cur++; render(); }
    });
    render();
  }

  const CRE = [
    { img:'assets/ar/sample1.webp', overall:78, dims:[['Fluency',82],['Flexibility',74],['Elaboration',80],['Readability',71],['Uniqueness',88],['Mindfulness',73]] },
    { img:'assets/ar/sample2.webp', overall:85, dims:[['Fluency',88],['Flexibility',83],['Elaboration',86],['Readability',79],['Uniqueness',90],['Mindfulness',84]] },
    { img:'assets/ar/sample3.webp', overall:69, dims:[['Fluency',72],['Flexibility',65],['Elaboration',68],['Readability',74],['Uniqueness',63],['Mindfulness',71]] },
    { img:'assets/ar/sample4.webp', overall:91, dims:[['Fluency',93],['Flexibility',89],['Elaboration',94],['Readability',86],['Uniqueness',95],['Mindfulness',88]] },
  ];
  const CRE_BOXES = [
    [[12,14,32,30],[55,20,30,34],[30,55,40,30]],
    [[18,16,40,36],[58,52,28,30]],
    [[20,22,46,40]],
    [[10,12,34,32],[52,16,34,30],[20,54,30,32],[58,56,28,28]],
  ];
  function ringColor(v){ return v>=85 ? '#4ade9e' : v>=70 ? '#7c74ff' : '#fb923c'; }
  function initCreativity(root){
    const stage  = root.querySelector('#creStage');
    const thumbs = root.querySelector('#creThumbs');
    const scores = root.querySelector('#creScores');
    let active = 0;
    thumbs.innerHTML = CRE.map(function(c,i){
      return '<img src="'+c.img+'" alt="Artwork sample '+(i+1)+'" data-i="'+i+'"'+(i===0?' class="on"':'')+'>';
    }).join('');
    function paint(i){
      active = i;
      const c = CRE[i];
      const boxes = CRE_BOXES[i].map(function(b){
        return '<div class="cre-bbox" style="left:'+b[0]+'%;top:'+b[1]+'%;width:'+b[2]+'%;height:'+b[3]+'%"><span>patch</span></div>';
      }).join('');
      stage.innerHTML = '<img src="'+c.img+'" alt="Selected artwork">' + boxes;
      scores.innerHTML =
        '<div class="cre-overall"><div class="cre-ring" style="color:'+ringColor(c.overall)+';border:4px solid '+ringColor(c.overall)+'">'+c.overall+'</div>'+
        '<div><div style="font-weight:700;font-size:1.05rem">Creativity Score</div><div style="color:var(--text2);font-size:.84rem">weighted across 6 dimensions</div></div></div>' +
        c.dims.map(function(d){
          return '<div class="cre-dim"><b>'+d[0]+'<span>'+d[1]+'</span></b><div class="cre-track"><i style="width:'+d[1]+'%"></i></div></div>';
        }).join('');
      thumbs.querySelectorAll('img').forEach(function(im){ im.classList.toggle('on', +im.getAttribute('data-i')===i); });
    }
    thumbs.addEventListener('click', function(e){ const im = e.target.closest('img'); if(im) paint(+im.getAttribute('data-i')); });
    paint(0);
  }
})();
