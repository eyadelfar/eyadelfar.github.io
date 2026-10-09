/* One line said at each place the first time a visitor opens it, in the guide's
   voice. The words are the same ones the room and the site already use. The
   recordings are made once by tools/make_intros.mjs, so hearing them costs a
   visitor nothing. */

export const INTRO_VERSION = 'cc1d24f2';

export const INTROS = {
  desk: 'This is his workstation: a terminal, and a browser with his portfolio, GitHub, LinkedIn and Kaggle.',
  impact: 'The impact board: the headline results of his work.',
  journey: 'The career board: his five employers and roles, from e-finance to Baron and Cabot.',
  projects: 'The projects board: his earlier projects, from a mental health classifier to an attendance system.',
  stack: 'The stack board: the languages, frameworks, cloud and tools he works with.',
  education: 'The education board: his degree at Helwan University, his honors and courses.',
  contact: 'The contact board: his email, LinkedIn, Kaggle and GitHub.',
  neural_networks: 'This exhibit shows how a neural network learns.',
  transformers: 'This one is about transformers: self-attention, language models and retrieval.',
  overfitting: 'Overfitting, on a live plot: the same data fitted too little, just right, and too much.',
  ar_scoring: 'For NEOMI he built the engine that scores the shapes children build from blocks, for creativity.',
  computer_vision: 'Computer vision in real time: detecting cigarette butts, and taking attendance by face.',
  rag_voice: 'From Baron and Cabot: the real-time sales copilot, and the AI voice agents.',
  forecasting: 'At MENRV he built a forecasting engine that cut reporting time.',
  tts: 'Also from MENRV: text to speech in many languages.',
  keepquill: 'KeepQuill is his own product, a proof of concept: AI photo books. This opens a sample book.',
  favisra: 'Favisra is his own product, a proof of concept: creator analytics. This opens a demo dashboard.',
  mental_health: 'The gamers mental health classifier, which earned a Kaggle bronze medal.',
  cigarette_detection: 'The cigarette butt detector, which won a best project medal.',
  resume: 'His résumé, as a document you can read here.',
  certificates: 'The certificates wall: his certificates and letters.',
  demos: 'Recorded demos: the attendance system, and signal graphs.',
  meditation: 'The quiet room: a planetarium with stars, a moon, and somewhere to breathe.',
  solar_system: 'A small solar system, turning over a dark pool.',
  constellation: 'A neural network, laid out as stars on the dome.',
  project_stars: 'Every piece of work listed on the site, as a star, grouped by topic.',
  whiteboard: 'The architecture whiteboard: how the sales copilot and the automation platform fit together.',
  door: 'The door: the way back to the portfolio.',
};

export const introSrc = (id) => `voice/room/${id}.mp3?v=${INTRO_VERSION}`;
