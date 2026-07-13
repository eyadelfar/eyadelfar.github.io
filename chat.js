/* Resume agent — runs entirely in the visitor's browser.
 *
 * There is no server. WebLLM executes an open-weights Qwen model on the
 * visitor's GPU via WebGPU; retrieval is a hybrid of MiniLM embeddings and BM25,
 * both computed locally. Nothing is sent anywhere.
 *
 * Lazy-loaded: nothing here is fetched until someone actually opens the chat.
 */

const LLM_CDN = 'https://esm.run/@mlc-ai/web-llm';
const EMBED_CDN = 'https://esm.run/@huggingface/transformers';

const MODEL_ID = 'Qwen3.5-0.8B-q4f16_1-MLC';
const EMBED_MODEL = 'Xenova/all-MiniLM-L6-v2';
const TOP_K = 3;
const MAX_TOKENS = 200;

const SYSTEM = `You are the resume assistant for Eyad Elfar, an AI Engineer in Dubai.

The FACTS section of each question is verified information about Eyad. Treat it as true and
answer directly from it. Do not contradict it, and do not add anything not stated in it.

- Answer in 2-3 sentences, third person, no preamble.
- Only if the FACTS genuinely do not mention the thing being asked, say you don't have that
  detail and point them to the contact form.
- Decline anything not about Eyad or his work.

Background on Eyad:
`;

let kb = null;          // { core, chunks:[{source,title,text}] }
let vectors = null;     // Float32Array[] aligned with kb.chunks
let embedder = null;
let engine = null;
let history = [];

/* ---------------------------------------------------------------- retrieval */

const TOKEN = /[a-z0-9+#.]+/g;
const STOP = new Set(('a about an and any are as at be been by can did do does for from give had has have he her him ' +
  'his how i if in into is it its me much my of on or please she show so some tell that the their them then there ' +
  'these they this to told us was were what when where which who whom why will with would you your').split(' '));

const tokenize = s => (s.toLowerCase().match(TOKEN) || []);

let df = new Map(), docs = [], avglen = 0;

function buildBM25() {
  docs = kb.chunks.map(c => tokenize(c.text));
  df = new Map();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) || 0) + 1);
  avglen = docs.reduce((a, d) => a + d.length, 0) / Math.max(1, docs.length);
}

/* Query terms that can actually discriminate. Visitors ask questions, not
   keyword queries — left unfiltered, BM25 ranks on "what/does/he/have" and
   floats a generic FAQ blurb to the top. */
function queryTerms(q) {
  const n = Math.max(1, docs.length);
  return tokenize(q).filter(t => !STOP.has(t) && t.length > 1 && (df.get(t) || 0) <= 0.4 * n);
}

function bm25Rank(q) {
  const terms = queryTerms(q);
  if (!terms.length) return [];
  const n = docs.length, K1 = 1.5, B = 0.75;
  const scores = docs.map((doc, i) => {
    let s = 0;
    for (const t of terms) {
      let tf = 0;
      for (const w of doc) if (w === t) tf++;
      if (!tf) continue;
      const idf = Math.log(1 + (n - (df.get(t) || 0) + 0.5) / ((df.get(t) || 0) + 0.5));
      s += idf * (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * doc.length / avglen));
    }
    return { i, s };
  });
  return scores.filter(x => x.s > 0).sort((a, b) => b.s - a.s).map(x => x.i);
}

const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

async function embed(texts) {
  const out = await embedder(texts, { pooling: 'mean', normalize: true });
  return out.tolist().map(v => Float32Array.from(v));
}

/* Reciprocal Rank Fusion. The textbook constant is 60, but that is tuned for
   lists of thousands; over ~33 chunks it flattens rank so completely that a
   chunk merely present in BOTH lists outranks the chunk one list put first. */
const RRF_K = 10;

async function retrieve(question, k = TOP_K) {
  const [qv] = await embed([question]);
  const sims = vectors.map((v, i) => ({ i, sim: dot(qv, v) }));
  const denseRank = sims.slice().sort((a, b) => b.sim - a.sim).map(x => x.i);
  const lexRank = bm25Rank(question);

  const fused = new Map();
  const add = (arr) => arr.slice(0, 12).forEach((idx, rank) => {
    fused.set(idx, (fused.get(idx) || 0) + 1 / (RRF_K + rank + 1));
  });
  add(denseRank);
  add(lexRank);

  return [...fused.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([i, score]) => ({ ...kb.chunks[i], score, sim: sims[i].sim, lexical: lexRank.includes(i) }));
}

/* ------------------------------------------------------------- safety net */

// A 0.8B model is small enough to contradict facts sitting in its own context —
// in testing it answered "No, Eyad has not won any awards" with the medal list
// retrieved at rank 1. A denial is only trustworthy when retrieval ALSO came up
// empty; if we found a strongly-matching passage, the model is wrong, not the
// corpus. In that case we show the passage instead of the model's answer.
const DENIAL = /\b(no,|not won|has not|hasn't|haven't|does not|doesn't|did not|didn't|no awards|no record|don't have|do not have|not mentioned|no information|unable to|not stated)\b/i;
const STRONG_HIT = 0.45;

function safetyNet(reply, hits) {
  if (!DENIAL.test(reply)) return { reply, overridden: false };
  const top = hits[0];
  if (!top || top.sim < STRONG_HIT) return { reply, overridden: false };

  // Drop the heading line — it's a retrieval aid, not prose.
  const body = top.text.split('\n').slice(1).join('\n').trim() || top.text;
  return {
    reply: `Straight from his resume — ${top.title}:\n\n${body}`,
    overridden: true,
  };
}

const stripThinking = s => s.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

/* ---------------------------------------------------------------- engine */

/* `navigator.gpu` existing is not the same as WebGPU working — some browsers
   expose the object but hand back no adapter (headless, blocklisted drivers,
   software rendering). Ask for the adapter before committing the visitor to a
   ~600MB download that would only fail at the end. */
export async function webgpuAvailable() {
  if (typeof navigator === 'undefined' || !navigator.gpu) return false;
  try {
    return !!(await navigator.gpu.requestAdapter());
  } catch (e) {
    return false;
  }
}

export async function init(onProgress) {
  if (engine) return;

  onProgress?.({ text: 'Loading knowledge base…', progress: 0.02 });
  kb = await (await fetch('knowledge.json?v=1')).json();
  buildBM25();

  onProgress?.({ text: 'Loading embedding model (~25MB)…', progress: 0.06 });
  const { pipeline } = await import(/* @vite-ignore */ EMBED_CDN);
  embedder = await pipeline('feature-extraction', EMBED_MODEL);
  vectors = await embed(kb.chunks.map(c => c.text));

  onProgress?.({ text: 'Downloading the language model…', progress: 0.12 });
  const webllm = await import(/* @vite-ignore */ LLM_CDN);
  engine = await webllm.CreateMLCEngine(MODEL_ID, {
    initProgressCallback: (r) => {
      // Reserve the first 15% of the bar for the steps above.
      onProgress?.({ text: r.text, progress: 0.15 + 0.85 * (r.progress || 0) });
    },
  });
  onProgress?.({ text: 'Ready', progress: 1 });
}

/** Retrieval-only answer, for browsers without WebGPU. No generation, so it
 *  cannot hallucinate — it just shows the most relevant passage. */
export async function answerWithoutLLM(question) {
  if (!kb) {
    kb = await (await fetch('knowledge.json?v=1')).json();
    buildBM25();
    const { pipeline } = await import(/* @vite-ignore */ EMBED_CDN);
    embedder = await pipeline('feature-extraction', EMBED_MODEL);
    vectors = await embed(kb.chunks.map(c => c.text));
  }
  const hits = await retrieve(question);
  const top = hits[0];
  if (!top || top.sim < 0.3) {
    return { reply: "I couldn't find that in his resume. The contact form below reaches him directly.", hits: [] };
  }
  const body = top.text.split('\n').slice(1).join('\n').trim() || top.text;
  return { reply: `From his resume — ${top.title}:\n\n${body}`, hits };
}

export async function ask(question, onDelta) {
  const hits = await retrieve(question);
  const facts = hits.map(h => h.text).join('\n\n') || '(none)';

  const messages = [
    { role: 'system', content: SYSTEM + kb.core },
    ...history.slice(-4),
    { role: 'user', content: `FACTS:\n${facts}\n\nQUESTION: ${question}` },
  ];

  let raw = '';
  const stream = await engine.chat.completions.create({
    messages,
    stream: true,
    temperature: 0.3,
    max_tokens: MAX_TOKENS,
  });
  for await (const part of stream) {
    const delta = part.choices[0]?.delta?.content || '';
    if (!delta) continue;
    raw += delta;
    onDelta?.(stripThinking(raw));
  }

  const { reply, overridden } = safetyNet(stripThinking(raw), hits);
  history.push({ role: 'user', content: question }, { role: 'assistant', content: reply });
  return { reply, hits, overridden };
}

export function reset() { history = []; }
