/* Understands the plain commands, "show me the stack", "sit down", "hide the
   map", and how-to questions about the room, with no network and no model. Runs
   in the page for typed requests and on the Worker for spoken ones, so the
   common cases cost nothing.

   parse(text, tables) returns { say, actions } or null when a model should decide.
   Several steps in one request ("go to the desk then sit down") become several
   actions. With { loose: true } it answers anything that mentions a place: the
   fallback for when the model is unavailable. */

const FILLER = /\b(please|kindly|can you|could you|would you|will you|i want to|i want you to|i would like to|i'd like to|i wanna|let's|lets|let me|now|then|just|hey|hi|hello|ok|okay|also)\b/g;
const QUESTION = /^(what|how|why|when|who|whom|which|where did|where does|where has|does|did|do|is|are|was|were|has|have|can he|could he|will he|tell me (how|why|what|when|who))\b/;
const HOWTO = /^(help|help me|controls|keys|shortcuts|instructions|how (do|can|should|would) (i|we)|how to|how does (this|it|the room)|what (can|do|should) i|what are the (keys|controls|shortcuts)|what can you do|what do you do|who are you|what are you|what is this( place| room)?|where (do|can|should) i|where am i)(?= |$)/;
const SHOW = /^(show|open|present|see|view|display|look at|explain|pull up|bring up|check out|tell me about|what about|show me|let me see|play|watch|read)\b/;
const GO = /^(go|walk|move|head|run|jog|sprint|hurry|take me|bring me|lead me|get me|navigate|go over|walk over|where is|where are|find)\b/;
const JOG = /^(jog|run|sprint|hurry|rush)\b/;
const STEPS = /\s*(?:[,;]+|[.!?]+(?=\s|$)|\b(?:and then|and after that|after that|afterwards|then)\b)\s*/i;

const plain = (text) => String(text || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ')
  .replace(/\s+/g, ' ').trim();
const clean = (text) => plain(text).replace(FILLER, ' ').replace(/\s+/g, ' ').trim();

function findPlace(text, places) {
  let best = null;
  for (const [id, place] of Object.entries(places)) {
    for (const name of [id.replace(/_/g, ' '), ...place.also]) {
      if (best && name.length <= best.name.length) continue;
      if (new RegExp(`(^| )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?( |$)`).test(text)) best = { id, name };
    }
  }
  return best?.id || null;
}

const one = (say, ...actions) => ({ say, actions, via: 'rules' });
const OFF = /\b(hide|close|remove|turn off|switch off|no|disable|get rid of|without)\b|\boff$/;
const ON = /\b(show|open|turn on|switch on|enable|bring back|display|put back)\b|\bon$/;

function parseOne(raw, { PLACES, TERMINAL, BROWSER, HELP = [], ABOUT_GUIDE = '', TOURS = {} }, { loose = false, touch = false } = {}) {
  const text = clean(raw);
  if (!text) return null;

  // Asked as it was typed: "can you" is a filler everywhere else, but not in "what can you do".
  const asked = plain(raw);
  if (HOWTO.test(asked)) {
    if (/^(help|help me|what can you do|what do you do|who are you|what are you|what is this|what (can|do|should) i( do)?( here| now| next)?$)/.test(asked)) return one(ABOUT_GUIDE);
    const answer = HELP.find((entry) => entry.when.test(asked));
    if (answer) return one((touch && answer.touch) || answer.say);
  }

  if (/^(close|close (it|that|this|the panel|the browser|everything)|dismiss|go back|back|hide (it|that|this)|exit (that|this))$/.test(text)) {
    return one('Closed.', { tool: 'close' });
  }
  if (/^(sit|sit down|take a seat|have a seat|sit at the (desk|workstation|computer))$/.test(text)) return one('Sitting down at the workstation.', { tool: 'sit' });
  if (/^(stand|stand up|get up|stand back up)$/.test(text)) return one('Standing up.', { tool: 'stand' });
  if (/\b(first person|my own eyes|through (his|my) eyes)\b/.test(text)) return one('First person.', { tool: 'view', mode: 'first_person' });
  if (/\b(third person|spectator|follow cam|see (him|eyad|the avatar))\b/.test(text)) return one('Third person.', { tool: 'view', mode: 'third_person' });

  // Who is visiting decides the route: a founder, someone who runs sales, or an engineer.
  const audience = /\b(founder|co ?founder|ceo|business owner|entrepreneur|investor|startup)\b/.test(text) ? 'founder'
    : /\b(sales|revenue|call cent(er|re)|sdr|closers?)\b/.test(text) ? 'sales'
      : /\b(engineers?|developers?|programmer|data scientist|cto|technical|ml engineer)\b/.test(text) ? 'engineer' : null;
  if (audience && TOURS[audience] && (/\btour\b/.test(text) || /^(i'm|im|i am|i run|i lead|i manage|i head|i work in|we are|we're) /.test(text)) && text.split(' ').length <= 9) {
    return one(TOURS[audience].say, { tool: 'tour', mode: audience });
  }
  if (/^(give me (a|the)( short| quick)? tour|tour|short tour|quick tour|take the tour|start the tour|show me around|show me everything|walk me through( the room)?|where should i start|what should i see)$/.test(text)) {
    return one(TOURS.short?.say || 'Here is the short tour.', { tool: 'tour', mode: 'short' });
  }

  // Something they want built. The rules can only take the brief; choosing the closest system is the model's job.
  if (/^(i have a (project|problem|idea)|i need (something|a system|an agent|help)( built)?|tell you what i need|i want something built|can he build something for me|i have something to build|what can he build for me)$/.test(text)) {
    return one('Tell me in a sentence or two what you want built. I will show you the closest thing he has made, and you can send it to him as written.');
  }
  if (/^(send (him|eyad) (my|the|this|that) (brief|request|idea|project)|send it to (him|eyad)|send (him|eyad) (this|that)|pass (it|this|that) on( to (him|eyad))?)$/.test(text)) {
    return one("I'll take that to the contact form, in your words.", { tool: 'brief', summary: String(raw).trim().slice(0, 300) });
  }

  if (/\b(map|minimap|mini map)\b/.test(text) && !/\b(on the map|where)\b/.test(text)) {
    if (OFF.test(text)) return one('Map hidden. Press M to bring it back.', { tool: 'map', mode: 'off' });
    if (ON.test(text) || text.split(' ').length <= 2) return one('Here is the map.', { tool: 'map', mode: 'on' });
  }
  if (/^(mute|mute (it|that|everything)|silence|be silent)$/.test(text) || (/\b(sound|sounds|audio|music|volume|footsteps)\b/.test(text) && /\b(mute|silence|kill)\b/.test(text))) {
    return one('Sound off.', { tool: 'sound', mode: 'off' });
  }
  if (/^unmute( (it|that|the sound))?$/.test(text)) return one('Sound on.', { tool: 'sound', mode: 'on' });
  if (/\b(sound|sounds|audio|music|volume)\b/.test(text)) {
    if (OFF.test(text)) return one('Sound off.', { tool: 'sound', mode: 'off' });
    if (ON.test(text)) return one('Sound on.', { tool: 'sound', mode: 'on' });
  }

  if (/^(zoom in|closer|come closer|get closer|move closer|zoom in more|closer look)$/.test(text)) return one('Closer.', { tool: 'zoom', mode: 'in' });
  if (/^(zoom out|further|farther|pull back|back up|move back|zoom out more|wider)$/.test(text)) return one('Pulling back.', { tool: 'zoom', mode: 'out' });
  const turned = /^(?:turn|look|rotate|face|spin)(?: to(?: the)?| the)? (left|right|around|round|behind|back|the other way)(?: you| me| him)?$/.exec(text);
  if (turned) {
    const mode = turned[1] === 'left' || turned[1] === 'right' ? turned[1] : 'around';
    return one(mode === 'around' ? 'Turning around.' : `Turning ${mode}.`, { tool: 'turn', mode });
  }
  if (/^(look around|turn around|about face)$/.test(text)) return one('Turning around.', { tool: 'turn', mode: 'around' });
  if (/^(nod|nod your head|say yes|agree)$/.test(text)) return one('', { tool: 'gesture', mode: 'nod' });
  if (/^(shake your head|shake head|say no|disagree)$/.test(text)) return one('', { tool: 'gesture', mode: 'shake' });
  if (/^(jog|run|start jogging|start running|pick up the pace|go faster|faster)$/.test(text)) return one('Jogging from here.', { tool: 'pace', mode: 'jog' });
  if (/^(walk|slow down|walk normally|stop jogging|stop running|slower)$/.test(text)) return one('Walking.', { tool: 'pace', mode: 'walk' });

  if (/^(leave|exit|quit|get out|go out|leave the room|exit the room|leave the playground|go outside|bye|goodbye|i'm done|im done|done here|(take me |go |get me |bring me |head )?back to (the |his )?(portfolio|site|website|main page|home page|homepage|landing page)|go to the portfolio|open the door|walk out|walk out of the door|use the door)$/.test(text)) {
    return one('Heading out through the door, back to the portfolio.', { tool: 'leave' });
  }

  if (/\b(next|another|cycle|change|switch|new)\b/.test(text) && /\b(sample|example|fit|drawing|shape|regime|curve|one)\b/.test(text)) {
    const named = findPlace(text, PLACES);
    const place = named === 'overfitting' || named === 'ar_scoring' ? named : /\b(fit|regime|curve)\b/.test(text) ? 'overfitting' : /\b(sample|drawing|shape)\b/.test(text) ? 'ar_scoring' : null;
    if (place) return one(place === 'overfitting' ? 'Stepping the fit.' : 'Scoring the next sample.', { tool: 'cycle', place });
  }

  const tab = BROWSER.find((name) => new RegExp(`\\b${name}\\b`).test(text));
  if (tab && (tab !== 'portfolio' || /\b(browser|site|website|page)\b/.test(text))) {
    return one(`Opening ${tab === 'portfolio' ? 'the portfolio' : tab[0].toUpperCase() + tab.slice(1)} on the workstation.`, { tool: 'browser', tab });
  }
  if (/\b(open|use|show) the browser\b/.test(text)) return one('Opening the browser on the workstation.', { tool: 'browser', tab: 'portfolio' });

  const typed = /^(?:run|type|execute|enter|write)\s+(?:the\s+)?(?:command\s+)?([a-z]+)(?:\s+(?:on|in|into|at)\s+the\s+(?:terminal|console|shell|computer|workstation))?$/.exec(text)
    || /^(?:on|in) the (?:terminal|console|shell),? (?:run|type|execute|enter)\s+([a-z]+)$/.exec(text);
  if (typed && TERMINAL.includes(typed[1])) return one(`Running ${typed[1]} on the terminal.`, { tool: 'terminal', command: typed[1] });
  if (/^(open|use|start|boot|show|turn on|switch on|power on)( up)? the (terminal|console|shell|computer|pc|workstation|monitor|screen)$/.test(text)) {
    return one('Sitting down and opening the terminal.', { tool: 'terminal', command: 'help' });
  }

  if (/\b(hire|hiring|contact (him|eyad)|get in touch|reach (him|eyad|out)|send (him|eyad) a message|message (him|eyad)|book (a )?(call|meeting)|quote|pricing|his rates?|work with (him|eyad)|talk to (him|eyad))\b/.test(text) && !QUESTION.test(text)) {
    return one("I'll take you to the contact form with that written in.", { tool: 'contact', summary: String(raw).trim().slice(0, 300) });
  }

  const place = findPlace(text, PLACES);
  if (!place) return null;
  const label = PLACES[place].label;
  if (JOG.test(text)) return one(`Jogging to ${label}.`, { tool: 'pace', mode: 'jog' }, { tool: 'go_to', place });
  if (GO.test(text)) return one(`Walking to ${label}.`, { tool: 'go_to', place });
  if (SHOW.test(text) || text.split(' ').length <= 3) return one(`Here is ${label}.`, { tool: 'present', place });
  if (loose) return one(`The closest thing here is ${label}.`, { tool: 'present', place });
  return null;
}

const same = (a, b) => a && b && JSON.stringify(a) === JSON.stringify(b);

export function parse(raw, tables, options = {}) {
  const pieces = String(raw || '').split(STEPS).map((piece) => piece.trim()).filter(Boolean);
  const whole = () => parseOne(raw, tables, options);
  if (pieces.length === 0) return null;

  // "and" joins steps only when each side is a command on its own: "the copilot and voice agent exhibit" is one thing.
  const steps = [];
  for (const piece of pieces) {
    const halves = piece.split(/\s+and\s+/i);
    const each = halves.length > 1 ? halves.map((half) => parseOne(half, tables, {})) : null;
    if (each && each.every(Boolean)) steps.push(...halves);
    else steps.push(piece);
  }
  if (steps.length === 1) return whole();

  const plans = [];
  let lastPlace = null;
  for (const step of steps) {
    let plan = parseOne(step, tables, options);
    if (!plan && lastPlace && /^(open|show|present|explain|view|read|play)( me)? (it|that|this|them)( up)?$/.test(clean(step))) {
      plan = one(`Here is ${tables.PLACES[lastPlace].label}.`, { tool: 'present', place: lastPlace });
    }
    if (plan) lastPlace = [...plan.actions].reverse().find((action) => action.place)?.place || lastPlace;
    plans.push(plan);
  }
  // A request for Eyad's time is passed on whole, in the visitor's words.
  if (plans.some((plan) => plan?.actions.some((action) => action.tool === 'contact'))) return whole();
  const usable = options.loose ? plans.filter(Boolean) : plans;
  if (!usable.length || usable.some((plan) => !plan)) return options.loose ? whole() : (plans.some(Boolean) ? null : whole());

  const actions = [];
  for (const plan of usable) for (const action of plan.actions) if (!same(actions[actions.length - 1], action)) actions.push(action);
  const say = [...new Set(usable.map((plan) => plan.say).filter(Boolean))].join(' ');
  return { say, actions, via: 'rules' };
}

export const isStop = (raw) => /^(stop|cancel|never ?mind|wait|hold on|that's enough|enough|quiet|shut up|be quiet|halt|freeze)$/.test(clean(raw));
