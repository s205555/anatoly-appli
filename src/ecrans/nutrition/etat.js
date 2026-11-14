// Données et calculs partagés par les écrans M10 (plans de repas et meal prep), sur le compte (extensions.modules).
// Les entrées notées vont dans les repas du magasin du jour, celui que lit l'écran Jour (logFromBatch de GymMane).
import { effect, signal, untracked } from '@preact/signals';
import { langue } from '../../i18n.js';
import { etat } from '../../donnees.js';
import { ALIMENTS, PLATS } from './donnees.js';
import { getAliment, getRepasJour, setRepasJour } from './aliments.jsx';
import { ecrireNutrition, lireNutrition } from './store.js';

// Module du compte pour chaque donnée (ancienne clé locale dans MODULES_NUTRITION, reprise par store.js).
const CLES = {
  plans: 'nutritionPlans',
  archives: 'nutritionArchives',
  semaine: 'nutritionSemaine',
  lots: 'nutritionLots',
  recettes: 'nutritionRecettes',
  favoris: 'nutritionFavoris',
};
const JOURNAL = 'an_nutrition_journal'; // ancien journal séparé, vidé dans les repas du jour une fois le compte chargé

// Incrémenté à chaque écriture : les écrans lisent version.value pour se redessiner.
export const version = signal(0);

// Copie : les appelants modifient la liste lue avant de la réécrire, l'objet du compte ne doit pas bouger avant l'envoi.
const lire = (mod, defaut) => { const v = lireNutrition(mod, defaut); return Array.isArray(v) ? [...v] : v && typeof v === 'object' ? { ...v } : v; };
const ecrire = (mod, valeur) => {
  ecrireNutrition(mod, valeur);
  version.value++; // redessine les écrans qui lisent version.value
};

export const REPAS = ['petitDejeuner', 'dejeuner', 'diner', 'collations'];

// ===== Aliments et plats =====
const COL = ['slug', 'fr', 'en', 'kcal', 'prot', 'gluc', 'lip', 'fibres', 'sucres', 'sodium', 'portion', 'grammesPortion', 'cat', 'liquide', 'rendement'];
export const ALIMENTS_OBJ = ALIMENTS.map((r) => Object.fromEntries(COL.map((c, i) => [c, r[i]])));
const PAR_SLUG = new Map(ALIMENTS_OBJ.map((a) => [a.slug, a]));

export const aliment = (slug) => PAR_SLUG.get(slug) ?? null;
export const nomAliment = (a) => (a ? (langue === 'en' ? a.en : a.fr) || a.en : '');
export const photoAliment = (slug) => `/statique/nutrition/${slug}.webp`;

const plier = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function chercherAliments(texte, limite = 60) {
  const mots = plier(texte.trim()).split(/\s+/).filter(Boolean);
  if (!mots.length) return ALIMENTS_OBJ.slice(0, limite);
  const score = (a) => {
    const nom = plier(nomAliment(a));
    const hay = `${nom} ${plier(a.en)}`;
    if (!mots.every((m) => hay.includes(m))) return -1;
    return nom === mots[0] ? 0 : nom.startsWith(mots[0]) ? 1 : 2;
  };
  return ALIMENTS_OBJ
    .map((a) => [score(a), a])
    .filter(([s]) => s >= 0)
    .sort((x, y) => x[0] - y[0] || nomAliment(x[1]).length - nomAliment(y[1]).length)
    .slice(0, limite)
    .map(([, a]) => a);
}

export const PLATS_OBJ = PLATS.map(([id, en, es, items]) => ({
  id,
  nom: langue === 'en' ? en : en, // les plats n'ont pas de nom français dans la source GymMane
  nomEn: en,
  items: items.split(' ').filter((p) => p.includes(':')).map((p) => {
    const [slug, montant] = p.split(':');
    const cuit = montant.endsWith('c');
    return { slug, grammes: Number(montant.replace('c', '')) || 0, cuit };
  }).filter((x) => aliment(x.slug)),
}));

// ===== Modèles =====
// Entrée : { id, date, repas, alimentId, nom, grammes, portions, liquide, cuit, macros:{k,p,c,f} }
export const entreeDepuisAliment = (a, repas, grammes = null) => ({
  id: nouvelId(),
  date: null,
  repas,
  alimentId: a.slug,
  nom: nomAliment(a),
  grammes: grammes ?? 100,
  portions: 1,
  liquide: !!a.liquide,
  cuit: false,
  macros: { k: a.kcal, p: a.prot, c: a.gluc, f: a.lip },
});

/** Élément de recette : aliment de la bibliothèque, ou aliment gardé avec ses valeurs (réponse d'une IA). */
export const entreeDepuisItem = (it, repas = null) => (it.slug && aliment(it.slug)
  ? entreeDepuisAliment(aliment(it.slug), repas, it.grammes)
  : { id: nouvelId(), date: null, repas, alimentId: '', nom: it.nom ?? '', grammes: it.grammes ?? 0, portions: 1, liquide: !!it.liquide, cuit: false, macros: { k: 0, p: 0, c: 0, f: 0, ...(it.macros || {}) } });

export const macrosEntree = (e) => ({
  k: (e.macros?.k ?? 0) * (e.portions ?? 1),
  p: (e.macros?.p ?? 0) * (e.portions ?? 1),
  c: (e.macros?.c ?? 0) * (e.portions ?? 1),
  f: (e.macros?.f ?? 0) * (e.portions ?? 1),
});

export const totalMacros = (liste) => liste.reduce((s, e) => {
  const m = macrosEntree(e);
  return { k: s.k + m.k, p: s.p + m.p, c: s.c + m.c, f: s.f + m.f };
}, { k: 0, p: 0, c: 0, f: 0 });

export const grammesEntree = (e) => (e.grammes || 0) * (e.portions ?? 1);

export const nouvelId = () => `m10-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const dateISO = (d = new Date()) => {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};

// 1 = lundi … 7 = dimanche. jourDecale(-1) = hier, (0) = aujourd'hui, (1) = demain.
export const jourSemaine = () => ((new Date().getDay() + 6) % 7) + 1;
export const jourDecale = (j) => { const d = new Date(); d.setDate(d.getDate() + j); return dateISO(d); };

// ===== Plans =====
export const plans = () => lire(CLES.plans, []);
export const plansArchives = () => lire(CLES.archives, []);
export const planParId = (id) => plans().find((p) => p.id === id) ?? null;
export const macrosPlan = (p) => totalMacros(p?.elements ?? []);
export const elementsRepas = (p, repas) => (p?.elements ?? []).filter((e) => e.repas === repas);

export function sauverPlan(plan, joursSemaine) {
  const liste = plans();
  const i = liste.findIndex((p) => p.id === plan.id);
  if (i < 0) liste.push(plan); else liste[i] = plan;
  ecrire(CLES.plans, liste);
  if (joursSemaine) {
    const semaine = semainePlans();
    for (let j = 1; j <= 7; j++) {
      if (joursSemaine.includes(j)) semaine[j] = plan.id;
      else if (semaine[j] === plan.id) delete semaine[j];
    }
    ecrire(CLES.semaine, semaine);
  }
  return plan;
}

export function supprimerPlan(id) {
  ecrire(CLES.plans, plans().filter((p) => p.id !== id));
  ecrire(CLES.archives, plansArchives().filter((x) => x !== id));
  const semaine = semainePlans();
  for (const j of Object.keys(semaine)) if (semaine[j] === id) delete semaine[j];
  ecrire(CLES.semaine, semaine);
}

export function dupliquerPlan(id) {
  const p = planParId(id);
  if (!p) return null;
  const copie = { ...p, id: nouvelId(), nom: `${p.nom} (copie)`.slice(0, 80), elements: p.elements.map((e) => ({ ...e, id: nouvelId(), date: null })) };
  const liste = plans();
  liste.splice(liste.findIndex((x) => x.id === id) + 1, 0, copie);
  ecrire(CLES.plans, liste);
  return copie;
}

export function deplacerPlan(id, sens) {
  const liste = plans();
  const i = liste.findIndex((p) => p.id === id);
  const j = i + sens;
  if (i < 0 || j < 0 || j >= liste.length) return;
  [liste[i], liste[j]] = [liste[j], liste[i]];
  ecrire(CLES.plans, liste);
}

export function archiverPlan(id, archive) {
  const liste = plansArchives();
  if (archive && !liste.includes(id)) liste.push(id);
  if (!archive) {
    const i = liste.indexOf(id);
    if (i >= 0) liste.splice(i, 1);
  }
  ecrire(CLES.archives, liste);
  if (archive) {
    const semaine = semainePlans();
    for (const j of Object.keys(semaine)) if (semaine[j] === id) delete semaine[j];
    ecrire(CLES.semaine, semaine);
  }
}

// ===== Semaine =====
export const semainePlans = () => lire(CLES.semaine, {});
export const planDuJour = (jour) => {
  const id = semainePlans()[jour];
  return id ? planParId(id) : null;
};
export const joursDuPlan = (id) => Object.entries(semainePlans()).filter(([, x]) => x === id).map(([j]) => Number(j));
export function affecterJour(jour, id) {
  const semaine = semainePlans();
  if (id) semaine[jour] = id; else delete semaine[jour];
  ecrire(CLES.semaine, semaine);
}

// ===== Lots (meal prep) =====
export const lots = () => lire(CLES.lots, []);
export const lotParId = (id) => lots().find((b) => b.id === id) ?? null;
export const macrosLot = (b) => totalMacros(b?.elements ?? []);
export const poidsCru = (b) => (b?.elements ?? []).reduce((s, e) => s + grammesEntree(e), 0);
export const poidsTotal = (b) => (b?.poidsCuit > 0 ? b.poidsCuit : poidsCru(b));
export const par100 = (b) => {
  const total = poidsTotal(b);
  if (!(total > 0)) return { k: 0, p: 0, c: 0, f: 0 };
  const m = macrosLot(b);
  const k = 100 / total;
  return { k: m.k * k, p: m.p * k, c: m.c * k, f: m.f * k };
};

export function sauverLot(lot) {
  if (!lot.elements.length) return null;
  if (!(poidsTotal(lot) > 0)) return null;
  const liste = lots();
  const i = liste.findIndex((b) => b.id === lot.id);
  const reste = Math.min(lot.reste ?? poidsTotal(lot), poidsTotal(lot));
  const propre = { ...lot, reste };
  if (i < 0) liste.push(propre); else liste[i] = propre;
  ecrire(CLES.lots, liste);
  return propre;
}

export function supprimerLot(id) {
  ecrire(CLES.lots, lots().filter((b) => b.id !== id));
}

export function modifierLot(id, champs) {
  const liste = lots();
  const i = liste.findIndex((b) => b.id === id);
  if (i < 0) return null;
  liste[i] = { ...liste[i], ...champs };
  ecrire(CLES.lots, liste);
  return liste[i];
}

// ===== Journal des entrées notées (repas du Jour, an_nutrition) =====
// Clés de repas M10 vers les clés du Jour.
const REPAS_JOUR = { petitDejeuner: 'petit-dejeuner', dejeuner: 'dejeuner', diner: 'diner', collations: 'collations' };
const REPAS_M10 = Object.fromEntries(Object.entries(REPAS_JOUR).map(([a, b]) => [b, a]));
const r1 = (x) => Math.round(x * 10) / 10;

// Entrée M10 { macros:{k,p,c,f=lipides}, grammes, portions } vers entrée du Jour { g, kcal, p, c, l, f=fibres }.
export function versEntreeJour(e) {
  const m = macrosEntree(e);
  const g = grammesEntree(e);
  const fibres = e.alimentId ? (getAliment(e.alimentId)?.f ?? 0) * (g / 100) : 0;
  return { id: e.id || nouvelId(), alimentId: e.alimentId || '', nom: e.nom ?? '', g: Math.round(g), kcal: Math.round(m.k), p: r1(m.p), c: r1(m.c), l: r1(m.f), f: r1(fibres) };
}

export const entreesJour = (date) => Object.entries(getRepasJour(date))
  .flatMap(([cle, liste]) => (liste ?? []).map((e) => ({ ...e, repas: REPAS_M10[cle] ?? cle })));

export function noterEntrees(date, entrees) {
  const rep = { ...getRepasJour(date) };
  for (const e of entrees) {
    const cle = REPAS_JOUR[e.repas] ?? e.repas ?? 'collations';
    rep[cle] = [...(rep[cle] ?? []), versEntreeJour({ ...e, id: nouvelId() })];
  }
  setRepasJour(date, rep);
  version.value++;
  return entrees.length;
}

// Ancien journal séparé : ses entrées passent une fois dans les repas du jour (donc sur le compte), puis la clé disparaît.
let journalRepris = false;
effect(() => {
  if (!etat.value || journalRepris) return;
  journalRepris = true;
  let ancien = null;
  try { ancien = JSON.parse(localStorage.getItem(JOURNAL)); } catch { /* stockage indisponible */ }
  if (!ancien || typeof ancien !== 'object') return;
  // Les portions de fournée y étaient divisées au lieu de multipliées : macros notées = p100 / part, la bonne valeur est p100 * part.
  const corriger = (e) => {
    if (!e.cuit || e.alimentId) return e;
    const part = (e.grammes || 0) / 100, f = part * part;
    const m = e.macros ?? {};
    return { ...e, macros: { k: (m.k ?? 0) * f, p: (m.p ?? 0) * f, c: (m.c ?? 0) * f, f: (m.f ?? 0) * f } };
  };
  untracked(() => { for (const [date, liste] of Object.entries(ancien)) if (Array.isArray(liste) && liste.length) noterEntrees(date, liste.map(corriger)); });
  try { localStorage.removeItem(JOURNAL); } catch { /* stockage indisponible */ }
});

// Note les repas du plan encore vides pour la date. Renvoie le nombre d'aliments notés.
export function noterJourDuPlan(plan, date) {
  const dejaNotes = new Set(entreesJour(date).map((e) => e.repas));
  const aNoter = [];
  for (const repas of REPAS) {
    if (dejaNotes.has(repas)) continue;
    for (const e of elementsRepas(plan, repas)) aNoter.push({ ...e, id: nouvelId(), date });
  }
  if (aNoter.length) noterEntrees(date, aNoter);
  return aNoter.length;
}

// ===== Recettes enregistrées et favoris =====
export const recettes = () => lire(CLES.recettes, []);
export const recetteParId = (id) => recettes().find((r) => r.id === id) ?? null;
export function sauverRecette(recette) {
  const liste = recettes();
  const i = liste.findIndex((r) => r.id === recette.id);
  if (i < 0) liste.push(recette); else liste[i] = recette;
  ecrire(CLES.recettes, liste);
  return recette;
}
export function supprimerRecette(id) {
  ecrire(CLES.recettes, recettes().filter((r) => r.id !== id));
}

export const favoris = () => lire(CLES.favoris, []);
// Renvoie true si l'aliment est désormais favori.
export function basculerFavori(slug) {
  const liste = favoris();
  const i = liste.indexOf(slug);
  if (i >= 0) liste.splice(i, 1); else liste.push(slug);
  ecrire(CLES.favoris, liste);
  return i < 0;
}

// Note une portion d'un lot : part du poids restant, au prorata des macros pour 100 g.
export function noterDepuisLot(lot, grammes, repas, date) {
  const pris = Math.min(grammes, lot.reste);
  if (!(pris > 0)) return null;
  const p100 = par100(lot);
  const part = pris / 100;
  const entree = {
    id: nouvelId(),
    date,
    repas,
    alimentId: '',
    nom: lot.nom,
    grammes: pris,
    portions: 1,
    liquide: false,
    cuit: true,
    macros: { k: p100.k * part, p: p100.p * part, c: p100.c * part, f: p100.f * part },
  };
  noterEntrees(date, [entree]);
  modifierLot(lot.id, { reste: Math.max(0, lot.reste - pris) });
  return entree;
}
