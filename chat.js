let history = [];

export async function ask(question) {
  const api = window.PORTFOLIO_API;
  if (!api) throw new Error('The assistant is not connected.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${api}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ message: question, history: history.slice(-4) }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const error = new Error(data.message || 'I cannot reach the assistant right now.');
      error.code = data.code;
      throw error;
    }

    history.push({ role: 'user', content: question });
    history.push({ role: 'assistant', content: data.reply });

    return { reply: data.reply, hits: data.sources || [], overridden: !!data.overridden };
  } finally {
    clearTimeout(timer);
  }
}

export function reset() {
  history = [];
}
