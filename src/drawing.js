function niceStep(range) {
  const p = Math.pow(10, Math.floor(Math.log10(range)));
  const f = range / p;
  return f < 1.5 ? p : f < 3.5 ? 2 * p : f < 7.5 ? 5 * p : 10 * p;
}

function createTransform(W, H, pad, xMin, xMax, yMin, yMax) {
  const pw = W - pad.l - pad.r;
  const ph = H - pad.t - pad.b;
  return {
    pw, ph,
    toX:   v  => pad.l + (v  - xMin) / (xMax - xMin) * pw,
    toY:   v  => pad.t + (1  - (v - yMin) / (yMax - yMin)) * ph,
    fromX: px => xMin  + (px - pad.l) / pw * (xMax - xMin),
    fromY: py => yMax  - (py - pad.t) / ph * (yMax - yMin),
  };
}

function strokeSmooth(ctx, pts) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  if (pts.length === 2) { ctx.lineTo(pts[1].x, pts[1].y); ctx.stroke(); return; }
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    ctx.bezierCurveTo(
      p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
      p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6,
      p2.x, p2.y);
  }
  ctx.stroke();
}

function clipSegments(branch, toX, toY, lim = 90) {
  const segs = []; let cur = [];
  for (const p of branch) {
    if (!isFinite(p.re) || !isFinite(p.im) || Math.abs(p.re) > lim || Math.abs(p.im) > lim) {
      if (cur.length) { segs.push(cur); cur = []; }
      continue;
    }
    cur.push({ x: toX(p.re), y: toY(p.im) });
  }
  if (cur.length) segs.push(cur);
  return segs;
}

function drawGrid(ctx, W, H, pad, xMin, xMax, yMin, yMax, toX, toY) {
  const sx = niceStep((xMax - xMin) / 8);
  const sy = niceStep((yMax - yMin) / 8);

  
  ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
  for (let x = Math.ceil(xMin / sx) * sx; x <= xMax + 1e-9; x += sx) {
    ctx.beginPath(); ctx.moveTo(toX(x), pad.t); ctx.lineTo(toX(x), H - pad.b); ctx.stroke();
  }
  for (let y = Math.ceil(yMin / sy) * sy; y <= yMax + 1e-9; y += sy) {
    ctx.beginPath(); ctx.moveTo(pad.l, toY(y)); ctx.lineTo(W - pad.r, toY(y)); ctx.stroke();
  }

  
  ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1.5;
  if (xMin < 0 && xMax > 0) {
    ctx.beginPath(); ctx.moveTo(toX(0), pad.t); ctx.lineTo(toX(0), H - pad.b); ctx.stroke();
  }
  if (yMin < 0 && yMax > 0) {
    ctx.beginPath(); ctx.moveTo(pad.l, toY(0)); ctx.lineTo(W - pad.r, toY(0)); ctx.stroke();
  }

  
  ctx.fillStyle = COLORS.label; ctx.font = '10px monospace'; ctx.textAlign = 'center';
  for (let x = Math.ceil(xMin / sx) * sx; x <= xMax + 1e-9; x += sx) {
    if (Math.abs(x) < sx * 0.01) continue;
    const yt = Math.max(pad.t + 10, Math.min(H - pad.b + 14, toY(0) + 14));
    ctx.fillText(x % 1 === 0 ? x.toFixed(0) : x.toFixed(1), toX(x), yt);
  }
  
  ctx.textAlign = 'right';
  for (let y = Math.ceil(yMin / sy) * sy; y <= yMax + 1e-9; y += sy) {
    if (Math.abs(y) < sy * 0.01) continue;
    const xt = Math.max(pad.l - 2, Math.min(W - pad.r + 2, toX(0) - 4));
    ctx.fillText(y % 1 === 0 ? y.toFixed(0) : y.toFixed(1), xt, toY(y) + 3);
  }
}

function computeRLBounds(canvas, data) {
  const W = canvas.width || canvas.clientWidth || 400;
  const H = canvas.height || canvas.clientHeight || 300;
  const pad = CANVAS_PAD_RL;

  const { loci, poles, zeros } = data;
  const allPts = loci.flat().filter(p => Math.abs(p.re) < 80 && Math.abs(p.im) < 80);
  const allX   = [...allPts.map(p => p.re), ...poles.map(p => p.re), ...zeros.map(z => z.re)];
  const allY   = [...allPts.map(p => p.im), ...poles.map(p => p.im), ...zeros.map(z => z.im)];
  let xMin = Math.min(...allX) - 1, xMax = Math.max(...allX) + 1;
  let yMin = Math.min(...allY) - 1, yMax = Math.max(...allY) + 1;

  
  const { pw, ph } = createTransform(W, H, pad, 0, 1, 0, 1);
  if ((xMax - xMin) / Math.max(yMax - yMin, 0.001) > pw / ph) {
    const e = (xMax - xMin) / pw * ph - (yMax - yMin); yMin -= e / 2; yMax += e / 2;
  } else {
    const e = (yMax - yMin) / ph * pw - (xMax - xMin); xMin -= e / 2; xMax += e / 2;
  }
  xMin -= (xMax - xMin) * 0.06; xMax += (xMax - xMin) * 0.06;
  yMin -= (yMax - yMin) * 0.06; yMax += (yMax - yMin) * 0.06;
  return { xMin, xMax, yMin, yMax };
}

function drawRL(canvas, data, bounds = null) {
  if (!data) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = COLORS.bg; ctx.fillRect(0, 0, W, H);

  const { loci, poles, zeros, sigmaA, anglesA, breakPoints,
          departures = [], arrivals = [], jwCross = [] } = data;
  const pad = CANVAS_PAD_RL;

  
  const { xMin, xMax, yMin, yMax } = bounds ?? computeRLBounds(canvas, data);

  const t = createTransform(W, H, pad, xMin, xMax, yMin, yMax);
  const { toX, toY } = t;

  drawGrid(ctx, W, H, pad, xMin, xMax, yMin, yMax, toX, toY);


  ctx.fillStyle = '#8b949e'; ctx.font = '11px monospace';
  ctx.textAlign = 'right';  ctx.fillText('Re', W - pad.r + 14, toY(0) + 4);
  ctx.textAlign = 'left';   ctx.fillText('Im', toX(0) + 4, pad.t + 10);


  if (data.zetaLine && isFinite(data.zetaLine.zeta)) {
    const z = Math.max(0, Math.min(0.9999, data.zetaLine.zeta));
    const beta = Math.acos(z);
    const R = 1e4;
    ctx.save();
    ctx.setLineDash([7, 5]);
    ctx.strokeStyle = 'rgba(88,166,255,.85)';
    ctx.lineWidth = 1.4;
    [1, -1].forEach(sgn => {
      const ex = -Math.cos(beta) * R, ey = sgn * Math.sin(beta) * R;
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(0));
      ctx.lineTo(toX(ex), toY(ey));
      ctx.stroke();
    });
    ctx.restore();

    const rLbl = Math.abs(yMax) * 0.6 / Math.max(Math.sin(beta), 1e-3);
    ctx.fillStyle = '#58a6ff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('ζ=' + data.zetaLine.zeta.toFixed(3),
                 toX(-Math.cos(beta) * rLbl) + 4, toY(Math.sin(beta) * rLbl));
  }

  
  if (sigmaA !== null) {
    anglesA.forEach(deg => {
      const rad = deg * Math.PI / 180, len = Math.max(W, H) * 3;
      ctx.save(); ctx.setLineDash([6, 5]);
      ctx.strokeStyle = COLORS.asym; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(toX(sigmaA), toY(0));
      ctx.lineTo(toX(sigmaA) + len * Math.cos(rad), toY(0) - len * Math.sin(rad));
      ctx.stroke(); ctx.restore();
    });
    ctx.fillStyle = '#d29922';
    ctx.beginPath(); ctx.arc(toX(sigmaA), toY(0), 4, 0, Math.PI * 2); ctx.fill();
    ctx.font = '10px monospace'; ctx.textAlign = 'center';
    ctx.fillText('σₐ=' + sigmaA.toFixed(2), toX(sigmaA), toY(0) + 14);
  }

  
  loci.forEach((branch, bi) => {
    const col  = COLORS.branches[bi % COLORS.branches.length];
    const segs = clipSegments(branch, toX, toY);
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    segs.forEach(seg => strokeSmooth(ctx, seg));

    
    const seg = segs.reduce((a, b) => (b.length > a.length ? b : a), segs[0] || []);
    if (seg && seg.length > 3) {
      const ai = Math.floor(seg.length * 0.45);
      const p1 = seg[ai], p2 = seg[Math.min(ai + 2, seg.length - 1)];
      const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      ctx.fillStyle = col; ctx.beginPath();
      ctx.moveTo(p1.x + 7 * Math.cos(ang),       p1.y + 7 * Math.sin(ang));
      ctx.lineTo(p1.x + 7 * Math.cos(ang + 2.4), p1.y + 7 * Math.sin(ang + 2.4));
      ctx.lineTo(p1.x + 7 * Math.cos(ang - 2.4), p1.y + 7 * Math.sin(ang - 2.4));
      ctx.fill();
    }
  });

  
  breakPoints.forEach(b => {
    const bx = toX(b.s), isBreakIn = b.type === 'breakin';
    const col = isBreakIn ? '#ff7b72' : '#3fb950';
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(bx, toY(0), 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.font = '9px monospace'; ctx.textAlign = 'center';
    ctx.fillText((isBreakIn ? 'varış ' : 'kalkış ') + b.s.toFixed(2),
                 bx, toY(0) + (isBreakIn ? -9 : 16));
  });

  
  jwCross.forEach(c => {
    [c.w, -c.w].forEach(w => {
      const px = toX(0), py = toY(w);
      ctx.fillStyle = '#d2a8ff';
      ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = '#d2a8ff'; ctx.font = '9px monospace'; ctx.textAlign = 'left';
    ctx.fillText('jω=' + c.w.toFixed(2), toX(0) + 6, toY(c.w) - 4);
  });

  
  const drawAngle = (at, deg, color) => {
    const ox = toX(at.re), oy = toY(at.im), r = Math.PI / 180 * deg, L = 26;
    ctx.strokeStyle = color; ctx.lineWidth = 1.3; ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.moveTo(ox, oy);
    ctx.lineTo(ox + L * Math.cos(r), oy - L * Math.sin(r)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color; ctx.font = '8px monospace'; ctx.textAlign = 'left';
    ctx.fillText(deg.toFixed(0) + '°', ox + L * Math.cos(r) + 2, oy - L * Math.sin(r));
  };
  departures.forEach(d => drawAngle(d.at, d.angle, 'rgba(248,81,73,.8)'));
  arrivals.forEach(a => drawAngle(a.at, a.angle, 'rgba(63,185,80,.8)'));


  if (data.operatingPoints && data.operatingPoints.length) {
    data.operatingPoints.forEach(op => {
      [op.s, { re: op.s.re, im: -op.s.im }].forEach(pt => {
        const px = toX(pt.re), py = toY(pt.im);
        ctx.fillStyle = '#ff7bdc'; ctx.strokeStyle = '#0d1117'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px, py - 7); ctx.lineTo(px + 7, py);
        ctx.lineTo(px, py + 7); ctx.lineTo(px - 7, py);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      });
      const px = toX(op.s.re), py = toY(op.s.im);
      ctx.fillStyle = '#ff7bdc'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left';
      ctx.fillText('K=' + op.K.toFixed(2), px + 11, py - 5);
      ctx.fillStyle = '#e6edf3'; ctx.font = '9px monospace';
      ctx.fillText('s=' + op.s.re.toFixed(2) + (op.s.im >= 0 ? '+' : '−') + 'j' +
                   Math.abs(op.s.im).toFixed(2), px + 11, py + 7);
    });
  }

  poles.forEach(p => {
    ctx.strokeStyle = COLORS.pole; ctx.lineWidth = 2.5;
    const px = toX(p.re), py = toY(p.im);
    ctx.beginPath();
    ctx.moveTo(px - 6, py - 6); ctx.lineTo(px + 6, py + 6);
    ctx.moveTo(px + 6, py - 6); ctx.lineTo(px - 6, py + 6);
    ctx.stroke();
  });
  zeros.forEach(z => {
    ctx.strokeStyle = COLORS.zero; ctx.lineWidth = 2.5; ctx.fillStyle = COLORS.bg;
    ctx.beginPath(); ctx.arc(toX(z.re), toY(z.im), 6, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  });

  
  const lx = W - pad.r - 130, ly = pad.t + 6;
  ctx.fillStyle = 'rgba(22,27,34,.9)'; ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1;
  ctx.fillRect(lx, ly, 124, 42); ctx.strokeRect(lx, ly, 124, 42);
  ctx.font = '11px monospace';
  ctx.fillStyle = COLORS.pole; ctx.textAlign = 'left';
  ctx.fillText('× Kutup (Pole)', lx + 22, ly + 16);
  ctx.strokeStyle = COLORS.zero; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(lx + 10, ly + 30, 5, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = COLORS.zero; ctx.fillText('○ Sıfır (Zero)', lx + 22, ly + 34);
}

function drawBodePanel(canvas, freqs, vals, asymVals, showAsym, opt) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = COLORS.bg; ctx.fillRect(0, 0, W, H);

  const pad = CANVAS_PAD_BODE;
  const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;

  
  const finite = vals.filter(isFinite);
  if (!finite.length) return;
  let yMin = Math.min(...finite), yMax = Math.max(...finite);
  if (showAsym && asymVals) {
    const af = asymVals.filter(isFinite);
    if (af.length) { yMin = Math.min(yMin, ...af); yMax = Math.max(yMax, ...af); }
  }
  const yr = yMax - yMin || 1; yMin -= yr * 0.1; yMax += yr * 0.1;

  
  const wMin = freqs[0], wMax = freqs[freqs.length - 1];
  const toX = w  => pad.l + (Math.log10(w) - Math.log10(wMin)) /
                            (Math.log10(wMax) - Math.log10(wMin)) * pw;
  const toY = v  => pad.t + (1 - (v - yMin) / (yMax - yMin)) * ph;
  const clY = py => Math.max(pad.t - 2, Math.min(pad.t + ph + 2, py));

  
  ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
  for (let e = Math.floor(Math.log10(wMin)); e <= Math.ceil(Math.log10(wMax)); e++) {
    for (let m = 1; m < 10; m++) {
      const w = m * Math.pow(10, e);
      if (w < wMin || w > wMax) continue;
      ctx.beginPath(); ctx.moveTo(toX(w), pad.t); ctx.lineTo(toX(w), pad.t + ph); ctx.stroke();
    }
  }
  
  const sy = niceStep(yr / 6);
  for (let y = Math.ceil(yMin / sy) * sy; y <= yMax + 1e-9; y += sy) {
    ctx.beginPath(); ctx.moveTo(pad.l, toY(y)); ctx.lineTo(pad.l + pw, toY(y)); ctx.stroke();
  }

  
  if (yMin < opt.ref && opt.ref < yMax) {
    ctx.save(); ctx.setLineDash([5, 4]);
    ctx.strokeStyle = COLORS.ref; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(pad.l, toY(opt.ref)); ctx.lineTo(pad.l + pw, toY(opt.ref));
    ctx.stroke(); ctx.restore();
    ctx.fillStyle = COLORS.label; ctx.font = '9px monospace'; ctx.textAlign = 'right';
    ctx.fillText(opt.refLabel, pad.l - 2, toY(opt.ref) + 3);
  }

  
  ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1;
  ctx.strokeRect(pad.l, pad.t, pw, ph);

  
  ctx.fillStyle = COLORS.label; ctx.font = '10px monospace'; ctx.textAlign = 'center';
  for (let e = Math.floor(Math.log10(wMin)); e <= Math.ceil(Math.log10(wMax)); e++) {
    const w = Math.pow(10, e);
    if (w < wMin || w > wMax) continue;
    ctx.fillText('10^' + e, toX(w), pad.t + ph + 16);
  }
  
  ctx.textAlign = 'right';
  for (let y = Math.ceil(yMin / sy) * sy; y <= yMax + 1e-9; y += sy)
    ctx.fillText(y.toFixed(0), pad.l - 4, toY(y) + 3);

  
  ctx.fillStyle = '#e6edf3'; ctx.font = 'bold 11px Segoe UI'; ctx.textAlign = 'center';
  ctx.fillText(opt.title, W / 2, pad.t - 12);
  ctx.fillStyle = '#8b949e'; ctx.font = '10px monospace';
  ctx.fillText('ω (rad/s)', W / 2, H - 4);
  ctx.save(); ctx.translate(12, pad.t + ph / 2); ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center'; ctx.fillText(opt.yLabel, 0, 0); ctx.restore();

  
  if (opt.markerW && opt.markerW > wMin && opt.markerW < wMax) {
    ctx.save(); ctx.setLineDash([4, 4]);
    ctx.strokeStyle = opt.markerColor || COLORS.zero; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(toX(opt.markerW), pad.t); ctx.lineTo(toX(opt.markerW), pad.t + ph);
    ctx.stroke(); ctx.restore();
    ctx.fillStyle = opt.markerColor || COLORS.zero; ctx.font = '9px monospace'; ctx.textAlign = 'center';
    ctx.fillText(opt.markerLabel || '', toX(opt.markerW), pad.t - 3);
  }

  
  if (showAsym && asymVals) {
    ctx.save(); ctx.setLineDash([8, 4]);
    ctx.strokeStyle = COLORS.asymBode; ctx.lineWidth = 1.5;
    ctx.beginPath(); let started = false;
    for (let i = 0; i < freqs.length; i++) {
      if (!isFinite(asymVals[i]) || asymVals[i] < yMin - 50 || asymVals[i] > yMax + 50) {
        started = false; continue;
      }
      const x = toX(freqs[i]), y = clY(toY(asymVals[i]));
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke(); ctx.restore();
  }

  
  ctx.strokeStyle = opt.color; ctx.lineWidth = 2; ctx.beginPath(); let started = false;
  for (let i = 0; i < freqs.length; i++) {
    if (!isFinite(vals[i]) || vals[i] < yMin - 50 || vals[i] > yMax + 50) {
      started = false; continue;
    }
    const x = toX(freqs[i]), y = clY(toY(vals[i]));
    if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawSemilogBode(canvas, data, mode, showFactors = true) {
  if (!data) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = COLORS.bg; ctx.fillRect(0, 0, W, H);

  const pad = CANVAS_PAD_BODE;
  const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
  const { freqs, factors } = data;
  const lineKey = mode === 'mag' ? 'mag' : 'phase';
  const vals    = mode === 'mag' ? data.sumMag : data.sumPhase;

  
  let allVals = [...vals];
  if (showFactors) factors.forEach(f => allVals.push(...f[lineKey]));
  allVals = allVals.filter(isFinite);
  if (!allVals.length) return;
  const step = mode === 'mag' ? SEMILOG_CONFIG.yStepDb : SEMILOG_CONFIG.yStepDeg;
  let yMin = Math.floor(Math.min(...allVals) / step) * step - step * 0.2;
  let yMax = Math.ceil (Math.max(...allVals) / step) * step + step * 0.2;
  if (yMax - yMin < step) yMax = yMin + step;

  const wMin = freqs[0], wMax = freqs[freqs.length - 1];
  const lw   = Math.log10(wMin), lW = Math.log10(wMax);
  const toX  = w  => pad.l + (Math.log10(w) - lw) / (lW - lw) * pw;
  const toY  = v  => pad.t + (1 - (v - yMin) / (yMax - yMin)) * ph;
  const clY  = py => Math.max(pad.t - 2, Math.min(pad.t + ph + 2, py));

  
  
  ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 0.5;
  for (let e = Math.floor(lw); e < Math.ceil(lW); e++) {
    SEMILOG_CONFIG.decadeMinor.forEach(m => {
      const w = m * Math.pow(10, e);
      if (w < wMin || w > wMax) return;
      ctx.beginPath(); ctx.moveTo(toX(w), pad.t); ctx.lineTo(toX(w), pad.t + ph); ctx.stroke();
    });
  }
  
  ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1;
  for (let e = Math.floor(lw); e <= Math.ceil(lW); e++) {
    const w = Math.pow(10, e);
    if (w < wMin || w > wMax) continue;
    ctx.beginPath(); ctx.moveTo(toX(w), pad.t); ctx.lineTo(toX(w), pad.t + ph); ctx.stroke();
  }
  
  ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 0.7;
  for (let y = Math.ceil(yMin / step) * step; y <= yMax + 1e-9; y += step) {
    ctx.beginPath(); ctx.moveTo(pad.l, toY(y)); ctx.lineTo(pad.l + pw, toY(y)); ctx.stroke();
  }
  
  if (yMin < 0 && yMax > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(pad.l, toY(0)); ctx.lineTo(pad.l + pw, toY(0)); ctx.stroke();
  }
  
  ctx.strokeStyle = COLORS.axis; ctx.lineWidth = 1; ctx.strokeRect(pad.l, pad.t, pw, ph);

  
  ctx.fillStyle = COLORS.label; ctx.font = '10px monospace'; ctx.textAlign = 'center';
  for (let e = Math.floor(lw); e <= Math.ceil(lW); e++) {
    const w = Math.pow(10, e);
    if (w < wMin || w > wMax) continue;
    ctx.fillText('10^' + e, toX(w), pad.t + ph + 16);
  }
  ctx.textAlign = 'right';
  for (let y = Math.ceil(yMin / step) * step; y <= yMax + 1e-9; y += step)
    ctx.fillText(y.toFixed(0), pad.l - 4, toY(y) + 3);

  
  const drawLine = (arr, color, width, dash) => {
    ctx.save(); if (dash) ctx.setLineDash(dash);
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath(); let started = false;
    for (let i = 0; i < freqs.length; i++) {
      const v = arr[i];
      if (!isFinite(v) || v < yMin - 300 || v > yMax + 300) { started = false; continue; }
      const x = toX(freqs[i]), y = clY(toY(v));
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke(); ctx.restore();
  };

  
  if (showFactors) {
    factors.forEach(f => {
      if (f.corner && f.corner >= wMin && f.corner <= wMax) {
        ctx.save(); ctx.setLineDash([2, 3]); ctx.globalAlpha = 0.4;
        ctx.strokeStyle = f.color; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(toX(f.corner), pad.t); ctx.lineTo(toX(f.corner), pad.t + ph); ctx.stroke();
        ctx.restore();
      }
    });
    factors.forEach(f => drawLine(f[lineKey], f.color, 1.4, [5, 3]));
  }

  
  drawLine(vals, BODE_FACTOR_COLORS.sum, 2.6, null);

  
  ctx.fillStyle = '#e6edf3'; ctx.font = 'bold 11px Segoe UI'; ctx.textAlign = 'center';
  ctx.fillText(mode === 'mag'
    ? 'Genlik — çarpan-çarpan asimptotik (kalın çizgi = toplam)'
    : 'Faz — çarpan-çarpan asimptotik (kalın çizgi = toplam)', W / 2, pad.t - 12);
  ctx.fillStyle = '#8b949e'; ctx.font = '10px monospace';
  ctx.fillText('ω (rad/s) — logaritmik', W / 2, H - 4);
  ctx.save(); ctx.translate(12, pad.t + ph / 2); ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText(mode === 'mag' ? 'Genlik (dB)' : 'Faz (°)', 0, 0); ctx.restore();
}
