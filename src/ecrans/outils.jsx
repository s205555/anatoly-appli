/**
 * Outils : grille des dix calculatrices, pages de calcul, illustrations.
 * Portage de lib/screens/tools_screen.dart, tool_detail_screen.dart, tool_art.dart et state/tools_state.dart (GymMane, GPLv3).
 * L'unité suit les réglages du compte ; le poids de barre choisi est gardé sur le compte (module « outils »).
 */
import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { langue, dp } from '../i18n.js';
import { EnTete, Feuille } from '../ui.jsx';
import { M12 } from '../i18n/m12.js';
import { ecrireModule, etat, lireModule, unite } from '../donnees.js';
import { disquesGroupes, ffmiEtNiveau, masseGrasseUSNavy, rpePercent, scoreForce, totalChargeable } from '../calculatrices.js';
import { dessinerOutil } from './outil-art.js';
import './m12.css';


const loc = () => M12[langue] ?? M12.fr;
const ORDRE = ['rm', 'bmi', 'cal', 'bf', 'ffmi', 'plate', 'warmup', 'rpe', 'dots', 'wilks'];
const LB = 2.20462;
const ACTIVITES = [1.2, 1.375, 1.55, 1.725];
const ACT_PROFIL = { sedentaire: 1.2, leger: 1.375, modere: 1.55, actif: 1.725, tres_actif: 1.725 };

// Arrondis de fit_core.dart.
const r1 = (n) => Math.round(n * 10) / 10;
const auPas = (n, pas) => Math.round(n / pas) * pas;
const rondPoids = (n) => { const q = Math.round(n * 4) / 4; return Math.abs(n - q) < 0.005 ? q : r1(n); };
const borne = (v, min, max) => Math.round(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v)) * 100) / 100;
/** fmt de GymMane : entier sans décimale, sinon décimale à la française. */
const fmt = (n) => { const v = Math.round(n * 100) / 100; return Number.isInteger(v) ? String(v) : langue === 'fr' ? String(v).replace('.', ',') : String(v); };
const lireNombre = (s) => { const v = parseFloat(String(s).trim().replace(',', '.')); return Number.isFinite(v) ? v : null; };

// ---------- Briques (ui_kit.dart : StepperControl, ToolRow, ToolGroup, SegToggle, SoftCard) ----------

function Pas({ valeur, moins, plus, edit, minW = 70, label }) {
  const L = loc();
  return h('div', { class: 'outil-pas' },
    h('button', { type: 'button', class: 'outil-pas-btn', 'aria-label': `${label} −`, onClick: moins }, '−'),
    edit
      ? h('button', { type: 'button', class: 'outil-pas-val', style: { minWidth: minW }, 'aria-label': `${label}${dp()}${valeur}`, title: L.valider, onClick: edit }, valeur)
      : h('span', { class: 'outil-pas-val', style: { minWidth: minW } }, valeur),
    h('button', { type: 'button', class: 'outil-pas-btn', 'aria-label': `${label} +`, onClick: plus }, '+'),
  );
}

const Ligne = ({ label, children }) => h('div', { class: 'outil-ligne' }, h('span', { class: 'outil-ligne-nom' }, label), children);

function Seg({ options }) {
  return h('div', { class: 'outil-seg', role: 'radiogroup' },
    ...options.map(([l, actif, fn]) => h('button', { type: 'button', role: 'radio', 'aria-checked': actif, class: actif ? 'actif' : '', onClick: fn }, l)));
}

const Carte = ({ children, classe = '' }) => h('div', { class: `outil-carte-douce ${classe}` }, children);
const Section = ({ children }) => h('p', { class: 'outil-section' }, children);
const Note = ({ children }) => h('p', { class: 'outil-note' }, children);

/** Regroupe les lignes consécutives dans une seule carte à séparateurs (_grouped de GymMane). */
function grouper(items) {
  const out = [];
  let lot = [];
  const vider = () => { if (lot.length) out.push(h('div', { class: 'outil-groupe' }, ...lot)); lot = []; };
  for (const it of items) {
    if (it?.type === Ligne) lot.push(it);
    else { vider(); out.push(it); }
  }
  vider();
  return out;
}

/** Saisie d'une valeur au clavier (askNumber de GymMane) : boîte centrée, grand champ, Annuler / Valider. */
function SaisieNombre({ edition, fermer }) {
  const L = loc();
  const ref = useRef(null);
  const [texte, setTexte] = useState(edition.initial);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
    const touche = (e) => { if (e.key === 'Escape') { e.stopPropagation(); fermer(); } };
    document.addEventListener('keydown', touche);
    return () => document.removeEventListener('keydown', touche);
  }, []);
  const valider = () => { const v = lireNombre(texte); if (v !== null) edition.appliquer(v); fermer(); };
  return h('div', { class: 'outil-voile', onClick: (e) => e.target === e.currentTarget && fermer() },
    h('div', { class: 'outil-dialogue', role: 'dialog', 'aria-modal': 'true', 'aria-label': edition.titre },
      h('h2', null, edition.titre),
      h('input', {
        ref, class: 'outil-dialogue-champ', value: texte, inputMode: edition.decimal ? 'decimal' : 'numeric', enterKeyHint: 'done', 'aria-label': edition.titre,
        onInput: (e) => setTexte(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter') valider(); },
      }),
      h('div', { class: 'outil-dialogue-actions' },
        h('button', { type: 'button', class: 'secondaire', onClick: fermer }, L.annuler),
        h('button', { type: 'button', class: 'principal', onClick: valider }, L.valider))));
}

// ---------- Écran ----------

function depart() {
  // Valeurs de départ de tools_state.dart, puis profil et dernier poids pesé (_seedCalculatorsFromProfile).
  const pr = etat.value?.profil ?? {};
  const pesees = etat.value?.poids;
  const kg = (Array.isArray(pesees) && pesees.length ? Number(pesees[pesees.length - 1].kg) : 0) || 75;
  const cm = Number(pr.tailleCm) || 175;
  const sexe = pr.sexe === 'f' ? 'f' : 'm';
  const barre = lireModule('outils')?.barreKg;
  return {
    rmPoids: 100, rmReps: 5, rmPct: 75,
    imcTaille: cm, imcPoids: kg,
    calAge: Number(pr.age) || 28, calTaille: cm, calPoids: kg, calSexe: sexe, calAct: ACT_PROFIL[pr.activite] ?? 1.55,
    bfSexe: sexe, bfTaille: cm, bfCou: 38, bfVentre: 84, bfHanches: 95,
    cible: 100, barreKg: Number.isFinite(barre) && barre >= 0 ? barre : null,
    echauf: 100,
    rpPoids: 100, rpReps: 5, rpRpe: 8, rpCReps: 3, rpCRpe: 9,
    fSexe: sexe, fCorps: kg, fSquat: 140, fBench: 100, fDead: 180,
    ffSexe: sexe, ffTaille: cm, ffPoids: kg, ffGras: 15,
  };
}

export function EcranOutils() {
  const L = loc();
  const [onglet, setOnglet] = useState(null);
  const [s, setS] = useState(depart);
  const [edition, setEdition] = useState(null);
  const [feuille, setFeuille] = useState(null); // charge affichée de la feuille « disques » ouverte depuis le 1RM
  const maj = (p) => setS((x) => ({ ...x, ...p }));

  const lb = unite() === 'lb';
  const u = lb ? 'lb' : 'kg';
  const aff = (kg) => (lb ? kg * LB : kg);
  const deAff = (v) => (lb ? v / LB : v);
  const pasPoids = lb ? 5 : 2.5;
  const pasCorps = lb ? 1 : 0.5;
  const val = (kg) => `${fmt(rondPoids(aff(kg)))} ${u}`;
  const barreAff = s.barreKg == null ? (lb ? 45 : 20) : rondPoids(aff(s.barreKg));
  const barres = lb ? [45, 35, 15] : [20, 15, 10];
  const editer = (titre, actuel, decimal, appliquer) => setEdition({ id: Date.now(), titre, initial: fmt(actuel), decimal, appliquer });
  const choisirBarre = (b) => {
    const kg = Math.round(deAff(Math.min(Math.max(b, 0), lb ? 220 : 100)) * 1000) / 1000;
    maj({ barreKg: kg });
    ecrireModule('outils', { ...(lireModule('outils') ?? {}), barreKg: kg }).catch(() => {});
  };

  // Ligne de poids : pas de l'unité, saisie au clavier dans l'unité affichée.
  const lignePoids = (label, cle, { min = 0, max = null, pas = pasPoids } = {}) => h(Ligne, { label },
    h(Pas, {
      label, valeur: val(s[cle]),
      moins: () => maj({ [cle]: borne(s[cle] - deAff(pas), min, max) }),
      plus: () => maj({ [cle]: borne(s[cle] + deAff(pas), min, max) }),
      edit: () => editer(label, aff(s[cle]), true, (v) => maj({ [cle]: borne(deAff(v), min, max) })),
    }));
  // Ligne de nombre simple (cm, reps, %, âge).
  const ligneNombre = (label, cle, { pas = 1, min, max, minW = 70, texte = (v) => fmt(v), decimal = true, edit = true } = {}) => h(Ligne, { label },
    h(Pas, {
      label, valeur: texte(s[cle]), minW,
      moins: () => maj({ [cle]: borne(s[cle] - pas, min, max) }),
      plus: () => maj({ [cle]: borne(s[cle] + pas, min, max) }),
      edit: edit ? () => editer(label, s[cle], decimal, (v) => maj({ [cle]: borne(decimal ? v : Math.round(v), min, max) })) : null,
    }));
  const ligneSexe = (cle) => h(Ligne, { label: L.sexe },
    h(Seg, { options: [[L.homme, s[cle] === 'm', () => maj({ [cle]: 'm' })], [L.femme, s[cle] === 'f', () => maj({ [cle]: 'f' })]] }));

  const cartePiles = (cible, barre) => {
    const rangs = disquesGroupes(cible, barre, u);
    const possible = totalChargeable(cible, barre, u);
    return [
      ...(rangs.length
        ? rangs.map((p) => h('div', { class: 'outil-cote' }, h('strong', null, `${fmt(p.poids)} ${u}`), h('span', null, L.nParCote(p.nb))))
        : [h('p', { class: 'outil-cote-vide' }, L.barreSeule)]),
      possible < cible - 0.01 ? h('p', { class: 'outil-possible' }, L.possible(`${fmt(possible)} ${u}`)) : null,
    ];
  };
  const puces = (actuelle, choisir, editerPerso) => {
    const perso = !barres.includes(actuelle);
    return h('div', { class: 'outil-puces' },
      ...barres.map((b) => h('button', { type: 'button', class: actuelle === b ? 'actif' : '', 'aria-pressed': actuelle === b, onClick: () => choisir(b) }, `${fmt(b)} ${u}`)),
      h('button', { type: 'button', class: perso ? 'actif' : '', 'aria-pressed': perso, onClick: editerPerso }, perso ? `${fmt(actuelle)} ${u}` : L.perso));
  };

  if (onglet === null) {
    return h('main', { class: 'ecran outils-page' },
      h(EnTete, { titre: L.titre, retour: '#/', sous: L.compteOutil(ORDRE.length) }),
      h(GrilleOutils, { onOuvrir: setOnglet, noms: L.noms, descs: L.descs }));
  }

  const id = ORDRE[onglet];
  let valeur = '';
  let indice = '';
  let items = [];

  if (id === 'rm') {
    const rm = r1(s.rmPoids * (1 + s.rmReps / 30));
    const cible = aff((rm * s.rmPct) / 100);
    const charge = cible <= barreAff ? auPas(cible, pasPoids) : totalChargeable(cible, barreAff, u);
    const plaques = charge > barreAff ? disquesGroupes(charge, barreAff, u) : [];
    valeur = val(rm); indice = L.indices.rm;
    const corps = [
      h('span', { class: 'outil-pct-col' },
        h('span', { class: 'outil-pct-nom' }, L.duMax(`${s.rmPct}%`)),
        plaques.length ? h('span', { class: 'outil-pct-disques' }, plaques.map((p) => (p.nb === 1 ? fmt(p.poids) : `${fmt(p.poids)}×${p.nb}`)).join(' · ')) : null),
      h('strong', { class: 'outil-pct-val' }, `${fmt(charge)} ${u}`),
    ];
    items = [
      lignePoids(L.poidsSouleve, 'rmPoids'),
      ligneNombre(L.repsFaites, 'rmReps', { min: 1, max: 20, minW: 40, decimal: false }),
      ligneNombre(L.pourcentage, 'rmPct', { min: 30, max: 100, minW: 52, decimal: false, texte: (v) => `${v}%` }),
      charge > barreAff
        ? h('button', { type: 'button', class: 'outil-carte-douce outil-pct', onClick: () => setFeuille(charge) }, ...corps)
        : h('div', { class: 'outil-carte-douce outil-pct' }, ...corps),
    ];
  } else if (id === 'bmi') {
    const imc = r1(s.imcPoids / (s.imcTaille / 100) ** 2);
    valeur = fmt(imc);
    indice = L.imcCats[imc < 18.5 ? 'maigreur' : imc < 25 ? 'normal' : imc < 30 ? 'surpoids' : 'obesite'];
    items = [
      ligneNombre(L.taille, 'imcTaille', { min: 100, max: 250, texte: (v) => `${Math.round(v)} cm` }),
      lignePoids(L.poids, 'imcPoids', { min: 30, max: 250, pas: pasCorps }),
    ];
  } else if (id === 'cal') {
    const bmr = 10 * s.calPoids + 6.25 * s.calTaille - 5 * s.calAge + (s.calSexe === 'f' ? -161 : 5);
    const tdee = Math.round(bmr * s.calAct);
    valeur = `${tdee} kcal`; indice = L.indices.cal;
    const macro = (l, v) => h('div', { class: 'outil-carte-douce outil-macro' }, h('span', null, l), h('strong', null, `${v}g`));
    items = [
      ligneSexe('calSexe'),
      ligneNombre(L.age, 'calAge', { min: 10, max: 90, minW: 40, decimal: false }),
      ligneNombre(L.taille, 'calTaille', { min: 100, max: 250, texte: (v) => `${Math.round(v)} cm` }),
      lignePoids(L.poids, 'calPoids', { min: 30, max: 250, pas: pasCorps }),
      h(Carte, null, h('p', { class: 'outil-carte-titre' }, L.activite),
        h('div', { class: 'outil-pilules' }, ...ACTIVITES.map((a, i) => h('button', { type: 'button', class: s.calAct === a ? 'actif' : '', 'aria-pressed': s.calAct === a, onClick: () => maj({ calAct: a }) }, L.activites[i])))),
      h('div', { class: 'outil-macros' },
        macro(L.proteines, Math.round((tdee * 0.3) / 4)), macro(L.glucides, Math.round((tdee * 0.4) / 4)), macro(L.lipides, Math.round((tdee * 0.3) / 9))),
    ];
  } else if (id === 'bf') {
    const bf = masseGrasseUSNavy({ sexe: s.bfSexe, tailleCm: s.bfTaille, couCm: s.bfCou, tailleVisCm: s.bfVentre, hanchesCm: s.bfHanches });
    valeur = `${fmt(bf?.pct ?? 0)}%`; indice = L.indices.bf;
    const cm = (v) => `${fmt(r1(v))} cm`;
    items = [
      ligneNombre(L.taille, 'bfTaille', { min: 100, max: 250, texte: (v) => `${Math.round(v)} cm` }),
      ligneNombre(L.cou, 'bfCou', { pas: 0.5, min: 20, max: 60, texte: cm }),
      ligneNombre(L.ventre, 'bfVentre', { pas: 0.5, min: 40, max: 200, texte: cm }),
      ligneNombre(L.hanches, 'bfHanches', { pas: 0.5, min: 40, max: 200, texte: cm }),
    ];
  } else if (id === 'plate') {
    valeur = val(s.cible); indice = L.indices.plate;
    const cible = aff(s.cible);
    items = [
      lignePoids(L.poidsCible, 'cible'),
      h(Carte, null, h('p', { class: 'outil-carte-titre' }, L.barre),
        puces(barreAff, choisirBarre, () => editer(L.barre, barreAff, true, choisirBarre))),
      h(Carte, null, h('p', { class: 'outil-carte-titre' }, L.parCote), ...cartePiles(cible, barreAff)),
    ];
  } else if (id === 'warmup') {
    valeur = val(s.echauf); indice = L.indices.warmup;
    const t0 = aff(s.echauf);
    items = [
      lignePoids(L.chargeTravail, 'echauf'),
      h('div', { class: 'outil-carte-douce outil-echauf' },
        ...[[40, 10], [60, 5], [80, 3], [90, 1]].map(([p, n]) => h('div', { class: 'outil-echauf-ligne' },
          h('span', null, `${p}% · ${L.nReps(n)}`), h('strong', null, `${fmt(auPas((t0 * p) / 100, pasPoids))} ${u}`)))),
    ];
  } else if (id === 'rpe') {
    const part = (r, e) => rpePercent(r, e) ?? 1 / (1 + r / 30);
    const unRm = r1(s.rpPoids / part(s.rpReps, s.rpRpe));
    const res = deAff(auPas(aff(unRm * part(s.rpCReps, s.rpCRpe)), pasPoids));
    valeur = val(res); indice = L.rpeIndice(s.rpCReps, fmt(s.rpCRpe));
    items = [
      h(Section, null, L.rpeSerie),
      lignePoids(L.poidsSouleve, 'rpPoids'),
      ligneNombre(L.repsFaites, 'rpReps', { min: 1, max: 12, minW: 40, edit: false }),
      ligneNombre(L.rpeEffort, 'rpRpe', { pas: 0.5, min: 6, max: 10, minW: 40, edit: false }),
      h(Section, null, L.rpeBut),
      ligneNombre(L.repetitions, 'rpCReps', { min: 1, max: 12, minW: 40, edit: false }),
      ligneNombre(L.rpeEffort, 'rpCRpe', { pas: 0.5, min: 6, max: 10, minW: 40, edit: false }),
      h(Note, null, `${L.rpeUnRm(val(unRm))}\n${L.rpeExplique}`),
    ];
  } else if (id === 'dots' || id === 'wilks') {
    const sc = scoreForce({ sexe: s.fSexe, poidsCorpsKg: s.fCorps, squatKg: s.fSquat, benchKg: s.fBench, deadliftKg: s.fDead, type: id });
    valeur = fmt(sc.score); indice = L.niveauxDOTS[sc.niveau];
    items = [
      ligneSexe('fSexe'),
      lignePoids(L.corps, 'fCorps', { min: 30, max: 250 }),
      h(Section, null, L.meilleures),
      lignePoids(L.squat, 'fSquat'),
      lignePoids(L.bench, 'fBench'),
      lignePoids(L.deadlift, 'fDead'),
      h(Note, null, `${L.total(val(sc.total))}\n${id === 'wilks' ? L.wilksExplique : L.dotsExplique}`),
    ];
  } else if (id === 'ffmi') {
    const ff = ffmiEtNiveau({ sexe: s.ffSexe, tailleCm: s.ffTaille, poidsKg: s.ffPoids, grasPct: s.ffGras });
    valeur = fmt(ff.score); indice = L.niveauxFFMI[ff.niveau];
    items = [
      ligneSexe('ffSexe'),
      ligneNombre(L.taille, 'ffTaille', { min: 100, max: 250, texte: (v) => `${Math.round(v)} cm` }),
      lignePoids(L.poids, 'ffPoids', { min: 30, max: 300, pas: pasCorps }),
      ligneNombre(L.ffmiGras, 'ffGras', { pas: 0.5, min: 3, max: 60, minW: 52, texte: (v) => `${fmt(v)}%` }),
      h(Note, null, `${L.ffmiMaigre(val(ff.lean))}\n${L.ffmiExplique}`),
    ];
  }

  return h('main', { class: 'ecran outil-page' },
    h(EnTete, { titre: L.titres[onglet], onRetour: () => setOnglet(null) }),
    h('div', { class: 'bandeau' },
      h('span', { class: 'bandeau-label' }, L.resultat),
      h('span', { class: 'bandeau-valeur' }, valeur),
      h('span', { class: 'bandeau-sous' }, indice)),
    ...grouper(items),
    h(FeuilleDisques, { charge: feuille, fermer: () => setFeuille(null), barreDepart: barreAff, barres, u, editer, L, cartePiles }),
    edition && h(SaisieNombre, { key: edition.id, edition, fermer: () => setEdition(null) }));
}

/** Feuille « Calculateur de disques » ouverte depuis la carte du pourcentage (showPlateSheet). La barre choisie ici ne change pas le réglage. */
function FeuilleDisques({ charge, fermer, barreDepart, barres, u, editer, L, cartePiles }) {
  const [barre, setBarre] = useState(barreDepart);
  useEffect(() => { if (charge != null) setBarre(barreDepart); }, [charge]);
  const perso = !barres.includes(barre);
  return h(Feuille, {
    ouverte: charge != null, fermer, titre: L.titres[5], sansFocus: true,
    pied: h('button', { type: 'button', class: 'btn pri large', onClick: fermer }, L.terminer),
  },
  h('p', { class: 'outil-feuille-charge' }, `${fmt(charge ?? 0)} ${u}`),
  h('p', { class: 'outil-feuille-titre' }, L.barre),
  h('div', { class: 'outil-puces grandes' },
    ...barres.map((b) => h('button', { type: 'button', class: barre === b ? 'actif' : '', 'aria-pressed': barre === b, onClick: () => setBarre(b) }, `${fmt(b)} ${u}`)),
    h('button', { type: 'button', class: perso ? 'actif' : '', 'aria-pressed': perso, onClick: () => editer(L.barre, barre, true, (v) => { if (v >= 0) setBarre(v); }) }, perso ? `${fmt(barre)} ${u}` : L.perso)),
  h('p', { class: 'outil-feuille-titre' }, L.parCote),
  h('div', { class: 'outil-feuille-cotes' }, ...cartePiles(charge ?? 0, barre)));
}

export function ArtOutil({ id }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    const r = window.devicePixelRatio || 1;
    c.width = 64 * r;
    c.height = 54 * r;
    const ctx = c.getContext('2d');
    ctx.scale(r, r);
    // Thème sombre de GymMane : luminance du fond < 0,5 (ici, le thème actif du compte).
    const t = document.documentElement.dataset.theme;
    const sombre = t === 'sombre' || t === 'amoled' || (t === 'systeme' && !matchMedia('(prefers-color-scheme: light)').matches);
    dessinerOutil(ctx, id, sombre, r);
  }, [id]);
  return h('canvas', { ref, class: 'outil-art', width: 64, height: 54, 'aria-hidden': 'true' });
}

/** Grille des dix outils (tools_screen.dart) ; noms et descriptions viennent de i18n/m12.js. */
export function GrilleOutils({ onOuvrir, noms, descs }) {
  return h(
    'div',
    { class: 'outils-grille' },
    ...ORDRE.map((id, i) => h(
      'button',
      { type: 'button', class: 'outil-carte', onClick: () => onOuvrir(i) },
      h(ArtOutil, { id }),
      h('span', { class: 'outil-nom' }, noms[i]),
      h('span', { class: 'outil-desc' }, descs[i]),
    )),
  );
}
