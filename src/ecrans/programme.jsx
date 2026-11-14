// Éditeur de programme M06 : nom, couleur, dossier, jours, exercices, séries prévues,
// repos, enchaînements et échelles. Les données partagées de M06 vivent ici.
import { L26 } from '../i18n/l26.js';
import { LigneRemplacants } from './l26-alts.jsx';
import { useEffect, useRef, useState } from 'preact/hooks';
import { IllustrationExercice } from '../illustrations.js';
import { afficher, api, charger, demarrer, enCours, etat, nomExercice, sauverPlanHebdo, tousExercices, trouverExercice, unite, versAffichage, versKg } from '../donnees.js';
import { MATERIELS, MUSCLES } from '../exercices.js';
import { langue, t, dp } from '../i18n.js';
import { textes } from '../i18n/m06.js';
import { Dialogue, EnTete, Feuille, Ic, Rond, Vide } from '../ui.jsx';
import { ChoixExercices, Recherche, ecrireFavoris, lireFavoris } from './exercices.jsx';
import { FeuilleProgression, libelleGenre } from './feuille-progression.jsx';
import { progressionActive } from '../progression.js';
import { TEINTES, couleurDe, deplacerDans, dossierDe, ecrireMeta, lireMeta, liesDe, nbSeries, poigneeReordre, routinePourDemarrer, etapeSuivante as etapeSuivanteCatalogue } from './programme-donnees.js';

export { TEINTES, couleurDe, dossierDe, ecrireMeta, lireMeta, liesDe, nbSeries, routinePourDemarrer };

const T6 = textes;
const tm = () => T6[langue === 'en' ? 'en' : 'fr'];


/** Échelles : { [idRoutine]: { [idExercice]: [idÉtape, ...] } }, gardées sur l'appareil. */
export const lireEchelles = () => lireMeta().echelles || {};
export const echelleDe = (idRoutine, idExercice) => (lireEchelles()[idRoutine] || {})[idExercice] || [];
export function ecrireEchelle(idRoutine, idExercice, etapes) {
  const m = lireMeta();
  const toutes = { ...(m.echelles || {}) };
  const r = { ...(toutes[idRoutine] || {}) };
  if (etapes && etapes.length) r[idExercice] = etapes; else delete r[idExercice];
  if (Object.keys(r).length) toutes[idRoutine] = r; else delete toutes[idRoutine];
  ecrireMeta({ echelles: toutes });
}


/** Ligne lisible des séries prévues : « 8 × 60 kg · 8 × 60 kg ». */
export function lignePlan(e, def) {
  const u = unite();
  const plan = Array.isArray(e?.planifie) ? e.planifie : [];
  if (!plan.length) return '';
  const duree = def?.mesure === 'duree';
  const morceaux = plan.slice(0, 4).map((p) => {
    if (duree) return [p.s ? `${p.s} ${t.commun.s}` : t.programmes.reposDefaut, p.km ? `${p.km} km` : ''].filter(Boolean).join(' ');
    const r = p.r ?? '−';
    return p.kg ? `${r} × ${versAffichage(p.kg)} ${u}` : `${r} ${t.commun.reps}`;
  });
  return morceaux.join(' · ') + (plan.length > 4 ? ' …' : '');
}

// Dix modèles prêts à l'emploi, mêmes programmes que GymMane.
const j = (nom, jours, exercices, weekday) => ({ nom, jours, exercices, weekday });
export const MODELES = [
  { id: 'fullbody', fr: 'Corps entier', en: 'Full Body', blurb: { fr: 'Trois séances complètes par semaine.', en: 'Three full sessions a week.' }, jours: [
    j('Corps entier', null, [['squat-a-la-barre', 3], ['developpe-couche-a-la-barre', 3], ['rowing-barre-penche', 3], ['developpe-militaire-a-la-barre', 3], ['souleve-de-terre-roumain-a-la-barre', 3], ['gainage-planche', 3]], 1),
    j('Corps entier', null, [['squat-a-la-barre', 3], ['developpe-couche-a-la-barre', 3], ['rowing-barre-penche', 3], ['developpe-militaire-a-la-barre', 3], ['souleve-de-terre-roumain-a-la-barre', 3], ['gainage-planche', 3]], 3),
    j('Corps entier', null, [['squat-a-la-barre', 3], ['developpe-couche-a-la-barre', 3], ['rowing-barre-penche', 3], ['developpe-militaire-a-la-barre', 3], ['souleve-de-terre-roumain-a-la-barre', 3], ['gainage-planche', 3]], 5),
  ] },
  { id: 'ppl', fr: 'Poussée, tirage, jambes', en: 'Push Pull Legs', blurb: { fr: 'Le découpage classique en trois séances.', en: 'The classic three-day split.' }, jours: [
    j('Poussée', null, [['developpe-couche-a-la-barre', 4], ['developpe-incline-aux-halteres', 3], ['developpe-militaire-a-la-barre', 3], ['elevations-laterales-aux-halteres', 3], ['extension-triceps-a-la-poulie-haute', 3]], 1),
    j('Tirage', null, [['tractions-pronation', 4], ['rowing-barre-penche', 4], ['tirage-vertical-prise-large', 3], ['face-pull-a-la-poulie', 3], ['curl-a-la-barre-debout', 3]], 3),
    j('Jambes', null, [['squat-a-la-barre', 4], ['souleve-de-terre-roumain-a-la-barre', 3], ['presse-a-cuisses', 3], ['leg-curl-assis', 3], ['mollets-debout-a-la-machine', 4]], 5),
  ] },
  { id: 'arnold', fr: 'Split Arnold', en: 'Arnold Split', blurb: { fr: 'Six séances, poitrine et dos ensemble.', en: 'Six sessions, chest and back together.' }, jours: [
    j('Poitrine et dos', null, [['developpe-couche-a-la-barre', 4], ['developpe-incline-aux-halteres', 3], ['ecarte-a-la-poulie-vis-a-vis', 3], ['tractions-pronation', 4], ['rowing-barre-penche', 4], ['tirage-horizontal-a-la-poulie', 3]], 1),
    j('Épaules et bras', null, [['developpe-militaire-a-la-barre', 4], ['elevations-laterales-aux-halteres', 4], ['face-pull-a-la-poulie', 3], ['curl-a-la-barre-debout', 3], ['curl-marteau', 3], ['barre-au-front-a-la-barre-ez', 3], ['extension-triceps-a-la-poulie-haute', 3]], 2),
    j('Jambes', null, [['squat-a-la-barre', 4], ['souleve-de-terre-roumain-a-la-barre', 3], ['presse-a-cuisses', 3], ['leg-extension', 3], ['leg-curl-assis', 3], ['mollets-debout-a-la-machine', 4]], 3),
    j('Poitrine et dos', null, [['developpe-couche-a-la-barre', 4], ['developpe-incline-aux-halteres', 3], ['ecarte-a-la-poulie-vis-a-vis', 3], ['tractions-pronation', 4], ['rowing-barre-penche', 4], ['tirage-horizontal-a-la-poulie', 3]], 4),
    j('Épaules et bras', null, [['developpe-militaire-a-la-barre', 4], ['elevations-laterales-aux-halteres', 4], ['face-pull-a-la-poulie', 3], ['curl-a-la-barre-debout', 3], ['curl-marteau', 3], ['barre-au-front-a-la-barre-ez', 3], ['extension-triceps-a-la-poulie-haute', 3]], 5),
    j('Jambes', null, [['squat-a-la-barre', 4], ['souleve-de-terre-roumain-a-la-barre', 3], ['presse-a-cuisses', 3], ['leg-extension', 3], ['leg-curl-assis', 3], ['mollets-debout-a-la-machine', 4]], 6),
  ] },
  { id: 'upperlower', fr: 'Haut, bas', en: 'Upper Lower', blurb: { fr: 'Quatre séances, haut et bas du corps.', en: 'Four sessions, upper and lower body.' }, jours: [
    j('Haut du corps', null, [['developpe-couche-a-la-barre', 4], ['rowing-barre-penche', 4], ['developpe-militaire-a-la-barre', 3], ['tirage-vertical-prise-large', 3], ['curl-a-la-barre-debout', 3], ['extension-triceps-a-la-poulie-haute', 3]], 1),
    j('Bas du corps', null, [['squat-a-la-barre', 4], ['souleve-de-terre-roumain-a-la-barre', 3], ['presse-a-cuisses', 3], ['leg-curl-assis', 3], ['mollets-debout-a-la-machine', 4]], 2),
    j('Haut du corps', null, [['developpe-incline-aux-halteres', 4], ['tractions-pronation', 4], ['developpe-epaules-aux-halteres-assis', 3], ['tirage-horizontal-a-la-poulie', 3], ['curl-marteau', 3], ['dips-aux-barres-paralleles', 3]], 4),
    j('Bas du corps', null, [['souleve-de-terre', 3], ['squat-avant', 3], ['leg-extension', 3], ['leg-curl-assis', 3], ['mollets-debout-a-la-machine', 4]], 5),
  ] },
  { id: 'abcd', fr: 'Split ABCD', en: 'ABCD Split', blurb: { fr: 'Quatre séances bien séparées.', en: 'Four clearly separated sessions.' }, jours: [
    j('A · Poitrine et triceps', null, [['developpe-couche-a-la-barre', 4], ['developpe-incline-aux-halteres', 3], ['ecarte-a-la-poulie-vis-a-vis', 3], ['extension-triceps-a-la-poulie-haute', 3], ['barre-au-front-a-la-barre-ez', 3]], 1),
    j('B · Dos et biceps', null, [['tractions-pronation', 4], ['rowing-barre-penche', 4], ['tirage-vertical-prise-large', 3], ['curl-a-la-barre-debout', 3], ['curl-marteau', 3]], 2),
    j('C · Jambes', null, [['squat-a-la-barre', 4], ['souleve-de-terre-roumain-a-la-barre', 3], ['presse-a-cuisses', 3], ['leg-curl-assis', 3], ['mollets-debout-a-la-machine', 4]], 4),
    j('D · Épaules et abdos', null, [['developpe-militaire-a-la-barre', 4], ['elevations-laterales-aux-halteres', 3], ['face-pull-a-la-poulie', 3], ['releve-de-jambes-suspendu', 3], ['gainage-planche', 3]], 5),
  ] },
  { id: 'abcde', fr: 'Split ABCDE', en: 'ABCDE Split', blurb: { fr: 'Un groupe musculaire par séance.', en: 'One muscle group per session.' }, jours: [
    j('A · Poitrine', null, [['developpe-couche-a-la-barre', 4], ['developpe-incline-aux-halteres', 4], ['ecarte-a-la-poulie-vis-a-vis', 3], ['dips-aux-barres-paralleles', 3]], 1),
    j('B · Dos', null, [['souleve-de-terre', 3], ['tractions-pronation', 4], ['rowing-barre-penche', 4], ['tirage-horizontal-a-la-poulie', 3]], 2),
    j('C · Jambes', null, [['squat-a-la-barre', 4], ['presse-a-cuisses', 4], ['leg-extension', 3], ['leg-curl-assis', 3], ['mollets-debout-a-la-machine', 4]], 3),
    j('D · Épaules', null, [['developpe-militaire-a-la-barre', 4], ['developpe-epaules-aux-halteres-assis', 3], ['elevations-laterales-aux-halteres', 4], ['face-pull-a-la-poulie', 3]], 4),
    j('E · Bras', null, [['curl-a-la-barre-debout', 4], ['barre-au-front-a-la-barre-ez', 4], ['curl-marteau', 3], ['extension-triceps-a-la-poulie-haute', 3]], 5),
  ] },
  { id: 'stronglifts', fr: 'StrongLifts 5×5', en: 'StrongLifts 5×5', blurb: { fr: 'Trois exercices, cinq séries de cinq.', en: 'Three lifts, five sets of five.' }, jours: [
    j('Séance A', null, [['squat-a-la-barre', 5], ['developpe-couche-a-la-barre', 5], ['rowing-barre-penche', 5]], 1),
    j('Séance B', null, [['squat-a-la-barre', 5], ['developpe-militaire-a-la-barre', 5], ['souleve-de-terre', 1]], 3),
  ] },
  { id: 'startingstrength', fr: 'Starting Strength', en: 'Starting Strength', blurb: { fr: 'Deux séances alternées, charges lourdes.', en: 'Two alternating sessions, heavy loads.' }, jours: [
    j('Séance A', null, [['squat-a-la-barre', 3], ['developpe-couche-a-la-barre', 3], ['souleve-de-terre', 1]], 1),
    j('Séance B', null, [['squat-a-la-barre', 3], ['developpe-militaire-a-la-barre', 3], ['rowing-barre-penche', 3]], 3),
  ] },
  { id: 'rr', fr: 'Programme recommandé', en: 'Recommended Routine', blurb: { fr: 'Poids du corps, trois fois par semaine.', en: 'Bodyweight, three times a week.' }, jours: [
    j('Programme recommandé', null, [['negatif-tirage-up', 3], ['squat-au-poids-du-corps', 3], ['assiste-chest-dip', 3], ['poids-du-corps-romanian-souleve-de-terre', 3], ['incline-rowing', 3], ['incline-push-up', 3], ['gainage-planche', 3], ['a-la-poulie-pallof-maintien', 3], ['hyperextension-inversee', 3]], 1),
    j('Programme recommandé', null, [['negatif-tirage-up', 3], ['squat-au-poids-du-corps', 3], ['assiste-chest-dip', 3], ['poids-du-corps-romanian-souleve-de-terre', 3], ['incline-rowing', 3], ['incline-push-up', 3], ['gainage-planche', 3], ['a-la-poulie-pallof-maintien', 3], ['hyperextension-inversee', 3]], 3),
    j('Programme recommandé', null, [['negatif-tirage-up', 3], ['squat-au-poids-du-corps', 3], ['assiste-chest-dip', 3], ['poids-du-corps-romanian-souleve-de-terre', 3], ['incline-rowing', 3], ['incline-push-up', 3], ['gainage-planche', 3], ['a-la-poulie-pallof-maintien', 3], ['hyperextension-inversee', 3]], 5),
  ] },
  { id: 'home', fr: 'Sans matériel', en: 'No Kit', blurb: { fr: 'Deux séances à la maison, sans matériel.', en: 'Two home sessions, no equipment.' }, jours: [
    j('Maison A', null, [['pompes', 3], ['tractions-pronation', 3], ['squat-au-poids-du-corps', 3], ['gainage-planche', 3]], 2),
    j('Maison B', null, [['dips-aux-barres-paralleles', 3], ['tractions-supination', 3], ['fentes-marchees-aux-halteres', 3], ['releve-de-jambes-suspendu', 3]], 5),
  ] },
];

const TYPES = ['n', 'e', 'd', 'f', 'c'];
const REPOS = [null, 0, 45, 60, 90, 120, 150, 180, 240];

/** Convertit un modèle en exercices de programme. */
export const exercicesDuModele = (modele) => modele.exercices.map(([ex, series]) => ({
  ex, repos: null, note: '', planifie: Array.from({ length: series }, () => ({ r: null, kg: null, s: null, type: 'n' })),
}));

/** Le plan d'un exercice porte-t-il des valeurs propres (reps, charge, durée, type) ? */
const aDesValeurs = (planifie) => (planifie ?? []).some((p) => p.r || p.kg || p.s || p.km || (p.type && p.type !== 'n'));
const serieVide = () => ({ r: null, kg: null, s: null, type: 'n' });
const sansAccent = (x) => String(x ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const PAQUET = 40;
// Ordre des pastilles de muscle de l'original (kFilterMuscles).
const ORDRE_MUSCLES = ['pectoraux', 'dos', 'trapezes', 'lombaires', 'epaules', 'biceps', 'triceps', 'avant-bras', 'abdos', 'quadriceps', 'fessiers', 'ischios', 'mollets'];

/** Données d'export lisibles par l'import (format plan de GymMane). */
export function donneesExport(liste) {
  const { plan } = etat.value;
  return {
    gymmane: 'plan',
    v: 1,
    unit: 'kg',
    routines: liste.map((r) => ({
      name: r.nom,
      ...(r.dossier ? { group: r.dossier } : {}),
      days: Object.entries(plan?.jours ?? {}).filter(([, v]) => String(v) === String(r.id)).map(([k]) => Number(k)).sort((a, b) => a - b),
      exercises: (r.exercices ?? []).map((e) => ({
        ex: e.ex,
        ...(e.note ? { note: e.note } : {}),
        ...(e.repos != null ? { rest: e.repos } : {}),
        ...(Array.isArray(e.planifie) && e.planifie.length ? { plan: e.planifie.map((p) => ({ ...(p.type && p.type !== 'n' ? { type: p.type } : {}), ...(p.r ? { reps: p.r } : {}), ...(p.kg ? { weight: p.kg } : {}), ...(p.s != null ? { time: p.s } : {}), ...(p.km ? { distance: p.km } : {}) })) } : {}),
      })),
      ...(r.lies?.length ? { supersets: r.lies } : {}),
    })),
  };
}

/** Exporte des programmes (tous par défaut) dans un fichier JSON téléchargé, relisible ici. */
export function exporterProgrammes(liste = etat.value.routines) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(donneesExport(liste), null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'anatoly-programmes.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  afficher(tm().import.exportFait);
}

/** Partage un texte JSON lisible par l'import, ou le télécharge si le partage n'existe pas. */
export async function partagerProgrammes(liste, titre) {
  const data = JSON.stringify(donneesExport(liste), null, 2);
  try {
    if (navigator.share) { await navigator.share({ title: titre, text: data }); return; }
  } catch (e) { if (e?.name === 'AbortError') return; }
  exporterProgrammes(liste);
}

/** Éditeur de programme (routine_edit_screen.dart) : nom dans la barre du haut, couleurs, jours, groupe,
 * exercices choisis en lignes compactes, bibliothèque intégrée, boutons flottants. */
export function Programme({ id }) {
  const tm6 = tm();
  const v = tm6.v6;
  const existant = id === 'nouveau' ? null : etat.value.routines.find((r) => String(r.id) === id);
  const [nom, setNom] = useState(existant?.nom ?? '');
  const [dossier, setDossier] = useState(existant ? dossierDe(existant) : '');
  const [couleur, setCouleur] = useState(existant ? couleurDe(existant) : TEINTES[0]);
  const [lies, setLies] = useState(() => new Set(existant ? liesDe(existant) : []));
  const [exos, setExos] = useState(() => (existant?.exercices ?? []).map((e) => ({
    ex: e.ex, repos: e.repos ?? null, note: e.note ?? '',
    planifie: Array.isArray(e.planifie) && e.planifie.length ? e.planifie : Array.from({ length: nbSeries(e) }, () => ({ r: e.reps ?? null, kg: null, s: null, type: 'n' })),
  })));
  const [suppr, setSuppr] = useState(false);
  const [planDe, setPlanDe] = useState(null);
  const [echelleDe_, setEchelleDe_] = useState(null);
  const [dossiersOuverts, setDossiersOuverts] = useState(false);
  const [nouveauGroupe, setNouveauGroupe] = useState(null);
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [erreur, setErreur] = useState('');
  const [progressionDe, setProgressionDe] = useState(null);
  const [q, setQ] = useState('');
  const [f, setF] = useState({ muscle: '', favoris: false, nu: false, materiel: '', niveau: 0 });
  const [nb, setNb] = useState(PAQUET);
  const fin = useRef(null);
  const favoris = lireFavoris();
  useEffect(() => {
    if (!fin.current || typeof IntersectionObserver === 'undefined') return undefined;
    const o = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) setNb((n) => n + PAQUET); }, { rootMargin: '600px' });
    o.observe(fin.current);
    return () => o.disconnect();
  });

  if (id !== 'nouveau' && !existant) return <main class="ecran"><EnTete titre={t.programmes.titre} retour="#/programmes" /><Vide n="stack" titre={t.programmes.vide} /></main>;

  const plan = etat.value.plan ?? { mode: 'semaine', jours: {} };
  const joursRoutine = new Set(Object.entries(plan.jours ?? {}).filter(([, x]) => String(x) === String(existant?.id)).map(([k]) => k));
  const choisis = new Set(exos.map((x) => x.ex));

  const maj = (i, champs) => setExos((l) => l.map((x, k) => (k === i ? { ...x, ...champs } : x)));
  const basculerJour = async (n) => {
    if (!existant) { afficher(t.programmes.nomVide, 'danger'); return; }
    const jours = { ...(plan.jours ?? {}) };
    const k = String(n);
    if (String(jours[k]) === String(existant.id)) jours[k] = null; else jours[k] = existant.id;
    await sauverPlanHebdo({ ...plan, mode: 'semaine', jours });
  };
  const basculerLien = (i) => {
    const ex = exos[i].ex;
    const on = !lies.has(ex);
    setLies((x) => { const n = new Set(x); if (on) n.add(ex); else n.delete(ex); return n; });
    if (on) afficher(v.superserie);
  };
  const ajouterSeries = (i, d) => setExos((l) => l.map((x, k) => {
    if (k !== i) return x;
    const n = Math.max(1, Math.min(20, x.planifie.length + d));
    const planifie = [...x.planifie];
    while (planifie.length < n) planifie.push({ ...(planifie[planifie.length - 1] || serieVide()), type: 'n' });
    planifie.length = n;
    return { ...x, planifie };
  }));
  const retirer = (i) => {
    const avant = exos;
    const ex = exos[i].ex;
    setExos((l) => l.filter((_, k) => k !== i));
    afficher(v.retirer, 'ok', { libelle: t.commun.annuler, fn: () => setExos(avant) });
    if (lies.has(ex)) setLies((x) => { const n = new Set(x); n.delete(ex); return n; });
  };
  const basculerExo = (ex) => {
    const i = exos.findIndex((x) => x.ex === ex);
    if (i >= 0) { retirer(i); return; }
    setExos((l) => [...l, { ex, repos: null, note: '', planifie: [serieVide(), serieVide(), serieVide()] }]);
    setErreur('');
  };

  const corps = () => ({
    nom: nom.trim(), dossier: dossier.trim(), couleur, lies: [...lies].filter((ex) => exos.some((x) => x.ex === ex)),
    exercices: exos.map((e) => ({ ex: e.ex, repos: e.repos ?? null, note: e.note ?? '', planifie: e.planifie })),
  });
  const enregistrer = async (puisLancer = false) => {
    if (!nom.trim()) { setErreur(t.programmes.nomVide); afficher(t.programmes.nomVide, 'danger'); document.getElementById('p-nom')?.focus(); return; }
    if (!exos.length) { setErreur(t.programmes.exercicesVide); afficher(t.programmes.exercicesVide, 'danger'); return; }
    try {
      const r = existant ? (await api('PUT', `/api/routines/${existant.id}`, corps()), existant) : await api('POST', '/api/routines', corps());
      await charger();
      afficher(t.programmes.modifie);
      if (puisLancer) { const routine = etat.value.routines.find((x) => x.id === r.id); if (routine && !enCours.value) { demarrer(routinePourDemarrer(routine)); location.hash = '#/seance'; return; } }
      location.replace('#/programmes');
    } catch { afficher(t.commun.erreur, 'danger'); }
  };
  // GymMane enregistre au fil de l'eau : le retour garde donc les changements dès que le programme est valable.
  const quitter = () => {
    const change = existant ? JSON.stringify(corps()) !== JSON.stringify({ ...corps(), nom: existant.nom, dossier: dossierDe(existant), couleur: couleurDe(existant), lies: liesDe(existant), exercices: (existant.exercices ?? []).map((e) => ({ ex: e.ex, repos: e.repos ?? null, note: e.note ?? '', planifie: e.planifie })) }) : true;
    if (change && nom.trim() && exos.length) enregistrer(false); else location.hash = '#/programmes';
  };
  const groupes = [...new Set(etat.value.routines.map(dossierDe).filter(Boolean))];
  const nbFiltres = (f.muscle ? 1 : 0) + (f.materiel ? 1 : 0) + (f.niveau ? 1 : 0);
  const mots = sansAccent(q).split(/\s+/).filter(Boolean);
  const biblio = tousExercices.value.filter((e) => (!f.muscle || e.muscle === f.muscle) && (!f.materiel || e.materiel === f.materiel) && (!f.niveau || e.niveau === f.niveau)
    && (!f.favoris || favoris.includes(e.id)) && (!f.nu || e.materiel === 'poids-du-corps')
    && mots.every((m) => sansAccent(`${e.fr} ${e.en} ${e.noms ?? ''}`).includes(m)))
    .sort((a, b) => nomExercice(a).localeCompare(nomExercice(b), langue));
  const avecLien = exos.some((x, i) => i < exos.length - 1 && lies.has(x.ex));
  const puce = (libelle, actif, onClick) => <button type="button" class="rt-filtre" aria-pressed={actif} onClick={onClick}>{libelle}</button>;
  const effacerFiltres = () => { setQ(''); setF({ muscle: '', favoris: false, nu: false, materiel: '', niveau: 0 }); };

  return <main class={`ecran editeur rt-edit${exos.length ? ' avec-pied' : ''}`}>
    <header class="rt-edit-tete">
      <Rond n="chevron" label={t.commun.retour} onClick={quitter} />
      <input id="p-nom" class="rt-edit-nom" maxLength={80} value={nom} placeholder={v.nomProgramme} aria-label={v.nomProgramme} aria-invalid={erreur === t.programmes.nomVide}
        autoFocus={!existant} onInput={(ev) => { setNom(ev.target.value); setErreur(''); }} />
      {existant && exos.length > 0 && <button type="button" class="rt-edit-ic" aria-label={v.partagerProgramme} onClick={() => partagerProgrammes([{ ...existant, ...corps() }], nom || existant.nom)}><Ic n="share-network" taille={19} /></button>}
      {existant && <button type="button" class="rt-edit-ic" aria-label={v.dupliquerProgramme} onClick={async () => {
        try { const r = await api('POST', '/api/routines', { ...corps(), nom: t.programmes.copie(nom.trim() || existant.nom).slice(0, 80) }); await charger(); location.hash = `#/programme/${r.id}`; } catch { afficher(t.commun.erreur, 'danger'); }
      }}><Ic n="copy-simple" taille={19} /></button>}
      <button type="button" class="rt-edit-ic" aria-label={v.supprimerProgramme} onClick={() => (existant ? setSuppr(true) : location.replace('#/programmes'))}><Ic n="trash" taille={20} /></button>
    </header>

    <div class="rt-couleurs" role="radiogroup" aria-label={t.programmes.couleur}>
      {TEINTES.map((c) => <button key={c} type="button" role="radio" aria-checked={couleur === c} class="rt-couleur"
        aria-label={`${t.programmes.couleur} ${c}`} onClick={() => setCouleur(c)}><i style={`background:${c}`} /></button>)}
    </div>

    <p class="rt-etiq rt-edit-etiq">{v.planning2}</p>
    <div class="rt-jours" role="group" aria-label={tm6.editeur.jours}>
      {t.jours.map((lettre, i) => {
        const on = joursRoutine.has(String(i + 1));
        return <button key={i} type="button" class={`rt-jour-rond${on ? ' on' : ''}`} aria-pressed={on} aria-label={t.joursLongs[i]}
          onClick={() => basculerJour(i + 1)}><i>{lettre}</i></button>;
      })}
    </div>

    <button type="button" class="rt-groupe-ligne" onClick={() => setDossiersOuverts(true)}>
      <Ic n="folder-simple" taille={17} /><span>{v.groupe}</span>
      <small>{dossier || v.aucunGroupe}</small><Ic n="caret-right" taille={14} />
    </button>

    <p class="rt-etiq rt-edit-etiq rt-edit-exos">{v.exercicesTete(exos.length)}</p>
    {exos.length === 0 ? <p class="rt-edit-aide vide">{v.ajouterDepuisListe}</p> : <p class="rt-edit-aide">{v.seriesAide}</p>}
    {erreur && <p class="erreur-champ" role="alert">{erreur}</p>}

    {exos.length > 0 && <div class="rt-choisis">{exos.map((x, i) => {
      const def = trouverExercice(x.ex);
      const nomEx = nomExercice(def) || x.ex;
      const suite = i < exos.length - 1 && lies.has(x.ex);
      const depuis = i > 0 && lies.has(exos[i - 1].ex);
      const enChaine = suite || depuis;
      const etapes = echelleDe(existant?.id, x.ex);
      const valeurs = aDesValeurs(x.planifie);
      return <div class={`rt-exo-ligne${suite ? ' suite' : ''}`} data-ligne key={x.ex}>
        {avecLien && <span class="rt-rail" aria-hidden="true">{enChaine && <i class={`${depuis ? '' : 'haut'} ${suite ? '' : 'bas'}`} />}</span>}
        <div class="rt-exo">
          <button type="button" class="rt-poignee" aria-label={v.deplacer(nomEx)} {...poigneeReordre(i, exos.length, (a, b) => setExos((l) => deplacerDans(l, a, b)))}><Ic n="dots-six-vertical" taille={18} /></button>
          <button type="button" class="rt-vignette petit" tabIndex={-1} aria-hidden="true" onClick={() => setPlanDe(i)}><IllustrationExercice exo={def || { id: x.ex }} taille={44} /></button>
          <div class="rt-exo-texte">
            <button type="button" class="rt-exo-nom" aria-label={`${v.planifier} ${nomEx}`} onClick={() => setPlanDe(i)}><b>{nomEx}</b><Ic n="sliders-horizontal" taille={13} classe={valeurs ? 'actif' : ''} /></button>
            {enChaine && <span class="rt-exo-etiq cuivre">{v.superserie}</span>}
            {etapes.length > 0 && <span class="rt-exo-etiq sauge">{`${tm6.editeur.echelle} · ${etapes.indexOf(x.ex) + 1}/${etapes.length}`}</span>}
            <div class="rt-mini-pas">
              <button type="button" aria-label={`${t.commun.moins}${dp()}${tm6.editeur.series}`} disabled={x.planifie.length <= 1} onClick={() => ajouterSeries(i, -1)}>−</button>
              <output aria-live="polite">{v.seriesN(x.planifie.length)}</output>
              <button type="button" aria-label={`${t.commun.plus}${dp()}${tm6.editeur.series}`} disabled={x.planifie.length >= 20} onClick={() => ajouterSeries(i, 1)}>+</button>
            </div>
            {valeurs && <small>{lignePlan(x, def)}</small>}
          </div>
          {i < exos.length - 1 && <button type="button" class={`rt-exo-ic${lies.has(x.ex) ? ' lie' : ''}`} role="switch" aria-checked={lies.has(x.ex)} aria-label={v.lier} onClick={() => basculerLien(i)}><Ic n={lies.has(x.ex) ? 'link:fill' : 'link'} taille={17} /></button>}
          <button type="button" class="rt-exo-ic" aria-label={v.retirer} onClick={() => retirer(i)}><Ic n="trash" taille={18} /></button>
        </div>
      </div>;
    })}</div>}

    <div class="rt-biblio">
      <Recherche valeur={q} onChange={(x) => { setQ(x); setNb(PAQUET); }} label={v.ajouterExos} />
      <div class="rt-filtres">
        {puce(nbFiltres ? `${v.filtres} · ${nbFiltres}` : v.filtres, nbFiltres > 0, () => setFiltresOuverts(true))}
        {puce(v.favoris, f.favoris, () => setF({ ...f, favoris: !f.favoris }))}
        {puce(v.sansMateriel, f.nu, () => setF({ ...f, nu: !f.nu }))}
        {ORDRE_MUSCLES.filter((m) => MUSCLES.includes(m)).map((m) => <span key={m}>{puce(t.muscles[m], f.muscle === m, () => { setF({ ...f, muscle: f.muscle === m ? '' : m }); setNb(PAQUET); })}</span>)}
      </div>
      {biblio.length === 0
        ? <div class="rt-aucun-ex"><b>{v.aucunTrouve}</b><div>
          <button type="button" class="rt-action accent" onClick={effacerFiltres}>{v.effacerFiltres}</button></div></div>
        : <div class="rt-biblio-liste">{biblio.slice(0, nb).map((e) => {
          const on = choisis.has(e.id);
          return <button key={e.id} type="button" class={`rt-choix${on ? ' on' : ''}`} aria-pressed={on} onClick={() => basculerExo(e.id)}>
            <span class="rt-vignette petit" aria-hidden="true"><IllustrationExercice exo={e} taille={44} /></span>
            <span class="rt-choix-texte"><b>{nomExercice(e)}</b><small>{t.muscles[e.muscle] ?? e.muscle} · {t.materiels[e.materiel] ?? e.materiel}</small></span>
            <span class="rt-choix-rond" aria-hidden="true"><Ic n={on ? 'check:bold' : 'plus'} taille={on ? 14 : 15} /></span>
          </button>;
        })}{nb < biblio.length && <span ref={fin} class="rt-biblio-fin" aria-hidden="true" />}</div>}
    </div>

    {exos.length > 0 && <div class="rt-edit-pied">
      <button type="button" class="rt-edit-sauver" onClick={() => enregistrer(false)}>{v.enregistrer}</button>
      <button type="button" class="btn pri" disabled={!!enCours.value} onClick={() => enregistrer(true)}><Ic n="play:fill" taille={15} />{v.commencer}</button>
    </div>}

    {planDe !== null && exos[planDe] && <FeuillePlan x={exos[planDe]} def={trouverExercice(exos[planDe].ex)} favori={favoris.includes(exos[planDe].ex)}
      basculerFavori={() => { const ex = exos[planDe].ex; ecrireFavoris(favoris.includes(ex) ? favoris.filter((z) => z !== ex) : [...favoris, ex]); }}
      fermer={() => setPlanDe(null)} onChange={(champs) => maj(planDe, champs)}
      progression={() => setProgressionDe(exos[planDe].ex)} echelle={() => setEchelleDe_(planDe)}
      routineId={existant?.id ?? null} dansProgramme={exos.map((e) => e.ex)} />}

    {progressionDe && <FeuilleProgression ex={progressionDe} fermer={() => setProgressionDe(null)} />}

    {echelleDe_ !== null && <FeuilleEchelle idRoutine={existant?.id ?? 'brouillon'} idExercice={exos[echelleDe_].ex}
      fermer={() => setEchelleDe_(null)} />}

    <Feuille ouverte={filtresOuverts} fermer={() => setFiltresOuverts(false)} titre={v.filtres}
      pied={<button type="button" class="btn pri large" onClick={() => setFiltresOuverts(false)}>{tm6.editeur.terminer}</button>}>
      <p class="rt-etiq">{v.materiel}</p>
      <div class="rt-filtres enveloppe">{puce(v.tous, !f.materiel, () => setF({ ...f, materiel: '' }))}
        {MATERIELS.map((m) => <span key={m}>{puce(t.materiels[m] ?? m, f.materiel === m, () => setF({ ...f, materiel: f.materiel === m ? '' : m }))}</span>)}</div>
      <p class="rt-etiq">{v.niveau}</p>
      <div class="rt-filtres enveloppe">{puce(v.tous, !f.niveau, () => setF({ ...f, niveau: 0 }))}
        {[1, 2, 3].map((n) => <span key={n}>{puce(t.niveaux[n], f.niveau === n, () => setF({ ...f, niveau: f.niveau === n ? 0 : n }))}</span>)}</div>
    </Feuille>

    <Feuille ouverte={dossiersOuverts} fermer={() => setDossiersOuverts(false)} titre={v.groupe}>
      <div class="pile">
        <button type="button" class={`ligne-dossier${!dossier ? ' on' : ''}`} onClick={() => { setDossier(''); setDossiersOuverts(false); }}>
          <Ic n="folder-simple" taille={17} /><span>{v.aucunGroupe}</span></button>
        {groupes.map((g) => <button key={g} type="button" class={`ligne-dossier${dossier === g ? ' on' : ''}`} onClick={() => { setDossier(g); setDossiersOuverts(false); }}>
          <Ic n="folder-simple" taille={17} /><span>{g}</span></button>)}
        {/* « Nouveau groupe » (routine_edit_screen.dart _newGroup) : la feuille se ferme, un dialogue demande le nom. */}
        <button type="button" class="l26-fantome" onClick={() => { setDossiersOuverts(false); setNouveauGroupe(''); }}><Ic n="plus" taille={16} />{L26().nouveauGroupe}</button>
      </div>
    </Feuille>
    {nouveauGroupe !== null && <Dialogue ouvert fermer={() => setNouveauGroupe(null)} titre={L26().nouveauGroupe} libelle={L26().enregistrerCaps}
      confirmer={() => { if (nouveauGroupe.trim()) setDossier(nouveauGroupe.trim().slice(0, 80)); setNouveauGroupe(null); }}>
      <input class="form-input" maxLength={80} value={nouveauGroupe} placeholder={L26().nomGroupeAide} aria-label={L26().nouveauGroupe} autoCapitalize="words"
        onInput={(e) => setNouveauGroupe(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (nouveauGroupe.trim()) setDossier(nouveauGroupe.trim().slice(0, 80)); setNouveauGroupe(null); } }} />
    </Dialogue>}

    <Dialogue ouvert={suppr} fermer={() => setSuppr(false)} titre={tm6.editeur.supprimerTitre} texte={tm6.editeur.supprimerTexte} libelle={t.commun.supprimer} danger
      confirmer={async () => { try { await api('DELETE', `/api/routines/${existant.id}`); await charger(); afficher(t.commun.supprime); location.replace('#/programmes'); } catch { afficher(t.commun.erreur, 'danger'); } }} />
  </main>;
}

/** Ligne Progression (_ladderRow) : « Aucune pour le moment » ou l'étape et la suivante. */
function texteEchelle(routineId, ex) {
  const X = L26();
  const propre = routineId != null ? echelleDe(routineId, ex) : [];
  const i = propre.indexOf(ex);
  const suivante = i >= 0 ? propre[i + 1] ?? null : etapeSuivanteCatalogue(ex);
  if (!suivante) return X.echelleAucune;
  return [i >= 0 && X.echelleEtape(i + 1, propre.length), X.ensuite(nomExercice(trouverExercice(suivante)) || suivante)].filter(Boolean).join(' · ');
}

/** Feuille d'un exercice du programme (_openPlan) : séries prévues, repos, progression, échelle. */
function FeuillePlan({ x, def, favori, basculerFavori, fermer, onChange, progression, echelle, routineId = null, dansProgramme = [] }) {
  const tm6 = tm();
  const v = tm6.v6;
  const plan = x.planifie.length ? x.planifie : [serieVide()];
  const duree = def?.mesure === 'duree';
  const modifier = (i, champs) => onChange({ planifie: plan.map((p, k) => (k === i ? { ...p, ...champs } : p)) });
  const cycle = (i) => modifier(i, { type: TYPES[(TYPES.indexOf(plan[i].type) + 1) % TYPES.length] });
  return <Feuille ouverte fermer={fermer} titre={nomExercice(def)}
    pied={<button type="button" class="btn pri large" onClick={fermer}>{v.terminer}</button>}>
    <div class="rt-plan">
      <div class="rt-plan-tete"><h2>{nomExercice(def)}</h2>
        <Rond n={favori ? 'star:fill' : 'star'} label={v.favoris} classe={favori ? 'fav' : ''} onClick={basculerFavori} /></div>
      <p class="rt-plan-aide">{v.planSeriesAide}</p>
      <div class="pile">
        {plan.map((p, i) => <div class="serie modif" key={i}>
          <button type="button" class={`serie-num type-${p.type}`} aria-label={t.seance.typeSerie} onClick={() => cycle(i)}>{t.typesCourts[p.type] || i + 1}</button>
          {duree
            ? <ChampNombre valeur={p.s} label={`${t.seance.duree} (${t.commun.s}), ${i + 1}`} onChange={(n) => modifier(i, { s: n })} />
            : <><ChampNombre valeur={p.r} label={`${t.seance.reps}, ${i + 1}`} onChange={(n) => modifier(i, { r: n })} />
              <ChampNombre valeur={versAffichage(p.kg)} label={`${unite()}, ${i + 1}`} onChange={(n) => modifier(i, { kg: versKg(n) })} /></>}
          <button type="button" class="rond petit" aria-label={tm6.editeur.supprimerSerie} disabled={plan.length <= 1}
            onClick={() => onChange({ planifie: plan.filter((_, k) => k !== i) })}><Ic n="trash" taille={15} /></button>
        </div>)}
        <button type="button" class="btn rt-fantome" onClick={() => onChange({ planifie: [...plan, { ...(plan[plan.length - 1] || serieVide()), type: 'n' }] })}>
          <Ic n="plus" taille={16} />{v.ajouterSerie}</button>
        {aDesValeurs(plan) && <button type="button" class="btn lien rt-plan-effacer" onClick={() => onChange({ planifie: plan.map(() => serieVide()) })}>{v.effacerPlan}</button>}
      </div>
      <label class="rt-plan-ligne"><Ic n="timer" taille={19} /><span>{v.reposSeries}</span>
        <select value={x.repos ?? ''} onChange={(ev) => onChange({ repos: ev.target.value === '' ? null : Number(ev.target.value) })}>
          {REPOS.map((r) => <option key={String(r)} value={r ?? ''}>{r === null ? tm6.editeur.reposDefaut : r === 0 ? tm6.editeur.aucunRepos : tm6.editeur.secondes(r)}</option>)}
        </select></label>
      {def && !duree && <button type="button" class={`exo-prog-progression${progressionActive(x.ex) ? ' on' : ''}`} onClick={progression}>
        <Ic n="trend-up" taille={19} /><span>{tm6.progression.ligne}</span><em>{libelleGenre(x.ex)}</em><Ic n="caret-right:bold" taille={13} /></button>}
      <LigneRemplacants routineId={routineId} ex={x.ex} dansProgramme={dansProgramme} />
      {!duree && <button type="button" class="exo-prog-progression" onClick={echelle}>
        <Ic n="chart-bar" taille={19} /><span class="l26-alts-texte"><b>{v.echelle}</b><small>{texteEchelle(routineId, x.ex)}</small></span><Ic n="caret-right:bold" taille={13} /></button>}
    </div>
  </Feuille>;
}

// Champ numérique court, symbole moins ou plus.
function ChampNombre({ valeur, label, onChange }) {
  const [texte, setTexte] = useState(valeur ?? '');
  return <input class="cellule" inputMode="decimal" aria-label={label} placeholder="−" value={langue === 'fr' ? String(texte).replace('.', ',') : String(texte)}
    onFocus={(e) => e.target.select()}
    onInput={(e) => {
      const brut = e.target.value.replace(',', '.').replace(/[^\d.]/g, '');
      setTexte(brut);
      onChange(brut === '' ? null : Number(brut));
    }} />;
}

// Échelle de progression : liste ordonnée d'exercices de la plus facile à la plus dure.
function FeuilleEchelle({ idRoutine, idExercice, fermer }) {
  const tm6 = tm();
  const [etapes, setEtapes] = useState(() => echelleDe(idRoutine, idExercice));
  const [choix, setChoix] = useState(false);
  const deplacer = (i, d) => setEtapes((l) => { const c = [...l]; const [x] = c.splice(i, 1); c.splice(i + d, 0, x); return c; });
  return <Feuille ouverte fermer={fermer} titre={tm6.editeur.echelle} sous={tm6.editeur.echelleAide} large
    pied={<button type="button" class="btn pri large" onClick={() => { ecrireEchelle(idRoutine, idExercice, etapes); fermer(); }}>{tm6.editeur.terminer}</button>}>
    <div class="pile">
      {etapes.length === 0
        ? <p class="muted">{tm6.editeur.echelleVide}</p>
        : <ol class="echelle-liste">{etapes.map((id, i) => <li key={`${id}-${i}`}>
          <span class="echelle-num">{i + 1}</span>
          <strong>{nomExercice(trouverExercice(id)) || id}</strong>
          <span class="echelle-actions">
            {i > 0 && <Rond n="caret-up" label={tm6.editeur.monter} taille={34} onClick={() => deplacer(i, -1)} />}
            {i < etapes.length - 1 && <Rond n="caret-down" label={tm6.editeur.descendre} taille={34} onClick={() => deplacer(i, 1)} />}
            <Rond n="trash" label={tm6.editeur.retirer} taille={34} onClick={() => setEtapes((l) => l.filter((_, k) => k !== i))} />
          </span>
        </li>)}</ol>}
      <button type="button" class="ajout-serie" onClick={() => setChoix(true)}><Ic n="plus:bold" taille={14} />{tm6.editeur.ajouterEtape}</button>
      {etapes.length > 0 && <p class="muted petit-texte">{tm6.editeur.echelleAide}</p>}
    </div>
    <ChoixExercices ouverte={choix} fermer={() => setChoix(false)} unique choisir={(ids) => {
      setEtapes((l) => (l.includes(ids[0]) ? l : [...l, ids[0]])); setChoix(false);
    }} />
  </Feuille>;
}
