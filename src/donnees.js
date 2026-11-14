// État de l'application, échanges avec l'API, calculs (volume, records, 1RM, semaines).
// Poids toujours stockés en kg ; conversion à l'affichage selon l'unité du compte.
import { computed, signal } from '@preact/signals';
import { EXERCICES, MODELES_PROGRAMMES } from './exercices.js';
import { EQUIPEMENT_PAR_ID } from './categories-exercices.js';
import { choisirLangue, langue, locale, t } from './i18n.js';
import { carillon, definirSonPerso } from './sons.js';

export const etat = signal(null); // { profil, seances, routines, perso, poids, mesures }
export const enCours = signal(null); // séance en direct
export const erreurChargement = signal(null); // 'session' | 'abonnement' | 'reseau'
export const toast = signal(null);
export const enLigne = signal(navigator.onLine);
let csrf = '';

const lireLocal = (k) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null'); } catch { return null; } };
const ecrireLocal = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage plein ou privé : la séance reste en mémoire */ } };
// Séance en cours et boîte d'envoi rangées par compte : sur un navigateur partagé, un compte ne voit jamais la séance d'un autre.
const CLE_COMPTE = 'an_compte', ANCIENNE_LOCALE = 'an_en_cours', ANCIENNE_BOITE = 'an_boite';
let compteLocal = lireLocal(CLE_COMPTE);
let CLE_LOCALE = `an_en_cours:${compteLocal}`, CLE_BOITE = `an_boite:${compteLocal}`;
function choisirCompte(id) {
  compteLocal = id;
  CLE_LOCALE = `an_en_cours:${id}`; CLE_BOITE = `an_boite:${id}`;
  ecrireLocal(CLE_COMPTE, id);
}
// Déconnexion (formulaire de l'appli ou du site) : la séance en cours ne reste pas sur le navigateur.
// Le serveur en garde la copie (PUT /api/en-cours), on lui envoie d'abord la dernière version si elle attend encore.
addEventListener('submit', (ev) => {
  if (!ev.target?.action?.endsWith?.('/deconnexion/')) return;
  if (minuterie) {
    clearTimeout(minuterie); minuterie = null;
    const v = enCours.value;
    try { fetch('/api/en-cours', { method: 'PUT', keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF': csrf }, body: JSON.stringify({ seance: v }) }); } catch { /* départ quand même */ }
  }
  ecrireLocal(CLE_LOCALE, null);
  ecrireLocal(ANCIENNE_LOCALE, null);
  ecrireLocal(CLE_COMPTE, null);
  enCours.value = null;
}, true);

/** Extensions profil / plan / préférences : valeurs par défaut alignées sur l'API. */
export function extensionsParDefaut() {
  return {
    planSemaine: { mode: 'rotation', jours: {} },
    profil: {},
    preferences: {
      sonRepos: 'bip',
      decompteAvantSeance: true,
      avanceAutoApresCoche: true,
      modeEffort: 'aucun',
      reduireAnimations: false,
      teinteCarteChaleur: 'ember',
      cartesAccueil: ['progres', 'programmes', 'records'],
    },
  };
}

export function fusionnerExtensions(brut) {
  const def = extensionsParDefaut();
  if (!brut || typeof brut !== 'object') return def;
  return {
    planSemaine: { ...def.planSemaine, ...brut.planSemaine, jours: { ...def.planSemaine.jours, ...(brut.planSemaine?.jours || {}) } },
    profil: { ...def.profil, ...(brut.profil && typeof brut.profil === 'object' ? brut.profil : {}) },
    preferences: { ...def.preferences, ...(brut.preferences && typeof brut.preferences === 'object' ? brut.preferences : {}) },
    ...(brut.modules && typeof brut.modules === 'object' && !Array.isArray(brut.modules) ? { modules: brut.modules } : {}),
  };
}

function profilVersApi(p) {
  return {
    prenom: p.prenom,
    langue: p.langue,
    unite: p.unite,
    theme: p.theme,
    repos_s: p.repos_s,
    objectif_semaine: p.objectif_semaine,
  };
}

export function afficher(message, genre = 'ok', action = null) {
  toast.value = { message, genre, action, id: Math.random() };
  // Réglage « Son des notifications » (Alertes), activé par défaut comme l'original.
  if (lireModule('reglages')?.sonToasts !== false) carillon();
}

export class ErreurApi extends Error {
  constructor(statut, message) { super(message); this.statut = statut; }
}

export async function api(methode, chemin, corps) {
  let r;
  try {
    r = await fetch(chemin, {
      method: methode, credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-CSRF': csrf },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
  } catch {
    enLigne.value = false;
    throw new ErreurApi(0, 'reseau');
  }
  enLigne.value = true;
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) { erreurChargement.value = 'session'; throw new ErreurApi(401, 'session'); }
  if (r.status === 402) { erreurChargement.value = 'abonnement'; throw new ErreurApi(402, 'abonnement'); }
  if (!r.ok) throw new ErreurApi(r.status, d.erreur ?? 'erreur');
  return d;
}

export async function charger() {
  try {
    const d = await api('GET', '/api/etat');
    csrf = d.csrf;
    choisirLangue(d.profil.langue);
    d.profil.extensions = fusionnerExtensions(d.profil.extensions);
    const ps = d.profil.extensions.planSemaine;
    etat.value = {
      ...d,
      mesures: d.mesures ?? [],
      plan: d.plan ?? {
        mode: ps?.mode === 'fixe' ? 'semaine' : (ps?.mode || 'semaine'),
        jours: ps?.jours ?? {},
        index_rotation: 0,
      },
    };
    appliquerTheme(d.profil.theme);
    appliquerPrefs();
    choisirCompte(d.compte);
    // Ancienne clé sans compte : reprise seulement si c'est la séance que le serveur connaît pour ce compte.
    const ancienne = lireLocal(ANCIENNE_LOCALE);
    if (ancienne && d.enCours?.cle === ancienne.cle && !lireLocal(CLE_LOCALE)) ecrireLocal(CLE_LOCALE, ancienne);
    ecrireLocal(ANCIENNE_LOCALE, null);
    // shortcut: l'ancienne boîte n'a pas de propriétaire, elle part au premier compte connecté ; disparaît avec les versions d'avant.
    const ancienneBoite = lireLocal(ANCIENNE_BOITE);
    if (ancienneBoite?.length) ecrireLocal(CLE_BOITE, [...(lireLocal(CLE_BOITE) ?? []), ...ancienneBoite]);
    ecrireLocal(ANCIENNE_BOITE, null);
    // Séance en cours : la plus récente entre ce téléphone et le serveur.
    const local = lireLocal(CLE_LOCALE);
    const serveur = d.enCours;
    const choix = local && (!serveur || (local.maj ?? 0) >= (serveur.maj ?? 0) || local.cle === serveur.cle) ? local : serveur;
    enCours.value = choix && !d.seances.some((s) => s.cle === choix.cle) ? choix : null;
    if (!enCours.value) ecrireLocal(CLE_LOCALE, null);
    erreurChargement.value = null;
    viderBoite();
  } catch (e) {
    if (e.statut === 0) {
      // Hors ligne au démarrage : on reprend la séance gardée sur le téléphone pour le dernier compte connecté.
      const local = compteLocal == null ? null : lireLocal(CLE_LOCALE);
      if (local) {
        enCours.value = local;
        etat.value ??= {
          profil: { langue, unite: 'kg', repos_s: 90, objectif_semaine: 3, abonnement: {}, theme: 'sombre', extensions: extensionsParDefaut() },
          seances: [], routines: [], perso: [], poids: [], mesures: [], horsLigne: true,
        };
      }
      else erreurChargement.value = 'reseau';
    }
  }
}

export function appliquerTheme(theme) {
  const racine = document.documentElement;
  if (theme === 'systeme') racine.dataset.theme = 'systeme';
  else if (theme === 'amoled') racine.dataset.theme = 'amoled';
  else if (theme === 'clair') racine.dataset.theme = 'clair';
  else racine.dataset.theme = 'sombre';
  const clairSysteme = theme === 'systeme' && matchMedia('(prefers-color-scheme: light)').matches;
  const sombre = theme === 'sombre' || theme === 'amoled' || (theme === 'systeme' && !clairSysteme);
  const couleur = theme === 'amoled' ? '#000000' : sombre ? '#0A0A0A' : '#F7F4F0';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', couleur);
  const profil = etat.value?.profil;
  const reduit = profil?.reduire_animations || profil?.extensions?.preferences?.reduireAnimations;
  if (reduit) racine.classList.add('calme');
  else racine.classList.remove('calme');
  if (profil?.flou === false) racine.classList.add('sans-flou');
  else racine.classList.remove('sans-flou');
}

/** Préférences d’affichage (carte de chaleur, animations réduites). */
export function appliquerPrefs() {
  const p = etat.value?.profil?.extensions?.preferences;
  if (!p) return;
  document.documentElement.dataset.heat = p.teinteCarteChaleur || 'ember';
  const calm = !!p.reduireAnimations || matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.toggle('calm-motion', calm);
  definirSonPerso(p.sonRepos === 'perso' ? etat.value.profil.extensions.modules?.reglages?.alarmePerso?.id : null);
}

if (typeof window !== 'undefined') {
  try {
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => appliquerPrefs());
  } catch { /* sans effet */ }
}

/** Fusionne et enregistre les extensions applicatives (plan, préférences, profil étendu). */
export async function sauverExtensions(partiel) {
  const e = etat.value;
  if (!e) return;
  const act = e.profil.extensions;
  const fusion = fusionnerExtensions({
    ...act,
    ...partiel,
    planSemaine: partiel.planSemaine
      ? { ...act.planSemaine, ...partiel.planSemaine, jours: { ...act.planSemaine.jours, ...partiel.planSemaine.jours } }
      : act.planSemaine,
    preferences: { ...act.preferences, ...(partiel.preferences || {}) },
  });
  await api('PUT', '/api/reglages', { ...profilVersApi(e.profil), extensions: fusion });
  etat.value = { ...e, profil: { ...e.profil, extensions: fusion } };
  appliquerPrefs();
}

/** Lit un module du compte (extensions.modules[cle]) ; undefined s'il n'existe pas encore. */
export const lireModule = (cle) => etat.value?.profil?.extensions?.modules?.[cle];

let fileModules = Promise.resolve();
/** Écrit un module du compte sans toucher aux autres. L'écran change tout de suite ; l'envoi part ensuite (les appuis rapides se regroupent) et l'écran revient en arrière si le serveur refuse. */
export function ecrireModule(cle, valeur) {
  const e = etat.value;
  if (!e) return Promise.reject(new Error('hors_etat'));
  const avant = e.profil.extensions;
  const fusion = fusionnerExtensions({ ...avant, modules: { ...(avant.modules || {}), [cle]: valeur } });
  etat.value = { ...e, profil: { ...e.profil, extensions: fusion } };
  const p = fileModules.then(async () => {
    try {
      await api('PUT', '/api/reglages', { ...profilVersApi(e.profil), extensions: { modules: etat.value.profil.extensions.modules } });
    } catch (err) {
      if (etat.value?.profil?.extensions === fusion) etat.value = { ...etat.value, profil: { ...etat.value.profil, extensions: avant } };
      throw err;
    }
  });
  fileModules = p.catch(() => {});
  return p;
}

export async function enregistrerMesureCorps({ cle, valeur, prise_le, note = '' }) {
  const r = await api('POST', '/api/mesures', { cle, valeur, prise_le, note });
  await charger();
  return r;
}

export async function supprimerMesureCorps(id) {
  await api('DELETE', `/api/mesures/${id}`);
  await charger();
}

export async function importerSeancesCsv(corps) {
  const r = await api('POST', '/api/importer', corps);
  await charger();
  return r;
}

// ===== Boîte d'envoi : séances terminées hors ligne, envoyées au retour du réseau =====
export async function viderBoite() {
  const boite = lireLocal(CLE_BOITE) ?? [];
  if (!boite.length) return;
  const reste = [];
  for (const s of boite) {
    try {
      const r = await api('POST', '/api/seances', s);
      ajouterSeanceLocale({ ...s, id: r.id });
    } catch (e) { if (e.statut === 0 || e.statut >= 500) reste.push(s); }
  }
  ecrireLocal(CLE_BOITE, reste);
}
addEventListener('online', () => { enLigne.value = true; viderBoite(); });
addEventListener('offline', () => { enLigne.value = false; });

function ajouterSeanceLocale(s) {
  const e = etat.value;
  if (!e || e.seances.some((x) => x.cle === s.cle && x.id)) return;
  const debut = new Date(s.debut).toISOString().slice(0, 19).replace('T', ' '); // même forme que les dates du serveur (UTC)
  const seances = [{ id: s.id, cle: s.cle, debut, duree_s: s.duree_s, nom: s.nom, donnees: { note: s.note ?? '', exercices: s.exercices } }, ...e.seances.filter((x) => x.cle !== s.cle)]
    .sort((a, b) => (a.debut < b.debut ? 1 : -1));
  etat.value = { ...e, seances };
}

// ===== Séance en direct =====
let minuterie = null;
export function majEnCours(fn) {
  const s = fn(structuredClone(enCours.value));
  if (s) s.maj = Date.now();
  enCours.value = s;
  ecrireLocal(CLE_LOCALE, s);
  clearTimeout(minuterie);
  minuterie = setTimeout(() => {
    minuterie = null;
    const v = enCours.value;
    api('PUT', '/api/en-cours', { seance: v && { ...v, debut: v.debut } }).catch(() => {});
  }, 1500);
}

// « Enregistrer une séance » depuis la feuille d'un jour (logDay de l'original) : la prochaine séance démarrée est saisie après coup
// sur ce jour, à midi, durée à renseigner (manual de l'original : pas de minuteur qui tourne).
export const jourManuel = signal(null);
// Décompte de 5 s avant une séance en direct (workout_state.dart countdownLength, réglage « Décompte avant la séance ») :
// le chronomètre de la séance part à la fin du décompte.
const DECOMPTE_MS = 5000;
function surJourManuel(x) {
  const j = jourManuel.value;
  if (x && !j && etat.value?.profil?.extensions?.preferences?.decompteAvantSeance !== false && x.exercices?.length) {
    const fin = Date.now() + DECOMPTE_MS;
    return { ...x, debut: new Date(fin).toISOString(), decompte: fin };
  }
  if (!j || !x) return x;
  jourManuel.value = null;
  const [a, m, d] = j.split('-').map(Number);
  return { ...x, debut: new Date(a, m - 1, d, 12).toISOString(), manuel: { duree_s: 0 } };
}

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

// Valeurs de départ d'une série : la dernière fois que l'exercice a été fait, sinon vide.
export function dernieresSeries(ex) {
  for (const s of etat.value?.seances ?? []) {
    const e = s.donnees.exercices.find((x) => x.ex === ex);
    if (e) { const faites = e.series.filter((x) => x.fait); if (faites.length) return faites; }
  }
  return [];
}

export function nouvelExercice(ex, nbSeries = null, reps = null, repos = null) {
  const avant = dernieresSeries(ex);
  const n = nbSeries ?? Math.max(avant.length, 3);
  const series = Array.from({ length: n }, (_, i) => {
    const p = avant[Math.min(i, avant.length - 1)];
    return {
      r: reps ?? p?.r ?? null, kg: p?.kg ?? null, s: p?.s ?? null, km: p?.km ?? null, type: p?.type === 'e' && i < avant.length ? 'e' : 'n', fait: false,
      rpe: null, rir: null, lieSuivant: false, cote: null, gauche: null, droite: null,
    };
  });
  const def = trouverExercice(ex);
  // Fiche : repos de l'exercice et « Chaque côté » (répétitions gauche et droite) dès l'ouverture.
  return { ex, note: '', series, repos: repos ?? reposDe(ex), lie: false, lieSuivant: false, ...(def?.mesure !== 'duree' && reglagesDe(ex).cotes ? { unilat: true } : {}) };
}

/** Démarre une séance avec une liste d’ids d’exercices (ex. carte du corps). */
export function demarrerAvecExercices(ids) {
  if (enCours.value) return;
  const liste = [...new Set(ids)].filter((id) => trouverExercice(id));
  if (!liste.length) return;
  majEnCours(() => surJourManuel({
    cle: uuid(), debut: new Date().toISOString(), nom: '', routine: null, note: '', courant: 0, repos: null,
    enPause: false, verrou: false,
    exercices: liste.map((id) => nouvelExercice(id)),
  }));
}

/** Remplace l’exercice à l’index `i` et mémorise l’ancien id pour la synchronisation. */
export function echangerExercice(i, nouvelId) {
  const s = enCours.value;
  if (!s?.exercices[i] || !trouverExercice(nouvelId)) return;
  const prev = s.exercices[i];
  majEnCours((x) => {
    x.exercices[i] = { ...nouvelExercice(nouvelId), note: prev.note ?? '', repos: prev.repos, remplaceDe: prev.ex, lie: prev.lie, lieSuivant: prev.lieSuivant };
    return x;
  });
}

/** Nombre d'exercices d'un programme que la séance démarrera vraiment (les ids inconnus du catalogue sont ignorés au démarrage). */
export const nbExercicesValides = (r) => (r?.exercices ?? []).filter((e) => trouverExercice(e.ex)).length;

const avecSecondes = (x, s) => (s > 0 ? { ...x, series: x.series.map((v) => (v.type === 'e' ? v : { ...v, s })) } : x);

export function demarrer(routine = null) {
  if (enCours.value) return;
  majEnCours(() => surJourManuel({
    cle: uuid(), debut: new Date().toISOString(), nom: routine?.nom ?? '', routine: routine?.id ?? null, note: '', courant: 0, repos: null,
    enPause: false, verrou: false,
    exercices: (routine?.exercices ?? []).filter((e) => trouverExercice(e.ex)).map((e) => ({
      ...avecSecondes(nouvelExercice(e.ex, e.series, e.reps, e.repos), e.secondes),
      lie: !!e.lie,
      lieSuivant: !!e.lieSuivant,
    })),
  }));
}

export function refaire(seance) {
  if (enCours.value) return;
  majEnCours(() => ({
    cle: uuid(), debut: new Date().toISOString(), nom: seance.nom, routine: null, note: '', courant: 0, repos: null,
    enPause: false, verrou: false,
    exercices: seance.donnees.exercices.filter((e) => trouverExercice(e.ex)).map((e) => ({
      ex: e.ex, note: '', repos: e.repos ?? null, lie: !!e.lie, lieSuivant: !!e.lieSuivant,
      series: e.series.map((s) => ({
        ...s,
        rpe: s.rpe ?? null, rir: s.rir ?? null, lieSuivant: !!s.lieSuivant, cote: s.cote ?? null, gauche: s.gauche ?? null, droite: s.droite ?? null, fait: false,
      })),
    })),
  }));
}

export function abandonner() {
  majEnCours(() => null);
  ecrireLocal(CLE_LOCALE, null);
}

// Enregistre la séance : seules les séries cochées sont gardées. Hors ligne : mise en boîte d'envoi.
export async function terminer() {
  const s = enCours.value;
  const serieVersApi = (x) => {
    const o = { r: x.r, kg: x.kg, s: x.s, type: x.type ?? 'n', fait: true };
    if (x.rpe != null && x.rpe !== '') o.rpe = Number(x.rpe);
    if (x.rir != null && x.rir !== '') o.rir = Number(x.rir);
    if (x.lieSuivant) o.lieSuivant = true;
    if (x.cote === 'g' || x.cote === 'd') o.cote = x.cote;
    if (x.repos != null) o.repos = x.repos;
    if (x.km > 0) o.km = Math.min(1000, Math.round(x.km * 100) / 100); // mode « Distance et temps »
    if (x.note?.trim()) o.note = x.note.trim().slice(0, 280);
    return o;
  };
  const exercices = s.exercices.map((e) => {
    const base = { ex: e.ex, note: e.note ?? '', lie: !!e.lie, lieSuivant: !!e.lieSuivant, series: e.series.filter((x) => x.fait).map(serieVersApi) };
    if (e.remplaceDe) base.remplaceDe = e.remplaceDe;
    return base;
  }).filter((e) => e.series.length);
  if (!exercices.length) return null;
  const corps = { cle: s.cle, debut: s.debut, duree_s: secondesEcouleesSession(s), nom: s.nom || nomParDefaut(s), note: s.note, exercices };
  let id = null;
  try { id = (await api('POST', '/api/seances', corps)).id; } catch (e) {
    if (e.statut !== 0 && e.statut < 500) throw e;
    ecrireLocal(CLE_BOITE, [...(lireLocal(CLE_BOITE) ?? []).filter((x) => x.cle !== corps.cle), corps]);
  }
  ajouterSeanceLocale({ ...corps, id });
  // Séance légère : la progression l'ignore (stats_state.dart progressHistory). Les 300 dernières suffisent.
  if (s.leger) ecrireModule('legeres', [...(lireModule('legeres') ?? []).filter((c) => c !== s.cle), s.cle].slice(-300)).catch(() => {});
  enCours.value = null;
  ecrireLocal(CLE_LOCALE, null);
  return corps.cle;
}

const nomParDefaut = (s) => {
  const muscles = [...new Set(s.exercices.map((e) => trouverExercice(e.ex)?.muscle).filter(Boolean))].slice(0, 2);
  return muscles.length ? muscles.map((m) => t.muscles[m]).join(', ') : t.seance.seanceDu(dateCourte(s.debut));
};

// ===== Exercices =====
const PAR_ID = new Map(EXERCICES.map((e) => [e.id, e]));
// Anciens identifiants enregistrés dans des séances ou programmes d'avant le catalogue de 466 exercices.
const ANCIENS_IDS = {
  squat: 'squat-a-la-barre',
  'developpe-militaire': 'developpe-militaire-a-la-barre',
  'fentes-avec-halteres': 'fentes-marchees-aux-halteres',
  'developpe-couche-prise-neutre': 'developpe-couche-aux-halteres-prise-neutre',
  'rowing-t-barre': 'rowing-t-bar',
};
const COPIES_ANCIENS = new Map();

// Réglages par exercice du compte (extensions.modules.m05), avec la copie locale qui répond avant le serveur (écrite par exercices.jsx).
export const localM05 = signal({});
export function lireM05() {
  const s = etat.value?.profil?.extensions?.modules?.m05;
  return { ...(s && typeof s === 'object' && !Array.isArray(s) ? s : {}), ...localM05.value };
}
// Réglages de la fiche (« Réglages de cet exercice », exercise_detail_screen.dart), par exercice : extensions.modules.m05.reglages[id].
// repsSeules, cotes (répétitions par côté), cotesTemps, tenue (+s), repos (s), barre (kg), pile (kg), suggerer, assiste, echauffement.
export const reglagesDe = (id) => { const r = lireM05().reglages?.[id]; return r && typeof r === 'object' && !Array.isArray(r) ? r : {}; };
// Exercices déjà faits avec une charge (_hasLoadedHistory), recalculés quand la liste des séances change.
const CHARGES_VUES = new WeakMap();
function chargesVues() {
  const l = etat.value?.seances ?? [];
  if (!CHARGES_VUES.has(l)) CHARGES_VUES.set(l, new Set(l.flatMap((s) => s.donnees.exercices.filter((x) => x.series.some((v) => v.kg > 0)).map((x) => x.ex))));
  return CHARGES_VUES.get(l);
}
const CHARGES_TENUE = new Set(['halteres', 'kettlebell', 'poulie', 'machine']); // _loadedHolds (Weighted : EQUIPEMENT_PAR_ID)
// isRepsOnly : choix de la fiche, sinon poids du corps (ou gainage sans charge) jamais fait avec une charge.
function repsSeulesDe(e, mesure) {
  const r = reglagesDe(e.id).repsSeules;
  if (typeof r === 'boolean') return r;
  const nu = mesure === 'duree' ? !CHARGES_TENUE.has(e.materiel) && EQUIPEMENT_PAR_ID[e.id] !== 'leste' : e.materiel === 'poids-du-corps' && !EQUIPEMENT_PAR_ID[e.id];
  return nu && !chargesVues().has(e.id);
}
// Réglages de la fiche appliqués au catalogue comme l'original (library_state) : muscles secondaires, « Enregistrer par »
// (m05.modes, 'weight' force répétitions et poids) et « Répétitions uniquement » (mesure 'corps', sansPoids : pas de colonne de charge).
const COPIES_REGLAGES = new Map();
function avecSecondaires(e) {
  if (!e) return e;
  const m = lireM05();
  const choix = m.secondaires?.[e.id], mode = m.modes?.[e.id];
  let mesure = mode === 'time' || mode === 'cardio' ? 'duree' : mode === 'weight' && e.mesure === 'duree' ? (e.materiel === 'poids-du-corps' ? 'corps' : 'poids') : e.mesure;
  const sansPoids = mode !== 'cardio' && repsSeulesDe(e, mesure);
  if (sansPoids && mesure === 'poids') mesure = 'corps';
  const sec = Array.isArray(choix);
  if (!sec && mesure === e.mesure && !sansPoids) return e;
  const cle = `${sec ? choix.join() : '-'}|${mesure}|${sansPoids}`;
  const c = COPIES_REGLAGES.get(e.id);
  if (c && c.base === e && c.cle === cle) return c.copie;
  const copie = { ...e, mesure, sansPoids, ...(sec ? { autres: choix.filter((x) => x !== e.muscle) } : {}) };
  COPIES_REGLAGES.set(e.id, { base: e, cle, copie });
  return copie;
}
// Repos de l'exercice (restFor) : celui de la fiche, sinon aucun minuteur en distance et temps, sinon null (repos du profil).
export function reposDe(id) {
  const r = reglagesDe(id).repos;
  if (typeof r === 'number') return r;
  return lireM05().modes?.[id] === 'cardio' ? 0 : null;
}
// Pile de poids (snapToStack) : la charge voisine dans la pile, vers le haut (1), le bas (-1) ou la plus proche (0).
export function surPile(id, kg, dir = 0) {
  const p = reglagesDe(id).pile;
  if (!Array.isArray(p) || !p.length || kg == null) return kg;
  if (dir > 0) return p.find((v) => v > kg + 0.001) ?? p.at(-1);
  if (dir < 0) return [...p].reverse().find((v) => v < kg - 0.001) ?? p[0];
  return p.reduce((a, v) => (Math.abs(v - kg) < Math.abs(a - kg) ? v : a), p[0]);
}
// Décharge sur une pile (deloadWeight) : le poids de la pile sous la charge allégée, sinon le cran du dessous ; null sans pile.
export function dechargePile(id, kg, pct = 10) {
  const p = reglagesDe(id).pile;
  if (!Array.isArray(p) || !p.length || !(kg > 0)) return null;
  const vise = (kg * (100 - pct)) / 100;
  const bas = p.reduce((a, v) => (v <= vise + 0.001 ? v : a), p[0]);
  return bas < kg - 0.001 ? bas : surPile(id, kg, -1);
}
export const suggere = (id) => reglagesDe(id).suggerer !== false;
// Poids du corps de la machine assistée (_assistBodyKg) : dernière pesée, 75 kg sans pesée.
export const poidsCorpsKg = () => { const p = etat.value?.poids; return (Array.isArray(p) && p.length ? Number(p.at(-1).kg) : 0) || 75; };
// Charge réelle d'une série assistée (liftScore) : poids du corps moins l'aide, pondéré par les répétitions comme un 1RM.
export const scoreAssiste = (kg, r, corps = poidsCorpsKg()) => (r > 0 ? Math.max(0, corps - (kg ?? 0)) * (1 + r / 30) : 0);
// Machine assistée : seulement en répétitions et poids avec charge (isAssisted).
export const assiste = (e) => Boolean(e && reglagesDe(e.id).assiste && e.mesure === 'poids' && !e.sansPoids);

export function trouverExercice(id) {
  if (ANCIENS_IDS[id] && !PAR_ID.has(id)) {
    // Même fiche que l'exercice actuel, sous l'ancien identifiant pour que records et liens restent cohérents.
    if (!COPIES_ANCIENS.has(id)) COPIES_ANCIENS.set(id, { ...PAR_ID.get(ANCIENS_IDS[id]), id, idCatalogue: ANCIENS_IDS[id] });
    return COPIES_ANCIENS.get(id);
  }
  if (id?.startsWith('p-')) {
    const p = etat.value?.perso.find((x) => `p-${x.id}` === id);
    if (!p) return undefined;
    const etapes = (p.etapes || '').split('\n').filter(Boolean);
    return avecSecondaires({ id, fr: p.nom, en: p.nom, muscle: p.muscle, autres: [], materiel: p.materiel, mesure: p.mesure, niveau: 0, conseils: etapes.length ? { fr: etapes, en: etapes } : null, perso: true, noms: p.autres || '', etapes: p.etapes || '' });
  }
  return avecSecondaires(PAR_ID.get(id));
}
export const nomExercice = (e) => (typeof e === 'string' ? nomExercice(trouverExercice(e)) : e ? (langue === 'en' ? e.en : e.fr) : '');
export const tousExercices = computed(() => [
  ...(etat.value?.perso ?? []).map((p) => trouverExercice(`p-${p.id}`)),
  ...EXERCICES.map(avecSecondaires),
]);

// ===== Unités et formats =====
const LB = 2.20462;
export const unite = () => etat.value?.profil.unite ?? 'kg';
export const versAffichage = (kg) => (kg === null || kg === undefined ? null : unite() === 'lb' ? Math.round(kg * LB * 10) / 10 : Math.round(kg * 100) / 100);
export const versKg = (v) => (v === null || v === '' || v === undefined ? null : unite() === 'lb' ? Math.round((v / LB) * 100) / 100 : Number(v));
export const nombre = (n, max = 1) => (n === null || n === undefined ? '' : new Intl.NumberFormat(locale(), { maximumFractionDigits: max }).format(n));
export const poids = (kg) => (kg === null ? '' : nombre(versAffichage(kg)));
// Volume : en tonnes au-delà de 1000 kg, sinon en kg ou lb.
export function volume(kg) {
  const v = versAffichage(kg) ?? 0;
  return v >= 1000 ? { val: nombre(v / 1000, 1), unite: unite() === 'lb' ? 'k lb' : t.commun.t } : { val: nombre(v, 0), unite: unite() };
}
export const duree = (s) => {
  const sec = Math.max(0, Math.floor(Number(s) || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? `${h} ${t.commun.h} ${String(m).padStart(2, '0')}` : `${m} ${t.commun.min}`;
};
/** Durée courte « 1h 05 » ou « 57m » (même format que l'historique GymMane), utilisée partout. */
export const dureeCourte = (s) => {
  const sec = Math.max(0, Math.floor(Number(s) || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}` : `${m}m`;
};
export const chrono = (s) => {
  const sec = Math.max(0, Math.floor(Number(s) || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), x = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`;
};
export const minSec = (s) => {
  const sec = Math.max(0, Math.floor(Number(s) || 0));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

/** Plafond d'une séance : 24 h, comme GymMane (setManualMinutes) et comme la limite du serveur. Une séance oubliée ouverte ne dépasse jamais ce plafond. */
export const DUREE_MAX_S = 24 * 3600;

/** Secondes écoulées de la séance en cours (hors pauses gelées), jamais négatif. */
export function secondesEcouleesSession(s) {
  if (!s?.debut) return 0;
  if (s.manuel) return Math.min(DUREE_MAX_S, s.manuel.duree_s ?? 0);
  const debut = Date.parse(s.debut);
  let pauseMs = s.pauseAccum_ms || 0;
  if (s.enPause && s.pauseDebut_ms) pauseMs += Date.now() - s.pauseDebut_ms;
  return Math.min(DUREE_MAX_S, Math.max(0, Math.floor((Date.now() - debut - pauseMs) / 1000)));
}
// Dates du serveur « AAAA-MM-JJ HH:MM:SS » en UTC ; jours seuls « AAAA-MM-JJ » en heure locale.
const date = (v) => {
  if (typeof v !== 'string') return new Date(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { const [a, m, j] = v.split('-').map(Number); return new Date(a, m - 1, j); }
  return new Date(v.includes('T') ? v : `${v.replace(' ', 'T')}Z`);
};
export const enDate = date;
export const dateCourte = (v) => new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' }).format(date(v));
export const dateLongue = (v) => new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(date(v));
export const dateComplete = (v) => new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(date(v));

// ===== Calculs =====
const compte = (s) => s.fait !== false && s.type !== 'e';

/** Série « de travail » pour l'historique (hors échauffement). */
const serieTravailHisto = (s) => s && s.fait !== false && s.type !== 'e';
// Table RPE de GymMane (lib/models/workout.dart) : part du 1RM selon les répétitions (1 à 12) et le RPE (6 à 10, pas de 0,5).
const TABLE_RPE = [
  1.0, 0.978, 0.955, 0.939, 0.922, 0.907, 0.892, 0.878, 0.863, 0.85, 0.837, 0.824, 0.811, 0.799, 0.786, 0.774,
  0.762, 0.751, 0.739, 0.723, 0.707, 0.694, 0.68, 0.667, 0.653, 0.64, 0.626, 0.613, 0.599, 0.586, 0.574,
];
export function partRpe(r, rpe) {
  if (rpe == null || rpe === '' || !(rpe >= 6 && rpe <= 10) || r < 1 || r > 12) return null;
  const i = (r - 1) * 2 + Math.round((10 - rpe) * 2);
  return i < TABLE_RPE.length ? TABLE_RPE[i] : null;
}
// GymMane ne garde que le RPE ; un RIR noté vaut RPE = 10 - RIR.
export const rpeSerie = (s) => (s?.rpe != null && s.rpe !== '' ? Number(s.rpe) : s?.rir != null && s.rir !== '' ? 10 - Number(s.rir) : null);
/** 1RM estimé : table RPE si la série en a un, sinon Epley complet (une répétition comprise), comme GymMane. */
export const unRM = (kg, r, rpe) => {
  if (!kg || !r || r <= 0) return 0;
  const part = partRpe(r, rpe == null ? null : Number(rpe));
  return part == null ? kg * (1 + r / 30) : kg / part;
};
export function bilanSeance(donnees) {
  let vol = 0, series = 0;
  for (const e of donnees.exercices) for (const s of e.series) if (compte(s)) { series += 1; vol += (s.kg ?? 0) * (s.r ?? 0); }
  return { volume: vol, series };
}

// Meilleures marques d'un exercice sur une liste de séances (ordre quelconque).
export function meilleures(ex, seances) {
  const m = { kg: 0, rm: 0, vol: 0, reps: 0, s: 0 };
  for (const se of seances) for (const e of se.donnees.exercices) if (e.ex === ex) for (const s of e.series) if (compte(s)) {
    m.kg = Math.max(m.kg, s.kg ?? 0); m.rm = Math.max(m.rm, unRM(s.kg, s.r, rpeSerie(s))); m.vol = Math.max(m.vol, (s.kg ?? 0) * (s.r ?? 0));
    m.reps = Math.max(m.reps, s.r ?? 0); m.s = Math.max(m.s, s.s ?? 0);
  }
  return m;
}

/** Machine assistée (stats_state.dart) : record au moins d'aide, meilleure série à la plus forte charge réelle, meilleure séance en répétitions, courbe de l'aide. */
export function bilanAssiste(ex, seances, corps = poidsCorpsKg()) {
  const b = { moins: null, serie: null, sSerie: null, reps: 0, sReps: null, courbe: [] };
  for (const se of seances) {
    const l = se.donnees.exercices.filter((e) => e.ex === ex).flatMap((e) => e.series).filter((x) => compte(x) && x.r > 0);
    if (!l.length) continue;
    const min = Math.min(...l.map((x) => x.kg ?? 0));
    b.moins = b.moins === null ? min : Math.min(b.moins, min);
    b.courbe.unshift(min);
    for (const x of l) if (!b.serie || scoreAssiste(x.kg, x.r, corps) > scoreAssiste(b.serie.kg, b.serie.r, corps)) { b.serie = x; b.sSerie = se; }
    const n = l.reduce((a, x) => a + x.r, 0);
    if (n > b.reps) { b.reps = n; b.sReps = se; }
  }
  return b;
}

// Records battus par une séance, comparés aux séances antérieures.
export function recordsDe(seance, toutes) {
  const avant = toutes.filter((s) => s.debut < seance.debut && s.cle !== seance.cle);
  const out = [];
  for (const e of seance.donnees.exercices) {
    const def = trouverExercice(e.ex);
    if (!def) continue;
    const ancien = meilleures(e.ex, avant), nouveau = meilleures(e.ex, [seance]);
    if (!avant.some((s) => s.donnees.exercices.some((x) => x.ex === e.ex))) continue; // première fois : pas un record
    if (def.mesure === 'duree') { if (nouveau.s > ancien.s) out.push({ ex: e.ex, genre: 's', val: nouveau.s }); continue; }
    if (def.mesure === 'corps' && !nouveau.kg) { if (nouveau.reps > ancien.reps) out.push({ ex: e.ex, genre: 'reps', val: nouveau.reps }); continue; }
    if (nouveau.kg > ancien.kg) out.push({ ex: e.ex, genre: 'kg', val: nouveau.kg });
    else if (nouveau.rm > ancien.rm + 0.01) out.push({ ex: e.ex, genre: 'rm', val: nouveau.rm });
    else {
      const echelon = echelonBattu(e.ex, avant, seance.donnees.exercices.filter((x) => x.ex === e.ex).flatMap((x) => x.series));
      if (echelon) out.push({ ex: e.ex, genre: 'echelle', val: echelon.kg, r: echelon.r });
    }
  }
  return out;
}

/** Couples (répétitions, charge) qu'aucun autre ne domine, comme le « front » de GymMane (stats_state.dart, _raise). */
export function frontEchelle(series, front = []) {
  let f = front;
  for (const s of series) {
    if (!compte(s) || !(s.r > 0) || !(s.kg > 0)) continue;
    if (f.some((p) => p.r >= s.r && p.kg >= s.kg - 1e-9)) continue;
    f = [...f.filter((p) => !(s.r >= p.r && s.kg >= p.kg - 1e-9)), { r: s.r, kg: s.kg }];
  }
  return f;
}

/**
 * Plus de répétitions à une charge déjà soulevée : record même sans nouveau 1RM (GymMane #330, _newOnLadder).
 * Une série de descente sous 80 % de la meilleure charge ne compte pas.
 */
export function echelonBattu(ex, avant, series) {
  const def = trouverExercice(ex);
  if (!def || def.mesure === 'duree') return null;
  let front = frontEchelle(avant.flatMap((s) => s.donnees.exercices.filter((x) => x.ex === ex).flatMap((x) => x.series)));
  if (!front.length) return null;
  const maxKg = Math.max(...front.map((p) => p.kg));
  let meilleur = null;
  for (const s of series) {
    if (compte(s) && s.r > 0 && s.kg > 0 && s.kg >= maxKg * 0.8 && !front.some((p) => p.r >= s.r && p.kg >= s.kg - 1e-9)) {
      if (!meilleur || s.kg > meilleur.kg || (s.kg === meilleur.kg && s.r > meilleur.r)) meilleur = { r: s.r, kg: s.kg };
    }
    front = frontEchelle([s], front);
  }
  return meilleur;
}

// Semaines du lundi au dimanche, heure locale.
export function lundi(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
export const jourLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const jourDe = (debut) => jourLocal(date(debut));

export function semaine(seances, decalage = 0) {
  const debut = lundi(); debut.setDate(debut.getDate() + 7 * decalage);
  const fin = new Date(debut); fin.setDate(fin.getDate() + 7);
  return seances.filter((s) => { const d = date(s.debut); return d >= debut && d < fin; });
}

// Jours d'affilée avec au moins une séance. Un jour sans séance aujourd'hui ne casse pas la série.
export function serieJours(seances) {
  const jours = new Set(seances.map((s) => jourDe(s.debut)));
  let n = 0;
  for (let i = 0; i < 3650; i += 1) {
    const d = new Date(); d.setDate(d.getDate() - i);
    if (jours.has(jourLocal(d))) n += 1;
    else if (i === 0) continue;
    else break;
  }
  return n;
}

// Semaines d'affilée où l'objectif est atteint. La semaine en cours compte seulement si l'objectif est déjà atteint.
export function serieSemaines(seances, objectif) {
  let n = 0;
  const jours = (l) => new Set(l.map((s) => jourDe(s.debut))).size;
  if (jours(semaine(seances, 0)) >= objectif) n += 1;
  for (let i = -1; i > -520; i -= 1) { if (jours(semaine(seances, i)) >= objectif) n += 1; else break; }
  return n;
}

export { MODELES_PROGRAMMES };

/** Enregistre le plan hebdomadaire dans les extensions du profil via PUT /api/reglages. */
export async function sauverPlanHebdo(nouveauPlan) {
  const e = etat.value;
  if (!e) return;
  etat.value = { ...e, plan: nouveauPlan };
  const modeApi = nouveauPlan.mode === 'semaine' ? 'fixe' : 'rotation';
  const joursApi = {};
  for (const [k, v] of Object.entries(nouveauPlan.jours ?? {})) {
    if (v && v !== 'repos' && Number.isFinite(Number(v))) joursApi[k] = Number(v);
    else joursApi[k] = null;
  }
  try {
    await sauverExtensions({ planSemaine: { mode: modeApi, jours: joursApi } });
  } catch { /* hors ligne : gardé en mémoire */ }
}

/** Programmes ajoutés à un jour de la semaine fixe quand le réglage « Plusieurs programmes par jour » est actif (planExtras de l'original). */
export const extrasDuJour = (dow) => {
  if (lireModule('reglages')?.multiPlan !== true) return [];
  const l = lireModule('planExtras')?.[String(dow)];
  return Array.isArray(l) ? l : [];
};
/** Programmes prévus un jour de la semaine fixe : celui du plan, puis les autres si le réglage le permet. */
export function programmesDuJour(d = new Date()) {
  const e = etat.value;
  const p = e?.plan;
  if (p?.mode !== 'semaine' || !e?.routines?.length) return [];
  if (e.profil?.extensions?.preferences?.deplacements?.[jourLocal(d)] != null) return []; // jour déplacé : la carte du jour décide
  const dow = d.getDay() || 7;
  const v = p.jours?.[dow] ?? p.jours?.[String(dow)];
  const ids = [...(v == null || v === 'repos' ? [] : [v]), ...extrasDuJour(dow)];
  return [...new Set(ids.map(String))].map((id) => e.routines.find((r) => String(r.id) === id)).filter(Boolean);
}

/** Routine affichée sur la carte du jour selon le plan hebdomadaire ou l’ancien planSemaine. */
export function routineSelonPlanDuJour() {
  const e = etat.value;
  if (!e?.routines?.length) return null;
  const { routines } = e;
  const p = e.plan;
  const extPlan = e.profil?.extensions?.planSemaine;
  const auj = new Date();
  const dow = auj.getDay() === 0 ? 7 : auj.getDay();
  const parId = (id) => routines.find((r) => r.id === id);
  // Programme déplacé pour aujourd'hui seulement (GymMane planMoves, feuille « Déplacer à un autre jour » de l'accueil).
  const dep = e.profil?.extensions?.preferences?.deplacements?.[jourLocal(auj)];
  if (dep === 'repos') return null;
  if (dep != null && routines.some((r) => String(r.id) === String(dep))) return routines.find((r) => String(r.id) === String(dep));

  if (p?.mode === 'semaine') {
    // Plusieurs programmes ce jour-là : le premier pas encore fait aujourd'hui, sinon le dernier (nextRoutineOn de l'original).
    const liste = programmesDuJour(auj);
    if (liste.length < 2) return liste[0] ?? null;
    const faits = new Set(e.seances.filter((s) => jourLocal(new Date(s.debut)) === jourLocal(auj)).map((s) => s.nom));
    return liste.find((r) => !faits.has(r.nom)) ?? liste.at(-1);
  }
  if (p?.mode === 'rotation') {
    const ord = [...routines].sort((a, b) => a.id - b.id);
    if (!ord.length) return null;
    const ref = lundi(auj);
    const diffJ = Math.floor((auj - ref) / 86400000);
    const sem = Math.floor(diffJ / 7);
    // decalageRotation : « Passer au suivant » des options du programme du jour (GymMane skipRotation).
    const idx = ((sem + (p.index_rotation ?? 0) + (e.profil?.extensions?.preferences?.decalageRotation ?? 0)) % ord.length + ord.length) % ord.length;
    return ord[idx];
  }
  if (extPlan?.mode === 'fixe') {
    const id = extPlan.jours[dow] ?? extPlan.jours[String(dow)];
    return id ? parId(id) ?? null : null;
  }
  if (extPlan?.mode === 'rotation') {
    const ord = [...routines].sort((a, b) => a.id - b.id);
    if (!ord.length) return null;
    const ref = lundi(auj);
    const diffJ = Math.floor((auj - ref) / 86400000);
    const sem = Math.floor(diffJ / 7);
    return ord[((sem % ord.length) + ord.length) % ord.length];
  }
  return null;
}

/** Vrai si le jour est marqué repos dans le plan fixe (semaine). */
export function estJourReposPlan(dow1To7) {
  const p = etat.value?.plan;
  if (p?.mode === 'semaine') {
    const v = p.jours?.[dow1To7] ?? p.jours?.[String(dow1To7)];
    return v === null || v === undefined || v === 'repos';
  }
  const ext = etat.value?.profil?.extensions?.planSemaine;
  if (ext?.mode === 'fixe') {
    const id = ext.jours[dow1To7] ?? ext.jours[String(dow1To7)];
    return id === undefined || id === null;
  }
  return false;
}

const MUSCLES_INTENSITE = ['pectoraux', 'dos', 'epaules', 'biceps', 'triceps', 'avant-bras', 'abdos', 'obliques', 'quadriceps', 'ischios', 'fessiers', 'mollets', 'trapezes', 'lombaires'];

function melanger(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Démarre une séance à partir des muscles choisis et ouvre l’écran séance. */
export function demarrerDepuisMuscles(musclesIds) {
  if (enCours.value) return;
  const set = new Set(Array.isArray(musclesIds) ? musclesIds : [...musclesIds]);
  const muscleMatch = (ex) => {
    if (!ex) return false;
    if (set.has(ex.muscle)) return true;
    for (const a of ex.autres ?? []) if (set.has(a)) return true;
    return set.has('obliques') && ex.muscle === 'abdos' && (ex.autres || []).includes('obliques');
  };
  const candidats = (tousExercices.value ?? []).filter((e) => muscleMatch(e) && suggere(e.id));
  if (candidats.length < 4) return;
  const nb = Math.min(6, candidats.length);
  const pris = melanger(candidats).slice(0, nb).map((e) => e.id);
  demarrerAvecExercices(pris);
  if (typeof location !== 'undefined') location.hash = '#/seance';
}

function debutSeanceMs(s) {
  return Date.parse(typeof s.debut === 'string' && s.debut.includes('T') ? s.debut : `${String(s.debut).replace(' ', 'T')}Z`);
}

/** Exercices à privilégier : peu vus récemment ou souvent faits sur les gros groupes. */
export function suggestionsReco(seances, exercices = tousExercices.value, max = 8) {
  const liste = (exercices ?? []).filter((e) => e && suggere(e.id));
  if (!liste.length) return [];
  const main = new Set(['pectoraux', 'dos', 'epaules', 'quadriceps', 'ischios']);
  const now = Date.now();
  const frais = 60 * 86400000;
  const dernier = new Map();
  let pop = new Map();
  for (const s of seances ?? []) {
    const t0 = debutSeanceMs(s);
    if (Number.isNaN(t0)) continue;
    for (const e of s.donnees?.exercices ?? []) {
      const prev = dernier.get(e.ex) ?? 0;
      if (t0 >= prev) dernier.set(e.ex, t0);
      if (now - t0 <= frais) pop.set(e.ex, (pop.get(e.ex) ?? 0) + 1);
    }
  }
  const scores = liste.map((ex) => {
    const last = dernier.get(ex.id) ?? 0;
    const jours = last ? (now - last) / 86400000 : 999;
    const freq = pop.get(ex.id) ?? 0;
    const bonus = main.has(ex.muscle) ? 2 : 0;
    return { ex, score: jours + freq * 1.5 + bonus };
  });
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, max).map((x) => x.ex);
}

/** Volume levé en kg sur une période glissante (séries de travail). */
function volumePeriodeKg(seances, debutMs, finMs) {
  let v = 0;
  for (const s of seances ?? []) {
    const t = debutSeanceMs(s);
    if (Number.isNaN(t) || t < debutMs || t >= finMs) continue;
    for (const e of s.donnees?.exercices ?? []) {
      for (const x of e.series ?? []) {
        if (!compte(x)) continue;
        v += (x.kg ?? 0) * (x.r ?? 0);
      }
    }
  }
  return v;
}

/** Compare le volume des 30 derniers jours aux 30 jours précédents. */
export function deltaVolume30j(seances) {
  const now = Date.now();
  const actuel = volumePeriodeKg(seances, now - 30 * 86400000, now + 1);
  const precedent = volumePeriodeKg(seances, now - 60 * 86400000, now - 30 * 86400000);
  const pct = precedent === 0 ? null : Math.round(((actuel - precedent) / precedent) * 100);
  return { actuel, precedent, pct };
}

/** Intensité relative par muscle (0 à 1) sur les j derniers jours. */
export function intensitesMuscles(seances, jours = 30) {
  const now = Date.now();
  const debut = now - jours * 86400000;
  const compteurs = Object.fromEntries(MUSCLES_INTENSITE.map((m) => [m, 0]));
  for (const s of seances ?? []) {
    const t = debutSeanceMs(s);
    if (Number.isNaN(t) || t < debut || t > now + 1) continue;
    for (const e of s.donnees?.exercices ?? []) {
      const def = trouverExercice(e.ex);
      if (!def) continue;
      for (const x of e.series ?? []) {
        if (!serieTravailHisto(x)) continue;
        const mus = def.muscle;
        if (compteurs[mus] !== undefined) compteurs[mus] += 1;
        for (const a of def.autres ?? []) {
          if (compteurs[a] !== undefined) compteurs[a] += 0.5;
        }
      }
    }
  }
  const vals = MUSCLES_INTENSITE.map((m) => compteurs[m]);
  const max = Math.max(...vals, 1e-9);
  const out = {};
  for (const m of MUSCLES_INTENSITE) out[m] = Math.min(1, compteurs[m] / max);
  return out;
}

/** Suggestion de charge pour la prochaine séance d’un exercice au poids. */
export function prochaineCharge(idExercice, seances = etat.value?.seances ?? []) {
  const def = trouverExercice(idExercice);
  if (!def || def.mesure !== 'poids') return null;
  const ord = [...(seances ?? [])].sort((a, b) => (debutSeanceMs(b) - debutSeanceMs(a)));
  for (const s of ord) {
    const e = s.donnees?.exercices?.find((x) => x.ex === idExercice);
    if (!e?.series?.length) continue;
    const travail = e.series.filter((x) => serieTravailHisto(x));
    if (!travail.length) continue;
    const ok = travail.every((x) => (x.r ?? 0) >= 8 && (x.kg ?? 0) > 0);
    const dernier = travail[travail.length - 1];
    const kg = dernier.kg ?? 0;
    const r = dernier.r ?? null;
    if (ok) return { kg: kg + 2.5, r, hausse: true };
    return { kg, r, hausse: false };
  }
  return null;
}
