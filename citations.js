export function renderCitations(bubble, hits, overridden) {
  const sources = (hits || []).slice(0, 3);
  if (!sources.length) return;

  const wrap = document.createElement('div');
  wrap.className = 'ask-cites';

  if (overridden) {
    const note = document.createElement('div');
    note.className = 'ask-note';
    note.textContent = 'That contradicted his resume, so this shows the source text instead.';
    wrap.appendChild(note);
  }

  const label = document.createElement('span');
  label.className = 'ask-cites-label';
  label.textContent = 'Grounded in';
  wrap.appendChild(label);

  const passage = document.createElement('div');
  passage.className = 'ask-cite-body';
  passage.hidden = true;

  for (const source of sources) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'ask-cite';
    chip.setAttribute('aria-expanded', 'false');
    chip.textContent = source.title;

    if (source.score !== undefined) {
      const score = document.createElement('span');
      score.className = 'cite-score';
      score.textContent = source.score.toFixed(2);
      chip.appendChild(score);
    }

    chip.addEventListener('click', () => {
      const wasOpen = chip.getAttribute('aria-expanded') === 'true';
      for (const other of wrap.querySelectorAll('.ask-cite')) {
        other.setAttribute('aria-expanded', 'false');
      }
      if (wasOpen) {
        passage.hidden = true;
      } else {
        chip.setAttribute('aria-expanded', 'true');
        passage.textContent = source.text || 'Passage unavailable.';
        passage.hidden = false;
      }
      bubble.dispatchEvent(new CustomEvent('cite-toggle', { bubbles: true }));
    });

    wrap.appendChild(chip);
  }

  wrap.appendChild(passage);
  bubble.appendChild(wrap);
}
