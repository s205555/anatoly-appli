// Magasin de la nutrition, séparé du catalogue d'aliments pour que l'accueil ne charge pas les 80 Ko de données.
// Les données vivent sur le compte (extensions.modules) pour suivre l'utilisateur d'un appareil à l'autre ;
// ce qui était gardé sur l'appareil (localStorage) y est recopié une fois, puis effacé de l'appareil.
import { signal, effect, untracked } from '@preact/signals';
import { etat, lireModule, ecrireModule } from '../../donnees.js';
import { assurerNav } from '../../i18n/m09.js';

assurerNav();

/* ===== Modules du compte et anciennes clés locales ===== */
export const MODULES_NUTRITION = {
  nutrition: 'an_nutrition',
  nutritionPlans: 'an_nutrition_plans',
  nutritionArchives: 'an_nutrition_plans_archives',
  nutritionSemaine: 'an_nutrition_semaine',
  nutritionLots: 'an_nutrition_lots',
  nutritionRecettes: 'an_nutrition_recettes',
  nutritionFavoris: 'an_nutrition_favoris',
  nutritionSuivis: 'an_nutrition_suivis',
};

export const lireLocal = (cle) => { try { return JSON.parse(localStorage.getItem(cle)); } catch { return null; } };

let enAttente = 0;
/** Écrit un module nutrition sur le compte ; tant que le compte n'est pas chargé, garde la valeur sur l'appareil (reprise ensuite). */
export function ecrireNutrition(mod, valeur) {
  if (!etat.value) { try { localStorage.setItem(MODULES_NUTRITION[mod], JSON.stringify(valeur)); } catch { /* stockage indisponible */ } return; }
  enAttente++;
  ecrireModule(mod, valeur).catch(() => {}).finally(() => { enAttente--; });
}

/** Valeur d'un module nutrition : celle du compte, sinon celle encore gardée sur l'appareil (avant reprise). */
export const lireNutrition = (mod, defaut) => lireModule(mod) ?? lireLocal(MODULES_NUTRITION[mod]) ?? defaut;

// Reprise unique : chaque clé locale part sur le compte s'il n'a rien pour ce module, puis quitte l'appareil une fois l'envoi accepté.
const repris = new Set();
effect(() => {
  const e = etat.value;
  if (!e) return;
  const modules = e.profil?.extensions?.modules || {};
  for (const [mod, cle] of Object.entries(MODULES_NUTRITION)) {
    if (repris.has(mod)) continue;
    const local = lireLocal(cle);
    if (local == null) continue;
    repris.add(mod);
    if (modules[mod] != null) { try { localStorage.removeItem(cle); } catch { /* indisponible */ } continue; }
    untracked(() => ecrireModule(mod, local))
      .then(() => { try { localStorage.removeItem(cle); } catch { /* indisponible */ } })
      .catch(() => repris.delete(mod));
  }
});

/* ===== Magasin du jour (module « nutrition ») ===== */
export function etatParDefaut() {
  return {
    version: 1,
    jourCourant: jourLocal(new Date()),
    repas: { 'petit-dejeuner': [], dejeuner: [], diner: [], collations: [] },
    eau: { verres: 0, verreMl: 250, prises: [] }, // prises : [{ ml, at }] ; verres = ancien compteur
    shakes: [],        // ids d'aliments marqués comme shake
    shakeId: null,     // shake choisi pour la carte
    complements: [],   // cases du jour : { id, pris }
    jeune: { actif: false, debut: null, fin: null, butH: 16, demarreLe: null },
    alimentsPerso: {}, // id -> { nom, kcal, p, c, l, f, su, na, sat, trans, mono, poly, gPortion, portion, cat, photo, approx }
    platsPerso: {},
    objectifs: { poidsKg: null, kcal: null, p: null, c: null, l: null, eauMl: null, fibres: null, satLim: null, repos: null, ajouterBrule: false, kj: false },
    favoris: [],
    recents: [],
    jours: {},         // jourLocal -> { repas, eau, complements, jeune }
  };
}

function normaliser(parsed) {
  const def = etatParDefaut();
  if (!parsed || typeof parsed !== 'object') return def;
  return { ...def, ...parsed, repas: { ...def.repas, ...parsed.repas }, eau: { ...def.eau, ...parsed.eau, prises: parsed.eau?.prises || [] }, complements: parsed.complements || [], objectifs: { ...def.objectifs, ...parsed.objectifs }, favoris: parsed.favoris || [], recents: parsed.recents || [], jours: parsed.jours || {}, alimentsPerso: parsed.alimentsPerso || {}, platsPerso: parsed.platsPerso || {}, shakes: parsed.shakes || [], jeune: { ...def.jeune, ...parsed.jeune } };
}

let recu = normaliser(lireNutrition('nutrition', null)); // dernière valeur venue du compte (ou de l'appareil) : ne pas la renvoyer
export const nutritionStore = signal(recu);

effect(() => {
  const v = nutritionStore.value;
  if (v === recu) return;
  untracked(() => ecrireNutrition('nutrition', v)); // l'écriture lit et change etat : hors suivi, sinon l'effet boucle
});

// Le compte fait foi : au chargement ou quand un autre appareil a écrit, l'écran suit (sauf pendant nos propres envois).
let vu;
effect(() => {
  const m = lireModule('nutrition');
  if (m == null || m === vu) return;
  vu = m;
  if (m === nutritionStore.peek() || enAttente > 0) return;
  recu = normaliser(m);
  nutritionStore.value = recu;
  verifierJour();
});

/* ===== Helpers jour ===== */
export function jourLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function jourDe(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return jourLocal(d);
}

export function getRepasJour(jour = jourLocal()) {
  const store = nutritionStore.value;
  if (jour === store.jourCourant) return store.repas;
  const hist = store.jours[jour];
  return hist?.repas || { 'petit-dejeuner': [], dejeuner: [], diner: [], collations: [] };
}

/** Eau du jour : les prises notées, plus l'ancien compteur de verres. */
export function eauDuJour(jour = jourLocal()) {
  const store = nutritionStore.value;
  return (jour === store.jourCourant ? store.eau : store.jours[jour]?.eau) || { verres: 0, verreMl: store.eau.verreMl, prises: [] };
}
export function eauMl(jour = jourLocal()) {
  const e = eauDuJour(jour);
  // Plus l'eau des aliments qui comptent dans l'eau (waterFromFoodOn).
  let aliments = 0;
  for (const repas of Object.values(getRepasJour(jour))) for (const x of repas) aliments += x.eau > 0 ? x.eau : 0;
  return (e.prises || []).reduce((s, p) => s + (p.ml || 0), 0) + (e.verres || 0) * (e.verreMl || 250) + aliments;
}

/** Kcal et macros d'un jour, sommés depuis les entrées des repas (sans le catalogue d'aliments). */
export function macrosJour(jour = jourLocal()) {
  let kcal = 0, p = 0, c = 0, l = 0, f = 0;
  for (const repas of Object.values(getRepasJour(jour))) {
    for (const e of repas) { kcal += e.kcal; p += e.p; c += e.c; l += e.l; f += e.f; }
  }
  const r1 = (x) => Math.round(x * 10) / 10;
  return { kcal, p: r1(p), c: r1(c), l: r1(l), f: r1(f) };
}

/* ===== Jour courant : rotation à minuit ===== */
export function verifierJour() {
  const store = nutritionStore.value;
  const aujourdhui = jourLocal();
  if (store.jourCourant === aujourdhui) return;
  const hist = { ...store.jours, [store.jourCourant]: { repas: store.repas, eau: store.eau, complements: store.complements, jeune: store.jeune } };
  const def = etatParDefaut();
  nutritionStore.value = {
    ...store,
    jourCourant: aujourdhui,
    repas: hist[aujourdhui]?.repas ?? def.repas, // repas déjà notés pour ce jour (demain depuis la préparation)
    eau: { ...def.eau, verreMl: store.eau.verreMl || 250 }, // la taille du verre est un réglage, pas une donnée du jour
    complements: (store.complements || []).map((c) => ({ ...c, pris: false })), // cases décochées
    jours: hist,
  };
}
if (typeof window !== 'undefined') {
  verifierJour();
  setInterval(verifierJour, 60000);
}
