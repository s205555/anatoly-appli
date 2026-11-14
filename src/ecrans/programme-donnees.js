// Données partagées des programmes (couleur, dossier, séries prévues), hors de l'éditeur pour que l'accueil ne le charge pas.
export const TEINTES = ['#F3C7B1', '#A78BDA', '#A8C99E', '#9CC2E8', '#E8CF98', '#E6A4B9'];

const CLE = 'an_m06';
export const lireMeta = () => { try { return JSON.parse(localStorage.getItem(CLE) ?? '{}') || {}; } catch { return {}; } };
export const ecrireMeta = (patch) => {
  const m = { ...lireMeta(), ...patch };
  try { localStorage.setItem(CLE, JSON.stringify(m)); } catch { /* stockage plein ou privé */ }
  return m;
};

const somme = (id) => String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
export const couleurDe = (r) => {
  const c = String(r?.couleur ?? '').toUpperCase();
  return TEINTES.includes(c) ? c : TEINTES[somme(r?.id ?? 0) % TEINTES.length];
};
export const dossierDe = (r) => String(r?.dossier ?? '').trim();
export const liesDe = (r) => (Array.isArray(r?.lies) ? r.lies : []);

/** Nombre de séries prévues d'un exercice, formats ancien (series) et étendu (planifie). */
export const nbSeries = (e) => (Array.isArray(e?.planifie) && e.planifie.length ? e.planifie.length : Number(e?.series) || 3);

/** Adapte un programme au démarrage de séance : séries prévues, enchaînements. */
export function routinePourDemarrer(r) {
  const lies = new Set(liesDe(r));
  const liste = r.exercices ?? [];
  // « Enchaîner avec le suivant » de l'éditeur (lies) devient la supersérie de la séance (lieSuivant), jamais sur le dernier.
  return { ...r, exercices: liste.map((e, i) => ({
    ex: e.ex, series: nbSeries(e), reps: e.planifie?.find((p) => p.r)?.r ?? null, repos: e.repos ?? null,
    // Durée prévue (plans importés avec « time ») : la séance s'ouvre avec ce temps.
    secondes: e.planifie?.find((p) => p.s)?.s ?? null,
    lie: lies.has(e.ex) || !!e.lie, lieSuivant: i < liste.length - 1 && (lies.has(e.ex) || !!e.lieSuivant),
  })) };
}

/** Secondes d'une durée : nombre, « 30:00 », « 1:02:03 », « 45 min », « 1 h » (plan_share.dart, _seconds). */
export function secondesPlan(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : null;
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  const h = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(s);
  if (h) return h[3] == null ? Number(h[1]) * 60 + Number(h[2]) : Number(h[1]) * 3600 + Number(h[2]) * 60 + Number(h[3]);
  const n = nombrePlan(s);
  if (n == null) return null;
  if (s.includes('h')) return Math.round(n * 3600);
  if (s.includes('min') || /\d\s*m\b/.test(s)) return Math.round(n * 60);
  return Math.round(n);
}
/** Premier nombre d'une valeur (virgule acceptée), comme _double. */
export function nombrePlan(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const m = /\d+(?:[.,]\d+)?/.exec(v);
  return m ? Number(m[0].replace(',', '.')) : null;
}

/** Durée courte façon GymMane (_secs, clockLabel) : « 45 s » sous la minute, sinon « 1:00 ». */
export const horloge = (s) => (s < 60 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

// Poignée de réordonnancement (ReorderableDragStartListener) : glisser la ligne au doigt, ou flèches haut et bas au clavier.
// La ligne porte data-ligne ; le saut d'un rang vaut sa hauteur plus l'écart de 8 px.
let prise = null;
const lacher = () => { if (prise) { prise.ligne.style.transform = ''; prise.ligne.style.zIndex = ''; prise.ligne.classList.remove('souleve'); } };
export function poigneeReordre(i, n, deplacer) {
  return {
    style: 'touch-action:none',
    onPointerDown: (e) => {
      const ligne = e.currentTarget.closest('[data-ligne]');
      if (!ligne) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      prise = { y: e.clientY, h: ligne.offsetHeight + 8, ligne };
      ligne.classList.add('souleve');
      ligne.style.transform = 'scale(1.03)'; // liftedRow : 1 + 0,03
    },
    onPointerMove: (e) => { if (prise) { prise.ligne.style.transform = `translateY(${e.clientY - prise.y}px) scale(1.03)`; prise.ligne.style.zIndex = '3'; } },
    onPointerUp: (e) => {
      if (!prise) return;
      const d = Math.round((e.clientY - prise.y) / prise.h);
      lacher(); prise = null;
      const j = Math.max(0, Math.min(n - 1, i + d));
      if (j !== i) deplacer(i, j);
    },
    onPointerCancel: () => { lacher(); prise = null; },
    onKeyDown: (e) => {
      const j = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : null;
      if (j === null || j < 0 || j >= n) return;
      e.preventDefault();
      deplacer(i, j);
    },
  };
}
/** Déplace l'élément i au rang j d'une copie de la liste. */
export const deplacerDans = (l, i, j) => { const c = [...l]; const [x] = c.splice(i, 1); c.splice(j, 0, x); return c; };

// Échelles de progression de l'original (kProgressions), avec les exercices du catalogue Anatoly qui leur correspondent.
export const ECHELLES = [
  ['mur-push-up', 'incline-push-up', 'genou-push-up', 'pompes', 'close-grip-push-up', 'pompes-declinees', 'pseudo-planche-push-up'],
  ['vertical-rowing', 'rowing-inverse', 'leste-inverted-rowing'],
  ['assiste-squat', 'squat-au-poids-du-corps', 'split-squats', 'squat-bulgare', 'beginner-crevette-squat', 'intermediate-crevette-squat', 'crevette-squat', 'leste-crevette-squat'],
  ['poids-du-corps-romanian-souleve-de-terre', 'poids-du-corps-unilateral-jambe-souleve-de-terre', 'bande-nordique-curl-negatif', 'bande-nordique-curl', 'leg-curl-nordique'],
  ['negatif-dip', 'dips-aux-barres-paralleles', 'leste-tricep-dips'],
  ['scapulaire-tirage-up', 'negatif-tirage-up', 'tractions-pronation', 'leste-tirage-up'],
];
// Mouvements lents (kSlowReps) : 3 séries de 5 suffisent.
export const LENTS = new Set(['negatif-dip', 'negatif-tirage-up', 'bande-nordique-curl-negatif', 'bande-nordique-curl', 'leg-curl-nordique']);

export const echelleDe = (id) => ECHELLES.find((l) => l.includes(id));
export const etapeSuivante = (id) => { const l = echelleDe(id); const i = l ? l.indexOf(id) : -1; return i >= 0 && i + 1 < l.length ? l[i + 1] : null; };
// Séries de travail prévues d'un exercice du programme (routineSets).
export const planDe = (e) => (Array.isArray(e.planifie) && e.planifie.length ? e.planifie : Array.from({ length: Number(e.series) || 3 }, () => ({ r: e.reps ?? null, kg: null, s: null, type: 'n' })));
export const seriesTravail = (e) => { const p = planDe(e); return p.filter((x) => x.type !== 'e').length || p.length; };
// Ajoute ou retire des séries de travail (bumpRoutineSets), au moins une, au plus 20.
export function ajusterPlan(e, delta) {
  const p = [...planDe(e)];
  if (delta > 0) for (let k = 0; k < delta && p.length < 20; k++) p.push({ ...(p.filter((x) => x.type !== 'e').at(-1) ?? { r: null, kg: null, s: null }), type: 'n' });
  else for (let k = 0; k < -delta; k++) {
    const i = p.findLastIndex((x) => x.type !== 'e');
    if (i < 0 || p.filter((x) => x.type !== 'e').length <= 1) break;
    p.splice(i, 1);
  }
  return p;
}
