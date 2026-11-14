// Progression par exercice (GymMane : models/progression.dart, settings_state.dart, workout_state.dart _nextPlan).
// Règles rangées sur le compte : extensions.modules.progression = { regles: { [ex]: { k, lo, hi, s, ms, f, d } }, pas: { [ex]: kg } }.
import { etat, lireModule, ecrireModule, unite, versKg } from './donnees.js';
import { lireM13 } from './ecrans/reglages-m13.js';

export const GENRES = ['manuelle', 'lineaire', 'double', 'volume', 'amrap'];
const borne = (v, a, b) => Math.min(b, Math.max(a, v));

/** Règle complète et bornée comme ProgressRule.copyWith. */
export function regleBornee(r = {}) {
  const k = GENRES.includes(r.k) ? r.k : 'lineaire';
  const lo = borne(Math.round(Number(r.lo) || 8), 1, 50);
  const hi = borne(Math.round(Number(r.hi) || 12), lo + 1, 60);
  const s = borne(Math.round(Number(r.s) || 3), 1, 10);
  return { k, lo, hi, s, ms: borne(Math.round(Number(r.ms) || 5), s + 1, 12), f: borne(Math.round(Number(r.f) || 3), 1, 6), d: borne(Math.round(Number(r.d) || 10), 5, 30) };
}
export const usePlage = (r) => r.k === 'double' || r.k === 'volume';

const lire = () => { const m = lireModule('progression'); return m && typeof m === 'object' ? m : {}; };
const ecrire = (m) => ecrireModule('progression', m).catch(() => {});
/** Réglage global « Progression automatique » : aucune, charge (linéaire) ou répétitions (double). */
const modeGlobal = () => lireM13().progression;
const globalCoupe = () => modeGlobal() !== 'charge' && modeGlobal() !== 'repetitions';
/** Pas de charge par défaut en kg : réglage « Pas de poids » (unité affichée), sinon 2,5 kg ou 5 lb. */
export const pasDefautKg = () => versKg(Number(lireM13().pasPoids) || (unite() === 'lb' ? 5 : 2.5));

export function regleDe(ex) {
  const r = lire().regles?.[ex];
  return r ? regleBornee(r) : regleBornee({ k: modeGlobal() === 'repetitions' ? 'double' : 'lineaire' });
}
/** Pas de charge de l'exercice en kg (null quand rien ne s'applique). */
export function pasDe(ex) {
  const p = lire().pas?.[ex];
  if (p != null) return Number(p);
  return globalCoupe() ? null : pasDefautKg();
}
export function progressionActive(ex) {
  const p = lire().pas?.[ex];
  if (p == null && globalCoupe()) return false;
  return (p ?? 1) > 0 && regleDe(ex).k !== 'manuelle';
}

export function changerRegle(ex, suivante) {
  const m = lire();
  const avant = regleDe(ex).k;
  let r = regleBornee(suivante);
  if (r.k !== avant && (r.k === 'amrap' || avant === 'amrap')) r = regleBornee({ ...r, f: r.k === 'amrap' ? 1 : 3 });
  const pas = { ...(m.pas || {}) };
  if (r.k !== avant && r.k !== 'manuelle' && !(Number(pas[ex]) > 0)) pas[ex] = pasDefautKg();
  return ecrire({ ...m, regles: { ...(m.regles || {}), [ex]: r }, pas });
}

export function basculerProgression(ex) {
  const m = lire();
  const pas = { ...(m.pas || {}) };
  const regles = { ...(m.regles || {}) };
  if (progressionActive(ex)) {
    if (globalCoupe()) delete pas[ex];
    else pas[ex] = 0;
  } else {
    pas[ex] = pasDefautKg();
    if (regleDe(ex).k === 'manuelle') delete regles[ex];
  }
  return ecrire({ ...m, pas, regles });
}

/** Saut de charge : demi-pas du réglage, entre un demi-pas et huit pas (bumpProgressStep). */
export function ajusterPas(ex, sens) {
  const m = lire();
  const pasAff = Number(lireM13().pasPoids) || (unite() === 'lb' ? 5 : 2.5);
  const actuel = versAffichageLocal(pasDe(ex) ?? 0);
  const suivant = borne(actuel + (sens * pasAff) / 2, pasAff / 2, pasAff * 8);
  return ecrire({ ...m, pas: { ...(m.pas || {}), [ex]: versKg(suivant) } });
}
const versAffichageLocal = (kg) => (unite() === 'lb' ? Math.round((kg * 2.20462) * 100) / 100 : kg);

// ===== Prochaine séance =====
const travail = (series) => (series ?? []).filter((x) => x && x.type !== 'e' && x.fait !== false);
const chargeTete = (series) => Math.max(0, ...series.map((x) => x.kg ?? 0));

/** Séances passées de l'exercice, de la plus récente à la plus ancienne : séries de travail faites. */
export function historiqueDe(ex, seances = etat.value?.seances ?? []) {
  const out = [];
  const legeres = new Set(lireModule('legeres') ?? []);
  for (const s of seances) {
    if (legeres.has(s.cle)) continue; // séance légère : hors progression
    const series = travail(s.donnees.exercices.filter((x) => x.ex === ex).flatMap((x) => x.series)).filter((x) => x.fait);
    if (series.length) out.push(series);
  }
  return out;
}

/** Séances d'affilée sans progrès à la même charge (stallStreak). */
export function seancesBloquees(historique, r) {
  if (!historique.length) return 0;
  const charge = chargeTete(historique[0]);
  const meme = (l) => Math.abs(chargeTete(l) - charge) <= 0.01;
  const total = (l) => l.reduce((n, x) => n + (x.r ?? 0), 0);
  let n = 0;
  for (let i = 0; i < historique.length; i += 1) {
    const l = historique[i];
    if (!l.length || !meme(l)) break;
    if (usePlage(r)) {
      if (l.every((x) => (x.r ?? 0) >= r.hi)) break;
      const ancien = historique[i + 1];
      if (!ancien || !ancien.length || !meme(ancien)) break;
      if (total(l) > total(ancien)) break;
    } else {
      const cible = l[0].r ?? 0;
      if (cible <= 0 || l.every((x) => (x.r ?? 0) >= cible)) break;
    }
    n += 1;
  }
  return n;
}

/**
 * Plan de la prochaine séance selon la règle (workout_state.dart, _nextPlan).
 * historique : séances passées (plus récente d'abord), pasKg : saut de charge. Rend { series: [{ r, kg }], coup } ou null.
 * coup : 'charge' | 'reps' | 'serie' | 'garde' | 'decharge'.
 */
export function planSuivant(historique, r, pasKg, pasGrille = pasKg) {
  if (r.k === 'manuelle' || !historique.length) return null;
  const dernier = historique[0];
  const reps = dernier[0]?.r ?? 0;
  if (!(reps > 0)) return null;
  if (!dernier.some((x) => x.kg > 0)) {
    const ok = dernier.every((x) => (x.r ?? 0) >= reps);
    return { series: dernier.map((x) => ({ r: ok ? x.r + 1 : x.r, kg: x.kg ?? null })), coup: ok ? 'reps' : 'garde' };
  }
  const arrondi = (v) => Math.round(v * 1000) / 1000;
  const plus = (kg, fois = 1) => (kg ? arrondi(kg + pasKg * fois) : kg ?? null);
  const forme = (repsDe, kgDe, n = dernier.length) => Array.from({ length: n }, (_, i) => {
    const l = dernier[Math.min(i, dernier.length - 1)];
    return { r: repsDe(l), kg: kgDe(l.kg) };
  });
  const allege = (kg) => {
    if (!kg) return kg ?? null;
    const visee = Math.round((kg * (100 - r.d)) / 100 / pasGrille) * pasGrille;
    return arrondi(Math.max(0, visee >= kg ? kg - pasGrille : visee));
  };
  const bloque = () => seancesBloquees(historique, r) >= r.f;
  const decharge = (cible) => ({ series: forme(() => cible, allege, r.k === 'volume' ? r.s : undefined), coup: 'decharge' });
  if (r.k === 'double' || r.k === 'volume') {
    const haut = dernier.every((x) => (x.r ?? 0) >= r.hi);
    if (haut && r.k === 'volume' && dernier.length < r.ms) return { series: forme(() => r.lo, (kg) => kg ?? null, dernier.length + 1), coup: 'serie' };
    if (haut) return { series: forme(() => r.lo, (kg) => plus(kg), r.k === 'volume' ? r.s : undefined), coup: 'charge' };
    if (bloque()) return decharge(r.lo);
    return { series: forme((l) => borne((l.r ?? 0) + 1, r.lo, r.hi), (kg) => kg ?? null), coup: 'reps' };
  }
  if (r.k === 'amrap') {
    const ouverte = dernier.at(-1).r ?? 0;
    const ok = dernier.slice(0, -1).every((x) => (x.r ?? 0) >= reps) && ouverte >= reps;
    if (ok) return { series: forme(() => reps, (kg) => plus(kg, ouverte >= reps * 2 ? 2 : 1)), coup: 'charge' };
    if (bloque()) return decharge(reps);
    return { series: forme(() => reps, (kg) => kg ?? null), coup: 'garde' };
  }
  const ok = dernier.every((x) => (x.r ?? 0) >= reps);
  if (!ok && bloque()) return decharge(reps);
  if (ok) return { series: forme((l) => l.r, (kg) => plus(kg)), coup: 'charge' };
  return { series: forme((l) => l.r, (kg) => kg ?? null), coup: 'garde' };
}

/** Plan de la prochaine séance d'un exercice avec sa règle, ou null si la progression n'est pas active. */
export function prochainPlan(ex, seances) {
  if (!progressionActive(ex)) return null;
  return planSuivant(historiqueDe(ex, seances), regleDe(ex), pasDe(ex) ?? pasDefautKg(), pasDefautKg());
}
