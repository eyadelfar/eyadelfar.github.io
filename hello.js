(function () {
  'use strict';
  if (window.PF_EMBED || !window.console) return;

  var room = window.PORTFOLIO_PAGE === 'room';
  var hour = new Date().getHours();
  var ua = navigator.userAgent;
  var from = (document.referrer || '').toLowerCase();

  var visits = 1;
  try {
    visits = Number(localStorage.getItem('pf:console') || 0) + 1;
    localStorage.setItem('pf:console', String(visits));
  } catch (e) { /* private mode */ }

  var greeting =
    hour < 5 ? 'It is past midnight where you are and you are reading my source. We would get along.'
      : hour < 12 ? 'Good morning. Coffee first, then DevTools. Or the other way round, I do not judge.'
        : hour < 18 ? 'Good afternoon. Inspecting on company time? This console keeps secrets.'
          : 'Good evening. Reading a stranger\'s source after hours is a strong signal.';

  var browser =
    /Firefox\//.test(ua) ? 'Firefox DevTools. A person of taste.'
      : /Edg\//.test(ua) ? 'Edge DevTools. No judgement, they are good.'
        : /Chrome\//.test(ua) ? 'Chrome DevTools. The classic.'
          : /Safari\//.test(ua) ? 'Safari Web Inspector. Brave.'
            : '';

  var origin =
    from.indexOf('linkedin') !== -1 ? 'You came from LinkedIn and went straight to the console. Recruiters do not do that. Engineers do.'
      : from.indexOf('github') !== -1 ? 'Arrived from GitHub, so you already know where the rest of the code lives.'
        : from.indexOf('google') !== -1 ? 'You searched, you clicked, you opened DevTools. Thorough.'
          : '';

  var loyalty =
    visits === 1 ? 'First time in here. Welcome.'
      : visits === 2 ? 'Back again. I knew one look would not be enough.'
        : 'Console visit number ' + visits + '. At this point, just call me.';

  var name = 'font: 800 28px/1.1 system-ui, sans-serif; color: #fff; padding: 10px 16px; border-radius: 10px;' +
    'background: linear-gradient(90deg, #6d5efc, #22b8cf, #ec4899);';
  var lead = 'font: 600 13px/1.6 system-ui, sans-serif; color: #7c74ff;';
  var body = 'font: 13px/1.6 system-ui, sans-serif; color: inherit;';
  var code = 'font: 12px/1.7 ui-monospace, Consolas, monospace; color: #0ea5e9;';
  var dim = 'font: 12px/1.7 system-ui, sans-serif; color: #8b8fa3;';

  console.log('%cEyad Elfar', name);
  console.log('%c' + [greeting, browser, origin, loyalty].filter(Boolean).join('\n'), lead);

  if (room) {
    console.log('%cYou are inspecting a 3D room built in three.js, every object placed in code.\n%ceyad.home()%c  back to the portfolio', body, code, dim);
    window.eyad = {
      home: function () { location.href = 'index.html'; return 'On the way.'; },
    };
    return;
  }

  console.log(
    '%cI build AI systems that survive contact with production. This page talks back:\n\n' +
    '%ceyad.ask("How does the voice agent work?")%c\n' +
    '%ceyad.call()%c      a live voice call with my agent\n' +
    '%ceyad.contact()%c   the form that lands in my inbox\n' +
    '%ceyad.stack()%c     what this page is made of\n' +
    '%ceyad.room()%c      my work as a walkable 3D room',
    body, code, dim, code, dim, code, dim, code, dim, code, dim,
  );
  console.log('%cFound a bug? That is a feature request. eyad.contact()', dim);

  function press(selector) {
    var card = document.querySelector('.hero-agent');
    var el = document.querySelector(selector);
    if (!el || (card && card.dataset.ai === 'down')) return false;
    el.click();
    return true;
  }

  window.eyad = {
    ask: function (question) {
      if (!question) return 'Give me a question: eyad.ask("What has he shipped?")';
      if (!press('.js-agent-ask')) return 'The agent is resting. Try eyad.contact().';
      var input = document.getElementById('askInput');
      var form = document.getElementById('askForm');
      input.value = String(question).slice(0, 500);
      form.requestSubmit();
      return 'Asked. Watch the panel, bottom right.';
    },
    call: function () {
      return press('.js-agent-call') ? 'Calling. Allow the microphone and just talk.' : 'The agent is resting. Try eyad.contact().';
    },
    contact: function () {
      var el = document.getElementById('contact');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      return 'Straight to my inbox. I usually reply within a day.';
    },
    room: function () {
      location.href = 'interactive_room.html?play=1';
      return 'Loading the room.';
    },
    stack: function () {
      console.table([
        { part: 'Page', made_with: 'Hand-written HTML, CSS and JavaScript. No framework.' },
        { part: 'Chat', made_with: 'Llama 3.3 70B, hybrid retrieval (BGE embeddings + BM25, fused with RRF)' },
        { part: 'Voice', made_with: 'Deepgram speech in and out, over one WebSocket' },
        { part: 'Backend', made_with: 'A Cloudflare Worker and Durable Objects I wrote and host' },
        { part: '3D room', made_with: 'three.js, every object placed in code' },
      ]);
      return 'All of it is mine. Ask me how any part works: eyad.ask("...")';
    },
  };
})();
