// Interactive "feel the virtual environment" demo for the haptic paddle project.
// Drag the paddle. The rendered force (same shape as the measured force-vs-position
// plot: a wall at 45° and a bump at 90°) pushes back on your hand.
(() => {
  const canvas = document.getElementById('haptic-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const readout = document.getElementById('haptic-readout');

  // Desired force (mA of motor current) vs paddle angle, in degrees.
  const force = th => {
    if (th < 45) return 500;                                  // inside the wall: saturated
    if (th < 55) return 500 * (0.5 + 0.5 * Math.cos(Math.PI * (th - 45) / 10)); // wall spring
    if (th < 60) return 0;
    if (th < 90) return -350 * Math.pow((th - 60) / 30, 1.6); // climbing the bump
    return 350 * Math.exp(-(th - 90) / 9);                    // falling off the far side
  };

  const MIN = 20, MAX = 160;
  let th = 120, w = 0, target = null, last = performance.now();

  let W, H;
  const fit = () => {
    const r = canvas.getBoundingClientRect(), dpr = devicePixelRatio || 1;
    W = r.width;
    stacked = W < 560;                                          // phones: dial above plot
    H = stacked ? W * 1.15 : Math.max(300, W * 0.5);
    canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  let stacked = false;

  // layout: paddle dial on the left (or top), force curve on the right (or bottom)
  const dial = () => stacked
    ? { cx: W * 0.5, cy: H * 0.45, R: W * 0.3 }
    : { cx: W * 0.24, cy: H * 0.62, R: Math.min(W * 0.17, H * 0.46) };
  const plot = () => stacked
    ? { x0: 46, x1: W - 14, y0: H * 0.53, y1: H - 30 }
    : { x0: W * 0.48, x1: W - 16, y0: 20, y1: H - 34 };
  const toRad = d => (180 - d) * Math.PI / 180;               // 0° = right, 180° = left

  const angleFromPointer = (x, y) => {
    const { cx, cy } = dial(), p = plot();
    const onPlot = stacked ? y >= p.y0 - 10 : x >= p.x0 - 10;
    if (onPlot) return MIN + (x - p.x0) / (p.x1 - p.x0) * (MAX - MIN); // drag along the plot too
    let a = 180 - Math.atan2(cy - y, x - cx) * 180 / Math.PI;
    if (a > 270) a -= 360;
    return a;
  };

  const step = now => {
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    // hand = spring to pointer; motor = rendered force; plus damping
    const hand = target == null ? 0 : (target - th) * 40;
    const acc = hand + force(th) * 1.2 - w * 9;
    w += acc * dt; th += w * dt;
    if (th < MIN) { th = MIN; w = 0; } if (th > MAX) { th = MAX; w = 0; }
    draw();
    requestAnimationFrame(step);
  };

  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    const { cx, cy, R } = dial(), p = plot(), f = force(th);
    ctx.font = '11px "IBM Plex Mono", monospace';

    // dial arc with zones
    const arc = (a0, a1, color, width) => {
      ctx.strokeStyle = color; ctx.lineWidth = width;
      ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.arc(cx, cy, R, -toRad(a0), -toRad(a1), false); ctx.stroke();
    };
    arc(MIN, MAX, '#ecebe4', 14);
    arc(MIN, 45, 'rgba(224,52,43,.55)', 14);
    arc(45, 55, 'rgba(224,52,43,.25)', 14);
    arc(60, 90, 'rgba(36,87,214,.22)', 14);
    arc(90, 115, 'rgba(36,87,214,.4)', 14);
    ctx.fillStyle = '#6c707a';
    [[32, 'WALL'], [101, 'BUMP']].forEach(([a, t]) => {
      const r = R + 22; ctx.fillText(t, cx + r * Math.cos(toRad(a)) - 14, cy - r * Math.sin(toRad(a)) + 4);
    });

    // paddle
    const ang = toRad(th), tipX = cx + R * 0.86 * Math.cos(ang), tipY = cy - R * 0.86 * Math.sin(ang);
    ctx.strokeStyle = '#e0342b'; ctx.lineWidth = 16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tipX, tipY); ctx.stroke();
    ctx.fillStyle = '#15171c'; ctx.beginPath(); ctx.arc(cx, cy, 11, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(tipX, tipY, 5, 0, 7); ctx.fill();

    // force arrow at the tip (tangential)
    const mag = f / 500 * 46;
    if (Math.abs(mag) > 1) {
      // screen-space tangent pointing toward increasing θ is (sin φ, cos φ)
      const ex = tipX + Math.sin(ang) * mag, ey = tipY + Math.cos(ang) * mag;
      ctx.strokeStyle = f > 0 ? '#b8231b' : '#2457d6'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(ex, ey); ctx.stroke();
      const hx = ex - tipX, hy = ey - tipY, L = Math.hypot(hx, hy) || 1, ux = hx / L, uy = hy / L;
      ctx.beginPath(); ctx.moveTo(ex, ey);
      ctx.lineTo(ex - ux * 9 - uy * 6, ey - uy * 9 + ux * 6); ctx.lineTo(ex - ux * 9 + uy * 6, ey - uy * 9 - ux * 6);
      ctx.closePath(); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
    }

    // force curve
    const X = a => p.x0 + (a - MIN) / (MAX - MIN) * (p.x1 - p.x0);
    const Y = v => p.y0 + (1 - (v + 550) / 1100) * (p.y1 - p.y0);
    ctx.strokeStyle = '#ecebe4'; ctx.lineWidth = 1;
    [-500, 0, 500].forEach(v => { ctx.beginPath(); ctx.moveTo(p.x0, Y(v)); ctx.lineTo(p.x1, Y(v)); ctx.stroke(); ctx.fillStyle = '#8a8d95'; ctx.fillText(v, p.x0 - 34, Y(v) + 4); });
    [45, 90].forEach(a => { ctx.setLineDash([4, 4]); ctx.strokeStyle = '#f0a35e'; ctx.beginPath(); ctx.moveTo(X(a), p.y0); ctx.lineTo(X(a), p.y1); ctx.stroke(); ctx.setLineDash([]); });
    for (let a = 30; a <= 150; a += 30) { ctx.fillStyle = '#8a8d95'; ctx.fillText(a + '°', X(a) - 10, H - 12); }
    ctx.strokeStyle = '#7c5cd6'; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let a = MIN; a <= MAX; a += 0.5) (a === MIN ? ctx.moveTo : ctx.lineTo).call(ctx, X(a), Y(force(a)));
    ctx.stroke();
    ctx.fillStyle = '#e0342b'; ctx.beginPath(); ctx.arc(X(th), Y(f), 7, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();

    readout.innerHTML = `θ = <b>${th.toFixed(1)}°</b> &nbsp; · &nbsp; commanded current = <b>${f.toFixed(0)} mA</b>`;
  };

  const pos = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener('pointerdown', e => { try { canvas.setPointerCapture(e.pointerId); } catch {} target = angleFromPointer(...pos(e)); });
  canvas.addEventListener('pointermove', e => { if (target != null) target = angleFromPointer(...pos(e)); });
  const release = () => (target = null);
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  addEventListener('resize', fit);
  fit();
  requestAnimationFrame(step);
})();
