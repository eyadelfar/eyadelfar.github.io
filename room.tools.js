/* What the room's guide can do, and where it can go. The page shows this list,
   the Worker builds its prompt from it, and both check every action against it. */

export const PLACES = {
  desk: { label: 'the workstation', about: 'his workstation: a terminal and a browser with his portfolio, GitHub, LinkedIn and Kaggle', also: ['desk', 'workstation', 'computer', 'pc', 'monitor', 'terminal', 'screen', 'chair'] },
  impact: { label: 'the impact board', about: 'headline results of his work', also: ['impact', 'results', 'numbers', 'metrics', 'wins'] },
  journey: { label: 'the career board', about: 'his five employers and roles, Baron & Cabot back to e-finance', also: ['journey', 'career', 'experience', 'history', 'jobs', 'employers', 'work history'] },
  projects: { label: 'the projects board', about: 'earlier projects: mental health classifier, cigarette butt detection, OCR, attendance', also: ['projects', 'project board', 'featured projects', 'side projects'] },
  stack: { label: 'the stack board', about: 'languages, frameworks, cloud and tools he uses', also: ['stack', 'skills', 'tools', 'technologies', 'tech stack', 'arsenal'] },
  education: { label: 'the education board', about: 'degree at Helwan University, honors and courses', also: ['education', 'degree', 'university', 'study', 'studies', 'helwan'] },
  contact: { label: 'the contact board', about: 'email, LinkedIn, Kaggle, GitHub', also: ['contact board', 'links', 'email', 'linkedin'] },
  neural_networks: { label: 'the neural network exhibit', about: 'how neural networks learn', also: ['neural', 'neural network', 'neural networks', 'deep learning', 'backprop'] },
  transformers: { label: 'the transformer exhibit', about: 'self-attention, LLMs and RAG', also: ['transformer', 'transformers', 'llm', 'llms', 'attention', 'language model', 'language models'] },
  overfitting: { label: 'the overfitting exhibit', about: 'underfit, good fit, overfit on a live plot', also: ['overfit', 'overfitting', 'bias variance', 'underfitting', 'generalization'] },
  ar_scoring: { label: 'the AR creativity scoring exhibit', about: 'NEOMI: scoring the shapes children build from blocks for creativity', also: ['ar', 'ar scoring', 'ar exhibit', 'creativity', 'neomi', 'blocks', 'students'] },
  computer_vision: { label: 'the computer vision exhibit', about: 'real-time detection: cigarette butts, attendance by face', also: ['vision', 'computer vision', 'detection', 'yolo', 'object detection', 'cv'] },
  rag_voice: { label: 'the copilot and voice agent exhibit', about: 'Baron & Cabot: the real-time sales copilot and the AI voice agents', also: ['rag', 'copilot', 'voice agent', 'voice agents', 'sales copilot', 'calls', 'retrieval'] },
  forecasting: { label: 'the forecasting exhibit', about: 'MENRV.AI: the forecasting engine that cut reporting time', also: ['forecast', 'forecasting', 'time series', 'prediction'] },
  tts: { label: 'the multilingual speech exhibit', about: 'MENRV.AI: text to speech in many languages', also: ['tts', 'text to speech', 'multilingual', 'speech', 'languages exhibit'] },
  keepquill: { label: 'KeepQuill', about: 'his own product, proof of concept: AI photo books. Opens a sample book', also: ['keepquill', 'keep quill', 'book', 'sample book'] },
  favisra: { label: 'Favisra', about: 'his own product, proof of concept: creator analytics. Opens a demo dashboard', also: ['favisra', 'dashboard', 'favisra dashboard'] },
  mental_health: { label: 'the mental health classifier', about: 'the gamers mental health NLP classifier, Kaggle bronze medal', also: ['mental health', 'nlp classifier', 'gamers', 'kaggle project'] },
  cigarette_detection: { label: 'the cigarette butt detector', about: 'the YOLOv8 cigarette butt detector, best project medal', also: ['cigarette', 'cigarette butt', 'litter', 'butt detection'] },
  resume: { label: 'the résumé', about: 'his résumé as a PDF', also: ['resume', 'cv document', 'curriculum'] },
  certificates: { label: 'the certificates wall', about: 'certificates and letters on the wall', also: ['certificates', 'certifications', 'certs', 'honors', 'awards', 'diplomas'] },
  demos: { label: 'the live demo screens', about: 'recorded demos: the attendance system and signal graphs', also: ['demos', 'demo', 'videos', 'video wall', 'attendance', 'live demos', 'demo screens', 'live demo screens'] },
  meditation: { label: 'the quiet room', about: 'a planetarium off the main room: stars, a moon, somewhere to breathe', also: ['meditation', 'meditation room', 'quiet room', 'planetarium', 'zen', 'relax', 'breathe', 'stars', 'night sky', 'moon'] },
  solar_system: { label: 'the solar system', about: 'a small solar system turning over a dark pool, in the quiet room', also: ['solar system', 'planets', 'orrery', 'sun', 'saturn', 'space'] },
  constellation: { label: 'the neural constellation', about: 'a neural network laid out as stars on the dome', also: ['constellation', 'neural constellation', 'network of stars'] },
  project_stars: { label: 'the wall of project stars', about: 'every piece of work listed on the site, as a star, grouped by topic', also: ['project stars', 'galaxy', 'galaxy of projects', 'all his projects', 'everything he built', 'star wall'] },
  whiteboard: { label: 'the architecture whiteboard', about: 'how the sales copilot and automation platform fit together', also: ['whiteboard', 'architecture', 'topology', 'system design', 'diagram'] },
  door: { label: 'the door', about: 'the way out of the room, back to the portfolio page', also: ['door', 'exit', 'way out', 'entrance', 'front door'] },
};

export const TERMINAL = ['help', 'home', 'impact', 'journey', 'projects', 'stack', 'education', 'contact', 'clear'];
export const BROWSER = ['portfolio', 'github', 'linkedin', 'kaggle'];
export const VIEWS = ['first_person', 'third_person'];
const SWITCH = ['on', 'off'];

/* Routes through the room for different visitors. Each stop is a place above. */
export const TOURS = {
  short: { name: 'the short tour', say: 'Here is the short tour: his results, the voice agents, his own products, then how to reach him.', stops: ['impact', 'rag_voice', 'keepquill', 'contact'] },
  founder: { name: "the founder's tour", say: "The founder's tour: what he has put into production, the two products he built himself, his path so far, then how to reach him.", stops: ['impact', 'rag_voice', 'keepquill', 'favisra', 'journey', 'contact'] },
  sales: { name: 'the sales tour', say: 'The sales tour: the copilot and voice agents built for a sales floor, how they fit together, the results, then how to reach him.', stops: ['rag_voice', 'whiteboard', 'impact', 'forecasting', 'contact'] },
  engineer: { name: "the engineer's tour", say: "The engineer's tour: the architecture, the stack, how the models work, the vision work, live demos, then his earlier projects.", stops: ['whiteboard', 'stack', 'transformers', 'computer_vision', 'demos', 'projects'] },
};

/* Everything a visitor can do in the room is here, so the guide can do it for
   them or tell them how. `keys` is how to do the same thing by hand. */
export const TOOLS = [
  { name: 'go_to', arg: 'place', values: Object.keys(PLACES), does: 'Walk to a place in the room.', example: 'go to the stack board', keys: 'click the floor or a thing, or W A S D' },
  { name: 'present', arg: 'place', values: Object.keys(PLACES), does: 'Walk to a place and open what is there.', example: 'show me the voice agents', keys: 'click it, or E in first person' },
  { name: 'tour', arg: 'mode', values: Object.keys(TOURS), fallback: 'short', does: 'Walk a tour: the short one, or one for a founder, a sales lead or an engineer.', example: 'give me the founder tour' },
  // Only the visitor sends a brief: a model is never offered this one.
  { name: 'brief', arg: 'summary', values: null, visitorOnly: true, does: 'Send what you want built to Eyad, in your words.', example: 'send him my brief' },
  { name: 'terminal', arg: 'command', values: TERMINAL, does: 'Sit at the workstation and run a command.', example: 'run projects on the terminal', keys: 'sit, then T and type' },
  { name: 'browser', arg: 'tab', values: BROWSER, does: 'Open a tab in the workstation browser.', example: 'open his GitHub', keys: 'E on the monitor' },
  { name: 'sit', arg: null, values: null, does: 'Sit down at the workstation.', example: 'sit down', keys: 'E on the chair' },
  { name: 'stand', arg: null, values: null, does: 'Stand up.', example: 'stand up', keys: 'F' },
  { name: 'view', arg: 'mode', values: VIEWS, does: 'Switch between first and third person.', example: 'first person', keys: 'V' },
  { name: 'zoom', arg: 'mode', values: ['in', 'out'], does: 'Bring the camera closer or pull it back.', example: 'zoom in', keys: 'scroll' },
  { name: 'turn', arg: 'mode', values: ['left', 'right', 'around'], does: 'Turn to look another way.', example: 'turn around', keys: 'drag, or the mouse in first person' },
  { name: 'pace', arg: 'mode', values: ['walk', 'jog'], does: 'Walk or jog from here on.', example: 'jog to the door', keys: 'hold Shift' },
  { name: 'cycle', arg: 'place', values: ['overfitting', 'ar_scoring'], does: 'Step a live exhibit to its next example.', example: 'next sample on the AR exhibit', keys: 'click the exhibit again' },
  { name: 'gesture', arg: 'mode', values: ['nod', 'shake'], does: 'Have the avatar nod or shake his head.', example: 'nod' },
  { name: 'map', arg: 'mode', values: SWITCH, does: 'Show or hide the map.', example: 'hide the map', keys: 'M' },
  { name: 'sound', arg: 'mode', values: SWITCH, does: 'Turn the sound on or off.', example: 'mute the sound', keys: 'the speaker button' },
  { name: 'close', arg: null, values: null, does: 'Close whatever is open.', example: 'close that', keys: 'Esc' },
  { name: 'contact', arg: 'summary', values: null, does: 'Take your request to the contact form, already written.', example: 'I want to hire him' },
  { name: 'leave', arg: null, values: null, does: 'Walk out of the door, back to the portfolio.', example: 'take me back to the portfolio', keys: 'Esc twice, or the door' },
];

/* How to use the room, answered on the spot with no model. First match wins. */
export const HELP = [
  { when: /\b(walk|move|get around|go somewhere|navigate|wasd|joystick)\b/, say: 'Click the floor and he walks there, or use W A S D. Hold Shift to jog. Or just tell me where to go.', touch: 'Put your left thumb down anywhere in the lower left and steer, or tap the floor and he walks there. Or just tell me where to go.' },
  { when: /\b(jog|run|faster|sprint|speed)\b/, say: 'Hold Shift while you move to jog. You can also say: jog to the door.', touch: 'Push the stick all the way, or tap the floor twice. You can also say: jog to the door.' },
  { when: /\b(first person|third person|view|perspective|eyes)\b/, say: 'Press V to switch between third person and seeing through his eyes. Or say: first person.', touch: 'The eye button switches between third person and his own eyes.' },
  { when: /\b(look|camera|rotate|turn|zoom|orbit)\b/, say: 'Drag to look around and scroll to zoom. I can do it too: say turn around, or zoom in.', touch: 'Drag to look around and pinch with two fingers to zoom. I can do it too: say turn around, or zoom in.' },
  { when: /\b(sit|chair|stand up|get up)\b/, say: 'Click the chair to sit at the workstation, and press F to stand again. Or say: sit down.', touch: 'Tap the chair to sit, and the Stand button to get up.' },
  { when: /\b(terminal|console|shell|command|commands|computer|pc|workstation|monitor|browser|boot)\b/, say: 'Sit at the workstation, click the monitor to switch it on, then press T to type a command or Tab to flip pages. Click the monitor again for the browser. Or say: run projects on the terminal.', touch: 'Tap the chair to sit. The buttons that appear switch the screen on, run each command and open the browser. Or say: run projects on the terminal.' },
  { when: /\b(map|minimap|lost|where am i)\b/, say: 'The map is in the corner. Click a dot to be walked there, and press M to hide or show it.', touch: 'The map button is at the top. Tap a dot on it to be walked there.' },
  { when: /\b(sound|audio|mute|music|volume|noise)\b/, say: 'The speaker button at the top switches the sound. Or say: mute the sound.' },
  { when: /\b(talk|speak|voice|microphone|mic|push to talk|type|chat|ask you)\b/, say: 'Hold P and talk, then let go. Or press C and type. Chain steps with "then": go to the desk then sit down.', touch: 'Tap the mic, talk, then tap it again to send. Or type here. Chain steps with "then".' },
  { when: /\b(quiet room|meditation|planetarium|stars|doorway)\b/, say: 'The glowing doorway in the back wall leads to the quiet room. Say: take me to the quiet room.' },
  { when: /\b(leave|exit|go back|way out|door|portfolio)\b/, say: 'Walk out of the door, press Esc twice, or use the Portfolio button. Or say: take me back to the portfolio.', touch: 'Tap the arrow at the top left, or walk out of the door. Or say: take me back to the portfolio.' },
  { when: /\b(stop|cancel|interrupt)\b/, say: 'Press Esc, move yourself, or say stop, and I stop at once.', touch: 'Tap the big button while I am busy, move the stick, or say stop, and I stop at once.' },
  { when: /\b(open|interact|use|click|read|board|boards|exhibit|exhibits|panel|close)\b/, say: 'Click anything that lights up under the pointer: he walks over and opens it. In first person, look at it and press E. Esc closes it.', touch: 'Tap anything on a wall or a stand: he walks over and opens it.' },
  { when: /\b(key|keys|keyboard|controls|shortcuts|shortcut|buttons|play|work)\b/, say: 'Click to walk, drag to look, scroll to zoom. W A S D move, Shift jogs, V changes view, M is the map, E uses things, F stands up, P talks to me, C types to me, Esc closes.', touch: 'Left thumb moves, a full push jogs. Drag to look, pinch to zoom, tap the floor to walk there and tap things to open them. The big button does the next thing, the eye changes view, the mic talks to me, and the map is at the top.' },
];
export const ABOUT_GUIDE = "I can take you anywhere here and open it, run the workstation, change the view, the map and the sound, and answer questions about Eyad's work. Try: show me the voice agents, give me a tour, or ask how to do something.";

export const MAX_ACTIONS = 6;

/* Keeps only actions the room can really run. Anything else is dropped, never guessed at. */
export function validActions(actions) {
  if (!Array.isArray(actions)) return [];
  const out = [];
  for (const action of actions) {
    const tool = TOOLS.find((t) => t.name === action?.tool);
    if (!tool) continue;
    if (!tool.arg) {
      out.push({ tool: tool.name });
    } else if (tool.values) {
      const value = String(action[tool.arg] ?? '').toLowerCase().trim() || tool.fallback;
      if (tool.values.includes(value)) out.push({ tool: tool.name, [tool.arg]: value });
    } else {
      const value = String(action[tool.arg] ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
      if (value) out.push({ tool: tool.name, [tool.arg]: value });
    }
    if (out.length === MAX_ACTIONS) break;
  }
  return out;
}
