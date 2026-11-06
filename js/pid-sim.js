// Interactive cascaded-PID demo for the motor control project.
// Simplified model: outer position PID at 200 Hz (same form as the firmware:
// u = Kp*e - Kd*(θk - θk-1) + Ki*Σe, clamped to ±100) driving a DC motor with a
// first-order current loop, viscous damping and Coulomb friction.
(() => {
  const canvas = document.getElementById('pid-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const sliders = { kp: $('kp'), kd: $('kd'), ki: $('ki') };
  const scoreEl = $('pid-score');
  let traj = 'cubic';

  const N = 600, RATE = 200;                 // 3 s at 200 Hz, same as the report
  const A = 20, C = 4, F = 300, TAU = 0.02;  // model constants (fit to measured trends)

  const reference = kind => Array.from({ length: N }, (_, k) => {
    const t = k / RATE;
    if (kind === 'step') return t >= 1 && t < 3 ? 90 : 0;
    const pts = [[0, 0], [1, 90], [2, 90], [3, 0]];
    for (let j = 0; j < 3; j++) {
      const [t0, a0] = pts[j], [t1, a1] = pts[j + 1];
      if (t >= t0 && t <= t1) { const s = (t - t0) / (t1 - t0); return a0 + (a1 - a0) * (3 * s * s - 2 * s ** 3); }
    }
    return 0;
  });

  const simulate = (kp, kd, ki, ref) => {
    let th = 0, w = 0, I = 0, prev = 0, cur = 0, err = 0;
    const out = [];
    for (let k = 0; k < N; k++) {
      const e = ref[k] - th;
      I += e;
      const d = k === 0 ? 0 : th - prev;
      prev = th;
      const u = Math.max(-100, Math.min(100, kp * e - kd * d + ki * I));
      for (let s = 0; s < 10; s++) {          // 10 physics sub-steps per control tick
        const dt = 1 / RATE / 10;
        cur += (u - cur) * dt / TAU;
        let acc = A * cur - C * w;
        if (Math.abs(w) < 1e-3 && Math.abs(A * cur) < F) { w = 0; acc = 0; }
        else acc -= F * Math.sign(w || cur);
        w += acc * dt; th += w * dt;
      }
      out.push(th); err += Math.abs(ref[k] - th);
    }
    return { out, score: err / N };
  };

  const fit = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = devicePixelRatio || 1;
    canvas.width = r.width * dpr; canvas.height = r.width * 0.5 * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: r.width, h: r.width * 0.5 };
  };

  let size;
  const draw = () => {
    const kp = +sliders.kp.value, kd = +sliders.kd.value, ki = +sliders.ki.value;
    ['kp', 'kd', 'ki'].forEach(k => ($(k + '-out').textContent = (+sliders[k].value).toFixed(k === 'ki' ? 3 : 1)));
    const ref = reference(traj);
    const { out, score } = simulate(kp, kd, ki, ref);
    scoreEl.innerHTML = `Score <b>${score.toFixed(2)}°</b>`;

    const { w, h } = size;
    const pad = { l: 42, r: 12, t: 14, b: 28 };
    const lo = Math.min(-20, ...out), hi = Math.max(140, ...out);
    const X = i => pad.l + (i / (N - 1)) * (w - pad.l - pad.r);
    const Y = v => pad.t + (1 - (v - lo) / (hi - lo)) * (h - pad.t - pad.b);
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#8a8d95'; ctx.strokeStyle = '#ecebe4'; ctx.lineWidth = 1;
    for (let v = Math.ceil(lo / 30) * 30; v <= hi; v += 30) {
      ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(w - pad.r, Y(v)); ctx.stroke();
      ctx.fillText(v + '°', 4, Y(v) + 4);
    }
    for (let s = 0; s <= 3; s++) ctx.fillText(s + ' s', X(s * RATE) - (s === 3 ? 24 : 6), h - 8);

    const line = (data, color, width) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round';
      ctx.beginPath(); data.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)))); ctx.stroke();
    };
    // error shading
    ctx.fillStyle = 'rgba(224,52,43,.08)';
    ctx.beginPath();
    ref.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
    for (let i = N - 1; i >= 0; i--) ctx.lineTo(X(i), Y(out[i]));
    ctx.fill();
    line(ref, '#e0342b', 3);
    line(out, '#2457d6', 2.2);
  };

  const redraw = () => { size = fit(); draw(); };
  Object.values(sliders).forEach(s => s.addEventListener('input', draw));
  document.querySelectorAll('[data-traj]').forEach(b => b.addEventListener('click', () => {
    traj = b.dataset.traj;
    document.querySelectorAll('[data-traj]').forEach(x => x.classList.toggle('active', x === b));
    draw();
  }));
  document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
    const [kp, kd, ki, t] = b.dataset.preset.split(',');
    sliders.kp.value = kp; sliders.kd.value = kd; sliders.ki.value = ki;
    document.querySelector(`[data-traj="${t}"]`).click();
  }));
  addEventListener('resize', redraw);
  redraw();
})();
