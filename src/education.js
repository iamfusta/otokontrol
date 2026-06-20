const PRESETS = [
  {
    label:    'K / [s(s+1)(s+2)]',
    num:      '1',
    den:      '1 3 2 0',
    desc:     'Temel örnek — 3 kutup, 0 sıfır, 3 asimptot',
    concepts: ['breakaway', 'asimptot', 'kritik-k'],
  },
  {
    label:    'K(s+3) / [s(s+1)(s+2)(s+4)]',
    num:      '1 3',
    den:      '1 7 14 8 0',
    desc:     '4 kutup 1 sıfır — σₐ≈−1.33, açılar: 60°/180°/300°',
    concepts: ['asimptot', 'breakaway', 'reel-eksen'],
  },
  {
    label:    'K(s²−4s+20) / [(s+2)(s+4)]',
    num:      '1 -4 20',
    den:      '1 6 8',
    desc:     'RHP sıfırları olan sistem — fazdan önce yükselen genlik',
    concepts: ['rhp-sifir', 'non-minimum-phase'],
  },
  {
    label:    'K(s+3)(s+5) / [(s²+2s+4)(s²+4s+8)s]',
    num:      '1 8 15',
    den:      '1 6 20 32 0',
    desc:     '4 kutup 2 sıfır, karmaşık kutuplar, orijin kutbu',
    concepts: ['karmasik-kutup', 'asimptot', 'breakaway'],
  },
  {
    label:    'K(s+8) / [(s²+4s+8)(s+3)(s+5)]',
    num:      '1 8',
    den:      '1 12 55 124 120',
    desc:     'Vize 5 — Lead/PD kontrolcü tasarım örneği',
    concepts: ['lead-kontrolcu', 'faz-payi', 'kazanc-payi'],
  },
  {
    label:    'K / [s²(s+4)]',
    num:      '1',
    den:      '1 4 0 0',
    desc:     'Çift orijin kutbu — karmaşık kalkış açısı',
    concepts: ['cift-orijin', 'asimptot', 'stabilite'],
  },
  {
    label:    'K / [(s²+2s+2)(s+2)]',
    num:      '1',
    den:      '1 4 6 4',
    desc:     'Karmaşık kutuplu 2. mertebe alt sistem',
    concepts: ['karmasik-kutup', 'sonimleme'],
  },
  {
    label:    'K(s²+4s+8) / [s(s+1)(s+2)(s+4)]',
    num:      '1 4 8',
    den:      '1 7 14 8 0',
    desc:     'Karmaşık sıfırlı sistem (Lead ağı senaryosu)',
    concepts: ['karmasik-sifir', 'lead-ag', 'bode'],
  },
];

const GLOSSARY = {
  'Kök Yer Eğrisi':
    'Açık çevrim kazancı K değiştikçe kapalı çevrim kutuplarının s-düzleminde izlediği yol.',
  'Asimptot':
    'K→∞ iken dalların yaklaştığı sanal çizgiler. Merkezi σₐ, açıları (2k+1)·180°/(n−m).',
  'Breakaway':
    'İki reel kutubun birleşip karmaşık düzleme geçtiği nokta. dK/ds = 0 ile bulunur.',
  'Faz Payı (PM)':
    'Kazanç 0 dB iken fazın −180°\'ye olan uzaklığı. PM > 0° → kararlı.',
  'Kazanç Payı (GM)':
    'Faz −180° iken genliğin 0 dB\'e olan uzaklığı (dB). GM > 0 → kararlı.',
  'Routh-Hurwitz':
    'Karakteristik polinom katsayılarından kararlılığı belirleyen cebirsel kriter.',
  'RHP Sıfır':
    'Sağ yarı düzlemdeki sıfırlar. Non-minimum faz sistemi oluşturur, Bode\'de genlik ve faz tutarsız davranır.',
  'Bode Diyagramı':
    'Açık çevrim frekans cevabını iki grafikte gösterir: Genlik (dB) ve Faz (°).',
  'Asimptotik Bode':
    'Elle çizim için köşe frekanslarında kırılan düz çizgi yaklaşımı. ±20/40 dB/dekad eğimler.',
};
