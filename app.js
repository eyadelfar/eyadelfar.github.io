
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
    }
  });
}, { threshold: 0.06, rootMargin: '0px 0px -30px 0px' });

document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale, .stagger').forEach(el => {
  revealObserver.observe(el);
});

const nav = document.querySelector('nav');
const navLinks = document.querySelectorAll('nav .nav-links a');
const sections = document.querySelectorAll('section[id]');

(function () {
  const el = document.getElementById('ghRange');
  if (!el) return;
  const now = new Date();
  const start = new Date(now); start.setFullYear(now.getFullYear() - 1);
  const fmt = d => d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  el.textContent = `${fmt(start)} – ${fmt(now)}`;
})();

const backToTop = document.querySelector('.back-to-top');
const heroBg = document.querySelector('.hero-bg');
let ticking = false;

let secCache = [];
function rebuildSecCache() {
  secCache = Array.prototype.map.call(sections, s => {
    const top = s.offsetTop - 100;
    return { top, bottom: top + s.offsetHeight, link: document.querySelector(`nav a[href="#${s.getAttribute('id')}"]`) };
  });
}
function onScroll() {
  const y = window.scrollY;
  nav.classList.toggle('scrolled', y > 60);
  if (backToTop) backToTop.classList.toggle('show', y > 500);
  const scrollY = y + 140;
  for (const s of secCache) {
    if (s.link && scrollY >= s.top && scrollY < s.bottom) {
      navLinks.forEach(l => l.classList.remove('active'));
      s.link.classList.add('active');
    }
  }
  if (heroBg && y < window.innerHeight) heroBg.style.transform = `translateY(${y * 0.35}px)`;
  ticking = false;
}
window.addEventListener('scroll', () => {
  if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
}, { passive: true });
window.addEventListener('resize', rebuildSecCache, { passive: true });
window.addEventListener('load', rebuildSecCache);
rebuildSecCache();

const countObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.querySelectorAll('.stat .num').forEach(num => {
        const text = num.textContent;
        const match = text.match(/(\d+)/);
        if (match) {
          const target = parseInt(match[1]);
          const prefix = text.substring(0, text.indexOf(match[1]));
          const suffix = text.substring(text.indexOf(match[1]) + match[1].length);
          let current = 0;
          const step = Math.max(1, Math.floor(target / 40));
          const interval = setInterval(() => {
            current = Math.min(current + step, target);
            num.textContent = prefix + current + suffix;
            if (current >= target) clearInterval(interval);
          }, 30);
        }
      });
      countObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.stats-bar').forEach(el => countObserver.observe(el));

function scrollCarousel(id, dir) {
  const track = document.getElementById(id);
  const card = track.querySelector('.card');
  const cardW = card.offsetWidth + 22;
  track.scrollBy({ left: dir * cardW, behavior: 'smooth' });
}

function initCarousel(trackId, dotsId, counterId) {
  const track = document.getElementById(trackId);
  const dots = document.getElementById(dotsId);
  const counter = document.getElementById(counterId);
  const cards = track.querySelectorAll('.card');
  const total = cards.length;
  let cardW = (cards[0] ? cards[0].offsetWidth : 0) + 22;
  window.addEventListener('resize', () => { cardW = (cards[0] ? cards[0].offsetWidth : 0) + 22; }, { passive: true });

  for (let i = 0; i < total; i++) {
    const dot = document.createElement('button');
    dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
    dot.onclick = () => track.scrollTo({ left: i * cardW, behavior: 'smooth' });
    dots.appendChild(dot);
  }

  let ctick = false;
  track.addEventListener('scroll', () => {
    if (ctick) return; ctick = true;
    requestAnimationFrame(() => {
      const clamped = Math.max(0, Math.min(Math.round(track.scrollLeft / cardW), total - 1));
      counter.textContent = (clamped + 1) + ' / ' + total;
      dots.querySelectorAll('.carousel-dot').forEach((d, i) => d.classList.toggle('active', i === clamped));
      ctick = false;
    });
  }, { passive: true });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const carousel = document.querySelector('.carousel-track:hover');
    if (carousel) {
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      scrollCarousel(carousel.id, dir);
    }
  }
});

initCarousel('systemsCarousel', 'systemsDots', 'systemsCounter');
initCarousel('expCarousel', 'expDots', 'expCounter');

(function() {
  const track = document.getElementById('expCarousel');
  const steps = document.querySelectorAll('.journey-step-btn');
  if (!track || !steps.length) return;
  track.addEventListener('scroll', () => {
    const card = track.querySelector('.card');
    if (!card) return;
    const cardW = card.offsetWidth + 22;
    const idx = Math.max(0, Math.min(Math.round(track.scrollLeft / cardW), steps.length - 1));
    steps.forEach((s, i) => s.classList.toggle('active', i === idx));
  }, { passive: true });
})();

function expGoto(idx) {
  const track = document.getElementById('expCarousel');
  const card = track.querySelector('.card');
  if (!track || !card) return;
  track.scrollTo({ left: idx * (card.offsetWidth + 22), behavior: 'smooth' });
}
