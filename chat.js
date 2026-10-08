const FIRST_BYTE_MS = 8000;
const WARMING_MS = 4000;
const SILENCE_MS = 20000;
const TOTAL_MS = 45000;

let history = [];
let active = null;

async function* events(body, onBytes) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) return;
    onBytes();
    buffer += decoder.decode(value, { stream: true });

    let cut;
    while ((cut = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);

      let event = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      try { yield { event, data: JSON.parse(data) }; } catch { /* not ours */ }
    }
  }
}

function fail(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function remember(question, reply) {
  history.push({ role: 'user', content: question });
  history.push({ role: 'assistant', content: reply });
}

export async function ask(question, on = {}) {
  const api = window.PORTFOLIO_API;
  if (!api) throw fail('The assistant is not connected.', 'offline');

  cancel();
  const controller = new AbortController();
  const run = { controller, why: null };
  active = run;

  let watchdog;
  let warming;
  const arm = (ms, why) => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      run.why = why;
      controller.abort();
    }, ms);
  };

  const overall = setTimeout(() => {
    run.why = 'stalled';
    controller.abort();
  }, TOTAL_MS);

  try {
    arm(FIRST_BYTE_MS, 'unreachable');
    const res = await fetch(`${api}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ message: question, history: history.slice(-4), stream: true }),
    });

    if (!(res.headers.get('Content-Type') || '').includes('text/event-stream')) {
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw fail(data.message || 'I cannot reach the assistant right now.', data.code);
      remember(question, data.reply);
      return { reply: data.reply, hits: data.sources || [], handoff: data.handoff || null };
    }

    let reply = '';
    let hits = [];
    let handoff = null;
    let finished = false;

    for await (const { event, data } of events(res.body, () => arm(SILENCE_MS, 'stalled'))) {
      if (event === 'status') {
        on.stage?.(data.stage);
        clearTimeout(warming);
        if (data.stage === 'generating') warming = setTimeout(() => on.stage?.('warming'), WARMING_MS);
      } else if (event === 'sources') {
        hits = data.sources || [];
      } else if (event === 'delta') {
        clearTimeout(warming);
        reply += data.text;
        on.text?.(reply);
      } else if (event === 'replace') {
        clearTimeout(warming);
        reply = data.text;
        on.text?.(reply);
      } else if (event === 'handoff') {
        handoff = data.draft || null;
      } else if (event === 'done') {
        reply = data.reply ?? reply;
        finished = true;
      } else if (event === 'error') {
        throw fail(data.message || 'Something went wrong on my side.', data.code);
      }
    }

    if (!finished) throw fail('The answer was cut off.', 'cut_off');
    remember(question, reply);
    return { reply, hits, handoff };
  } catch (err) {
    if (!controller.signal.aborted) {
      throw err.code ? err : fail('The connection dropped before I finished.', 'network');
    }
    if (run.why === 'cancelled') throw fail('', 'cancelled');
    throw fail(
      run.why === 'stalled'
        ? 'The answer stalled half way.'
        : 'I could not reach the assistant.',
      run.why,
    );
  } finally {
    clearTimeout(watchdog);
    clearTimeout(warming);
    clearTimeout(overall);
    if (active === run) active = null;
  }
}

export function cancel() {
  if (!active) return;
  active.why = 'cancelled';
  active.controller.abort();
  active = null;
}

export function reset() {
  history = [];
}
