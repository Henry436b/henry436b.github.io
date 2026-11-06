// Shared interactions for every page.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ---- light / dark theme (choice is remembered)
  const root = document.documentElement;
  if (!root.dataset.theme) root.dataset.theme = localStorage.getItem('theme') || 'dark';
  $$('.theme-btn').forEach(b => b.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', root.dataset.theme);
  }));

  // ---- hero oscilloscope: red reference trace + a lagging "measured" trace, scrolling
  const scope = $('.scope');
  if (scope) {
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches; // draw one static frame
    const g = scope.getContext('2d');
    let W = 0, H = 0, t = 0, running = true;
    const size = () => {
      const r = scope.getBoundingClientRect(), d = devicePixelRatio || 1;
      W = r.width; H = r.height; scope.width = W * d; scope.height = H * d; g.setTransform(d, 0, 0, d, 0, 0);
    };
    // reference: smooth steps between levels (like a trajectory), measured: 2nd-order response
    const ref = x => {
      const p = ((x % 520) + 520) % 520, s = v => v * v * (3 - 2 * v);
      if (p < 120) return 0; if (p < 200) return s((p - 120) / 80);
      if (p < 330) return 1; if (p < 400) return 1 - 1.6 * s((p - 330) / 70);
      if (p < 470) return -0.6; return -0.6 + 0.6 * s((p - 470) / 50);
    };
    const draw = () => {
      if (!running) return;
      t += 0.9;
      g.clearRect(0, 0, W, H);
      const css = getComputedStyle(root);
      const accent = css.getPropertyValue('--accent').trim(), ink = css.getPropertyValue('--ink-2').trim();
      const mid = H * 0.58, amp = H * 0.16;
      // measured trace: simulate an underdamped follower along x
      let y = ref(-t), v = 0;
      for (let k = 0; k < 400; k++) { const e = ref(-t + k - 400) - y; v += e * 0.02 - v * 0.12; y += v; } // settle
      g.lineWidth = 1.5; g.strokeStyle = ink; g.globalAlpha = 0.35; g.beginPath();
      for (let x = 0; x <= W; x += 2) {
        const e = ref(x - t) - y; v += (e * 0.02 - v * 0.12) * 2; y += v * 2;
        const py = mid - y * amp; x ? g.lineTo(x, py) : g.moveTo(x, py);
      }
      g.stroke();
      g.globalAlpha = 0.55; g.strokeStyle = accent; g.lineWidth = 2; g.beginPath();
      for (let x = 0; x <= W; x += 2) { const py = mid - ref(x - t) * amp; x ? g.lineTo(x, py) : g.moveTo(x, py); }
      g.stroke(); g.globalAlpha = 1;
      if (!still) requestAnimationFrame(draw);
    };
    size(); addEventListener('resize', () => { size(); if (still) draw(); });
    if (!still) new IntersectionObserver(([e]) => { const was = running; running = e.isIntersecting; if (running && !was) draw(); }).observe(scope);
    draw();
  }

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
  top && top.addEventListener('click', () => scrollTo({ top: 0 }));

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
