// Progrès (M04) : port 1:1 de l'écran GymMane. Volume 30 j, poids, régularité,
// carte musculaire, radar, semaine, force 1RM, records, mesures, mois, check-in.
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  afficher, api, bilanSeance, charger, dateCourte, dateLongue, dureeCourte, ecrireModule, lireModule, sauverExtensions, enDate, etat, jourDe, jourLocal, lundi, meilleures, minSec, nombre, nomExercice, poids,
  semaine, serieJours, serieSemaines, trouverExercice, unite, unRM, versAffichage, versKg, volume,
} from '../donnees.js';
import { IllustrationExercice } from '../illustrations.js';
import { langue as langueApp, t, dp } from '../i18n.js';
import { fr as m04fr, en as m04en } from '../i18n/m04.js';
import { cadreFigure, FigureMuscle, SilhouetteSvg, RAMPE_HEAT, idle } from '../silhouette-svg.jsx';

// Couleurs de GymMane (body_map.dart) : Color.lerp(a, b, t) en CSS.
const melange = (a, b, t) => `color-mix(in srgb, ${a}, ${b} ${Math.round(t * 100)}%)`;
const DANGER = '#E5674C', WARN = '#E0B15A', SAGE = '#8FA377';
const couleurRecup = (v) => {
  v = Math.max(0, Math.min(1, v));
  return v < 0.5 ? melange(DANGER, WARN, v / 0.5) : melange(WARN, melange(idle, SAGE, 0.62), (v - 0.5) / 0.5);
};
const couleurNeglige = (j) => j == null || j >= 14 ? DANGER : j >= 7 ? melange(WARN, DANGER, (j - 7) / 7) : j >= 4 ? melange(idle, WARN, 0.35 + (j - 4) * 0.2) : melange(idle, SAGE, 0.35);
import { Feuille, Ic, Kicker, Nombre, Vide } from '../ui.jsx';
import { HeatmapAccueil, X, parJour } from './heatmap-accueil.jsx';
import { lireM13 } from './reglages-m13.js';
import { FeuilleJour } from './l26-jour.jsx';
import { L26 } from '../i18n/l26.js';
import './m04.css';
import './progres-structure.css';

export { HeatmapAccueil };

const JOUR = 86400000;
const COMPTER_SERIE = (s) => s.fait !== false && s.type !== 'e';
const nomMuscle = (m) => t.muscles[m] ?? m;
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const depuis = (j) => Date.now() - j * JOUR;
const enPlage = (s, debutMs) => enDate(s.debut).getTime() >= debutMs;

function seriesParMuscle(seances, debutMs) {
  const c = {};
  for (const s of seances) {
    if (!enPlage(s, debutMs)) continue;
    for (const e of s.donnees?.exercices || []) {
      const def = trouverExercice(e.ex);
      if (!def) continue;
      const n = (e.series || []).filter(COMPTER_SERIE).length;
      c[def.muscle] = (c[def.muscle] ?? 0) + n;
      for (const autre of def.autres || []) c[autre] = (c[autre] ?? 0) + n / 2;
    }
  }
  return c;
}

function forceParSeance(seances, ex) {
  const out = [];
  for (const s of seances) {
    const e = (s.donnees?.exercices || []).find((x) => x.ex === ex);
    if (!e) continue;
    let best = 0;
    for (const ser of e.series || []) {
      if (!COMPTER_SERIE(ser) || !ser.kg) continue;
      const rm = unRM(ser.kg, ser.r);
      if (rm > best) best = rm;
    }
    if (best > 0) out.push({ date: s.debut, kg: best });
  }
  return out.sort((a, b) => enDate(a.date) - enDate(b.date));
}

function pentePoids(poidsListe, jours) {
  const pts = poidsListe.filter((m) => Date.now() - enDate(m.jour).getTime() < jours * JOUR).map((m) => ({ x: enDate(m.jour).getTime() / JOUR, y: Number(m.kg) }));
  if (pts.length < 2) return { pente: 0, base: pts.at(-1)?.y ?? 0 };
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n;
  const my = pts.reduce((a, p) => a + p.y, 0) / n;
  let haut = 0, bas = 0;
  for (const p of pts) { haut += (p.x - mx) * (p.y - my); bas += (p.x - mx) ** 2; }
  const a = bas ? haut / bas : 0;
  return { pente: a * 7, base: my }; // kg / semaine
}

/* ------------------------------------------------------------------ */
/* Graphiques (charts.dart : Sparkline, TrendChart ; nutrition_art.dart : ValueLineChart) */
/* ------------------------------------------------------------------ */
// Textes ajoutés par la refonte de structure (lot L04), tirés de app_fr.arb / app_en.arb, au vouvoiement.
const L4 = {
  fr: {
    sessions: 'Séances', sets: 'Séries', time: 'Temps', lifted: 'Soulevé',
    goalWeight: 'Poids cible', goalWeightTitle: (u) => `Poids cible (${u})`, trackWeight: 'Suivez l’évolution de votre poids',
    paceTitle: 'Rythme hebdomadaire', weekShort: 'sem.',
    paceOn: 'Bon rythme', paceTooFast: 'Plus rapide que votre fourchette', paceTooSlow: 'Plus lent que votre fourchette',
    paceWrongWay: 'Dans le mauvais sens', paceDrifting: 'Vous bougez plus que pour maintenir', paceSetAim: 'Touchez pour choisir votre objectif',
    paceLose: 'Perdre', paceHold: 'Maintenir', paceGain: 'Prendre', paceAuto: 'Automatique',
    paceBasis: 'Tendance de vos pesées des 3 dernières semaines, pour qu’un dîner salé ne vous trompe pas.',
    paceAimTitle: 'Quel est votre objectif ?', paceAimHint: 'La carte vous dit si votre rythme convient',
    paceLoseRange: '0,5 à 1 % de votre poids par semaine', paceHoldRange: 'À 0,25 % près par semaine',
    paceGainRange: '0,25 à 0,5 % de votre poids par semaine', paceAutoHint: 'Selon votre objectif de poids',
    pickRange: 'Choisir les dates', sharePdf: 'Partager le PDF', exportCsv: 'Exporter le CSV',
    sharePick: 'Que voulez-vous montrer ?', shareStreak: 'Série et régularité', shareBody: 'Muscles travaillés',
    shareHint: 'La carte est créée sur votre téléphone. Rien ne sort tant que vous ne choisissez pas où l’envoyer.',
    share: 'Partager', shareFailed: 'Impossible de créer la carte', consistency: 'Régularité', streakLabel: 'jours d’affilée',
    shareSessions: 'Séances', trained: 'Entraînement', shareVolume: 'Volume', lastWeek: '7 derniers jours', unitDays: 'jours',
  },
  en: {
    sessions: 'Sessions', sets: 'Sets', time: 'Time', lifted: 'Lifted',
    goalWeight: 'Goal weight', goalWeightTitle: (u) => `Goal weight (${u})`, trackWeight: 'Track your weight over time',
    paceTitle: 'Weekly rate', weekShort: 'wk',
    paceOn: 'On pace', paceTooFast: 'Faster than the range you set', paceTooSlow: 'Slower than the range you set',
    paceWrongWay: 'Going the other way', paceDrifting: 'Moving more than a hold allows', paceSetAim: 'Tap to set what you aim for',
    paceLose: 'Lose', paceHold: 'Hold', paceGain: 'Gain', paceAuto: 'Automatic',
    paceBasis: 'Trend of your weigh-ins from the last 3 weeks, so one salty dinner can\'t fool it.',
    paceAimTitle: 'What are you aiming for?', paceAimHint: 'The card tells you if your weekly rate fits it',
    paceLoseRange: '0.5 to 1% of your weight a week', paceHoldRange: 'Within 0.25% a week',
    paceGainRange: '0.25 to 0.5% of your weight a week', paceAutoHint: 'From your weight goal',
    pickRange: 'Choose dates', sharePdf: 'Share PDF', exportCsv: 'Export CSV',
    sharePick: 'What do you want to show?', shareStreak: 'Streak and consistency', shareBody: 'Muscles worked',
    shareHint: 'The card is built on your phone. Nothing leaves until you pick where it goes.',
    share: 'Share', shareFailed: 'The card could not be built', consistency: 'Consistency', streakLabel: 'day streak',
    shareSessions: 'Sessions', trained: 'Trained', shareVolume: 'Volume', lastWeek: 'Last 7 days', unitDays: 'days',
  },
};
const T4 = () => L4[langueApp === 'en' ? 'en' : 'fr'];
const dateAn = (v) => new Intl.DateTimeFormat(langueApp === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }).format(enDate(v));
const signe = (v) => (v > 0 ? '+' : v < 0 ? '−' : '');
const fmtAxe = (v) => nombre(Math.round(v * 10) / 10, 1);

// Largeur en px du conteneur, pour dessiner sans déformer les points (preserveAspectRatio ne convient pas aux cercles).
function useLargeur() {
  const ref = useRef(null);
  const [l, setL] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setL(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setL(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, l];
}

// Bornes « rondes » de l'axe (charts.dart:niceBounds).
export function bornesRondes(vals) {
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (Math.abs(hi - lo) < 1e-9) { const p = Math.abs(lo) < 1e-9 ? 1 : Math.abs(lo) * 0.1; lo -= p; hi += p; }
  const brut = (hi - lo) / 4;
  const mag = 10 ** Math.floor(Math.log10(brut));
  const r = brut / mag;
  const pas = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * mag;
  const a = Math.floor(lo / pas) * pas;
  let n = Math.round((Math.ceil(hi / pas) * pas - a) / pas);
  if (n < 2) n = 2;
  if (n % 2) n += 1;
  return [a, a + n * pas];
}

// Courbe lissée monotone (Fritsch-Carlson), comme _TrendPainter et _ValueLinePainter.
function cheminLisse(p) {
  const n = p.length;
  const pente = p.slice(0, -1).map((q, i) => (p[i + 1][1] - q[1]) / (p[i + 1][0] - q[0]));
  const tg = new Array(n).fill(0);
  tg[0] = pente[0]; tg[n - 1] = pente[n - 2];
  for (let i = 1; i < n - 1; i++) tg[i] = pente[i - 1] * pente[i] <= 0 ? 0 : (pente[i - 1] + pente[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (pente[i] === 0) { tg[i] = 0; tg[i + 1] = 0; continue; }
    const a = tg[i] / pente[i], b = tg[i + 1] / pente[i], h = a * a + b * b;
    if (h > 9) { const k = 3 / Math.sqrt(h); tg[i] = k * a * pente[i]; tg[i + 1] = k * b * pente[i]; }
  }
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = (p[i + 1][0] - p[i][0]) / 3;
    d += ` C${(p[i][0] + dx).toFixed(1)},${(p[i][1] + tg[i] * dx).toFixed(1)} ${(p[i + 1][0] - dx).toFixed(1)},${(p[i + 1][1] - tg[i + 1] * dx).toFixed(1)} ${p[i + 1][0].toFixed(1)},${p[i + 1][1].toFixed(1)}`;
  }
  return d;
}

function MiniLigne({ pts, h = 40, classe = 'm04-etincelle' }) {
  if (pts.length < 2) return null;
  const w = 300, pad = 4;
  const min = Math.min(...pts), max = Math.max(...pts), et = max - min || 1;
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${pad + (i / (pts.length - 1)) * (w - 2 * pad).toFixed(1)},${(h - pad - ((v - min) / et) * (h - 2 * pad)).toFixed(1)}`).join(' ');
  return (
    <svg class={classe} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`${d} L${w - pad},${h} L${pad},${h} Z`} fill="var(--accent-soft)" />
      <path d={d} fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
      <circle cx={w - pad} cy={h - pad - ((pts.at(-1) - min) / et) * (h - 2 * pad)} r="4" fill="var(--raised)" stroke="var(--accent)" stroke-width="2.5" vector-effect="non-scaling-stroke" />
    </svg>
  );
}

let idDegrade = 0;
// Graphe avec échelle à droite (ChartScale) : 2 repères en petit (9 px), 3 sinon.
function Echelle({ vals, h, stops, taille, children }) {
  const [lo, hi] = bornesRondes(vals);
  const reperes = [[stops[0], hi], ...(taille >= 10 ? [[(stops[0] + stops[1]) / 2, (hi + lo) / 2]] : []), [stops[1], lo]];
  return (
    <div class="l4-echelle" style={{ height: `${h}px` }}>
      {children(lo, hi)}
      <div class="l4-axe" style={{ fontSize: `${taille}px`, marginLeft: `${taille}px` }} aria-hidden="true">
        {reperes.map(([y, v]) => <span key={y} style={{ marginTop: `${h * y}px` }}>{fmtAxe(v)}</span>)}
      </div>
    </div>
  );
}

// Sparkline des tuiles Volume et Poids : ligne grise fine, point final cerclé, valeurs d'axe à droite.
function Etincelle({ vals, h = 40 }) {
  const [ref, w] = useLargeur();
  if (vals.length < 2) return <div class="l4-etincelle" style={{ height: `${h}px` }} />;
  return (
    <div class="l4-etincelle">
      <Echelle vals={vals} h={h} stops={[0.15, 0.85]} taille={9}>
        {(lo, hi) => {
          const et = Math.abs(hi - lo) < 1e-6 ? 1 : hi - lo;
          const pts = vals.map((v, i) => [w * i / (vals.length - 1), h * (0.85 - ((v - lo) / et) * 0.7)]);
          const fin = pts.at(-1);
          return (
            <div class="l4-trace" ref={ref}>
              {w > 0 && <svg width={w} height={h} aria-hidden="true">
                <path d={pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} fill="none" stroke="var(--text2)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
                <circle cx={fin[0]} cy={fin[1]} r="4" fill="var(--raised)" stroke="var(--text2)" stroke-width="2.5" />
              </svg>}
            </div>
          );
        }}
      </Echelle>
    </div>
  );
}

// Courbe de la feuille du poids (TrendChart) : grille pointillée, aire en dégradé, point final avec halo, axe à droite.
function Tendance({ vals, h = 130, couleur = 'var(--info)' }) {
  const [ref, w] = useLargeur();
  const [id] = useState(() => `l4d${++idDegrade}`);
  return (
    <Echelle vals={vals} h={h} stops={[0.12, 0.88]} taille={10}>
      {(lo, hi) => {
        const et = Math.abs(hi - lo) < 1e-6 ? 1 : hi - lo;
        const pts = vals.map((v, i) => [6 + (w - 12) * i / (vals.length - 1), h * (0.88 - ((v - lo) / et) * 0.76)]);
        const ligne = cheminLisse(pts);
        const fin = pts.at(-1);
        return (
          <div class="l4-trace" ref={ref}>
            {w > 0 && <svg width={w} height={h} aria-hidden="true">
              <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: couleur, stopOpacity: 0.28 }} /><stop offset="1" style={{ stopColor: couleur, stopOpacity: 0 }} /></linearGradient></defs>
              {[0.12, 0.5, 0.88].map((f) => <line key={f} x1="0" x2={w} y1={h * f} y2={h * f} stroke="var(--border)" stroke-opacity="0.5" stroke-dasharray="3 4" />)}
              <path d={`${ligne} L${fin[0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`} fill={`url(#${id})`} />
              <path d={ligne} fill="none" stroke={couleur} stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
              <circle cx={fin[0]} cy={fin[1]} r="8" fill={couleur} fill-opacity="0.22" />
              <circle cx={fin[0]} cy={fin[1]} r="4.5" fill="var(--raised)" stroke={couleur} stroke-width="2.5" />
            </svg>}
          </div>
        );
      }}
    </Echelle>
  );
}

// Moyenne par semaine (ValueLineChart, fromZero false) : points étiquetés, dates en bas, objectif en pointillé.
function LigneValeurs({ vals, labels, objectif = null, h = 150, couleur = 'var(--info)' }) {
  const [ref, w] = useLargeur();
  const [id] = useState(() => `l4d${++idDegrade}`);
  const n = vals.length;
  const haut = 30, bas = h - 26;
  let lo = Math.min(...vals, ...(objectif != null ? [objectif] : [])), hi = Math.max(...vals, ...(objectif != null ? [objectif] : []));
  const marge = Math.max((hi - lo) * 0.25, Math.abs(hi) * 0.01 + 0.5);
  lo -= marge; hi += marge * 0.4;
  if (hi - lo < 1e-6) hi = lo + 1;
  const col = w / Math.max(1, n);
  const y = (v) => bas - ((v - lo) / (hi - lo)) * (bas - haut);
  const pts = vals.map((v, i) => [col * (i + 0.5), y(v)]);
  const ligne = n >= 2 ? cheminLisse(pts) : '';
  return (
    <div class="l4-valeurs" ref={ref} style={{ height: `${h}px` }}>
      {w > 0 && <svg width={w} height={h} aria-hidden="true">
        <defs><linearGradient id={id} x1="0" y1={haut} x2="0" y2={bas} gradientUnits="userSpaceOnUse"><stop offset="0" style={{ stopColor: couleur, stopOpacity: 0.26 }} /><stop offset="1" style={{ stopColor: couleur, stopOpacity: 0 }} /></linearGradient></defs>
        <line x1="0" x2={w} y1={bas + 0.5} y2={bas + 0.5} stroke="var(--border)" stroke-opacity="0.6" />
        {objectif != null && <line x1="0" x2={w} y1={y(objectif)} y2={y(objectif)} stroke="var(--text3)" stroke-opacity="0.7" stroke-width="1.2" stroke-dasharray="4 4" />}
        {n >= 2 && <>
          <path d={`${ligne} L${pts.at(-1)[0].toFixed(1)},${bas} L${pts[0][0].toFixed(1)},${bas} Z`} fill={`url(#${id})`} />
          <path d={ligne} fill="none" stroke={couleur} stroke-opacity="0.14" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" />
          <path d={ligne} fill="none" stroke={couleur} stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
        </>}
        {pts.map(([x, py], i) => <g key={i}>
          <circle cx={x} cy={py} r="4" fill="var(--raised)" stroke={couleur} stroke-width="2.2" />
          <text x={x} y={py - 15} text-anchor="middle" dominant-baseline="central" class="l4-v-val">{fmtAxe(vals[i])}</text>
          <text x={x} y={h - 8} text-anchor="middle" class="l4-v-lib">{labels[i]}</text>
        </g>)}
      </svg>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Régularité : teintes, heatmap, série, semaine courante              */
/* ------------------------------------------------------------------ */
function CarteRegularite({ seances, profil, ouvrirJour }) {
  const Xl = X();
  // Semaines ou année : réglage « Portée de la carte de chaleur » des Paramètres (settings_screen.dart, heatRange), pas de bascule dans la carte.
  const annee = lireM13().porteeChaleur === 'annee';
  const nbSem = annee ? 52 : 12;
  const [teinteOuv, setTeinteOuv] = useState(false);
  const teinte = profil.extensions?.preferences?.teinteCarteChaleur ?? 'ember';
  const objectif = profil.objectif_semaine || 4;

  const vols = parJour(seances, (s) => Math.max(1, bilanSeance(s.donnees).volume));
  const dates = parJour(seances, () => 1);
  const joursSem = new Set(semaine(seances).map((s) => jourDe(s.debut))).size;

  const serie = serieJours(seances);

  const maxVol = Math.max(1, ...vols.values());
  const niveau = (v) => { const r = v / maxVol; return r <= 0.25 ? 1 : r <= 0.5 ? 2 : r <= 0.75 ? 3 : 4; };

  const debut = lundi(); debut.setDate(debut.getDate() - 7 * (nbSem - 1));
  const auj = jourLocal(new Date());
  const semaines = Array.from({ length: nbSem }, (_, w) => { const d = new Date(debut); d.setDate(d.getDate() + w * 7); return d; });
  const initiales = langueApp === 'fr' ? ['L', 'M', 'M', 'J', 'V', 'S', 'D'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const fmtMois = new Intl.DateTimeFormat(langueApp === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' });
  const defile = useRef(null);
  useEffect(() => { if (annee && defile.current) defile.current.scrollLeft = defile.current.scrollWidth; }, [annee]);

  // Libellés des mois au-dessus des colonnes (charts.dart:Heatmap), « 2026 » en janvier sur la vue annuelle.
  const moisLib = [];
  let dernierMois = null;
  semaines.forEach((d, col) => {
    const m = d.getMonth();
    if (m !== dernierMois && (col > 0 || d.getDate() <= 7)) moisLib.push({ col, txt: annee && m === 0 ? String(d.getFullYear()) : fmtMois.format(d).replace('.', ''), an: annee && m === 0 });
    dernierMois = m;
  });
  const decal = annee ? 1 : 2; // première colonne de semaine dans la grille (la colonne 1 porte les jours en vue 12 sem.)

  // Rampe de la teinte choisie (Braise par défaut), même dégradé que la pastille de l'en-tête.
  const rampeGrille = RAMPE_HEAT[teinte] ?? RAMPE_HEAT.ember;
  const grille = (
    <div class={`m04-hm-grille ${annee ? 'grand' : ''}`} style={{ gridTemplateColumns: annee ? `repeat(${nbSem}, 13px)` : `16px repeat(${nbSem}, minmax(0, 1fr))`, '--heat-1': rampeGrille[0], '--heat-2': rampeGrille[1], '--heat-3': rampeGrille[2], '--heat-4': rampeGrille[3] }} role="group" aria-label={Xl.regularite}>
      {moisLib.map(({ col, txt, an }) => <span key={`m${col}`} class={`m04-hm-mois ${an ? 'an' : ''}`} style={{ gridRow: 1, gridColumn: col + decal }} aria-hidden="true">{txt}</span>)}
      {!annee && initiales.map((x, j) => <span key={`j${j}`} class="m04-hm-jour" style={{ gridRow: j + 2, gridColumn: 1 }} aria-hidden="true">{x}</span>)}
      {initiales.map((_, j) => semaines.map((dSem, col) => {
        const d = new Date(dSem); d.setDate(d.getDate() + j);
        const k = jourLocal(d);
        const v = vols.get(k) ?? 0;
        const niveauCl = k > auj ? 'futur' : v ? `n${niveau(v)}` : 'zero';
        return <button key={`${j}-${k}`} type="button" class={niveauCl} style={{ gridRow: j + 2, gridColumn: col + decal }} aria-label={`${dateLongue(k)}${v ? '' : ''}`} disabled={k > auj} onClick={() => ouvrirJour(k)} />;
      }))}
    </div>
  );

  return (
    <section class="m04-carte">
      <div class="m04-tete-carte">
        <Kicker>{Xl.regularite}</Kicker>
        <button type="button" class="m04-teintes" aria-label={Xl.choixCouleur} onClick={() => setTeinteOuv(true)}>
          {RAMPE_HEAT[teinte].slice(1).map((c) => <i key={c} style={{ background: c }} />)}
          <Ic n="caret-down" taille={12} />
        </button>
      </div>
      {annee ? (
        <div class="m04-hm-annee">
          <div class="m04-hm-jours" aria-hidden="true">{initiales.map((x, j) => <span key={j}>{x}</span>)}</div>
          <div class="m04-hm-defile" ref={defile}>{grille}</div>
        </div>
      ) : <div class="m04-hm-douze">{grille}</div>}
      <div class="m04-heat-pied">
        <Ic n="fire:fill" taille={14} />
        <span>{Xl.serieJours(serie)}</span>
        <span class="droite">{Xl.cetteSemaine(joursSem, objectif)}</span>
      </div>
      <FeuilleTeinte ouverte={teinteOuv} fermer={() => setTeinteOuv(false)} teinte={teinte} />
    </section>
  );
}

const RAMPES_CSS = ['ember', 'green', 'blue', 'mono'];
// Feuille « Couleur de chaleur » (progress_screen.dart:_HeatToneSheet) : choix immédiat, enregistré sur le serveur.
function FeuilleTeinte({ ouverte, fermer, teinte }) {
  const Xl = X();
  const choisir = async (v) => {
    if (v === teinte) return;
    try { await sauverExtensions({ preferences: { teinteCarteChaleur: v } }); }
    catch { afficher(Xl.erreur, 'danger'); }
  };
  return (
    <Feuille ouverte={ouverte} fermer={fermer} titre={Xl.choixCouleur} sous={Xl.choixCouleurIndice}>
      <div class="pile">
        {RAMPES_CSS.map((v) => (
          <button key={v} type="button" class={`m04-teinte-ligne ${v === teinte ? 'actif' : ''}`} aria-pressed={v === teinte} onClick={() => choisir(v)}>
            <span class="m04-teinte-nuances">{RAMPE_HEAT[v].map((c) => <i key={c} style={{ background: c }} />)}</span>
            <span class="nom">{Xl.teintes[v]}</span>
            {v === teinte && <Ic n="check:bold" taille={16} />}
          </button>
        ))}
      </div>
    </Feuille>
  );
}

/* ------------------------------------------------------------------ */
/* Carte musculaire                                                    */
/* ------------------------------------------------------------------ */
const MUSCLES_LISTE = ['pectoraux', 'trapezes', 'epaules', 'dos', 'biceps', 'triceps', 'avant-bras', 'abdos', 'quadriceps', 'ischios', 'fessiers', 'mollets'];

// Récupération : même modèle que stats_state.dart (fatigue exponentielle, plein à 8).
const RECUP_HEURES = { pectoraux: 60, trapezes: 48, epaules: 48, dos: 60, biceps: 48, triceps: 48, 'avant-bras': 36, abdos: 36, quadriceps: 72, ischios: 72, fessiers: 72, mollets: 36 };
const tauRecup = (m) => (RECUP_HEURES[m] ?? 48) / 3;
const effortSerie = (ser) => ser.rpe != null && ser.rpe !== '' ? Math.max(0.4, Math.min(1.3, (Number(ser.rpe) - 5) / 4)) : ser.type === 'f' ? 1.2 : 1;
function fatigueMuscles(seances) {
  const maintenant = Date.now();
  const fatigue = {};
  for (const s of seances) {
    const heures = (maintenant - enDate(s.debut).getTime()) / 3600000;
    if (heures < 0 || heures > 24 * 8) continue;
    for (const e of s.donnees?.exercices || []) {
      const def = trouverExercice(e.ex);
      if (!def) continue;
      const effort = (e.series || []).filter(COMPTER_SERIE).reduce((acc, ser) => acc + effortSerie(ser), 0);
      if (effort <= 0) continue;
      const ajoute = (m, part) => { fatigue[m] = (fatigue[m] ?? 0) + effort * part * Math.exp(-heures / tauRecup(m)); };
      ajoute(def.muscle, 1);
      for (const m of def.autres || []) ajoute(m, 0.5);
    }
  }
  return fatigue;
}
function recupMuscles(seances) {
  const fatigue = fatigueMuscles(seances);
  const recup = {};
  for (const m of MUSCLES_LISTE) recup[m] = Math.max(0, Math.min(1, 1 - (fatigue[m] ?? 0) / 8));
  return recup;
}
function heuresJusquaRecup(fatigue, muscle, cible) {
  const f = fatigue[muscle] ?? 0;
  const limite = 8 * (1 - cible);
  if (f <= limite) return null;
  return Math.ceil(tauRecup(muscle) * Math.log(f / limite));
}

function CarteMuscles({ seances, fr }) {
  const Xl = X();
  const [periode, setPeriode] = useState('7');
  const [selection, setSelection] = useState(null);
  const [etendu, setEtendu] = useState(false);
  const [recup, setRecup] = useState(false); // vue récupération

  const joursNb = periode === '7' ? 7 : 30;
  const cibles = seriesParMuscle(seances, depuis(joursNb));
  const ciblesTout = seriesParMuscle(seances, 0);
  const maxSets = Math.max(1, ...Object.values(cibles));

  const rampe = RAMPE_HEAT[etat.value.profil.extensions?.preferences?.teinteCarteChaleur] ?? RAMPE_HEAT.ember;
  const couleurHeat = (n) => (n > 0 ? rampe[n - 1] : idle);
  // Heures depuis le dernier travail de chaque muscle (séances de la plus récente à la plus ancienne).
  const heuresDepuis = (m) => {
    for (const s of seances) {
      const n = (s.donnees?.exercices || []).filter((e) => { const def = trouverExercice(e.ex); return def && (def.muscle === m || (def.autres || []).includes(m)); }).length;
      if (n) return (Date.now() - enDate(s.debut).getTime()) / 3600000;
    }
    return null;
  };
  const recupVals = recup ? recupMuscles(seances) : null;
  const fatigue = recup ? fatigueMuscles(seances) : null;
  const recupGlobale = recup ? Math.round((MUSCLES_LISTE.reduce((a, m) => a + recupVals[m], 0) / MUSCLES_LISTE.length) * 100) : 0;
  const encoreFatigues = recup ? MUSCLES_LISTE.filter((m) => recupVals[m] < 0.8).sort((a, b) => recupVals[a] - recupVals[b]) : [];

  const intensites = {};
  const couleurs = {};
  let lecture = null;
  for (const m of MUSCLES_LISTE) {
    const sets = cibles[m] ?? 0;
    const cible = 12 * joursNb / 7;
    if (recup) {
      intensites[m] = recupVals[m];
      couleurs[m] = couleurRecup(recupVals[m]);
    } else if (periode === 'neg') {
      const h = heuresDepuis(m);
      intensites[m] = h == null ? null : Math.floor(h / 24);
      couleurs[m] = couleurNeglige(intensites[m]);
    } else {
      intensites[m] = sets === 0 ? 0 : Math.max(1, Math.min(4, Math.ceil((sets / cible) * 4)));
      couleurs[m] = couleurHeat(intensites[m]);
    }
    if (m === selection) lecture = { m, sets: Math.round(sets), tout: Math.round(ciblesTout[m] ?? 0) };
  }
  if (!lecture) lecture = { m: null, sets: 0, tout: 0 };

  const joursDepuis = (m) => { const h = heuresDepuis(m); return h == null ? null : Math.floor(h / 24); };
  const cibleMuscle = 12 * joursNb / 7;
  const enRetard = periode === 'neg' || recup ? [] : MUSCLES_LISTE.filter((m) => (cibles[m] ?? 0) < cibleMuscle / 3).sort((a, b) => (cibles[a] ?? 0) - (cibles[b] ?? 0)).slice(0, 3);
  const enAttente = periode === 'neg' ? MUSCLES_LISTE.filter((m) => (joursDepuis(m) ?? 1e6) >= 7).sort((a, b) => (joursDepuis(b) ?? 1e6) - (joursDepuis(a) ?? 1e6)).slice(0, 3) : [];
  const aucuneSeance = seances.length === 0;

  const frLegend = recup ? (fr ? 'Fatigué' : 'Tired') : periode === 'neg' ? (fr ? 'Récent' : 'Recent') : Xl.heatFaible;
  const finLegend = recup ? (fr ? 'Frais' : 'Fresh') : periode === 'neg' ? (fr ? 'Longtemps' : 'Long ago') : (fr ? 'Volume maximal' : 'Full volume');
  const nuancier = recup ? [0, 1, 2, 3, 4].map((i) => couleurRecup(i / 4)) : periode === 'neg' ? [1, 5, 9, 15].map(couleurNeglige) : [0, 1, 2, 3, 4].map(couleurHeat);
  const quand = (h) => (h < 48 ? `${h} h` : `${Math.round(h / 24)} ${Xl.joursUnite}`);

  return (
    <section class="m04-carte m04-muscles">
      <div class="m04-tete-carte">
        <Kicker>{Xl.carteMuscles}</Kicker>
      </div>
      <div class="m04-seg-gauche">
        <div class="m04-seg" role="radiogroup" aria-label={Xl.carteMuscles}>
          <button type="button" aria-pressed={periode === '7'} onClick={() => { setRecup(false); setPeriode('7'); }}>{Xl.semaine}</button>
          <button type="button" aria-pressed={periode === '30' && !recup} onClick={() => { setRecup(false); setPeriode('30'); }}>{Xl.jours30}</button>
          <button type="button" aria-pressed={recup} onClick={() => { setRecup(true); setPeriode('30'); }}>{Xl.recuperation}</button>
          <button type="button" aria-pressed={periode === 'neg'} onClick={() => { setRecup(false); setPeriode('neg'); }}>{Xl.negliges}</button>
        </div>
      </div>
      {recup && (
        <div class="m04-recup-globale">
          <svg class="m04-anneau" viewBox="0 0 46 46" aria-hidden="true">
            <circle cx="23" cy="23" r="20.75" fill="none" stroke="var(--raised2)" stroke-width="4.5" />
            <circle cx="23" cy="23" r="20.75" fill="none" stroke={couleurRecup(recupGlobale / 100)} stroke-width="4.5" stroke-linecap="round"
              stroke-dasharray={`${(recupGlobale / 100) * 130.38} 130.38`} transform="rotate(-90 23 23)" />
          </svg>
          <div class="m04-recup-texte">
            <b>{Xl.recuperationGlobale(recupGlobale)}</b>
            <span>{encoreFatigues.length === 0 ? Xl.recuperationToutFrais : Xl.encoreEnRecuperation(encoreFatigues.slice(0, 3).map(nomMuscle).join(' · '))}</span>
          </div>
        </div>
      )}
      <div class="m04-silhouettes">
        <SilhouetteSvg mode="heat" vueInitiale="both" selection={selection ? [selection] : []} onToggle={setSelection} intensites={intensites} couleurs={couleurs} lang={langueApp} />
      </div>
      <div class="m04-legende">
        <span>{frLegend}</span>
        {nuancier.map((c, n) => <i key={n} style={{ background: c }} />)}
        <span>{finLegend}</span>
      </div>
      <div class={recup ? 'm04-lecture m04-lecture-recup' : 'm04-lecture'}>
        {recup ? (
          selection ? (() => {
            const v = recupVals[selection];
            const [etat, couleur] = v < 0.5 ? [Xl.etatFatigue, DANGER] : v < 0.8 ? [Xl.etatMilieu, WARN] : [Xl.etatPret, SAGE];
            const versMilieu = v < 0.5 ? heuresJusquaRecup(fatigue, selection, 0.5) : null;
            const versPret = v < 0.8 ? heuresJusquaRecup(fatigue, selection, 0.8) : null;
            return (
              <>
                <div class="m04-recup-tete">
                  <b>{nomMuscle(selection)}</b>
                  <span class="m04-pastille" style={{ color: couleur, background: `color-mix(in srgb, ${couleur} 14%, transparent)` }}>{etat}</span>
                  <span class="m04-recup-pct">{Math.round(v * 100)}%</span>
                </div>
                <div class="m04-jauge-recup">
                  <i class="zone zone-fatigue" /><i class="zone zone-milieu" /><i class="zone zone-pret" />
                  <i class="curseur" style={{ left: `clamp(0%, ${v * 100}%, calc(100% - 14px))`, background: couleurRecup(v) }} />
                </div>
                <div class="m04-recup-quand">
                  {[versMilieu != null && Xl.recupDans(quand(versMilieu)), versPret != null && Xl.pretDans(quand(versPret)), versPret == null && Xl.pretMaintenant].filter(Boolean).join(' · ')}
                </div>
              </>
            );
          })() : (
            <span class="m04-recup-indice">{Xl.indiceRecup}</span>
          )
        ) : periode === 'neg' ? (
          selection ? (
            <>
              <span class="point" style={{ background: couleurs[selection] }} />
              <b>{nomMuscle(selection)}</b>
              <span>{joursDepuis(selection) == null ? Xl.negligesJamais : Xl.negligesTravaille(joursDepuis(selection))}</span>
            </>
          ) : (
            <span>{aucuneSeance ? Xl.muscleMapVide : enAttente.length === 0 ? Xl.negligesTousRecents : Xl.negligesAttente(enAttente.map(nomMuscle).join(' · '))}</span>
          )
        ) : selection ? (
          <>
            <span class="point" style={{ background: couleurs[selection] }} />
            <b>{nomMuscle(selection)}</b>
            <span>{Xl.onCompte(Math.round(cibles[selection] ?? 0))}</span>
            <span class="muted">{Xl.deObjectif(Math.round(((cibles[selection] ?? 0) / (12 * joursNb / 7)) * 100))}</span>
          </>
        ) : (
          <span>{aucuneSeance ? Xl.muscleMapVide : enRetard.length === 0 ? Xl.muscleMapIndice : Xl.muscleEnRetard(enRetard.map(nomMuscle).join(' · '))}</span>
        )}
      </div>
      {!recup && periode !== 'neg' && (
        <button type="button" class="m04-liste-tete" aria-expanded={etendu} onClick={() => setEtendu(!etendu)}>
          <span>{Xl.muscleSetsList}</span>
          <Ic n="caret-down" taille={14} />
        </button>
      )}
      {!recup && periode !== 'neg' && etendu && (
        <div class="m04-liste">
          {MUSCLES_LISTE.map((m) => {
            const sets = Math.round(cibles[m] ?? 0);
            const actif = selection === m;
            return (
              <button key={m} type="button" class={actif ? 'actif' : ''} onClick={() => setSelection(m)}>
                <span class="point" style={{ background: couleurs[m] }} />
                <span class="nom">{nomMuscle(m)}</span>
                <span class="jauge"><i style={{ width: `${Math.min(100, (sets / maxSets) * 100)}%`, background: couleurs[m] }} /></span>
                <span class="nb">{sets}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Radar 12 axes                                                       */
/* ------------------------------------------------------------------ */
const AXES_RADAR = [
  { id: 'pectoraux', muscles: ['pectoraux'] },
  { id: 'epaules', muscles: ['epaules'] },
  { id: 'trapezes', muscles: ['trapezes'] },
  { id: 'dos', muscles: ['dos', 'lombaires'] },
  { id: 'triceps', muscles: ['triceps'] },
  { id: 'biceps', muscles: ['biceps'] },
  { id: 'avant-bras', muscles: ['avant-bras'] },
  { id: 'abdos', muscles: ['abdos', 'obliques'] },
  { id: 'quadriceps', muscles: ['quadriceps'] },
  { id: 'mollets', muscles: ['mollets'] },
  { id: 'ischios', muscles: ['ischios'] },
  { id: 'fessiers', muscles: ['fessiers'] },
];

function CarteRadar({ seances, fr }) {
  const Xl = X();
  const [actif, setActif] = useState(null);
  const cibles = seriesParMuscle(seances, depuis(30));
  const vals = AXES_RADAR.map((a) => a.muscles.reduce((acc, m) => acc + (cibles[m] ?? 0), 0));
  const max = Math.max(1, ...vals);
  const total = vals.reduce((a, b) => a + b, 0);
  // muscle_radar.dart : figure de 16,5 % du côté, écart de 6, rayon = côté / 2 - écart - figure.
  const cx = 160, cy = 160, n = 12, fig = 320 * 0.165, ecart = 6, r = 160 - ecart - fig;
  const angle = (i) => (-Math.PI / 2) + (i * 2 * Math.PI) / n;
  const pt = (i, fact) => { const rr = r * fact; return [cx + rr * Math.cos(angle(i)), cy + rr * Math.sin(angle(i))]; };

  if (!total) {
    return (
      <section class="m04-carte">
        <Kicker>{Xl.radarTitre}</Kicker>
        <Vide n="chart-line-up" titre={Xl.radarVide} />
      </section>
    );
  }
  const grille = [0.25, 0.5, 0.75, 1].map((f) => {
    const d = AXES_RADAR.map((_, i) => { const [x, y] = pt(i, f); return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ');
    return <path key={f} class="grille" d={`${d} Z`} />;
  });
  const rayons = AXES_RADAR.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} class="rayon" x1={cx} y1={cy} x2={x} y2={y} />; });
  const dataD = vals.map((v, i) => { const [x, y] = pt(i, v / max); return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ');

  return (
    <section class="m04-carte">
      <Kicker>{Xl.radarTitre}</Kicker>
      <svg class="m04-radar" viewBox="0 0 320 320" role="img" aria-label={Xl.radarIndice}>
        {grille}
        {rayons}
        <path class="forme" d={`${dataD} Z`} />
        {AXES_RADAR.map((a, i) => {
          const lib = Xl.radarAxes[a.id] ?? a.id;
          const bascule = () => setActif(actif === a.id ? null : a.id);
          // Position de la figure (_figure) : centre du contenu poussé au-delà du rayon selon sa largeur et sa hauteur.
          const { cadre, contenu } = cadreFigure(a.id);
          const k = fig / cadre[2], an = angle(i);
          const loin = r + ecart + (Math.abs(Math.cos(an)) * contenu[2] + Math.abs(Math.sin(an)) * contenu[3]) * k / 2;
          const x = cx + Math.cos(an) * loin - (contenu[0] + contenu[2] / 2 - cadre[0]) * k;
          const y = cy + Math.sin(an) * loin - (contenu[1] + contenu[3] / 2 - cadre[1]) * k;
          return (
            <g key={a.id} role="button" tabIndex={0} aria-pressed={actif === a.id} aria-label={`${lib} · ${Xl.deSeries(Math.round(vals[i]))}`} class="axe-zone" onClick={bascule}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bascule(); } }}>
              <rect x={x} y={y} width={fig} height={fig} fill="transparent" />
              <FigureMuscle id={a.id} x={x} y={y} taille={fig} />
            </g>
          );
        })}
      </svg>
      <p class="m04-radar-lecture">
        {actif ? (
          <>{Xl.radarFocus(Xl.radarAxes[actif])} · {Xl.deSeries(vals[AXES_RADAR.findIndex((a) => a.id === actif)])}</>
        ) : (
          total > 0 ? <span class="muted">{Xl.radarEquilibre}</span> : <span class="muted">{Xl.radarVide}</span>
        )}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Cette semaine                                                       */
/* ------------------------------------------------------------------ */
const POUSSE = new Set(['pectoraux', 'epaules', 'triceps']), TIRE = new Set(['dos', 'biceps', 'trapezes']);
/** weekInsights : charge inhabituelle, muscle oublié, poussée contre tirage, exercice en progrès (trois au plus). */
export function insightsSemaine(seances, maintenant = new Date()) {
  const I = L26();
  const auj = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const age = (s) => Math.round((auj - (() => { const d = enDate(s.debut); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); })()) / JOUR);
  const travail = (e) => (e.series || []).filter(COMPTER_SERIE);
  const dernier = {}, visites = {}, recents = new Set();
  let pousse = 0, tire = 0;
  for (const s of seances) {
    const a = age(s);
    if (a < 0 || a > 56) continue;
    const vus = new Set();
    for (const e of s.donnees?.exercices || []) {
      const def = trouverExercice(e.ex);
      const n = travail(e).length;
      if (!n || !def || def.muscle === 'cardio' || def.muscle === 'corps') continue;
      vus.add(def.muscle);
      if (dernier[def.muscle] == null || a < dernier[def.muscle]) dernier[def.muscle] = a;
      if (a <= 28) {
        if (POUSSE.has(def.muscle)) pousse += n;
        if (TIRE.has(def.muscle)) tire += n;
        if (def.mesure === 'poids') recents.add(e.ex);
      }
    }
    for (const m of vus) visites[m] = (visites[m] ?? 0) + 1;
  }
  const out = [];
  const debut = lundi(maintenant);
  const semaines = [0, 0, 0, 0, 0];
  for (const s of seances) {
    const d = enDate(s.debut);
    if (d > maintenant) continue;
    const recul = Math.round((debut - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / JOUR);
    const i = recul <= 0 ? 0 : 1 + Math.floor((recul - 1) / 7);
    if (i < 5) semaines[i] += (s.donnees?.exercices || []).reduce((t, e) => t + travail(e).length, 0);
  }
  const avant = semaines.slice(1).filter((w) => w > 0);
  if (avant.length >= 3 && semaines[0] >= 12) {
    const moy = avant.reduce((x, y) => x + y, 0) / avant.length;
    if (semaines[0] >= moy * 1.5) out.push({ genre: 'load', texte: I.insightCharge(Math.round((semaines[0] / moy - 1) * 100)) });
  }
  let oublie = null, ecart = 13;
  for (const [m, a] of Object.entries(dernier)) if ((visites[m] ?? 0) >= 2 && a > ecart) { ecart = a; oublie = m; }
  if (oublie) out.push({ genre: 'muscle', texte: I.insightMuscle(nomMuscle(oublie), ecart) });
  if (pousse + tire >= 20) {
    if (pousse >= tire * 1.6) out.push({ genre: 'balance', texte: I.insightPousse(pousse, tire) });
    else if (tire >= pousse * 1.6) out.push({ genre: 'balance', texte: I.insightTire(tire, pousse) });
  }
  let meilleur = null, gain = 0.03;
  for (const id of recents) {
    let now = 0, then = 0;
    for (const s of seances) {
      const a = age(s);
      if (a < 0 || a > 90) continue;
      for (const e of s.donnees?.exercices || []) if (e.ex === id) for (const x of travail(e)) {
        if (!x.kg) continue;
        const rm = unRM(x.kg, x.r);
        if (a <= 28) now = Math.max(now, rm); else then = Math.max(then, rm);
      }
    }
    if (then <= 0 || now <= 0) continue;
    if (now / then - 1 > gain) { gain = now / then - 1; meilleur = id; }
  }
  if (meilleur) out.push({ genre: 'up', texte: I.insightProgres(nomExercice(trouverExercice(meilleur)), Math.round(gain * 100)), ex: meilleur });
  return out.slice(0, 3);
}

function CarteSemaine({ seances, fr }) {
  const Xl = X();
  const debut = lundi();
  const parJourSets = parJour(seances.filter((s) => enPlage(s, debut.getTime())), (s) => (s.donnees?.exercices || []).reduce((a, e) => a + (e.series || []).filter(COMPTER_SERIE).length, 0));
  const setsSem = [...parJourSets.values()].reduce((a, b) => a + b, 0);
  const dernier = parJour(seances.filter((s) => enPlage(s, debut.getTime() - 7 * JOUR) && !enPlage(s, debut.getTime())), (s) => (s.donnees?.exercices || []).reduce((a, e) => a + (e.series || []).filter(COMPTER_SERIE).length, 0));
  const setsPrec = [...dernier.values()].reduce((a, b) => a + b, 0);
  const max = Math.max(1, setsSem, setsPrec);
  const auj = new Date(); const idxAuj = (auj.getDay() + 6) % 7; // lundi = 0
  const noms = fr ? ['L', 'M', 'M', 'J', 'V', 'S', 'D'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <section class="m04-carte">
      <div class="m04-tete-carte">
        <Kicker>{Xl.cetteSemaineTitre}</Kicker>
      </div>
      <div class="m04-barres">
        {Array.from({ length: 7 }, (_, i) => {
          const d = new Date(debut); d.setDate(d.getDate() + i);
          const v = parJourSets.get(jourLocal(d)) ?? 0;
          const hh = (v / max) * 100;
          return (
            <div key={i} title={dateCourte(jourLocal(d))}>
              {v > 0 && <span class={`nb ${i === idxAuj ? 'auj' : ''}`}>{v}</span>}
              <i class={v === 0 ? 'zero' : i === idxAuj ? 'auj' : ''} style={{ height: `${Math.max(hh, v ? 8 : 2)}%` }} />
            </div>
          );
        })}
      </div>
      <div class="m04-jours">
        {noms.map((nom, i) => <span key={i} class={i === idxAuj ? 'auj' : ''}>{nom}</span>)}
      </div>
      {/* Constats de la semaine (stats_state.dart weekInsights, progress_screen.dart _insight) : trois au plus. */}
      {insightsSemaine(seances).map((n, i) => {
        const ligne = <>
          <span class={`rond-ic ${n.genre === 'up' ? 'haut' : ''}`}><Ic n={{ load: 'gauge', muscle: 'clock-counter-clockwise', balance: 'scales' }[n.genre] ?? 'trend-up'} taille={15} /></span>
          <p>{n.texte}</p>
          {n.ex && <Ic n="caret-right:bold" taille={12} />}
        </>;
        return n.ex ? <a key={i} class="m04-indice l26-insight" href={`#/exercice/${n.ex}`}>{ligne}</a> : <div key={i} class="m04-indice">{ligne}</div>;
      })}
      {setsSem === 0 && <p class="m04-sous">{Xl.equipements}</p>}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Force (1RM)                                                         */
/* ------------------------------------------------------------------ */
function CarteForce({ seances, fr }) {
  const Xl = X();
  const poidsCorps = etat.value.poids.at(-1)?.kg ? Number(etat.value.poids.at(-1).kg) : null;
  const candidats = [...new Set(seances.flatMap((s) => (s.donnees?.exercices || []).map((e) => e.ex)))]
    .map((ex) => trouverExercice(ex)).filter((d) => d && d.mesure === 'poids');
  const [idExo, setIdExo] = useState(() => candidats.find((d) => meilleures(d.id, seances).kg)?.id ?? candidats[0]?.id ?? null);
  const def = trouverExercice(idExo);
  const evo = idExo ? forceParSeance(seances, idExo) : [];
  const courant = evo.at(-1);
  const precedent = evo.at(-2);
  const delta = courant && precedent ? ((courant.kg - precedent.kg) / precedent.kg) * 100 : 0;
  const rel = poidsCorps && courant ? courant.kg / poidsCorps : null;
  const niveau = rel ? Math.min(5, Math.max(1, Math.floor(rel / 0.5) + 1)) : 1;
  const versSuiv = rel ? Math.min(100, ((rel - (niveau - 1) * 0.5) / 0.5) * 100) : 0;

  if (!def || !courant) {
    return (
      <section class="m04-carte">
        <div class="m04-tete-carte"><Kicker>{Xl.force1RM}</Kicker></div>
        <Vide n="barbell" titre={Xl.forceVide} />
      </section>
    );
  }
  const changerExo = () => { const i = candidats.findIndex((d) => d.id === idExo); setIdExo(candidats[(i + 1) % candidats.length].id); };

  return (
    <section class="m04-carte">
      <div class="m04-tete-carte">
        <Kicker>{Xl.force1RM}</Kicker>
        <button type="button" class="m04-change" aria-label={Xl.forceChoisir} onClick={changerExo}><Ic n="arrow-counter-clockwise" taille={15} /></button>
      </div>
      <div class="m04-exo-tete">
        <span class="m04-vignette"><IllustrationExercice exo={def} taille={40} /></span>
        <strong>{nomExercice(def)}</strong>
      </div>
      <div class="m04-force-valeur">
        <b>{poids(courant.kg)}</b><small>{unite()}</small>
        {precedent && (
          <span class={`m04-pastille-delta ${delta >= 0 ? 'haut' : 'bas'}`}>
            <Ic n={delta >= 0 ? 'chart-line-up' : 'chart-bar'} taille={12} />{nombre(delta >= 0 ? delta : -delta, 1)}%
          </span>
        )}
      </div>
      {rel !== null && (
        <div class="m04-relative">
          <div class="m04-relative-ligne">
            <span>{Xl.forceRelative(rel.toFixed(2))}</span>
            <b>{Xl.forceNiveau(niveau)}</b>
          </div>
          <div class="m04-relative-barres">
            {[1, 2, 3, 4, 5].map((n) => (
              <i key={n}><span style={{ width: n < niveau ? '100%' : n === niveau ? `${versSuiv}%` : '0%' }} /></i>
            ))}
          </div>
        </div>
      )}
      <div class="m04-tendance">
        <MiniLigne pts={evo.map((e) => e.kg)} h={88} classe="m04-tendance" />
      </div>
      <div class="m04-tendance-pied">
        <span>{dateCourte(courant.date)}</span>
        {versSuiv < 100 && <span>{Xl.forceVersSuivant(Math.round(versSuiv))}</span>}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Records                                                             */
/* ------------------------------------------------------------------ */
// Équilibre de force (stats_state.dart _structuralBalance et progress_screen.dart _BalanceCard) : meilleurs 1RM estimés
// des 120 derniers jours rapportés à des proportions classiques ; la médiane des 1RM « ramenés au squat » sert de référence.
export const LEVEES_EQUILIBRE = [
  ['squat-a-la-barre', 1.0, ['squat-a-la-barre']],
  ['souleve-de-terre', 1.2, ['souleve-de-terre']],
  ['developpe-couche-a-la-barre', 0.75, ['developpe-couche-a-la-barre']],
  ['rowing-barre-penche', 0.52, ['rowing-barre-penche']],
  ['developpe-militaire-a-la-barre', 0.45, ['developpe-militaire-a-la-barre', 'a-la-barre-assis-nuque-developpe']],
];
export function equilibreForce(seances, maintenant = Date.now()) {
  const depuisMs = maintenant - 120 * JOUR;
  const trouves = [];
  for (const [id, ratio, ids] of LEVEES_EQUILIBRE) {
    let best = 0;
    for (const s of seances) {
      if (enDate(s.debut).getTime() < depuisMs) continue;
      for (const e of s.donnees?.exercices || []) if (ids.includes(e.ex)) for (const ser of e.series || []) if (COMPTER_SERIE(ser) && ser.kg) best = Math.max(best, unRM(ser.kg, ser.r));
    }
    if (best > 0) trouves.push({ id, ratio, kg: best });
  }
  if (trouves.length < 3) return null;
  const implicite = trouves.map((f) => f.kg / f.ratio).sort((a, b) => a - b);
  const n = implicite.length;
  const milieu = n % 2 ? implicite[(n - 1) / 2] : (implicite[n / 2 - 1] + implicite[n / 2]) / 2;
  const levees = trouves.map((f) => ({ id: f.id, kg: f.kg, cible: milieu * f.ratio, score: f.kg / (milieu * f.ratio) }));
  const bas = levees.reduce((a, b) => (a.score <= b.score ? a : b));
  return { levees, retard: bas.score < 0.9 ? bas.id : null };
}

function CarteEquilibre({ seances }) {
  const Xl = X();
  const [pourquoi, setPourquoi] = useState(false);
  const d = equilibreForce(seances);
  if (!d) return null;
  const nom = (id) => { const ex = trouverExercice(id); return ex ? nomExercice(ex) : id; };
  const kgLib = (v) => `${poids(v)} ${unite()}`;
  const r = d.retard ? d.levees.find((l) => l.id === d.retard) : null;
  return (
    <section class="m04-carte l26-equilibre">
      <div class="m04-tete-carte">
        <Kicker>{Xl.equilibreTitre}</Kicker>
        <button type="button" class="l26-info" aria-label={Xl.equilibrePourquoi} aria-expanded={pourquoi} onClick={() => setPourquoi(!pourquoi)}>
          <Ic n={pourquoi ? 'info:fill' : 'info'} taille={17} />
        </button>
      </div>
      <p class="l26-eq-titre">{r ? Xl.equilibreRetard(nom(r.id), kgLib(r.cible - r.kg)) : Xl.equilibreBon}</p>
      {pourquoi && <p class="l26-eq-aide">{Xl.equilibreAide}</p>}
      <div class="l26-eq-lignes">
        {d.levees.map((l) => {
          const ecart = l.cible - l.kg;
          const egal = l.score >= 0.95 && l.score <= 1.05;
          const pos = Math.max(0, Math.min(1, (l.score - 0.6) / 0.8));
          const coul = l.id === d.retard ? WARN : l.score < 0.95 ? melange('var(--text2)', WARN, 0.4) : SAGE;
          return (
            <div class="l26-eq-ligne" key={l.id}>
              <div class="l26-eq-tete">
                <span>{nom(l.id)}</span>
                <b style={{ color: egal ? 'var(--text2)' : coul }}>{egal ? Xl.equilibreEgal : ecart > 0 ? `−${kgLib(ecart)}` : `+${kgLib(-ecart)}`}</b>
              </div>
              <div class="l26-eq-barre"><i style={{ left: `${Math.min(pos, 0.5) * 100}%`, width: `${Math.abs(pos - 0.5) * 100}%`, background: coul }} /></div>
            </div>
          );
        })}
      </div>
      <div class="l26-eq-bornes"><span>{Xl.equilibreDerriere}</span><span>{Xl.equilibreDevant}</span></div>
    </section>
  );
}

// Carte « Renseignez ces éléments » (progress_screen.dart _setupCard) : en haut sans séance, en bas s'il manque encore une étape.
function etapesDemarrage(seances) {
  return [
    ['seance', X().etapeSeance, seances.length > 0],
    ['poids', X().etapePoids, (etat.value.poids || []).length > 0],
    ['mesures', X().etapeMesures, (etat.value.mesures || []).length > 0],
    ['photo', X().etapePhoto, lirePoses().length > 0],
  ];
}
// Photos de progression de la chronologie (photos.jsx CLE_POSES), gardées sur l'appareil.
function lirePoses() { try { const v = JSON.parse(localStorage.getItem('an_m08_poses') ?? 'null'); return Array.isArray(v) ? v : []; } catch { return []; } }
function CarteDemarrage({ etapes, ouvrirPoids }) {
  const Xl = X();
  const aller = (cle) => {
    if (cle === 'seance') location.hash = '#/entrain';
    else if (cle === 'poids') ouvrirPoids();
    else if (cle === 'mesures') location.hash = '#/mesures';
    else location.hash = '#/chronologie';
  };
  return (
    <section class="l26-etapes">
      <p class="l26-etapes-titre">{Xl.etapesTitre}</p>
      <p class="l26-etapes-aide">{Xl.etapesAide}</p>
      <ul>
        {etapes.map(([cle, lib, fait]) => (
          <li key={cle}>
            {fait
              ? <span class="l26-etape fait"><Ic n="check-circle:fill" taille={17} /><span>{lib}</span></span>
              : <button type="button" class="l26-etape" onClick={() => aller(cle)}><Ic n="circle-dashed" taille={17} /><span>{lib}</span><Ic n="caret-right:bold" taille={13} /></button>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CarteRecords({ seances, fr }) {
  const Xl = X();
  const vus = new Set();
  const records = [];
  for (const s of seances) {
    for (const e of s.donnees?.exercices || []) {
      if (vus.has(e.ex)) continue;
      vus.add(e.ex);
      const def = trouverExercice(e.ex);
      const m = meilleures(e.ex, seances);
      if (def && (m.kg || m.s || m.reps)) records.push({ ex: e.ex, def, m, val: Number(m.kg) || Number(m.reps) || Number(m.s) });
    }
  }
  records.sort((a, b) => b.val - a.val);
  const [etendu, setEtendu] = useState(false);
  const vusVisible = etendu ? records : records.slice(0, 5);
  return (
    <section class="m04-carte">
      <div class="m04-tete-carte">
        <Kicker>{Xl.recordsPerso}</Kicker>
        <span class="m04-insigne"><Ic n="trophy:fill" taille={11} />{records.length}</span>
      </div>
      {records.length === 0 ? <Vide n="trophy" titre={Xl.aucunRecord} /> : (
        <>
          {vusVisible.map((r, i) => (
            <div class="m04-record" key={r.ex}>
              <span class="rang">
                <span class="m04-vignette"><IllustrationExercice exo={r.def} taille={40} /></span>
                {i < 3 && <span class={`m04-medaille ${i === 0 ? 'or' : i === 1 ? 'argent' : 'bronze'}`}>{i + 1}</span>}
              </span>
              <span class="txt">
                <strong>{nomExercice(r.def)}</strong>
                <small>{t.muscles[r.def.muscle]}</small>
              </span>
              <span class="val">{r.def.mesure === 'duree' ? minSec(r.m.s) : r.m.kg ? `${poids(r.m.kg)} ${unite()}` : `${r.m.reps} reps`}</span>
            </div>
          ))}
          {records.length > 5 && (
            <button type="button" class="m04-plus" aria-expanded={etendu} onClick={() => setEtendu(!etendu)}>
              {Xl.plusRecords(records.length - 5)}
              <Ic n="caret-down" taille={13} />
            </button>
          )}
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Mesures                                                             */
/* ------------------------------------------------------------------ */
const CLES_MESURE = ['cou', 'epaules', 'poitrine', 'bras', 'avant_bras', 'taille', 'hanches', 'cuisse', 'mollet', 'masse_grasse'];
const LABELS_MESURE = {
  cou: { fr: 'Cou', en: 'Neck' }, epaules: { fr: 'Épaules', en: 'Shoulders' }, poitrine: { fr: 'Poitrine', en: 'Chest' },
  bras: { fr: 'Bras', en: 'Arms' }, avant_bras: { fr: 'Avant-bras', en: 'Forearms' }, taille: { fr: 'Taille', en: 'Waist' },
  hanches: { fr: 'Hanches', en: 'Hips' }, cuisse: { fr: 'Cuisse', en: 'Thigh' }, mollet: { fr: 'Mollet', en: 'Calf' },
  masse_grasse: { fr: 'Masse grasse %', en: 'Body fat %' },
};

function CarteMesures({ fr, ouvrir }) {
  const Xl = X();
  const mesures = etat.value.mesures ?? [];
  const derniere = {};
  for (const m of mesures) if (!derniere[m.cle]) derniere[m.cle] = m;
  return (
    <section class="m04-carte">
      <div class="m04-tete-carte">
        <Kicker>{Xl.mesuresTitre}</Kicker>
        <button type="button" class="btn sm pri" onClick={ouvrir}><Ic n="plus:bold" taille={13} />{Xl.mesureAjouter}</button>
      </div>
      <div class="m04-mesures">
        {CLES_MESURE.map((cle) => {
          const row = derniere[cle];
          return (
            <div class="m04-mesure" key={cle}>
              <span>
                <strong>{fr ? LABELS_MESURE[cle].fr : LABELS_MESURE[cle].en}</strong>
                <small>{row ? dateCourte(row.prise_le) : Xl.nonRenseigne}</small>
              </span>
              {row ? <b>{cle === 'masse_grasse' ? `${nombre(row.valeur, 1)} %` : `${nombre(row.valeur, 1)} cm`}</b> : <span class="m04-non">-</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Bilan du mois + check-in                                            */
/* ------------------------------------------------------------------ */
function CarteMois({ seances, fr, ouvrir }) {
  const Xl = X();
  const now = new Date();
  const moisEncours = seances.filter((s) => { const d = enDate(s.debut); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); });
  const moisPrec = seances.filter((s) => { const d = enDate(s.debut); const m = new Date(now.getFullYear(), now.getMonth() - 1, 1); return d >= m && d < new Date(now.getFullYear(), now.getMonth(), 1); });
  const stats = (liste) => liste.reduce((a, s) => { const b = bilanSeance(s.donnees); return { seances: a.seances + 1, series: a.series + b.series, vol: a.vol + b.volume }; }, { seances: 0, series: 0, vol: 0 });
  const s = stats(moisEncours), p = stats(moisPrec);
  const note = p.seances === 0 ? null : s.seances > p.seances ? Xl.moisNoteHausse(s.seances - p.seances) : s.seances < p.seances ? Xl.moisNoteBaisse(p.seances - s.seances) : Xl.moisNoteEgal;
  return (
    <section class="m04-carte">
      <div class="m04-tete-carte">
        <Kicker>{Xl.bilanMoisTitre}</Kicker>
        <button type="button" class="btn sm" onClick={ouvrir}><Ic n="chart-line-up" taille={13} />{Xl.voirBilan}</button>
      </div>
      <div class="m04-mois-grille">
        <div><b>{s.seances}</b><span>{Xl.moisSeances}</span></div>
        <div><b>{nombre(s.series, 0)}</b><span>{Xl.moisSeries}</span></div>
        <div><b>{volume(s.vol).val}</b><span>{Xl.moisVolume}</span></div>
      </div>
      {note && <p class="m04-mois-note">{note}</p>}
    </section>
  );
}

// Le bilan du jour vit sur le compte (extensions.modules.checkin = { jours: { 'AAAA-MM-JJ': { d, e } }, ignore }) ;
// celui d'avant, gardé dans le navigateur, est repris une fois (l'original reste en place).
const JOURS_BILAN = 120;
const note5 = (n) => (Number.isInteger(n) && n >= 1 && n <= 5 ? n : 0);
function bilanDuNavigateur() {
  const jours = {};
  for (let i = 0; i < JOURS_BILAN; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const j = jourLocal(d);
    const v = lsGet(`m04:checkin:${j}`, null);
    if (v && (note5(v.d) || note5(v.e))) jours[j] = { d: note5(v.d), e: note5(v.e) };
  }
  const ig = lsGet('m04:checkin:ignore', null);
  return { jours, ignore: typeof ig === 'string' ? ig : '' };
}
function lireBilan() {
  const m = lireModule('checkin');
  return m && typeof m === 'object' && m.jours && typeof m.jours === 'object' ? { jours: m.jours, ignore: typeof m.ignore === 'string' ? m.ignore : '' } : bilanDuNavigateur();
}
const garderRecents = (jours) => Object.fromEntries(Object.entries(jours).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, JOURS_BILAN));
const ecrireBilan = (b) => ecrireModule('checkin', { jours: garderRecents(b.jours), ignore: b.ignore });

function CarteCheckIn() {
  const Xl = X();
  const auj = jourLocal(new Date());
  const bilan = lireBilan();
  const val = bilan.jours[auj] ?? { d: 0, e: 0 };
  const sauver = (b) => ecrireBilan(b).catch(() => afficher(t.commun.erreur, 'danger'));
  useEffect(() => {
    if (lireModule('checkin')?.jours) return;
    const ancien = bilanDuNavigateur();
    if (Object.keys(ancien.jours).length || ancien.ignore) ecrireBilan(ancien).catch(() => {});
  }, []);
  if (bilan.ignore === auj) return null;
  const changer = (cle, v) => sauver({ ...bilan, jours: { ...bilan.jours, [auj]: { ...val, [cle]: v } } });
  const moyenne = (cle) => {
    let somme = 0, n = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const v = bilan.jours[jourLocal(d)];
      if (v && v[cle]) { somme += v[cle]; n++; }
    }
    return n ? (somme / n).toFixed(1) : null;
  };
  const Barres = ({ cle, actif, classes, titre }) => (
    <div class={`m04-checkin-barres ${classes}`} role="group" aria-label={titre}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => changer(cle, n)} aria-label={Xl[`checkInN${n}`]} aria-pressed={actif === n}>
          <i class={actif >= n ? 'on' : ''} />
        </button>
      ))}
    </div>
  );
  return (
    <section class="m04-carte">
      <div class="m04-tete-carte">
        <Kicker>{Xl.checkInTitre}</Kicker>
        <button type="button" class="btn sm" onClick={() => sauver({ ...bilan, ignore: auj })}>{Xl.checkInIgnorer}</button>
      </div>
      <div class="m04-checkin-ligne">
        <Ic n="moon" taille={16} />
        <strong>{Xl.checkInSommeil}</strong>
        <small class={val.d ? 'actif' : ''}>{moyenne('d') ? `${Xl.checkInMoyenne}${dp()}${moyenne('d')}` : ''}</small>
      </div>
      <Barres cle="d" actif={val.d} classes="sommeil" titre={Xl.checkInSommeil} />
      <div class="m04-checkin-ligne">
        <Ic n="lightning" taille={16} />
        <strong>{Xl.checkInEnergie}</strong>
        <small class={val.e ? 'actif' : ''}>{moyenne('e') ? `${Xl.checkInMoyenne}${dp()}${moyenne('e')}` : ''}</small>
      </div>
      <Barres cle="e" actif={val.e} classes="energie" titre={Xl.checkInEnergie} />
      <p class="m04-sous">{Xl.checkInLocal}</p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Feuilles                                                            */
/* ------------------------------------------------------------------ */
// Feuille d'un jour (progress_screen.dart showDaySheet) : partagée avec l'accueil et l'historique.
export function FeuilleJournal({ jour, fermer }) {
  return jour ? <FeuilleJour jour={jour} fermer={fermer} /> : null;
}

function Regle({ valeur, onChange, min = 20, max = 250, pas = 0.5 }) {
  const ref = useRef(null);
  const total = Math.round((max - min) / pas);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ix = Math.round((valeur - min) / pas);
    el.scrollLeft = Math.max(0, ix * 11 - el.clientWidth / 2 + 5.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div class="m04-regle">
      <div class="m04-regle-defile" ref={ref} onScroll={() => {
        const el = ref.current; if (!el) return;
        const ix = Math.round((el.scrollLeft + el.clientWidth / 2 - 5.5) / 11);
        onChange(Math.min(max, Math.max(min, min + ix * pas)));
      }}>
        <div class="m04-regle-piste">
          {Array.from({ length: total + 1 }, (_, i) => {
            const v = min + i * pas;
            return (
              <span key={i} class={i % 10 === 0 ? 'maj' : ''}>
                <i />
                {i % 10 === 0 && <b>{nombre(v, 1)}</b>}
              </span>
            );
          })}
        </div>
      </div>
      <div class="m04-regle-curseur" />
    </div>
  );
}

// Rythme hebdomadaire (nutrition_state.dart:weightPace) : pente des pesées des 21 derniers jours, au moins 3 sur 7 jours.
export function rythmePoids(mesures, maintenant = Date.now()) {
  const pts = mesures.filter((m) => maintenant - enDate(m.jour).getTime() <= 21 * JOUR).sort((a, b) => enDate(a.jour) - enDate(b.jour));
  if (pts.length < 3 || (enDate(pts.at(-1).jour) - enDate(pts[0].jour)) / JOUR < 7) return null;
  const xs = pts.map((p) => (enDate(p.jour) - enDate(pts[0].jour)) / JOUR), ys = pts.map((p) => Number(p.kg));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  if (den <= 0 || my <= 0) return null;
  const kg = (num / den) * 7;
  return { kg, pct: (kg / my) * 100 };
}
// Couloirs en % par semaine (paceCorridors) et statut (weightPaceStatus).
const COULOIRS = { perte: [-1, -0.5], prise: [0.25, 0.5], maintien: [-0.25, 0.25] };
export function statutRythme(pct, vise) {
  const c = COULOIRS[vise];
  if (pct == null || !c) return null;
  if (pct >= c[0] && pct <= c[1]) return 'onPace';
  if (vise === 'maintien') return 'drifting';
  if (!(vise === 'perte' ? pct < 0 : pct > 0)) return 'wrongWay';
  return Math.abs(pct) > (vise === 'perte' ? -c[0] : c[1]) ? 'tooFast' : 'tooSlow';
}
// Moyennes par semaine (lundi), dans l'ordre des dates.
function moyennesSemaine(mesures) {
  const m = new Map();
  for (const e of mesures) {
    const k = jourLocal(lundi(enDate(e.jour)));
    const [s, n] = m.get(k) ?? [0, 0];
    m.set(k, [s + Number(e.kg), n + 1]);
  }
  return [...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, [s, n]]) => ({ jour: k, kg: s / n }));
}
// Tendance lissée des pesées (stats_state.dart:bodyweightTrend), pour la variation affichée sous le chiffre.
function tendancePoids(mesures) {
  const out = [];
  for (const e of mesures) {
    if (!out.length) { out.push({ jour: e.jour, kg: Number(e.kg) }); continue; }
    const prev = out.at(-1);
    const garde = 0.9 ** Math.max(1, (enDate(e.jour) - enDate(prev.jour)) / JOUR);
    out.push({ jour: e.jour, kg: prev.kg * garde + Number(e.kg) * (1 - garde) });
  }
  return out;
}

// Feuille « Bodyweight » (progress_screen.dart:_BodyweightSheet).
function FeuillePoids({ ouverte, fermer }) {
  const Xl = X();
  const T = T4();
  const mesures = [...(etat.value.poids || [])].sort((a, b) => (a.jour < b.jour ? -1 : 1));
  const [jours, setJours] = useState(90);
  // Objectif et rythme : enregistrés sur le serveur (préférences), l'ancien stockage local sert de reprise.
  const objectif = etat.value.profil.extensions?.preferences?.objectifPoids ?? lsGet('m04:objectifPoids', null);
  const dernier = mesures.at(-1) ?? null;
  const kg = dernier ? Number(dernier.kg) : 0;
  const [editObjectif, setEditObjectif] = useState(false);
  const [choixVise, setChoixVise] = useState(false);
  const [regle, setRegle] = useState(false);
  const [cibleObjectif, setCibleObjectif] = useState('');
  const [pesee, setPesee] = useState(versAffichage(kg || 70));
  const [jourPesee, setJourPesee] = useState(jourLocal(new Date()));

  const dans = (m) => !jours || Date.now() - enDate(m.jour).getTime() <= jours * JOUR;
  const vues = mesures.filter(dans);
  const tendance = tendancePoids(mesures).filter(dans);
  const cible = objectif?.cible > 0 ? Number(objectif.cible) : 0;
  const diff = cible > 0 && kg > 0 ? cible - kg : 0;
  const rythme = rythmePoids(mesures);
  const choisi = objectif?.rythme && objectif.rythme !== 'auto' ? objectif.rythme : '';
  const vise = choisi || (cible > 0 && kg > 0 ? (Math.abs(cible - kg) < kg * 0.01 ? 'maintien' : cible < kg ? 'perte' : 'prise') : '');
  const statut = statutRythme(rythme?.pct, vise);
  const [texteStatut, couleur] = {
    onPace: [T.paceOn, 'var(--sage)'], tooFast: [T.paceTooFast, 'var(--warn)'], tooSlow: [T.paceTooSlow, 'var(--brass)'],
    wrongWay: [T.paceWrongWay, 'var(--danger)'], drifting: [T.paceDrifting, 'var(--warn)'],
  }[statut] ?? [T.paceSetAim, 'var(--text2)'];
  const at = (v) => Math.max(0, Math.min(1, (v + 1.5) / 3)) * 100;
  const couloir = COULOIRS[vise];
  const semaines = moyennesSemaine(mesures).slice(-8);
  const kgAff = (v) => `${poids(v)} ${unite()}`;
  const signeKg = (v) => `${signe(v)}${kgAff(Math.abs(v))}`;

  const sauverObjectif = async (v) => {
    try {
      await sauverExtensions({ preferences: { objectifPoids: v } });
      lsSet('m04:objectifPoids', null);
      return true;
    } catch { afficher(Xl.erreur, 'danger'); return false; }
  };
  const enregistrerObjectif = async () => {
    const brut = String(cibleObjectif ?? '').trim();
    const v = brut === '' ? 0 : versKg(Number(String(brut).replace(',', '.')));
    // Vide ou zéro retire l'objectif (askNumber puis setWeightGoal(0)).
    if (v && (v < 20 || v > 500)) { afficher(Xl.erreurObjectif, 'danger'); return; }
    if (await sauverObjectif({ cible: v > 0 ? v : null, rythme: objectif?.rythme ?? 'auto' })) { if (v > 0) afficher(Xl.objectifEnregistre); setEditObjectif(false); }
  };
  const viser = async (v) => { setChoixVise(false); await sauverObjectif({ cible: objectif?.cible ?? null, rythme: v || 'auto' }); };
  const ouvrirObjectif = () => { setCibleObjectif(cible > 0 ? versAffichage(cible) : ''); setEditObjectif(true); };
  const ouvrirPesee = () => { setPesee(versAffichage(kg || 70)); setJourPesee(jourLocal(new Date())); setRegle(true); };

  return (
    <Feuille ouverte={ouverte} fermer={fermer} titre={Xl.poidsTitre} sous={dernier ? dateAn(dernier.jour) : null}>
      <div class="l4-pile">
        <p class="l4-poids-chiffre"><b>{kg > 0 ? poids(kg) : '-'}</b><small>{unite()}</small></p>
        {tendance.length >= 2 && <p class="l4-poids-variation">{Xl.variationPeriode(signeKg(tendance.at(-1).kg - tendance[0].kg))}</p>}
        <div class="l4-centre" style="margin-top:16px">
          <div class="m04-seg grand" role="radiogroup" aria-label={Xl.periode}>
            {[[30, Xl.derniers30j], [90, Xl.j90], [365, Xl.an1], [0, Xl.tout]].map(([j, lib]) => (
              <button key={j} type="button" role="radio" aria-checked={jours === j} aria-pressed={jours === j} onClick={() => setJours(j)}>{lib}</button>
            ))}
          </div>
        </div>
        <div style="margin-top:16px">
          {vues.length >= 2 ? <Tendance vals={vues.map((m) => versAffichage(Number(m.kg)))} />
            : <p class="l4-vide">{T.trackWeight}</p>}
        </div>
        <div class="l4-outil" style="margin-top:16px">
          <span>{T.goalWeight}</span>
          <button type="button" class="m04-objectif-btn" aria-label={T.goalWeight} onClick={ouvrirObjectif}>
            {cible > 0 ? kgAff(cible) : '-'}<Ic n="pencil-simple:bold" taille={13} />
          </button>
        </div>
        {cible > 0 && kg > 0 && (
          <p class={`m04-objectif-note ${Math.abs(diff) < 0.05 ? 'atteint' : ''}`} style="margin-top:8px">
            {Math.abs(diff) < 0.05 ? Xl.objectifAtteint : diff < 0 ? Xl.objectifPerdre(kgAff(-diff)) : Xl.objectifGagner(kgAff(diff))}
          </p>
        )}
        {rythme && <>
          <p class="l4-kicker">{T.paceTitle}</p>
          <button type="button" class="l4-rythme" onClick={() => setChoixVise(true)}>
            <span class="l4-rythme-tete">
              <b>{signeKg(rythme.kg)}/{T.weekShort}</b>
              <small>{signe(rythme.pct)}{nombre(Math.abs(rythme.pct), 2)} %</small>
              <Ic n="sliders-horizontal" taille={16} />
            </span>
            <span class="l4-rythme-piste" aria-hidden="true">
              <i class="fond" />
              {couloir && <i class="couloir" style={{ left: `${at(couloir[0])}%`, width: `${at(couloir[1]) - at(couloir[0])}%` }} />}
              <i class="zero" />
              <i class="curseur" style={{ left: `clamp(0px, calc(${at(rythme.pct)}% - 8px), calc(100% - 16px))`, background: couleur }} />
            </span>
            <span class="l4-rythme-etat">
              <i style={{ background: couleur }} />
              <b>{texteStatut}</b>
              <small>{{ perte: T.paceLose, prise: T.paceGain, maintien: T.paceHold }[vise] ?? ''}</small>
            </span>
            <span class="l4-rythme-base">{T.paceBasis}</span>
          </button>
        </>}
        {semaines.length >= 2 && <>
          <p class="l4-kicker">{Xl.moyenneHebdo}</p>
          <div class="l4-carte-bord" style="padding:16px 12px 10px">
            <LigneValeurs vals={semaines.map((s) => versAffichage(s.kg))} labels={semaines.map((s) => dateCourte(s.jour))} objectif={cible > 0 ? versAffichage(cible) : null} />
          </div>
          <div class="l4-carte-bord l4-semaines">
            {semaines.map((s, i) => (
              <div class="l4-semaine" key={s.jour}>
                <span>{Xl.semaineDu(dateCourte(s.jour))}</span>
                <b>{kgAff(s.kg)}</b>
                <small>{i === 0 ? '' : signeKg(s.kg - semaines[i - 1].kg)}</small>
              </div>
            )).reverse()}
          </div>
        </>}
        {mesures.length > 0 && <>
          <p class="l4-kicker">{Xl.historiquePoids}</p>
          <div class="l4-carte-bord l4-historique">
            {[...mesures].reverse().slice(0, 30).map((m) => (
              <div class="l4-pesee" key={m.jour}>
                <span>{dateAn(m.jour)}</span>
                <b>{kgAff(Number(m.kg))}</b>
                <button type="button" aria-label={`${Xl.supprimer} ${kgAff(Number(m.kg))}`} onClick={async () => {
                  try { await api('DELETE', `/api/poids/${m.jour}`); await charger(); } catch { afficher(Xl.erreur, 'danger'); }
                }}><Ic n="trash" taille={14} /></button>
              </div>
            ))}
          </div>
        </>}
        <button type="button" class="btn pri large l4-bouton" style="margin-top:18px" onClick={ouvrirPesee}>{Xl.noterPoids}</button>
      </div>

      {editObjectif && (
        <Feuille ouverte={editObjectif} fermer={() => setEditObjectif(false)} titre={T.goalWeightTitle(unite())}>
          <div class="pile">
            <Nombre valeur={cibleObjectif} onChange={setCibleObjectif} label={T.goalWeight} classe="form-input" />
            <button class="btn pri large" type="button" onClick={enregistrerObjectif}>{Xl.enregistrer}</button>
          </div>
        </Feuille>
      )}
      {choixVise && (
        <Feuille ouverte={choixVise} fermer={() => setChoixVise(false)} titre={T.paceAimTitle} sous={T.paceAimHint}>
          <div class="rt-options" role="radiogroup" aria-label={T.paceAimTitle}>
            {[['perte', T.paceLose, T.paceLoseRange], ['maintien', T.paceHold, T.paceHoldRange], ['prise', T.paceGain, T.paceGainRange], ['', T.paceAuto, T.paceAutoHint]].map(([v, lib, det]) => (
              <button key={v} type="button" role="radio" aria-checked={choisi === v} class={`rt-opt${choisi === v ? ' choisi' : ''}`} onClick={() => viser(v)}>
                <span class="rt-opt-texte"><b>{lib}</b><small>{det}</small></span>{choisi === v && <Ic n="check:bold" taille={16} />}
              </button>
            ))}
          </div>
        </Feuille>
      )}
      {regle && (
        <Feuille ouverte={regle} fermer={() => setRegle(false)} titre={Xl.noterPoids}>
          <div class="pile">
            <div class="m04-poids-tete">
              <b>{poids(versKg(pesee))}</b><small>{unite()}</small>
            </div>
            <Regle valeur={versKg(pesee)} onChange={(v) => setPesee(versAffichage(v))} />
            <label class="label" for="regle-jour" style="margin-top:14px">{Xl.jour}</label>
            <input id="regle-jour" type="date" class="form-input" value={jourPesee} max={jourLocal(new Date())} onInput={(e) => setJourPesee(e.target.value)} />
            <button class="btn pri large" type="button" onClick={async () => {
              const v = versKg(pesee);
              if (!v || v < 20 || v > 500) { afficher(Xl.erreur, 'danger'); return; }
              if (!jourPesee || jourPesee > jourLocal(new Date())) { afficher(Xl.erreurDate, 'danger'); return; }
              try { await api('PUT', '/api/poids', { jour: jourPesee, kg: v }); await charger(); afficher(Xl.poidsEnregistre); setRegle(false); }
              catch { afficher(Xl.erreur, 'danger'); }
            }}>{Xl.enregistrer}</button>
          </div>
        </Feuille>
      )}
    </Feuille>
  );
}

// Feuille « Report » (widgets/report_sheet.dart) : 30 J, 90 J, 1 A ou dates choisies, partage PDF ou CSV.
function FeuilleRapport({ ouverte, fermer }) {
  const Xl = X();
  const T = T4();
  const auj = jourLocal(new Date());
  const ilYa = (j) => { const d = new Date(); d.setDate(d.getDate() - (j - 1)); return jourLocal(d); };
  const [periode, setPeriode] = useState(30);
  const [deb, setDeb] = useState(ilYa(30));
  const [fin, setFin] = useState(auj);
  const [dates, setDates] = useState(false);
  const choisir = (j) => { setPeriode(j); setDeb(ilYa(j)); setFin(auj); setDates(false); };
  const autre = () => { setPeriode(0); setDates(true); };
  // Bornes incluses, du début du premier jour à la fin du dernier.
  const t0 = new Date(`${deb}T00:00:00`).getTime();
  const t1 = new Date(`${fin}T23:59:59.999`).getTime();
  const inverse = Number.isNaN(t0) || Number.isNaN(t1) || t0 > t1;
  const dansPlage = (ms) => !inverse && ms >= t0 && ms <= t1;
  const seances = etat.value.seances.filter((s) => dansPlage(enDate(s.debut).getTime()));
  const stats = seances.reduce((a, s) => { const b = bilanSeance(s.donnees); return { seances: a.seances + 1, series: a.series + b.series, vol: a.vol + b.volume }; }, { seances: 0, series: 0, vol: 0 });
  const exos = new Set(seances.flatMap((s) => (s.donnees?.exercices || []).map((e) => e.ex))).size;
  const records = (() => {
    let n = 0;
    const vus = new Set();
    for (const s of seances) for (const e of s.donnees?.exercices || []) {
      if (vus.has(e.ex)) continue;
      vus.add(e.ex);
      const m = meilleures(e.ex, etat.value.seances);
      const meilleur = forceParSeance([s], e.ex)[0];
      if (meilleur && Math.abs(meilleur.kg - Number(m.kg || 0)) < 0.01) n++;
    }
    return n;
  })();
  const poidsPlage = (etat.value.poids || []).filter((m) => dansPlage(enDate(m.jour).getTime()));
  const debutPoids = poidsPlage[0];
  const finPoids = poidsPlage.at(-1);
  const plage = inverse ? '' : (deb.slice(0, 4) === fin.slice(0, 4) ? `${dateCourte(deb)} - ${dateAn(fin)}` : `${dateAn(deb)} - ${dateAn(fin)}`);
  const vol = `${nombre(Math.round((versAffichage(stats.vol) ?? 0) / 100) / 10, 1)} ${unite() === 'lb' ? 'k lb' : t.commun.t}`;

  const csv = () => {
    const lignes = [['type', 'valeur'], ['debut', deb], ['fin', fin], ['seances', stats.seances], ['series', stats.series], ['volume_kg', Math.round(stats.vol)], ['records', records], ['exercices', exos]];
    const blob = new Blob([lignes.map((l) => l.join(';')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `rapport-${deb}-${fin}.csv`; a.click();
    URL.revokeObjectURL(a.href);
    afficher(Xl.telecharge);
  };

  return (
    <Feuille ouverte={ouverte} fermer={fermer} titre={Xl.rapportTitre} sous={Xl.rapportIndice}>
      <div class="l4-pile">
        <div class="l4-centre">
          <div class="m04-seg grand" role="radiogroup" aria-label={Xl.periode}>
            {[[30, Xl.rapport30j], [90, Xl.rapport90j], [365, Xl.rapport365j]].map(([j, lib]) => (
              <button key={j} type="button" role="radio" aria-checked={periode === j} aria-pressed={periode === j} onClick={() => choisir(j)}>{lib}</button>
            ))}
            <button type="button" role="radio" aria-checked={periode === 0} aria-pressed={periode === 0} onClick={autre}>{Xl.rapportPerso}</button>
          </div>
        </div>
        <button type="button" class="l4-plage" aria-label={T.pickRange} aria-expanded={dates} onClick={() => setDates(!dates)}>
          <span>{plage || T.pickRange}</span><Ic n="calendar-blank" taille={16} />
        </button>
        {dates && (
          <div class="m04-rap-date">
            <input type="date" class="form-input" aria-label={Xl.rapportDebut} value={deb} max={fin || auj} onInput={(e) => { setDeb(e.target.value); setPeriode(0); }} />
            <span class="muted">-</span>
            <input type="date" class="form-input" aria-label={Xl.rapportFin} value={fin} max={auj} onInput={(e) => { setFin(e.target.value); setPeriode(0); }} />
          </div>
        )}
        {stats.seances === 0 ? <p class="m04-rap-vide" role="status">{inverse ? Xl.rapportDatesInversees : Xl.rapportVide}</p> : (
          <>
            <div class="m04-rap-stats" style="margin-top:12px">
              <div><small>{Xl.seances}</small><b>{stats.seances}</b></div>
              <div><small>{Xl.series}</small><b>{nombre(stats.series, 0)}</b></div>
              <div><small>{Xl.volume}</small><b>{vol}</b></div>
            </div>
            {records > 0 && <div class="m04-rap-ligne"><Ic n="trophy" taille={15} /><span>{Xl.rapportRecords(records)}</span></div>}
            {exos > 0 && <div class="m04-rap-ligne"><Ic n="barbell" taille={15} /><span>{Xl.rapportExercices(exos)}</span></div>}
            {debutPoids && finPoids && <div class="m04-rap-ligne"><Ic n="scales" taille={15} /><span>{`${poids(Number(debutPoids.kg))} ${unite()} → ${poids(Number(finPoids.kg))} ${unite()}`}</span></div>}
            <button class="btn pri large l4-bouton" type="button" style="margin-top:20px" onClick={() => window.print()}>{T.sharePdf}</button>
            <button class="btn large l4-bouton" type="button" style="margin-top:10px" onClick={csv}><Ic n="file-csv" taille={16} />{T.exportCsv}</button>
          </>
        )}
      </div>
    </Feuille>
  );
}

/* ------------------------------------------------------------------ */
/* Carte à partager (screens/share_sheet.dart, widgets/share_cards.dart) */
/* ------------------------------------------------------------------ */
const CARTE_L = 340, CARTE_H = 425;
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
function identiteCarte() {
  const p = etat.value.profil, e = p.extensions?.profil ?? {};
  const nom = e.nomAffiche || p.prenom || 'Anatoly';
  return { nom, pseudo: e.pseudo || slug(nom) || 'anatoly', photo: e.photo ? `/api/media/${e.photo}` : '/statique/app-img/profile_default.jpg' };
}
const chargerImage = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });

// Données des deux cartes, calculées comme l'écran (série, régularité 20 semaines, totaux, muscles des 7 derniers jours).
function donneesCarte(seances) {
  const vols = parJour(seances, (s) => Math.max(1, bilanSeance(s.donnees).volume));
  const maxVol = Math.max(1, ...vols.values());
  const niveau = (v) => { const r = v / maxVol; return r <= 0.25 ? 1 : r <= 0.5 ? 2 : r <= 0.75 ? 3 : 4; };
  const debut = lundi(); debut.setDate(debut.getDate() - 7 * 19);
  const auj = jourLocal(new Date());
  const grille = Array.from({ length: 20 }, (_, c) => Array.from({ length: 7 }, (_, r) => {
    const d = new Date(debut); d.setDate(d.getDate() + c * 7 + r);
    const k = jourLocal(d);
    if (k > auj) return -1;
    const v = vols.get(k) ?? 0;
    return v ? niveau(v) : 0;
  }));
  const secondes = seances.reduce((a, s) => a + (s.duree_s || 0), 0);
  const h = Math.floor(secondes / 3600);
  const vol30 = seances.filter((s) => enPlage(s, depuis(30))).reduce((a, s) => a + bilanSeance(s.donnees).volume, 0);
  const sem = semaine(seances);
  const series7 = seriesParMuscle(seances, depuis(7));
  const top = Object.entries(series7).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m]) => nomMuscle(m));
  return {
    serie: serieJours(seances), grille, seances: seances.length,
    entraine: h < 48 ? [String(h), t.commun.h] : [String(Math.floor(h / 24)), T4().unitDays],
    volume: [nombre(Math.round((versAffichage(vol30) ?? 0) / 100) / 10, 1), unite() === 'lb' ? 'k lb' : t.commun.t],
    semaineSeances: sem.length, semaineSeries: sem.reduce((a, s) => a + bilanSeance(s.donnees).series, 0), top, series7,
  };
}

// Silhouette de la carte « Muscles » : le SVG affiché est copié avec ses couleurs calculées, puis dessiné sur le canevas.
async function imageSilhouette(svg) {
  if (!svg) return null;
  const copie = svg.cloneNode(true);
  const a = [svg, ...svg.querySelectorAll('*')], b = [copie, ...copie.querySelectorAll('*')];
  a.forEach((el, i) => {
    const cs = getComputedStyle(el);
    for (const p of ['fill', 'stroke', 'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity', 'display', 'visibility']) b[i].style?.setProperty(p, cs.getPropertyValue(p));
  });
  const { width, height } = svg.getBoundingClientRect();
  copie.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copie.setAttribute('width', width); copie.setAttribute('height', height);
  // Adresse data: et non blob: (la politique de sécurité n'autorise que 'self' et data: pour les images).
  const img = await chargerImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copie))}`);
  return img ? { img, l: width, h: height } : null;
}

const coul = (nom) => getComputedStyle(document.documentElement).getPropertyValue(nom).trim() || '#888888';
// Mélange de deux couleurs hexadécimales (Color.lerp), le canevas ne lisant pas toujours color-mix().
const rvb = (h) => { const x = h.replace('#', ''); const v = x.length === 3 ? x.split('').map((k) => k + k).join('') : x.slice(0, 6); return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) || 0); };
const melangeHex = (a, b, k) => { const [p, q] = [rvb(a), rvb(b)]; return `rgb(${p.map((v, i) => Math.round(v + (q[i] - v) * k)).join(',')})`; };
const alphaHex = (a, k) => `rgba(${rvb(a).join(',')},${k})`;
// Dessine la carte 340 x 425 (pixelRatio 3 à l'export), mise en page de share_cards.dart.
async function dessinerCarte(canvas, genre, d, silhouette) {
  const T = T4();
  const echelle = 3;
  canvas.width = CARTE_L * echelle; canvas.height = CARTE_H * echelle;
  const c = canvas.getContext('2d');
  c.setTransform(echelle, 0, 0, echelle, 0, 0);
  try { await Promise.all(['800 104px Nunito', '700 17px Nunito', '600 11px Nunito'].map((f) => document.fonts.load(f))); } catch { /* police de secours */ }
  const C = { raised: coul('--raised'), bg: coul('--bg'), text: coul('--text'), t2: coul('--text2'), t3: coul('--text3'), accent: coul('--accent'), brass: coul('--brass'), vide: coul('--heat-empty') };
  const police = (taille, poids) => `${poids} ${taille}px Nunito, system-ui, sans-serif`;
  const texte = (s, x, y, taille, poids, couleur, { esp = 0, align = 'left', base = 'alphabetic' } = {}) => {
    c.font = police(taille, poids); c.fillStyle = couleur; c.textAlign = align; c.textBaseline = base;
    if ('letterSpacing' in c) c.letterSpacing = `${esp}px`;
    c.fillText(s, x, y);
    const w = c.measureText(s).width;
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    return w;
  };
  // Fond : dégradé vertical, coins de 32.
  c.clearRect(0, 0, CARTE_L, CARTE_H);
  const fond = c.createLinearGradient(0, 0, 0, CARTE_H);
  fond.addColorStop(0, C.raised); fond.addColorStop(1, melangeHex(C.raised, C.bg, 0.7));
  c.fillStyle = fond; c.beginPath(); c.roundRect(0, 0, CARTE_L, CARTE_H, 32); c.fill();
  const x0 = 26, x1 = CARTE_L - 26, haut = 24, bas = CARTE_H - 22, larg = x1 - x0;
  texte('Anatoly', x0, haut + 14, 14, 800, C.text, { esp: -0.2 });
  texte(dateAn(jourLocal(new Date())), x1, haut + 13, 11, 600, C.t3, { align: 'right' });
  const corpsH = haut + 18, corpsB = bas - 26 - 14 - 1;
  const stats = (items, y) => {
    const col = larg / items.length;
    items.forEach(([lib, val, u], i) => {
      const x = x0 + i * col;
      const w = texte(val, x, y + 22, 22, 800, C.text, { esp: -0.4 });
      if (u) texte(` ${u}`, x + w, y + 22, 12, 700, C.t2);
      texte(lib.toUpperCase(), x, y + 22 + 2 + 11, 9.5, 700, C.t3, { esp: 1.1 });
    });
  };
  if (genre === 'serie') {
    const cell = (larg - 4 * 19) / 20, grilleH = 7 * cell + 24;
    const fixe = 13 + 2 + 104 + grilleH + 41 + 20;
    const reste = Math.max(0, corpsB - corpsH - fixe) / 8;
    let y = corpsH + reste * 3;
    texte(T.consistency.toUpperCase(), x0, y + 10, 10.5, 700, C.t3, { esp: 1.4 });
    y += 13 + 2;
    c.font = police(104, 800);
    if ('letterSpacing' in c) c.letterSpacing = '-5px';
    const n = String(d.serie);
    const wN = c.measureText(n).width;
    const deg = c.createLinearGradient(x0, y, x0 + wN, y + 104);
    deg.addColorStop(0, C.accent); deg.addColorStop(1, C.brass);
    c.fillStyle = deg; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.fillText(n, x0, y + 82);
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    texte(T.streakLabel, x0 + wN + 12, y + 82, 17, 700, C.t2);
    y += 104 + reste * 2;
    const rampe = RAMPE_HEAT[etat.value.profil.extensions?.preferences?.teinteCarteChaleur] ?? RAMPE_HEAT.ember;
    d.grille.forEach((colonne, ci) => colonne.forEach((niv, r) => {
      if (niv < 0) return;
      c.fillStyle = niv ? rampe[niv - 1] : C.vide;
      c.beginPath(); c.roundRect(x0 + ci * (cell + 4), y + r * (cell + 4), cell, cell, 3); c.fill();
    }));
    y += grilleH + reste * 3;
    stats([[T.shareSessions, String(d.seances)], [T.trained, ...d.entraine], [T.shareVolume, ...d.volume]], y);
  } else {
    let y = corpsH + 22;
    texte(T.lastWeek.toUpperCase(), x0, y + 10, 10.5, 700, C.t3, { esp: 1.4 });
    y += 13 + 4;
    texte(T.shareBody, x0, y + 23, 26, 800, C.text, { esp: -0.6 });
    y += 28.6;
    if (d.top.length) { y += 4; texte(d.top.join(' · '), x0, y + 12, 12.5, 600, C.t2); y += 15; }
    const zoneB = corpsB - 41 - 20 - 12;
    const zoneH = zoneB - (y + 12);
    if (silhouette && zoneH > 20) {
      const k = Math.min(larg / silhouette.l, zoneH / silhouette.h);
      const w = silhouette.l * k, h = silhouette.h * k;
      c.drawImage(silhouette.img, x0 + (larg - w) / 2, y + 12 + (zoneH - h) / 2, w, h);
    }
    stats([[T.shareSessions, String(d.semaineSeances)], [T.sets, String(d.semaineSeries)], [T.streakLabel, String(d.serie)]], corpsB - 41 - 20);
  }
  // Pied : filet, avatar, nom et pseudo.
  c.fillStyle = alphaHex(C.text, 0.08);
  c.fillRect(x0, bas - 26 - 14 - 1, larg, 1);
  const id = identiteCarte();
  const av = await chargerImage(id.photo);
  const ay = bas - 26;
  c.save(); c.beginPath(); c.arc(x0 + 13, ay + 13, 13, 0, Math.PI * 2); c.clip();
  if (av) { const k = Math.max(26 / av.width, 26 / av.height); c.drawImage(av, x0 + 13 - (av.width * k) / 2, ay + 13 - (av.height * k) / 2, av.width * k, av.height * k); }
  else { c.fillStyle = C.vide; c.fill(); }
  c.restore();
  const wNom = texte(id.nom, x0 + 36, ay + 17.5, 12.5, 700, C.text);
  texte(`@${id.pseudo}`, x0 + 36 + wNom + 6, ay + 17.5, 11.5, 600, C.t3);
}

function FeuillePartage({ ouverte, fermer }) {
  const T = T4();
  const [genre, setGenre] = useState('serie');
  const [occupe, setOccupe] = useState(false);
  const toile = useRef(null);
  const corps = useRef(null);
  const seances = etat.value.seances;
  const d = ouverte ? donneesCarte(seances) : null;
  // Intensités des 7 derniers jours, comme la carte musculaire (cible 12 séries par semaine).
  const intensites = {}, couleurs = {};
  if (d) {
    const rampe = RAMPE_HEAT[etat.value.profil.extensions?.preferences?.teinteCarteChaleur] ?? RAMPE_HEAT.ember;
    for (const m of MUSCLES_LISTE) {
      const s = d.series7[m] ?? 0;
      intensites[m] = s === 0 ? 0 : Math.max(1, Math.min(4, Math.ceil((s / 12) * 4)));
      couleurs[m] = intensites[m] ? rampe[intensites[m] - 1] : idle;
    }
  }
  useEffect(() => {
    if (!ouverte || !toile.current) return undefined;
    let fini = false;
    (async () => {
      const sil = genre === 'corps' ? await imageSilhouette(corps.current?.querySelector('svg')) : null;
      if (!fini && toile.current) await dessinerCarte(toile.current, genre, donneesCarte(etat.value.seances), sil);
    })().catch(() => {});
    return () => { fini = true; };
  }, [ouverte, genre, seances]);

  const partager = async () => {
    if (occupe || !toile.current) return;
    setOccupe(true);
    try {
      const blob = await new Promise((ok) => toile.current.toBlob(ok, 'image/png'));
      if (!blob) throw new Error('image');
      const fichier = new File([blob], `anatoly-${genre === 'serie' ? 'serie' : 'muscles'}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [fichier] })) { await navigator.share({ files: [fichier], title: 'Anatoly' }); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(fichier); a.download = fichier.name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e) { if (e?.name !== 'AbortError') afficher(T.shareFailed, 'danger'); }
    finally { setOccupe(false); }
  };

  const resume = d ? (genre === 'serie' ? `${T.consistency}${dp()}${d.serie} ${T.streakLabel}, ${d.seances} ${T.shareSessions.toLowerCase()}` : `${T.shareBody}${dp()}${d.top.join(', ')}`) : '';
  return (
    <Feuille ouverte={ouverte} fermer={fermer} titre={T.sharePick}>
      <div class="l4-pile l4-partage">
        <div class="m04-seg grand l4-seg-partage" role="radiogroup" aria-label={T.sharePick}>
          {[['serie', T.shareStreak], ['corps', T.shareBody]].map(([g, lib]) => (
            <button key={g} type="button" role="radio" aria-checked={genre === g} aria-pressed={genre === g} onClick={() => setGenre(g)}>{lib}</button>
          ))}
        </div>
        <div class="l4-carte-apercu">
          <canvas ref={toile} role="img" aria-label={resume} width={CARTE_L * 3} height={CARTE_H * 3} />
        </div>
        {genre === 'corps' && d && (
          <div class="l4-hors-ecran" ref={corps} aria-hidden="true">
            <SilhouetteSvg mode="heat" vueInitiale="both" sexe={etat.value.profil.extensions?.profil?.sexe === 'f' ? 'f' : 'm'} intensites={intensites} couleurs={couleurs} lang={langueApp} />
          </div>
        )}
        <p class="l4-partage-aide">{T.shareHint}</p>
        <button type="button" class="btn pri large l4-bouton" disabled={occupe} onClick={partager}>{T.share}</button>
      </div>
    </Feuille>
  );
}

/* ------------------------------------------------------------------ */
/* Écran                                                               */
/* ------------------------------------------------------------------ */
export function Progres() {
  const { seances, poids: mesuresPoids, profil } = etat.value;
  const fr = langueApp === 'fr';
  const Xl = X();
  const [jourOuv, setJourOuv] = useState(null);
  const [poidsOuv, setPoidsOuv] = useState(false);
  const [mesuresOuv, setMesuresOuv] = useState(false);
  const [rapportOuv, setRapportOuv] = useState(false);
  const [partageOuv, setPartageOuv] = useState(false);
  const etapes = etapesDemarrage(seances);

  const fin30 = Date.now();
  const debut30 = fin30 - 30 * JOUR;
  const debut60 = fin30 - 60 * JOUR;
  const recents = seances.filter((s) => enPlage(s, debut30));
  const precedent = seances.filter((s) => { const t = enDate(s.debut).getTime(); return t >= debut60 && t < debut30; });

  const vol30Kg = recents.reduce((a, s) => a + bilanSeance(s.donnees).volume, 0);
  const volPrecKg = precedent.reduce((a, s) => a + bilanSeance(s.donnees).volume, 0);
  // Toujours en tonnes (fit_core.dart:volumeValue), même sous 1 000 kg.
  const uT = unite() === 'lb' ? 'k lb' : t.commun.t;
  const vol30 = { val: nombre(Math.round((versAffichage(vol30Kg) ?? 0) / 100) / 10, 1), unite: uT };
  // Variation entière, absente sans période précédente (stats_state.dart:volumeChangePct).
  const variation = volPrecKg > 0 ? Math.round(((vol30Kg - volPrecKg) / volPrecKg) * 100) : null;

  // Cumul sur 30 jours ramené à 12 points, en tonnes (volumeChartPoints).
  const parJourVol = parJour(recents, (s) => bilanSeance(s.donnees).volume);
  let cumul = 0;
  const cumuls = Array.from({ length: 30 }, (_, i) => {
    cumul += parJourVol.get(jourLocal(new Date(Date.now() - (29 - i) * JOUR))) ?? 0;
    return cumul;
  });
  const ptsVol = Array.from({ length: 12 }, (_, i) => (versAffichage(cumuls[Math.round((29 * i) / 11)]) ?? 0) / 1000);

  const dernierPoids = mesuresPoids.at(-1);
  const ptsPoids = mesuresPoids.map((m) => versAffichage(Number(m.kg)));

  const tot = seances.reduce((a, s) => { const b = bilanSeance(s.donnees); return { series: a.series + b.series, temps: a.temps + (s.duree_s || 0), vol: a.vol + b.volume }; }, { series: 0, temps: 0, vol: 0 });
  // Soulevé (stats_state.dart:liftedSpanOf) : kg sous 1 000, puis tonnes, arrondies au-delà de 10.
  const totAff = versAffichage(tot.vol) ?? 0;
  const totVol = totAff < 1000 ? { val: nombre(Math.round(totAff), 0), unite: unite() } : { val: totAff >= 10000 ? nombre(Math.round(totAff / 1000), 0) : nombre(totAff / 1000, 1), unite: uT };
  const heures = Math.floor(tot.temps / 3600);

  return (
    <main class="ecran m04">
      <header class="m04-tete">
        <h1 class="titre-ecran">{Xl.titre}</h1>
        <div class="m04-actions" role="toolbar" aria-label={fr ? 'Actions' : 'Actions'}>
          <a href="#/historique" class="press" aria-label={Xl.historique} title={Xl.historique}>
            <Ic n="clock-counter-clockwise:bold" taille={16} classe="ico" /><span class="m04-lib">{Xl.historique}</span>
          </a>
          <span class="sep" />
          <button type="button" class="press" onClick={() => setRapportOuv(true)} aria-label={Xl.rapport} title={Xl.rapport}>
            <Ic n="file-text:bold" taille={16} classe="ico" /><span class="m04-lib">{Xl.rapport}</span>
          </button>
          <span class="sep" />
          <button type="button" class="press" onClick={() => setPartageOuv(true)} aria-label={Xl.partage}>
            <Ic n="export:bold" taille={15} classe="ico-accent" />{Xl.partage}
          </button>
        </div>
      </header>

      {seances.length === 0 && <CarteDemarrage etapes={etapes} ouvrirPoids={() => setPoidsOuv(true)} />}
      <div class="m04-duo">
        <section class="m04-tuile">
          <div class="m04-tuile-tete">
            <Kicker>{Xl.volume30}</Kicker>
            {variation !== null && <span class={`m04-delta ${variation >= 0 ? 'haut' : 'bas'}`}>
              <Ic n={variation >= 0 ? 'trend-up:bold' : 'trend-down:bold'} taille={11} />
              {Math.abs(variation)}%
            </span>}
          </div>
          <p class="m04-valeur">{vol30.val}<small>{vol30.unite}</small></p>
          {seances.length ? <Etincelle vals={ptsVol} /> : <div class="l4-etincelle" style="height:40px" />}
        </section>
        <button type="button" class="m04-tuile" onClick={() => setPoidsOuv(true)}>
          <div class="m04-tuile-tete"><Kicker>{Xl.poids}</Kicker></div>
          {dernierPoids ? (
            <>
              <p class="m04-valeur">{poids(Number(dernierPoids.kg))}<small>{unite()}</small></p>
              <p class="m04-note">{dateCourte(dernierPoids.jour)}</p>
              <Etincelle vals={ptsPoids} />
            </>
          ) : (
            <p class="m04-valeur" style="color:var(--accent);font-size:16px;font-weight:700"><Ic n="plus:bold" taille={13} />{Xl.ajouterPoids}</p>
          )}
        </button>
      </div>

      <CarteRegularite seances={seances} profil={profil} ouvrirJour={setJourOuv} />

      <div class="l4-totaux">
        {[[T4().sessions, nombre(seances.length, 0), ''], [T4().sets, nombre(tot.series, 0), ''],
          [T4().time, heures >= 1 ? nombre(heures, 0) : String(Math.floor(tot.temps / 60)), heures >= 1 ? t.commun.h : 'min'], [T4().lifted, totVol.val, totVol.unite]]
          .map(([lib, val, u]) => (
            <section class="m04-tuile" key={lib}>
              <div class="m04-tuile-tete"><Kicker>{lib}</Kicker></div>
              <p class="m04-valeur">{val}{u && <small>{u}</small>}</p>
            </section>
          ))}
      </div>

      <CarteMuscles seances={seances} fr={fr} />
      <CarteRadar seances={seances} fr={fr} />
      <CarteSemaine seances={seances} fr={fr} />
      <CarteForce seances={seances} fr={fr} />
      <CarteEquilibre seances={seances} />
      <CarteRecords seances={seances} fr={fr} />
      <CarteMesures fr={fr} ouvrir={() => setMesuresOuv(true)} />
      <CarteMois seances={seances} fr={fr} ouvrir={() => setRapportOuv(true)} />
      {lireM13().checkIn !== false && <CarteCheckIn />}
      {seances.length > 0 && etapes.some((e) => !e[2]) && <CarteDemarrage etapes={etapes} ouvrirPoids={() => setPoidsOuv(true)} />}

      <FeuilleJournal jour={jourOuv} fermer={() => setJourOuv(null)} fr={fr} />
      <FeuillePoids ouverte={poidsOuv} fermer={() => setPoidsOuv(false)} fr={fr} />
      <FeuilleMesures ouverte={mesuresOuv} fermer={() => setMesuresOuv(false)} fr={fr} />
      <FeuilleRapport ouverte={rapportOuv} fermer={() => setRapportOuv(false)} fr={fr} />
      <FeuillePartage ouverte={partageOuv} fermer={() => setPartageOuv(false)} fr={fr} />
    </main>
  );
}

function FeuilleMesures({ ouverte, fermer, fr }) {
  const Xl = X();
  const liste = etat.value.mesures ?? [];
  const [cle, setCle] = useState('poitrine');
  const [datePrise, setDatePrise] = useState(jourLocal(new Date()));
  const [valSaisie, setValSaisie] = useState('');
  const enregistrer = async (e) => {
    e.preventDefault();
    const v = Number(String(valSaisie).replace(',', '.'));
    if (!v || v <= 0 || v > 500) { afficher(Xl.erreur, 'danger'); return; }
    try {
      await api('POST', '/api/mesures', { cle, valeur: v, prise_le: `${datePrise}T12:00:00` });
      await charger(); afficher(Xl.mesureEnregistree); setValSaisie(''); fermer();
    } catch { afficher(Xl.erreur, 'danger'); }
  };
  return (
    <Feuille ouverte={ouverte} fermer={fermer} titre={Xl.mesuresTitre}>
      <form class="pile" onSubmit={enregistrer}>
        <div class="champ">
          <label class="label" for="fm-cle">{Xl.mesureType}</label>
          <select id="fm-cle" class="form-input" value={cle} onInput={(e) => setCle(e.target.value)}>
            {CLES_MESURE.map((k) => <option key={k} value={k}>{fr ? LABELS_MESURE[k].fr : LABELS_MESURE[k].en}</option>)}
          </select>
        </div>
        <div class="champ">
          <label class="label" for="fm-date">{Xl.mesureDate}</label>
          <input id="fm-date" type="date" class="form-input" value={datePrise} max={jourLocal(new Date())} onInput={(e) => setDatePrise(e.target.value)} required />
        </div>
        <div class="champ">
          <label class="label" for="fm-val">{Xl.mesureValeur}</label>
          <Nombre valeur={valSaisie} onChange={setValSaisie} label={Xl.mesureValeur} classe="form-input" />
        </div>
        <button class="btn pri large" type="submit">{Xl.enregistrer}</button>
      </form>
      {liste.length > 0 && (
        <section class="section">
          <Kicker>{Xl.mesuresDernieres}</Kicker>
          <div class="carte liste-ex">
            {liste.slice(0, 15).map((m) => (
              <div class="ligne-seance" key={m.id}>
                <span>
                  <strong>{fr ? LABELS_MESURE[m.cle]?.fr ?? m.cle : LABELS_MESURE[m.cle]?.en ?? m.cle}</strong>
                  <small>{dateCourte(m.prise_le)}</small>
                </span>
                <span class="droite ligne-mesure-actions">
                  <strong>{m.cle === 'masse_grasse' ? `${nombre(m.valeur, 1)} %` : `${nombre(m.valeur, 1)} cm`}</strong>
                  <button type="button" class="rond petit" aria-label={`${Xl.supprimer} ${dateCourte(m.prise_le)}`} onClick={async () => {
                    try { await api('DELETE', `/api/mesures/${m.id}`); await charger(); } catch { afficher(Xl.erreur, 'danger'); }
                  }}>
                    <Ic n="trash" taille={15} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </Feuille>
  );
}