(function(){
  const SHOWCASES = {
    keepquill:    { title:'KeepQuill',                  tag:'AI-Powered Memory Book Generator', color:'#D4A574' },
    favisra:      { title:'Favisra',                    tag:'Self-Hosted KPI Dashboard Platform', color:'#38bdf8' },
    cashflows:    { title:'Cashflows App',              tag:'Baron & Cabot · Investment Calculator', color:'#d4af37' },
    cashflowauto: { title:'Cashflow Automation',        tag:'Excel → structured data', color:'#16a34a' },
    attendance:   { title:'One-Shot Attendance System', tag:'Graduation Thesis · Face Recognition', color:'#f472b6' },
    creativity:   { title:'Creativity Assessment System', tag:'Custom RCNN · 6 dimensions', color:'#22d3ee' },
  };
  const modal = document.getElementById('sc-modal');
  const body  = document.getElementById('sc-body');

  let scFontsLoaded = false;
  function ensureShowcaseFonts(){
    if(scFontsLoaded) return; scFontsLoaded = true;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;0,800;1,500&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Dancing+Script:wght@600;700&family=JetBrains+Mono:wght@400;600&display=swap';
    document.head.appendChild(l);
  }

  window.openShowcase = function(key){
    const cfg = SHOWCASES[key]; if(!cfg) return;
    const tpl = document.getElementById('tpl-'+key); if(!tpl) return;
    ensureShowcaseFonts();
    document.getElementById('sc-dot').style.background = cfg.color;
    document.getElementById('sc-title').textContent = cfg.title;
    document.getElementById('sc-tag').textContent = cfg.tag;
    body.innerHTML = tpl.innerHTML;
    body.scrollTop = 0;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    if(key === 'keepquill')  initFlip(body);
    if(key === 'creativity') initCreativity(body);
  };
  window.closeShowcase = function(){
    modal.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(function(){ body.innerHTML = ''; }, 350); // stop video / reset
  };

  // Deep-link: open a showcase from the URL hash (used by the 3D room's frames via iframe).
  function openFromHash(){
    const k = (location.hash || '').replace('#','');
    if(SHOWCASES[k]){
      if(window.self !== window.top) document.body.classList.add('sc-embed');
      openShowcase(k);
    }
  }
  window.addEventListener('hashchange', openFromHash);
  openFromHash();
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && modal.classList.contains('open')) closeShowcase(); });

  (function(){
    const v = document.querySelector('.att-card-vid');
    if(!v) return;
    const host = v.closest('.preview') || v.parentElement;
    host.addEventListener('pointerenter', function(){ v.preload = 'auto'; const p = v.play(); if(p && p.catch) p.catch(function(){}); });
    host.addEventListener('pointerleave', function(){ v.pause(); });
  })();

  document.addEventListener('keydown', function(e){
    if((e.key === 'Enter' || e.key === ' ') && document.activeElement && document.activeElement.classList.contains('preview')){
      e.preventDefault(); document.activeElement.click();
    }
  });

  window.kqTab = function(btn, name){
    const root = btn.closest('#sc-body') || document;
    root.querySelectorAll('[data-kqtab]').forEach(function(b){ b.classList.toggle('active', b===btn); });
    root.querySelectorAll('[data-kqpane]').forEach(function(p){ p.classList.toggle('active', p.getAttribute('data-kqpane')===name); });
  };
  function initFlip(root){
    const bookEl = root.querySelector('.kq-book'); if(!bookEl) return;
    const leaves = Array.prototype.slice.call(bookEl.querySelectorAll('.kq-leaf'));
    const total = leaves.length;
    let cur = 0;
    const counter = root.querySelector('.kq-counter');
    const prev = root.querySelector('.kq-prev');
    const next = root.querySelector('.kq-next');
    function render(){
      leaves.forEach(function(lf,i){
        const flipped = i < cur;
        lf.classList.toggle('flipped', flipped);
        lf.style.zIndex = flipped ? i : (total - i);
      });
      counter.textContent = (cur === 0) ? 'Cover' : (cur + ' / ' + (total - 1));
      prev.disabled = (cur === 0);
      next.disabled = (cur >= total - 1);
    }
    next.addEventListener('click', function(){ if(cur < total-1){ cur++; render(); } });
    prev.addEventListener('click', function(){ if(cur > 0){ cur--; render(); } });
    bookEl.addEventListener('click', function(e){
      if(e.target.closest('.kq-controls')) return;
      if(cur < total-1){ cur++; render(); }
    });
    render();
  }

  const CRE = [
    { img:'assets/ar/sample1.webp', overall:78, dims:[['Fluency',82],['Flexibility',74],['Elaboration',80],['Readability',71],['Uniqueness',88],['Mindfulness',73]] },
    { img:'assets/ar/sample2.webp', overall:85, dims:[['Fluency',88],['Flexibility',83],['Elaboration',86],['Readability',79],['Uniqueness',90],['Mindfulness',84]] },
    { img:'assets/ar/sample3.webp', overall:69, dims:[['Fluency',72],['Flexibility',65],['Elaboration',68],['Readability',74],['Uniqueness',63],['Mindfulness',71]] },
    { img:'assets/ar/sample4.webp', overall:91, dims:[['Fluency',93],['Flexibility',89],['Elaboration',94],['Readability',86],['Uniqueness',95],['Mindfulness',88]] },
  ];
  const CRE_BOXES = [
    [[12,14,32,30],[55,20,30,34],[30,55,40,30]],
    [[18,16,40,36],[58,52,28,30]],
    [[20,22,46,40]],
    [[10,12,34,32],[52,16,34,30],[20,54,30,32],[58,56,28,28]],
  ];
  function ringColor(v){ return v>=85 ? '#4ade9e' : v>=70 ? '#7c74ff' : '#fb923c'; }
  function initCreativity(root){
    const stage  = root.querySelector('#creStage');
    const thumbs = root.querySelector('#creThumbs');
    const scores = root.querySelector('#creScores');
    let active = 0;
    thumbs.innerHTML = CRE.map(function(c,i){
      return '<img src="'+c.img+'" alt="Artwork sample '+(i+1)+'" data-i="'+i+'"'+(i===0?' class="on"':'')+'>';
    }).join('');
    function paint(i){
      active = i;
      const c = CRE[i];
      const boxes = CRE_BOXES[i].map(function(b){
        return '<div class="cre-bbox" style="left:'+b[0]+'%;top:'+b[1]+'%;width:'+b[2]+'%;height:'+b[3]+'%"><span>patch</span></div>';
      }).join('');
      stage.innerHTML = '<img src="'+c.img+'" alt="Selected artwork">' + boxes;
      scores.innerHTML =
        '<div class="cre-overall"><div class="cre-ring" style="color:'+ringColor(c.overall)+';border:4px solid '+ringColor(c.overall)+'">'+c.overall+'</div>'+
        '<div><div style="font-weight:700;font-size:1.05rem">Creativity Score</div><div style="color:var(--text2);font-size:.84rem">weighted across 6 dimensions</div></div></div>' +
        c.dims.map(function(d){
          return '<div class="cre-dim"><b>'+d[0]+'<span>'+d[1]+'</span></b><div class="cre-track"><i style="width:'+d[1]+'%"></i></div></div>';
        }).join('');
      thumbs.querySelectorAll('img').forEach(function(im){ im.classList.toggle('on', +im.getAttribute('data-i')===i); });
    }
    thumbs.addEventListener('click', function(e){ const im = e.target.closest('img'); if(im) paint(+im.getAttribute('data-i')); });
    paint(0);
  }
})();
