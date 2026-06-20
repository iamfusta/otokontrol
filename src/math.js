const C = {
  
  add: (a, b) => ({ re: a.re + b.re, im: a.im + b.im }),
  sub: (a, b) => ({ re: a.re - b.re, im: a.im - b.im }),
  mul: (a, b) => ({
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  }),
  div: (a, b) => {
    const d = b.re * b.re + b.im * b.im;
    if (d < ROOT_FIND.divEps) return { re: 1e15, im: 0 };
    return {
      re: (a.re * b.re + a.im * b.im) / d,
      im: (a.im * b.re - a.re * b.im) / d,
    };
  },
  
  abs: (a) => Math.hypot(a.re, a.im),
  
  arg: (a) => Math.atan2(a.im, a.re),
};

function polyEval(c, s) {
  let r = { re: 0, im: 0 };
  for (const v of c) r = C.add(C.mul(r, s), { re: v, im: 0 });
  return r;
}

function polyAdd(a, b) {
  const n = Math.max(a.length, b.length);
  const pa = [...Array(n - a.length).fill(0), ...a];
  const pb = [...Array(n - b.length).fill(0), ...b];
  return pa.map((v, i) => v + pb[i]);
}

function polyScale(p, k) { return p.map(v => v * k); }

function polyDeriv(p) {
  const n = p.length - 1;
  return p.slice(0, n).map((v, i) => v * (n - i));
}

function polyRoots(coeffs) {
  let c = [...coeffs];
  
  while (c.length > 1 && Math.abs(c[0]) < EPS.root) c.shift();

  const n = c.length - 1;
  if (n <= 0) return [];

  
  if (n === 1) return [{ re: -c[1] / c[0], im: 0 }];
  if (n === 2) {
    const [a, b, cc] = [c[0], c[1], c[2]];
    const disc = b * b - 4 * a * cc;
    if (disc >= 0) return [
      { re: (-b + Math.sqrt(disc)) / (2 * a), im: 0 },
      { re: (-b - Math.sqrt(disc)) / (2 * a), im: 0 },
    ];
    const re = -b / (2 * a), im = Math.sqrt(-disc) / (2 * a);
    return [{ re, im }, { re, im: -im }];
  }

  
  const norm = c.map(v => v / c[0]);
  const r0 = Math.max(1, Math.pow(Math.abs(norm[n]), 1 / n)) * ROOT_FIND.radiusFactor;
  let roots = Array.from({ length: n }, (_, k) => ({
    re: r0 * Math.cos(2 * Math.PI * k / n + 0.5),
    im: r0 * Math.sin(2 * Math.PI * k / n + 0.5),
  }));

  
  for (let iter = 0; iter < ROOT_FIND.maxIter; iter++) {
    let maxDelta = 0;
    const next = roots.map((r, i) => {
      const num = polyEval(norm, r);
      let den = { re: 1, im: 0 };
      for (let j = 0; j < n; j++) if (j !== i) den = C.mul(den, C.sub(r, roots[j]));
      if (C.abs(den) < ROOT_FIND.divEps) return r;
      const delta = C.div(num, den);
      maxDelta = Math.max(maxDelta, C.abs(delta));
      return C.sub(r, delta);
    });
    roots = next;
    if (maxDelta < ROOT_FIND.tolerance) break;
  }
  return roots;
}

function matchRoots(prev, next) {
  
  const sorted = [...next].sort((a, b) => {
    const dr = a.re - b.re;
    if (Math.abs(dr) > 1e-9) return dr;   
    return b.im - a.im;                    
  });

  const used = new Array(sorted.length).fill(false);
  return prev.map(p => {
    let best = Infinity, bi = -1;
    sorted.forEach((q, j) => {
      if (!used[j]) {
        const d = C.abs(C.sub(p, q));
        if (d < best) { best = d; bi = j; }
      }
    });
    if (bi >= 0) { used[bi] = true; return sorted[bi]; }
    return p;
  });
}

function polyMul(a, b) {
  const res = Array(a.length + b.length - 1).fill(0);
  a.forEach((av, i) => b.forEach((bv, j) => { res[i + j] += av * bv; }));
  return res;
}

function rootFactor(root) {
  if (Math.abs(root.im) < EPS.im) return [1, -root.re];
  return [1, -2 * root.re, root.re * root.re + root.im * root.im];
}

function sumAngles(from, others, skip = null) {
  let total = 0;
  for (const o of others) {
    if (skip && Math.abs(o.re - skip.re) < 1e-9 && Math.abs(o.im - skip.im) < 1e-9) continue;
    if (Math.abs(o.re - from.re) < 1e-12 && Math.abs(o.im - from.im) < 1e-12) continue;
    total += Math.atan2(from.im - o.im, from.re - o.re) * 180 / Math.PI;
  }
  return total;
}

function departureAngle(pole, poles, zeros) {
  const a = 180 + sumAngles(pole, zeros) - sumAngles(pole, poles, pole);
  return ((a % 360) + 540) % 360 - 180;
}

function arrivalAngle(zero, poles, zeros) {
  const a = 180 - sumAngles(zero, zeros, zero) + sumAngles(zero, poles);
  return ((a % 360) + 540) % 360 - 180;
}

function routhArray(coeffs) {
  const n = coeffs.length - 1;
  const cols = Math.ceil((n + 1) / 2);
  const rows = [];
  rows[0] = []; rows[1] = [];
  for (let i = 0; i <= n; i++) (i % 2 === 0 ? rows[0] : rows[1]).push(coeffs[i]);
  while (rows[0].length < cols) rows[0].push(0);
  while (rows[1].length < cols) rows[1].push(0);

  for (let r = 2; r <= n; r++) {
    const a = rows[r - 2], b = rows[r - 1];
    let piv = b[0];
    if (Math.abs(piv) < 1e-12) piv = 1e-12; 
    rows[r] = [];
    for (let c = 0; c < cols - 1; c++) {
      rows[r].push((piv * a[c + 1] - a[0] * b[c + 1]) / piv);
    }
    rows[r].push(0);
  }
  return rows;
}

function polyStr(c) {
  const n = c.length - 1;
  return c.map((v, i) => {
    const deg = n - i;
    if (Math.abs(v) < 1e-12) return '';
    const vs = v % 1 === 0 ? v.toFixed(0)
      : (Math.abs(v) < 0.01 ? v.toExponential(2) : v.toFixed(3));
    if (deg === 0) return vs;
    if (deg === 1) return `${vs}s`;
    return `${vs}s^${deg}`;
  }).filter(Boolean).join(' + ') || '0';
}

function fmtC(c, d = 2) {
  if (Math.abs(c.im) < 5e-3) return c.re.toFixed(d);
  const sign = c.im >= 0 ? '+' : '-';
  return `${c.re.toFixed(d)} ${sign} j${Math.abs(c.im).toFixed(d)}`;
}

function parsePoly(s) {
  const a = s.trim().split(/[\s,]+/).map(Number);
  return a.every(isFinite) && a.length > 0 ? a : null;
}

function parseExprPoly(expr) {


  const cleaned = expr.replace(/\s+/g, '').replace(/-/g, '+-');
  const terms = cleaned.split('+').filter(t => t !== '');
  if (!terms.length) return null;

  let maxDeg = 0;
  const parsed = [];
  for (let t of terms) {
    let sign = 1;
    if (t[0] === '-') { sign = -1; t = t.slice(1); }
    if (t === '') return null;

    let coef, deg;
    if (t.indexOf('s') !== -1) {
      const parts = t.split('s');
      const coefPart = parts[0];
      const degPart  = parts[1] || '';
      coef = coefPart === '' ? 1 : parseFloat(coefPart);
      if (degPart === '')           deg = 1;
      else if (degPart[0] === '^')  deg = parseInt(degPart.slice(1), 10);
      else                          return null;
    } else {
      coef = parseFloat(t); deg = 0;
    }
    if (!isFinite(coef) || !isFinite(deg) || deg < 0) return null;
    coef *= sign;
    maxDeg = Math.max(maxDeg, deg);
    parsed.push({ coef, deg });
  }

  const arr = new Array(maxDeg + 1).fill(0);
  parsed.forEach(({ coef, deg }) => { arr[maxDeg - deg] += coef; });
  return arr;
}

function parseFactored(str) {
  const s = str.replace(/\s+/g, '').replace(/\*/g, '');
  if (s === '') return null;

  let result = [1], i = 0, found = false;
  while (i < s.length) {
    if (s[i] === '(') {
      let depth = 1, j = i + 1;
      while (j < s.length && depth > 0) {
        if (s[j] === '(') depth++;
        else if (s[j] === ')') depth--;
        j++;
      }
      if (depth !== 0) return null;
      const p = parseExprPoly(s.slice(i + 1, j - 1));
      if (!p) return null;
      result = polyMul(result, p);
      i = j; found = true;
    } else {
      let j = i;
      while (j < s.length && s[j] !== '(') j++;
      const p = parseExprPoly(s.slice(i, j));
      if (!p) return null;
      result = polyMul(result, p);
      i = j; found = true;
    }
  }
  return found ? result : null;
}

function parseSystemInput(str) {
  if (!str || str.trim() === '') return null;

  if (/[a-zA-Z(]/.test(str)) return parseFactored(str);
  return parsePoly(str);
}
