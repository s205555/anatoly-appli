/* Nutrition : store local + feuilles. Ne touche à aucun fichier partagé. */
import { computed } from '@preact/signals';
import { ALIMENTS } from '../../nutrition-donnees.js';
import { langue } from '../../i18n.js';
import { T, assurerNav } from '../../i18n/m09.js';
import { etat, afficher, routineSelonPlanDuJour, jourDe as jourSeance } from '../../donnees.js';
import { eauDuJour, eauMl, etatParDefaut, getRepasJour, jourDe, jourLocal, macrosJour, nutritionStore } from './store.js';

export { eauDuJour, eauMl, getRepasJour, jourDe, jourLocal, nutritionStore };

assurerNav();

/* ===== Catégories : icônes locales (SVG inline) ===== */
export const CAT_IC = {
  fruit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><path d="M12 6v6"/><path d="M9 12h6"/></svg>',
  veg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2v20"/><path d="M5 12h14"/><path d="M12 5c3 0 5 2 5 5s-2 5-5 5"/></svg>',
  legume: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="18" rx="5" ry="3"/><path d="M7 18c0-2.5 2-4 5-4s5 1.5 5 4"/></svg>',
  nut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3c-2 3-3 7-3 9"/><path d="M12 21c2-3 3-7 3-9"/><path d="M12 3v18"/></svg>',
  meat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"/><path d="M9 12h6"/><path d="M12 9v6"/></svg>',
  fish: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12c0 5 4 9 9 9s9-4 9-9"/><path d="M12 3v18"/><path d="M18 12l-6 6 6-6"/></svg>',
  egg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="12" rx="7" ry="9"/></svg>',
  dairy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9h18"/><path d="M7 9v12"/><path d="M17 9v12"/><ellipse cx="12" cy="6" rx="8" ry="4"/></svg>',
  grain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h16"/><path d="M7 20v-14"/><path d="M17 20v-14"/><path d="M9 6h6"/></svg>',
  bakery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 16c0-4 3-7 7-7h6c4 0 7 3 7 7"/><path d="M9 16v-6"/></svg>',
  oil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v18"/><ellipse cx="12" cy="12" rx="6" ry="4"/></svg>',
  pantry: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9h18"/><path d="M7 9v12"/><path d="M17 9v12"/><path d="M9 9v12"/></svg>',
  drink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h12"/><path d="M8 3v14"/><path d="M16 3v14"/><path d="M6 17h12"/></svg>',
  sauce: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v18"/><ellipse cx="12" cy="18" rx="7" ry="3"/></svg>',
  spice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1l2.1-2.1M17 7l2.1-2.1"/></svg>',
};

export const CAT_LABEL = {
  fruit: () => T().catFruit,
  veg: () => T().catVeg,
  meat: () => T().catMeat,
  fish: () => T().catFish,
  egg: () => T().catEgg,
  dairy: () => T().catDairy,
  grain: () => T().catGrain,
  bakery: () => T().catBakery,
  legume: () => T().catLegume,
  nut: () => T().catNut,
  oil: () => T().catOil,
  pantry: () => T().catPantry,
  drink: () => T().catDrink,
  sauce: () => T().catSauce,
  spice: () => T().catSpice,
};

/* ===== Utilitaires ===== */
const plier = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const scoreRecherche = (q, nom, cat) => {
  const n = plier(nom);
  const c = plier(cat);
  const p = plier(q);
  if (!p) return 0;
  if (n.startsWith(p)) return 1000 - n.length;
  if (n.includes(p)) return 500 - n.length;
  if (c.startsWith(p)) return 200;
  return 0;
};

/* Couleurs macros (GymMane NutritionColors) */
export const MACRO_COULEUR = {
  proteines: 'var(--accent)',     // #D9A184
  glucides: 'var(--warn)',        // #E0B15A
  lipides: 'var(--sage)',         // #8FA377
  eau: 'var(--info)',             // #7FA8C9
};

export const PORTION_LABEL = {
  unit: () => T().portUnit,
  slice: () => T().portSlice,
  scoop: () => T().portScoop,
  tbsp: () => T().portTbsp,
  tsp: () => T().portTsp,
  cup: () => T().portCup,
  glass: () => T().portGlass,
};

// Ordre de GymMane (FoodCat) et photo de chaque catégorie (_catSlug).
export const CATEGORIES_ORDRE = ['fruit', 'veg', 'meat', 'fish', 'egg', 'dairy', 'grain', 'bakery', 'legume', 'nut', 'oil', 'pantry', 'drink', 'sauce', 'spice'];
export const CAT_PHOTO = { fruit: 'banana', veg: 'broccoli', meat: 'chicken-breast', fish: 'salmon', egg: 'egg', dairy: 'greek-yogurt', grain: 'rolled-oats', bakery: 'bread', legume: 'lentils', nut: 'almonds', oil: 'olive-oil', pantry: 'honey', drink: 'orange-juice', sauce: 'ketchup', spice: 'cinnamon' };

/* ===== Catalogue calculé depuis ALIMENTS ===== */
export const catalogue = computed(() => {
  const a = ALIMENTS;
  const map = new Map();
  for (const row of a) {
    const [id, nomFr, nomEn, kcal, p, c, l, f, su, na, animal, sat, mono, poly, liq, kind, gPortion, cat, approx, rendement, aa] = row;
    map.set(id, {
      id, nomFr, nomEn, kcal: Number(kcal), p: Number(p), c: Number(c), l: Number(l), f: Number(f),
      su: Number(su), na: Number(na), animal: Number(animal), sat: Number(sat), mono: Number(mono), poly: Number(poly),
      liq: Number(liq), kind, gPortion: Number(gPortion), cat, approx: Number(approx), rendement: Number(rendement), aa: aa ? String(aa).split(',').map(Number) : null,
    });
  }
  return map;
});

export function getAliment(id) {
  const cat = catalogue.value;
  if (cat.has(id)) return cat.get(id);
  const pers = nutritionStore.value.alimentsPerso[id];
  if (pers) return { ...pers, id, perso: true };
  return null;
}

/* ===== Recherche ===== */
export function rechercherAliments(q, limite = 50) {
  const cat = catalogue.value;
  const t = T();
  const store = nutritionStore.value;
  const favoris = new Set(store.favoris);
  const recents = new Set(store.recents);
  const qp = plier(q);
  const out = [];
  for (const [id, a] of cat) {
    const nom = langue === 'en' ? a.nomEn : a.nomFr;
    const s = scoreRecherche(q, nom, CAT_LABEL[a.cat]?.() ?? '');
    if (s > 0 || !qp) out.push({ id, a, score: s + (favoris.has(id) ? 10000 : 0) + (recents.has(id) ? 5000 : 0) });
  }
  // Aliments perso
  for (const [id, a] of Object.entries(store.alimentsPerso)) {
    const s = scoreRecherche(q, a.nom, CAT_LABEL[a.cat]?.() ?? '');
    if (s > 0 || !qp) out.push({ id, a: { ...a, id, perso: true }, score: s + 1000 });
  }
  out.sort((x, y) => y.score - x.score);
  return out.slice(0, limite);
}

/* ===== Repas du jour ===== */
export function setRepasJour(jour, repas) {
  nutritionStore.value = {
    ...nutritionStore.value,
    ...(jour === nutritionStore.value.jourCourant ? { repas } : { jours: { ...nutritionStore.value.jours, [jour]: { ...nutritionStore.value.jours[jour], repas } } }),
  };
}

export function ajouterAuRepas(jour, repasKey, alimentId, grammes) {
  const rep = getRepasJour(jour);
  const a = getAliment(alimentId);
  if (!a) return;
  const facteur = grammes / 100;
  const entree = {
    id: crypto.randomUUID(),
    alimentId,
    nom: a.perso ? a.nom : (langue === 'en' ? a.nomEn : a.nomFr),
    g: Math.round(grammes),
    kcal: Math.round(a.kcal * facteur),
    p: Math.round(a.p * facteur * 10) / 10,
    c: Math.round(a.c * facteur * 10) / 10,
    l: Math.round(a.l * facteur * 10) / 10,
    f: Math.round((a.f || 0) * facteur * 10) / 10,
    // « Compte dans l'eau » : eau par portion × portions (nutrition.dart LoggedFood.waterMl).
    ...(a.eau > 0 ? { eau: Math.round(a.eau * grammes / (a.gPortion || 100)) } : {}),
  };
  setRepasJour(jour, { ...rep, [repasKey]: [...(rep[repasKey] || []), entree] });
  const store = nutritionStore.value;
  nutritionStore.value = { ...store, recents: [alimentId, ...store.recents.filter((x) => x !== alimentId)].slice(0, 20) };
}

export function supprimerEntree(jour, repasKey, entreeId) {
  const rep = getRepasJour(jour);
  setRepasJour(jour, { ...rep, [repasKey]: (rep[repasKey] || []).filter((e) => e.id !== entreeId) });
}

export function totauxSemaine() {
  const now = new Date();
  const lundi = new Date(now);
  lundi.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const jours = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(lundi);
    d.setDate(lundi.getDate() + i);
    jours.push(jourLocal(d));
  }
  return jours.map((j) => ({ jour: j, ...totalsJour(j) }));
}

export function totalsJour(jour = jourLocal()) {
  const rep = getRepasJour(jour);
  let sat = 0, mono = 0, poly = 0, su = 0, na = 0, aaTot = new Array(9).fill(0), aaProt = 0, pAnimal = 0, pVegetal = 0;
  for (const repas of Object.values(rep)) {
    for (const e of repas) {
      const a = getAliment(e.alimentId);
      if (a) {
        const fac = e.g / 100;
        if (a.animal) pAnimal += a.p * fac; else pVegetal += a.p * fac;
        sat += (a.sat || 0) * fac;
        mono += (a.mono || 0) * fac;
        poly += (a.poly || 0) * fac;
        su += (a.su || 0) * fac;
        na += (a.na || 0) * fac;
        if (a.aa) {
          for (let i = 0; i < 9; i++) aaTot[i] += a.aa[i] * a.p * fac;
          aaProt += a.p * fac;
        }
      }
    }
  }
  return { ...macrosJour(jour),
    sat: Math.round(sat * 10) / 10, mono: Math.round(mono * 10) / 10, poly: Math.round(poly * 10) / 10,
    su: Math.round(su * 10) / 10, na: Math.round(na * 10) / 10,
    aaTot, aaProt: Math.round(aaProt * 10) / 10, pAnimal: Math.round(pAnimal * 10) / 10, pVegetal: Math.round(pVegetal * 10) / 10,
  };
}

/* ===== Objectifs suggérés (portés de GymMane nutrition_state.dart) ===== */
const kAminoNeed = [15, 30, 59, 45, 22, 38, 23, 6, 39]; // His, Ile, Leu, Lys, Met+Cys, Phe+Tyr, Thr, Trp, Val (mg/g prot)

const FACTEUR_ACTIVITE = { sedentaire: 1.2, leger: 1.375, modere: 1.55, actif: 1.725, tres_actif: 1.9 };

export function dernierPoidsKg() {
  const poids = etat.value?.poids ?? [];
  return poids.length ? Number(poids.at(-1).kg) : null;
}

export function calculerObjectifsSuggeres() {
  const profil = etat.value?.profil ?? {};
  const kg = dernierPoidsKg() ?? 75;
  let tdee = 0;
  const fact = FACTEUR_ACTIVITE[profil.activite];
  if (profil.age && profil.tailleCm && kg) {
    const s = profil.sexe === 'f' ? -161 : 5;
    tdee = Math.round((10 * kg + 6.25 * profil.tailleCm - 5 * profil.age + s) * (fact ?? 1.55));
  }
  const base = tdee > 0 ? tdee : kg * 30;
  const butKg = nutritionStore.value.objectifs.poidsKg ?? kg;
  const aim = butKg - kg;
  const cutting = aim < -0.5;
  const bulking = aim > 0.5;
  const kcal = Math.max(1200, Math.min(9000, Math.round(base + (cutting ? -500 : bulking ? 300 : 0))));
  const p = Math.round(kg * (cutting ? 2.0 : 1.8));
  const l = Math.round(kg * 0.8);
  const c = Math.max(0, Math.round((kcal - p * 4 - l * 9) / 4));
  const eauMl = Math.max(1000, Math.min(6000, Math.round(kg * 35 / 250) * 250));
  const fibres = Math.max(15, Math.min(60, Math.round(kcal * 14 / 1000)));
  const satLim = Math.round(kcal * 0.1 / 9);
  return { kcal, p, c, l, eauMl, fibres, satLim };
}

export function getObjectifs(jour = null) {
  const store = nutritionStore.value;
  const obj = store.objectifs;
  // Chaque objectif non réglé reprend la valeur calculée depuis le profil (eau comprise quand seules les calories sont réglées).
  const base = { ...calculerObjectifsSuggeres(), ...Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null)) };
  // Jours de repos (goalsFor) : leurs propres calories et macros, l'eau et le reste ne changent pas.
  if (jour && obj.repos && !estJourEntrainement(jour)) return { ...base, ...obj.repos };
  return base;
}

/** Jour d'entraînement (isTrainingDay) : une séance ce jour-là, ou aujourd'hui avec un programme prévu. */
export function estJourEntrainement(jour) {
  if ((etat.value?.seances ?? []).some((s) => jourSeance(s.debut) === jour)) return true;
  return jour === jourLocal() && !!routineSelonPlanDuJour();
}

/** Objectifs des jours de repos (splitRestGoals) : 85 % des calories, la différence retirée des glucides. */
export function basculerObjectifsRepos(actif) {
  const g = getObjectifs();
  const kcal = Math.round((g.kcal * 0.85) / 10) * 10;
  sauverObjectifs({ repos: actif ? { kcal, p: g.p, c: Math.max(10, g.c - Math.round((g.kcal - kcal) / 4)), l: g.l } : null });
}

/** Énergie affichée : kcal ou kJ selon le réglage des objectifs. */
export const energie = (kcal) => (nutritionStore.value.objectifs.kj ? Math.round(kcal * 4.184) : Math.round(kcal));
export const uniteEnergie = () => (nutritionStore.value.objectifs.kj ? 'kJ' : 'kcal');

/* ===== Qualité protéines ===== */
export function calculerQualiteProteines(aaTot, aaProt) {
  if (aaProt <= 0) return { score: 0, limitant: null, couv: 0, scores: null };
  const scores = aaTot.map((v, i) => (v * 1000) / (aaProt * kAminoNeed[i]));
  const min = Math.min(...scores);
  const score = Math.max(0, Math.min(1, min));
  let limitant = null;
  if (score < 1) {
    const idx = scores.indexOf(min);
    const noms = ['Histidine', 'Isoleucine', 'Leucine', 'Lysine', 'Méthionine+Cystéine', 'Phénylalanine+Tyrosine', 'Thréonine', 'Tryptophane', 'Valine'];
    limitant = noms[idx];
  }
  return { score, limitant, couv: Math.min(100, Math.round((aaProt > 0 ? (aaTot.reduce((s, v) => s + v, 0) / aaProt) * 100 : 0))), scores };
}

export function labelQualite(score) {
  const t = T();
  if (score >= 0.95) return t.complet;
  if (score >= 0.75) return t.presque;
  return t.incomplet;
}

/* ===== Types de lipides ===== */
export function getLipidesDetail() {
  const t = totalsJour();
  return { sat: t.sat, mono: t.mono, poly: t.poly, trans: 0 }; // trans pas dans données
}

/* ===== Eau : prises du jour { ml, at } ===== */
export function eauObjectifMl() {
  return getObjectifs().eauMl;
}
export const verreMl = () => nutritionStore.value.eau.verreMl || 250;
export function eauProgression(jour = jourLocal()) {
  const obj = eauObjectifMl();
  return obj > 0 ? Math.min(1, eauMl(jour) / obj) : 0;
}
// L'ancien compteur de verres devient des prises, pour qu'un changement de taille du verre ne réécrive pas le passé.
const prisesDe = (e) => [...(e.prises || []), ...Array.from({ length: e.verres || 0 }, () => ({ ml: e.verreMl || 250, at: null }))];
function ecrireEau(jour, eau) {
  const s = nutritionStore.value;
  nutritionStore.value = jour === s.jourCourant ? { ...s, eau } : { ...s, jours: { ...s.jours, [jour]: { ...s.jours[jour], eau } } };
}
export function ajouterEau(ml = verreMl(), jour = jourLocal()) {
  const e = eauDuJour(jour);
  ecrireEau(jour, { ...e, verres: 0, prises: [...prisesDe(e), { ml: Math.round(ml), at: new Date().toISOString() }] });
}
export function retirerPrise(index, jour = jourLocal()) {
  const e = eauDuJour(jour);
  ecrireEau(jour, { ...e, verres: 0, prises: prisesDe(e).filter((_, i) => i !== index) });
}
export const prisesEau = (jour = jourLocal()) => prisesDe(eauDuJour(jour));
export function reglerVerre(ml) {
  const s = nutritionStore.value;
  nutritionStore.value = { ...s, eau: { ...s.eau, verres: 0, prises: prisesDe(s.eau), verreMl: ml } };
}

/* ===== Shake : aliments marqués comme shake ===== */
export const shakes = () => nutritionStore.value.shakes.map(getAliment).filter(Boolean);
export const estShake = (id) => nutritionStore.value.shakes.includes(id);
export function getShake() {
  const s = nutritionStore.value;
  return s.shakeId && s.shakes.includes(s.shakeId) ? getAliment(s.shakeId) : null;
}
export function choisirShake(id) {
  nutritionStore.value = { ...nutritionStore.value, shakeId: id };
}
export function marquerShake(id, oui) {
  const s = nutritionStore.value;
  const liste = s.shakes.filter((x) => x !== id);
  nutritionStore.value = { ...s, shakes: oui ? [...liste, id] : liste, shakeId: oui ? (s.shakeId ?? id) : s.shakeId === id ? null : s.shakeId };
}

/* ===== Repas : heure, ajout rapide, reprise et déplacement ===== */
/** Repas ouvert par défaut (mealForHour) : petit-déjeuner, déjeuner dès 11 h, en-cas dès 16 h, dîner dès 18 h ; un autre jour, le déjeuner. */
export function repasDeLHeure(jour = jourLocal(), heure = new Date().getHours()) {
  if (jour !== jourLocal()) return 'dejeuner';
  return heure >= 18 ? 'diner' : heure >= 16 ? 'collations' : heure >= 11 ? 'dejeuner' : 'petit-dejeuner';
}

/** Ajout rapide (logQuick) : juste des chiffres, sans aliment enregistré. */
export function ajoutRapide(jour, repasKey, nom, m) {
  const r1 = (x) => Math.round(x * 10) / 10;
  const kcal = m.kcal > 0 ? m.kcal : m.p * 4 + m.c * 4 + m.l * 9;
  if (!(kcal > 0)) return null;
  const rep = getRepasJour(jour);
  const entree = { id: crypto.randomUUID(), alimentId: '', nom: nom.trim(), g: 0, kcal: Math.round(kcal), p: r1(m.p), c: r1(m.c), l: r1(m.l), f: 0, at: new Date().toISOString() };
  setRepasJour(jour, { ...rep, [repasKey]: [...(rep[repasKey] || []), entree] });
  return entree;
}

/** Autres jours où ce repas (ou, sans repas, la journée) a des aliments, du plus récent au plus ancien (daysWithMeal). */
export function joursAvecRepas(repasKey, jour = jourLocal(), max = 7) {
  const s = nutritionStore.value;
  const tous = [s.jourCourant, ...Object.keys(s.jours)].filter((j, i, a) => j !== jour && a.indexOf(j) === i).sort().reverse();
  const rep = (j) => (repasKey ? getRepasJour(j)[repasKey] || [] : Object.values(getRepasJour(j)).flat());
  return tous.filter((j) => rep(j).length > 0).slice(0, max);
}

/** Reprend le repas d'un autre jour (copyMeal) ; renvoie les entrées ajoutées. */
export function copierRepas(depuis, repasKey, jour = jourLocal()) {
  const ajout = (getRepasJour(depuis)[repasKey] || []).map((e) => ({ ...e, id: crypto.randomUUID() }));
  const rep = getRepasJour(jour);
  setRepasJour(jour, { ...rep, [repasKey]: [...(rep[repasKey] || []), ...ajout] });
  return ajout;
}

/** Déplace tout un repas vers un autre (moveMeal). */
export function deplacerRepas(jour, de, vers) {
  const rep = getRepasJour(jour);
  const bouge = rep[de] || [];
  if (!bouge.length || de === vers) return [];
  setRepasJour(jour, { ...rep, [de]: [], [vers]: [...(rep[vers] || []), ...bouge] });
  return bouge;
}

/* ===== Compléments : complements.js (liste sur le compte, dose, unité, stock) ===== */
export { ajouterComplement, complementsDuJour, modifierComplement, supprimerComplement, toggleComplement } from './complements.js';

/* ===== Jeûne ===== */
export function jeuneEtat() {
  const s = nutritionStore.value.jeune;
  if (!s.actif || !s.debut) return { actif: false };
  const debut = new Date(s.debut);
  const fin = new Date(debut.getTime() + s.butH * 3600000);
  const now = new Date();
  if (now >= fin) {
    // auto-terminer
    nutritionStore.value = { ...nutritionStore.value, jeune: { ...s, actif: false, demarreLe: null } };
    return { actif: false };
  }
  const total = s.butH * 3600000;
  const elapsed = now - debut;
  const part = Math.max(0, Math.min(1, elapsed / total));
  const resteMs = fin - now;
  const h = Math.floor(resteMs / 3600000);
  const m = Math.floor((resteMs % 3600000) / 60000);
  return { actif: true, part, reste: `${h}h${String(m).padStart(2, '0')}`, debut, fin, butH: s.butH };
}

export function demarrerJeune(butH = 16) {
  const now = new Date();
  nutritionStore.value = { ...nutritionStore.value, jeune: { actif: true, debut: now.toISOString(), fin: null, butH, demarreLe: jourLocal(now) } };
}

export function terminerJeune() {
  nutritionStore.value = { ...nutritionStore.value, jeune: { ...nutritionStore.value.jeune, actif: false, fin: new Date().toISOString() } };
}

/* ===== Aliments perso ===== */
export function creerAlimentPerso(data) {
  const id = `perso_${crypto.randomUUID().slice(0, 8)}`;
  const store = nutritionStore.value;
  nutritionStore.value = { ...store, alimentsPerso: { ...store.alimentsPerso, [id]: data } };
  return id;
}
export function modifierAlimentPerso(id, data) {
  const store = nutritionStore.value;
  if (!store.alimentsPerso[id]) return;
  nutritionStore.value = { ...store, alimentsPerso: { ...store.alimentsPerso, [id]: { ...store.alimentsPerso[id], ...data } } };
}
export function supprimerAlimentPerso(id) {
  const store = nutritionStore.value;
  const nv = { ...store.alimentsPerso };
  delete nv[id];
  nutritionStore.value = { ...store, alimentsPerso: nv };
}

/* ===== Plats prêts ===== */
export function creerPlatPerso(data) {
  const id = `plat_${crypto.randomUUID().slice(0, 8)}`;
  const store = nutritionStore.value;
  nutritionStore.value = { ...store, platsPerso: { ...store.platsPerso, [id]: data } };
  return id;
}
export function getPlatPerso(id) {
  return nutritionStore.value.platsPerso[id] || null;
}

/* ===== Favoris ===== */
export function toggleFavori(id) {
  const store = nutritionStore.value;
  const fav = new Set(store.favoris);
  if (fav.has(id)) fav.delete(id); else fav.add(id);
  nutritionStore.value = { ...store, favoris: [...fav] };
}

/* Rotation à minuit : verifierJour dans store.js (le compte peut arriver avec un ancien jour). */

/* ===== Persistance objectifs ===== */
export function sauverObjectifs(obj) {
  const store = nutritionStore.value;
  nutritionStore.value = { ...store, objectifs: { ...store.objectifs, ...obj } };
}

/* ===== Import / Export (pour debug) ===== */
export function exporterNutrition() {
  return JSON.stringify(nutritionStore.value, null, 2);
}
export function importerNutrition(json) {
  try {
    const data = JSON.parse(json);
    nutritionStore.value = { ...etatParDefaut(), ...data };
    afficher('Données nutrition importées', 'ok');
  } catch {
    afficher('Import invalide', 'danger');
  }
}