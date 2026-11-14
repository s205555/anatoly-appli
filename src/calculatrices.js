/**
 * Calculatrices d'entraînement et nutrition : fonctions pures.
 * L'écran (grille et panneaux) vit dans ecrans/outils.jsx, pour que ce module reste importable par les tests Node.
 */
const LB_PAR_KG = 0.45359237;

export function kgVersLb(kg) {
  return kg / LB_PAR_KG;
}

export function lbVersKg(lb) {
  return lb * LB_PAR_KG;
}

/** 1RM Epley : poids * (1 + reps / 30) */
export function unRMEpley(kg, reps) {
  if (!kg || !reps || reps < 1) return null;
  return kg * (1 + reps / 30);
}

/** 1RM Brzycki : poids * (36 / (37 - reps)) pour reps 1 à 36 */
export function unRMBrzycki(kg, reps) {
  if (!kg || !reps || reps < 1 || reps >= 37) return null;
  return kg * (36 / (37 - reps));
}

/** Table pourcentages du 1RM (Epley) : charge cible et répétitions approximatives r = 30 * (100/pct - 1). */
export function tablePourcentages1RM(rmEpley) {
  if (!rmEpley || rmEpley <= 0) return [];
  const rows = [];
  for (let pct = 50; pct <= 100; pct += 5) {
    const cible = (rmEpley * pct) / 100;
    const repsEstime = Math.max(1, Math.min(30, Math.round(30 * (100 / pct - 1))));
    rows.push({ pct, poids: cible, repsEstime });
  }
  return rows;
}

const DISQUES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];
const DISQUES_LB = [45, 35, 25, 10, 5, 2.5];

const BARRES_KG = [20, 15, 10];
const BARRES_LB = [45, 35, 15];

/**
 * Répartition des disques par côté (greedy, plus gros d'abord).
 * @param {number} poidsTotal masse totale (barre + disques), en kg ou lb selon unite
 * @param {number} poidsBarre masse de la barre seule
 * @param {'kg'|'lb'} unite
 * @returns {{ parCote: number[], reste: number, imposs?: boolean }}
 */
export function calculerDisquesParCote(poidsTotal, poidsBarre, unite) {
  const disques = unite === 'lb' ? DISQUES_LB : DISQUES_KG;
  const parCoteCible = (poidsTotal - poidsBarre) / 2;
  if (parCoteCible < 0) return { parCote: [], reste: parCoteCible, imposs: true };
  let reste = Math.round(parCoteCible * 1000) / 1000;
  const parCote = [];
  for (const d of disques) {
    while (reste + 1e-6 >= d) {
      parCote.push(d);
      reste -= d;
    }
  }
  const ok = reste < 0.15;
  return { parCote, reste: ok ? 0 : reste, imposs: !ok };
}

/**
 * Disques par côté groupés, règle de GymMane (tools_state.dart, platesPerSide) : plus gros d'abord, reste arrondi au dixième.
 * Valeurs dans l'unité affichée. Rend [{ poids, nb }].
 */
export function disquesGroupes(cible, barre, unite) {
  let cote = Math.max(0, (cible - barre) / 2);
  const out = [];
  for (const p of unite === 'lb' ? DISQUES_LB : DISQUES_KG) {
    const nb = Math.floor(cote / p + 1e-6);
    if (nb > 0) { out.push({ poids: p, nb }); cote = Math.round((cote - nb * p) * 10) / 10; }
  }
  return out;
}

/** Charge réellement montable (barre + disques des deux côtés), loadableTotal de GymMane. */
export function totalChargeable(cible, barre, unite) {
  const s = disquesGroupes(cible, barre, unite).reduce((a, d) => a + d.poids * d.nb, 0);
  return Math.round((barre + s * 2) * 10) / 10;
}

export function choixBarresPourUnite(unite) {
  return unite === 'lb' ? BARRES_LB : BARRES_KG;
}

/** IMC et catégorie OMS (adultes). */
export function imcEtCategorie(tailleM, poidsKg) {
  if (!tailleM || !poidsKg || tailleM <= 0 || poidsKg <= 0) return null;
  const imc = poidsKg / (tailleM * tailleM);
  let cat = 'obesite';
  if (imc < 18.5) cat = 'maigreur';
  else if (imc < 25) cat = 'normal';
  else if (imc < 30) cat = 'surpoids';
  const minNormal = 18.5 * tailleM * tailleM;
  const maxNormal = 24.99 * tailleM * tailleM;
  return { imc, cat, minNormal, maxNormal };
}

const FACTEUR_ACTIVITE = {
  sedentaire: 1.2,
  leger: 1.375,
  modere: 1.55,
  actif: 1.725,
  tres_actif: 1.9,
};

/**
 * Mifflin-St Jeor (kcal/j), puis macros selon l'objectif.
 */
export function caloriesEtMacros({ sexe, age, tailleCm, poidsKg, activite, objectif }) {
  const fact = FACTEUR_ACTIVITE[activite];
  if (!fact || !age || !tailleCm || !poidsKg) return null;
  const s = sexe === 'f' ? -161 : 5;
  const bmr = 10 * poidsKg + 6.25 * tailleCm - 5 * age + s;
  let tdee = bmr * fact;
  if (objectif === 'seche') tdee -= 400;
  else if (objectif === 'prise') tdee += 350;
  const kcal = Math.round(tdee);
  const prot = Math.round(kcal * 0.3 / 4);
  const gluc = Math.round(kcal * 0.4 / 4);
  const lip = Math.round(kcal * 0.3 / 9);
  return { bmr: Math.round(bmr), tdee: Math.round(bmr * fact), kcal, proteinesG: prot, lipidesG: lip, glucidesG: Math.max(0, gluc) };
}

/**
 * Corps US Navy (pourcentage de masse grasse).
 * taille en cm, cou et taille en cm ; hanches requises pour les femmes.
 */
export function masseGrasseUSNavy({ sexe, tailleCm, couCm, tailleVisCm, hanchesCm, poidsKg }) {
  if (!tailleCm || !couCm || !tailleVisCm) return null;
  const log10 = Math.log10;
  let pct;
  if (sexe === 'f') {
    if (!hanchesCm) return null;
    const girth = Math.max(1, tailleVisCm + hanchesCm - couCm);
    pct = 495 / (1.29579 - 0.35004 * log10(girth) + 0.221 * log10(tailleCm)) - 450;
  } else {
    const girth = Math.max(1, tailleVisCm - couCm);
    pct = 495 / (1.0324 - 0.19077 * log10(girth) + 0.15456 * log10(tailleCm)) - 450;
  }
  pct = Math.min(50, Math.max(3, pct));
  pct = Math.round(pct * 10) / 10;
  if (!poidsKg) return { pct, masseGrasseKg: null, masseMaigreKg: null };
  const mg = (poidsKg * pct) / 100;
  return { pct, masseGrasseKg: mg, masseMaigreKg: poidsKg - mg };
}

/** Rampe d'échauffement de GymMane (tools_state.dart, warmupSets) : 40 % × 10, 60 % × 5, 80 % × 3, 90 % × 1, charge arrondie au pas (2,5 kg ou 5 lb). */
export function rampeEchauffement(poidsTravail, poidsBarre, unite) {
  if (!poidsTravail || poidsTravail <= 0) return [];
  const pas = unite === 'lb' ? 5 : 2.5;
  return [[40, 10], [60, 5], [80, 3], [90, 1]].map(([pct, reps]) => {
    const total = Math.round((poidsTravail * pct) / 100 / pas) * pas;
    const { parCote, reste, imposs } = calculerDisquesParCote(Math.max(total, poidsBarre), poidsBarre, unite);
    return { etiquette: String(pct), frac: pct / 100, reps, totalArrondi: Math.round(total * 10) / 10, parCote, reste, imposs };
  });
}

/**
 * Étape suivante d'un exercice, règles de GymMane (workout_state.dart, _nextPlan).
 * series : séries de travail de la dernière fois [{ r, kg }]. mode : 'charge' (linéaire) ou 'repetitions' (double, 8 à 12).
 * Rend { series, coup } avec coup = 'charge' | 'reps' | 'garde', ou null quand rien n'est proposé.
 */
export function etapeSuivante(series, mode, pasKg, bas = 8, haut = 12) {
  const l = (series ?? []).filter((x) => (x?.r ?? 0) > 0);
  if (!l.length || (mode !== 'charge' && mode !== 'repetitions')) return null;
  const cible = l[0].r;
  const atteint = l.every((x) => x.r >= cible);
  if (!l.some((x) => x.kg)) {
    return { series: l.map((x) => ({ r: atteint ? x.r + 1 : x.r, kg: x.kg ?? null })), coup: atteint ? 'reps' : 'garde' };
  }
  const plus = (kg) => (kg ? Math.round((kg + pasKg) * 1000) / 1000 : kg ?? null);
  if (mode === 'charge') return { series: l.map((x) => ({ r: x.r, kg: atteint ? plus(x.kg) : x.kg })), coup: atteint ? 'charge' : 'garde' };
  if (l.every((x) => x.r >= haut)) return { series: l.map((x) => ({ r: bas, kg: plus(x.kg) })), coup: 'charge' };
  return { series: l.map((x) => ({ r: Math.min(haut, Math.max(bas, x.r + 1)), kg: x.kg })), coup: 'reps' };
}

/** Semaine de décharge (settings_state.dart, deloadWeek) : la dernière de chaque bloc de `toutes` semaines comptées depuis le lundi de `depuis`. */
export function estSemaineDecharge(toutes, depuis, maintenant = new Date()) {
  const d = new Date(depuis);
  if (!(toutes > 0) || Number.isNaN(d.getTime())) return false;
  const lundi = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  const jour = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const i = Math.floor(Math.round((jour - lundi) / 86400000) / 7);
  return i >= 0 && i % toutes === toutes - 1;
}

/** Allège un exercice pour la semaine de décharge (workout_state.dart, _lighten) : moitié des séries de travail, charge à 90 % arrondie au pas. */
// `surPile(kg)` (facultatif) donne la charge allégée d'une machine à pile de poids, null pour garder l'arrondi au pas.
export function alleger(series, pasKg, surPile = null) {
  const travail = series.filter((x) => x.type !== 'e');
  const retirees = new Set(travail.slice(Math.ceil(travail.length / 2)));
  return series.filter((x) => !retirees.has(x)).map((x) => (x.type === 'e' || !(x.kg > 0) ? x
    : { ...x, kg: surPile?.(x.kg) ?? Math.round(Math.round((x.kg * 0.9) / pasKg) * pasKg * 1000) / 1000 }));
}

// === Outils M12 : FFMI, RPE, DOTS, Wilks (formules de tools_state.dart) ===

const RPE_TABLE = [
  1.0, .978, .955, .939, .922, .907, .892, .878, .863, .85, .837, .824, .811, .799, .786, .774,
  .762, .751, .739, .723, .707, .694, .68, .667, .653, .64, .626, .613, .599, .586, .574,
];

/** Pourcentage d'effort pour reps et RPE (null hors bornes). */
export function rpePercent(reps, rpe) {
  if (rpe == null || rpe < 6 || rpe > 10 || reps < 1 || reps > 12) return null;
  const i = (reps - 1) * 2 + Math.round((10 - rpe) * 2);
  return i < RPE_TABLE.length ? RPE_TABLE[i] : null;
}

function partEffort(reps, rpe) {
  return rpePercent(reps, rpe) ?? 1 / (1 + reps / 30);
}

/**
 * Charge RPE : 1RM estimé, puis charge recommandée pour un objectif reps/RPE.
 * Tout en kg ; repsCible (défaut reps) et rpeCible (défaut rpe).
 */
export function chargeRpe({ poidsKg, reps, rpe, repsCible, rpeCible }) {
  if (!poidsKg || !reps || reps < 1 || rpe == null || rpe < 6 || rpe > 10) return null;
  const oneRm = poidsKg / partEffort(reps, rpe);
  const result = oneRm * partEffort(repsCible ?? reps, rpeCible ?? rpe);
  return { oneRm, result };
}

/** FFMI : score, masse maigre et niveau 0-4. */
export function ffmiEtNiveau({ sexe, tailleCm, poidsKg, grasPct }) {
  if (!tailleCm || !poidsKg || grasPct == null) return null;
  const m = tailleCm / 100;
  const lean = poidsKg * (1 - grasPct / 100);
  const score = Math.round((lean / (m * m) + 6.1 * (1.8 - m)) * 10) / 10;
  const s = score + (sexe === 'f' ? 3 : 0);
  let niveau = 4;
  if (s < 18) niveau = 0;
  else if (s < 20) niveau = 1;
  else if (s < 22) niveau = 2;
  else if (s < 25) niveau = 3;
  return { score, lean, niveau };
}

/** Niveau de force DOTS/Wilks : 0-4. */
export function niveauForce(score) {
  if (score < 250) return 0;
  if (score < 325) return 1;
  if (score < 400) return 2;
  if (score < 475) return 3;
  return 4;
}

/** Score DOTS ou Wilks (type 'dots' | 'wilks'), tout en kg. */
export function scoreForce({ sexe, poidsCorpsKg, squatKg, benchKg, deadliftKg, type }) {
  if (!poidsCorpsKg) return null;
  const total = (squatKg || 0) + (benchKg || 0) + (deadliftKg || 0);
  const male = sexe !== 'f';
  let bw, c;
  if (type === 'wilks') {
    bw = male ? Math.min(Math.max(poidsCorpsKg, 40), 201.9) : Math.min(Math.max(poidsCorpsKg, 26.51), 154.53);
    c = male
      ? [-216.0475144, 16.2606339, -0.002388645, -0.00113732, 7.01863e-6, -1.291e-8]
      : [594.31747775582, -27.23842536447, 0.82112226871, -0.00930733913, 4.731582e-5, -9.054e-8];
  } else {
    bw = male ? Math.min(Math.max(poidsCorpsKg, 40), 210) : Math.min(Math.max(poidsCorpsKg, 40), 150);
    c = male
      ? [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093]
      : [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706];
  }
  let den = 0;
  for (let i = 0; i < c.length; i += 1) den += c[i] * Math.pow(bw, i);
  const score = Math.round((total * 500 / den) * 10) / 10;
  return { score, total, niveau: niveauForce(score) };
}
