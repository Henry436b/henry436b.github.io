// Shared interactions for every page.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ---- light / dark theme (choice is remembered)
  const root = document.documentElement;
  if (!root.dataset.theme) root.dataset.theme = localStorage.getItem('theme-v2') || 'light';
  $$('.theme-btn').forEach(b => b.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme-v2', root.dataset.theme);
  }));

  // ---- hero flight path: a dashed trajectory with a small rocket that flies it (aerospace)
  const flight = $('.flight');
  if (flight) {
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const g = flight.getContext('2d');
    let W = 0, H = 0, start = performance.now(), visible = true;
    const size = () => {
      const r = flight.getBoundingClientRect(), d = devicePixelRatio || 1;
      W = r.width; H = r.height; flight.width = W * d; flight.height = H * d; g.setTransform(d, 0, 0, d, 0, 0);
    };
    // parabola from launch pad (left) through apogee to landing (right)
    const pt = u => {
      const x0 = W * 0.03, x1 = W * 0.97, base = H * 0.94, top = H * 0.2;
      return [x0 + (x1 - x0) * u, base - (base - top) * 4 * u * (1 - u)];
    };
    const draw = now => {
      const css = getComputedStyle(root);
      const ink = css.getPropertyValue('--muted').trim(), accent = css.getPropertyValue('--accent').trim();
      const u = still ? 0.5 : ((now - start) / 16000) % 1.25;      // 16 s flight, short pause, repeat
      g.clearRect(0, 0, W, H);
      // trajectory
      g.setLineDash([2, 9]); g.lineCap = 'round'; g.lineWidth = 1.6; g.strokeStyle = ink; g.globalAlpha = 0.45;
      g.beginPath(); for (let i = 0; i <= 80; i++) { const [x, y] = pt(i / 80); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      g.setLineDash([]);
      // apogee marker
      const [ax, ay] = pt(0.5);
      g.globalAlpha = 0.55; g.lineWidth = 1; g.beginPath(); g.moveTo(ax - 7, ay); g.lineTo(ax + 7, ay); g.moveTo(ax, ay - 7); g.lineTo(ax, ay + 7); g.stroke();
      g.font = '500 10px "IBM Plex Mono", monospace'; g.fillStyle = ink; g.fillText('APOGEE', ax + 12, ay - 8);
      // flown part of the path, in red
      const f = Math.min(1, u);
      g.globalAlpha = 0.5; g.strokeStyle = accent; g.lineWidth = 1.5;
      g.beginPath(); for (let i = 0; i <= 80; i++) { const [x, y] = pt(f * i / 80); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      // rocket, pointed along the path
      if (u <= 1) {
        const [x, y] = pt(f), [x2, y2] = pt(Math.min(1, f + 0.01)), a = Math.atan2(y2 - y, x2 - x);
        g.save(); g.translate(x, y); g.rotate(a); g.globalAlpha = 1; g.fillStyle = accent;
        g.beginPath(); g.moveTo(11, 0); g.quadraticCurveTo(4, -4, -7, -3.5); g.lineTo(-11, -8); g.lineTo(-9, 0); g.lineTo(-11, 8); g.lineTo(-7, 3.5); g.quadraticCurveTo(4, 4, 11, 0); g.fill();
        g.restore();
      }
      g.globalAlpha = 1;
      if (!still && visible) requestAnimationFrame(draw);
    };
    size();
    addEventListener('resize', () => { size(); if (still) draw(0); });
    if (!still) new IntersectionObserver(([e]) => { const was = visible; visible = e.isIntersecting; if (visible && !was) requestAnimationFrame(draw); }).observe(flight);
    requestAnimationFrame(draw);
  }

  // ---- gear pairs beside section headings turn as you scroll (mechatronics)
  const gearPath = (teeth, r) => {
    const ri = r * 0.78, n = teeth * 4; let d = '';
    for (let i = 0; i < n; i++) {
      const rad = (i % 4 < 2) ? r : ri, a = (i / n) * Math.PI * 2;
      d += (i ? 'L' : 'M') + (rad * Math.cos(a)).toFixed(2) + ' ' + (rad * Math.sin(a)).toFixed(2);
    }
    return d + 'Z';
  };
  const gearSvg = (teeth, r) => `<svg width="${r * 2 + 4}" height="${r * 2 + 4}" viewBox="${-r - 2} ${-r - 2} ${r * 2 + 4} ${r * 2 + 4}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><g data-gear="${teeth}"><path d="${gearPath(teeth, r)}"/><circle r="${r * 0.3}"/></g></svg>`;
  $$('.gears').forEach(el => (el.innerHTML = gearSvg(12, 15) + gearSvg(8, 10)));
  const gearEls = $$('[data-gear]');
  const turnGears = () => gearEls.forEach(gEl => {
    const big = gEl.dataset.gear === '12';
    gEl.setAttribute('transform', `rotate(${big ? scrollY * 0.12 : -scrollY * 0.18 + 22.5})`);  // 12:8 tooth ratio
  });
  if (gearEls.length) { addEventListener('scroll', turnGears, { passive: true }); turnGears(); }

  // ---- year in footer
  $$('[data-year]').forEach(el => (el.textContent = new Date().getFullYear()));

  // ---- header shadow, scroll progress, back-to-top
  const header = $('.site-header');
  const bar = $('.progress');
  const top = $('.to-top');
  const onScroll = () => {
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    header && header.classList.toggle('scrolled', y > 8);
    bar && (bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`);
    top && top.classList.toggle('show', y > 600);
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  top && top.addEventListener('click', () => {
    scrollTo({ top: 0 });
    top.classList.add('launch');                       // the rocket takes off
    setTimeout(() => top.classList.remove('launch', 'show'), 800);
  });

  // ---- mobile menu
  const menuBtn = $('.menu-btn');
  menuBtn && menuBtn.addEventListener('click', () => {
    const open = document.body.classList.toggle('menu-open');
    menuBtn.setAttribute('aria-expanded', open);
  });
  $$('.nav a').forEach(a => a.addEventListener('click', () => document.body.classList.remove('menu-open')));

  // ---- reveal on scroll
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach(el => io.observe(el));

  // ---- typed role line in hero
  const typed = $('.typed');
  if (typed) {
    const words = JSON.parse(typed.dataset.words);
    let w = 0, i = 0, del = false;
    const tick = () => {
      const word = words[w];
      typed.textContent = word.slice(0, i);
      if (!del && i === word.length) { del = true; return setTimeout(tick, 1600); }
      if (del && i === 0) { del = false; w = (w + 1) % words.length; }
      i += del ? -1 : 1;
      setTimeout(tick, del ? 35 : 70);
    };
    tick();
  }

  // ---- project filters
  const filters = $$('.filter');
  const cards = $$('.grid .card[data-cat]');
  filters.forEach(btn => {
    const f = btn.dataset.filter;
    const n = f === 'all' ? cards.length : cards.filter(c => c.dataset.cat.split(' ').includes(f)).length;
    btn.insertAdjacentHTML('beforeend', `<span class="count">${n}</span>`);
    btn.addEventListener('click', () => {
      filters.forEach(b => b.classList.toggle('active', b === btn));
      cards.forEach(c => {
        const show = f === 'all' || c.dataset.cat.split(' ').includes(f);
        c.classList.toggle('hide', !show);
        c.classList.remove('pop');
        if (show) { void c.offsetWidth; c.classList.add('pop'); }
      });
    });
  });

  // ---- cards with a preview video play on hover
  $$('.card').forEach(card => {
    const v = $('video', card);
    if (!v) return;
    card.addEventListener('mouseenter', () => { v.play().then(() => card.classList.add('playing')).catch(() => {}); });
    card.addEventListener('mouseleave', () => { card.classList.remove('playing'); v.pause(); });
  });

  // ---- lightbox for any img.zoomable
  const zoomables = $$('img.zoomable');
  if (zoomables.length) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="lightbox" role="dialog" aria-modal="true" aria-label="Image viewer">
        <img alt=""><div class="cap"></div>
        <button class="close" aria-label="Close">✕</button>
        <button class="prev" aria-label="Previous">‹</button>
        <button class="nxt" aria-label="Next">›</button>
      </div>`);
    const lb = $('.lightbox'), lbImg = $('img', lb), cap = $('.cap', lb);
    let idx = 0;
    const show = i => {
      idx = (i + zoomables.length) % zoomables.length;
      const src = zoomables[idx];
      lbImg.src = src.currentSrc || src.src;
      lbImg.alt = src.alt;
      const fc = src.closest('figure')?.querySelector('figcaption');
      cap.textContent = fc ? fc.textContent : src.alt;
      lb.classList.add('open');
    };
    const close = () => lb.classList.remove('open');
    zoomables.forEach((img, i) => img.addEventListener('click', () => show(i)));
    $('.close', lb).addEventListener('click', close);
    $('.prev', lb).addEventListener('click', e => { e.stopPropagation(); show(idx - 1); });
    $('.nxt', lb).addEventListener('click', e => { e.stopPropagation(); show(idx + 1); });
    lb.addEventListener('click', e => { if (e.target === lb) close(); });
    addEventListener('keydown', e => {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
  }

  // ---- table of contents highlighting
  const tocLinks = $$('.toc a');
  if (tocLinks.length) {
    const map = new Map(tocLinks.map(a => [a.getAttribute('href').slice(1), a]));
    const tio = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          tocLinks.forEach(a => a.classList.remove('active'));
          map.get(e.target.id)?.classList.add('active');
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    map.forEach((_, id) => { const s = document.getElementById(id); s && tio.observe(s); });
  }

  // ---- before/after compare slider
  $$('.compare').forEach(cmp => {
    const after = $('.after', cmp), handle = $('.handle', cmp);
    const set = x => {
      const r = cmp.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (x - r.left) / r.width)) * 100;
      after.style.clipPath = `inset(0 0 0 ${p}%)`;
      handle.style.left = p + '%';
    };
    let drag = false;
    cmp.addEventListener('pointerdown', e => { drag = true; cmp.setPointerCapture(e.pointerId); set(e.clientX); });
    cmp.addEventListener('pointermove', e => drag && set(e.clientX));
    cmp.addEventListener('pointerup', () => (drag = false));
  });

  // ---- code viewer: tabs + tiny syntax highlighter (C and Python)
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const KW = /\b(if|else|elif|while|for|return|break|case|switch|default|def|import|from|in|not|and|or|True|False|None|struct|typedef|enum|void|int|float|bool|char|uint|volatile|static|const|true|false)\b/g;
  const highlight = (src, lang) => {
    const tokens = [];
    const stash = (cls, s) => { tokens.push(`<span class="${cls}">${esc(s)}</span>`); return `\u0000T${tokens.length - 1}T\u0000`; };
    // one pass so quotes inside comments (and # inside strings) are handled correctly
    const re = lang === 'py'
      ? /(#.*$)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')/gm
      : /(\/\/.*$|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(#include.*$)/gm;
    let s = src.replace(re, (m, com, str, inc) => stash(com ? 'c' : inc ? 'k' : 's', m));
    s = esc(s)
      .replace(KW, '<span class="k">$1</span>')
      .replace(/\b(\d+\.?\d*)\b/g, '<span class="n">$1</span>')
      .replace(/\b([a-zA-Z_]\w*)(?=\()/g, '<span class="f">$1</span>');
    return s.replace(/\u0000T(\d+)T\u0000/g, (_, i) => tokens[i]);
  };
  $$('[data-code-viewer]').forEach(box => {
    const tabs = $$('.code-tab', box), pre = $('pre', box), dl = $('[data-download]', box);
    const load = async tab => {
      tabs.forEach(t => t.classList.toggle('active', t === tab));
      const src = tab.dataset.src;
      try {
        const txt = await (await fetch(src)).text();
        const from = +(tab.dataset.from || 1), to = +(tab.dataset.to || 1e9);
        const lines = txt.split(/\r?\n/).slice(from - 1, to).join('\n');
        pre.innerHTML = highlight(lines, src.endsWith('.py') ? 'py' : 'c');
      } catch {
        pre.textContent = 'Open this page through a web server (or the live site) to load the code preview.';
      }
      if (dl) { dl.href = src; dl.setAttribute('download', ''); }
    };
    tabs.forEach(t => t.addEventListener('click', () => load(t)));
    tabs[0] && load(tabs[0]);
  });
})();
