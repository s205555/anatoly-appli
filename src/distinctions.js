/**
 * Distinctions et médailles SVG (calcul côté client à partir des séances).
 */
import { h } from 'preact';

const COMPTER_SERIE = (s) => s.fait !== false && s.type !== 'e';

function volumeKgSeance(donnees) {
  let v = 0;
  for (const e of donnees.exercices || []) {
    for (const s of e.series || []) {
      if (COMPTER_SERIE(s)) v += (s.kg || 0) * (s.r || 0);
    }
  }
  return v;
}

function compteSeries(donnees) {
  let n = 0;
  for (const e of donnees.exercices || []) for (const s of e.series || []) if (COMPTER_SERIE(s)) n += 1;
  return n;
}

function dureeSecondes(s) {
  return s.duree_s || 0;
}

function lundi(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

function jourLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function semaineAvecEntrainement(seances, decalage) {
  const debut = lundi();
  debut.setDate(debut.getDate() + 7 * decalage);
  const fin = new Date(debut);
  fin.setDate(fin.getDate() + 7);
  const jours = new Set();
  for (const s of seances) {
    const d = new Date(typeof s.debut === 'string' && s.debut.includes('T') ? s.debut : `${String(s.debut).replace(' ', 'T')}Z`);
    if (d >= debut && d < fin) jours.add(jourLocal(d));
  }
  return jours.size;
}

/** Semaines consécutives avec au moins une séance (en remontant depuis la semaine courante). */
function serieSemainesConsecutives(seances) {
  let n = 0;
  for (let i = 0; i < 520; i += 1) {
    if (semaineAvecEntrainement(seances, -i) > 0) n += 1;
    else break;
  }
  return n;
}

/** Au moins une fois une série comptée avec une charge supérieure au meilleur antérieur sur le même exercice. */
function aUnRecordPoids(triChrono) {
  const maxParEx = new Map();
  for (const s of triChrono) {
    for (const e of s.donnees?.exercices || []) {
      let maxSerie = 0;
      for (const ser of e.series || []) {
        if (!COMPTER_SERIE(ser)) continue;
        maxSerie = Math.max(maxSerie, ser.kg || 0);
      }
      const avant = maxParEx.get(e.ex) ?? 0;
      if (avant > 0 && maxSerie > avant) return s;
      maxParEx.set(e.ex, Math.max(avant, maxSerie));
    }
  }
  return null;
}

const dateSeance = (s) => new Date(typeof s.debut === 'string' && s.debut.includes('T') ? s.debut : `${String(s.debut).replace(' ', 'T')}Z`);

/** Date d'obtention (awardWonAt) : la séance où le cumul a passé le seuil, en ordre chronologique. */
function datesCumul(tri) {
  const cumul = { seances: 0, series: 0, tonnes: 0, heures: 0 };
  const dates = {};
  for (const s of tri) {
    cumul.seances += 1;
    cumul.series += compteSeries(s.donnees);
    cumul.tonnes += volumeKgSeance(s.donnees) / 1000;
    cumul.heures += dureeSecondes(s) / 3600;
    for (const d of DEFIS) if (cumul[d.cle] !== undefined && !dates[d.id] && cumul[d.cle] >= d.seuil) dates[d.id] = dateSeance(s);
  }
  return dates;
}

/** Jours consécutifs avec au moins une séance (en remontant depuis aujourd'hui). */
function serieJoursConsecutifs(seances) {
  if (!seances.length) return 0;
  const jours = new Set();
  for (const s of seances) {
    const d = new Date(typeof s.debut === 'string' && s.debut.includes('T') ? s.debut : `${String(s.debut).replace(' ', 'T')}Z`);
    jours.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  let n = 0;
  const aujourdhui = new Date();
  for (let i = 0; i < 3650; i++) {
    const d = new Date(aujourdhui);
    d.setDate(d.getDate() - i);
    const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (jours.has(cle)) n += 1;
    else break;
  }
  return n;
}


// Les 20 distinctions GymMane (ids originaux, seuils identiques).
const DEFIS = [
  { id: 'firstStep', cle: 'seances', seuil: 1, titreFr: 'Premier pas', titreEn: 'First step', ligneFr: 'Bienvenue sur Anatoly. Celle-ci est offerte.', ligneEn: 'Welcome to Anatoly. This one is on the house.' },
  { id: 'firstWorkout', cle: 'seances', seuil: 1, titreFr: 'Première séance', titreEn: 'First workout', ligneFr: 'La première est enregistrée. C’est la plus difficile.', ligneEn: 'The first one is logged. That is the hard one.' },
  { id: 'firstRoutine', cle: 'programmes', seuil: 1, titreFr: 'Premier programme', titreEn: 'First routine', ligneFr: 'Vous avez maintenant un plan auquel revenir.', ligneEn: 'You have a plan to come back to.' },
  { id: 'firstRecord', cle: 'record', seuil: 1, titreFr: 'Premier record', titreEn: 'First record', ligneFr: 'Vous avez battu votre meilleur résultat sur un exercice.', ligneEn: 'You beat your best lift on an exercise.' },
  { id: 'streak3', cle: 'jours', seuil: 3, titreFr: 'Trois jours d’affilée', titreEn: 'Three in a row', ligneFr: 'Trois jours de suite. C’est comme ça que ça commence.', ligneEn: 'Three days straight. This is how it starts.' },
  { id: 'tonne1', cle: 'tonnes', seuil: 1, titreFr: 'Une tonne', titreEn: 'One tonne', ligneFr: 'Mille kilos soulevés au total sur vos séries.', ligneEn: 'A thousand kilos lifted across your sets.' },
  { id: 'sets100', cle: 'series', seuil: 100, titreFr: 'Cent séries', titreEn: 'One hundred sets', ligneFr: 'Cent séries terminées, une à la fois.', ligneEn: 'A hundred sets finished, one at a time.' },
  { id: 'streak7', cle: 'jours', seuil: 7, titreFr: 'Sept jours', titreEn: 'Seven days', ligneFr: 'Une semaine complète sans manquer un jour.', ligneEn: 'A full week without missing a day.' },
  { id: 'workouts10', cle: 'seances', seuil: 10, titreFr: 'Dix séances', titreEn: 'Ten workouts', ligneFr: 'Les dix premières sont celles qui font la différence.', ligneEn: 'The first ten are the ones that decide it.' },
  { id: 'hours10', cle: 'heures', seuil: 10, titreFr: 'Dix heures', titreEn: 'Ten hours', ligneFr: 'Dix heures d’entraînement au compteur.', ligneEn: 'Ten hours of training on the clock.' },
  { id: 'workouts50', cle: 'seances', seuil: 50, titreFr: 'Cinquante séances', titreEn: 'Fifty workouts', ligneFr: 'Cinquante séances derrière vous.', ligneEn: 'Fifty sessions behind you.' },
  { id: 'tonnes10', cle: 'tonnes', seuil: 10, titreFr: 'Dix tonnes', titreEn: 'Ten tonnes', ligneFr: 'Dix mille kilos sont passés entre vos mains.', ligneEn: 'Ten thousand kilos have gone through your hands.' },
  { id: 'hours50', cle: 'heures', seuil: 50, titreFr: 'Cinquante heures', titreEn: 'Fifty hours', ligneFr: 'Cinquante heures passées à vous entraîner.', ligneEn: 'Fifty hours inside the gym.' },
  { id: 'streak30', cle: 'jours', seuil: 30, titreFr: 'Trente jours', titreEn: 'Thirty days', ligneFr: 'Un mois d’affilée. C’est maintenant une habitude.', ligneEn: 'A month straight. This is a habit now.' },
  { id: 'sets1000', cle: 'series', seuil: 1000, titreFr: 'Mille séries', titreEn: 'A thousand sets', ligneFr: 'Une série à la fois, jusqu’à mille.', ligneEn: 'One set at a time, a thousand of them.' },
  { id: 'workouts100', cle: 'seances', seuil: 100, titreFr: 'Cent séances', titreEn: 'One hundred workouts', ligneFr: 'Cent séances enregistrées du début à la fin.', ligneEn: 'A hundred sessions logged, start to finish.' },
  { id: 'hours100', cle: 'heures', seuil: 100, titreFr: 'Cent heures', titreEn: 'One hundred hours', ligneFr: 'Cent heures sous la barre, chronomètre en main.', ligneEn: 'A hundred hours under the bar, stopwatch in hand.' },
  { id: 'streak100', cle: 'jours', seuil: 100, titreFr: 'Cent jours', titreEn: 'One hundred days', ligneFr: 'Cent jours d’affilée. Ce n’est plus de la motivation, c’est devenu une habitude.', ligneEn: 'A hundred days in a row. That is not motivation any more, that is who you are.' },
  { id: 'tonnes100', cle: 'tonnes', seuil: 100, titreFr: 'Cent tonnes', titreEn: 'One hundred tonnes', ligneFr: 'Tout ce que vous avez soulevé atteint 100 000 kg.',ligneEn: 'Everything you have lifted adds up to 100,000 kg.' },
  { id: 'workouts365', cle: 'seances', seuil: 365, titreFr: 'Trois cent soixante-cinq', titreEn: 'Three hundred and sixty-five', ligneFr: 'Une séance pour chaque jour d’une année, enregistrée une par une.', ligneEn: 'A workout for every day of a year, logged one by one.' },
];

function mesuresAgregees(seances, programmes = 0) {
  const nb = seances.length;
  let series = 0;
  let vol = 0;
  let sec = 0;
  const tri = [...seances].sort((a, b) => String(a.debut).localeCompare(String(b.debut)));
  for (const s of seances) {
    series += compteSeries(s.donnees);
    vol += volumeKgSeance(s.donnees);
    sec += dureeSecondes(s);
  }
  return {
    nb,
    series,
    tonnes: vol / 1000,
    heures: sec / 3600,
    jours: serieJoursConsecutifs(seances),
    programmes,
    seanceRecord: aUnRecordPoids(tri),
    dates: datesCumul(tri),
  };
}

function valeurDefi(d, m) {
  if (d.cle === 'seances') return m.nb;
  if (d.cle === 'series') return m.series;
  if (d.cle === 'tonnes') return m.tonnes;
  if (d.cle === 'heures') return m.heures;
  if (d.cle === 'jours') return m.jours;
  if (d.cle === 'programmes') return m.programmes;
  if (d.cle === 'record') return m.seanceRecord ? 1 : 0;
  return 0;
}

/**
 * Les 20 distinctions GymMane, débloquées ou non.
 * @param {Array} seances objets { debut, duree_s, donnees }
 * @param {string} lang 'fr' | 'en'
 * @param {number} programmes nombre de programmes créés
 */
export function calculerDistinctions(seances, lang = 'fr', programmes = 0) {
  const m = mesuresAgregees(seances || [], programmes);
  return DEFIS.map((d) => {
    const valeur = valeurDefi(d, m);
    const debloque = d.cle === 'record' ? !!m.seanceRecord : valeur >= d.seuil;
    let obtenue = null;
    if (debloque && d.cle === 'record') obtenue = dateSeance(m.seanceRecord);
    else if (debloque && d.cle === 'jours') { obtenue = new Date(); obtenue.setDate(obtenue.getDate() - (m.jours - d.seuil)); }
    else if (debloque) obtenue = m.dates[d.id] ?? null;
    return {
      id: d.id,
      titre: lang === 'en' ? d.titreEn : d.titreFr,
      ligne: lang === 'en' ? d.ligneEn : d.ligneFr,
      debloque,
      obtenue,
      valeur,
      objectif: d.seuil,
    };
  });
}

// Dessin des médailles : les images de GymMane (assets/badges, GPLv3), version éteinte « _off » pour une médaille à gagner.
const IMG_MEDAILLES = '/statique/app-img/medailles/';
const IDS = new Set(DEFIS.map((d) => d.id));

// Anciens identifiants (écran Réglages) : même visuel que la distinction GymMane correspondante.
const ALIAS_MEDAILLE = {
  seance_1: 'firstStep', seance_5: 'firstWorkout', seance_10: 'workouts10', seance_25: 'workouts50',
  seance_50: 'workouts50', seance_100: 'workouts100', palier_200_seances: 'workouts365',
  series_100: 'sets100', series_500: 'sets100', series_1000: 'sets1000', palier_2500_series: 'sets1000',
  tonne_1: 'tonne1', tonne_10: 'tonnes10', tonne_100: 'tonnes100',
  heures_10: 'hours10', heures_50: 'hours50', palier_100_h: 'hours100',
  streak_4: 'streak7', streak_12: 'streak30', record_1: 'firstRecord',
};

export function IcMedaille({ id, verrou = false }) {
  const nom = ALIAS_MEDAILLE[id] ?? id;
  return h('img', { class: 'ic-medaille', src: `${IMG_MEDAILLES}${IDS.has(nom) ? nom : 'firstStep'}${verrou ? '_off' : ''}.webp`, width: 48, height: 48, alt: '', decoding: 'async', draggable: false });
}
