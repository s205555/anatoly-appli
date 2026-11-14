// Accueil (home_screen.dart) : date, carte du jour, semaine, cette semaine, programmes, activité, recommandés, classeurs.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  afficher,
  api,
  bilanSeance,
  demarrer,
  demarrerDepuisMuscles,
  enCours,
  etat,
  estJourReposPlan,
  jourDe,
  jourLocal,
  lireModule,
  lundi,
  nbExercicesValides,
  nomExercice,
  recordsDe,
  programmesDuJour,
  jourManuel,
  routineSelonPlanDuJour,
  sauverExtensions,
  semaine,
  serieJours,
  suggestionsReco,
  tousExercices,
  volume,
} from '../donnees.js';
import { IllustrationExercice } from '../illustrations.js';
import { langue, t, dp } from '../i18n.js';
import { m02 } from '../i18n/m02.js';
import { M12 } from '../i18n/m12.js';
import { SilhouettePar } from '../silhouette-paresseuse.jsx';
import { paresseux } from '../paresseux.js';
import { Anneau, Feuille, feuilleDemarrage, Ic, Kicker, Section } from '../ui.jsx';
import { eauMl, macrosJour } from './nutrition/store.js';
import { journal } from './journal-donnees.js';
import { HeatmapAccueil } from './heatmap-accueil.jsx';
import { TEINTES_DOSSIER } from './couleurs-programmes.js';
import { couleurCarte, Dossier, estArchive, intensitesDe } from './programmes-legers.jsx';
import { dossierDe } from './programme-donnees.js';
import { lireM13 } from './reglages-m13.js';
import './m02.css';

// Feuille du jour touché dans la carte activité : chargée à la demande (fermée, elle n'affiche rien).
const FeuilleJournal = paresseux(() => import('./progres.jsx'), 'FeuilleJournal');

const lancerLibre = () => { if (!enCours.value) demarrer(null); location.hash = '#/seance'; };
const lancerRoutine = (routine) => { if (!enCours.value) demarrer(routine); location.hash = '#/seance'; };

// dayOffReasons de GymMane (stats_state.dart) dans son ordre, avec les icônes de day_off_sheet.dart.
const RAISONS_REPOS = ['malade', 'voyage', 'blessure', 'repos'];
const ICONE_MOTIF = { repos: 'bed', malade: 'thermometer-simple', voyage: 'airplane-tilt', blessure: 'bandaids' };

// Textes des feuilles du jour (day_off_sheet.dart, showTodayPlanMenu, showMoveDaySheet, start_sheet.dart).
const TX = {
  fr: {
    entraine: 'J\'ai fait ma séance, sans la noter', malade: 'Maladie', voyage: 'Voyage', blessure: 'Blessure', repos: 'Repos',
    demarrer: 'Commencer une séance', programmeDuJour: 'Programme du jour', vosProgrammes: 'Vos programmes', ouCommencer: 'Ou commencer par',
    choisirExercices: 'Choisir des exercices', choisirCible: 'Choisir une cible',
    deplacer: 'Déplacer à un autre jour', deplacerSous: 'Juste cette fois, votre programme de la semaine ne change pas.',
    passer: 'Passer au suivant', rotation: 'Rotation', modifier: 'Modifier', planHebdo: 'Programme hebdomadaire', demain: 'Demain', jourRepos: 'Jour de repos', deplace: 'Séance déplacée', annuler: 'Annuler',
  },
  en: {
    entraine: "I trained, just didn't log it", malade: 'Illness', voyage: 'Travel', blessure: 'Injury', repos: 'Rest',
    demarrer: 'Start workout', programmeDuJour: "Today's routine", vosProgrammes: 'Your routines', ouCommencer: 'Or start from',
    choisirExercices: 'Pick exercises', choisirCible: 'Choose a focus',
    deplacer: 'Move to another day', deplacerSous: 'Just this once; your weekly plan stays the same.',
    passer: 'Skip to the next one', rotation: 'Rotation', modifier: 'Edit', planHebdo: 'Weekly plan', demain: 'Tomorrow', jourRepos: 'Rest day', deplace: 'Workout moved', annuler: 'Undo',
  },
};
const tx = () => TX[langue] ?? TX.fr;

// longDate de GymMane : « Saturday, Nov 7 » / « Samedi, 7 nov. ».
const fmt = (d, o) => new Intl.DateTimeFormat(langue === 'en' ? 'en-US' : 'fr-FR', o).format(d);
const majuscule = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const dateJour = (v) => { const d = typeof v === 'string' ? new Date(`${v}T12:00`) : new Date(v); return `${majuscule(fmt(d, { weekday: 'long' }))}, ${fmt(d, { month: 'short', day: 'numeric' })}`; };

// suggestedFocus (stats_state.dart) : famille de la dernière séance, puis la suivante ; sans séance, selon le jour.
const FAMILLES = {
  push: ['pectoraux', 'epaules', 'triceps'],
  pull: ['dos', 'biceps', 'trapezes', 'avant-bras', 'lombaires'],
  legs: ['quadriceps', 'ischios', 'fessiers', 'mollets'],
};
const ORDRE = ['push', 'pull', 'legs'];
function focusDuJour(seances, trouver) {
  const derniere = seances[0];
  const vol = {};
  for (const e of derniere?.donnees?.exercices ?? []) {
    const m = trouver(e.ex)?.muscle;
    const f = ORDRE.find((k) => FAMILLES[k].includes(m));
    if (f) vol[f] = (vol[f] ?? 0) + Math.max(1, bilanSeance({ exercices: [e] }).volume);
  }
  const top = Object.entries(vol).sort((a, b) => b[1] - a[1])[0]?.[0];
  const jourDart = new Date().getDay() || 7;
  const cle = top ? ORDRE[(ORDRE.indexOf(top) + 1) % 3] : ORDRE[jourDart % 3];
  return { cle, muscles: FAMILLES[cle].slice(0, 3) };
}

// Programme prévu un jour donné de la semaine fixe (même lecture que routineSelonPlanDuJour).
function routineDuJour(dow, routines, profil) {
  const p = etat.value?.plan;
  const ext = profil.extensions?.planSemaine;
  const id = p?.mode === 'semaine' ? p.jours?.[dow] ?? p.jours?.[String(dow)] : ext?.mode === 'fixe' ? ext.jours?.[dow] ?? ext.jours?.[String(dow)] : null;
  return id == null || id === 'repos' ? null : routines.find((r) => String(r.id) === String(id)) ?? null;
}

// Silhouette avant/dos des muscles d'un programme (MiniBody).
const MiniCorps = ({ r, hauteur }) => <span class="acc-mini" style={`height:${hauteur}px;width:${Math.round(hauteur * 535 / 462)}px`} aria-hidden="true">
  <SilhouettePar mode="heat" vueInitiale="both" ramp="ember" intensites={intensitesDe(r)} lang={langue} sexe={etat.value?.profil?.sexe === 'f' ? 'f' : 'm'} />
</span>;

/* ---------- Classeurs du bas (home_folder.dart) ---------- */

// _folderPath : coins de 16, onglet à gauche (face) ou à droite (dos), courbe de l'onglet à 48 % de la largeur.
function cheminClasseur(w, h, ongletGauche, tab) {
  const r = 16, s = w * 0.48;
  const haut = ongletGauche
    ? `M0 ${r}Q0 0 ${r} 0L${s - 10} 0C${s + 2} 0 ${s + 4} ${tab} ${s + 18} ${tab}L${w - r} ${tab}Q${w} ${tab} ${w} ${tab + r}`
    : `M0 ${tab + r}Q0 ${tab} ${r} ${tab}L${w - s - 18} ${tab}C${w - s - 4} ${tab} ${w - s - 2} 0 ${w - s + 10} 0L${w - r} 0Q${w} 0 ${w} ${r}`;
  return `${haut}L${w} ${h - r - 2}Q${w} ${h} ${w - r - 2} ${h}L${r + 2} ${h}Q0 ${h} 0 ${h - r - 2}Z`;
}

function Classeur({ id, titre, detail, href, apercu, badge }) {
  const ref = useRef(null);
  const [w, setW] = useState(110);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setW(Math.round(el.clientWidth) || 110);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const o = new ResizeObserver(() => setW(Math.round(el.clientWidth) || 110));
    o.observe(el);
    return () => o.disconnect();
  }, []);
  return <a ref={ref} class="classeur" href={href} aria-label={`${titre}, ${detail}`}>
    <svg class="classeur-dos" width={w} height="124" viewBox={`0 0 ${w} 124`} aria-hidden="true"><path d={cheminClasseur(w, 124, false, 10)} /></svg>
    <span class="classeur-apercu" aria-hidden="true">{apercu}</span>
    <svg class="classeur-face" width={w} height="90" viewBox={`0 0 ${w} 90`} aria-hidden="true">
      <defs>
        <linearGradient id={`cl-f-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="cl-haut" /><stop offset="1" class="cl-bas" /></linearGradient>
        <linearGradient id={`cl-b-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="cl-bord" /><stop offset=".6" class="cl-bord" stop-opacity="0" /></linearGradient>
      </defs>
      <path d={cheminClasseur(w, 90, true, 12)} fill={`url(#cl-f-${id})`} stroke={`url(#cl-b-${id})`} stroke-width="1" />
    </svg>
    <span class="classeur-texte">
      <span class="classeur-titre"><span>{titre}</span>{badge}</span>
      <span class="classeur-detail">{detail}</span>
    </span>
  </a>;
}

// _Fan : trois éléments en éventail (angles, décalages et hauteurs de GymMane).
const EVENTAIL = [[-0.12, -0.2, 10], [0.09, 0.2, 7], [-0.02, 0, 0]];
function Eventail({ largeur, hauteur, ecart = 1, enfants }) {
  const n = Math.min(enfants.length, 3);
  const ordre = n === 3 ? [0, 1, 2] : n === 2 ? [0, 1] : [2];
  return enfants.slice(0, n).map((enfant, k) => {
    const [rot, dx, dy] = EVENTAIL[ordre[k]];
    return <span key={k} class="cl-eventail" style={`left:calc(50% - ${largeur / 2}px + ${dx * ecart * 100}%);top:${dy}px;width:${largeur}px;height:${hauteur}px;transform:rotate(${rot}rad)`}>{enfant}</span>;
  });
}

const ApercuProgrammes = ({ teintes }) => <Eventail largeur={60} hauteur={50} enfants={[...teintes].reverse().map((c) => <span class="cl-feuille" style={`--c:${c}`}><i /><i /><i /></span>)} />;

const ApercuOutils = () => <Eventail largeur={46} hauteur={50} ecart={1.4} enfants={[['fire:bold', 'var(--accent)'], ['circles-three:bold', 'var(--brass)'], ['barbell:bold', 'var(--text)']].map(([n, c]) => <span class="cl-outil" style={`--c:${c}`}><Ic n={n} taille={19} /></span>)} />;

const ApercuNotes = () => <Eventail largeur={48} hauteur={48} enfants={['#F2D680', '#F3C7B1', '#A8C99E'].map((c) => <span class="cl-papier" style={`--c:${c}`}><i /><i /><i /><b /></span>)} />;

// NutritionPeek : [image, décalage, hauteur, rotation, rapport largeur/hauteur, levée].
const NUTRITION = [
  ['yogurt', -138, 50, -0.16, 1.03, 0],
  ['protein', -92, 62, -0.05, 0.68, 8],
  ['water', -48, 76, 0.06, 0.42, 12],
  ['pan', 4, 50, -0.1, 1.17, 2],
  ['shake', 56, 72, 0.08, 0.54, 6],
  ['can', 104, 62, -0.18, 0.71, 0],
  ['choco', 146, 56, 0.22, 0.84, -2],
];
const ApercuNutrition = () => NUTRITION.map(([nom, dx, h, rot, ratio, leve]) => <img key={nom} class="cl-aliment" src={`/statique/img/peek-${nom}.webp`} alt="" width={Math.round(h * ratio)} height={h} decoding="async"
  style={`left:calc(50% + ${dx - (h * ratio) / 2}px);top:${38 - h * 0.55 - leve}px;width:${h * ratio}px;height:${h}px;transform:rotate(${rot}rad)`} />);

// Feuille « Commencer une séance » (start_sheet.dart) : programme du jour, autres programmes par groupe, puis deux options.
// Exportée pour que le bouton ▶ de la barre du bas (appui long) l'ouvre aussi.
export function FeuilleDemarrage({ ouverte, fermer: fermerFeuille }) {
  // Ouverte depuis « Enregistrer une séance » d'un jour (start_sheet.dart day:) : la séance lancée est saisie sur ce jour.
  const jour = typeof ouverte === 'string' ? ouverte : null;
  const fermer = () => { jourManuel.value = null; fermerFeuille(); };
  const lancer = () => { jourManuel.value = jour; fermerFeuille(); };
  const T = tx();
  const { routines } = etat.value;
  const duJour = routineSelonPlanDuJour();
  // Plusieurs programmes ce jour-là (réglage) : tous en tête de la feuille, comme start_sheet.dart (routinesOn).
  const duJourTous = programmesDuJour();
  const prevus = (duJourTous.length > 1 ? duJourTous : duJour ? [duJour] : []).filter((r) => nbExercicesValides(r) > 0);
  // Groupes dans l'ordre de l'écran Programmes, puis les programmes sans groupe.
  const ordre = lireModule('groupes')?.ordre ?? [];
  const actifs = routines.filter((r) => !estArchive(r) && nbExercicesValides(r) > 0 && !prevus.includes(r));
  const groupes = [...new Set(actifs.map(dossierDe).filter(Boolean))].sort((a, b) => (ordre.indexOf(a) + 1 || 1e3) - (ordre.indexOf(b) + 1 || 1e3));
  const autres = [...groupes.flatMap((g) => actifs.filter((r) => dossierDe(r) === g)), ...actifs.filter((r) => !dossierDe(r))];
  const partir = (r) => { lancer(); lancerRoutine(r); };
  return <Feuille ouverte={!!ouverte} fermer={fermer} titre={T.demarrer} sous={dateJour(jour ?? new Date())} classe="m02-demarrage">
    {prevus.map((r) => <button type="button" class="m02-plan-carte" key={r.id} onClick={() => partir(r)}>
      <span class="m02-plan-corps">
        <span class="m02-plan-kicker">{T.programmeDuJour}</span>
        <span class="m02-plan-nom">{r.nom}</span>
        <span class="m02-plan-sous">{t.accueil.exercicesN(nbExercicesValides(r))}</span>
      </span>
      <span class="m02-plan-jouer" aria-hidden="true"><Ic n="play:fill" taille={18} /></span>
    </button>)}
    {autres.length > 0 && <p class="m02-feuille-label">{T.vosProgrammes}</p>}
    {autres.map((r) => <button type="button" class="m02-routine-ligne" key={r.id} onClick={() => partir(r)}>
      <span class="m02-routine-corps">
        <strong>{dossierDe(r) ? `${dossierDe(r)} · ${r.nom}` : r.nom}</strong>
        <small>{t.accueil.exercicesN(nbExercicesValides(r))}</small>
      </span>
      <Ic n="play:fill" taille={14} />
    </button>)}
    <p class="m02-feuille-label">{T.ouCommencer}</p>
    <a class="m02-routine-ligne" style="padding:14px;gap:13px" href="#/exercices" onClick={lancer}>
      <Ic n="list-plus" taille={19} /><span class="m02-routine-corps"><strong>{T.choisirExercices}</strong></span>
    </a>
    <a class="m02-routine-ligne" style="padding:14px;gap:13px" href="#/entrain" onClick={lancer}>
      <Ic n="person" taille={19} /><span class="m02-routine-corps"><strong>{T.choisirCible}</strong></span>
    </a>
  </Feuille>;
}

export function Accueil() {
  const L = m02[langue] ?? m02.fr;
  const A = L.acc;
  const { profil, seances, routines } = etat.value;
  // Ouverte aussi par ▶ (main.jsx) : état partagé.
  const demarrage = feuilleDemarrage.value;
  const setDemarrage = (v) => { feuilleDemarrage.value = v; };
  const [objectif, setObjectif] = useState(false);
  const [jourChoisi, setJourChoisi] = useState(null);
  const [jourHeat, setJourHeat] = useState(null);
  const [menuRoutine, setMenuRoutine] = useState(null);
  const [menuJour, setMenuJour] = useState(false);
  const [deplacement, setDeplacement] = useState(false);
  const appui = useRef({ minuteur: 0, long: false });
  const T = tx();

  const prefs = profil.extensions?.preferences ?? {};
  const joursRepos = prefs.joursRepos ?? {};
  // Jours cochés sans séance notée (GymMane checkins) et programmes déplacés pour un jour précis (planMoves).
  const pointes = prefs.joursEntraines ?? {};
  const deplacements = prefs.deplacements ?? {};
  // Cartes de l'accueil réglées dans Paramètres > Accueil (home_cards_panel.dart), toutes visibles par défaut.
  const m13 = lireM13();
  const voir = (cle) => m13[cle] !== false;

  const debutSem = lundi();
  const aujourdhui = jourLocal(new Date());

  // Carte du jour (_hero) : programme prévu, sinon jour de repos du plan, sinon objectif du jour.
  const planRoutine = routineSelonPlanDuJour();
  const actifs = routines.filter((r) => !estArchive(r));
  const routineLe = (d) => {
    const v = deplacements[jourLocal(d)];
    if (v === 'repos') return null;
    return (v != null ? actifs.find((r) => String(r.id) === String(v)) : null) ?? routineDuJour(d.getDay() || 7, actifs, profil);
  };
  const reposLe = (d) => {
    const v = deplacements[jourLocal(d)];
    return v === 'repos' || (v == null && estJourReposPlan(d.getDay() || 7));
  };
  const repos = !planRoutine && actifs.length > 0 && reposLe(new Date());
  let prochain = null;
  if (repos) {
    for (let i = 1; i <= 7 && !prochain; i += 1) {
      const d = new Date(); d.setDate(d.getDate() + i);
      const r = routineLe(d);
      if (r) prochain = { r, d };
    }
  }
  const routine = repos ? null : planRoutine;
  const nbEx = routine ? nbExercicesValides(routine) : 0;
  const estRoutine = nbEx > 0;
  const fini = estRoutine && seances.some((s) => jourDe(s.debut) === aujourdhui && s.nom === routine.nom);
  const focus = useMemo(() => focusDuJour(seances, (id) => tousExercices.value.find((e) => e.id === id)), [seances, tousExercices.value]);
  const nbFocus = useMemo(() => tousExercices.value.filter((e) => focus.muscles.includes(e.muscle)).length, [focus, tousExercices.value]);
  const [focusTitre, focusSous] = A.focus[focus.cle];
  const jourCourt = (d) => new Intl.DateTimeFormat(langue === 'en' ? 'en-US' : 'fr-FR', { weekday: 'short' }).format(d);
  const heroLabel = repos ? A.planHebdo : estRoutine ? t.accueil.programmeDuJour : A.objectifDuJour;
  const heroTitre = repos ? A.repos : estRoutine ? routine.nom : focusTitre;
  const heroSous = repos
    ? (prochain ? [A.ensuite(prochain.r.nom), jourCourt(prochain.d)].join(' · ') : '')
    : fini ? A.finiAujourdhui
      : estRoutine ? t.accueil.exercicesN(nbEx)
        : seances.length ? `${focusSous} · ${t.accueil.exercicesN(nbFocus)}` : A.premiereSeance;
  const lancerFocus = () => {
    if (enCours.value) { location.hash = '#/seance'; return; }
    demarrerDepuisMuscles(focus.muscles);
    if (!enCours.value) lancerLibre();
  };
  const heroAction = repos ? () => setDemarrage(true) : estRoutine ? () => lancerRoutine(routine) : lancerFocus;
  const heroBouton = repos ? A.quandMeme : fini ? A.encore : t.accueil.demarrer;
  const heroDiscret = repos || fini;

  const sem = semaine(seances);
  const joursSeance = new Set(sem.map((s) => jourDe(s.debut)));
  const finSem = new Date(debutSem); finSem.setDate(finSem.getDate() + 6);
  // isDayDone : séance notée ou jour coché ; compte pour l'objectif de la semaine.
  const joursFaits = new Set([...joursSeance, ...Object.keys(pointes).filter((k) => k >= jourLocal(debutSem) && k <= jourLocal(finSem))]);
  const stats = sem.reduce((a, s) => { const b = bilanSeance(s.donnees); return { volume: a.volume + b.volume, series: a.series + b.series }; }, { volume: 0, series: 0 });
  const records = sem.reduce((n, s) => n + recordsDe(s, seances).length, 0);
  const serie = serieJours(seances);
  const vol = volume(stats.volume);

  // routinesByLastDone : dernier fait en premier, jamais faits ensuite dans l'ordre d'origine.
  const derniereFois = (r) => seances.find((s) => s.nom === r.nom)?.debut ?? null;
  const parDernier = actifs.map((r, i) => ({ r, i, d: derniereFois(r) })).sort((a, b) => {
    if (a.d && b.d && a.d !== b.d) return a.d < b.d ? 1 : -1;
    if (!a.d !== !b.d) return a.d ? -1 : 1;
    return a.i - b.i;
  });
  const ilYa = (d) => {
    if (!d) return null;
    const j = Math.round((new Date(aujourdhui) - new Date(jourDe(d))) / 86400000);
    return A.faitIlYa(j);
  };

  const recos = useMemo(() => suggestionsReco(seances, tousExercices.value, 8), [seances, tousExercices.value]);
  const reduitAnim = Boolean(profil.reduire_animations ?? prefs.reduireAnimations);

  const nbNotes = journal.value.notes.length;
  const nutritionOn = voir('nutrition');
  const tot = nutritionOn ? macrosJour() : null;
  const nutritionDetail = !tot || (tot.kcal <= 0 && tot.p <= 0 && eauMl() === 0) ? A.nutritionVide : A.nutritionDetail(Math.round(tot.kcal), Math.round(tot.p));
  const teintesDossiers = actifs.length ? actifs.slice(0, 3).map(couleurCarte) : TEINTES_DOSSIER.slice(0, 3);

  // Un jour est soit coché (entraîné sans séance notée), soit marqué d'une raison de repos, jamais les deux.
  const marquerJour = async (cle, { motif = null, pointe = false }) => {
    const repos2 = { ...joursRepos }, pointes2 = { ...pointes };
    if (motif) repos2[cle] = motif; else delete repos2[cle];
    if (pointe) pointes2[cle] = true; else delete pointes2[cle];
    setJourChoisi(null);
    try {
      await sauverExtensions({ preferences: { joursRepos: repos2, joursEntraines: pointes2 } });
    } catch { afficher(t.commun.erreur, 'danger'); }
  };
  const setJourRepos = (cle, motif) => marquerJour(cle, { motif });
  const basculerPointe = (cle) => { if (cle <= aujourdhui) marquerJour(cle, { pointe: !pointes[cle] }); };

  // _weekDay : un jour avec séance ouvre son journal ; aujourd'hui (sans raison) ou un jour coché se coche ou se décoche ;
  // sinon la feuille du jour. L'appui long ouvre toujours la feuille du jour (sauf jour avec séance).
  const toucherJour = (j) => {
    if (appui.current.long) { appui.current.long = false; return; }
    if (j.seance) setJourHeat(j.cle);
    else if ((j.auj && !joursRepos[j.cle]) || pointes[j.cle]) basculerPointe(j.cle);
    else setJourChoisi(j);
  };
  const lacher = () => clearTimeout(appui.current.minuteur);
  const appuiLong = (j) => (j.seance ? {} : {
    onPointerDown: () => { lacher(); appui.current.long = false; appui.current.minuteur = setTimeout(() => { appui.current.long = true; setJourChoisi(j); }, 500); },
    onPointerUp: lacher, onPointerLeave: lacher, onPointerCancel: lacher,
    onContextMenu: (e) => e.preventDefault(),
  });

  // showMoveDaySheet : le programme du jour part sur un des 7 jours suivants, pour cette fois seulement.
  // shortcut: un seul programme par jour chez Anatoly, celui du jour d'arrivée est remplacé (GymMane les cumule).
  const joursSuivants = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i + 1); return d; });
  const deplacer = async (r, d, i) => {
    setDeplacement(false);
    const avant = deplacements;
    const limite = new Date(); limite.setDate(limite.getDate() - 14);
    const next = Object.fromEntries(Object.entries(avant).filter(([k]) => k >= jourLocal(limite)));
    next[aujourdhui] = 'repos';
    next[jourLocal(d)] = r.id;
    try {
      await sauverExtensions({ preferences: { deplacements: next } });
      afficher(`${T.deplace}${dp()}${r.nom}, ${i === 0 ? T.demain : majuscule(fmt(d, { weekday: 'long' }))}`, 'ok', {
        libelle: T.annuler,
        fn: () => sauverExtensions({ preferences: { deplacements: avant } }).catch(() => afficher(t.commun.erreur, 'danger')),
      });
    } catch { afficher(t.commun.erreur, 'danger'); }
  };
  const planTournant = etat.value.plan?.mode === 'rotation' || profil.extensions?.planSemaine?.mode === 'rotation';
  const passerRotation = async () => {
    setMenuJour(false);
    try { await sauverExtensions({ preferences: { decalageRotation: (prefs.decalageRotation ?? 0) + 1 } }); }
    catch { afficher(t.commun.erreur, 'danger'); }
  };

  const changerObjectif = async (delta) => {
    const p = etat.value.profil;
    const nv = Math.max(1, Math.min(7, (p.objectif_semaine ?? 3) + delta));
    if (nv === p.objectif_semaine) return;
    try {
      await api('PUT', '/api/reglages', { prenom: p.prenom, langue: p.langue, unite: p.unite, theme: p.theme, repos_s: p.repos_s, objectif_semaine: nv });
      etat.value = { ...etat.value, profil: { ...p, objectif_semaine: nv } };
    } catch { afficher(t.commun.erreur, 'danger'); }
  };

  return <main class="ecran avec-nav accueil">
    <header class="accueil-tete">
      <div>
        <Kicker>{t.accueil.aujourdhui}</Kicker>
        <h1 class="acc-h1 premiere-maj">{dateJour(new Date())}</h1>
      </div>
      <a class="chip-serie" href="#/progres" title={t.accueil.serie(serie)} aria-label={t.accueil.serie(serie)}>
        <Ic n="fire:fill" taille={15} />{serie}
      </a>
    </header>

    {(voir('carteFocus') || estRoutine) && <section class="carte hero-jour" aria-labelledby="hero-titre-id">
      <img src="/statique/img/runner.webp" alt="" aria-hidden="true" class="hero-illu" width="240" height="376" />
      <span class="deco d1" aria-hidden="true" />
      <span class="deco d2" aria-hidden="true" />
      <div class="hero-label">
        {fini && <span class="hero-coche" aria-hidden="true"><Ic n="check:bold" taille={8} /></span>}
        {repos && <span class="hero-lit" aria-hidden="true"><Ic n="bed:fill" taille={14} /></span>}
        <Kicker>{heroLabel}</Kicker>
      </div>
      <h2 id="hero-titre-id" class="hero-titre">{heroTitre}</h2>
      {(heroSous || (estRoutine && !repos)) && <div class="hero-ligne">
        {estRoutine && lireM13().miniCarte !== false && <MiniCorps r={routine} hauteur={38} />}
        <p class="hero-sous">{heroSous}</p>
      </div>}
      <div class="hero-actions">
        <button class={`btn ${heroDiscret ? 'hero-discret' : 'pri'} hero-btn`} type="button" onClick={heroAction}>
          <Ic n="play:fill" taille={15} />{heroBouton}
        </button>
        {estRoutine && !fini && (
          <button class="rond hero-plus" type="button" aria-label={t.accueil.options} onClick={() => setMenuJour(true)}>
            <Ic n="dots-three:bold" taille={22} />
          </button>
        )}
      </div>
    </section>}

    <section class="carte semaine" aria-label={t.accueil.cetteSemaine}>
      {t.jours.map((j, i) => {
        const d = new Date(debutSem); d.setDate(d.getDate() + i);
        const k = jourLocal(d);
        const seance = joursSeance.has(k), fait = joursFaits.has(k), auj = k === aujourdhui, futur = k > aujourdhui;
        // restOn : lit sauge seulement aujourd'hui ou plus tard, sans séance, quand un programme suit.
        const reposPlan = !fait && !(k < aujourdhui) && actifs.length > 0 && reposLe(d);
        const motif = joursRepos[k];
        const jr = { cle: k, date: d, seance, auj, futur };
        return <button
          type="button"
          class={`jour-click ${futur ? 'futur' : ''} ${auj ? 'auj' : ''}`}
          key={k}
          data-repos={motif || undefined}
          aria-label={`${t.joursLongs[i]}${fait ? ' ✓' : ''}${motif ? ` · ${T[motif]}` : reposPlan ? ` · ${t.accueil.reposJour}` : ''}`}
          onClick={() => toucherJour(jr)}
          {...appuiLong(jr)}
        >
          <span class="jour-lettre" aria-hidden="true">{j}</span>
          <span class={`pastille ${fait ? 'fait' : auj ? 'auj' : ''} ${(reposPlan || motif) && !fait ? 'repos' : ''}`} aria-hidden="true">
            {fait && <Ic n="check:bold" taille={13} />}
            {!fait && motif && <Ic n={ICONE_MOTIF[motif]} taille={15} />}
            {!fait && !motif && reposPlan && <Ic n="bed:fill" taille={14} />}
          </span>
        </button>;
      })}
    </section>

    {voir('carteSemaine') && <Section titre={t.accueil.cetteSemaine}>
      <div class="carte stats-semaine">
        <div class="stat"><Kicker>{t.accueil.volume}</Kicker><p class="stat-val">{vol.val}<small>{vol.unite}</small></p></div>
        <div class="stat"><Kicker>{t.accueil.series}</Kicker><p class="stat-val">{stats.series}</p></div>
        <div class="stat"><Kicker>{t.accueil.records}</Kicker><p class="stat-val">{records}</p></div>
        <button type="button" class="stat anneau-stat" onClick={() => setObjectif(true)} aria-label={L.objectif.titre}>
          <Anneau part={joursFaits.size / (profil.objectif_semaine || 1)} />
          <small>{A.joursCourt(joursFaits.size, profil.objectif_semaine)}</small>
        </button>
      </div>
    </Section>}

    {voir('carteProgrammes') && actifs.length > 0 && <Section titre={t.accueil.programmes} lien={['#/programmes', t.accueil.toutVoir]}>
      <div class="defile-h acc-dossiers">
        {parDernier.map(({ r, d }) => <Dossier key={r.id} r={r} dernier={ilYa(d)} onMenu={() => setMenuRoutine(r)} />)}
      </div>
    </Section>}

    <Section titre={t.accueil.activite} lien={['#/progres', t.accueil.toutVoir]}>
      <div class="carte-activite">
        <HeatmapAccueil seances={seances} ouvrirJour={setJourHeat} pointes={Object.keys(pointes)} teinte={prefs.teinteCarteChaleur} />
      </div>
    </Section>

    {voir('carteSuggestions') && recos.length > 0 && <Section titre={t.accueil.recommande} lien={['#/exercices', t.accueil.toutVoir]}>
      <div class="defile-h reco-liste">
        {recos.map((e) => <a class="reco-carte" key={e.id} href={`#/exercice/${e.id}`}>
          <span class="reco-img"><IllustrationExercice exo={e} taille={86} calmMotion={reduitAnim} live={false} /></span>
          <span class="reco-nom">{nomExercice(e)}</span>
        </a>)}
      </div>
    </Section>}

    <div class="classeurs">
      <Classeur id="programmes" titre={A.programmes} detail={A.programmesN(actifs.length)} href="#/programmes" apercu={<ApercuProgrammes teintes={teintesDossiers} />} />
      <Classeur id="outils" titre={A.outils} detail={A.calculatricesN((M12[langue] ?? M12.fr).noms.length)} href="#/calculatrices" apercu={<ApercuOutils />} />
      <Classeur id="journal" titre={A.journal} detail={A.notesN(nbNotes)} href="#/notes" apercu={<ApercuNotes />} />
    </div>
    {nutritionOn && <div class="classeurs large">
      <Classeur id="nutrition" titre={A.nutrition} detail={nutritionDetail} href="#/nutrition" apercu={<ApercuNutrition />}
        badge={<span class="acc-beta"><Ic n="flask:fill" taille={9} />{A.beta}</span>} />
    </div>}

    {/* Feuille de démarrage (jour de repos : « S'entraîner quand même ») */}
    <FeuilleDemarrage ouverte={demarrage} fermer={() => setDemarrage(false)} />

    {/* Options du programme du jour (showTodayPlanMenu) */}
    <Feuille ouverte={menuJour && !!routine} fermer={() => setMenuJour(false)} titre={routine?.nom ?? ''} sous={routine ? t.accueil.exercicesN(nbEx) : ''}>
      {routine && <div class="options">
        {planTournant
          ? <button type="button" class="option" onClick={passerRotation}>
            <Ic n="skip-forward" taille={19} /><span><strong>{T.passer}</strong></span>
          </button>
          : <button type="button" class="option" onClick={() => { setMenuJour(false); setDeplacement(true); }}>
            <Ic n="calendar-dots" taille={19} /><span><strong>{T.deplacer}</strong><small>{T.deplacerSous}</small></span>
          </button>}
        <a class="option" href={`#/programme/${routine.id}`} onClick={() => setMenuJour(false)}>
          <Ic n="pencil-simple" taille={19} /><span><strong>{T.modifier}</strong></span>
        </a>
        <a class="option" href="#/programmes" onClick={() => setMenuJour(false)}>
          <Ic n="list-checks" taille={19} /><span><strong>{planTournant ? T.rotation : T.planHebdo}</strong></span>
        </a>
      </div>}
    </Feuille>

    {/* Déplacer le programme du jour (showMoveDaySheet) */}
    <Feuille ouverte={deplacement && !!routine} fermer={() => setDeplacement(false)} titre={T.deplacer} sous={routine?.nom ?? ''}>
      {routine && <>
        <p class="muted" style="text-align:center;font-size:12.5px;font-weight:500;margin:0">{T.deplacerSous}</p>
        <div class="options">
          {joursSuivants.map((d, i) => {
            const la = routineLe(d);
            return <button type="button" class="option" key={jourLocal(d)} onClick={() => deplacer(routine, d, i)}>
              <Ic n="calendar-blank" taille={19} />
              <span><strong>{i === 0 ? T.demain : `${majuscule(fmt(d, { weekday: 'long' }))} ${d.getDate()}`}</strong><small>{la ? la.nom : T.jourRepos}</small></span>
            </button>;
          })}
        </div>
      </>}
    </Feuille>

    {/* Menu d'un programme du carrousel */}
    <Feuille ouverte={!!menuRoutine} fermer={() => setMenuRoutine(null)} titre={menuRoutine?.nom ?? ''} sous={menuRoutine ? L.demarrage.exercicesN(nbExercicesValides(menuRoutine)) : ''}>
      {menuRoutine && <div class="options">
        <a class="option" href={`#/programme/${menuRoutine.id}`} onClick={() => setMenuRoutine(null)}>
          <Ic n="pencil-simple" taille={19} /><span><strong>{A.modifier}</strong></span>
        </a>
        {nbExercicesValides(menuRoutine) > 0 && <button type="button" class="option" onClick={() => { const r = menuRoutine; setMenuRoutine(null); lancerRoutine(r); }}>
          <Ic n="play" taille={19} /><span><strong>{t.accueil.demarrer}</strong></span>
        </button>}
        <a class="option" href="#/programmes" onClick={() => setMenuRoutine(null)}>
          <Ic n="folders" taille={19} /><span><strong>{A.tousProgrammes}</strong></span>
        </a>
      </div>}
    </Feuille>

    {/* Feuille jour de repos */}
    <Feuille ouverte={!!jourChoisi} fermer={() => setJourChoisi(null)} titre={jourChoisi ? dateJour(jourChoisi.date) : ''} sous={L.jourRepos.sous}>
      {jourChoisi && <div class="options">
        {!jourChoisi.futur && <button type="button" class={`option ${pointes[jourChoisi.cle] ? 'choisie' : ''}`} onClick={() => marquerJour(jourChoisi.cle, { pointe: !pointes[jourChoisi.cle] })}>
          <Ic n="check-circle" taille={19} /><span><strong>{T.entraine}</strong></span>
          {pointes[jourChoisi.cle] && <Ic n="check:bold" taille={18} classe="option-coche" />}
        </button>}
        {RAISONS_REPOS.map((r) => <button type="button" class={`option ${joursRepos[jourChoisi.cle] === r ? 'choisie' : ''}`} key={r}
          onClick={() => setJourRepos(jourChoisi.cle, joursRepos[jourChoisi.cle] === r ? null : r)}>
          <Ic n={ICONE_MOTIF[r]} taille={19} />
          <span><strong>{T[r]}</strong></span>
          {joursRepos[jourChoisi.cle] === r && <Ic n="check:bold" taille={18} classe="option-coche" />}
        </button>)}
      </div>}
    </Feuille>

    {/* Journal d'un jour de la carte d'activité */}
    <FeuilleJournal jour={jourHeat} fermer={() => setJourHeat(null)} fr={langue === 'fr'} />

    {/* Feuille objectif hebdomadaire */}
    <Feuille ouverte={objectif} fermer={() => setObjectif(false)} titre={L.objectif.titre} sous={L.objectif.seancesCetteSemaine(joursFaits.size)}>
      <div class="m02-goal">
        <div class="m02-goal-stepper">
          <button type="button" aria-label={t.commun.moins} onClick={() => changerObjectif(-1)}><Ic n="minus:bold" taille={18} /></button>
          <span class="m02-goal-valeur">{L.objectif.parSemaine(profil.objectif_semaine)}</span>
          <button type="button" aria-label={t.commun.plus} onClick={() => changerObjectif(1)}><Ic n="plus:bold" taille={18} /></button>
        </div>
        <p class="m02-goal-texte">{L.objectif.pourquoi}</p>
        <button type="button" class="btn pri" style="width:100%" onClick={() => setObjectif(false)}>{L.objectif.fait}</button>
      </div>
    </Feuille>
  </main>;
}
