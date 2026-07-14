/* Résumé agent client.
 *
 * The model runs server-side on Eyad's own Cloudflare Worker (Workers AI, free
 * tier) — an open-weights Llama running on Cloudflare's GPUs, with hybrid
 * retrieval (bge-small embeddings + BM25, fused with RRF) over his résumé.
 *
 * Deliberately NOT run in the visitor's browser: an earlier version downloaded
 * ~600MB of weights via WebLLM, which is an absurd thing to ask of a recruiter
 * who wants to ask one question. The visitor downloads nothing.
 */

let history = [];

export async function ask(question) {
  const api = window.PORTFOLIO_API;
  if (!api) throw new Error('no api configured');

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);

  try {
    const res = await fetch(api + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctl.signal,
      body: JSON.stringify({ message: question, history: history.slice(-4) }),
    });
    clearTimeout(timer);

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      // The Worker sends a human message for the cases a visitor can actually
      // hit (rate limited, daily quota gone). Surface that, not a code.
      const err = new Error(data.message || 'I can’t reach the assistant right now.');
      err.code = data.code;
      throw err;
    }

    history.push({ role: 'user', content: question });
    history.push({ role: 'assistant', content: data.reply });

    return {
      reply: data.reply,
      hits: data.sources || [],
      overridden: !!data.overridden,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function reset() {
  history = [];
}
