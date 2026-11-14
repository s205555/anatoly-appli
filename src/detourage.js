// Détourage des photos d'aliments, calculé dans le navigateur (port de services/sticker_cutout.dart, sans service externe).
// Les images sont en RGBA (Uint8ClampedArray, largeur w, hauteur h) ; les masques sont des Uint8Array de w × h (1 = garde).

function canaux(w, h, src) {
  const n = w * h;
  const y = new Float32Array(n), cb = new Float32Array(n), cr = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = src[i * 4], g = src[i * 4 + 1], b = src[i * 4 + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    y[i] = l; cb[i] = b - l; cr[i] = r - l;
  }
  const mur = bords(y, w, h);
  flou(y, w, h); flou(cb, w, h); flou(cr, w, h);
  return { y, cb, cr, mur };
}
const voisins = (p, w, h) => {
  const px = p % w, py = (p - px) / w, out = [];
  if (px > 0) out.push(p - 1);
  if (px < w - 1) out.push(p + 1);
  if (py > 0) out.push(p - w);
  if (py < h - 1) out.push(p + w);
  return out;
};

/** cutoutMask : fond pris depuis les bords (médiane), propagation douce arrêtée par les contours, ombres comprises ; null si la photo ne s'y prête pas. */
export function masqueDetourage(w, h, src, { force = false } = {}) {
  const n = w * h;
  const { y, cb, cr, mur } = canaux(w, h, src);
  const dist = (a, b) => { const dy = y[a] - y[b], db = cb[a] - cb[b], dr = cr[a] - cr[b]; return Math.sqrt(0.3 * dy * dy + db * db + dr * dr); };
  const bord = [];
  for (let x = 0; x < w; x++) bord.push(x, (h - 1) * w + x);
  for (let r = 1; r < h - 1; r++) bord.push(r * w, r * w + w - 1);
  const my = mediane(bord.map((i) => y[i])), mb = mediane(bord.map((i) => cb[i])), mr = mediane(bord.map((i) => cr[i]));
  const versFond = (i) => { const dy = y[i] - my, db = cb[i] - mb, dr = cr[i] - mr; return Math.sqrt(0.3 * dy * dy + db * db + dr * dr); };
  const ecart = bord.map(versFond).sort((a, b) => a - b);
  const p80 = ecart[Math.min(ecart.length - 1, Math.max(0, Math.floor(ecart.length * 0.8)))];
  if (p80 > 30 && !force) return null;
  const limiteGraine = Math.min(60, Math.max(18, p80 * 1.5 + 14));
  const limite = limiteGraine * 1.9;
  const pas = 9;
  const ombre = (i) => { const db = cb[i] - mb, dr = cr[i] - mr; return db * db + dr * dr < 64 && y[i] < my && y[i] > my * 0.5; };
  const fond = new Uint8Array(n);
  const file = new Int32Array(n);
  let tete = 0, queue = 0;
  for (const i of bord) if (!fond[i] && versFond(i) <= limiteGraine) { fond[i] = 1; file[queue++] = i; }
  if (queue < bord.length * (force ? 0.05 : 0.35)) return null;
  while (tete < queue) {
    const p = file[tete++];
    for (const q of voisins(p, w, h)) {
      if (fond[q] || mur[q]) continue;
      if (dist(p, q) <= pas && (versFond(q) <= limite || ombre(q))) { fond[q] = 1; file[queue++] = q; }
    }
  }
  for (let passe = 0; passe < 3; passe++) {
    const pousse = [];
    for (let i = 0; i < n; i++) {
      if (fond[i] || !mur[i] || versFond(i) > limite) continue;
      if (voisins(i, w, h).some((q) => fond[q])) pousse.push(i);
    }
    for (const i of pousse) fond[i] = 1;
  }
  const sujet = new Uint8Array(n);
  for (let i = 0; i < n; i++) sujet[i] = fond[i] ? 0 : 1;
  ouvrir(sujet, w, h); ouvrir(sujet, w, h);
  garderPrincipal(sujet, w, h);
  boucherTrous(sujet, w, h, { garder: (i) => versFond(i) <= limiteGraine, minTrou: Math.round(n * 0.002) });
  let surBord = 0;
  for (const i of bord) surBord += sujet[i];
  if (surBord > bord.length * (force ? 0.6 : 0.2)) return null;
  let aire = 0;
  for (let i = 0; i < n; i++) aire += sujet[i];
  const part = aire / n;
  if (part < (force ? 0.02 : 0.04) || part > (force ? 0.97 : 0.93)) return null;
  return sujet;
}

/** _draftMask : essai normal puis forcé ; trouve = détourage automatique réussi. */
export function brouillonDetourage(w, h, src) {
  const m = masqueDetourage(w, h, src) ?? masqueDetourage(w, h, src, { force: true });
  const depart = m ?? new Uint8Array(w * h).fill(1);
  return { w, h, src, masque: depart, auto: depart.slice(), trouve: m != null };
}

/** regionAt : zone de couleur proche autour d'un point (toucher pour retirer ou remettre une zone entière). */
export function regionA(w, h, src, x0, y0) {
  const n = w * h;
  const { y, cb, cr, mur } = canaux(w, h, src);
  const graine = Math.min(h - 1, Math.max(0, y0)) * w + Math.min(w - 1, Math.max(0, x0));
  const diff = (a, b) => { const dy = y[a] - y[b], db = cb[a] - cb[b], dr = cr[a] - cr[b]; return Math.sqrt(0.3 * dy * dy + db * db + dr * dr); };
  const out = new Uint8Array(n);
  const file = new Int32Array(n);
  let tete = 0, queue = 0;
  out[graine] = 1; file[queue++] = graine;
  while (tete < queue) {
    const p = file[tete++];
    for (const q of voisins(p, w, h)) {
      if (out[q]) continue;
      if (diff(q, graine) <= 34 && diff(p, q) <= 10 && (!mur[q] || diff(q, graine) <= 14)) { out[q] = 1; file[queue++] = q; }
    }
  }
  for (let passe = 0; passe < 2; passe++) {
    const pousse = [];
    for (let i = 0; i < n; i++) if (!out[i] && voisins(i, w, h).some((q) => out[q])) pousse.push(i);
    for (const i of pousse) out[i] = 1;
  }
  boucherTrous(out, w, h);
  return out;
}

/** _renderMasked / _outlined : sujet recadré avec un liseré blanc de 3,5 % ; null si le masque est vide. */
export function rendreAutocollant(w, h, src, masque) {
  if (!masque.some((v) => v)) return null;
  const propre = masque.slice();
  ouvrir(propre, w, h);
  return entoure(w, h, src, propre);
}

/** _framed : photo entière en carré aux coins arrondis (16 %), avec le même liseré. */
export function photoEntiere(w, h, src) {
  const cote = Math.min(w, h);
  const ox = Math.floor((w - cote) / 2), oy = Math.floor((h - cote) / 2);
  const coupe = new Uint8ClampedArray(cote * cote * 4);
  for (let r = 0; r < cote; r++) coupe.set(src.subarray(((oy + r) * w + ox) * 4, ((oy + r) * w + ox + cote) * 4), r * cote * 4);
  const m = new Uint8Array(cote * cote);
  const rayon = cote * 0.16;
  for (let r = 0; r < cote; r++) for (let c = 0; c < cote; c++) {
    const dx = Math.max(0, Math.max(rayon - c, c - (cote - 1 - rayon)));
    const dy = Math.max(0, Math.max(rayon - r, r - (cote - 1 - rayon)));
    m[r * cote + c] = dx * dx + dy * dy <= rayon * rayon ? 1 : 0;
  }
  return entoure(cote, cote, coupe, m);
}

function entoure(w, h, src, masque) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    if (!masque[r * w + c]) continue;
    if (c < x0) x0 = c; if (c > x1) x1 = c; if (r < y0) y0 = r; if (r > y1) y1 = r;
  }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const anneau = Math.max(5, Math.round(Math.max(bw, bh) * 0.035));
  const marge = anneau + 3;
  const ow = bw + marge * 2, oh = bh + marge * 2;
  const alpha = new Float32Array(ow * oh), dedans = new Uint8Array(ow * oh);
  for (let r = 0; r < bh; r++) for (let c = 0; c < bw; c++) if (masque[(y0 + r) * w + x0 + c] === 1) dedans[(r + marge) * ow + c + marge] = 1;
  for (let r = 1; r < oh - 1; r++) for (let c = 1; c < ow - 1; c++) {
    let s = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += dedans[(r + dy) * ow + c + dx];
    alpha[r * ow + c] = dedans[r * ow + c] ? (s >= 9 ? 1 : 0.55 + s / 20) : (s > 0 ? s / 18 : 0);
  }
  const d = distance(dedans, ow, oh);
  const out = new Uint8ClampedArray(ow * oh * 4);
  for (let r = 0; r < oh; r++) for (let c = 0; c < ow; c++) {
    const o = r * ow + c;
    const a = Math.min(1, Math.max(0, alpha[o]));
    const a2 = Math.min(1, Math.max(0, anneau - d[o] + 0.5));
    const total = a + a2 * (1 - a);
    if (total <= 0) continue;
    const sr = r - marge + y0, sc = c - marge + x0;
    const dansImg = sr >= 0 && sr < h && sc >= 0 && sc < w;
    const si = dansImg ? (sr * w + sc) * 4 : 0;
    for (let k = 0; k < 3; k++) out[o * 4 + k] = Math.round(((dansImg ? src[si + k] : 255) * a + 255 * a2 * (1 - a)) / total);
    out[o * 4 + 3] = Math.round(total * 255);
  }
  return { w: ow, h: oh, rgba: out };
}

function bords(y, w, h) {
  const g = new Float32Array(w * h);
  for (let r = 1; r < h - 1; r++) for (let c = 1; c < w - 1; c++) {
    const i = r * w + c;
    const gx = y[i - w + 1] + 2 * y[i + 1] + y[i + w + 1] - y[i - w - 1] - 2 * y[i - 1] - y[i + w - 1];
    const gy = y[i + w - 1] + 2 * y[i + w] + y[i + w + 1] - y[i - w - 1] - 2 * y[i - w] - y[i - w + 1];
    g[i] = Math.sqrt(gx * gx + gy * gy);
  }
  const dur = new Uint8Array(w * h);
  for (let i = 0; i < g.length; i++) if (g[i] > 28) dur[i] = 1;
  const mur = new Uint8Array(w * h);
  for (let r = 1; r < h - 1; r++) for (let c = 1; c < w - 1; c++) { const i = r * w + c; mur[i] = dur[i] | dur[i - 1] | dur[i + 1] | dur[i - w] | dur[i + w]; }
  return mur;
}

function flou(v, w, h) {
  const t = new Float32Array(v.length);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) t[r * w + c] = (v[r * w + Math.max(0, c - 1)] + v[r * w + c] + v[r * w + Math.min(w - 1, c + 1)]) / 3;
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) v[r * w + c] = (t[Math.max(0, r - 1) * w + c] + t[r * w + c] + t[Math.min(h - 1, r + 1) * w + c]) / 3;
}

function mediane(xs) { xs.sort((a, b) => a - b); return xs[Math.floor(xs.length / 2)]; }

export function ouvrir(m, w, h) {
  const e = new Uint8Array(m.length);
  for (let r = 1; r < h - 1; r++) for (let c = 1; c < w - 1; c++) { const i = r * w + c; e[i] = m[i] & m[i - 1] & m[i + 1] & m[i - w] & m[i + w]; }
  for (let r = 1; r < h - 1; r++) for (let c = 1; c < w - 1; c++) { const i = r * w + c; m[i] = e[i] | e[i - 1] | e[i + 1] | e[i - w] | e[i + w]; }
}

function garderPrincipal(m, w, h) {
  const etiquette = new Int32Array(m.length);
  const tailles = [0], touche = [0], sx = [0], sy = [0];
  const file = new Int32Array(m.length);
  for (let i = 0; i < m.length; i++) {
    if (!m[i] || etiquette[i]) continue;
    const id = tailles.length;
    let tete = 0, queue = 0, n = 0, bord = 0, ax = 0, ay = 0;
    etiquette[i] = id; file[queue++] = i;
    while (tete < queue) {
      const p = file[tete++];
      n++;
      const px = p % w, py = (p - px) / w;
      ax += px; ay += py;
      if (px === 0 || py === 0 || px === w - 1 || py === h - 1) bord++;
      for (const q of voisins(p, w, h)) if (m[q] === 1 && !etiquette[q]) { etiquette[q] = id; file[queue++] = q; }
    }
    tailles.push(n); touche.push(bord); sx.push(ax / n); sy.push(ay / n);
  }
  if (tailles.length <= 1) return;
  const perimetre = 2 * (w + h);
  const score = (id) => {
    const dx = (sx[id] - w / 2) / (w / 2), dy = (sy[id] - h / 2) / (h / 2);
    return tailles[id] * (1 - 0.55 * Math.min(1, Math.sqrt(dx * dx + dy * dy))) * (touche[id] > perimetre * 0.03 ? 0.4 : 1);
  };
  let meilleur = 1;
  for (let id = 2; id < tailles.length; id++) if (score(id) > score(meilleur)) meilleur = id;
  const garde = tailles.map((t, id) => (id > 0 && (id === meilleur || (t >= tailles[meilleur] * 0.15 && touche[id] <= perimetre * 0.01)) ? 1 : 0));
  for (let i = 0; i < m.length; i++) if (m[i] === 1 && !garde[etiquette[i]]) m[i] = 0;
}

function boucherTrous(m, w, h, { garder = null, minTrou = 0 } = {}) {
  const out = new Uint8Array(m.length);
  const file = new Int32Array(m.length);
  let tete = 0, queue = 0;
  const semer = (i) => { if (!m[i] && !out[i]) { out[i] = 1; file[queue++] = i; } };
  for (let x = 0; x < w; x++) { semer(x); semer((h - 1) * w + x); }
  for (let r = 0; r < h; r++) { semer(r * w); semer(r * w + w - 1); }
  const etendre = (visite) => { while (tete < queue) for (const q of voisins(file[tete++], w, h)) visite(q); };
  etendre(semer);
  const trou = new Int32Array(m.length);
  for (let i = 0; i < m.length; i++) {
    if (m[i] || out[i]) continue;
    if (!garder) { m[i] = 1; continue; }
    tete = 0; queue = 0;
    let taille = 0, ouvert = 0;
    const croitre = (q) => { if (!m[q] && !out[q]) { out[q] = 2; file[queue++] = q; trou[taille++] = q; if (garder(q)) ouvert++; } };
    croitre(i);
    etendre(croitre);
    if (!(taille >= minTrou && ouvert >= taille * 0.8)) for (let k = 0; k < taille; k++) m[trou[k]] = 1;
  }
}

function distance(dedans, w, h) {
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = dedans[i] ? 0 : 1e9;
  const a = 1, b = 1.4142;
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const i = r * w + c;
    let v = d[i];
    if (c > 0) v = Math.min(v, d[i - 1] + a);
    if (r > 0) { v = Math.min(v, d[i - w] + a); if (c > 0) v = Math.min(v, d[i - w - 1] + b); if (c < w - 1) v = Math.min(v, d[i - w + 1] + b); }
    d[i] = v;
  }
  for (let r = h - 1; r >= 0; r--) for (let c = w - 1; c >= 0; c--) {
    const i = r * w + c;
    let v = d[i];
    if (c < w - 1) v = Math.min(v, d[i + 1] + a);
    if (r < h - 1) { v = Math.min(v, d[i + w] + a); if (c < w - 1) v = Math.min(v, d[i + w + 1] + b); if (c > 0) v = Math.min(v, d[i + w - 1] + b); }
    d[i] = v;
  }
  return d;
}

// ---------- Navigateur : fichier → pixels (900 px au plus), pixels → PNG ----------
export async function decoderImage(fichier, cote = 900) {
  const bmp = await createImageBitmap(fichier);
  const k = Math.min(1, cote / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return { w, h, src: ctx.getImageData(0, 0, w, h).data };
}
export function versPng({ w, h, rgba }) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  cv.getContext('2d').putImageData(new ImageData(rgba, w, h), 0, 0);
  return new Promise((res) => cv.toBlob((b) => res(b), 'image/png'));
}
