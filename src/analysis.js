function _classifyFactors(poles, zeros) {
  const eps = EPS.im;
  const isOrigin  = p => C.abs(p) < eps;
  const isReal    = p => !isOrigin(p) && Math.abs(p.im) < eps;
  const isComplex = p => !isOrigin(p) && p.im > -eps; 

  return {
    originPoles:  poles.filter(isOrigin).length,
    originZeros:  zeros.filter(isOrigin).length,
    realPoles:    poles.filter(isReal),
    realZeros:    zeros.filter(isReal),
    complexPoles: poles.filter(isComplex),
    complexZeros: zeros.filter(isComplex),
  };
}

function computeBreakaways(num, den) {
  const { breakawayMin, breakawayMax, breakawayStep, breakawayMinDist } = RL_CONFIG;
  const breakPoints = [];
  try {
    const nd = polyDeriv(num), dd = polyDeriv(den);
    
    const f = x => {
      const s = { re: x, im: 0 };
      return polyEval(dd, s).re * polyEval(num, s).re -
             polyEval(den, s).re * polyEval(nd, s).re;
    };
    let prevX = breakawayMin, prevV = f(breakawayMin);
    for (let x = breakawayMin + breakawayStep; x <= breakawayMax; x += breakawayStep) {
      const v = f(x);
      if (prevV * v < 0) {
        
        let a = prevX, b = x;
        for (let it = 0; it < 45; it++) {
          const m = (a + b) / 2;
          (f(a) * f(m) <= 0) ? (b = m) : (a = m);
        }
        const xMid = (a + b) / 2;
        const s    = { re: xMid, im: 0 };
        const numV = polyEval(num, s).re;
        if (Math.abs(numV) > EPS.nearZero) {
          const Kval = -polyEval(den, s).re / numV;
          if (Kval >= EPS.kMin &&
              !breakPoints.some(p => Math.abs(p.s - xMid) < breakawayMinDist)) {
            
            const kProbe = Kval + Math.max(1e-3, Kval * 1e-3);
            const rr = polyRoots(polyAdd(den, polyScale(num, kProbe)));
            const nearCplx = rr.some(r => Math.abs(r.im) > 1e-3 &&
                                          Math.abs(r.re - xMid) < 0.2);
            breakPoints.push({ s: xMid, K: Kval, type: nearCplx ? 'breakaway' : 'breakin' });
          }
        }
      }
      prevX = x; prevV = v;
    }
  } catch (_) {  }
  return breakPoints;
}

function computeJwCrossing(num, den) {
  const { scanKMax, scanSteps, refineIters, imagEps } = JW_CONFIG;
  const rootsAtK = k => polyRoots(polyAdd(den, polyScale(num, k)));
  const crossings = [];
  let kPrev = 0, prev = rootsAtK(0);
  for (let i = 1; i <= scanSteps; i++) {
    const k   = scanKMax * Math.pow(i / scanSteps, 2);
    const cur = matchRoots(prev, rootsAtK(k));
    for (let b = 0; b < prev.length; b++) {
      if (prev[b].re < -imagEps && cur[b].re >= -imagEps) {
        let lo = kPrev, hi = k;
        for (let it = 0; it < refineIters; it++) {
          const m  = (lo + hi) / 2;
          const rm = matchRoots(prev, rootsAtK(m))[b];
          (rm.re < 0) ? (lo = m) : (hi = m);
        }
        const kc = (lo + hi) / 2;
        const rc = matchRoots(prev, rootsAtK(kc))[b];
        const w  = Math.abs(rc.im);
        if (w > 1e-4 && !crossings.some(c => Math.abs(c.w - w) < 0.05))
          crossings.push({ w, K: kc });
      }
    }
    kPrev = k; prev = cur;
  }
  return crossings;
}

function computeRL(num, den, kMax = 200) {
  const { steps, kPowerLaw, arcMaxJump, arcMaxDepth, arcMinDK,
          zeroReachEps, kMaxAutoGrow, kMaxAutoSteps,
          critKIterations, critKThreshold } = RL_CONFIG;

  const poles = polyRoots(den);
  const zeros = polyRoots(num);
  const nP = poles.length, nZ = zeros.length;
  const eps = EPS.im;

  
  const breakPoints = computeBreakaways(num, den);

  
  const departures = poles
    .filter(p => Math.abs(p.im) > eps && p.im >= 0)
    .map(p => ({ at: p, angle: departureAngle(p, poles, zeros) }));
  const arrivals = zeros
    .filter(z => Math.abs(z.im) > eps && z.im >= 0)
    .map(z => ({ at: z, angle: arrivalAngle(z, poles, zeros) }));

  
  const jwCross = computeJwCrossing(num, den);

  
  const rootsAtK = k => polyRoots(polyAdd(den, polyScale(num, k)));
  const loci = poles.map(p => [p]);
  const emit = matched => { for (let b = 0; b < nP; b++) loci[b].push(matched[b]); };
  const jumpOf = (a, b) => {
    let mx = 0;
    for (let i = 0; i < a.length; i++) mx = Math.max(mx, C.abs(C.sub(a[i], b[i])));
    return mx;
  };

  
  const walk = (kLo, kHi, rootsLo, depth) => {
    const matchedHi = matchRoots(rootsLo, rootsAtK(kHi));
    if (jumpOf(matchedHi, rootsLo) > arcMaxJump &&
        (kHi - kLo) > arcMinDK && depth < arcMaxDepth) {
      const kMid     = (kLo + kHi) / 2;
      const midRoots = walk(kLo, kMid, rootsLo, depth + 1);
      return walk(kMid, kHi, midRoots, depth + 1);
    }
    emit(matchedHi);
    return matchedHi;
  };

  
  const kBase = Array.from({ length: steps }, (_, i) =>
    kMax * Math.pow((i + 1) / steps, kPowerLaw));
  let cur = [...poles];
  let kLast = 0;
  for (const k of kBase) { cur = walk(kLast, k, cur, 0); kLast = k; }

  
  if (nZ > 0) {
    for (let g = 0; g < kMaxAutoSteps; g++) {
      const ends    = loci.map(b => b[b.length - 1]);
      const reached = zeros.filter(z =>
        ends.some(e => C.abs(C.sub(e, z)) < zeroReachEps)).length;
      if (reached >= nZ) break;
      const kNext = kLast * kMaxAutoGrow, sub = 30;
      for (let i = 1; i <= sub; i++) {
        const k = kLast * Math.pow(kMaxAutoGrow, i / sub);
        cur = walk(kLast * Math.pow(kMaxAutoGrow, (i - 1) / sub), k, cur, 0);
      }
      kLast = kNext;
    }
  }

  
  const nA = nP - nZ;
  let sigmaA = null;
  const anglesA = [];
  if (nA > 0) {
    sigmaA = (poles.reduce((s, p) => s + p.re, 0) -
              zeros.reduce((s, z) => s + z.re, 0)) / nA;
    for (let k = 0; k < nA; k++) anglesA.push((2 * k + 1) * 180 / nA);
  }

  
  
  
  let critK = jwCross.length ? Math.min(...jwCross.map(c => c.K)) : null;
  if (critK === null) {
    let kp = 0, rp = [...poles];
    for (const k of kBase) {
      const rk = matchRoots(rp, rootsAtK(k));
      if (rk.some(r => r.re > critKThreshold)) {
        let lo = kp, hi = k;
        for (let it = 0; it < critKIterations; it++) {
          const m = (lo + hi) / 2;
          rootsAtK(m).some(r => r.re > 0.001) ? (hi = m) : (lo = m);
        }
        critK = (lo + hi) / 2;
        break;
      }
      kp = k; rp = rk;
    }
  }

  return { loci, poles, zeros, sigmaA, anglesA, nA, critK,
           breakPoints, departures, arrivals, jwCross };
}

function computeBode(num, den) {
  const { pts, logStart, logEnd } = BODE_CONFIG;
  const freqs = [], mags = [], rawPh = [];

  for (let i = 0; i <= pts; i++) {
    const w  = Math.pow(10, logStart + i * (logEnd - logStart) / pts);
    const jw = { re: 0, im: w };
    const H  = C.div(polyEval(num, jw), polyEval(den, jw));
    const mag = C.abs(H);
    freqs.push(w);
    mags.push(mag > EPS.magMin ? 20 * Math.log10(mag) : -300);
    rawPh.push(C.arg(H) * 180 / Math.PI);
  }

  
  const phases = [rawPh[0]];
  for (let i = 1; i < rawPh.length; i++) {
    let d = rawPh[i] - phases[phases.length - 1];
    while (d >  180) d -= 360;
    while (d < -180) d += 360;
    phases.push(phases[phases.length - 1] + d);
  }

  
  let PM = null, PMw = null;
  for (let i = 0; i < mags.length - 1; i++) {
    if (mags[i] >= 0 && mags[i + 1] < 0) {
      const t = -mags[i] / (mags[i + 1] - mags[i]);
      PM  = 180 + (phases[i] + t * (phases[i + 1] - phases[i]));
      PMw = freqs[i] + t * (freqs[i + 1] - freqs[i]);
      break;
    }
  }

  
  let GM = null, GMw = null;
  for (let i = 0; i < phases.length - 1; i++) {
    if (phases[i] > -180 && phases[i + 1] <= -180) {
      const t = (-180 - phases[i]) / (phases[i + 1] - phases[i]);
      GM  = -(mags[i] + t * (mags[i + 1] - mags[i]));
      GMw = freqs[i] + t * (freqs[i + 1] - freqs[i]);
      break;
    }
  }

  return { freqs, mags, phases, PM, PMw, GM, GMw };
}

function computeAsymptoticBode(num, den, freqs) {
  const poles = polyRoots(den), zeros = polyRoots(num);
  const eps   = EPS.im;

  
  const { originPoles, originZeros } = _classifyFactors(poles, zeros);

  
  
  const magEvents = [];
  poles.filter(p => C.abs(p) > eps && p.im >= -eps).forEach(p => {
    magEvents.push({ w: C.abs(p), ds: Math.abs(p.im) > eps ? -40 : -20 });
  });
  zeros.filter(z => C.abs(z) > eps && z.im >= -eps).forEach(z => {
    magEvents.push({ w: C.abs(z), ds: Math.abs(z.im) > eps ? +40 : +20 });
  });
  magEvents.sort((a, b) => a.w - b.w);

  
  const initSlope = -20 * (originPoles - originZeros);
  const w0  = freqs[0];
  const H0  = C.div(polyEval(num, { re: 0, im: w0 }), polyEval(den, { re: 0, im: w0 }));
  let curSlope = initSlope, prevW = w0;
  let prevMag  = 20 * Math.log10(Math.max(C.abs(H0), EPS.magMin));
  let ei = 0;

  const asymMags = freqs.map(w => {
    while (ei < magEvents.length && magEvents[ei].w <= w) {
      prevMag  += curSlope * Math.log10(magEvents[ei].w / prevW);
      prevW     = magEvents[ei].w;
      curSlope += magEvents[ei].ds;
      ei++;
    }
    return prevMag + curSlope * Math.log10(w / prevW);
  });

  
  
  const addFactor = (ph, w, wc, totalDeg) => {
    const w1 = wc / 10, w2 = wc * 10;
    if (w <= w1) return ph;
    if (w >= w2) return ph + totalDeg;
    return ph + totalDeg * (Math.log10(w / w1) / Math.log10(w2 / w1));
  };

  const asymPhases = freqs.map(w => {
    let ph = -90 * (originPoles - originZeros);
    poles.filter(p => C.abs(p) > eps && p.im >= -eps)
      .forEach(p => { ph = addFactor(ph, w, C.abs(p), Math.abs(p.im) > eps ? -180 : -90); });
    zeros.filter(z => C.abs(z) > eps && z.im >= -eps)
      .forEach(z => { ph = addFactor(ph, w, C.abs(z), Math.abs(z.im) > eps ? +180 : +90); });
    return ph;
  });

  return { asymMags, asymPhases };
}

function phaseRamp(w, wc, totalDeg) {
  const w1 = wc / 10, w2 = wc * 10;
  if (w <= w1) return 0;
  if (w >= w2) return totalDeg;
  return totalDeg * Math.log10(w / w1) / Math.log10(w2 / w1);
}

function computeBodeFactors(num, den) {
  const poles = polyRoots(den), zeros = polyRoots(num);
  const eps = EPS.im;
  const C0  = BODE_FACTOR_COLORS;

  
  const trailingZeros = c => {
    let k = 0;
    for (let i = c.length - 1; i >= 0 && Math.abs(c[i]) < 1e-12; i--) k++;
    return k;
  };
  const oZ = trailingZeros(num), oP = trailingZeros(den);
  const numC = num.slice(0, num.length - oZ);
  const denC = den.slice(0, den.length - oP);
  const Kb = (numC[numC.length - 1] || 0) / (denC[denC.length - 1] || 1);
  const integOrder = oP - oZ;            

  const { pts, logStart, logEnd } = BODE_CONFIG;
  const freqs = Array.from({ length: pts + 1 }, (_, i) =>
    Math.pow(10, logStart + i * (logEnd - logStart) / pts));

  const factors = [];

  
  factors.push({
    kind: 'gain', color: C0.gain,
    label: `20·log|${Kb.toFixed(3)}| = ${(20 * Math.log10(Math.abs(Kb) || 1e-12)).toFixed(2)} dB`,
    corner: null,
    mag:   freqs.map(() => 20 * Math.log10(Math.abs(Kb) || 1e-12)),
    phase: freqs.map(() => (Kb < 0 ? 180 : 0)),
  });

  
  if (integOrder !== 0) {
    const n = integOrder;
    factors.push({
      kind: n > 0 ? 'integ' : 'diff', color: C0.integ,
      label: n > 0 ? `−20·${n}·log ω   [1/(jω)^${n}]`
                   : `+20·${-n}·log ω   [(jω)^${-n}]`,
      corner: null,
      mag:   freqs.map(w => -20 * n * Math.log10(w)),
      phase: freqs.map(() => -90 * n),
    });
  }

  
  zeros.filter(z => C.abs(z) > eps && Math.abs(z.im) < eps).forEach(z => {
    const wc = Math.abs(z.re), rhp = z.re > 0;
    factors.push({
      kind: 'realZero', color: C0.realZero,
      label: `+20·log|jω/${wc.toFixed(3)} + 1|`, corner: wc,
      mag:   freqs.map(w => w <= wc ? 0 : 20 * Math.log10(w / wc)),
      phase: freqs.map(w => phaseRamp(w, wc, rhp ? -90 : +90)),
    });
  });

  
  poles.filter(p => C.abs(p) > eps && Math.abs(p.im) < eps).forEach(p => {
    const wc = Math.abs(p.re), rhp = p.re > 0;
    factors.push({
      kind: 'realPole', color: C0.realPole,
      label: `−20·log|jω/${wc.toFixed(3)} + 1|`, corner: wc,
      mag:   freqs.map(w => w <= wc ? 0 : -20 * Math.log10(w / wc)),
      phase: freqs.map(w => phaseRamp(w, wc, rhp ? +90 : -90)),
    });
  });

  
  poles.filter(p => C.abs(p) > eps && p.im > eps).forEach(p => {
    const wn = C.abs(p);
    factors.push({
      kind: 'cplxPole', color: C0.cplxPole,
      label: `−40·log|(jω/${wn.toFixed(2)})² + …|`, corner: wn,
      mag:   freqs.map(w => w <= wn ? 0 : -40 * Math.log10(w / wn)),
      phase: freqs.map(w => phaseRamp(w, wn, -180)),
    });
  });

  
  zeros.filter(z => C.abs(z) > eps && z.im > eps).forEach(z => {
    const wn = C.abs(z);
    factors.push({
      kind: 'cplxZero', color: C0.cplxZero,
      label: `+40·log|(jω/${wn.toFixed(2)})² + …|`, corner: wn,
      mag:   freqs.map(w => w <= wn ? 0 : 40 * Math.log10(w / wn)),
      phase: freqs.map(w => phaseRamp(w, wn, +180)),
    });
  });

  
  const sumMag   = freqs.map((_, i) => factors.reduce((s, f) => s + f.mag[i], 0));
  const sumPhase = freqs.map((_, i) => factors.reduce((s, f) => s + f.phase[i], 0));

  
  const terms = [`20log|${Kb.toFixed(2)}|`];
  if (integOrder > 0) terms.push(`− 20·${integOrder}·log|jω|`);
  if (integOrder < 0) terms.push(`+ 20·${-integOrder}·log|jω|`);
  zeros.filter(z => C.abs(z) > eps && Math.abs(z.im) < eps)
    .forEach(z => terms.push(`+ 20log|jω/${Math.abs(z.re).toFixed(2)}+1|`));
  poles.filter(p => C.abs(p) > eps && Math.abs(p.im) < eps)
    .forEach(p => terms.push(`− 20log|jω/${Math.abs(p.re).toFixed(2)}+1|`));
  zeros.filter(z => C.abs(z) > eps && z.im > eps)
    .forEach(z => terms.push(`+ 40log|(jω/${C.abs(z).toFixed(2)})²+…|`));
  poles.filter(p => C.abs(p) > eps && p.im > eps)
    .forEach(p => terms.push(`− 40log|(jω/${C.abs(p).toFixed(2)})²+…|`));
  const formula = terms.join('  ');

  return { freqs, factors, sumMag, sumPhase, Kb, integOrder, formula };
}

function computeSteps(num, den, rlData, bodeData) {
  const { poles, zeros, sigmaA, anglesA, nA, critK, breakPoints } = rlData;
  const nP = poles.length, nZ = zeros.length;

  
  
  const realPZ = [...poles, ...zeros]
    .filter(p => Math.abs(p.im) < EPS.im)
    .map(p => p.re)
    .sort((a, b) => b - a); 

  const realSegments = [];
  for (let i = 0; i < realPZ.length; i++) {
    
    const rightCount = i + 1;
    const inRL = rightCount % 2 === 1;
    const from = realPZ[i];
    const to   = i < realPZ.length - 1 ? realPZ[i + 1] : -Infinity;
    realSegments.push({ from, to, inRL });
  }

  
  const charCoeffs = k => polyAdd(den, polyScale(num, k));

  return { nP, nZ, nA, poles, zeros, sigmaA, anglesA, critK, breakPoints,
           realSegments, charCoeffs, bodeData };
}

function computeDesiredPole(osPercent, ts, tsRatio = 1, currentTs = 0) {
  
  const ln   = Math.log(osPercent / 100);
  const zeta = -ln / Math.sqrt(Math.PI * Math.PI + ln * ln);
  const theta = Math.acos(zeta); 

  
  let tsTarget = ts;
  if (!ts && tsRatio && currentTs) tsTarget = currentTs / tsRatio;

  
  const sigma  = tsTarget > 0 ? 4 / tsTarget : 0;
  const omegaN = sigma > 0 ? sigma / zeta : 0;
  const omegaD = omegaN * Math.sqrt(1 - zeta * zeta);

  return {
    zeta, theta: theta * 180 / Math.PI,
    sigma, omegaD,
    desiredPole: { re: -sigma, im: omegaD },
    tsTarget,
  };
}

function angleTest(num, den, s) {
  const G   = C.div(polyEval(num, s), polyEval(den, s));
  const ang = C.arg(G) * 180 / Math.PI;
  
  let norm = ((ang % 360) + 360) % 360; 
  if (norm > 180) norm -= 360;           
  
  const deficit = 180 - Math.abs(norm);  
  return { angleDeg: ang, deficit, onRL: Math.abs(deficit) < 2 };
}

function designLead(num, den, sDes, zeroC = null) {
  const steps = [];

  
  const polyMul = (a, b) => {
    const res = Array(a.length + b.length - 1).fill(0);
    a.forEach((av, i) => b.forEach((bv, j) => { res[i + j] += av * bv; }));
    return res;
  };

  
  const { angleDeg, deficit } = angleTest(num, den, sDes);
  steps.push(`∠G(s*) = ${angleDeg.toFixed(2)}°`);
  steps.push(`Açı eksikliği φ = ${deficit.toFixed(2)}°`);

  
  
  const zc = (zeroC !== null && isFinite(zeroC) && zeroC > 0)
    ? zeroC
    : Math.max(0.1, Math.abs(sDes.re) * 0.8);
  steps.push(`Lead sıfır: zc = ${zc.toFixed(3)}  (s = −${zc.toFixed(3)})`);

  
  
  const angleZ    = Math.atan2(sDes.im, sDes.re + zc) * 180 / Math.PI;
  const targetAng = angleZ - deficit;
  steps.push(`∠(s*+zc) = ${angleZ.toFixed(2)}°,  hedef ∠(s*+pc) = ${targetAng.toFixed(2)}°`);

  
  const tanT = Math.tan(targetAng * Math.PI / 180);
  const pc   = (Math.abs(tanT) > 1e-10)
    ? (sDes.im / tanT - sDes.re)
    : Math.abs(sDes.re) * 20;
  steps.push(`Lead kutup: pc = ${pc.toFixed(3)}  (s = −${pc.toFixed(3)})`);

  
  const gcNum = [1, zc];
  const gcDen = [1, pc];

  
  const Gval   = C.div(polyEval(num,   sDes), polyEval(den,   sDes));
  const Gcval  = C.div(polyEval(gcNum, sDes), polyEval(gcDen, sDes));
  const magGGc = C.abs(C.mul(Gval, Gcval));
  const K      = magGGc > EPS.nearZero ? 1 / magGGc : 0;
  steps.push(`|G(s*)·Gc(s*)| = ${magGGc.toFixed(6)}  →  K = ${K.toFixed(4)}`);

  
  const oltfNum = polyScale(polyMul(num, gcNum), K);
  const oltfDen = polyMul(den, gcDen);

  
  let warning = null, feasible = true;
  if (pc <= 0) {
    feasible = false;
    warning = `Lead kutup pc = ${pc.toFixed(3)} ≤ 0 (sağ yarı düzlem). ` +
              `Açı eksikliği φ = ${deficit.toFixed(1)}° çok büyük — ` +
              `tek kademeli lead yetersiz. Ts hedefini büyütün ya da zc değiştirin.`;
    steps.push('⚠ Tasarım geçersiz: pc ≤ 0 → kutup RHP\'de.');
  } else if (pc <= zc) {
    feasible = false;
    warning = `pc = ${pc.toFixed(3)} ≤ zc = ${zc.toFixed(3)}: Lead koşulu (pc > zc) sağlanamadı. ` +
              `Farklı bir zc girin.`;
    steps.push('⚠ Tasarım geçersiz: pc > zc koşulu sağlanamadı.');
  } else if (deficit > 80) {
    warning = `φ = ${deficit.toFixed(1)}° büyük. Tasarım matematiksel olarak geçerli ` +
              `ama agresif — iki kademeli lead veya daha az hızlanma önerilir.`;
  }

  return { type: 'lead', zc, pc, K, angleDeg, deficit,
           feasible, warning, gcNum, gcDen, oltfNum, oltfDen, steps };
}

function designLag(num, den, betaTarget, pmTarget = 45) {
  const steps = [];
  const bode  = computeBode(num, den);
  steps.push(`Mevcut PM = ${bode.PM != null ? bode.PM.toFixed(1) + '°' : 'tanımsız'}`);
  steps.push(`Hedef PM ≥ ${pmTarget}°`);

  
  const phTarget = -180 + pmTarget + 5;
  let wGM = null;
  for (let i = 0; i < bode.phases.length - 1; i++) {
    if (bode.phases[i] >= phTarget && bode.phases[i + 1] < phTarget) {
      const t = (phTarget - bode.phases[i]) / (bode.phases[i + 1] - bode.phases[i]);
      wGM = bode.freqs[i] + t * (bode.freqs[i + 1] - bode.freqs[i]);
      break;
    }
  }
  if (!wGM) wGM = bode.freqs[Math.floor(bode.freqs.length / 2)];
  steps.push(`Yeni kesim frekansı ωgc ≈ ${wGM.toFixed(3)} rad/s`);

  
  const zc = wGM / 10;
  const pc = zc / betaTarget;
  steps.push(`β = ${betaTarget} → lag sıfır: ${zc.toFixed(4)}, lag kutup: ${pc.toFixed(4)}`);

  const gcNum = [1, zc];
  const gcDen = [1, pc];

  const oltfNum = (() => {
    const a = num, b = gcNum;
    const res = Array(a.length + b.length - 1).fill(0);
    a.forEach((av, i) => b.forEach((bv, j) => res[i + j] += av * bv));
    return res;
  })();
  const oltfDen = (() => {
    const a = den, b = gcDen;
    const res = Array(a.length + b.length - 1).fill(0);
    a.forEach((av, i) => b.forEach((bv, j) => res[i + j] += av * bv));
    return res;
  })();

  return { type: 'lag', beta: betaTarget, zc, pc, gcNum, gcDen, oltfNum, oltfDen, steps };
}

// ── Çalışma noktası: ζ doğrusu ∩ kök yer eğrisi ──
// Sabit sönüm (ζ) doğrusu üzerinde, açı koşulunu (∠G = ±180°) sağlayan
// noktayı ararız. O nokta istenen baskın kapalı çevrim kutbudur; orada
// genlik koşulundan K = 1/|G(s*)| okunur.
//
// Yöntem: s = r·(−cosβ + j·sinβ), β = acos(ζ), r > 0 boyunca G(s) taranır.
// G(s)'in SANAL kısmı işaret değiştirdiği yerde (ve reel kısmı negatifken)
// G(s) negatif-reel olur → o nokta eğri üzerindedir, K = −1/G(s) > 0.
function findOperatingPoints(num, den, zeta) {
  const z = Math.max(0, Math.min(0.9999, zeta));
  const beta = Math.acos(z);
  const ux = -Math.cos(beta), uy = Math.sin(beta);

  const Gval = r => {
    const s = { re: ux * r, im: uy * r };
    return C.div(polyEval(num, s), polyEval(den, s));
  };

  const crossings = [];
  const rMax = 500, steps = 6000;
  let rPrev = 1e-4, gPrev = Gval(rPrev);

  for (let i = 1; i <= steps; i++) {
    const r = rMax * Math.pow(i / steps, 2);   // orijine yakın daha sık
    const g = Gval(r);
    if (gPrev.im * g.im < 0) {                 // sanal kısım işaret değiştirdi
      let lo = rPrev, hi = r, gloIm = gPrev.im;
      for (let it = 0; it < 60; it++) {
        const mid = (lo + hi) / 2;
        const gm = Gval(mid);
        if (gloIm * gm.im <= 0) hi = mid; else { lo = mid; gloIm = gm.im; }
      }
      const rStar = (lo + hi) / 2;
      const gStar = Gval(rStar);
      if (gStar.re < 0 && isFinite(gStar.re)) {      // negatif reel → K > 0
        const s = { re: ux * rStar, im: uy * rStar };
        const K = 1 / C.abs(gStar);
        crossings.push({ s, K, r: rStar });
      }
    }
    rPrev = r; gPrev = g;
  }

  crossings.sort((a, b) => a.r - b.r);          // baskın (en yakın) önce
  return crossings;
}
