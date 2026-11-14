// Éditeur de sticker : portage 1:1 de sticker_screen.dart (photo ou damier, sticker déplacé, pincé et tourné,
// Séance ou Série, date, six mises en page, six couleurs, Enregistrer et Partager en PNG de 1080 px).
import { useEffect, useRef, useState } from 'preact/hooks';
import { afficher, enDate, etat, jourLocal, nomExercice, poids, serieJours, unite, volume } from '../donnees.js';
import { langue } from '../i18n.js';
import { Ic } from '../ui.jsx';
import { lireM13 } from './reglages-m13.js';

const T = {
  fr: {
    fermer: 'Fermer', aide: 'Faites-la glisser pour la déplacer, pincez pour la redimensionner ou la tourner',
    galerie: 'Galerie', appareil: 'Appareil photo', sansPhoto: 'Sans photo', seance: 'Séance', serie: 'Série', date: 'Date',
    enregistrer: 'Enregistrer', partager: 'Partager', enregistre: 'Image enregistrée', echec: 'Impossible de créer la carte',
    duree: 'Durée', volume: 'Volume', series: 'Séries', exercices: 'Exercices', semaine: 'Cette semaine', joursAffilee: 'JOURS D’AFFILÉE',
    records: (n) => (n === 1 ? '1 nouveau record' : `${n} nouveaux records`), serieDe: (n) => `Série de ${n} jours`,
    mises: ['Colonne', 'Ligne', 'Grand chiffre', 'Panneau', 'Liste', 'Bandeau'], couleur: (i) => `Couleur ${i + 1}`,
  },
  en: {
    fermer: 'Close', aide: 'Drag to move it, pinch to resize or turn it',
    galerie: 'Gallery', appareil: 'Camera', sansPhoto: 'No photo', seance: 'Workout', serie: 'Streak', date: 'Date',
    enregistrer: 'Save', partager: 'Share', enregistre: 'Image saved', echec: 'The card could not be built',
    duree: 'Duration', volume: 'Volume', series: 'Sets', exercices: 'Exercises', semaine: 'This week', joursAffilee: 'DAY STREAK',
    records: (n) => (n === 1 ? '1 new record' : `${n} new records`), serieDe: (n) => `${n}-day streak`,
    mises: ['Column', 'Row', 'Big number', 'Panel', 'List', 'Strip'], couleur: (i) => `Colour ${i + 1}`,
  },
};
/** stickerOpen : libellé du bouton qui ouvre l'éditeur. */
export const libelleSticker = () => (langue === 'en' ? 'Share on a photo' : 'Partager sur une photo');
const LARGEURS = [230, 300, 260, 280, 280, 320];
const ICONES = ['rows', 'columns', 'text-aa', 'squares-four', 'list-bullets', 'equals'];
const BASE = 360;
const loc = () => (langue === 'en' ? 'en-GB' : 'fr-FR');
const horloge = (sec) => { const s = Math.max(0, Math.round(Number(sec) || 0)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`; };
const couleurs = () => { const st = getComputedStyle(document.documentElement); const v = (n, d) => st.getPropertyValue(n).trim() || d; return ['#FFFFFF', '#111111', v('--accent', '#E07A4F'), v('--brass', '#C9A45C'), v('--sage', '#7FA37A'), '#E8E1D7']; };
const clair = (hex) => { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = hex; const m = c.fillStyle.match(/^#(..)(..)(..)$/); if (!m) return true; const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5; };

function meilleure(e) {
  const series = (e.series ?? []).filter((x) => x.fait !== false);
  const travail = series.filter((x) => x.type !== 'e');
  const l = travail.length ? travail : series;
  if (!l.length) return '';
  const top = l.reduce((a, b) => ((Number(a.kg) || 0) * ((Number(a.r) || 0) + 1) >= (Number(b.kg) || 0) * ((Number(b.r) || 0) + 1) ? a : b));
  if (top.kg > 0 && top.r > 0) return `${poids(top.kg)} ${unite()} × ${top.r}`;
  if (top.s) return horloge(top.s);
  return top.r ? `× ${top.r}` : '';
}

/** Le sticker lui-même, à la largeur de base (360 px de scène). */
function Sticker({ s, prs, serie, mise, date, couleur }) {
  const x = T[langue] ?? T.fr;
  const d = enDate(s.debut);
  const ligneDate = `${new Intl.DateTimeFormat(loc(), { weekday: 'long', day: 'numeric', month: 'long' }).format(d)} · ${new Intl.DateTimeFormat(loc(), { hour: '2-digit', minute: '2-digit' }).format(d)}`;
  const exos = s.donnees?.exercices ?? [];
  const nbSeries = exos.reduce((n, e) => n + (e.series ?? []).filter((y) => y.fait !== false).length, 0);
  const vol = volume(exos.reduce((n, e) => n + (e.series ?? []).filter((y) => y.fait !== false && y.type !== 'e').reduce((a, y) => a + (Number(y.kg) || 0) * (Number(y.r) || 0), 0), 0));
  const volTexte = `${vol.val} ${vol.unite}`;
  const duree = horloge(s.duree_s);
  const marque = (t = 12) => <span class="stk-marque" style={{ fontSize: `${t}px` }}><i class="stk-coureur" aria-hidden="true" style={{ height: `${t + 5}px`, width: `${Math.round((t + 5) * 0.64)}px` }} />Anatoly</span>;
  const kicker = (t) => <span class="stk-kicker">{t}</span>;
  const dateEl = (centre) => date && <span class={`stk-date${centre ? ' centre' : ''}`}>{ligneDate}</span>;
  const stat = (l, v, t = 30) => <span class="stk-stat"><small>{l}</small><b style={{ fontSize: `${t}px` }}>{v}</b></span>;
  const recs = (centre) => prs > 0 && <span class={`stk-prs${centre ? ' centre' : ''}`}>{x.records(prs)}</span>;
  const panneau = (c) => <div class="stk-panneau">{c}</div>;
  let corps;
  if (!serie) {
    if (mise === 1) corps = <>{kicker(x.seance)}{dateEl()}<span class="stk-rangee m14">{stat(x.duree, duree, 24)}{stat(x.volume, volTexte, 24)}{stat(x.series, nbSeries, 24)}</span>{recs()}<span class="m14">{marque()}</span></>;
    else if (mise === 2) corps = <div class="stk-centre">{kicker(x.seance)}{dateEl(true)}<b class="stk-geant" style="font-size:64px">{volTexte}</b><span class="stk-sous">{duree}  ·  {nbSeries} {x.series.toLowerCase()}</span>{recs(true)}<span class="m14">{marque()}</span></div>;
    else if (mise === 3) corps = panneau(<><span class="stk-tete">{kicker(x.seance)}{marque(11)}</span>{dateEl()}<span class="stk-rangee m16">{stat(x.duree, duree, 26)}{stat(x.volume, volTexte, 26)}</span><span class="stk-rangee m14">{stat(x.series, nbSeries, 26)}{stat(x.exercices, exos.length, 26)}</span>{recs()}</>);
    else if (mise === 4) {
      const vus = exos.slice(0, 5), plus = exos.length - vus.length;
      corps = <>{kicker(x.seance)}{dateEl()}<span class="stk-liste">{vus.map((e, i) => <span key={i} class="stk-exo"><b>{nomExercice(e.ex)}</b><small>{meilleure(e)}</small></span>)}
        {plus > 0 && <span class="stk-plus">+{plus}</span>}</span><span class="stk-trait" /><span class="stk-total">{duree}  ·  {volTexte}  ·  {nbSeries} {x.series.toLowerCase()}</span><span class="m12">{marque()}</span></>;
    } else if (mise === 5) corps = <><span class="stk-tete gauche">{marque(11)}{date && <span class="stk-date petit">{ligneDate}</span>}</span><span class="stk-rangee m10 bande">{stat(x.duree, duree, 21)}<i class="stk-sep" />{stat(x.volume, volTexte, 21)}<i class="stk-sep" />{stat(x.series, nbSeries, 21)}</span></>;
    else corps = <>{kicker(x.seance)}{dateEl()}<span class="m16">{stat(x.duree, duree, 34)}</span><span class="m12">{stat(x.volume, volTexte, 34)}</span><span class="m12">{stat(x.series, nbSeries, 34)}</span>{recs()}<span class="m16">{marque()}</span></>;
  } else {
    const debutSemaine = Number(lireM13().debutSemaine) || 0;
    const auj = new Date(); auj.setHours(0, 0, 0, 0);
    const debut = new Date(auj); debut.setDate(auj.getDate() - (((auj.getDay() + 6) % 7) - debutSemaine + 7) % 7);
    const faits = new Set();
    for (const y of etat.value?.seances ?? []) { const k = Math.round((new Date(`${jourLocal(enDate(y.debut))}T00:00:00`) - debut) / 86400000); if (k >= 0 && k < 7) faits.add(k); }
    const iAuj = Math.round((auj - debut) / 86400000);
    const jours = serieJours(etat.value?.seances ?? []);
    const semaine = (pt = 20, ecart = 4) => <span class="stk-semaine">{Array.from({ length: 7 }, (_, i) => { const j = new Date(debut); j.setDate(debut.getDate() + i); return <span key={i} style={{ padding: `0 ${ecart}px` }}>
      <i class={faits.has(i) ? 'fait' : ''} style={{ width: `${pt}px`, height: `${pt}px`, opacity: 1, borderColor: i === iAuj ? 'currentColor' : 'color-mix(in srgb, currentColor 40%, transparent)' }} />
      <small>{new Intl.DateTimeFormat(loc(), { weekday: 'narrow' }).format(j).toUpperCase()}</small></span>; })}</span>;
    const grand = (t) => <span class="stk-grand"><Ic n="fire:fill" taille={Math.round(t * 0.7)} /><b style={{ fontSize: `${t}px` }}>{jours}</b></span>;
    const label = <span class="stk-label">{x.joursAffilee}</span>;
    if (mise === 1) corps = <>{kicker(x.serie)}{dateEl()}<span class="stk-tete gauche m10">{grand(46)}{label}</span><span class="m14">{semaine()}</span><span class="m14">{marque()}</span></>;
    else if (mise === 2) corps = <div class="stk-centre">{kicker(x.serie)}{dateEl(true)}<span class="m8"><Ic n="fire:fill" taille={46} /></span><b class="stk-geant" style="font-size:96px">{jours}</b>{label}<span class="m16">{marque()}</span></div>;
    else if (mise === 3) corps = panneau(<><span class="stk-tete">{kicker(x.serie)}{marque(11)}</span>{dateEl()}<span class="m12">{grand(50)}</span>{label}<span class="m14">{semaine(18, 3.5)}</span></>);
    else if (mise === 4) corps = <div class="stk-centre">{kicker(x.semaine)}{dateEl(true)}<span class="m14">{semaine(26, 5)}</span><span class="stk-prs m14">{x.serieDe(jours)}</span><span class="m14">{marque()}</span></div>;
    else if (mise === 5) corps = <><span class="stk-tete gauche">{marque(11)}{date && <span class="stk-date petit">{new Intl.DateTimeFormat(loc(), { weekday: 'long', day: 'numeric', month: 'long' }).format(d)}</span>}</span>
      <span class="stk-tete gauche m10">{grand(30)}{label}<i class="stk-sep court" />{stat(x.semaine, `${faits.size}/7`, 22)}</span></>;
    else corps = <>{kicker(x.serie)}{dateEl()}<span class="m12">{grand(64)}</span>{label}<span class="m16">{semaine(18, 3)}</span><span class="m16">{marque()}</span></>;
  }
  return <div class={`stk${clair(couleur) ? ' clair' : ''}`} style={{ width: `${LARGEURS[mise]}px`, color: couleur }}>{corps}</div>;
}

// Dessine un élément mis en page (sans transformation) dans un canvas : fonds, bordures, textes, icônes et images.
async function dessinerDom(ctx, racine) {
  const o = racine.getBoundingClientRect();
  const imgs = [];
  const parcourir = (el) => {
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const x = r.left - o.left, y = r.top - o.top;
    const alpha = Number(st.opacity);
    ctx.save(); ctx.globalAlpha *= alpha;
    if (el.tagName === 'svg' || el.tagName === 'IMG' || el.classList.contains('stk-coureur')) {
      imgs.push({ el, x, y, w: r.width, h: r.height, a: ctx.globalAlpha, couleur: st.color });
      ctx.restore(); return;
    }
    const rayon = parseFloat(st.borderTopLeftRadius) || 0;
    const fond = st.backgroundColor;
    const bord = parseFloat(st.borderTopWidth) || 0;
    if ((fond && !/rgba\(.*, 0\)$|transparent/.test(fond)) || bord) {
      ctx.beginPath(); ctx.roundRect(x + bord / 2, y + bord / 2, r.width - bord, r.height - bord, Math.min(rayon, r.width / 2, r.height / 2));
      if (fond && !/rgba\(.*, 0\)$|transparent/.test(fond)) { ctx.fillStyle = fond; ctx.fill(); }
      if (bord) { ctx.lineWidth = bord; ctx.strokeStyle = st.borderTopColor; ctx.stroke(); }
    }
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.textContent.trim()) {
        const range = document.createRange(); range.selectNodeContents(n);
        const rr = [...range.getClientRects()];
        ctx.font = `${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
        ctx.fillStyle = st.color; ctx.textBaseline = 'alphabetic';
        if ('letterSpacing' in ctx) ctx.letterSpacing = st.letterSpacing === 'normal' ? '0px' : st.letterSpacing;
        const ombre = st.textShadow && st.textShadow !== 'none';
        if (ombre) { ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 1; }
        // Une ligne par rectangle : on coupe le texte au fil des rectangles (mots entiers).
        const brut = n.textContent.replace(/\s+/g, ' ').trim();
        const mots = st.textTransform === 'uppercase' ? brut.toLocaleUpperCase(langue) : brut;
        let reste = mots;
        rr.forEach((b, i) => {
          let ligne = reste;
          if (i < rr.length - 1) { let k = reste.length; while (k > 0 && ctx.measureText(reste.slice(0, k)).width > b.width + 1) k = reste.lastIndexOf(' ', k - 1); ligne = reste.slice(0, Math.max(k, 1)); }
          reste = reste.slice(ligne.length).trimStart();
          const fs = parseFloat(st.fontSize);
          ctx.fillText(ligne, b.left - o.left, b.top - o.top + (b.height + fs * 0.72) / 2);
        });
        ctx.shadowColor = 'transparent';
      } else if (n.nodeType === 1) parcourir(n);
    }
    ctx.restore();
  };
  parcourir(racine);
  for (const im of imgs) {
    const teinte = im.el.tagName !== 'svg';
    const src = teinte ? (im.el.src || '/statique/app-img/runner.webp')
      : (() => { const c = im.el.cloneNode(true); c.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); c.setAttribute('color', im.couleur); c.setAttribute('width', im.w); c.setAttribute('height', im.h); return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(c).replace(/currentColor/g, im.couleur))}`; })();
    const img = new Image(); img.src = src;
    try { await img.decode(); } catch { continue; } // icône illisible : le reste du sticker est gardé
    ctx.save(); ctx.globalAlpha = im.a;
    if (teinte) {
      // Image teintée à la couleur du sticker (srcIn), comme la marque de l'original.
      const c = document.createElement('canvas'); c.width = Math.ceil(im.w * 3); c.height = Math.ceil(im.h * 3);
      const k = c.getContext('2d'); k.drawImage(img, 0, 0, c.width, c.height); k.globalCompositeOperation = 'source-in'; k.fillStyle = im.couleur; k.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(c, im.x, im.y, im.w, im.h);
    } else ctx.drawImage(img, im.x, im.y, im.w, im.h);
    ctx.restore();
  }
}

export function EditeurSticker({ seance, prs = 0, fermer }) {
  const x = T[langue] ?? T.fr;
  const [photo, setPhoto] = useState(null);
  const [serie, setSerie] = useState(false);
  const [date, setDate] = useState(true);
  const [mise, setMise] = useState(0);
  const [teinte, setTeinte] = useState(0);
  const [pos, setPos] = useState({ x: 0.5, y: 0.68 });
  const [echelle, setEchelle] = useState(1);
  const [tour, setTour] = useState(0);
  const [occupe, setOccupe] = useState(false);
  const [largeur, setLargeur] = useState(BASE);
  const scene = useRef(null), boite = useRef(null), gestes = useRef(new Map()), depart = useRef(null), galerie = useRef(null), camera = useRef(null);
  const palette = couleurs();
  const couleur = palette[teinte];

  useEffect(() => {
    const el = scene.current; if (!el) return undefined;
    const ro = new ResizeObserver(() => setLargeur(el.clientWidth || BASE)); ro.observe(el);
    const esc = (e) => { if (e.key === 'Escape') fermer(); };
    document.addEventListener('keydown', esc);
    document.body.classList.add('fige');
    return () => { ro.disconnect(); document.removeEventListener('keydown', esc); document.body.classList.remove('fige'); };
  }, []);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);

  // onScaleUpdate : un doigt déplace, deux doigts agrandissent (0,45 à 2,6) et tournent.
  const bas = (e) => { scene.current.setPointerCapture(e.pointerId); gestes.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); depart.current = null; };
  const bouge = (e) => {
    const g = gestes.current; if (!g.has(e.pointerId)) return;
    const avant = g.get(e.pointerId); const r = scene.current.getBoundingClientRect();
    if (g.size === 1) setPos((p) => ({ x: Math.min(1, Math.max(0, p.x + (e.clientX - avant.x) / r.width)), y: Math.min(1, Math.max(0, p.y + (e.clientY - avant.y) / r.height)) }));
    g.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.size === 2) {
      const [a, b] = [...g.values()];
      const dist = Math.hypot(b.x - a.x, b.y - a.y), angle = Math.atan2(b.y - a.y, b.x - a.x);
      if (!depart.current) depart.current = { dist, angle, echelle, tour };
      else { setEchelle(Math.min(2.6, Math.max(0.45, depart.current.echelle * dist / depart.current.dist))); setTour(depart.current.tour + angle - depart.current.angle); }
    }
  };
  const haut = (e) => { gestes.current.delete(e.pointerId); depart.current = null; };
  const roue = (e) => { e.preventDefault(); if (e.shiftKey) setTour((t) => t + e.deltaY * 0.004); else setEchelle((s) => Math.min(2.6, Math.max(0.45, s * (1 - e.deltaY * 0.0015)))); };

  const rendre = async () => {
    const W = 1080, k = W / largeur, H = Math.round(W * 16 / 9);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    if (photo) {
      const img = new Image(); img.src = photo; await img.decode();
      const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      ctx.drawImage(img, (W - img.naturalWidth * s) / 2, (H - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
    }
    await document.fonts?.ready;
    const el = boite.current;
    const tr = el.style.transform; el.style.transform = 'none';
    const w = el.offsetWidth, h = el.offsetHeight;
    ctx.save();
    ctx.translate(pos.x * W, pos.y * H); ctx.rotate(tour); ctx.scale(echelle * (largeur / BASE) * k, echelle * (largeur / BASE) * k); ctx.translate(-w / 2, -h / 2);
    try { await dessinerDom(ctx, el.firstElementChild); } finally { el.style.transform = tr; }
    ctx.restore();
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/png'));
    if (!blob) throw new Error('rendu');
    return blob;
  };
  const executer = async (travail) => {
    if (occupe) return;
    setOccupe(true);
    try { await travail(await rendre()); } catch (e) { console.warn('sticker', e); if (e?.name !== 'AbortError') afficher(x.echec, 'danger'); } finally { setOccupe(false); }
  };
  const nom = `anatoly-${jourLocal(new Date())}-${Date.now() % 100000}.png`;
  const enregistrer = () => executer(async (blob) => {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: nom });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    afficher(x.enregistre);
  });
  const partager = () => executer(async (blob) => {
    const f = new File([blob], nom, { type: 'image/png' });
    if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], title: 'Anatoly' });
    else { const url = URL.createObjectURL(blob); const a = Object.assign(document.createElement('a'), { href: url, download: nom }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); }
  });
  const choisir = (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f && f.type.startsWith('image/')) setPhoto(URL.createObjectURL(f)); };

  return <div class="stk-ecran" role="dialog" aria-modal="true" aria-label={x.seance}>
    <div class="stk-haut">
      <button type="button" class="rond" aria-label={x.fermer} onClick={fermer}><Ic n="x" taille={18} /></button>
      <p>{x.aide}</p>
    </div>
    <div class="stk-zone">
      <div class={`stk-scene${photo ? '' : ' damier'}`} ref={scene} onPointerDown={bas} onPointerMove={bouge} onPointerUp={haut} onPointerCancel={haut} onWheel={roue} onDblClick={() => setTour(0)}>
        {photo && <img class="stk-photo" src={photo} alt="" />}
        <div class="stk-pose" ref={boite} style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, transform: `translate(-50%, -50%) rotate(${tour}rad) scale(${echelle * largeur / BASE})` }}>
          <Sticker s={seance} prs={prs} serie={serie} mise={mise} date={date} couleur={couleur} />
        </div>
      </div>
    </div>
    <div class="stk-reglages">
      <div class="stk-puces">
        <button type="button" onClick={() => galerie.current.click()}><Ic n="image" taille={16} />{x.galerie}</button>
        <button type="button" onClick={() => camera.current.click()}><Ic n="camera" taille={16} />{x.appareil}</button>
        <button type="button" class={photo ? '' : 'on'} aria-pressed={!photo} onClick={() => setPhoto(null)}><Ic n="checkerboard" taille={16} />{x.sansPhoto}</button>
        <input ref={galerie} type="file" accept="image/*" class="masque" onChange={choisir} />
        <input ref={camera} type="file" accept="image/*" capture="environment" class="masque" onChange={choisir} />
      </div>
      <div class="stk-ligne">
        <div class="seg stk-seg" role="radiogroup" aria-label={`${x.seance} / ${x.serie}`}>
          <button type="button" role="radio" aria-checked={!serie} aria-pressed={!serie} onClick={() => setSerie(false)}>{x.seance}</button>
          <button type="button" role="radio" aria-checked={serie} aria-pressed={serie} onClick={() => setSerie(true)}>{x.serie}</button>
        </div>
        <button type="button" class={`stk-pilule${date ? ' on' : ''}`} aria-pressed={date} onClick={() => setDate(!date)}>{x.date}</button>
      </div>
      <div class="stk-mises">{ICONES.map((n, i) => <button key={n} type="button" class={mise === i ? 'on' : ''} aria-pressed={mise === i} aria-label={x.mises[i]} onClick={() => setMise(i)}><Ic n={n} taille={17} /></button>)}</div>
      <div class="stk-couleurs">{palette.map((c, i) => <button key={i} type="button" class={teinte === i ? 'on' : ''} aria-pressed={teinte === i} aria-label={x.couleur(i)} onClick={() => setTeinte(i)}><i style={{ background: c }} /></button>)}</div>
      <div class="stk-boutons">
        <button type="button" class="btn large stk-enregistrer" disabled={occupe} onClick={enregistrer}>{x.enregistrer}</button>
        <button type="button" class="btn pri large" disabled={occupe} onClick={partager}>{x.partager}</button>
      </div>
    </div>
  </div>;
}
