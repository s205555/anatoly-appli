// Compléments : dose chiffrée, unité et stock (GymMane d224b6a et 60ee4c0, models/nutrition.dart Supplement).
// La liste vit sur le compte (extensions.modules.complements) ; la case « pris » du jour suit le magasin du jour (module « nutrition » du compte).
import { ecrireModule, lireModule } from '../../donnees.js';
import { langue } from '../../i18n.js';
import { jourLocal, nutritionStore } from './store.js';

export const UNITES_SUPP = ['capsule', 'pill', 'scoop', 'g', 'mg', 'ml', 'drop', 'iu', 'serving'];
const MOTS = {
  capsule: ['capsule', 'capsules', 'caps', 'cap', 'gelule', 'gelules', 'gélule', 'gélules'],
  pill: ['pill', 'pills', 'tablet', 'tablets', 'tab', 'tabs', 'comprime', 'comprimes', 'comprimé', 'comprimés', 'cachet', 'cachets'],
  scoop: ['scoop', 'scoops', 'mesurette', 'mesurettes', 'dosette', 'dosettes'],
  g: ['g', 'gr', 'grs', 'gram', 'grams', 'gramme', 'grammes'],
  mg: ['mg'],
  ml: ['ml'],
  drop: ['drop', 'drops', 'goutte', 'gouttes'],
  iu: ['iu', 'ui'],
  serving: ['serving', 'servings', 'portion', 'portions'],
};

/** Lit une dose écrite à la main (« 5 g », « 2 gélules ») : { quantite, unite } ou null (parseSuppDose). */
export function lireDose(texte) {
  const m = /^(\d+(?:[.,]\d+)?)\s*([^\d\s].*)?$/.exec(String(texte ?? '').trim().toLowerCase());
  if (!m) return null;
  const quantite = Number(m[1].replace(',', '.'));
  if (!(quantite > 0)) return null;
  const mot = (m[2] ?? '').trim();
  if (!mot) return { quantite, unite: '' };
  for (const [u, l] of Object.entries(MOTS)) if (l.includes(mot)) return { quantite, unite: u };
  return null;
}

/** Définition propre d'un complément (sans la case du jour) ; une ancienne dose en texte devient quantité et unité si elle se lit. */
export function definition(c) {
  const q = Number(c.quantite);
  const lu = c.quantite == null ? lireDose(c.dose) : null;
  const stock = c.stock == null || c.stock === '' ? null : Math.max(0, Number(c.stock) || 0);
  return {
    id: String(c.id), nom: String(c.nom ?? '').slice(0, 80), dose: String(c.dose ?? '').slice(0, 40),
    quantite: c.quantite != null && q > 0 ? q : lu?.quantite ?? null,
    unite: c.quantite != null ? (UNITES_SUPP.includes(c.unite) ? c.unite : '') : lu?.unite ?? '',
    stock, ...calendrier(c),
  };
}

const jourIso = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
/**
 * Calendrier d'un complément (models/nutrition.dart Supplement : days, every, from, until, at).
 * jours : masque des jours de la semaine (bit 1 lundi … bit 7 dimanche, 0 = tous) ; chaque : tous les N jours ; heure : minutes du rappel.
 * Les anciennes fiches (« freq », « rappel ») se lisent : « tous les 2 jours » devient chaque = 2, un rappel sans heure sonne à 9:00.
 */
function calendrier(c) {
  const chaque = Number.isInteger(c.chaque) && c.chaque >= 1 ? Math.min(60, c.chaque) : c.freq === 'n' ? 2 : 1;
  const jours = chaque > 1 ? 0 : Number.isInteger(c.jours) ? c.jours & 0xFE : 0;
  const heure = c.heure === null ? null : Number.isInteger(c.heure) && c.heure >= 0 && c.heure < 1440 ? c.heure : c.rappel ? 540 : null;
  return { jours, chaque, debut: jourIso(c.debut), fin: jourIso(c.fin), heure, freq: chaque > 1 ? 'n' : jours ? 'certains' : 'tous', rappel: heure != null };
}

const enJour = (iso) => { const [a, m, j] = iso.split('-').map(Number); return Date.UTC(a, m - 1, j) / 86400000; };
/** Jour de la semaine façon Dart : 1 lundi … 7 dimanche. */
export const jourSemaine = (iso) => ((new Date(`${iso}T12:00`).getDay() + 6) % 7) + 1;
/** dueOn : dans la période, puis tous les N jours depuis le début, sinon les jours de la semaine choisis. */
export function aPrendreLe(c, iso) {
  if (c.debut && iso < c.debut) return false;
  if (c.fin && iso > c.fin) return false;
  if (c.chaque > 1) return (enJour(iso) - enJour(c.debut ?? iso)) % c.chaque === 0;
  return !c.jours || (c.jours & (1 << jourSemaine(iso))) !== 0;
}
const ajouterJours = (iso, n) => { const d = new Date(`${iso}T12:00`); d.setDate(d.getDate() + n); return jourLocal(d); };
export { ajouterJours };

let migre = false;
/** Liste des compléments du compte ; la première fois, celle gardée sur l'appareil y est recopiée. */
export function definitions() {
  const m = lireModule('complements');
  if (Array.isArray(m)) return m.map(definition);
  const locaux = (nutritionStore.value.complements || []).map(definition);
  if (!migre && locaux.length) { migre = true; ecrireModule('complements', locaux).catch(() => { migre = false; }); }
  return locaux;
}

function enregistrer(liste) {
  const propre = liste.map(definition);
  const store = nutritionStore.value;
  const pris = new Set((store.complements || []).filter((c) => c.pris).map((c) => c.id));
  nutritionStore.value = { ...store, complements: propre.map((c) => ({ ...c, pris: pris.has(c.id) })) };
  return ecrireModule('complements', propre).catch(() => {});
}

export function complementsDuJour(jour = jourLocal()) {
  const store = nutritionStore.value;
  if (jour !== store.jourCourant) return store.jours[jour]?.complements || [];
  const pris = new Set((store.complements || []).filter((c) => c.pris).map((c) => c.id));
  return definitions().map((c) => ({ ...c, pris: pris.has(c.id) }));
}

/** Coche ou décoche un complément ; le stock baisse ou remonte d'une prise (toggleSupplement). */
export function toggleComplement(jour, id) {
  const store = nutritionStore.value;
  const liste = complementsDuJour(jour);
  const c = liste.find((x) => x.id === id);
  if (!c) return;
  const marque = !c.pris;
  const comps = liste.map((x) => (x.id === id ? { ...x, pris: marque } : x));
  if (jour === store.jourCourant) nutritionStore.value = { ...store, complements: comps };
  else nutritionStore.value = { ...store, jours: { ...store.jours, [jour]: { ...store.jours[jour], complements: comps } } };
  const defs = definitions();
  const d = defs.find((x) => x.id === id);
  if (d && d.stock != null) {
    const prise = d.quantite ?? 1;
    enregistrer(defs.map((x) => (x.id === id ? { ...x, stock: Math.max(0, Math.round((x.stock + (marque ? -prise : prise)) * 1000) / 1000) } : x)));
  }
}

export const ajouterComplement = (c) => enregistrer([...definitions(), { ...c, id: crypto.randomUUID() }]);
export const modifierComplement = (id, patch) => enregistrer(definitions().map((c) => (c.id === id ? { ...c, ...patch } : c)));
export const supprimerComplement = (id) => enregistrer(definitions().filter((c) => c.id !== id));

/**
 * Jours avant d'être à court (suppDaysLeft) : 0 = épuisé, null sans stock.
 * Compte les jours où le complément est à prendre (aPrendreLe) à partir d'aujourd'hui.
 */
export function joursRestants(c, { prisAujourdhui = false, auj = jourLocal() } = {}) {
  if (c.stock == null) return null;
  let prises = Math.floor(c.stock / (c.quantite ?? 1) + 1e-9);
  const cal = c.chaque == null ? calendrier(c) : c;
  for (let i = 0; i < 1000; i += 1) {
    const du = aPrendreLe(cal, ajouterJours(auj, i));
    if (!du || (i === 0 && prisAujourdhui)) continue;
    if (prises === 0) return i;
    prises -= 1;
  }
  return null;
}

const UNITES_TXT = {
  fr: { capsule: ['gélule', 'gélules'], pill: ['comprimé', 'comprimés'], scoop: ['mesurette', 'mesurettes'], drop: ['goutte', 'gouttes'], serving: ['portion', 'portions'], iu: ['UI', 'UI'] },
  en: { capsule: ['capsule', 'capsules'], pill: ['pill', 'pills'], scoop: ['scoop', 'scoops'], drop: ['drop', 'drops'], serving: ['serving', 'servings'], iu: ['IU', 'IU'] },
};
export function libelleUnite(unite, quantite) {
  if (unite === 'g' || unite === 'mg' || unite === 'ml') return unite;
  const l = UNITES_TXT[langue === 'en' ? 'en' : 'fr'][unite];
  return l ? l[quantite === 1 ? 0 : 1] : '';
}
const nb = (v) => new Intl.NumberFormat(langue === 'en' ? 'en-GB' : 'fr-FR', { maximumFractionDigits: 2 }).format(Math.round(v * 100) / 100);
export function libelleQuantite(quantite, unite) {
  const mot = libelleUnite(unite, quantite);
  return mot ? `${nb(quantite)} ${mot}` : nb(quantite);
}
export const libelleDose = (c) => (c.quantite == null ? c.dose || '' : libelleQuantite(c.quantite, c.unite));
