/* Understands the plain commands, "show me the stack", "sit down", "open his
   GitHub", with no network and no model. Runs in the page for typed requests and
   on the Worker for spoken ones, so the common cases cost nothing.

   parse(text, tables) returns { say, actions } or null when a model should decide.
   With { loose: true } it answers anything that mentions a place: the fallback
   for when the model is unavailable. */

const FILLER = /\b(please|kindly|can you|could you|would you|will you|i want to|i would like to|i'd like to|i wanna|let's|lets|let me|now|then|just|hey|hi|hello|ok|okay)\b/g;
const QUESTION = /^(what|how|why|when|who|whom|which|where did|where does|where has|does|did|do|is|are|was|were|has|have|can he|could he|will he|tell me (how|why|what|when|who))\b/;
const SHOW = /^(show|open|present|see|view|display|look at|explain|pull up|bring up|check out|tell me about|what about|show me|let me see)\b/;
const GO = /^(go|walk|move|head|run|take me|bring me|lead me|get me|navigate|go over|walk over)\b/;

const clean = (text) => String(text || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ')
  .replace(FILLER, ' ').replace(/\s+/g, ' ').trim();

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

export function parse(raw, { PLACES, TERMINAL, BROWSER }, { loose = false } = {}) {
  const text = clean(raw);
  if (!text) return null;

  if (/^(close|close (it|that|this|the panel|the browser|everything)|dismiss|go back|back|hide (it|that|this)|exit (that|this))$/.test(text)) {
    return one('Closed.', { tool: 'close' });
  }
  if (/^(sit|sit down|take a seat|have a seat|sit at the (desk|workstation|computer))$/.test(text)) return one('Sitting down at the workstation.', { tool: 'sit' });
  if (/^(stand|stand up|get up|stand back up)$/.test(text)) return one('Standing up.', { tool: 'stand' });
  if (/\b(first person|my own eyes|through (his|my) eyes)\b/.test(text)) return one('First person.', { tool: 'view', mode: 'first_person' });
  if (/\b(third person|spectator|follow cam|see (him|eyad|the avatar))\b/.test(text)) return one('Third person.', { tool: 'view', mode: 'third_person' });

  if (/^(give me a tour|tour|show me around|show me everything|walk me through( the room)?|where should i start|what should i see)$/.test(text)) {
    return one(
      "Here is the short tour: his results, the voice agents, his own products, then how to reach him.",
      { tool: 'present', place: 'impact' }, { tool: 'present', place: 'rag_voice' },
      { tool: 'present', place: 'keepquill' }, { tool: 'present', place: 'contact' },
    );
  }

  const tab = BROWSER.find((name) => new RegExp(`\\b${name}\\b`).test(text));
  if (tab && (tab !== 'portfolio' || /\b(browser|site|website|page)\b/.test(text))) {
    return one(`Opening ${tab === 'portfolio' ? 'the portfolio' : tab[0].toUpperCase() + tab.slice(1)} on the workstation.`, { tool: 'browser', tab });
  }
  if (/\b(open|use|show) the browser\b/.test(text)) return one('Opening the browser on the workstation.', { tool: 'browser', tab: 'portfolio' });

  const typed = /^(?:run|type|execute|enter|write)\s+(?:the\s+)?(?:command\s+)?([a-z]+)(?:\s+(?:on|in|into|at)\s+the\s+(?:terminal|console|shell|computer|workstation))?$/.exec(text)
    || /^(?:on|in) the (?:terminal|console|shell),? (?:run|type|execute|enter)\s+([a-z]+)$/.exec(text);
  if (typed && TERMINAL.includes(typed[1])) return one(`Running ${typed[1]} on the terminal.`, { tool: 'terminal', command: typed[1] });
  if (/^(open|use|start|boot|show)( up)? the (terminal|console|shell|computer|pc|workstation)$/.test(text)) {
    return one('Sitting down and opening the terminal.', { tool: 'terminal', command: 'help' });
  }

  if (/\b(hire|hiring|contact (him|eyad)|get in touch|reach (him|eyad|out)|send (him|eyad) a message|message (him|eyad)|book (a )?(call|meeting)|quote|pricing|his rates?|work with (him|eyad)|talk to (him|eyad))\b/.test(text) && !QUESTION.test(text)) {
    return one("I'll take you to the contact form with that written in.", { tool: 'contact', summary: String(raw).trim().slice(0, 300) });
  }

  const place = findPlace(text, PLACES);
  if (!place) return null;
  const label = PLACES[place].label;
  if (GO.test(text)) return one(`Walking to ${label}.`, { tool: 'go_to', place });
  if (SHOW.test(text) || text.split(' ').length <= 3) return one(`Here is ${label}.`, { tool: 'present', place });
  if (loose) return one(`The closest thing here is ${label}.`, { tool: 'present', place });
  return null;
}

export const isStop = (raw) => /^(stop|cancel|never ?mind|wait|hold on|that's enough|enough|quiet|shut up|be quiet)$/.test(clean(raw));
