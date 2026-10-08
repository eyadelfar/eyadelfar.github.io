const nav = document.getElementById('nav');
const hero = document.getElementById('top');
const fabDock = document.getElementById('fabDock');
const CARD_GAP = 22;

const revealObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.classList.add('visible');
    revealObserver.unobserve(entry.target);
  }
}, { threshold: 0.06, rootMargin: '0px 0px -30px 0px' });

document.querySelectorAll('.reveal, .reveal-scale, .stagger').forEach((el) => revealObserver.observe(el));

if (hero) {
  new IntersectionObserver(([entry]) => {
    const past = !entry.isIntersecting;
    nav.classList.toggle('scrolled', past);
    if (fabDock) fabDock.classList.toggle('show', past);
  }, { rootMargin: '-72px 0px 0px 0px' }).observe(hero);
}

const links = new Map();
document.querySelectorAll('nav .nav-links a').forEach((a) => links.set(a.getAttribute('href').slice(1), a));

const spy = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    links.forEach((a) => a.classList.remove('active'));
    links.get(entry.target.id)?.classList.add('active');
  }
}, { rootMargin: '-45% 0px -50% 0px' });

document.querySelectorAll('section[id]').forEach((section) => spy.observe(section));

function cardStep(track) {
  const card = track.querySelector('.card');
  return (card ? card.offsetWidth : 0) + CARD_GAP;
}

function scrollCarousel(id, dir) {
  const track = document.getElementById(id);
  const step = cardStep(track);
  const perView = Math.max(1, Math.floor(track.clientWidth / step));
  track.scrollBy({ left: dir * step * perView, behavior: 'smooth' });
}

function initCarousel(trackId, dotsId, counterId, onChange) {
  const track = document.getElementById(trackId);
  const dots = document.getElementById(dotsId);
  const counter = document.getElementById(counterId);
  if (!track || !dots || !counter) return;
  const total = track.querySelectorAll('.card').length;

  for (let i = 0; i < total; i++) {
    const dot = document.createElement('button');
    dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', `Go to card ${i + 1}`);
    dot.onclick = () => track.scrollTo({ left: i * cardStep(track), behavior: 'smooth' });
    dots.appendChild(dot);
  }
  counter.textContent = `1 / ${total}`;

  let queued = false;
  track.addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
      const index = atEnd ? total - 1 : Math.max(0, Math.min(Math.round(track.scrollLeft / cardStep(track)), total - 1));
      counter.textContent = `${index + 1} / ${total}`;
      dots.querySelectorAll('.carousel-dot').forEach((d, i) => d.classList.toggle('active', i === index));
      if (onChange) onChange(index);
      queued = false;
    });
  }, { passive: true });
}

function expGoto(index) {
  const track = document.getElementById('expCarousel');
  if (track) track.scrollTo({ left: index * cardStep(track), behavior: 'smooth' });
}

document.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const carousel = document.querySelector('.carousel-track:hover, .journey-track:hover');
  if (carousel) scrollCarousel(carousel.id, e.key === 'ArrowRight' ? 1 : -1);
});

const steps = document.querySelectorAll('.journey-step-btn');
initCarousel('systemsCarousel', 'systemsDots', 'systemsCounter');
initCarousel('expCarousel', 'expDots', 'expCounter', (index) => {
  steps.forEach((step, i) => step.classList.toggle('active', i === Math.min(index, steps.length - 1)));
});
