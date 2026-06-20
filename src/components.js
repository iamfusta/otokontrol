const { useState, useEffect, useRef, useCallback, useMemo } = React;

function useCanvas(draw, deps) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const go = () => {
      if (!canvas.clientWidth || !canvas.clientHeight) {
        
        requestAnimationFrame(() => {
          if (canvas.clientWidth && canvas.clientHeight) {
            canvas.width  = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
            draw(canvas);
          }
        });
        return;
      }
      canvas.width  = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      draw(canvas);
    };
    const obs = new ResizeObserver(go);
    obs.observe(canvas);
    window.addEventListener('resize', go);
    go();
    return () => { obs.disconnect(); window.removeEventListener('resize', go); };
  }, deps); 
  return ref;
}

function useTransferFunction(numStr, denStr, kMax) {
  const [rlData,   setRlData]   = useState(null);
  const [bodeData, setBodeData] = useState(null);
  const [error,    setError]    = useState('');

  const compute = useCallback(() => {
    const num = parseSystemInput(numStr), den = parseSystemInput(denStr);
    if (!num || !den)            { setError('Geçersiz polinomlar.');          return; }
    if (num.length > den.length) { setError('Sayıcı derecesi paydayı geçemez.'); return; }
    try {
      setError('');
      setRlData(computeRL(num, den, kMax));
      setBodeData(computeBode(num, den));
    } catch (e) {
      setError('Hata: ' + e.message);
    }
  }, [numStr, denStr, kMax]);

  
  const asymData = useMemo(() => {
    if (!bodeData) return null;
    const num = parseSystemInput(numStr), den = parseSystemInput(denStr);
    if (!num || !den) return null;
    return computeAsymptoticBode(num, den, bodeData.freqs);
  }, [bodeData, numStr, denStr]);

  return { rlData, bodeData, asymData, error, compute };
}

function StepCard({ number, title, children }) {
  return (
    <div className="sol-card">
      <div className="sol-head">
        <div className="sol-num">{number}</div>
        {title}
      </div>
      <div className="sol-body">{children}</div>
    </div>
  );
}

function StepSolution({ rlData, bodeData, numStr, denStr }) {
  if (!rlData) {
    return <div style={{ padding: 20, color: '#484f58' }}>Önce hesapla butonuna bas.</div>;
  }

  const { poles, zeros, nP, nZ, nA, sigmaA, anglesA, critK, breakPoints } = rlData;
  const sumPoles = poles.reduce((s, p) => s + p.re, 0);
  const sumZeros = zeros.reduce((s, z) => s + z.re, 0);

  
  const realPZ = [...poles, ...zeros]
    .filter(p => Math.abs(p.im) < EPS.im)
    .map(p => +p.re.toFixed(3))
    .sort((a, b) => b - a);
  const realSegs = realPZ.map((from, i) => ({
    from,
    to:   i < realPZ.length - 1 ? realPZ[i + 1] : -Infinity,
    inRL: (i + 1) % 2 === 1, 
  }));

  const cardNum = (n) => nA > 0 ? n : n - 1; 
  const bd = bodeData;

  return (
    <div className="sol-wrap">

      {}
      <KeyPointsCard rlData={rlData} />

      {}
      <StepCard number={1} title="Kutuplar &amp; Sıfırlar">
        <div className="formula">G(s) = [{numStr}] / [{denStr}]</div>
        <div className="row">
          <span className="lbl">Açık çevrim kutuplar (×)</span>
          <span className="val" style={{ color: '#f85149' }}>{poles.map(p => fmtC(p)).join(' , ')}</span>
        </div>
        <div className="row">
          <span className="lbl">Açık çevrim sıfırlar (○)</span>
          <span className="val" style={{ color: '#3fb950' }}>
            {zeros.length ? zeros.map(z => fmtC(z)).join(' , ') : 'Yok (sonsuzdaki)'}
          </span>
        </div>
        <div className="row"><span className="lbl">Kutup sayısı n</span><span className="val">{nP}</span></div>
        <div className="row"><span className="lbl">Sıfır sayısı m</span><span className="val">{nZ}</span></div>
        <p className="note">→ Kök yer eğrisi K=0'da kutuplardan başlar, K→∞'da sıfırlara gider (veya sonsuza).</p>
      </StepCard>

      {}
      <StepCard number={2} title="Dal Sayısı &amp; Sonsuza Giden Dallar">
        <div className="row"><span className="lbl">Toplam dal sayısı</span><span className="val">{nP}</span></div>
        <div className="row"><span className="lbl">Sıfıra giden dallar</span><span className="val">{nZ}</span></div>
        <div className="row">
          <span className="lbl">Sonsuza giden dallar (n−m)</span>
          <span className="val" style={{ color: '#d29922' }}>{nA}</span>
        </div>
        <p className="note">→ Sonsuza giden {nA} dal için asimptot hesaplamak gerekir.</p>
      </StepCard>

      {}
      <StepCard number={3} title="Reel Eksen Üzerindeki Eğri">
        <p className="note" style={{ color: '#e6edf3', marginBottom: 4 }}>
          Kural: Bir noktanın sağındaki toplam kutup+sıfır sayısı <b>tek</b> ise eğri oradadır.
        </p>
        {realSegs.map((seg, i) => (
          <div key={i} className="row">
            <span className="lbl">
              {seg.from.toFixed(2)} → {seg.to === -Infinity ? '−∞' : seg.to.toFixed(2)}
            </span>
            <span className="val" style={{ color: seg.inRL ? '#3fb950' : '#484f58' }}>
              {seg.inRL ? '✓ Eğri var' : '✗ Eğri yok'}
            </span>
          </div>
        ))}
      </StepCard>

      {}
      {nA > 0 && (
        <StepCard number={4} title={`Asimptotlar (${nA} adet)`}>
          <div className="formula">σₐ = (Σkutuplar − Σsıfırlar) / (n − m)</div>
          <div className="formula">
            σₐ = ({sumPoles.toFixed(3)} − {sumZeros.toFixed(3)}) / {nA} ={' '}
            <span style={{ color: '#d29922' }}>{sigmaA?.toFixed(4)}</span>
          </div>
          <div style={{ marginTop: 6 }}>
            {anglesA.map((a, i) => (
              <div key={i} className="row">
                <span className="lbl">k={i}: θ = (2×{i}+1)×180° / {nA}</span>
                <span className="val" style={{ color: '#d29922' }}>{a.toFixed(1)}°</span>
              </div>
            ))}
          </div>
          <p className="note">
            → Asimptotlar σₐ = {sigmaA?.toFixed(3)} noktasından{' '}
            {anglesA.map(a => a.toFixed(0) + '°').join(', ')} açılarıyla uzar.
          </p>
        </StepCard>
      )}

      {}
      <StepCard number={cardNum(5)} title="Kalkış / Varış Noktaları (dK/ds = 0)">
        <div className="formula">K = −D(s) / N(s)  →  dK/ds = 0</div>
        <div className="formula">D′(s)·N(s) − N′(s)·D(s) = 0</div>
        <p className="note" style={{ color: '#e6edf3', marginBottom: 4 }}>
          Paydanın karesi sıfıra eşitlenmekte olduğu için sadece pay sıfıra eşitlenerek çözülür.
        </p>
        {breakPoints.length > 0
          ? breakPoints.map((b, i) => (
            <div key={i} className="row">
              <span className="lbl">Nokta {i + 1}</span>
              <span className="val">s = {b.s.toFixed(3)} &nbsp;(K ≈ {b.K.toFixed(3)})</span>
            </div>
          ))
          : <p className="note warn">
              Reel eksende kalkış/varış noktası bulunamadı
              (karmaşık kutuplar için açı koşulu gerekmektedir).
            </p>
        }
      </StepCard>

      {}
      <StepCard number={cardNum(6)} title="Sanal Eksen Kesişimi &amp; Kararlılık Sınırı">
        <p className="note" style={{ color: '#e6edf3', marginBottom: 4 }}>
          Routh-Hurwitz yöntemi: Karakteristik denklem den(s) + K·num(s) = 0 üzerine tablo kurulur.
        </p>
        <div className="formula">1 + K·G(s)H(s) = 0</div>
        {critK !== null
          ? <>
              <div className="row">
                <span className="lbl">Kritik K (kararlılık sınırı)</span>
                <span className="val" style={{ color: '#f85149' }}>K ≈ {critK.toFixed(3)}</span>
              </div>
              <p className="note">→ K &lt; {critK.toFixed(2)} → kararlı, K &gt; {critK.toFixed(2)} → kararsız.</p>
            </>
          : <p className="note g">
              → Sistem için tüm K &gt; 0 değerlerinde sanal eksen geçişi tespit edilmedi (kararlı kalıyor).
            </p>
        }
      </StepCard>

      {}
      {bd && (
        <StepCard number={cardNum(7)} title="Bode Analizi — Kazanç &amp; Faz Payları">
          <div className="row">
            <span className="lbl">Faz Payı (PM)</span>
            <span className="val" style={{ color: bd.PM > 0 ? '#3fb950' : '#f85149' }}>
              {bd.PM != null ? bd.PM.toFixed(2) + '°' : '—'}
            </span>
          </div>
          <div className="row">
            <span className="lbl">PM frekansı ωc</span>
            <span className="val">{bd.PMw != null ? bd.PMw.toFixed(4) + ' rad/s' : '—'}</span>
          </div>
          <div className="row">
            <span className="lbl">Kazanç Payı (GM)</span>
            <span className="val" style={{ color: bd.GM > 0 ? '#3fb950' : '#f85149' }}>
              {bd.GM != null ? bd.GM.toFixed(2) + ' dB' : '—'}
            </span>
          </div>
          <div className="row">
            <span className="lbl">GM frekansı ωp</span>
            <span className="val">{bd.GMw != null ? bd.GMw.toFixed(4) + ' rad/s' : '—'}</span>
          </div>
          <p className="note">→ PM &gt; 0° ve GM &gt; 0 dB → kapalı çevrim kararlı.</p>
          <p className="note">→ Genel kural: PM ≥ 30−60° iyi tasarım, PM = 60° kritik sönümlü.</p>
        </StepCard>
      )}

      {}
      <StepCard number="ℹ" title="Bode Diyagramı — Neden 2 Grafik?">
        <p className="note" style={{ color: '#e6edf3' }}>
          Bode diyagramı <b>her zaman 2 ayrı grafik</b> içerir:
        </p>
        <div className="row">
          <span className="lbl">1. Genlik (Magnitude)</span>
          <span className="val b">|G(jω)| → dB &nbsp;(20·log₁₀|H|)</span>
        </div>
        <div className="row">
          <span className="lbl">2. Faz (Phase)</span>
          <span className="val" style={{ color: '#ffa657' }}>∠G(jω) → derece</span>
        </div>
        <p className="note" style={{ marginTop: 6 }}>
          Elle çizerken <b>asimptotik (düz çizgi)</b> yaklaşımı kullanılır:
        </p>
        <div className="row">
          <span className="lbl">Gerçek kutup</span>
          <span className="val">köşe frekansında −20 dB/dekad eğim kırılır</span>
        </div>
        <div className="row">
          <span className="lbl">Karmaşık çift kutup</span>
          <span className="val">−40 dB/dekad kırılır</span>
        </div>
        <div className="row">
          <span className="lbl">Sıfır</span>
          <span className="val">+20 veya +40 dB/dekad artar</span>
        </div>
        <div className="row">
          <span className="lbl">Orijin kutbu</span>
          <span className="val">başlangıçta −20 dB/dekad eğim</span>
        </div>
        <p className="note">→ Sarı kesikli çizgi = asimptotik (el çizimi) yaklaşımı</p>
      </StepCard>

    </div>
  );
}

function Sidebar({ open, numStr, denStr, setNumStr, setDenStr, kMax, setKMax,
                   error, rlData, bodeData, onCompute }) {
  const num    = parseSystemInput(numStr) || [];
  const den    = parseSystemInput(denStr) || [];
  const poles  = rlData?.poles || [];
  const zeros  = rlData?.zeros || [];
  const openStable = poles.length > 0 && poles.every(p => p.re < -1e-4);

  return (
    <div className={`sidebar${open ? ' open' : ''}`}>
      {}
      <div>
        <div className="sec-title">Transfer Fonksiyonu G(s)</div>
        <div className="tf-box">
          <div className="tf-num">{num.length ? polyStr(num) : '—'}</div>
          <div style={{ color: '#484f58', fontSize: '10px', margin: '2px 0' }}>─────────────</div>
          <div className="tf-den">{den.length ? polyStr(den) : '—'}</div>
        </div>
      </div>

      {}
      <div>
        <div className="sec-title">Giriş</div>
        <div style={{ marginBottom: 7 }}>
          <label>Sayıcı — katsayı veya çarpanlı (s'li)</label>
          <input type="text" value={numStr}
            onChange={e => setNumStr(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onCompute()}
            placeholder="ör: 1 3  ·  s+3" />
        </div>
        <div style={{ marginBottom: 7 }}>
          <label>Payda — katsayı veya çarpanlı (s'li)</label>
          <input type="text" value={denStr}
            onChange={e => setDenStr(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onCompute()}
            placeholder="ör: 1 8 21 20 0  ·  s(s+4)(s^2+4s+5)" />
        </div>
        {error && <div className="err">{error}</div>}
        <button className="btn" onClick={onCompute}>▶ Hesapla &amp; Çiz</button>
      </div>

      {}
      <div>
        <div className="sec-title">Örnekler</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 4 }}>
          {PRESETS.map((p, i) => (
            <button key={i} className="btn-sm" title={p.desc}
              onClick={() => { setNumStr(p.num); setDenStr(p.den); }}>
              {i + 1}
            </button>
          ))}
        </div>
        {PRESETS.map((p, i) => (
          <div key={i}
            style={{ fontSize: '10px', color: '#484f58', padding: '1px 0', cursor: 'pointer' }}
            onClick={() => { setNumStr(p.num); setDenStr(p.den); }}>
            <span style={{ color: '#8b949e' }}>{i + 1}.</span> {p.label}
          </div>
        ))}
      </div>

      {}
      {rlData && (
        <div>
          <div className="sec-title">Kutuplar &amp; Sıfırlar</div>
          <div style={{ marginBottom: 5 }}>
            <div style={{ fontSize: '10px', color: '#8b949e', marginBottom: 3 }}>
              Kutuplar × ({poles.length})
            </div>
            {poles.map((p, i) => <span key={i} className="chip cp">{fmtC(p)}</span>)}
          </div>
          <div style={{ marginBottom: 5 }}>
            <div style={{ fontSize: '10px', color: '#8b949e', marginBottom: 3 }}>
              Sıfırlar ○ ({zeros.length})
            </div>
            {zeros.length
              ? zeros.map((z, i) => <span key={i} className="chip cz">{fmtC(z)}</span>)
              : <span style={{ fontSize: '10px', color: '#484f58' }}>Sonlu sıfır yok</span>
            }
          </div>
          <div className={`badge ${openStable ? 'stable' : 'unstable'}`}>
            Açık Çevrim: {openStable ? 'KARARLII ✓' : 'KARARSIZ / NÖTR ✗'}
          </div>
        </div>
      )}

      {}
      {rlData && (
        <div>
          <div className="sec-title">Hızlı Analiz</div>
          <div className="info">
            <p>Asimptot sayısı: <span className="y">{rlData.nA}</span></p>
            {rlData.sigmaA !== null && (
              <p>Asimptot merkezi σₐ: <span className="b">{rlData.sigmaA.toFixed(3)}</span></p>
            )}
            {rlData.anglesA.length > 0 && (
              <p>Asimptot açıları: <span className="y">{rlData.anglesA.map(a => a.toFixed(0) + '°').join(', ')}</span></p>
            )}
            {rlData.critK !== null && (
              <p>Sınır K ≈ <span className="r">{rlData.critK.toFixed(2)}</span></p>
            )}
            {rlData.breakPoints.length > 0 && (
              <p>Kalkış/varış: <span>{rlData.breakPoints.map(b => 'σ=' + b.s.toFixed(2)).join(', ')}</span></p>
            )}
          </div>
          {bodeData && (
            <div className="margin-row">
              <div className="margin-card">
                <div className="ml">Faz Payı PM</div>
                <div className={`mv ${bodeData.PM == null ? '' : bodeData.PM > 0 ? 'ok' : 'ng'}`}>
                  {bodeData.PM != null ? bodeData.PM.toFixed(1) + '°' : '—'}
                </div>
              </div>
              <div className="margin-card">
                <div className="ml">Kazanç Payı GM</div>
                <div className={`mv ${bodeData.GM == null ? '' : bodeData.GM > 0 ? 'ok' : 'ng'}`}>
                  {bodeData.GM != null ? bodeData.GM.toFixed(1) + ' dB' : '—'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ControllerDesign({ numStr, denStr, rlData }) {
  const [mode,      setMode]      = useState('lead');  
  const [osPercent, setOsPercent] = useState('16');
  const [tsVal,     setTsVal]     = useState('');
  const [tsRatio,   setTsRatio]   = useState('3');
  const [zeroCStr,  setZeroCStr]  = useState('');      
  const [betaStr,   setBetaStr]   = useState('10');    
  const [pmTarget,  setPmTarget]  = useState('45');
  const [result,    setResult]    = useState(null);
  const [err,       setErr]       = useState('');

  const num = parseSystemInput(numStr), den = parseSystemInput(denStr);

  const run = () => {
    if (!num || !den || !rlData) { setErr('Önce ana sekmede hesapla.'); return; }
    try {
      setErr('');
      if (mode === 'lead') {
        const os = parseFloat(osPercent);
        const ts = parseFloat(tsVal) || 0;
        const ratio = parseFloat(tsRatio) || 1;
        if (isNaN(os) || os <= 0 || os >= 100) { setErr('Geçerli OS% gir (0-100).'); return; }

        
        const domPoles = rlData.poles.filter(p => Math.abs(p.im) > 0.01);
        
        
        const realParts = rlData.poles.map(p => Math.abs(p.re)).filter(v => v > 0.001);
        const currentTs = domPoles.length > 0
          ? 4 / Math.abs(domPoles[0].re)
          : (realParts.length > 0 ? 4 / Math.min(...realParts) : 4);

        const desired = computeDesiredPole(os, ts, ts ? 1 : ratio, currentTs);
        const sDes    = desired.desiredPole;

        
        const zc = zeroCStr ? parseFloat(zeroCStr) : null;
        const res = designLead(num, den, sDes, zc);
        setResult({ ...res, desired, currentTs });

      } else {
        const beta = parseFloat(betaStr);
        const pm   = parseFloat(pmTarget);
        if (isNaN(beta) || beta <= 1) { setErr('β > 1 olmalı.'); return; }
        const res = designLag(num, den, beta, pm);
        setResult(res);
      }
    } catch (e) {
      setErr('Hata: ' + e.message);
    }
  };

  const CanvasRL = ({ oltfNum, oltfDen }) => {
    const rlRes  = React.useMemo(() => {
      try { return computeRL(oltfNum, oltfDen, 200); } catch { return null; }
    }, [oltfNum?.join(','), oltfDen?.join(',')]);
    const ref = useCanvas(c => {
      c.width = c.clientWidth; c.height = c.clientHeight; drawRL(c, rlRes);
    }, [rlRes]);
    return <canvas ref={ref} style={{ width:'100%', height:220, border:'1px solid #21262d', borderRadius:6 }} />;
  };

  return (
    <div className="sol-wrap">

      {}
      <div style={{ display:'flex', gap:6, marginBottom:8 }}>
        {['lead','lag'].map(m => (
          <button key={m}
            style={{ flex:1, padding:'7px', borderRadius:5, cursor:'pointer', fontWeight:700, fontSize:12,
              background: mode===m ? '#1f3d5c' : '#1c2128',
              border: `1px solid ${mode===m ? '#58a6ff' : '#30363d'}`,
              color: mode===m ? '#58a6ff' : '#8b949e' }}
            onClick={() => { setMode(m); setResult(null); }}>
            {m === 'lead' ? '🔺 Lead Kontrolcü' : '🔻 Lag Kontrolcü'}
          </button>
        ))}
      </div>

      {}
      <StepCard number="📖" title={mode==='lead' ? 'Lead Kontrolcü Teorisi' : 'Lag Kontrolcü Teorisi'}>
        {mode === 'lead' ? (
          <>
            <p className="note" style={{color:'#e6edf3'}}>
              <b>Gc(s) = K·(s + zc) / (s + pc)</b> &nbsp;→&nbsp; pc &gt; zc (faz önceleyen)
            </p>
            <div className="row"><span className="lbl">Amaç</span><span className="val">Geçici durum iyileştirme — aşım ↓, yerleşme ↓</span></div>
            <div className="row"><span className="lbl">Etki</span><span className="val">İstenen kutbu kök yerine çeker (+faz katkısı)</span></div>
            <div className="row"><span className="lbl">Adım 1</span><span className="val b">OS% → ζ = −ln(OS/100) / √(π²+ln²)</span></div>
            <div className="row"><span className="lbl">Adım 2</span><span className="val b">ts → σ = 4/ts → s* = −σ ± jωd</span></div>
            <div className="row"><span className="lbl">Adım 3</span><span className="val b">∠G(s*) hesapla → açı eksikliği φ</span></div>
            <div className="row"><span className="lbl">Adım 4</span><span className="val b">zc seç → geometriden pc bul</span></div>
            <div className="row"><span className="lbl">Adım 5</span><span className="val b">|G(s*)·Gc(s*)| = 1 → K</span></div>
          </>
        ) : (
          <>
            <p className="note" style={{color:'#e6edf3'}}>
              <b>Gc(s) = (s + zc) / (s + pc)</b> &nbsp;→&nbsp; zc &gt; pc (faz geciktiren)
            </p>
            <div className="row"><span className="lbl">Amaç</span><span className="val">Kararlı durum hatası azaltma (β kat daha iyi)</span></div>
            <div className="row"><span className="lbl">Etki</span><span className="val">Düşük frekanslarda kazanç ↑, PM neredeyse sabit</span></div>
            <div className="row"><span className="lbl">β = zc/pc</span><span className="val b">Kazanç artışı faktörü</span></div>
            <div className="row"><span className="lbl">Kural</span><span className="val b">Lag sıfırunu ωgc/10'a yerleştir</span></div>
            <div className="row"><span className="lbl">PM korunur</span><span className="val b">Lag fazı &lt; 5° eklerse etki ihmal edilebilir</span></div>
          </>
        )}
      </StepCard>

      {/* Girişler */}
      <StepCard number="⚙" title="Tasarım Gereksinimleri">
        {mode === 'lead' ? (
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
            <div>
              <label>Yüzde Aşım OS (%)</label>
              <input type="text" value={osPercent} onChange={e=>setOsPercent(e.target.value)}
                placeholder="ör: 16" style={{width:'100%',background:'#0d1117',border:'1px solid #30363d',borderRadius:4,color:'#e6edf3',padding:'4px 8px',fontSize:12,fontFamily:'monospace'}}/>
            </div>
            <div>
              <label>Yerleşme Süresi ts (s) — veya</label>
              <input type="text" value={tsVal} onChange={e=>setTsVal(e.target.value)}
                placeholder="boş bırak → oran kullan" style={{width:'100%',background:'#0d1117',border:'1px solid #30363d',borderRadius:4,color:'#e6edf3',padding:'4px 8px',fontSize:12,fontFamily:'monospace'}}/>
            </div>
            <div>
              <label>ts İyileştirme Oranı (mevcut/hedef)</label>
              <input type="text" value={tsRatio} onChange={e=>setTsRatio(e.target.value)}
                placeholder="ör: 3  (3 kat hızlandır)" style={{width:'100%',background:'#0d1117',border:'1px solid #30363d',borderRadius:4,color:'#e6edf3',padding:'4px 8px',fontSize:12,fontFamily:'monospace'}}/>
            </div>
            <div>
              <label>Lead Sıfır zc (opsiyonel — otomatik)</label>
              <input type="text" value={zeroCStr} onChange={e=>setZeroCStr(e.target.value)}
                placeholder="boş = otomatik seç" style={{width:'100%',background:'#0d1117',border:'1px solid #30363d',borderRadius:4,color:'#e6edf3',padding:'4px 8px',fontSize:12,fontFamily:'monospace'}}/>
            </div>
          </div>
        ) : (
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
            <div>
              <label>Statik Kazanç Artışı β (β &gt; 1)</label>
              <input type="text" value={betaStr} onChange={e=>setBetaStr(e.target.value)}
                placeholder="ör: 10" style={{width:'100%',background:'#0d1117',border:'1px solid #30363d',borderRadius:4,color:'#e6edf3',padding:'4px 8px',fontSize:12,fontFamily:'monospace'}}/>
            </div>
            <div>
              <label>Hedef Faz Payı PM (°)</label>
              <input type="text" value={pmTarget} onChange={e=>setPmTarget(e.target.value)}
                placeholder="ör: 45" style={{width:'100%',background:'#0d1117',border:'1px solid #30363d',borderRadius:4,color:'#e6edf3',padding:'4px 8px',fontSize:12,fontFamily:'monospace'}}/>
            </div>
          </div>
        )}
        {err && <p style={{color:'#f85149',fontSize:11,marginTop:6}}>{err}</p>}
        <button className="btn" style={{marginTop:10}} onClick={run}>
          ▶ Kontrolcü Tasarla
        </button>
      </StepCard>

      {/* Sonuçlar */}
      {result && (
        <>
          <StepCard number="✓"
            title={result.feasible === false ? '⚠ Tasarım Sonucu (Geçersiz)' : 'Tasarım Sonucu'}>

            {result.type === 'lead' && result.desired && (
              <>
                {/* Tasarım gereksinimleri özeti */}
                <div className="formula">
                  OS = {osPercent}%
                  {' → '}ζ = {result.desired.zeta.toFixed(4)}
                  {' → '}θ = {result.desired.theta.toFixed(2)}°
                </div>
                <div className="formula">
                  s* = −{result.desired.sigma.toFixed(3)} ± j{result.desired.omegaD.toFixed(3)}
                  {result.currentTs > 0 && (
                    <span style={{color:'#8b949e'}}>
                      &nbsp;&nbsp;(mevcut ts≈{result.currentTs.toFixed(2)} s → hedef {result.desired.tsTarget.toFixed(2)} s)
                    </span>
                  )}
                </div>

                {/* Açı testi vurgusu */}
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, margin:'6px 0'}}>
                  <div className="margin-card">
                    <div className="ml">∠G(s*)</div>
                    <div className="mv" style={{color:'#d2a8ff', fontSize:13}}>
                      {result.angleDeg.toFixed(1)}°
                    </div>
                  </div>
                  <div className="margin-card">
                    <div className="ml">Açı Eksikliği φ</div>
                    <div className={`mv ${result.deficit > 80 ? 'ng' : 'ok'}`} style={{fontSize:13}}>
                      {result.deficit.toFixed(1)}°
                    </div>
                  </div>
                </div>

                {/* Hesaplama adımları */}
                {result.steps.map((s, i) => (
                  <div key={i} className="row">
                    <span className="lbl">Adım {i + 1}</span>
                    <span className="val"
                      style={{color: s.startsWith('⚠') ? '#f85149' : '#d2a8ff'}}>{s}</span>
                  </div>
                ))}

                {/* Gc(s) formülü */}
                {(() => {
                  const fmtFactor = v =>
                    `(s ${v >= 0 ? '+' : '−'} ${Math.abs(v).toFixed(3)})`;
                  return (
                    <div className="formula" style={{
                      marginTop: 8, fontSize: 12,
                      color: result.feasible === false ? '#f85149' : '#3fb950',
                    }}>
                      <b>
                        Gc(s) = {result.K.toFixed(3)} · {fmtFactor(result.zc)} / {fmtFactor(result.pc)}
                        {result.feasible === false && '  ← GEÇERSIZ'}
                      </b>
                    </div>
                  );
                })()}
              </>
            )}

            {result.type === 'lag' && (
              <>
                {result.steps.map((s, i) => (
                  <div key={i} className="row">
                    <span className="lbl">Adım {i + 1}</span>
                    <span className="val" style={{color:'#d2a8ff'}}>{s}</span>
                  </div>
                ))}
                <div className="formula" style={{marginTop:8, color:'#3fb950', fontSize:12}}>
                  <b>Gc(s) = (s + {result.zc.toFixed(4)}) / (s + {result.pc.toFixed(4)})</b>
                </div>
                <p className="note" style={{color:'#8b949e', marginTop:4}}>
                  β = {result.beta} → kararlı durum kazancı {result.beta}× arttı
                </p>
              </>
            )}

            {/* Uyarı kutusu */}
            {result.warning && (
              <div style={{
                background: result.feasible === false ? '#3d1a1a' : '#2a2410',
                border: `1px solid ${result.feasible === false ? '#f85149' : '#d29922'}`,
                borderRadius: 5, padding: '8px 12px', marginTop: 10,
                fontSize: 11, lineHeight: 1.6, fontFamily: 'monospace',
                color: result.feasible === false ? '#f85149' : '#d29922',
              }}>
                {result.warning}
                {result.feasible === false && (
                  <div style={{marginTop:6, color:'#8b949e'}}>
                    💡 Öneri: ts değerini büyütün, zc değerini değiştirin veya iki kademeli lead kullanın.
                  </div>
                )}
              </div>
            )}
          </StepCard>

          {/* Açık çevrim Gc·G kök yer eğrisi — sadece geçerli tasarımlarda */}
          {result.feasible !== false && (
            <StepCard number="📈" title="Gc(s)·G(s) — Yeni Açık Çevrim Kök Yer Eğrisi">
              <p className="note" style={{color:'#8b949e', marginBottom:6}}>
                Tasarlanmış kontrolcü sisteme uygulandıktan sonraki açık çevrim TF:
              </p>
              <div className="formula" style={{marginBottom:8}}>
                Gc(s)·G(s) = [{result.oltfNum.map(v => v.toFixed(3)).join(' ')}]
                &nbsp;/&nbsp;
                [{result.oltfDen.map(v => v.toFixed(3)).join(' ')}]
              </div>
              <CanvasRL oltfNum={result.oltfNum} oltfDen={result.oltfDen} />
            </StepCard>
          )}
        </>
      )}
    </div>
  );
}

/* ── Kök Yer Eğrisi canvas — zoom/pan destekli ── */

/**
 * Fare tekerleği ile yakınlaştırma, sürükle-bırak kaydırma,
 * çift tıklama ile otomatik görünüme dönme.
 *
 * @param {{ rlData, style: React.CSSProperties }} props
 */
function RLCanvas({ rlData, style }) {
  const canvasRef = useRef(null);
  const viewRef   = useRef(null);          // { xMin, xMax, yMin, yMax } | null (null → otomatik)
  const dragRef   = useRef(null);          // tek parmak/fare pan
  const ptrsRef   = useRef(new Map());     // pointerId → {x,y}  (pinch için)
  const pinchRef  = useRef(null);          // { dist, bounds, cx, cy }

  // ── Yeniden çizim (boyut henüz yoksa rAF ile yeniden dene) ──
  const redraw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    if (!c.clientWidth || !c.clientHeight) {
      requestAnimationFrame(() => {
        const cc = canvasRef.current;
        if (cc && cc.clientWidth && cc.clientHeight) {
          cc.width = cc.clientWidth; cc.height = cc.clientHeight;
          drawRL(cc, rlData, viewRef.current);
        }
      });
      return;
    }
    c.width  = c.clientWidth;
    c.height = c.clientHeight;
    drawRL(c, rlData, viewRef.current);
  }, [rlData]);

  // ResizeObserver — boyut değişince yeniden çiz
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const obs = new ResizeObserver(redraw);
    obs.observe(c);
    window.addEventListener('resize', redraw);
    redraw();
    return () => { obs.disconnect(); window.removeEventListener('resize', redraw); };
  }, [redraw]);

  // rlData değişince view sıfırla (yeni hesaplama = otomatik fit)
  useEffect(() => { viewRef.current = null; redraw(); }, [rlData, redraw]);

  const ensureView = () => {
    if (!viewRef.current && rlData)
      viewRef.current = computeRLBounds(canvasRef.current, rlData);
    return viewRef.current;
  };

  // Belirli bir data noktası sabit kalacak şekilde ölçekle
  const zoomAt = (mx, my, f) => {
    const b = ensureView(); if (!b) return;
    viewRef.current = {
      xMin: mx + (b.xMin - mx) * f, xMax: mx + (b.xMax - mx) * f,
      yMin: my + (b.yMin - my) * f, yMax: my + (b.yMax - my) * f,
    };
    redraw();
  };
  const zoomCenter = f => {
    const b = ensureView(); if (!b) return;
    zoomAt((b.xMin + b.xMax) / 2, (b.yMin + b.yMax) / 2, f);
  };
  const resetView = () => { viewRef.current = null; redraw(); };

  // Ekran pikselini data koordinatına çevir
  const pxToData = (clientX, clientY, b) => {
    const c = canvasRef.current, rect = c.getBoundingClientRect();
    const t = createTransform(c.width, c.height, CANVAS_PAD_RL, b.xMin, b.xMax, b.yMin, b.yMax);
    return {
      mx: t.fromX((clientX - rect.left) * c.width  / rect.width),
      my: t.fromY((clientY - rect.top)  * c.height / rect.height),
    };
  };

  // ── Fare tekerleği — zoom (passive:false olmalı) ──
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const onWheel = e => {
      e.preventDefault();
      if (!rlData) return;
      const b = ensureView(); if (!b) return;
      const { mx, my } = pxToData(e.clientX, e.clientY, b);
      zoomAt(mx, my, e.deltaY > 0 ? ZOOM_CONFIG.wheelOut : ZOOM_CONFIG.wheelIn);
    };
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => c.removeEventListener('wheel', onWheel);
  }, [rlData, redraw]);

  // ── Pointer olayları — tek parmak pan + iki parmak pinch zoom ──
  const onPointerDown = e => {
    if (!rlData) return;
    canvasRef.current.setPointerCapture?.(e.pointerId);
    ptrsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrsRef.current.size === 1) {
      ensureView();
      dragRef.current = { x: e.clientX, y: e.clientY, bounds: { ...viewRef.current } };
    } else if (ptrsRef.current.size === 2) {
      dragRef.current = null;
      const p = [...ptrsRef.current.values()];
      ensureView();
      pinchRef.current = {
        dist: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y),
        bounds: { ...viewRef.current },
        cx: (p[0].x + p[1].x) / 2, cy: (p[0].y + p[1].y) / 2,
      };
    }
  };
  const onPointerMove = e => {
    if (!ptrsRef.current.has(e.pointerId)) return;
    ptrsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const c = canvasRef.current;
    if (ptrsRef.current.size >= 2 && pinchRef.current) {
      const p = [...ptrsRef.current.values()];
      const dist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      const b = pinchRef.current.bounds;
      const f = pinchRef.current.dist / Math.max(dist, 1);
      const { mx, my } = pxToData(pinchRef.current.cx, pinchRef.current.cy, b);
      viewRef.current = {
        xMin: mx + (b.xMin - mx) * f, xMax: mx + (b.xMax - mx) * f,
        yMin: my + (b.yMin - my) * f, yMax: my + (b.yMax - my) * f,
      };
      redraw();
    } else if (dragRef.current) {
      const b  = dragRef.current.bounds;
      const dx = (e.clientX - dragRef.current.x) / c.clientWidth  * (b.xMax - b.xMin);
      const dy = (e.clientY - dragRef.current.y) / c.clientHeight * (b.yMax - b.yMin);
      viewRef.current = { xMin: b.xMin - dx, xMax: b.xMax - dx,
                          yMin: b.yMin + dy, yMax: b.yMax + dy };
      redraw();
    }
  };
  const onPointerUp = e => {
    ptrsRef.current.delete(e.pointerId);
    if (ptrsRef.current.size < 2) pinchRef.current = null;
    if (ptrsRef.current.size === 0) dragRef.current = null;
  };

  const btn = {
    width: 32, height: 32, border: '1px solid #30363d', borderRadius: 6,
    background: 'rgba(22,27,34,.93)', color: '#e6edf3', fontSize: 17,
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', userSelect: 'none', lineHeight: 1, padding: 0,
  };

  return (
    <div style={{ position: 'relative', ...style }}>
      <canvas ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block',
                 touchAction: 'none', cursor: 'crosshair', borderRadius: 'inherit' }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onPointerLeave={onPointerUp}
        onDoubleClick={resetView} />
      <div style={{ position: 'absolute', right: 8, bottom: 8,
                    display: 'flex', flexDirection: 'column', gap: 5 }}>
        <button style={btn} onClick={() => zoomCenter(ZOOM_CONFIG.inFactor)}  title="Yakınlaştır">＋</button>
        <button style={btn} onClick={() => zoomCenter(ZOOM_CONFIG.outFactor)} title="Uzaklaştır">－</button>
        <button style={{ ...btn, fontSize: 14 }} onClick={resetView} title="Sıfırla">⟲</button>
      </div>
    </div>
  );
}

/* ── Önemli noktalar özet kartı ── */

/**
 * Kök yer eğrisi çözümünün kritik büyüklüklerini belirgin liste olarak gösterir.
 * @param {{ rlData }} props
 */
function KeyPointsCard({ rlData }) {
  if (!rlData) return null;
  const { poles, zeros, nA, sigmaA, anglesA, critK, breakPoints,
          departures = [], arrivals = [], jwCross = [] } = rlData;
  const kalkis = breakPoints.filter(b => b.type !== 'breakin');
  const varis  = breakPoints.filter(b => b.type === 'breakin');

  const Row = ({ label, value, color }) => (
    <div className="row">
      <span className="lbl">{label}</span>
      <span className="val" style={color ? { color } : undefined}>{value}</span>
    </div>
  );

  return (
    <div className="sol-card" style={{ borderColor: '#1f6feb' }}>
      <div className="sol-head" style={{ background: '#132238' }}>
        <div className="sol-num" style={{ background: '#3fb950' }}>★</div>
        Önemli Noktalar — Özet
      </div>
      <div className="sol-body">
        <Row label="Kutup sayısı (n)" value={poles.length} color="#f85149" />
        <Row label="Sıfır sayısı (m)" value={zeros.length} color="#3fb950" />
        <Row label="Asimptot sayısı (n−m)" value={nA} color="#d29922" />
        {sigmaA !== null &&
          <Row label="Asimptot merkezi σₐ" value={sigmaA.toFixed(3)} color="#58a6ff" />}
        {anglesA.length > 0 &&
          <Row label="Asimptot açıları" value={anglesA.map(a => a.toFixed(0) + '°').join(', ')} color="#d29922" />}
        <Row label="Kalkış noktası (breakaway)"
          value={kalkis.length ? kalkis.map(b => `σ=${b.s.toFixed(3)}  (K=${b.K.toFixed(3)})`).join('   |   ') : '— yok'}
          color="#3fb950" />
        <Row label="Varış noktası (break-in)"
          value={varis.length ? varis.map(b => `σ=${b.s.toFixed(3)}  (K=${b.K.toFixed(3)})`).join('   |   ') : '— yok'}
          color="#ff7b72" />
        <Row label="jω eksen kesişimi"
          value={jwCross.length ? jwCross.map(c => `±j${c.w.toFixed(3)}  (K=${c.K.toFixed(2)})`).join('   |   ') : '— yok'}
          color="#d2a8ff" />
        <Row label="Kritik K (kararlılık sınırı)"
          value={critK !== null ? critK.toFixed(3) : 'tüm K > 0 kararlı'}
          color={critK !== null ? '#f85149' : '#3fb950'} />
        {departures.length > 0 &&
          <Row label="Kalkış açısı (karmaşık kutup)" value={departures.map(d => d.angle.toFixed(1) + '°').join(', ')} color="#f85149" />}
        {arrivals.length > 0 &&
          <Row label="Varış açısı (karmaşık sıfır)" value={arrivals.map(a => a.angle.toFixed(1) + '°').join(', ')} color="#3fb950" />}
      </div>
    </div>
  );
}

/* ── Logaritmik kağıt asimptotik Bode görünümü ── */

/**
 * Her çarpanı ayrı düz çizgi olarak logaritmik kağıda çizer + grafiksel toplam.
 * @param {{ numStr: string, denStr: string }} props
 */
function SemilogBodeView({ numStr, denStr, active }) {
  const [showFactors, setShowFactors] = useState(true);

  const data = useMemo(() => {
    const num = parseSystemInput(numStr), den = parseSystemInput(denStr);
    if (!num || !den) return null;
    try { return computeBodeFactors(num, den); } catch { return null; }
  }, [numStr, denStr]);

  const magRef = useCanvas(c => {
    c.width = c.clientWidth; c.height = c.clientHeight;
    drawSemilogBode(c, data, 'mag', showFactors);
  }, [data, showFactors, active]);
  const phRef = useCanvas(c => {
    c.width = c.clientWidth; c.height = c.clientHeight;
    drawSemilogBode(c, data, 'phase', showFactors);
  }, [data, showFactors, active]);

  if (!data)
    return <div style={{ padding: 20, color: '#484f58' }}>Geçerli transfer fonksiyonu girin.</div>;

  const kindName = {
    gain: 'Sabit kazanç', integ: 'İntegratör 1/sⁿ', diff: 'Diferansiyatör sⁿ',
    realZero: 'Reel sıfır (+20)', realPole: 'Reel kutup (−20)',
    cplxZero: 'Karmaşık sıfır (+40)', cplxPole: 'Karmaşık kutup (−40)',
  };
  const solidKinds = ['gain', 'integ', 'diff'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6 }}>
      <div className="bode-info" style={{ margin: 0 }}>
        <div className="icon">📐</div>
        <div>
          <b style={{ color: '#e6edf3' }}>Logaritmik Kağıt — Asimptotik Bode</b>
          <span style={{ color: '#8b949e', marginLeft: 6 }}>
            Her çarpan ayrı renkli düz çizgi (kesik), <b style={{ color: '#e6edf3' }}>kalın beyaz = grafiksel toplam</b>.
            Elle, dereceli kağıda çizimin birebir karşılığı.
          </span>
        </div>
        <button className={`btn-toggle${showFactors ? ' on' : ''}`} onClick={() => setShowFactors(v => !v)}>
          {showFactors ? '✓' : '○'} Çarpanlar
        </button>
      </div>

      <div className="formula" style={{ margin: 0, fontSize: 11, lineHeight: 1.7, wordBreak: 'break-word' }}>
        20·log|G(jω)| = {data.formula}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 10 }}>
        {data.factors.map((f, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#8b949e' }}>
            <span style={{ width: 16, height: 0,
              borderTop: `2px ${solidKinds.includes(f.kind) ? 'solid' : 'dashed'} ${f.color}`,
              display: 'inline-block' }} />
            {kindName[f.kind] || f.kind}{f.corner ? ` @${f.corner.toFixed(2)}` : ''}
          </span>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#e6edf3' }}>
          <span style={{ width: 16, height: 0, borderTop: '3px solid #e6edf3', display: 'inline-block' }} /> Toplam
        </span>
      </div>

      <canvas ref={magRef} style={{ flex: 1, minHeight: 180, border: '1px solid #21262d', borderRadius: 6 }} />
      <canvas ref={phRef}  style={{ flex: 1, minHeight: 180, border: '1px solid #21262d', borderRadius: 6 }} />
    </div>
  );
}

/* ── Test sekmesi — çarpanlı giriş ile otomatik çözüm ── */

/**
 * Kullanıcı transfer fonksiyonunu çarpanlı haliyle girer
 * (ör. payda: s(s+4)(s^2+4s+5)); katsayılar otomatik açılır ve
 * tüm kök yer eğrisi adımları + %aşım ζ doğrusu hesaplanır.
 * @param {{ onLoad: (numStr:string, denStr:string)=>void }} props
 */
function TestSolver({ onLoad }) {
  const [numF,      setNumF]      = useState('s+3');
  const [denF,      setDenF]      = useState('s(s+4)(s^2+4s+5)');
  const [osPercent, setOsPercent] = useState('20');
  const [result,    setResult]    = useState(null);
  const [err,       setErr]       = useState('');

  const solve = () => {
    const num = parseSystemInput(numF);
    const den = parseSystemInput(denF);
    if (!num || !den) {
      setErr('Çarpanlar çözümlenemedi. Örnek payda: s(s+4)(s^2+4s+5)');
      setResult(null); return;
    }
    if (num.length > den.length) {
      setErr('Pay derecesi paydadan büyük olamaz.'); setResult(null); return;
    }
    try {
      setErr('');
      const rl   = computeRL(num, den, 200);
      const bode = computeBode(num, den);
      const os   = parseFloat(osPercent);
      let zeta = null, phi = null, lineAngle = null;
      let ops = [], primary = null, clPoles = null;
      if (isFinite(os) && os > 0 && os < 100) {
        const ln = Math.log(os / 100);
        zeta      = -ln / Math.sqrt(Math.PI * Math.PI + ln * ln);
        phi       = Math.acos(zeta) * 180 / Math.PI;
        lineAngle = 180 - phi;

        // ζ doğrusu ∩ kök yer eğrisi → çalışma noktası ve K
        ops = findOperatingPoints(num, den, zeta);
        if (ops.length) {
          primary = ops[0];
          clPoles = polyRoots(polyAdd(den, polyScale(num, primary.K)));
        }
      }
      setResult({ num, den, rl, bode, zeta, phi, lineAngle, os, ops, primary, clPoles });
    } catch (e) {
      setErr('Hata: ' + e.message); setResult(null);
    }
  };

  const numStr    = result ? result.num.join(' ') : '';
  const denStr    = result ? result.den.join(' ') : '';
  const rlForPlot = result
    ? {
        ...result.rl,
        ...(result.zeta != null ? { zetaLine: { zeta: result.zeta } } : {}),
        ...(result.primary ? { operatingPoints: [result.primary] } : {}),
      }
    : null;

  const inputStyle = {
    width: '100%', background: '#0d1117', border: '1px solid #30363d',
    borderRadius: 5, color: '#e6edf3', padding: '7px 10px',
    fontSize: 13, fontFamily: 'monospace',
  };

  const examples = [
    ['s+3', 's(s+4)(s^2+4s+5)', '20'],
    ['1',   's(s+1)(s+2)',      '16'],
    ['s+2', '(s+1)(s^2+2s+3)',  '10'],
  ];

  return (
    <div className="sol-wrap">
      <StepCard number="🧪" title="Test — Çarpanlı Giriş ile Otomatik Çözüm">
        <p className="note" style={{ color: '#e6edf3', marginBottom: 8 }}>
          Katsayıları elle açmana gerek yok. Sistemi <b>çarpanlı haliyle</b> yaz
          (ör. <code style={{ color: '#d2a8ff' }}>s(s+4)(s^2+4s+5)</code>), site
          katsayıları açıp tüm kök yer eğrisi adımlarını çözsün.
        </p>

        <div style={{ marginBottom: 8 }}>
          <label>Pay — çarpanlı veya katsayı</label>
          <input type="text" value={numF} onChange={e => setNumF(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && solve()} placeholder="ör: s+3" style={inputStyle} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>Payda — çarpanlı veya katsayı</label>
          <input type="text" value={denF} onChange={e => setDenF(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && solve()} placeholder="ör: s(s+4)(s^2+4s+5)" style={inputStyle} />
        </div>
        <div style={{ marginBottom: 8, maxWidth: 220 }}>
          <label>% Aşım — ζ doğrusu için (opsiyonel)</label>
          <input type="text" value={osPercent} onChange={e => setOsPercent(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && solve()} placeholder="ör: 20" style={inputStyle} />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '6px 0' }}>
          {examples.map((ex, i) => (
            <button key={i} className="btn-sm"
              onClick={() => { setNumF(ex[0]); setDenF(ex[1]); setOsPercent(ex[2]); }}>
              Örnek {i + 1}: {ex[0]} ⁄ {ex[1]}
            </button>
          ))}
        </div>

        {err && <p style={{ color: '#f85149', fontSize: 11, marginTop: 6 }}>{err}</p>}
        <button className="btn" style={{ marginTop: 6 }} onClick={solve}>▶ Çöz</button>
      </StepCard>

      {result && (
        <>
          <StepCard number="≡" title="Genişletilmiş Katsayılar (siteye girilecek hali)">
            <div className="formula">Pay&nbsp;&nbsp; = [{result.num.join(', ')}]</div>
            <div className="formula">Payda = [{result.den.join(', ')}]</div>
            <p className="note">→ Çarpanlı giriş otomatik açıldı. İstersen diğer sekmelerde de kullan:</p>
            <button className="btn" style={{ marginTop: 4, background: '#1f6feb' }}
              onClick={() => onLoad(numStr, denStr)}>
              ↥ Bu sistemi tüm sekmelere yükle (Kök Yer Eğrisi · Bode · Kontrolcü)
            </button>
          </StepCard>

          <StepCard number="📈" title="Kök Yer Eğrisi + ζ Doğrusu">
            <RLCanvas rlData={rlForPlot}
              style={{ width: '100%', height: 320, border: '1px solid #21262d', borderRadius: 6 }} />
            {result.zeta != null && (
              <p className="note" style={{ marginTop: 6 }}>
                <span style={{ color: '#58a6ff' }}>Mavi kesik çizgi</span>: %{result.os} aşım için
                ζ = {result.zeta.toFixed(3)} doğrusu (pozitif reel eksenden {result.lineAngle.toFixed(2)}°).
                {result.primary
                  ? <> <span style={{ color: '#ff7bdc' }}>Pembe elmas</span>: çalışma noktası
                      (ζ doğrusu ∩ eğri), orada K = {result.primary.K.toFixed(3)}.</>
                  : ' (Bu sistemde ζ doğrusu eğriyi kesmiyor — bu %aşım elde edilemiyor.)'}
              </p>
            )}
          </StepCard>

          {result.zeta != null && (
            <StepCard number="ζ" title={`%${result.os} Aşım → Sönüm Oranı ve Açı`}>
              <div className="formula">ζ = −ln(OS/100) / √(π² + ln²(OS/100))</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, margin: '6px 0' }}>
                <div className="margin-card">
                  <div className="ml">Sönüm Oranı ζ</div>
                  <div className="mv ok" style={{ fontSize: 14 }}>{result.zeta.toFixed(4)}</div>
                </div>
                <div className="margin-card">
                  <div className="ml">Açı φ = cos⁻¹ζ</div>
                  <div className="mv" style={{ fontSize: 14, color: '#58a6ff' }}>{result.phi.toFixed(2)}°</div>
                </div>
              </div>
              <div className="row"><span className="lbl">Negatif reel eksenden</span><span className="val">{result.phi.toFixed(2)}°</span></div>
              <div className="row"><span className="lbl">Pozitif reel eksenden (üst ζ doğrusu)</span><span className="val b">{result.lineAngle.toFixed(2)}°</span></div>
              <div className="row"><span className="lbl">Pozitif reel eksenden (alt ζ doğrusu)</span><span className="val b">{(360 - result.lineAngle).toFixed(2)}°</span></div>
            </StepCard>
          )}

          {result.zeta != null && (
            <StepCard number="🎯" title="Çalışma Noktası — Nasıl Bulunur?">
              <p className="note" style={{ color: '#e6edf3', marginBottom: 6 }}>
                ζ doğrusu <b>sabit sönüm = sabit %aşım</b> demektir. <b>Çalışma noktası</b>,
                bu doğrunun kök yer eğrisini kestiği noktadır = istenen <b>baskın kapalı çevrim kutbu</b>.
              </p>
              <div className="row"><span className="lbl">1. Adım — Açı koşulu</span>
                <span className="val">ζ doğrusu boyunca ∠G(s) = ±180° olan s* aranır</span></div>
              <div className="row"><span className="lbl">2. Adım — Genlik koşulu</span>
                <span className="val b">K = 1 / |G(s*)|</span></div>

              {result.primary ? (
                <>
                  <div className="formula" style={{ marginTop: 8, color: '#ff7bdc' }}>
                    s* = {fmtC(result.primary.s, 3)}
                    &nbsp;&nbsp;→&nbsp;&nbsp; K = {result.primary.K.toFixed(4)}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, margin: '6px 0' }}>
                    <div className="margin-card">
                      <div className="ml">Çalışma noktası s*</div>
                      <div className="mv" style={{ fontSize: 13, color: '#ff7bdc' }}>{fmtC(result.primary.s, 3)}</div>
                    </div>
                    <div className="margin-card">
                      <div className="ml">Kazanç K</div>
                      <div className="mv ok" style={{ fontSize: 14 }}>{result.primary.K.toFixed(3)}</div>
                    </div>
                  </div>

                  <p className="note" style={{ color: '#e6edf3', marginTop: 6, marginBottom: 2 }}>
                    Bu K'da kapalı çevrim kutupları (den + K·pay = 0 kökleri):
                  </p>
                  {(result.clPoles || []).map((p, i) => {
                    const dominant = Math.abs(p.re - result.primary.s.re) < 0.05 &&
                                     Math.abs(Math.abs(p.im) - Math.abs(result.primary.s.im)) < 0.05;
                    return (
                      <div key={i} className="row">
                        <span className="lbl">Kutup {i + 1}</span>
                        <span className="val" style={{ color: dominant ? '#ff7bdc' : '#8b949e' }}>
                          {fmtC(p, 3)}{dominant ? '  ← baskın (çalışma noktası)' : ''}
                        </span>
                      </div>
                    );
                  })}
                  {result.ops.length > 1 && (
                    <p className="note" style={{ marginTop: 4 }}>
                      Not: ζ doğrusu eğriyi {result.ops.length} yerde kesiyor; en baskın (orijine en yakın)
                      olan çalışma noktası alındı. Diğer K değerleri:{' '}
                      {result.ops.slice(1).map(o => o.K.toFixed(2)).join(', ')}.
                    </p>
                  )}
                </>
              ) : (
                <p className="note warn" style={{ marginTop: 6 }}>
                  ζ = {result.zeta.toFixed(3)} doğrusu bu sistemin kök yer eğrisini kesmiyor.
                  Yani sadece oransal (K) kontrol ile %{result.os} aşım elde edilemez —
                  Lead/PD gibi bir kontrolcü gerekir (Kontrolcü Tasarımı sekmesi).
                </p>
              )}
            </StepCard>
          )}

          <StepSolution rlData={result.rl} bodeData={result.bode}
            numStr={numStr} denStr={denStr} />
        </>
      )}
    </div>
  );
}

/* ── Ana uygulama ── */

function App() {
  const [numStr,   setNumStr]   = useState('1');
  const [denStr,   setDenStr]   = useState('1 3 2 0');
  const [kMax,     setKMax]     = useState(100);
  const [tab,      setTab]      = useState('rl');
  const [showAsym, setShowAsym] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobil drawer
  // Kontrolcü tasarımı için 2. numStr/denStr yok — paylaşılır

  const { rlData, bodeData, asymData, error, compute } =
    useTransferFunction(numStr, denStr, kMax);

  // Hesapla + mobilde drawer'ı kapat
  const computeAndClose = useCallback(() => { compute(); setSidebarOpen(false); }, [compute]);

  // Test sekmesinden gelen sistemi tüm sekmelere yükle ve hesapla
  const [pendingCompute, setPendingCompute] = useState(false);
  useEffect(() => {
    if (pendingCompute) { compute(); setPendingCompute(false); }
  }, [pendingCompute, compute]);

  const loadSystem = useCallback((n, d) => {
    setNumStr(n); setDenStr(d); setPendingCompute(true);
    setTab('rl'); setSidebarOpen(false);
  }, []);


  useEffect(() => { compute(); }, []);

  
  const magRef = useCanvas(c => {
    c.width = c.clientWidth; c.height = c.clientHeight;
    if (!bodeData) return;
    drawBodePanel(c, bodeData.freqs, bodeData.mags, asymData?.asymMags, showAsym, {
      title:       'Genlik (Magnitude) — tam çizgi: gerçek | sarı kesik: asimptotik',
      yLabel:      'Genlik (dB)',
      color:       '#58a6ff',
      ref:          0,
      refLabel:    '0 dB',
      markerW:      bodeData.PMw,
      markerColor: '#3fb950',
      markerLabel:  bodeData.PM != null ? 'PM=' + bodeData.PM.toFixed(1) + '°' : '',
    });
  }, [bodeData, asymData, showAsym, tab]);

  const phRef  = useCanvas(c => {
    c.width = c.clientWidth; c.height = c.clientHeight;
    if (!bodeData) return;
    drawBodePanel(c, bodeData.freqs, bodeData.phases, asymData?.asymPhases, showAsym, {
      title:       'Faz (Phase) — tam çizgi: gerçek | sarı kesik: asimptotik',
      yLabel:      'Faz (°)',
      color:       '#ffa657',
      ref:         -180,
      refLabel:    '-180°',
      markerW:      bodeData.GMw,
      markerColor: '#f85149',
      markerLabel:  bodeData.GM != null ? 'GM=' + bodeData.GM.toFixed(1) + 'dB' : '',
    });
  }, [bodeData, asymData, showAsym, tab]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {}
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="menu-btn" onClick={() => setSidebarOpen(v => !v)}
            aria-label="Menü">☰</button>
          <h1>⬡ Otomatik Kontrol Analizi</h1>
        </div>
        <div className="sub" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href="otokontrol_offline.html" target="_blank" rel="noopener"
            title="Çevrimdışı yedek sürüm — internet/CDN gerektirmez, her zaman açılır. Yeni sürümde bir sorun olursa buradan kontrol edebilirsin."
            style={{
              color: '#8b949e', textDecoration: 'none', fontSize: 11,
              border: '1px solid #30363d', borderRadius: 5, padding: '3px 8px',
              whiteSpace: 'nowrap',
            }}>
            ⤓ Yedek sürüm
          </a>
          <span>220705128 — Furkan USTA &nbsp;·&nbsp; <span style={{ color: '#3fb950' }}>v2.4</span></span>
        </div>
      </div>

      <div className="layout">
        {}
        {sidebarOpen && <div className="backdrop" onClick={() => setSidebarOpen(false)} />}

        {}
        <Sidebar
          open={sidebarOpen}
          numStr={numStr} denStr={denStr}
          setNumStr={setNumStr} setDenStr={setDenStr}
          kMax={kMax} setKMax={setKMax}
          error={error} rlData={rlData} bodeData={bodeData}
          onCompute={computeAndClose}
        />

        {}
        <div className="main">
          {}
          <div className="tabs">
            <div className={`tab${tab === 'rl'   ? ' active' : ''}`} onClick={() => setTab('rl')}>
              Kök Yer Eğrisi
            </div>
            <div className={`tab${tab === 'bode' ? ' active' : ''}`} onClick={() => setTab('bode')}>
              Bode Diyagramı
            </div>
            <div className={`tab${tab === 'logbode' ? ' active' : ''}`} onClick={() => setTab('logbode')}>
              Log Kağıt Bode
            </div>
            <div className={`tab${tab === 'sol'  ? ' active' : ''}`} onClick={() => setTab('sol')}>
              Adım Adım Çözüm
            </div>
            <div className={`tab${tab === 'ctrl' ? ' active' : ''}`} onClick={() => setTab('ctrl')}
              style={{ color: tab === 'ctrl' ? '#3fb950' : undefined,
                       borderBottomColor: tab === 'ctrl' ? '#3fb950' : undefined }}>
              Kontrolcü Tasarımı
            </div>
            <div className={`tab${tab === 'test' ? ' active' : ''}`} onClick={() => setTab('test')}
              style={{ color: tab === 'test' ? '#d2a8ff' : undefined,
                       borderBottomColor: tab === 'test' ? '#d2a8ff' : undefined }}>
              🧪 Test
            </div>
          </div>

          {}
          <div className="plot-area" style={{ display: tab === 'rl' ? 'flex' : 'none', flexDirection: 'column' }}>
            <RLCanvas rlData={rlData}
              style={{ flex: 1, border: '1px solid #21262d', borderRadius: 6 }} />
            <div style={{ fontSize: 10, color: '#484f58', textAlign: 'center',
                          padding: '3px 0', flexShrink: 0 }}>
              🖱 Tekerlek / ＋－ buton: zoom &nbsp;|&nbsp; Sürükle: kaydır &nbsp;|&nbsp;
              İki parmak: pinch zoom &nbsp;|&nbsp; ⟲ / çift tık: sıfırla
            </div>
          </div>

          {}
          <div className="plot-area" style={{ display: tab === 'bode' ? 'flex' : 'none' }}>
            <div className="bode-row">
              <div className="bode-info" style={{ flex: 1, margin: 0 }}>
                <div className="icon">📊</div>
                <div>
                  <b style={{ color: '#e6edf3' }}>Bode Diyagramı = 2 Grafik</b>
                  <span style={{ color: '#8b949e', marginLeft: 6 }}>
                    Üst: Genlik (dB) &nbsp;|&nbsp; Alt: Faz (°) &nbsp;—&nbsp;
                    Bu standarttır, elle çizerken de 2 ayrı eksen çizilir.
                    Elle çizerken{' '}
                    <b style={{ color: '#d29922' }}>köşe frekanslarında kırılan düz çizgiler</b>
                    {' '}(asimptot) kullanılır.
                  </span>
                </div>
              </div>
              <button
                className={`btn-toggle${showAsym ? ' on' : ''}`}
                onClick={() => setShowAsym(v => !v)}>
                {showAsym ? '✓' : '○'} Asimptotik (El Çizimi)
              </button>
            </div>
            <canvas ref={magRef} style={{ flex: 1, border: '1px solid #21262d', borderRadius: 6 }} />
            <canvas ref={phRef}  style={{ flex: 1, border: '1px solid #21262d', borderRadius: 6 }} />
          </div>

          {}
          <div className="plot-area" style={{ display: tab === 'logbode' ? 'flex' : 'none' }}>
            <SemilogBodeView numStr={numStr} denStr={denStr} active={tab === 'logbode'} />
          </div>

          {}
          <div className="plot-area" style={{ display: tab === 'sol' ? 'flex' : 'none' }}>
            <StepSolution rlData={rlData} bodeData={bodeData}
              numStr={numStr} denStr={denStr} />
          </div>

          {}
          <div className="plot-area" style={{ display: tab === 'ctrl' ? 'flex' : 'none' }}>
            <ControllerDesign numStr={numStr} denStr={denStr} rlData={rlData} />
          </div>

          {}
          <div className="plot-area" style={{ display: tab === 'test' ? 'flex' : 'none' }}>
            <TestSolver onLoad={loadSystem} />
          </div>

        </div>
      </div>
    </div>
  );
}
