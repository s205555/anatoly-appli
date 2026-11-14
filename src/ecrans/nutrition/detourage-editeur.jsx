// Retouche du détourage (widgets/cutout_editor.dart) : glisser pour effacer ou remettre, toucher une zone pour la retirer
// ou la remettre en entier, pincer pour zoomer ; annuler (15 pas), revenir à l'automatique, terminer.
import { useEffect, useRef, useState } from 'preact/hooks';
import { L26 } from '../../i18n/l26.js';
import { Feuille, Ic } from '../../ui.jsx';
import { regionA, rendreAutocollant } from '../../detourage.js';

const PINCEAUX = [16, 30, 54];

export function EditeurDetourage({ brouillon, fermer, terminer }) {
  const X = L26();
  const { w, h, src } = brouillon;
  const [masque, setMasque] = useState(() => brouillon.masque.slice());
  const [historique, setHistorique] = useState([]);
  const [efface, setEfface] = useState(true);
  const [pinceau, setPinceau] = useState(1);
  const [occupe, setOccupe] = useState(false);
  const cadre = useRef(null), toile = useRef(null);
  const vue = useRef({ k: 1, x: 0, y: 0 });
  const geste = useRef(null);
  const photo = useRef(null);

  useEffect(() => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(src), w, h), 0, 0);
    photo.current = c;
    dessiner();
  }, []);
  useEffect(() => { dessiner(); }, [masque]);

  // Image ajustée dans le cadre, puis zoom et décalage de la vue.
  const ajuste = () => {
    const el = toile.current; if (!el) return null;
    const bw = el.clientWidth, bh = el.clientHeight;
    const k = Math.min(bw / w, bh / h);
    return { x: (bw - w * k) / 2, y: (bh - h * k) / 2, k, bw, bh };
  };
  function dessiner(trait = null) {
    const el = toile.current, a = ajuste();
    if (!el || !a || !photo.current) return;
    const dpr = window.devicePixelRatio || 1;
    if (el.width !== Math.round(a.bw * dpr)) { el.width = Math.round(a.bw * dpr); el.height = Math.round(a.bh * dpr); }
    const ctx = el.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, a.bw, a.bh);
    const v = vue.current;
    ctx.save();
    ctx.translate(v.x, v.y); ctx.scale(v.k, v.k);
    ctx.drawImage(photo.current, a.x, a.y, w * a.k, h * a.k);
    ctx.fillStyle = getComputedStyle(el).getPropertyValue('--bg') || '#0d0d0d';
    ctx.globalAlpha = 0.82; ctx.fillRect(a.x, a.y, w * a.k, h * a.k); ctx.globalAlpha = 1;
    // Sujet gardé : la photo à travers le masque (et le trait en cours).
    const m = document.createElement('canvas'); m.width = w; m.height = h;
    const mc = m.getContext('2d');
    const img = mc.createImageData(w, h);
    for (let i = 0; i < masque.length; i++) if (masque[i]) { img.data[i * 4 + 3] = 255; }
    mc.putImageData(img, 0, 0);
    if (trait) {
      mc.globalCompositeOperation = trait.efface ? 'destination-out' : 'source-over';
      mc.lineWidth = trait.l; mc.lineCap = 'round'; mc.lineJoin = 'round'; mc.strokeStyle = '#fff';
      mc.beginPath(); trait.pts.forEach(([x, y], i) => (i ? mc.lineTo(x, y) : mc.moveTo(x, y)));
      if (trait.pts.length === 1) mc.lineTo(trait.pts[0][0] + 0.1, trait.pts[0][1]);
      mc.stroke();
    }
    mc.globalCompositeOperation = 'source-in';
    mc.drawImage(photo.current, 0, 0);
    ctx.drawImage(m, a.x, a.y, w * a.k, h * a.k);
    ctx.restore();
  }

  const versImage = (cx, cy) => {
    const a = ajuste(), r = toile.current.getBoundingClientRect(), v = vue.current;
    const lx = (cx - r.left - v.x) / v.k, ly = (cy - r.top - v.y) / v.k;
    return [(lx - a.x) / a.k, (ly - a.y) / a.k];
  };
  const largeurPinceau = () => PINCEAUX[pinceau] / vue.current.k / ajuste().k;
  const memoriser = (m) => setHistorique((hs) => [...hs.slice(-14), m]);

  const tamponner = (m, trait) => {
    const r = trait.l / 2, val = trait.efface ? 0 : 1;
    const disque = ([cx, cy]) => {
      for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(h - 1, Math.ceil(cy + r)); y++) for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w - 1, Math.ceil(cx + r)); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r) m[y * w + x] = val;
      }
    };
    trait.pts.forEach((p, i) => {
      if (!i) { disque(p); return; }
      const q = trait.pts[i - 1];
      const n = Math.max(1, Math.ceil(Math.hypot(p[0] - q[0], p[1] - q[1]) / Math.max(1, r / 2)));
      for (let k = 1; k <= n; k++) disque([q[0] + ((p[0] - q[0]) * k) / n, q[1] + ((p[1] - q[1]) * k) / n]);
    });
  };

  const pointeurs = useRef(new Map());
  const bas = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointeurs.current.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointeurs.current.size >= 2) {
      const [p1, p2] = [...pointeurs.current.values()];
      geste.current = { pince: true, d: Math.hypot(p1[0] - p2[0], p1[1] - p2[1]), c: [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2], v: { ...vue.current } };
      dessiner();
      return;
    }
    geste.current = { trait: { efface, l: largeurPinceau(), pts: [versImage(e.clientX, e.clientY)] }, depart: [e.clientX, e.clientY], bouge: false };
  };
  const bouge = (e) => {
    if (!pointeurs.current.has(e.pointerId)) return;
    pointeurs.current.set(e.pointerId, [e.clientX, e.clientY]);
    const g = geste.current; if (!g) return;
    if (g.pince && pointeurs.current.size >= 2) {
      const [p1, p2] = [...pointeurs.current.values()];
      const k = Math.min(6, Math.max(1, g.v.k * Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) / g.d));
      const c = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
      const r = toile.current.getBoundingClientRect();
      const fx = g.c[0] - r.left, fy = g.c[1] - r.top;
      vue.current = { k, x: c[0] - r.left - ((fx - g.v.x) * k) / g.v.k, y: c[1] - r.top - ((fy - g.v.y) * k) / g.v.k };
      dessiner();
      return;
    }
    if (!g.trait) return;
    if (Math.hypot(e.clientX - g.depart[0], e.clientY - g.depart[1]) > 4) g.bouge = true;
    g.trait.pts.push(versImage(e.clientX, e.clientY));
    dessiner(g.trait);
  };
  const haut = async (e) => {
    pointeurs.current.delete(e.pointerId);
    const g = geste.current;
    if (!g) return;
    if (g.pince) { if (!pointeurs.current.size) geste.current = null; return; }
    geste.current = null;
    if (!g.bouge) {
      // Toucher : zone de couleur proche, retirée ou remise en entier.
      const [x, y] = g.trait.pts[0];
      if (x < 0 || y < 0 || x >= w || y >= h || occupe) { dessiner(); return; }
      setOccupe(true);
      await new Promise((r) => setTimeout(r, 20));
      const zone = regionA(w, h, src, Math.floor(x), Math.floor(y));
      memoriser(masque);
      const m = masque.slice();
      for (let i = 0; i < zone.length; i++) if (zone[i]) m[i] = efface ? 0 : 1;
      navigator.vibrate?.(5);
      setMasque(m); setOccupe(false);
      return;
    }
    memoriser(masque);
    const m = masque.slice();
    tamponner(m, g.trait);
    setMasque(m);
  };

  const fini = async () => {
    if (occupe) return;
    setOccupe(true);
    await new Promise((r) => setTimeout(r, 20));
    const rendu = rendreAutocollant(w, h, src, masque);
    setOccupe(false);
    if (!rendu) { navigator.vibrate?.(30); return; }
    terminer(rendu, masque);
  };

  return <Feuille ouverte fermer={fermer} titre={X.retoucher} sous={X.retoucherAide} large={0.94} classe="l26-detourage">
    <div class="l26-det-cadre" ref={cadre}>
      <canvas ref={toile} class="l26-det-toile" onPointerDown={bas} onPointerMove={bouge} onPointerUp={haut} onPointerCancel={haut} />
      {occupe && <span class="rond-attente l26-det-attente" aria-hidden="true" />}
    </div>
    <div class="l26-det-outils">
      <div class="nut-filtres" role="radiogroup" aria-label={X.retoucher}>
        <button type="button" role="radio" aria-checked={efface} class={`nut-puce ${efface ? 'on' : ''}`} onClick={() => setEfface(true)}>{X.effacer}</button>
        <button type="button" role="radio" aria-checked={!efface} class={`nut-puce ${!efface ? 'on' : ''}`} onClick={() => setEfface(false)}>{X.remettre}</button>
      </div>
      <span class="l26-det-pinceaux">
        {PINCEAUX.map((_, i) => <button key={i} type="button" aria-label={X.pinceau(i + 1)} aria-pressed={pinceau === i} onClick={() => setPinceau(i)}>
          <i class={pinceau === i ? 'on' : ''} style={{ width: `${8 + i * 7}px`, height: `${8 + i * 7}px` }} /></button>)}
      </span>
    </div>
    <div class="l26-det-actions">
      <button type="button" class="rond" aria-label={X.defaire} disabled={!historique.length} onClick={() => { const m = historique.at(-1); setHistorique((hs) => hs.slice(0, -1)); setMasque(m); }}><Ic n="arrow-counter-clockwise:bold" taille={18} /></button>
      <button type="button" class="rond" aria-label={X.revenirAuto} onClick={() => { memoriser(masque); vue.current = { k: 1, x: 0, y: 0 }; setMasque(brouillon.auto.slice()); }}><Ic n="sparkle:bold" taille={18} /></button>
      <button type="button" class="btn pri large" onClick={fini}>{X.termine}</button>
    </div>
  </Feuille>;
}
