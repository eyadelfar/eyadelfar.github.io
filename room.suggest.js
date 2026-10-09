/* What to offer a visitor: completions for what they are typing to the guide,
   and what is worth doing next from where they stand. Every phrase offered here
   is one the guide understands without a model. */

const FIXED = [
  ['give me a tour', 'tour start around everything short'],
  ['give me the founder tour', "tour i'm a founder ceo business startup"],
  ['give me the sales tour', 'tour i run a sales team revenue'],
  ['give me the engineer tour', "tour i'm an engineer developer technical"],
  ['I have a project', 'need something built brief idea problem'],
  ['sit down', 'sit chair seat'],
  ['stand up', 'stand get up'],
  ['first person', 'view eyes camera'],
  ['third person', 'view spectator camera'],
  ['zoom in', 'closer camera'],
  ['zoom out', 'further back camera'],
  ['turn around', 'look behind rotate'],
  ['turn left', 'look rotate'],
  ['turn right', 'look rotate'],
  ['hide the map', 'minimap remove off'],
  ['show the map', 'minimap on'],
  ['mute the sound', 'audio off silence quiet'],
  ['turn the sound on', 'audio unmute'],
  ['close that', 'dismiss panel exit'],
  ['stop', 'cancel wait'],
  ['nod', 'gesture yes'],
  ['next sample on the AR exhibit', 'cycle score drawing'],
  ['next fit on the overfitting exhibit', 'cycle curve regime'],
  ['take me back to the portfolio', 'leave exit door out quit'],
  ['I want to hire him', 'contact work quote call meeting'],
  ['what can you do', 'help guide'],
  ['what are the controls', 'help keys keyboard shortcuts'],
  ['how do I move', 'help walk'],
];

/* The order a first visit is best seen in. */
const ROUTE = [
  'impact', 'rag_voice', 'keepquill', 'favisra', 'journey', 'stack', 'transformers', 'neural_networks',
  'computer_vision', 'forecasting', 'tts', 'ar_scoring', 'overfitting', 'projects', 'mental_health',
  'cigarette_detection', 'whiteboard', 'demos', 'certificates', 'resume', 'education', 'meditation',
  'solar_system', 'constellation', 'project_stars', 'contact',
];

const STEP = /^(.*(?:[,;]|\b(?:and then|then|after that))\s+)([^,;]*)$/i;

export function phrases({ PLACES, TERMINAL, BROWSER }) {
  const list = FIXED.map(([text, more]) => ({ text, more }));
  for (const [id, place] of Object.entries(PLACES)) {
    const more = `${id.replace(/_/g, ' ')} ${place.also.join(' ')}`;
    list.push({ text: `show me ${place.label}`, more }, { text: `go to ${place.label}`, more }, { text: `jog to ${place.label}`, more: `${more} run` });
  }
  for (const command of TERMINAL) list.push({ text: `run ${command} on the terminal`, more: 'console shell type command' });
  for (const tab of BROWSER) list.push({ text: tab === 'portfolio' ? 'open the portfolio in the browser' : `open his ${tab[0].toUpperCase()}${tab.slice(1)}`, more: 'browser tab website' });
  return list;
}

/* Up to `limit` whole requests that finish what has been typed so far. After
   "then" or a comma only the last step is completed; the rest is kept. */
export function complete(typed, tables, limit = 5) {
  const split = STEP.exec(typed);
  const lead = split ? split[1] : '';
  const words = (split ? split[2] : typed).toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const query = words.join(' ');
  const scored = [];
  for (const phrase of phrases(tables)) {
    const text = phrase.text.toLowerCase();
    const bag = `${text} ${phrase.more}`.split(/\s+/);
    let score = 0;
    if (text.startsWith(query)) score = 4;
    else if (words.every((word) => bag.some((have) => have.startsWith(word)))) score = text.split(' ')[0].startsWith(words[0]) ? 3 : words.every((word) => text.includes(word)) ? 2 : 1;
    if (score && text !== query) scored.push({ score, text: phrase.text });
  }
  scored.sort((a, b) => b.score - a.score || a.text.length - b.text.length);
  const seen = new Set();
  const out = [];
  for (const { text } of scored) {
    // "show", "go to" and "jog to" the same place: one is enough unless the visitor typed the verb.
    const thing = text.replace(/^(show me|go to|jog to) /, '');
    if (seen.has(thing) && !/^(show|go|jog)/.test(query)) continue;
    seen.add(thing);
    out.push(lead + text);
    if (out.length === limit) break;
  }
  return out;
}

/* What is worth doing from here: [{ label, ask }], best first. `ask` is a
   request the guide runs as is. */
export function next({ state, seen, places, tables }, limit = 3) {
  const { PLACES } = tables;
  const has = (id) => seen.includes(id);
  const out = [];
  const add = (label, ask) => { if (out.length < limit && !out.some((item) => item.ask === ask)) out.push({ label, ask }); };

  if (state.open) add('Close this', 'close that');
  if (state.seated) {
    add('Run "projects"', 'run projects on the terminal');
    add('Open his GitHub', 'open his GitHub');
    add('Stand up', 'stand up');
    return out;
  }

  const unseen = Object.keys(places).filter((id) => PLACES[id] && !has(id) && id !== 'door' && id !== 'desk');
  let nearest = null;
  let best = 5.5;
  for (const id of unseen) {
    const d = Math.hypot(places[id].stand[0] - state.x, places[id].stand[1] - state.z);
    if (d < best) { best = d; nearest = id; }
  }
  if (nearest) add(`Open ${PLACES[nearest].label}`, `show me ${PLACES[nearest].label}`);
  if (!seen.length) add('Take the tour', 'give me a tour');
  const onward = ROUTE.find((id) => places[id] && !has(id) && id !== nearest);
  if (onward) add(`Next: ${PLACES[onward].label}`, `show me ${PLACES[onward].label}`);
  if (state.zone !== 'quiet' && places.meditation && !has('meditation')) add('Visit the quiet room', 'take me to the quiet room');
  if (seen.length >= 5 && !has('contact')) add('How to reach him', 'show me the contact board');
  if (!unseen.length) {
    add('Work with him', 'I want to hire him');
    add('Back to the portfolio', 'take me back to the portfolio');
  }
  add('Sit at the workstation', 'sit down');
  return out;
}

export const total = (places, { PLACES }) => Object.keys(places).filter((id) => PLACES[id] && id !== 'door' && id !== 'desk').length;
