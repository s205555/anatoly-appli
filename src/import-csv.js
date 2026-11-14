/**
 * Import CSV côté client : Hevy, Strong, FitNotes, générique. Correspondance vers le catalogue.
 */
import { EXERCICES } from './exercices.js';

const LB_EN_KG = 0.45359237;

function normaliserNomPourCle(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function construireIndexExercices() {
  const idx = new Map();
  for (const e of EXERCICES) {
    for (const t of [e.fr, e.en, ...(e.autres || [])]) {
      const k = normaliserNomPourCle(t);
      if (k) idx.set(k, e.id);
    }
  }
  return idx;
}

let _index;
function indexCatalogue() {
  if (!_index) _index = construireIndexExercices();
  return _index;
}

/**
 * Trouve un id d'exercice du catalogue à partir d'un libellé importé.
 * @returns {{ id: string|null, nomBrut: string }}
 */
export function correspondreExerciceCatalogue(nomBrut) {
  const idx = indexCatalogue();
  const nom = String(nomBrut || '').slice(0, 120);
  const k = normaliserNomPourCle(nom);
  if (!k) return { id: null, nomBrut: nom };
  if (idx.has(k)) return { id: idx.get(k), nomBrut: nom };
  const mots = k.split(' ');
  for (let n = mots.length; n >= 2; n -= 1) {
    for (let i = 0; i <= mots.length - n; i += 1) {
      const sous = mots.slice(i, i + n).join(' ');
      if (idx.has(sous)) return { id: idx.get(sous), nomBrut: nom };
    }
  }
  return { id: null, nomBrut: nom };
}

export function analyserCsvBrut(texte) {
  const lignes = [];
  const max = texte.length;
  let i = 0;
  const sep = texte.includes(';') && !texte.split('\n')[0].includes(',') ? ';' : ',';
  while (i < max) {
    const ligne = [];
    while (i < max) {
      let cell = '';
      if (texte[i] === '"') {
        i += 1;
        while (i < max) {
          if (texte[i] === '"') {
            if (texte[i + 1] === '"') { cell += '"'; i += 2; continue; }
            i += 1;
            break;
          }
          cell += texte[i];
          i += 1;
        }
      } else {
        while (i < max && texte[i] !== sep && texte[i] !== '\n' && texte[i] !== '\r') {
          cell += texte[i];
          i += 1;
        }
      }
      ligne.push(cell.trim());
      if (texte[i] === sep) { i += 1; continue; }
      break;
    }
    if (texte[i] === '\r') i += 1;
    if (texte[i] === '\n') i += 1;
    if (ligne.length === 1 && ligne[0] === '' && i >= max) break;
    if (ligne.some((c) => c !== '')) lignes.push(ligne);
  }
  return lignes;
}

function cols(ligne0) {
  const m = {};
  ligne0.forEach((h, j) => {
    m[String(h).trim().toLowerCase()] = j;
  });
  return m;
}

function num(v) {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `csv-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function dateIso(v) {
  if (!v) return new Date().toISOString();
  const s = String(v).trim();
  const d = Date.parse(s);
  if (!Number.isNaN(d)) return new Date(d).toISOString();
  return new Date().toISOString();
}

/** Conversion vers kg stockés côté serveur : uniteLigne indique l'unité dans la cellule CSV. */
function enKgDepuisValeur(valeur, uniteLigne) {
  if (valeur == null || !Number.isFinite(valeur)) return 0;
  return uniteLigne === 'lb' ? valeur * LB_EN_KG : valeur;
}

export function detecterFormatCsv(entetesLigne) {
  const h = entetesLigne.map((x) => String(x).trim().toLowerCase());
  if (h.includes('exercise_title') && h.includes('start_time')) return 'hevy';
  if (h.includes('workout name') && h.includes('exercise name')) return 'strong';
  if (h.includes('exercise') && h.some((x) => x.includes('weight (kgs)') || x.includes('weight (lbs)'))) return 'fitnotes';
  return 'generique';
}

/**
 * @returns {{ format: string, seances: object[], nomsNonResolus: string[] }}
 */
export function convertirCsvVersPaquets(texte, uniteChoisi = 'kg') {
  const lignes = analyserCsvBrut(texte.replace(/^\uFEFF/, ''));
  if (lignes.length < 2) throw new Error('CSV trop court');
  const format = detecterFormatCsv(lignes[0]);
  const h = cols(lignes[0]);
  const nonResolus = [];

  const ajouterSerie = (parEx, nomEx, serie) => {
    const { id, nomBrut } = correspondreExerciceCatalogue(nomEx);
    if (!id) {
      if (nomBrut && !nonResolus.includes(nomBrut)) nonResolus.push(nomBrut);
      return;
    }
    if (!parEx.has(id)) parEx.set(id, []);
    parEx.get(id).push(serie);
  };

  if (format === 'hevy') {
    const iTitle = h.title;
    const iStart = h.start_time;
    const iEx = h.exercise_title;
    const iSet = h.set_index;
    const iWk = h.weight_kg;
    const iWl = h.weight_lbs;
    const iRep = h.reps;
    const iRpe = h.rpe;
    const iType = h.set_type;
    const mapSeance = new Map();
    for (let r = 1; r < lignes.length; r += 1) {
      const row = lignes[r];
      const titre = (iTitle != null ? row[iTitle] : '') || 'Import';
      const start = iStart != null ? row[iStart] : '';
      const key = `${titre}\n${start}`;
      if (!mapSeance.has(key)) mapSeance.set(key, []);
      mapSeance.get(key).push(row);
    }
    const seances = [];
    for (const [key, rows] of mapSeance) {
      const [titre, start] = key.split('\n');
      const parEx = new Map();
      const sorted = [...rows].sort((a, b) => {
        const ia = iSet != null ? num(a[iSet]) ?? 0 : 0;
        const ib = iSet != null ? num(b[iSet]) ?? 0 : 0;
        return ia - ib;
      });
      for (const row of sorted) {
        const nom = row[iEx] || '';
        let ul = 'kg';
        let val = 0;
        if (iWk != null && row[iWk] !== '' && row[iWk] != null) { val = num(row[iWk]) ?? 0; ul = 'kg'; }
        else if (iWl != null && row[iWl] !== '' && row[iWl] != null) { val = num(row[iWl]) ?? 0; ul = 'lb'; }
        const kg = enKgDepuisValeur(val, ul);
        const reps = num(row[iRep]) ?? 0;
        const typeBrut = String(row[iType] || '').toLowerCase();
        let type = 'n';
        if (typeBrut.includes('warm')) type = 'e';
        else if (typeBrut.includes('drop')) type = 'd';
        else if (typeBrut.includes('fail')) type = 'f';
        const serie = { r: reps, kg, s: null, type, fait: true };
        if (iRpe != null && row[iRpe] !== '') { const rp = num(row[iRpe]); if (rp != null) serie.rpe = rp; }
        ajouterSerie(parEx, nom, serie);
      }
      seances.push({
        cle: uuid(),
        debut: dateIso(start),
        duree_s: 3600,
        nom: String(titre).slice(0, 80),
        note: '',
        exercices: [...parEx.entries()].map(([ex, series]) => ({ ex, note: '', lie: false, series })),
      });
    }
    return { format: 'hevy', seances, nomsNonResolus: nonResolus };
  }

  if (format === 'strong') {
    const iDate = h.date;
    const iName = h['workout name'];
    const iEx = h['exercise name'];
    const iP = h.weight;
    const iR = h.reps;
    const iRpe = h.rpe;
    const mapSeance = new Map();
    for (let r = 1; r < lignes.length; r += 1) {
      const row = lignes[r];
      const key = `${row[iDate] || ''}|${row[iName] || ''}`;
      if (!mapSeance.has(key)) mapSeance.set(key, []);
      mapSeance.get(key).push(row);
    }
    const seances = [];
    const ulStrong = uniteChoisi === 'lb' ? 'lb' : 'kg';
    for (const [, rows] of mapSeance) {
      const key0 = rows[0];
      const d = key0[iDate] || '';
      const nom = key0[iName] || '';
      const parEx = new Map();
      for (const row of rows) {
        const val = num(row[iP]) ?? 0;
        const kg = enKgDepuisValeur(val, ulStrong);
        const serie = { r: num(row[iR]) ?? 0, kg, s: null, type: 'n', fait: true };
        if (iRpe != null && row[iRpe] !== '') { const rp = num(row[iRpe]); if (rp != null) serie.rpe = rp; }
        ajouterSerie(parEx, row[iEx] || '', serie);
      }
      seances.push({
        cle: uuid(),
        debut: dateIso(d),
        duree_s: 3600,
        nom: String(nom || 'Strong').slice(0, 80),
        note: '',
        exercices: [...parEx.entries()].map(([ex, series]) => ({ ex, note: '', lie: false, series })),
      });
    }
    return { format: 'strong', seances, nomsNonResolus: nonResolus };
  }

  if (format === 'fitnotes') {
    const iDate = h.date;
    const iEx = h.exercise;
    let iWk = null;
    let iWl = null;
    for (const name of Object.keys(h)) {
      if (name.includes('weight') && name.includes('kgs')) iWk = h[name];
      if (name.includes('weight') && name.includes('lbs')) iWl = h[name];
    }
    const iRep = h.reps;
    const mapSeance = new Map();
    for (let r = 1; r < lignes.length; r += 1) {
      const row = lignes[r];
      const key = row[iDate] || 'x';
      if (!mapSeance.has(key)) mapSeance.set(key, []);
      mapSeance.get(key).push(row);
    }
    const seances = [];
    for (const [d, rows] of mapSeance) {
      const parEx = new Map();
      for (const row of rows) {
        let val = 0;
        let ul = 'kg';
        if (iWk != null && row[iWk] !== '') { val = num(row[iWk]) ?? 0; ul = 'kg'; }
        else if (iWl != null && row[iWl] !== '') { val = num(row[iWl]) ?? 0; ul = 'lb'; }
        const kg = enKgDepuisValeur(val, ul);
        const serie = { r: num(row[iRep]) ?? 0, kg, s: null, type: 'n', fait: true };
        ajouterSerie(parEx, row[iEx] || '', serie);
      }
      seances.push({
        cle: uuid(),
        debut: dateIso(rows[0][iDate]),
        duree_s: 3600,
        nom: 'FitNotes',
        note: '',
        exercices: [...parEx.entries()].map(([ex, series]) => ({ ex, note: '', lie: false, series })),
      });
    }
    return { format: 'fitnotes', seances, nomsNonResolus: nonResolus };
  }

  // Générique : colonnes date, nom_seance, exercice, reps, kg (kg affichés ou selon unité choisie)
  const iDate = h.date ?? h.jour;
  const iNom = h.seance ?? h['workout'] ?? h['nom_seance'];
  const iEx = h.exercice ?? h.exercise;
  const iRep = h.reps;
  const iKg = h.kg ?? h.poids ?? h.weight;
  const parDate = new Map();
  for (let r = 1; r < lignes.length; r += 1) {
    const row = lignes[r];
    const d = iDate != null ? row[iDate] : `ligne-${r}`;
    const nomS = iNom != null ? row[iNom] : 'Séance';
    const k = `${d}|${nomS}`;
    if (!parDate.has(k)) parDate.set(k, []);
    parDate.get(k).push(row);
  }
  const seances = [];
  for (const [, rows] of parDate) {
    const parEx = new Map();
    const d0 = iDate != null ? rows[0][iDate] : '';
    const n0 = iNom != null ? rows[0][iNom] : 'Import';
    for (const row of rows) {
      const val = num(row[iKg]) ?? 0;
      const kg = uniteChoisi === 'lb' ? val * LB_EN_KG : val;
      const serie = { r: num(row[iRep]) ?? 0, kg, s: null, type: 'n', fait: true };
      ajouterSerie(parEx, row[iEx] || '', serie);
    }
    seances.push({
      cle: uuid(),
      debut: dateIso(d0),
      duree_s: 2400,
      nom: String(n0).slice(0, 80),
      note: '',
      exercices: [...parEx.entries()].map(([ex, series]) => ({ ex, note: '', lie: false, series })),
    });
  }
  return { format: 'generique', seances, nomsNonResolus: nonResolus };
}

/** Corps JSON pour POST /api/importer (tableau poids optionnel séparé). */
export function preparerCorpsImportateur(resultatCsv, poids = []) {
  return { seances: resultatCsv.seances, poids };
}
