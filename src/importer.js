/**
 * Import M14 : détection et analyse des exports Hevy, Strong, Lyfta, Fitbod, FitNotes,
 * openGym, GymMane, fichiers de poids et CSV générique (portage de workout_import.dart).
 * Hevy, Strong, FitNotes et le CSV générique passent par import-csv.js (déjà en place).
 */
import { analyserCsvBrut, convertirCsvVersPaquets, correspondreExerciceCatalogue } from './import-csv.js';

const LB_EN_KG = 0.45359237;

const normaliserCle = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');

// Synonymes courants, mêmes expansions que exercise_match.dart (portage GymMane).
const SYNONYMES = {
  db: 'dumbbell', dumbbell: 'dumbbell', dumbbells: 'dumbbell', dumbell: 'dumbbell', dbell: 'dumbbell',
  bb: 'barbell', barbells: 'barbell', kb: 'kettlebell', kettlebells: 'kettlebell',
  bw: 'bodyweight', bodyweight: 'bodyweight', ohp: 'overhead press',
  pushup: 'push up', pushups: 'push up', pullup: 'pull up', pullups: 'pull up',
  lat: 'lateral', skullcrusher: 'lying triceps extension', rdl: 'romanian deadlift', sldl: 'stiff leg deadlift',
};

const etendreSynonymes = (s) => normaliserCle(s).split(' ').map((m) => SYNONYMES[m] ?? m).join(' ');

const EQUIPEMENTS = new Set(['barbell', 'dumbbell', 'cable', 'machine', 'kettlebell', 'band', 'smith', 'ez', 'bodyweight']);

/** Trouve un exercice du catalogue : nom brut, sans parenthèses, synonymes, puis sans le matériel. */
export function correspondreExerciceAvance(nomBrut) {
  const brut = String(nomBrut ?? '');
  const sansParen = brut.replace(/\([^)]*\)/g, ' ');
  const mots = normaliserCle(sansParen).split(' ').filter(Boolean);
  const sansMateriel = mots.filter((m) => !EQUIPEMENTS.has(m)).join(' ');
  const candidats = [brut, sansParen, etendreSynonymes(brut), sansParen, sansMateriel, etendreSynonymes(sansMateriel)];
  for (const c of candidats) {
    const r = correspondreExerciceCatalogue(c);
    if (r.id) return r;
  }
  return { id: null, nomBrut: brut.slice(0, 120) };
}

const num = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `imp-${Date.now()}-${Math.random().toString(16).slice(2)}`);

const dateIso = (v) => {
  if (!v) return new Date().toISOString();
  const d = Date.parse(String(v).trim());
  return Number.isNaN(d) ? new Date().toISOString() : new Date(d).toISOString();
};

const entetes = (ligne0) => {
  const m = {};
  ligne0.forEach((h, j) => { m[String(h).trim().toLowerCase()] = j; });
  return m;
};

const trouver = (h, noms) => { for (const n of noms) if (h[n] != null) return h[n]; return null; };

// Colonnes d'un CSV générique, reprises de workout_import.dart.
const ALIAS = {
  date: ['date', 'fecha', 'datum', 'data', 'day', 'dia', 'día', 'timestamp', 'start_time', 'time'],
  exercice: ['exercise', 'exercise name', 'exercise_name', 'ejercicio', 'exercicio', 'exercício', 'übung', 'ubung', 'uebung', 'esercizio', 'exercice', 'name', 'nombre'],
  reps: ['reps', 'rep', 'repetitions', 'repeticiones', 'repetições', 'repeticoes', 'wiederholungen', 'ripetizioni', 'répétitions'],
  kg: ['weight_kg', 'weight (kg)', 'weight kg', 'peso (kg)'],
  lb: ['weight_lbs', 'weight_lb', 'weight (lbs)', 'weight (lb)', 'weight lbs'],
  poidsSimple: ['weight', 'peso', 'gewicht', 'poids', 'carga'],
  groupe: ['workout', 'routine', 'rutina', 'plan', 'entrenamiento', 'training', 'title', 'workout name'],
  muscle: ['category', 'muscle', 'categoria', 'categoría', 'musculo', 'músculo'],
};

/** Détecte le format d'un fichier texte (CSV ou JSON openGym). */
export function detecterFormatImport(texte) {
  const t = String(texte ?? '').trimStart();
  if (t.startsWith('{')) {
    try {
      const d = JSON.parse(t);
      if (Array.isArray(d?.workouts) && Array.isArray(d?.routines)) return 'openGym';
    } catch { /* pas du JSON : on continue en CSV */ }
  }
  const lignes = analyserCsvBrut(t.replace(/^﻿/, ''));
  if (lignes.length < 2) return 'inconnu';
  const h = lignes[0].map((x) => String(x).trim().toLowerCase());
  const a = (x) => h.includes(x);
  if (a('exercise_title') && a('start_time')) return 'hevy';
  if (a('exercise name') && (a('set order') || a('workout name') || a('date'))) return 'strong';
  if (a('exercise') && a('set type') && a('title')) return 'lyfta';
  if (a('exercise') && a('reps') && a('iswarmup')) return 'fitbod';
  if (a('weight_kg') && (a('est_1rm_kg') || a('volume_kg'))) return 'gymmane';
  if (a('exercise') && a('category') && h.some((x) => x.includes('weight'))) return 'fitnotes';
  const colonneExercice = ALIAS.exercice.some((x) => a(x));
  const colonneReps = ALIAS.reps.some((x) => a(x));
  const colonnePoids = [...ALIAS.kg, ...ALIAS.lb, ...ALIAS.poidsSimple].some((x) => a(x)) || a('fat_percent');
  if (colonneExercice && colonneReps) return 'generique';
  if (ALIAS.date.some((x) => a(x)) && colonnePoids) return h.length > 3 ? 'hevyWeights' : 'strongWeights';
  return 'inconnu';
}

/** true si le fichier ne dit pas si les poids sont en kilos ou en livres. */
export function importerNecessiteUnite(texte) {
  const format = detecterFormatImport(texte);
  if (format === 'lyfta' || format === 'hevyWeights' || format === 'strongWeights') return true;
  if (format !== 'generique') return false;
  const h = entetes(analyserCsvBrut(String(texte).replace(/^﻿/, ''))[0] ?? []);
  const simple = ALIAS.poidsSimple.some((x) => h[x] != null);
  const explicite = [...ALIAS.kg, ...ALIAS.lb].some((x) => h[x] != null);
  return simple && !explicite;
}

// ===== Analyse des formats qui ne passent pas par import-csv.js =====
function analyserColonnes(texte, uniteChoisi, { date, groupe, exercice, reps, kgCol, lbCol, simpleCol, echauffement }) {
  const lignes = analyserCsvBrut(String(texte).replace(/^﻿/, ''));
  const h = entetes(lignes[0]);
  const iDate = trouver(h, date);
  const iGroupe = trouver(h, groupe);
  const iEx = trouver(h, exercice);
  const iReps = trouver(h, reps);
  const iKg = trouver(h, kgCol ?? []);
  const iLb = trouver(h, lbCol ?? []);
  const iSimple = trouver(h, simpleCol ?? []);
  const iEch = echauffement ? trouver(h, echauffement) : null;
  const enLb = uniteChoisi === 'lb';
  const parSeance = new Map();
  const nonResolus = [];
  const parExSeance = new Map();
  for (let r = 1; r < lignes.length; r += 1) {
    const row = lignes[r];
    if (iEch != null) {
      const v = String(row[iEch] ?? '').trim().toLowerCase();
      if (v === 'true' || v === '1') continue;
    }
    const nom = iEx != null ? row[iEx] : '';
    const rp = iReps != null ? (num(row[iReps]) ?? 0) : 0;
    let kg = 0;
    if (iKg != null && row[iKg] !== '') kg = num(row[iKg]) ?? 0;
    else if (iLb != null && row[iLb] !== '') kg = (num(row[iLb]) ?? 0) * LB_EN_KG;
    else if (iSimple != null) { const v = num(row[iSimple]) ?? 0; kg = enLb ? v * LB_EN_KG : v; }
    if (rp <= 0 && kg <= 0) continue;
    const dateBrute = iDate != null ? row[iDate] : '';
    const nomSeance = iGroupe != null ? row[iGroupe] : '';
    const cle = `${dateBrute}|${nomSeance}`;
    if (!parSeance.has(cle)) { parSeance.set(cle, { date: dateBrute, nom: nomSeance, lignes: [] }); parExSeance.set(cle, new Map()); }
    const { id, nomBrut } = correspondreExerciceAvance(nom);
    if (!id) { if (nomBrut && !nonResolus.includes(nomBrut)) nonResolus.push(nomBrut); continue; }
    const parEx = parExSeance.get(cle);
    if (!parEx.has(id)) parEx.set(id, []);
    parEx.get(id).push({ r: rp, kg, s: null, type: 'n', fait: true });
  }
  const seances = [];
  for (const [cle, s] of parSeance) {
    const exercices = [...parExSeance.get(cle).entries()].map(([ex, series]) => ({ ex, note: '', lie: false, series }));
    if (!exercices.length) continue;
    seances.push({
      cle: uuid(), debut: dateIso(s.date), duree_s: 3600,
      nom: String(s.nom || 'Import').slice(0, 80), note: '', exercices,
    });
  }
  return { seances, nomsNonResolus: nonResolus };
}

const analyserLyfta = (texte, unite) => analyserColonnes(texte, unite, {
  date: ['date'], groupe: ['title'], exercice: ['exercise'], reps: ['reps'],
  simpleCol: ['weight'], kgCol: ['weight_kg'], lbCol: ['weight_lbs'],
});

const analyserFitbod = (texte, unite) => analyserColonnes(texte, unite, {
  date: ['date'], groupe: ['workout', 'title'], exercice: ['exercise'], reps: ['reps'],
  kgCol: ['weight(kg)', 'weight (kg)'], lbCol: ['weight(lbs)', 'weight (lb)', 'weight (lbs)'],
  echauffement: ['iswarmup'],
});

const analyserGymmane = (texte, unite) => analyserColonnes(texte, unite, {
  date: ['date'], groupe: ['workout', 'title'], exercice: ['exercise'], reps: ['reps'],
  kgCol: ['weight_kg'], lbCol: ['weight_lbs'],
});

/** Fichier de poids seul : renvoie la liste de pesées, sans séance. */
function analyserPoidsSeul(texte, uniteChoisi) {
  const lignes = analyserCsvBrut(String(texte).replace(/^﻿/, ''));
  const h = entetes(lignes[0]);
  const iDate = trouver(h, ALIAS.date);
  const iKg = trouver(h, ALIAS.kg);
  const iLb = trouver(h, ALIAS.lb);
  const iSimple = trouver(h, ALIAS.poidsSimple);
  const enLb = uniteChoisi === 'lb';
  const poids = [];
  for (let r = 1; r < lignes.length; r += 1) {
    const row = lignes[r];
    let kg = null;
    if (iKg != null && row[iKg] !== '') kg = num(row[iKg]);
    else if (iLb != null && row[iLb] !== '') kg = (num(row[iLb]) ?? 0) * LB_EN_KG;
    else if (iSimple != null) { const v = num(row[iSimple]); if (v != null) kg = enLb ? v * LB_EN_KG : v; }
    if (kg == null || kg < 20) continue;
    const jour = iDate != null ? dateIso(row[iDate]) : '';
    if (jour) poids.push({ jour, kg });
  }
  if (!poids.length) throw new Error('format_inconnu');
  return { format: 'poids', seances: [], nomsNonResolus: [], poids };
}

/** Parse le JSON openGym (sauvegarde GymMane) en aperçu d'import. */
export function analyserOpenGym(texte) {
  const d = JSON.parse(texte);
  const enLb = String(d.unit ?? 'kg').toLowerCase().startsWith('lb');
  const perso = new Map((d.customEx ?? []).map((e) => [String(e.id), String(e.n ?? '')]));
  const seances = [];
  const nonResolus = [];
  for (const w of d.workouts ?? []) {
    const debut = Number(w.start) > 0 ? new Date(Number(w.start)).toISOString() : dateIso(w.d ?? '');
    const duree = Number(w.end) > 0 && Number(w.start) > 0
      ? Math.min(86400, Math.max(0, (Number(w.end) - Number(w.start)) / 1000)) : 3600;
    const exercices = [];
    for (const ent of w.entries ?? []) {
      const series = [];
      for (const s of ent.sets ?? []) {
        if (s.done !== true || s.warmup === true || s.phase === 'warmup') continue;
        const r = Number(s.r) || 0;
        const v = Number(s.w) || 0;
        if (r > 0) series.push({ r, kg: enLb ? v * LB_EN_KG : v, s: null, type: 'n', fait: true });
      }
      if (!series.length) continue;
      const nom = perso.get(String(ent.id)) ?? '';
      const { id, nomBrut } = correspondreExerciceAvance(nom || String(ent.id ?? ''));
      if (!id) { if (nomBrut && !nonResolus.includes(nomBrut)) nonResolus.push(nomBrut); continue; }
      exercices.push({ ex: id, note: '', lie: false, series });
    }
    if (exercices.length) {
      seances.push({ cle: uuid(), debut, duree_s: Math.round(duree), nom: 'openGym', note: '', exercices });
    }
  }
  const poids = [];
  for (const p of d.bodyweight ?? []) {
    const v = Number(p.w) || 0;
    const kg = enLb ? v * LB_EN_KG : v;
    if (kg >= 20 && p.d) poids.push({ jour: dateIso(p.d), kg });
  }
  return { format: 'openGym', seances, nomsNonResolus: nonResolus, poids };
}

/** Analyse un fichier texte (CSV ou JSON openGym) et renvoie un aperçu d'import. */
export function analyserFichierImport(texte, uniteChoisi = 'kg') {
  const format = detecterFormatImport(texte);
  if (format === 'inconnu') throw new Error('format_inconnu');
  if (format === 'openGym') return analyserOpenGym(texte);
  if (format === 'lyfta') return { format, ...analyserLyfta(texte, uniteChoisi) };
  if (format === 'fitbod') return { format, ...analyserFitbod(texte, uniteChoisi) };
  if (format === 'gymmane') return { format, ...analyserGymmane(texte, uniteChoisi) };
  if (format === 'hevyWeights' || format === 'strongWeights') return analyserPoidsSeul(texte, uniteChoisi);
  try {
    return convertirCsvVersPaquets(texte, uniteChoisi);
  } catch {
    return { format, ...analyserColonnes(texte, uniteChoisi, {
      date: ALIAS.date, groupe: ALIAS.groupe, exercice: ALIAS.exercice, reps: ALIAS.reps,
      kgCol: ALIAS.kg, lbCol: ALIAS.lb, simpleCol: ALIAS.poidsSimple,
    }) };
  }
}

/** Liste des exercices reconnus, pour l'aperçu. */
export function recapImport(resultat) {
  const noms = new Set();
  for (const s of resultat.seances ?? []) for (const e of s.exercices) noms.add(e.ex);
  const series = (resultat.seances ?? []).reduce((n, s) => n + s.exercices.reduce((m, e) => m + e.series.length, 0), 0);
  return {
    seances: (resultat.seances ?? []).length,
    exercices: noms.size,
    series,
    nonResolus: resultat.nomsNonResolus ?? [],
    poids: (resultat.poids ?? []).length,
  };
}
