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
  ar_scoring: { label: 'the AR creativity scoring exhibit', about: 'NEOMI: scoring the shapes children build from blocks for creativity', also: ['ar', 'ar scoring', 'creativity', 'neomi', 'blocks', 'students'] },
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
  demos: { label: 'the live demo screens', about: 'recorded demos: the attendance system and signal graphs', also: ['demos', 'demo', 'videos', 'video wall', 'attendance', 'live demos'] },
  whiteboard: { label: 'the architecture whiteboard', about: 'how the sales copilot and automation platform fit together', also: ['whiteboard', 'architecture', 'topology', 'system design', 'diagram'] },
};

export const TERMINAL = ['help', 'home', 'impact', 'journey', 'projects', 'stack', 'education', 'contact', 'clear'];
export const BROWSER = ['portfolio', 'github', 'linkedin', 'kaggle'];
export const VIEWS = ['first_person', 'third_person'];

export const TOOLS = [
  { name: 'go_to', arg: 'place', values: Object.keys(PLACES), does: 'Walk to a place in the room.', example: 'go to the stack board' },
  { name: 'present', arg: 'place', values: Object.keys(PLACES), does: 'Walk to a place and open what is there.', example: 'show me the voice agents' },
  { name: 'terminal', arg: 'command', values: TERMINAL, does: 'Sit at the workstation and run a command.', example: 'run projects on the terminal' },
  { name: 'browser', arg: 'tab', values: BROWSER, does: 'Open a tab in the workstation browser.', example: 'open his GitHub' },
  { name: 'contact', arg: 'summary', values: null, does: 'Take your request to the contact form, already written.', example: 'I want to hire him' },
  { name: 'sit', arg: null, values: null, does: 'Sit down at the workstation.', example: 'sit down' },
  { name: 'stand', arg: null, values: null, does: 'Stand up.', example: 'stand up' },
  { name: 'view', arg: 'mode', values: VIEWS, does: 'Switch between first and third person.', example: 'first person' },
  { name: 'close', arg: null, values: null, does: 'Close whatever is open.', example: 'close that' },
];

export const MAX_ACTIONS = 4;

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
      const value = String(action[tool.arg] ?? '').toLowerCase().trim();
      if (tool.values.includes(value)) out.push({ tool: tool.name, [tool.arg]: value });
    } else {
      const value = String(action[tool.arg] ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
      if (value) out.push({ tool: tool.name, [tool.arg]: value });
    }
    if (out.length === MAX_ACTIONS) break;
  }
  return out;
}
