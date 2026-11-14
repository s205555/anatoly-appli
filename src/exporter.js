/**
 * Export M14 : CSV des séances, sauvegarde ZIP (gymmane.json), FIT Strava.
 * Portage 1:1 des services GymMane backup_zip.dart, fit_export.dart, local_store.dart.
 * ZIP écrit et lu en méthode STORE (sans compression) : suffisant pour nos sauvegardes,
 * et lisible par tout décompresseur standard.
 */
import { EXERCICES } from './exercices.js';

// ===== Utilitaires =====
const slug = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-')
  .replace(/-+/g, '-').replace(/^-+|-+$/g, '');

const indexExercices = (() => {
  const m = new Map();
  for (const e of EXERCICES) m.set(e.id, e);
  return m;
})();

const nomExercice = (id) => indexExercices.get(id)?.fr ?? id;

const csvEscape = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const arrondi = (n) => {
  if (!Number.isFinite(n)) return '';
  const s = n.toFixed(2).replace(/\.?0+$/, '');
  return s === '' ? '0' : s;
};

/** Estimation 1RM (Epley), même règle que les calculateurs de l'app. */
const est1rm = (kg, reps) => {
  if (!kg || !reps) return 0;
  return kg * (1 + reps / 30);
};

// ===== CSV des séances =====
const ENTETES_CSV = ['date', 'exercise', 'muscle', 'set', 'reps', 'weight_kg', 'volume_kg', 'est_1rm_kg', 'distance_km', 'duration_s', 'rpe', 'note'];

export function exportCsv(etat) {
  const lignes = [ENTETES_CSV.join(',')];
  const seances = [...(etat?.seances ?? [])].sort((a, b) => (a.debut < b.debut ? -1 : 1));
  for (const s of seances) {
    for (const ex of s.donnees?.exercices ?? []) {
      const nom = nomExercice(ex.ex);
      const muscle = indexExercices.get(ex.ex)?.muscle ?? '';
      ex.series.forEach((serie, i) => {
        const kg = Number(serie.kg) || 0;
        const reps = Number(serie.r) || 0;
        const volume = kg * reps;
        lignes.push([
          s.debut, nom, muscle, i + 1, reps, arrondi(kg), arrondi(volume), arrondi(est1rm(kg, reps)),
          '', '', serie.rpe ?? '', ex.note ?? '',
        ].map(csvEscape).join(','));
      });
    }
  }
  return lignes.join('\n') + '\n';
}

// ===== CRC32 (polynôme 0xEDB88320) =====
const TABLE_CRC32 = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

export const crc32 = (octets) => {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < octets.length; i += 1) c = TABLE_CRC32[(c ^ octets[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
};

// ===== ZIP minimal (méthode STORE) =====
const enU16 = (v) => [v & 0xFF, (v >>> 8) & 0xFF];
const enU32 = (v) => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
const octetsU32 = (v) => new Uint8Array(enU32(v));
const octetsU16 = (v) => new Uint8Array(enU16(v));
const enc = new TextEncoder();

/** Crée un Blob ZIP (STORE) depuis { nomFichier: Uint8Array|string }. */
export function creerZip(entrees) {
  const corps = [];
  const central = [];
  let offset = 0;
  for (const [nom, donnees] of Object.entries(entrees)) {
    const octets = typeof donnees === 'string' ? enc.encode(donnees) : donnees;
    const crc = crc32(octets);
    const nomB = enc.encode(nom);
    const enteteLocale = [
      0x50, 0x4B, 0x03, 0x04,                     // signature locale
      ...enU16(20),                                // version requise
      ...enU16(0),                                 // flags
      ...enU16(0),                                 // méthode : STORE
      ...enU16(0), ...enU16(0),                    // heure / date
      ...enU32(crc), ...enU32(octets.length), ...enU32(octets.length), // crc, tailles
      ...enU16(nomB.length), ...enU16(0),          // longueur nom, extra
    ];
    const local = new Uint8Array(enteteLocale.length + nomB.length + octets.length);
    local.set(enteteLocale, 0);
    local.set(nomB, enteteLocale.length);
    local.set(octets, enteteLocale.length + nomB.length);
    corps.push(local);
    const fiche = [
      0x50, 0x4B, 0x01, 0x02,                     // signature de l'annuaire central
      ...enU16(20), ...enU16(20),                 // version de création / requise
      ...enU16(0),                                // flags
      ...enU16(0),                                // méthode : STORE
      ...enU16(0), ...enU16(0),                   // heure / date
      ...enU32(crc), ...enU32(octets.length), ...enU32(octets.length),
      ...enU16(nomB.length), ...enU16(0), ...enU16(0), // nom, extra, commentaire
      ...enU16(0), ...enU16(0),                   // disque, attributs internes
      ...enU32(0),                                // attributs externes
      ...enU32(offset),                           // position de l'entrée locale
    ];
    // Le nom figure aussi dans l'annuaire central : sans lui, aucun décompresseur ne relit l'archive.
    const blocCentral = new Uint8Array(fiche.length + nomB.length);
    blocCentral.set(fiche, 0);
    blocCentral.set(nomB, fiche.length);
    central.push(blocCentral);
    offset += local.length;
  }
  const centralB = new Uint8Array(central.reduce((n, c) => n + c.length, 0));
  { let q = 0; for (const c of central) { centralB.set(c, q); q += c.length; } }
  const tailleCentral = centralB.length;
  const eocd = new Uint8Array([
    0x50, 0x4B, 0x05, 0x06, ...enU16(0), ...enU16(0), ...enU16(Object.keys(entrees).length),
    ...enU16(Object.keys(entrees).length), ...enU32(tailleCentral), ...enU32(offset), ...enU16(0),
  ]);
  const total = corps.reduce((n, c) => n + c.length, 0) + tailleCentral + eocd.length;
  const fichier = new Uint8Array(total);
  let p = 0;
  for (const c of corps) { fichier.set(c, p); p += c.length; }
  fichier.set(centralB, p); p += tailleCentral;
  fichier.set(eocd, p);
  return new Blob([fichier], { type: 'application/zip' });
}

/** Liste les entrées d'un ZIP avec leur méthode de compression (0 = STORE, 8 = DEFLATE). */
export function listerZip(octets) {
  if (octets.length < 22) throw new Error('zip_court');
  // EOCD : signature 0x06054b50, cherchée dans les 64 Ko finaux.
  let fin = -1;
  const debutRecherche = Math.max(0, octets.length - 65536);
  for (let i = octets.length - 22; i >= debutRecherche; i -= 1) {
    if (octets[i] === 0x50 && octets[i + 1] === 0x4B && octets[i + 2] === 0x05 && octets[i + 3] === 0x06) { fin = i; break; }
  }
  if (fin < 0) throw new Error('zip_eocd');
  const nb = octets[fin + 10] | (octets[fin + 11] << 8);
  const u32 = (i) => (octets[i] | (octets[i + 1] << 8) | (octets[i + 2] << 16) | (octets[i + 3] << 24)) >>> 0;
  // L'annuaire central commence à l'offset lu dans l'EOCD : on avance de fiche en fiche.
  let pos = u32(fin + 16);
  const entrees = new Map();
  for (let n = 0; n < nb; n += 1) {
    if (pos < 0 || octets[pos] !== 0x50 || octets[pos + 1] !== 0x4B || octets[pos + 2] !== 0x01 || octets[pos + 3] !== 0x02) throw new Error('zip_central');
    const nomLongueur = octets[pos + 28] | (octets[pos + 29] << 8);
    const extraLongueur = octets[pos + 30] | (octets[pos + 31] << 8);
    const commentaireLongueur = octets[pos + 32] | (octets[pos + 33] << 8);
    const offsetLocal = u32(pos + 42);
    const nom = new TextDecoder().decode(octets.subarray(pos + 46, pos + 46 + nomLongueur));
    entrees.set(nom, offsetLocal);
    pos += 46 + nomLongueur + extraLongueur + commentaireLongueur;
  }
  const resultat = [];
  for (const [nom, offsetLocal] of entrees) {
    const methode = octets[offsetLocal + 8] | (octets[offsetLocal + 9] << 8);
    const taille = u32(offsetLocal + 18);
    const nomLongueur = octets[offsetLocal + 26] | (octets[offsetLocal + 27] << 8);
    const extraLongueur = octets[offsetLocal + 28] | (octets[offsetLocal + 29] << 8);
    const debutDonnees = offsetLocal + 30 + nomLongueur + extraLongueur;
    resultat.push({ nom, methode, brut: octets.subarray(debutDonnees, debutDonnees + taille) });
  }
  return resultat;
}

/** Décode un ZIP en Map nom -> Uint8Array. Ne lit que la méthode STORE (nos sauvegardes). */
export function lireZip(octets) {
  const map = new Map();
  for (const e of listerZip(octets)) {
    if (e.methode !== 0) throw new Error(`zip_compresse:${e.nom}`);
    map.set(e.nom, e.brut);
  }
  return map;
}

/** Décode un ZIP avec décompression : accepte aussi les archives DEFLATE (sauvegardes GymMane). */
export async function lireZipAsync(octets) {
  const map = new Map();
  for (const e of listerZip(octets)) {
    if (e.methode === 0) { map.set(e.nom, e.brut); continue; }
    if (e.methode !== 8 || typeof DecompressionStream !== 'function') throw new Error(`zip_compresse:${e.nom}`);
    // DecompressionStream attend un flux brut (deflate-raw), pas l'en-tête zlib.
    const flux = new Blob([e.brut]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    map.set(e.nom, new Uint8Array(await new Response(flux).arrayBuffer()));
  }
  return map;
}

// ===== Sauvegarde complète =====
export function contenuBackup(etat) {
  const profil = etat?.profil ?? {};
  const extensions = profil.extensions ?? {};
  return {
    version: 1,
    origine: 'anatoly',
    sauvegarde: new Date().toISOString(),
    profil: {
      prenom: profil.prenom ?? '',
      unite: profil.unite ?? 'kg',
      objectif_semaine: profil.objectif_semaine ?? 3,
      repos_s: profil.repos_s ?? 90,
      theme: profil.theme ?? 'sombre',
      langue: profil.langue ?? 'fr',
      extensions,
    },
    seances: (etat?.seances ?? []).map((s) => ({
      cle: s.cle, debut: s.debut, duree_s: s.duree_s, nom: s.nom ?? '',
      exercices: s.donnees?.exercices ?? [],
    })),
    poids: etat?.poids ?? [],
    mesures: etat?.mesures ?? [],
    routines: etat?.routines ?? [],
    perso: etat?.perso ?? [],
  };
}

export function creerSauvegardeZip(etat) {
  return creerZip({ 'gymmane.json': JSON.stringify(contenuBackup(etat), null, 2) });
}

const estDate = (v) => !Number.isNaN(Date.parse(v));

/** Restaure une sauvegarde via les API existantes. Renvoie un récapitulatif. */
export async function restaurerSauvegarde(octets, api, { sauverExtensions, apiMesure }) {
  const zip = await lireZipAsync(octets);
  const jsonE = [...zip.entries()].find(([nom]) => nom === 'gymmane.json' || nom.endsWith('.json'));
  if (!jsonE) throw new Error('zip_json');
  const data = JSON.parse(new TextDecoder().decode(jsonE[1]));
  if (!data || typeof data !== 'object') throw new Error('zip_json');
  const recap = { seances: 0, poids: 0, mesures: 0 };
  if (Array.isArray(data.seances) && data.seances.length) {
    const corps = {
      seances: data.seances.map((s) => ({
        cle: String(s.cle ?? crypto.randomUUID()).slice(0, 36) || crypto.randomUUID(),
        debut: estDate(s.debut) ? s.debut : new Date().toISOString(),
        duree_s: Math.max(1, Math.round(Number(s.duree_s) || 3600)),
        nom: String(s.nom ?? '').slice(0, 80),
        exercices: Array.isArray(s.exercices) ? s.exercices : [],
      })).slice(0, 200),
      poids: Array.isArray(data.poids) ? data.poids.filter((p) => estDate(p?.jour) && Number(p?.kg) >= 20).slice(0, 2000) : [],
    };
    const r = await api('POST', '/api/importer', corps);
    recap.seances = r.seances ?? 0;
    recap.poids = r.poids ?? 0;
  }
  const profil = data.profil ?? {};
  if (profil.prenom || profil.unite || profil.objectif_semaine || profil.theme || profil.repos_s) {
    await api('PUT', '/api/reglages', {
      prenom: String(profil.prenom ?? '').slice(0, 60) || 'Sportif',
      langue: profil.langue === 'en' ? 'en' : 'fr',
      unite: profil.unite === 'lb' ? 'lb' : 'kg',
      theme: ['systeme', 'clair', 'sombre', 'amoled'].includes(profil.theme) ? profil.theme : 'sombre',
      repos_s: Math.max(0, Math.min(900, Math.round(Number(profil.repos_s) || 90))),
      objectif_semaine: Math.max(1, Math.min(7, Math.round(Number(profil.objectif_semaine) || 3))),
      extensions: profil.extensions ?? {},
    });
  }
  if (Array.isArray(data.mesures) && typeof apiMesure === 'function') {
    for (const m of data.mesures.slice(0, 500)) {
      if (m?.cle && estDate(m.prise_le ?? m.date)) {
        try { await apiMesure({ cle: m.cle, valeur: Number(m.valeur), prise_le: m.prise_le ?? m.date, note: m.note ?? '' }); recap.mesures += 1; } catch { /* ligne ignorée */ }
      }
    }
  }
  return recap;
}

// ===== FIT Strava (portage de fit_export.dart) =====
const EPOQUE_FIT = 631065600; // 1990-01-01 UTC
const CATEGORIE_INCONNUE = 65534;

const SOUS_CHAINES = [
  ['bench press', 0], ['calf', 1], ['carry', 3], ['chop', 4], ['crunch', 6], ['curl', 7],
  ['deadlift', 8], ['fly', 9], ['hip thrust', 10], ['bridge', 10], ['swing', 12],
  ['hyperextension', 13], ['back extension', 13], ['lateral raise', 14], ['leg curl', 15],
  ['leg raise', 16], ['lunge', 17], ['split squat', 17], ['clean', 18], ['snatch', 18],
  ['plank', 19], ['burpee', 20], ['jump', 20], ['pull-up', 21], ['chin-up', 21],
  ['pulldown', 21], ['push-up', 22], ['row', 23], ['shoulder press', 24],
  ['overhead press', 24], ['military press', 24], ['shrug', 26], ['sit-up', 27],
  ['squat', 28], ['triceps', 30], ['pushdown', 30],
];

function categorieFit(nom) {
  const n = String(nom ?? '').toLowerCase();
  for (const [sous, id] of SOUS_CHAINES) if (n.includes(sous)) return id;
  return CATEGORIE_INCONNUE;
}

const TABLE_CRC16 = (() => {
  const t = new Uint16Array(16);
  for (let i = 0; i < 16; i += 1) {
    let v = i << 12;
    for (let j = 0; j < 12; j += 1) v = v & 0x8000 ? (v << 1) ^ 0x1021 : v << 1;
    t[i] = v & 0xFFFF;
  }
  return t;
})();

export function crcFit(octets) {
  let c = 0;
  for (const b of octets) {
    c = (c << 4) ^ TABLE_CRC16[(c >>> 12) ^ (b >> 4)];
    c = (c << 4) ^ TABLE_CRC16[(c >>> 12) ^ (b & 0x0F)];
    c &= 0xFFFF;
  }
  return c;
}

class EcrivainFit {
  constructor() { this.octets = []; }
  u8(v) { this.octets.push(v & 0xFF); }
  u16(v) { this.octets.push(v & 0xFF, (v >>> 8) & 0xFF); }
  u32(v) { this.octets.push(v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF); }
  enteteLocale(local, global, champs) {
    this.octets.push(0x40 | local, 0x00, 0x00);
    this.u16(global);
    this.u8(champs.length);
    for (const [no, taille, type] of champs) this.octets.push(no, taille, type);
  }
  donnees(local, valeurs) {
    this.octets.push(local);
    for (const [taille, valeur] of valeurs) {
      if (taille === 1) this.u8(valeur);
      else if (taille === 2) this.u16(valeur);
      else this.u32(valeur);
    }
  }
  octetsBruts() { return new Uint8Array(this.octets); }
}

/** Génère le fichier .fit d'une séance. Renvoie Uint8Array. */
export function workoutFit(seance, { pounds = false } = {}) {
  const w = new EcrivainFit();
  const finEpoch = Math.floor(Date.parse(seance.debut) / 1000) + (Number(seance.duree_s) || 3600) - EPOQUE_FIT;
  const duree = Math.max(1, Math.round(Number(seance.duree_s) || 3600));
  const debut = finEpoch - duree;
  const offsetFuseau = -new Date().getTimezoneOffset() * 60;
  // Séries de travail, aplaties avec leur exercice.
  const series = [];
  for (const ex of seance.donnees?.exercices ?? []) {
    ex.series.forEach((s) => { if (s.fait !== false) series.push({ ex, s }); });
  }
  const slot = series.length ? Math.max(1, Math.floor(duree / series.length)) : duree;
  const secondes = (s) => Math.max(1, Math.min(60, Number(s.s) || Math.min(slot, 60)));

  w.enteteLocale(0, 0, [[0, 1, 0x00], [1, 2, 0x84], [2, 2, 0x84], [4, 4, 0x86]]);
  w.donnees(0, [[1, 4], [2, 255], [2, 0], [4, debut]]);

  w.enteteLocale(1, 21, [[253, 4, 0x86], [0, 1, 0x00], [1, 1, 0x00]]);
  w.donnees(1, [[4, debut], [1, 0], [1, 0]]);
  w.donnees(1, [[4, finEpoch], [1, 0], [1, 4]]);

  w.enteteLocale(2, 225, [
    [254, 4, 0x86], [6, 4, 0x86], [0, 4, 0x86], [3, 2, 0x84], [4, 2, 0x84],
    [5, 1, 0x02], [7, 2, 0x84], [9, 2, 0x84], [10, 2, 0x84],
  ]);
  series.forEach(({ ex, s }, i) => {
    const tFin = debut + i * slot + secondes(s);
    w.donnees(2, [
      [4, tFin], [4, tFin - secondes(s)], [4, secondes(s) * 1000],
      [2, Math.min(65534, Math.max(0, Math.round(Number(s.r) || 0)))],
      [2, Math.min(65534, Math.max(0, Math.round(Number(s.kg) || 0) * 16))],
      [1, 1],
      [2, categorieFit(indexExercices.get(ex.ex)?.fr ?? ex.ex)],
      [2, pounds ? 2 : 1],
      [2, i],
    ]);
  });

  w.enteteLocale(3, 19, [[253, 4, 0x86], [2, 4, 0x86], [7, 4, 0x86], [8, 4, 0x86], [0, 1, 0x00], [1, 1, 0x00]]);
  w.donnees(3, [[4, finEpoch], [4, debut], [4, duree * 1000], [4, duree * 1000], [1, 9], [1, 1]]);

  w.enteteLocale(4, 18, [
    [253, 4, 0x86], [2, 4, 0x86], [7, 4, 0x86], [8, 4, 0x86],
    [5, 1, 0x00], [6, 1, 0x00], [25, 2, 0x84], [26, 2, 0x84], [0, 1, 0x00], [1, 1, 0x00],
  ]);
  w.donnees(4, [
    [4, finEpoch], [4, debut], [4, duree * 1000], [4, duree * 1000],
    [1, 10], [1, 20], [2, 0], [2, 1], [1, 8], [1, 1],
  ]);

  w.enteteLocale(5, 34, [[253, 4, 0x86], [0, 4, 0x86], [1, 2, 0x84], [2, 1, 0x00], [3, 1, 0x00], [4, 1, 0x00], [5, 4, 0x86]]);
  w.donnees(5, [[4, finEpoch], [4, duree * 1000], [2, 1], [1, 0], [1, 26], [1, 1], [4, finEpoch + offsetFuseau]]);

  const corps = w.octetsBruts();
  const entete = new Uint8Array([0x0E, 0x20, 0x54, 0x08, 0x00, 0x00, 0x00, 0x00, 0x2E, 0x46, 0x49, 0x54]);
  entete[4] = corps.length & 0xFF;
  entete[5] = (corps.length >>> 8) & 0xFF;
  entete[6] = (corps.length >>> 16) & 0xFF;
  entete[7] = (corps.length >>> 24) & 0xFF;
  const crcEntete = crcFit(entete);
  const fichier = new Uint8Array(12 + 2 + corps.length + 2);
  fichier.set(entete, 0);
  fichier[12] = crcEntete & 0xFF;
  fichier[13] = (crcEntete >>> 8) & 0xFF;
  fichier.set(corps, 14);
  const crcFinal = crcFit(fichier.subarray(0, 14 + corps.length));
  fichier[14 + corps.length] = crcFinal & 0xFF;
  fichier[15 + corps.length] = (crcFinal >>> 8) & 0xFF;
  return fichier;
}

/** Télécharge un Blob (ou via l'API Web Share si disponible). */
export async function telecharger(blob, nom) {
  if (navigator.share && navigator.canShare?.({ files: [new File([blob], nom)] })) {
    try {
      await navigator.share({ files: [new File([blob], nom)] });
      return;
    } catch { /* partage annulé : on retombe sur le téléchargement */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
