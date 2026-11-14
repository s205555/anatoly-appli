// Codes lisibles par un lecteur : QR (octets, correction M, versions 1 à 10), Code 128 (jeux B et C), EAN-13 et Code 39. Sans dépendance.
// shortcut: QR limité à 213 octets et Code 128 à l'ASCII imprimable ; suffisant pour un numéro de membre, à étendre sinon.

// ===== Code 128 =====
const MOTIFS = '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112'.split(' ');

/** Largeurs alternées barre/espace (en modules) du Code 128 de `texte`, ou null si non codable. */
export function code128(texte) {
  const t = String(texte);
  if (!t || !/^[\x20-\x7e]+$/.test(t)) return null;
  const codes = [];
  if (/^\d+$/.test(t) && t.length % 2 === 0) { // jeu C : deux chiffres par symbole
    codes.push(105);
    for (let i = 0; i < t.length; i += 2) codes.push(Number(t.slice(i, i + 2)));
  } else {
    codes.push(104);
    for (const c of t) codes.push(c.charCodeAt(0) - 32);
  }
  let somme = codes[0];
  for (let i = 1; i < codes.length; i += 1) somme += codes[i] * i;
  codes.push(somme % 103, 106);
  return codes.flatMap((c) => [...MOTIFS[c]].map(Number));
}

// ===== EAN-13 =====
const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const EAN_R = EAN_L.map((m) => [...m].map((b) => (b === '0' ? '1' : '0')).join(''));
const EAN_G = EAN_R.map((m) => [...m].reverse().join(''));
const EAN_PARITE = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
const cleEan = (douze) => (10 - ([...douze].reduce((s, c, i) => s + Number(c) * (i % 2 ? 3 : 1), 0) % 10)) % 10;
// Suite de modules (1 = noir) en largeurs alternées barre/espace, comme code128().
const largeurs = (bits) => bits.match(/1+|0+/g).map((r) => r.length);

/** Largeurs de l'EAN-13 : 12 chiffres (clé ajoutée) ou 13 avec la bonne clé, sinon null. */
export function ean13(texte) {
  const t = String(texte);
  if (!/^\d{12,13}$/.test(t)) return null;
  const n = t.slice(0, 12) + cleEan(t.slice(0, 12));
  if (t.length === 13 && t !== n) return null;
  const parite = EAN_PARITE[Number(n[0])];
  let bits = '101';
  for (let i = 1; i <= 6; i += 1) bits += (parite[i - 1] === 'L' ? EAN_L : EAN_G)[Number(n[i])];
  bits += '01010';
  for (let i = 7; i <= 12; i += 1) bits += EAN_R[Number(n[i])];
  return largeurs(bits + '101');
}

// ===== Code 39 =====
// Neuf éléments par caractère (barre, espace, ...), 1 = large ; large = 2 modules comme le paquet barcode de l'original.
const C39_JEU = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. *$/+%';
const C39 = '000110100 100100001 001100001 101100000 000110001 100110000 001110000 000100101 100100100 001100100 100001001 001001001 101001000 000011001 100011000 001011000 000001101 100001100 001001100 000011100 100000011 001000011 101000010 000010011 100010010 001010010 000000111 100000110 001000110 000010110 110000001 011000001 111000000 010010001 110010000 011010000 010000101 110000100 011000100 010010100 010101000 010100010 010001010 000101010'.split(' ');

/** Largeurs du Code 39 (sans clé, encadré de *), ou null si un caractère n'est pas codable. Minuscules lues en capitales. */
export function code39(texte) {
  const t = String(texte).toUpperCase();
  if (!t || [...t].some((c) => c === '*' || !C39_JEU.includes(c))) return null;
  const w = [];
  [...`*${t}*`].forEach((c, i) => {
    if (i) w.push(1); // espace étroit entre deux caractères
    w.push(...[...C39[C39_JEU.indexOf(c)]].map((b) => (b === '1' ? 2 : 1)));
  });
  return w;
}

// ===== QR =====
const ECC_PAR_BLOC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const NB_BLOCS = [0, 1, 1, 2, 2, 4, 4, 4, 4, 5, 5];

const modulesBruts = (v) => {
  let r = (16 * v + 128) * v + 64;
  if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
  return r;
};
const positionsAlignement = (v) => {
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2, taille = v * 4 + 17;
  const pas = Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
  const r = [6];
  for (let p = taille - 7; r.length < n; p -= pas) r.splice(1, 0, p);
  return r;
};

const mulGf = (x, y) => { let z = 0; for (let i = 7; i >= 0; i -= 1) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; };
const diviseur = (deg) => {
  const r = new Array(deg).fill(0); r[deg - 1] = 1;
  let racine = 1;
  for (let i = 0; i < deg; i += 1) {
    for (let j = 0; j < deg; j += 1) { r[j] = mulGf(r[j], racine); if (j + 1 < deg) r[j] ^= r[j + 1]; }
    racine = mulGf(racine, 2);
  }
  return r;
};
const reste = (donnees, div) => {
  const r = new Array(div.length).fill(0);
  for (const b of donnees) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= mulGf(c, f); }); }
  return r;
};

/** Matrice QR (tableau de lignes de booléens, vrai = noir) ou null si le texte est trop long. */
export function qr(texte) {
  const octets = [...new TextEncoder().encode(String(texte))];
  let v = 1;
  const capacite = (ver) => Math.floor(modulesBruts(ver) / 8) - ECC_PAR_BLOC[ver] * NB_BLOCS[ver];
  while (v <= 10 && (4 + (v < 10 ? 8 : 16) + octets.length * 8 > capacite(v) * 8)) v += 1;
  if (v > 10 || !octets.length) return null;

  const bits = [];
  const pousse = (val, n) => { for (let i = n - 1; i >= 0; i -= 1) bits.push((val >>> i) & 1); };
  pousse(4, 4); pousse(octets.length, v < 10 ? 8 : 16); octets.forEach((b) => pousse(b, 8));
  const total = capacite(v) * 8;
  pousse(0, Math.min(4, total - bits.length));
  while (bits.length % 8) bits.push(0);
  for (let p = 0xEC; bits.length < total; p ^= 0xEC ^ 0x11) pousse(p, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));

  // Blocs, correction d'erreur, entrelacement.
  const nb = NB_BLOCS[v], ecc = ECC_PAR_BLOC[v], brut = Math.floor(modulesBruts(v) / 8);
  const courts = nb - (brut % nb), longCourt = Math.floor(brut / nb), div = diviseur(ecc);
  const blocs = [];
  for (let i = 0, k = 0; i < nb; i += 1) {
    const d = data.slice(k, k + longCourt - ecc + (i < courts ? 0 : 1)); k += d.length;
    const e = reste(d, div);
    if (i < courts) d.push(0);
    blocs.push(d.concat(e));
  }
  const mots = [];
  for (let i = 0; i < blocs[0].length; i += 1) blocs.forEach((b, j) => { if (i !== longCourt - ecc || j >= courts) mots.push(b[i]); });

  // Motifs fixes.
  const n = v * 4 + 17;
  const m = Array.from({ length: n }, () => new Array(n).fill(false));
  const fixe = Array.from({ length: n }, () => new Array(n).fill(false));
  const pose = (x, y, noir) => { m[y][x] = noir; fixe[y][x] = true; };
  for (let i = 0; i < n; i += 1) { pose(6, i, i % 2 === 0); pose(i, 6, i % 2 === 0); }
  const repere = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy += 1) for (let dx = -4; dx <= 4; dx += 1) {
      const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
      if (x >= 0 && x < n && y >= 0 && y < n) pose(x, y, d !== 2 && d !== 4);
    }
  };
  repere(3, 3); repere(n - 4, 3); repere(3, n - 4);
  const al = positionsAlignement(v);
  al.forEach((cx, i) => al.forEach((cy, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return;
    for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) pose(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  const format = (masque) => {
    const d = masque; let r = d;
    for (let i = 0; i < 10; i += 1) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const f = ((d << 10) | r) ^ 0x5412, b = (i) => ((f >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i += 1) pose(8, i, b(i));
    pose(8, 7, b(6)); pose(8, 8, b(7)); pose(7, 8, b(8));
    for (let i = 9; i < 15; i += 1) pose(14 - i, 8, b(i));
    for (let i = 0; i < 8; i += 1) pose(n - 1 - i, 8, b(i));
    for (let i = 8; i < 15; i += 1) pose(8, n - 15 + i, b(i));
    pose(8, n - 8, true);
  };
  format(0);
  if (v >= 7) {
    let r = v;
    for (let i = 0; i < 12; i += 1) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
    const f = (v << 12) | r;
    for (let i = 0; i < 18; i += 1) { const c = ((f >>> i) & 1) === 1, a = n - 11 + (i % 3), b = Math.floor(i / 3); pose(a, b, c); pose(b, a, c); }
  }

  // Placement en zigzag des mots.
  let k = 0;
  for (let droite = n - 1; droite >= 1; droite -= 2) {
    if (droite === 6) droite = 5;
    for (let vert = 0; vert < n; vert += 1) for (let j = 0; j < 2; j += 1) {
      const x = droite - j, y = ((droite + 1) & 2) === 0 ? n - 1 - vert : vert;
      if (!fixe[y][x] && k < mots.length * 8) { m[y][x] = ((mots[k >>> 3] >>> (7 - (k & 7))) & 1) === 1; k += 1; }
    }
  }

  // Masque : on garde celui de moindre pénalité.
  const inverse = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0];
  const applique = (i) => { for (let y = 0; y < n; y += 1) for (let x = 0; x < n; x += 1) if (!fixe[y][x] && inverse[i](x, y)) m[y][x] = !m[y][x]; };
  const penalite = () => {
    let p = 0, noirs = 0;
    const lignes = [m, m.map((_, x) => m.map((l) => l[x]))];
    for (const L of lignes) for (const l of L) {
      let run = 1;
      for (let i = 1; i <= n; i += 1) {
        if (i < n && l[i] === l[i - 1]) run += 1; else { if (run >= 5) p += 3 + run - 5; run = 1; }
      }
      const s = l.map((c) => (c ? 1 : 0)).join('');
      for (const motif of ['10111010000', '00001011101']) { let at = s.indexOf(motif); while (at >= 0) { p += 40; at = s.indexOf(motif, at + 1); } }
    }
    for (let y = 0; y < n; y += 1) for (let x = 0; x < n; x += 1) {
      if (m[y][x]) noirs += 1;
      if (x < n - 1 && y < n - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
    }
    return p + (Math.ceil(Math.abs(noirs * 20 - n * n * 10) / (n * n)) - 1) * 10;
  };
  let meilleur = 0, mini = Infinity;
  for (let i = 0; i < 8; i += 1) {
    applique(i); format(i);
    const p = penalite();
    if (p < mini) { mini = p; meilleur = i; }
    applique(i);
  }
  applique(meilleur); format(meilleur);
  return m;
}
