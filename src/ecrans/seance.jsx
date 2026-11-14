// Séance en direct (session_screen.dart) : barre live, bande de progression, en-tête d'exercice, carte des séries, feuilles de la séance.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import {
  abandonner, afficher, assiste, bilanSeance, chrono, dernieresSeries, echelonBattu, enCours, etat, majEnCours, meilleures, minSec, nombre, nomExercice, nouvelExercice,
  dechargePile, poids, poidsCorpsKg, prochaineCharge, reglagesDe, scoreAssiste, secondesEcouleesSession, surPile, terminer, toast, tousExercices, trouverExercice, unite, versAffichage, versKg, volume,
} from '../donnees.js';
import { alleger, calculerDisquesParCote, choixBarresPourUnite, estSemaineDecharge } from '../calculatrices.js';
import { historiqueDe, prochainPlan, progressionActive, regleDe, seancesBloquees } from '../progression.js';
import { ecrireM13, lireM13 } from './reglages-m13.js';
import { arreterVoix, dire, jouerSonRepos, preparerContexteAudio } from '../sons.js';
import { IllustrationExercice } from '../illustrations.js';
import { langue, t, dp } from '../i18n.js';
import { demanderRegle, Dialogue, Feuille, Ic, Nombre, Recherche, Vide } from '../ui.jsx';
import { m24 } from '../i18n/m24.js';
import { FormExercice, lireFavoris, modeDe, Vignette } from './exercices.jsx';
import { SilhouettePar } from '../silhouette-paresseuse.jsx';
import { intensitesDe } from './programmes-legers.jsx';
import { M03 } from '../i18n/m03.js';
import { Confettis } from './recompenses.jsx';
import { BarreManuelle, Decompte } from './l26-jour.jsx';
import { BandeNotes } from './l26-notes.jsx';
import { L26 } from '../i18n/l26.js';
import { altsDe } from './l26-alts.jsx';
import './m03.css';

const REPOS_SUPER_SERIE_S = 20;
// Bornes de GymMane : règle de répétitions jusqu'à 100, charge jusqu'à 700 kg (1540 lb).
const MAX_REPS = 100;
// Pas des boutons moins et plus : réglage « Pas de poids » (unité affichée), sinon 2,5 kg ou 5 lb.
const pasCharge = () => Number(lireM13().pasPoids) || (unite() === 'lb' ? 5 : 2.5);
const maxCharge = () => (unite() === 'lb' ? 1540 : 700);
// Préférences enregistrées par les réglages (extensions.preferences).
const pref = () => etat.value?.profil?.extensions?.preferences ?? {};
const sonRepos = () => pref().sonRepos || etat.value?.profil?.son_repos || 'bip';

const CLE_PREPAREE = 'an_seance_preparee';
const DECHARGES = { s4: 4, s5: 5, s6: 6, s8: 8 };

/** Remplit l'étape suivante d'un exercice pas encore commencé, selon sa règle de progression (réglage global ou celle du programme). */
function preparerExercice(x) {
  if (x.series.some((v) => v.fait)) return;
  const def = trouverExercice(x.ex);
  if (def?.mesure === 'duree') { tenueSuivante(x, def); return; }
  // « Commencer par des séries d'échauffement » de la fiche : la montée en charge est posée à l'ouverture (_openingSetsRaw).
  if (def?.mesure === 'poids' && !def.sansPoids && reglagesDe(x.ex).echauffement && !x.series.some((v) => v.type === 'e')) x.series.unshift(...seriesEchauffement(x.series));
  const etape = planDe(x.ex);
  if (!etape) return;
  const travail = x.series.filter((v) => v.type !== 'e');
  // « Reps, séries et charge » décide aussi du nombre de séries de travail.
  if (regleDe(x.ex).k === 'volume' && travail.length && etape.series.length !== travail.length) {
    const modele = travail.at(-1);
    if (etape.series.length > travail.length) x.series.push(...Array.from({ length: etape.series.length - travail.length }, () => ({ ...modele, fait: false })));
    else { const retirees = new Set(travail.slice(etape.series.length)); x.series = x.series.filter((v) => !retirees.has(v)); }
  }
  let k = 0;
  for (const v of x.series) {
    if (v.type === 'e') continue;
    const p = etape.series[Math.min(k++, etape.series.length - 1)];
    v.r = p.r;
    if (p.kg != null) v.kg = p.kg;
  }
}

/** Plan de progression corrigé par la fiche : machine assistée (la charge descend) et pile de poids (charge voisine de la pile). */
function planDe(ex) {
  const plan = prochainPlan(ex);
  if (!plan?.series?.length) return plan;
  const aide = assiste(trouverExercice(ex));
  const avant = dernieresSeries(ex).filter((v) => v.type !== 'e');
  return { ...plan, series: plan.series.map((p, k) => {
    const der = avant[Math.min(k, avant.length - 1)]?.kg;
    if (p.kg == null || der == null) return p;
    // Décharge sur une pile (deloadWeight) : sous la charge allégée du pourcentage de la règle, l'aide monte d'un cran.
    if (plan.coup === 'decharge' && !aide && dechargePile(ex, der, regleDe(ex).d) != null) return { ...p, kg: dechargePile(ex, der, regleDe(ex).d) };
    const kg = aide ? Math.max(0, 2 * der - p.kg) : p.kg;
    return { ...p, kg: Math.abs(kg - der) > 0.001 ? surPile(ex, der, Math.sign(kg - der)) : surPile(ex, kg) };
  }) };
}
/** « Progression au temps » de la fiche (nextHoldSeconds) : +N s quand toutes les séries de la dernière fois ont tenu la première. */
function tenueSuivante(x, def) {
  const pas = Number(reglagesDe(x.ex).tenue) || 0;
  if (pas <= 0 || modeDe(def) !== 'time') return;
  const secs = dernieresSeries(x.ex).filter((v) => v.type !== 'e' && v.s > 0).map((v) => v.s);
  if (!secs.length) return;
  const vise = secs.every((v) => v >= secs[0]) ? secs[0] + pas : secs[0];
  for (const v of x.series) if (v.type !== 'e') v.s = vise;
}

/** Semaine de décharge du réglage : l'ancre est posée au premier usage et refaite quand le réglage change. */
function semaineDecharge() {
  const r = lireM13();
  const toutes = DECHARGES[r.decharge];
  if (!toutes) return false;
  let ancre = r.dechargeDepuis;
  if (!ancre || ancre.pour !== r.decharge) { ancre = { pour: r.decharge, date: new Date().toISOString() }; ecrireM13({ ...r, dechargeDepuis: ancre }); }
  return estSemaineDecharge(toutes, ancre.date);
}

const TYPES_SERIE = ['n', 'e', 'd', 'f', 'rp', 'c'];
const libelleTypeCourt = (k) => {
  if (t.typesCourts[k]) return t.typesCourts[k];
  if (k === 'rp') return 'RP';
  if (k === 'c') return 'C';
  return k;
};


// Réglage « Voix pendant la séance » (VoiceCoach de l'original) : repos et série suivante annoncés, 3, 2, 1, puis le départ.
const parler = (texte) => { if (lireM13().voixCoach !== true || !texte) return; arreterVoix(); dire(texte); };
const voixDuree = (sec) => {
  const v = mx().voix;
  const mn = Math.floor(sec / 60), x = Math.round(sec % 60);
  if (!mn) return v.secondes(x);
  return x ? `${v.minutes(mn)} ${v.et} ${v.secondes(x)}` : v.minutes(mn);
};
function voixSuivante(ec) {
  if (!ec?.exercices.length) return null;
  let i = Math.min(ec.courant ?? 0, ec.exercices.length - 1);
  let k = ec.exercices[i].series.findIndex((x) => !x.fait);
  if (k < 0) {
    i = ec.exercices.findIndex((x, j) => j > i && x.series.some((v) => !v.fait));
    if (i < 0) return null;
    k = ec.exercices[i].series.findIndex((x) => !x.fait);
  }
  const e = ec.exercices[i];
  const st = e.series[k];
  const v = mx().voix;
  const def = trouverExercice(e.ex);
  const charge = def?.mesure === 'duree' ? [st.km ? `${nombre(st.km, 2)} km` : '', voixDuree(st.s ?? 0)].filter(Boolean).join(', ')
    : st.kg > 0 && def?.mesure !== 'corps' ? v.charge(st.r ?? 0, `${poids(st.kg)} ${unite()}`) : v.reps(st.r ?? 0);
  return v.suivant(nomExercice(def) || e.ex, charge);
}

function useTic(ms = 1000) {
  const [, f] = useState(0);
  useEffect(() => {
    const i = setInterval(() => f((x) => x + 1), ms);
    return () => clearInterval(i);
  }, [ms]);
}

function useEcranAllume() {
  useEffect(() => {
    if (lireM13().ecranAllume === false) return undefined; // réglage « Garder l'écran allumé »
    let verrou = null;
    let fini = false;
    const prendre = async () => {
      try {
        if (!fini && document.visibilityState === 'visible') verrou = await navigator.wakeLock?.request('screen');
      } catch { /* refusé */ }
    };
    prendre();
    document.addEventListener('visibilitychange', prendre);
    return () => {
      fini = true;
      document.removeEventListener('visibilitychange', prendre);
      verrou?.release?.().catch(() => {});
    };
  }, []);
}

function reposEffectif(r, enPauseSession) {
  if (!r) return { reste: 0, total: 0, ecoule: 0 };
  if (enPauseSession && r.gel) {
    const reste = Math.max(0, r.gel.reste);
    const total = r.total || 1;
    const ecoule = Math.max(0, total - reste);
    return { reste, total, ecoule };
  }
  const total = r.total || 1;
  const reste = Math.max(0, (r.fin - Date.now()) / 1000);
  const ecoule = Math.max(0, total - reste);
  return { reste, total, ecoule };
}

function compteSeriesFaites(exercices) {
  return exercices.reduce((n, e) => n + e.series.filter((x) => x.fait).length, 0);
}

function compteSeriesTotal(exercices) {
  return exercices.reduce((n, e) => n + e.series.length, 0);
}

function toutesSeriesFaites(ex) {
  return ex.series.length > 0 && ex.series.every((s) => s.fait);
}

function Repos({ enPauseSession }) {
  const ec = enCours.value;
  useTic(250);
  const r = ec?.repos;
  const { reste, total, ecoule } = reposEffectif(r, enPauseSession);
  const compte = useRef('');
  useEffect(() => {
    if (!r || enPauseSession || r.gel) return;
    const n = Math.ceil(reste);
    if (n >= 1 && n <= 3 && compte.current !== `${r.fin}-${n}`) { compte.current = `${r.fin}-${n}`; parler(String(n)); }
    if (reste <= 0) {
      parler(mx().voix.go);
      if (lireM13().styleAlarme !== 'vibration') jouerSonRepos(sonRepos());
      navigator.vibrate?.([200, 100, 200]);
      afficher(t.seance.finRepos);
      majEnCours((s) => ({ ...s, repos: null }));
    }
  });

  const ajuster = (d) => {
    majEnCours((s) => {
      if (!s.repos) return s;
      if (s.enPause && s.repos.gel) {
        const nu = Math.max(1, s.repos.total + d);
        const rest = Math.max(1, Math.ceil(s.repos.gel.reste) + d);
        return { ...s, repos: { ...s.repos, total: nu, gel: { ...s.repos.gel, reste: rest } } };
      }
      // Part de la valeur affichée (arrondie au plafond) : +15 puis −15 rend exactement l'affichage de départ.
      const affiche = Math.ceil(Math.max(0, (s.repos.fin - Date.now()) / 1000));
      return {
        ...s,
        repos: {
          fin: Date.now() + Math.max(1, affiche + d) * 1000,
          total: Math.max(1, s.repos.total + d),
        },
      };
    });
  };

  const passer = () => majEnCours((s) => ({ ...s, repos: null }));

  if (!r || reste <= 0) return null;

  const faites = compteSeriesFaites(ec.exercices);
  const tot = compteSeriesTotal(ec.exercices) || 1;
  const scale = Math.min(1, reste / total);

  return (
    <div class="repos-bandeau" role="timer" aria-live="polite" aria-label={`${t.seance.repos}, ${minSec(Math.ceil(reste))}`}>
      <span class="repos-bandeau-barre" style={`transform:scaleX(${scale})`} aria-hidden="true" />
      {/* Toucher le minuteur (TimerPanel onTap, _editRest) : règle de 5 s à 10 min, « Passer le repos » pour l'arrêter. */}
      <button type="button" class="repos-bandeau-principal l26-repos-changer" aria-label={`${L26().minuteurRepos}${dp()}${minSec(Math.ceil(reste))}`} onClick={async () => {
        const X = L26();
        const v = await demanderRegle({ titre: X.minuteurRepos, valeur: Math.max(5, Math.round(reste / 5) * 5), min: 5, max: 600, pas: 5, majeur: 6, format: (n) => minSec(Math.round(n)), etiquette: (n) => minSec(Math.round(n)), aide: X.glisserPasser, effacer: X.passerRepos });
        if (v === undefined || !enCours.value?.repos) return;
        if (v === null) { passer(); return; }
        const n = Math.min(600, Math.max(5, Math.round(v)));
        majEnCours((s) => ({ ...s, repos: s.enPause && s.repos?.gel ? { ...s.repos, total: n, gel: { ...s.repos.gel, reste: n } } : { fin: Date.now() + n * 1000, total: n } }));
      }}>
        <span class="repos-bandeau-temps">{minSec(Math.ceil(reste))}</span>
        <span class="repos-bandeau-ecoule tabular-nums">
          {minSec(Math.floor(ecoule))} / {minSec(Math.ceil(total))}
        </span>
        <span class="l26-repos-indice">{L26().toucherChanger}</span>
      </button>
      <p class="repos-bandeau-series">
        {t.seance.repos} · {langue === 'en' ? `Sets ${faites}/${tot}` : `Séries ${faites}/${tot}`}
      </p>
      <div class="repos-bandeau-actions">
        <button type="button" class="dock-btn" onClick={() => ajuster(-15)} aria-label={t.seance.moins15}>−15</button>
        <button type="button" class="dock-btn" onClick={() => ajuster(15)} aria-label={t.seance.plus15}>+15</button>
        <button type="button" class="dock-passer-btn" onClick={passer} aria-label={t.seance.passer}>{t.seance.passer}</button>
      </div>
    </div>
  );
}

// Minuteur des séries en temps (startHold de l'original) : 5 s pour se préparer, la durée de la série, deux fois si « Chaque côté », puis la série se coche.
const PREPA_S = 5;
export function lancerTenue(i, s) {
  const e = enCours.value?.exercices[i];
  const se = e?.series[s];
  if (!se) return;
  void preparerContexteAudio();
  const total = Math.min(18000, Math.max(1, se.s ?? 30));
  const cotes = reglagesDe(e.ex).cotesTemps && modeDe(trouverExercice(e.ex)) === 'time' ? 2 : 1;
  majEnCours((x) => ({ ...x, repos: null, tenue: { i, s, total, cotes, cote: 0, depart: Date.now() + PREPA_S * 1000 } }));
}
export const arreterTenue = () => majEnCours((x) => ({ ...x, tenue: null }));
// Restes en secondes : préparation, puis temps de la série (en pause, les valeurs gelées).
export function etatTenue(h, maintenant = Date.now()) {
  if (!h) return null;
  const ms = h.gel ? h.gel.depart : h.depart - maintenant;
  const prepa = Math.max(0, Math.ceil(ms / 1000));
  const reste = Math.max(0, Math.min(h.total, Math.ceil((ms + h.total * 1000) / 1000)));
  return { prepa, reste, ecoule: h.total - reste };
}
function finirTenue(complete = false) {
  const h = enCours.value?.tenue;
  if (!h) return;
  const e = enCours.value.exercices[h.i];
  const { ecoule } = etatTenue(h);
  majEnCours((x) => {
    // Cardio arrêté avant la fin : le temps couru est gardé (completeHold).
    if (complete && modeDe(trouverExercice(e.ex)) === 'cardio' && ecoule > 0) x.exercices[h.i].series[h.s].s = ecoule;
    return { ...x, tenue: null };
  });
  if (!e.series[h.s]?.fait) basculerSerie(h.i, h.s);
}
function Tenue() {
  const ec = enCours.value;
  useTic(200);
  const h = ec?.tenue;
  const x = m24();
  const v = etatTenue(h);
  const vu = useRef('');
  useEffect(() => {
    if (!h || h.gel) return;
    const cle = `${h.cote}-${v.prepa}-${v.reste}`;
    if (vu.current === cle) return;
    vu.current = cle;
    const son = lireM13().styleAlarme !== 'vibration';
    if (v.prepa === 0 && v.reste === 0) {
      if (son) jouerSonRepos(sonRepos());
      navigator.vibrate?.([200, 100, 200]);
      if (h.cote + 1 < h.cotes) majEnCours((y) => ({ ...y, tenue: { ...y.tenue, cote: y.tenue.cote + 1, depart: Date.now() + PREPA_S * 1000 } }));
      else finirTenue();
    } else if (v.prepa === 0 && v.reste === h.total) { if (son) jouerSonRepos(sonRepos()); navigator.vibrate?.(60); }
  });
  if (!h || !v) return null;
  const pause = () => majEnCours((y) => {
    const t0 = y.tenue;
    if (!t0) return y;
    return { ...y, tenue: t0.gel ? { ...t0, depart: Date.now() + t0.gel.depart, gel: null } : { ...t0, gel: { depart: t0.depart - Date.now() } } };
  });
  const prepa = v.prepa > 0;
  const lib = prepa ? (h.cote > 0 ? x.changez : x.preparez) : modeDe(trouverExercice(ec.exercices[h.i]?.ex)) === 'cardio' ? x.cardio : h.cotes > 1 ? x.cote(h.cote + 1) : x.tenir;
  const montre = prepa ? v.prepa : v.reste;
  const part = prepa ? v.prepa / PREPA_S : v.reste / h.total;
  return <div class="repos-bandeau tenue-bandeau" role="timer" aria-live="polite" aria-label={`${lib}, ${minSec(montre)}`}>
    <span class="repos-bandeau-barre" style={`transform:scaleX(${Math.min(1, part)})`} aria-hidden="true" />
    <div class="repos-bandeau-principal"><p class="repos-bandeau-temps">{minSec(montre)}</p>
      <p class="repos-bandeau-ecoule tabular-nums">{minSec(h.total)}{h.cotes > 1 ? ' × 2' : ''}</p></div>
    <p class="repos-bandeau-series">{lib}</p>
    <div class="repos-bandeau-actions">
      <button type="button" class="dock-btn" onClick={pause} aria-label={h.gel ? x.reprendre : x.pause}><Ic n={h.gel ? 'play:fill' : 'pause:fill'} taille={15} /></button>
      <button type="button" class="dock-passer-btn" onClick={h.gel ? () => finirTenue(true) : arreterTenue}>{h.gel ? x.finirMaintenant : x.arreter}</button>
    </div>
  </div>;
}

function FeuilleDisques({ ouverte, fermer, poidsTotalAffiche, uniteLocale, barre = null }) {
  const liste = choixBarresPourUnite(uniteLocale);
  const barres = barre == null || liste.includes(barre) ? liste : [barre, ...liste];
  const [poidsBarre, setPoidsBarre] = useState(barre ?? barres[0] ?? 20);
  useEffect(() => {
    if (ouverte) setPoidsBarre(barre ?? barres[0] ?? 20);
  }, [ouverte, uniteLocale]);
  const res = poidsTotalAffiche > 0 ? calculerDisquesParCote(poidsTotalAffiche, poidsBarre, uniteLocale) : null;
  const u = uniteLocale === 'lb' ? 'lb' : 'kg';
  return (
    <Feuille ouverte={ouverte} fermer={fermer} titre={langue === 'en' ? 'Plates' : 'Disques'}>
      <div class="champ">
        <label class="label" htmlFor="barre-disques">
          {langue === 'en' ? 'Bar weight' : 'Masse de la barre'} ({u})
        </label>
        <select id="barre-disques" class="form-input" value={poidsBarre} onChange={(e) => setPoidsBarre(+e.target.value)}>
          {barres.map((b) => (
            <option key={b} value={b}>
              {nombre(b, 2)} {u}
            </option>
          ))}
        </select>
      </div>
      {res && (
        <div class="pile" style="gap:10px">
          <p class="muted">
            {langue === 'en' ? 'Per side' : 'Par côté'} :{' '}
            {res.parCote.length ? res.parCote.map((d) => `${nombre(d, 2)} ${u}`).join(', ') : `0 ${u}`}
          </p>
          {res.imposs && (
            <p class="danger">
              {langue === 'en'
                ? `Cannot match listed plates: remainder ${nombre(res.reste, 2)} ${u}`
                : `Impossible avec les disques listés : reste ${nombre(res.reste, 2)} ${u}`}
            </p>
          )}
        </div>
      )}
    </Feuille>
  );
}

const mx = () => (M03[langue] ?? M03.fr).sx;
// Pas de charge des boutons et arrondi des séries d'échauffement (GymMane _warmupSpec : 40 % x 10, 60 % x 5, 80 % x 3).
const ECHAUFFEMENT = [[0.4, 10], [0.6, 5], [0.8, 3]];
/** Séries de montée en charge devant les séries `l` (40, 60 et 80 % de la plus lourde), ou une demi-série sans charge. */
function seriesEchauffement(l) {
  const cible = Math.max(0, ...l.map((v) => v.kg ?? 0));
  if (cible <= 0) {
    const reps = Math.max(0, ...l.map((v) => v.r ?? 0));
    return reps >= 2 ? [{ r: Math.ceil(reps / 2), kg: null, s: null, type: 'e', fait: false }] : [];
  }
  const pas = versKg(pasCharge());
  return ECHAUFFEMENT.map(([p, r]) => ({ r, kg: Math.round((cible * p) / pas) * pas, s: null, type: 'e', fait: false }));
}
const sansAccent = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const libelleSerie = (x, mesure) => (mesure === 'duree' ? `${x.km ? `${nombre(x.km, 2)} km · ` : ''}${minSec(x.s ?? 0)}` : `${x.kg ? `${poids(x.kg)}×` : ''}${x.r ?? 0}`);

/** Coche ou décoche une série : repos (celui de la série, sinon de l'exercice, sinon du profil), record, vibration. */
function basculerSerie(i, s) {
  const ec = enCours.value;
  const e = ec?.exercices[i];
  const serie = e?.series[s];
  if (!serie) return;
  const def = trouverExercice(e.ex);
  const mesure = def?.mesure ?? 'poids';
  const unilat = Boolean(e.unilat);
  const precedent = dernieresSeries(e.ex)[s];
  void preparerContexteAudio();
  const fait = !serie.fait;
  majEnCours((x) => {
    const se = x.exercices[i].series[s];
    se.fait = fait;
    if (fait && mesure !== 'duree' && !unilat && se.r === null) se.r = x.exercices[i].series[s - 1]?.r ?? null;
    if (fait && unilat) {
      if (se.rg == null) se.rg = x.exercices[i].series[s - 1]?.rg ?? precedent?.r ?? null;
      if (se.rd == null) se.rd = x.exercices[i].series[s - 1]?.rd ?? precedent?.r ?? null;
      se.r = se.rg != null || se.rd != null ? Math.min(se.rg ?? se.rd, se.rd ?? se.rg) : null;
    }
    if (!fait) x.repos = null;
    else {
      const ex = x.exercices[i];
      const reposSerie = se.repos ?? ex.repos ?? etat.value.profil.repos_s;
      if (ex.lieSuivant && i + 1 < x.exercices.length) x.repos = { fin: Date.now() + REPOS_SUPER_SERIE_S * 1000, total: REPOS_SUPER_SERIE_S };
      else if (reposSerie > 0) x.repos = { fin: Date.now() + reposSerie * 1000, total: reposSerie };
      else x.repos = null;
    }
    if (x.enPause && x.repos) x.repos = { ...x.repos, gel: { reste: Math.max(0, (x.repos.fin - Date.now()) / 1000) } };
    return x;
  });
  const apres = enCours.value;
  if (fait && apres?.repos && !apres.enPause) {
    const d = mx().voix.repos(voixDuree(apres.repos.total));
    const suite = voixSuivante(apres);
    parler(suite ? `${d} ${suite}` : d);
  }
  if (fait && serie.type !== 'e') {
    const ancien = meilleures(e.ex, etat.value.seances);
    const deja = etat.value.seances.some((v) => v.donnees.exercices.some((y) => y.ex === e.ex));
    const repsPourRecord = unilat ? Math.min(serie.rg ?? serie.rd ?? 0, serie.rd ?? serie.rg ?? 0) || serie.r : serie.r;
    // Plus de répétitions à une charge déjà soulevée compte aussi (séries déjà cochées de cette séance comprises).
    const faites = ec.exercices.filter((y, k) => y.ex === e.ex && k <= i).flatMap((y, k, l) => (k === l.length - 1 ? y.series.slice(0, s) : y.series)).filter((v) => v.fait);
    const echelon = () => mesure !== 'duree' && repsPourRecord && echelonBattu(e.ex, [...etat.value.seances, { donnees: { exercices: [{ ex: e.ex, series: faites }] } }], [{ ...serie, r: repsPourRecord, fait: true }]);
    // Machine assistée : record quand la charge réelle (poids du corps moins l'aide, liftScore) dépasse la meilleure (_beats).
    if (assiste(def)) {
      const corps = poidsCorpsKg();
      const avant = Math.max(0, ...[...etat.value.seances.flatMap((v) => v.donnees.exercices), { ex: e.ex, series: faites }].filter((y) => y.ex === e.ex)
        .flatMap((y) => y.series.filter((z) => z.fait !== false && z.type !== 'e' && z.r > 0).map((z) => scoreAssiste(z.kg, z.r, corps))));
      if (deja && repsPourRecord && scoreAssiste(serie.kg, repsPourRecord, corps) > avant + 1e-9) afficher(t.seance.record, 'record');
    } else if (deja && ((mesure !== 'duree' && (serie.kg ?? 0) > ancien.kg && repsPourRecord) || (mesure === 'duree' && (serie.s ?? 0) > ancien.s) || echelon())) afficher(t.seance.record, 'record');
  }
  navigator.vibrate?.(15);
}

/** Cible de la prochaine fois (ligne « NEXT ») : règle de progression, sinon la suggestion simple de charge. */
function prochaineCible(ex, mesure) {
  if (mesure === 'duree') return null;
  const m = mx();
  const plan = planDe(ex);
  if (plan?.series?.length) {
    const travail = plan.series;
    const reps = plan.coup === 'reps' && new Set(travail.map((x) => x.r)).size > 1 ? travail.map((x) => x.r).join('/') : String(travail[0].r ?? 0);
    const kg = travail[0].kg;
    const base = kg ? `${poids(kg)} ${unite()} × ${reps}` : `${reps} ${t.commun.reps}`;
    const r = regleDe(ex);
    const amrap = r.k === 'amrap';
    const pourquoi = plan.coup === 'decharge' ? m.pourquoi.decharge(seancesBloquees(historiqueDe(ex), r))
      : plan.coup === 'reps' ? m.pourquoi.reps
        : plan.coup === 'serie' ? m.pourquoi.serie
          : plan.coup === 'garde' ? (amrap ? m.pourquoi.amrap : m.pourquoi.garde)
            : amrap ? m.pourquoi.amrap : null;
    return { texte: plan.coup === 'serie' ? `${travail.length} × ${base}` : base, pourquoi, haut: ['charge', 'serie', 'reps'].includes(plan.coup) };
  }
  const c0 = prochaineCharge(ex);
  if (!c0) return null;
  // Machine assistée : la suggestion descend d'un pas au lieu de monter ; pile de poids : charge voisine.
  const aide = assiste(trouverExercice(ex));
  const der = c0.hausse ? c0.kg - 2.5 : c0.kg; // prochaineCharge monte de 2,5 kg
  const kg = !c0.hausse ? surPile(ex, c0.kg) : Array.isArray(reglagesDe(ex).pile) ? surPile(ex, der, aide ? -1 : 1) : aide ? Math.max(0, der - 2.5) : c0.kg;
  const c = { ...c0, kg };
  return { texte: `${poids(c.kg)} ${unite()} × ${c.r ?? 0}`, pourquoi: c.hausse ? null : m.pourquoi.garde, haut: c.hausse };
}

/** Zone verrouillée (_LockGuard) : estompée, sans clic ; deux tapes rapprochées rappellent comment déverrouiller. */
function Garde({ verrou, children, classe = '' }) {
  const tapes = useRef({ n: 0, t: 0 });
  const tap = () => {
    const now = Date.now();
    if (now - tapes.current.t > 1500) tapes.current.n = 0;
    tapes.current.t = now;
    if (++tapes.current.n >= 2) { tapes.current.n = 0; afficher(`${mx().ecranVerrouille}. ${mx().verrouAide}`); }
  };
  return <div class={`sx-garde ${verrou ? 'on' : ''} ${classe}`} onClick={verrou ? tap : undefined}>
    <div class="sx-garde-in" inert={verrou || undefined}>{children}</div>
  </div>;
}

/** Pastille « Maintenir pour déverrouiller » (_HoldToUnlock) : anneau qui se remplit en 650 ms. */
function TenirPourDeverrouiller({ deverrouiller }) {
  const m = mx();
  const [v, setV] = useState(0);
  const minut = useRef(null);
  const tapes = useRef({ n: 0, t: 0 });
  useEffect(() => () => clearInterval(minut.current), []);
  const bas = () => {
    clearInterval(minut.current);
    const debut = Date.now();
    minut.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - debut) / 650);
      setV(p);
      if (p >= 1) { clearInterval(minut.current); navigator.vibrate?.(20); deverrouiller(); }
    }, 30);
  };
  const haut = () => {
    if (v >= 1) return;
    clearInterval(minut.current);
    setV(0);
    const now = Date.now();
    if (now - tapes.current.t > 1500) tapes.current.n = 0;
    tapes.current.t = now;
    if (++tapes.current.n >= 2) { tapes.current.n = 0; afficher(`${m.ecranVerrouille}. ${m.verrouAide}`); }
  };
  const c = 2 * Math.PI * 11.8;
  return <button type="button" class="sx-tenir" style={`transform:scale(${1 - 0.04 * v})`} aria-label={m.maintenir}
    onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); bas(); }} onPointerUp={haut} onPointerCancel={haut}
    onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); bas(); } }} onKeyUp={haut}
    onContextMenu={(e) => e.preventDefault()}>
    <span class="sx-tenir-anneau" aria-hidden="true">
      <svg width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="11.8" fill="none" stroke="currentColor" stroke-opacity=".15" stroke-width="2.4" />
        <circle cx="13" cy="13" r="11.8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-dasharray={`${c * v} ${c}`} transform="rotate(-90 13 13)" /></svg>
      <Ic n="fingerprint:fill" taille={14} />
    </span>
    <span class="sx-tenir-texte">{m.maintenir}</span>
  </button>;
}

/** Ligne de repos de la série dans la feuille du type de série (_setRestRow). */
function ReposSerie({ i, s }) {
  const m = mx();
  const ex = enCours.value.exercices[i];
  const propre = ex.series[s]?.repos ?? null;
  const normal = ex.repos ?? etat.value?.profil?.repos_s ?? 0;
  const ecrire = (v) => majEnCours((x) => { x.exercices[i].series[s].repos = v; return x; });
  const lib = (v) => (v === 0 ? m.sansMinuteur : minSec(v));
  return <div class="sx-repos">
    <Ic n="timer" taille={17} classe={propre == null ? '' : 'accent'} />
    <span class="sx-repos-texte">
      <strong>{m.reposApres}</strong>
      <small>{propre == null ? m.reposHabituel(normal > 0 ? minSec(normal) : m.sansMinuteur) : m.reposAujourdhui}</small>
    </span>
    {propre != null && <button type="button" class="sx-repos-revenir" aria-label={m.reposRevenir} onClick={() => ecrire(null)}><Ic n="arrow-counter-clockwise:bold" taille={14} /></button>}
    <button type="button" class={`sx-repos-pilule ${propre == null ? '' : 'propre'}`} aria-label={`${m.reposApres}${dp()}${propre == null ? m.modifier : lib(propre)}`} onClick={async () => {
      // _setRestRow : règle de 5 s à 15 min, « Sans minuteur » pour zéro.
      const depart = propre || (normal > 0 ? normal : 90);
      const v = await demanderRegle({ titre: m24().reposApres, valeur: Math.min(900, Math.max(5, Math.round(depart / 5) * 5)), min: 5, max: 900, pas: 5, majeur: 6, format: minSec, effacer: m24().sansMinuteur });
      if (v !== undefined) ecrire(v === null ? 0 : Math.round(v));
    }}>
      <span>{propre == null ? m.modifier : lib(propre)}</span>
    </button>
  </div>;
}

/** Feuille du type de série : six cartes expliquées, repos de la série, note, TERMINÉ et suppression. */
function FeuilleTypeSerie({ i, s, fermer }) {
  const m = mx();
  const ec = enCours.value;
  const serie = ec?.exercices[i]?.series[s];
  const ouverte = Boolean(serie);
  const derniere = serie ? dernieresSeries(ec.exercices[i].ex)[s]?.note : null;
  return <Feuille ouverte={ouverte} fermer={fermer} titre={m.typeSerie} sansFocus classe="pleine">
    {serie && <div class="sx-type pile">
      <div class="sx-types">
        {TYPES_SERIE.map((k) => <button type="button" key={k} class={`sx-type-carte type-${k} ${serie.type === k ? 'choisie' : ''}`} aria-pressed={serie.type === k}
          onClick={() => majEnCours((x) => { x.exercices[i].series[s].type = k; return x; })}>
          <i aria-hidden="true" />
          <span><strong>{m.types[k]}</strong><small>{m.typesInfo[k]}</small></span>
          <Ic n="check:bold" taille={14} classe="sx-type-coche" />
        </button>)}
      </div>
      <ReposSerie i={i} s={s} />
      <div class="champ">
        <label class="sx-petit-titre" for="note-serie">{m.noteSerie}</label>
        <textarea id="note-serie" class="form-input sx-note-serie" rows={1} maxLength={280} placeholder={m.noteSerieAide} value={serie.note ?? ''}
          onInput={(e) => majEnCours((x) => { x.exercices[i].series[s].note = e.target.value; return x; })} />
        {derniere && <p class="sx-note-derniere"><Ic n="clock-counter-clockwise" taille={13} />{m.noteDerniere(derniere)}</p>}
      </div>
      <button type="button" class="btn pri large sx-termine" onClick={fermer}>{m.termine}</button>
      <button type="button" class="sx-supprimer" onClick={() => { majEnCours((x) => { x.exercices[i].series.splice(s, 1); return x; }); fermer(); }}>
        <Ic n="trash" taille={16} />{m.supprimerSerie}
      </button>
    </div>}
  </Feuille>;
}

function CarteSeries({ e, i, def, verrou, liste = false }) {
  const m = mx();
  const mesure = def?.mesure ?? 'poids';
  const [typeOuvert, setTypeOuvert] = useState(null);
  // Colonne d'effort : réglage « Noter l'effort » (RPE ou RIR), ou valeur déjà saisie sur une série.
  const a = (k) => e.series.some((x) => x[k] != null && x[k] !== '');
  const modeEffort = pref().modeEffort;
  const effortChoisi = modeEffort === 'rir' || (modeEffort !== 'rpe' && a('rir')) ? 'rir' : modeEffort === 'rpe' || a('rpe') || etat.value?.profil?.afficher_rpe ? 'rpe' : null;
  const uni = Boolean(e.unilat) && mesure !== 'duree';
  // Fiche : « Répétitions uniquement » retire la charge, un gainage sans « Durée uniquement » la garde (gainage lesté).
  const charge = !def?.sansPoids && (mesure !== 'duree' || modeDe(def) === 'time');
  const u = (unite() || 'kg').toUpperCase();
  // Mode « Distance et temps » de la fiche (m05.modes) : colonnes distance (km) puis temps, sans effort, comme l'original.
  const cardio = Boolean(def) && modeDe(def) === 'cardio';
  const parCote = mesure === 'duree' && !cardio && reglagesDe(e.ex).cotesTemps;
  const tetes = cardio ? [m.colDistance, m.colTemps] : mesure === 'duree' ? [parCote ? m.colTempsCote : m.colTemps, ...(charge ? [m.colPoids(`+${u}`)] : [])]
    : [...(uni ? [m.colRepsG, m.colRepsD] : [m.colReps]), ...(charge ? [m.colPoids(mesure === 'corps' ? `+${u}` : u)] : [])];
  const effort = cardio ? null : effortChoisi;
  const cols = `26px repeat(${tetes.length}, minmax(0,1fr))${effort ? ' 36px' : ''} 44px`;
  const gap = effort ? 6 : 10;
  const style = `grid-template-columns:${cols};column-gap:${gap}px`;
  // Numéro de la série : compte des séries de travail (l'échauffement porte W), suivi du sigle du type.
  let travail = 0;
  const badges = e.series.map((x) => {
    if (x.type !== 'e') travail += 1;
    const tag = x.type === 'n' ? '' : libelleTypeCourt(x.type);
    return x.type === 'e' ? 'W' : tag ? `${travail}·${tag}` : String(travail);
  });
  const avecEchauffement = e.series.some((x) => x.type === 'e');
  const ajouterEchauffement = () => majEnCours((x) => { const l = x.exercices[i].series; l.unshift(...seriesEchauffement(l)); return x; });
  const retirerEchauffement = () => majEnCours((x) => { x.exercices[i].series = x.exercices[i].series.filter((v) => v.type !== 'e' || v.fait); return x; });
  const second = mesure !== 'poids' ? null : avecEchauffement
    ? <button type="button" class="sx-pointille" onClick={retirerEchauffement}>{m.retirerEchauffement}</button>
    : <button type="button" class="sx-pointille" onClick={ajouterEchauffement}>{m.echauffement}</button>;
  const sci = Math.max(0, e.series.findIndex((x) => !x.fait));
  const suivante = e.series[e.series.findIndex((x) => !x.fait)] ?? e.series.at(-1);
  return (
    <div class={`sx-carte ${liste ? 'liste' : ''} ${tetes.length > 2 ? 'trois' : ''}`}>
      <div class="sx-tetes" aria-hidden="true" style={style}>
        <span>#</span>
        {tetes.map((h) => <span key={h}>{h}</span>)}
        {effort && <span>{effort.toUpperCase()}</span>}
        <span />
      </div>
      {e.series.map((x, k) => (
        <LigneSerie key={k} e={e} i={i} s={k} def={def} badge={badges[k]} style={style} ouvrirType={() => setTypeOuvert(k)} verrou={verrou} effort={effort} unilat={uni} courante={k === sci} cardio={cardio} charge={charge} />
      ))}
      {mesure === 'poids' && <Garde verrou={verrou}><LigneDisques kg={suivante?.kg ?? 0} barre={reglagesDe(e.ex).barre} /></Garde>}
      <Garde verrou={verrou}>
        <div class="sx-ajouts">
          <button type="button" class="sx-pointille" onClick={() => majEnCours((x) => {
            const l = x.exercices[i].series;
            const d = l.at(-1);
            l.push({ r: d?.r ?? null, kg: d?.kg ?? null, s: d?.s ?? null, km: d?.km ?? null, rpe: null, rg: d?.rg ?? null, rd: d?.rd ?? null, type: d?.type === 'e' ? 'n' : d?.type ?? 'n', fait: false });
            return x;
          })}>{m.ajouterSerie}</button>
          {second}
        </div>
      </Garde>
      {typeOuvert !== null && <FeuilleTypeSerie i={i} s={typeOuvert} fermer={() => setTypeOuvert(null)} />}
    </div>
  );
}

function LigneSerie({ e, i, s, def, badge, style, ouvrirType, verrou, effort, unilat, courante, cardio, charge }) {
  const m = mx();
  const mesure = def?.mesure ?? 'poids';
  const serie = enCours.value.exercices[i].series[s];
  const precedent = dernieresSeries(e.ex)[s];
  const maj = (champs) => majEnCours((x) => { Object.assign(x.exercices[i].series[s], champs); return x; });
  const majCote = (k, v) => majEnCours((x) => {
    const se = x.exercices[i].series[s];
    se[k] = v;
    // Côté le plus faible, comme l'original (weakReps) : volume et progression suivent ce côté.
    se.r = se.rg != null || se.rd != null ? Math.min(se.rg ?? se.rd, se.rd ?? se.rg) : null;
    return x;
  });
  // Appui long sur la ligne : feuille du type de série (GymMane onLongPress).
  const appui = useRef(null);
  const debut = (ev) => {
    if (verrou || ev.target.closest('input, button')) return;
    appui.current = setTimeout(() => { navigator.vibrate?.(20); ouvrirType(); }, 500);
  };
  const fin = () => clearTimeout(appui.current);
  const x = m24();
  const reps = (k, lab) => <Nombre valeur={serie[k]} decimales={false} label={`${lab}, ${s + 1}`} pas={1} max={MAX_REPS}
    regle={{ titre: k === 'r' ? x.reps : k === 'rg' ? x.repsG : x.repsD, pas: 1, majeur: 5 }}
    onChange={(v) => (k === 'r' ? maj({ r: v }) : majCote(k, v))} placeholder={(k === 'rd' ? precedent?.rd : k === 'rg' ? precedent?.rg : null) ?? precedent?.r ? String((k === 'rd' ? precedent?.rd : k === 'rg' ? precedent?.rg : null) ?? precedent.r) : '0'} />;
  return (
    <div class={`sx-ligne ${serie.fait ? 'fait' : ''} ${courante ? 'courante' : ''}`} style={style}
      onPointerDown={debut} onPointerUp={fin} onPointerLeave={fin} onPointerCancel={fin} onPointerMove={(ev) => { if (Math.abs(ev.movementY) > 4) fin(); }}>
      <button type="button" class={`sx-badge type-${serie.type}`} onClick={ouvrirType} disabled={verrou} aria-label={`${m.typeSerie} ${s + 1}${dp()}${m.types[serie.type] ?? serie.type}`}>
        <span>{badge}</span>{serie.note?.trim() && <Ic n="note-pencil:fill" taille={10} />}
      </button>
      {cardio && <Nombre valeur={serie.km} label={`${m.colDistance}, ${s + 1}`} pas={0.1} max={1000} onChange={(v) => maj({ km: v })}
        regle={{ titre: x.distance('km'), max: 100, pas: 0.1, majeur: 10, unite: 'km' }} placeholder={precedent?.km ? nombre(precedent.km, 2) : '0'} />}
      {mesure === 'duree' ? (cardio
        // Distance et temps : la règle compte en minutes, comme l'original (timeMinutesTitle).
        ? <button type="button" class="cellule large cellule-regle" aria-label={`${t.seance.duree}, ${s + 1}${dp()}${serie.s ? minSec(serie.s) : '0:00'}`}
          onClick={async () => { const v = await demanderRegle({ titre: x.tempsMin, valeur: Math.round((serie.s ?? 0) / 60), max: 300, pas: 1, majeur: 5, unite: 'min' }); if (v != null) maj({ s: Math.round(v * 60) }); }}>
          {serie.s ? minSec(serie.s) : <span class="cellule-vide">0:00</span>}</button>
        : <Nombre valeur={serie.s} decimales={false} label={`${t.seance.duree}, ${s + 1}`} pas={15} max={18000} onChange={(v) => maj({ s: v })}
          regle={{ titre: x.tempsS, max: 900, pas: 5, majeur: 6, format: minSec }} placeholder="0:00" />
      ) : unilat ? <>{reps('rg', m.colRepsG)}{reps('rd', m.colRepsD)}</> : reps('r', m.colReps)}
      {charge && !cardio && <Nombre valeur={versAffichage(serie.kg)} label={`${unite()}, ${s + 1}`} pas={pasCharge()} max={maxCharge()} onChange={(v) => maj({ kg: versKg(v) })}
        regle={{ titre: x.poids(unite().toUpperCase()), max: maxCharge(), pas: pasCharge(), majeur: 10, unite: unite() }}
        arrondir={Array.isArray(reglagesDe(e.ex).pile) ? (v, dir) => versAffichage(surPile(e.ex, versKg(v), dir)) : null}
        placeholder={mesure !== 'poids' ? '+0' : precedent?.kg ? nombre(versAffichage(precedent.kg)) : '0'} />}
      {effort && <Nombre valeur={serie[effort]} max={10} label={`${effort.toUpperCase()} ${s + 1}`} onChange={(v) => maj({ [effort]: v })} placeholder="-" classe="sx-effort"
        regle={{ titre: effort.toUpperCase(), min: effort === 'rir' ? 0 : 1, max: effort === 'rir' ? 9 : 10, pas: 0.5, majeur: 2, aide: effort === 'rir' ? x.rirAide : x.rpeAide, effacer: serie[effort] != null ? x.aucun : null, valeurDefaut: effort === 'rir' ? 2 : 8 }} />}
      <button type="button" class={`coche sx-coche ${serie.fait ? 'ok' : ''}`} onClick={() => basculerSerie(i, s)} aria-pressed={serie.fait} aria-label={m.cocher(s + 1)}>
        <Ic n="check:bold" taille={14} />
      </button>
    </div>
  );
}

/** « Par côté : 25 · 2.5 · 1.25 › » (_plateRow) : disques de la prochaine série, ouvre le calculateur. */
function LigneDisques({ kg, barre }) {
  const [ouverte, setOuverte] = useState(false);
  const aff = versAffichage(kg ?? 0) ?? 0;
  const u = unite();
  // Barre de la fiche (« Poids de la barre ou du chariot »), sinon la première barre de l'unité.
  const propre = typeof barre === 'number' ? versAffichage(barre) : null;
  const barres = choixBarresPourUnite(u);
  const res = aff > 0 ? calculerDisquesParCote(aff, propre ?? barres[0] ?? 20, u) : null;
  if (!res || res.imposs || !res.parCote.length) return null;
  return <>
    <button type="button" class="sx-disques" onClick={() => setOuverte(true)} aria-label={`${mx().disques} ${mx().parCote(res.parCote.map((d) => nombre(d, 2)).join(' · '))}`}>
      <Ic n="circles-three" taille={13} />
      <span>{mx().parCote(res.parCote.map((d) => nombre(d, 2)).join(' · '))}</span>
      <Ic n="caret-right" taille={12} />
    </button>
    <FeuilleDisques ouverte={ouverte} fermer={() => setOuverte(false)} poidsTotalAffiche={aff} uniteLocale={u} barre={propre} />
  </>;
}

/** En-tête de l'exercice (_exerciseHeader) : pastille Superset, nom, muscle et Changer, lignes DERNIÈRE et PROCHAINE FOIS. */
function TeteExercice({ e, i, def, enPause, echanger, verrou }) {
  const m = mx();
  const ec = enCours.value;
  const mesure = def?.mesure ?? 'poids';
  const enSuperset = Boolean(e.lieSuivant && i < ec.exercices.length - 1) || Boolean(ec.exercices[i - 1]?.lieSuivant);
  const avant = dernieresSeries(e.ex);
  const cible = avant.length ? prochaineCible(e.ex, mesure) : null;
  return <div class="sx-tete">
    {enSuperset && <span class="sx-superset"><Ic n="link" taille={11} />{m.superset}</span>}
    <h2 class="sx-nom">{nomExercice(def) || e.ex}</h2>
    <div class="sx-puces">
      {def && <span class="sx-muscle">{t.muscles[def.muscle]}</span>}
      {def && !enPause && <Garde verrou={verrou} classe="sx-garde-ligne"><button type="button" class="sx-changer" onClick={echanger} aria-label={m.changerExercice}><Ic n="arrows-left-right" taille={12} />{m.changer}</button></Garde>}
    </div>
    {avant.length > 0 && <a class="sx-derniere" href={`#/exercice/${e.ex}`}>
      <b>{m.derniere}</b><span>{avant.map((x) => libelleSerie(x, mesure)).join(' · ')}</span><Ic n="caret-right" taille={11} />
    </a>}
    {cible && <p class="sx-prochaine"><b>{m.prochaine}</b><span><span class={cible.haut ? 'haut' : ''}>{cible.texte}</span>{cible.pourquoi && <small> · {cible.pourquoi}</small>}</span></p>}
    {e.note && <p class="exo-note">{e.note}</p>}
  </div>;
}

/** Bande « EXERCICE 1 SUR 4 · volume » avec silhouettes et « Tous », puis les segments (_progressStrip). */
function BandeProgression({ ec, courant, verrou, ouvrirApercu, ouvrirMuscles, volTexte }) {
  const m = mx();
  const n = ec.exercices.length;
  return <div class={`sx-bande ${verrou ? 'verrouillee' : ''}`} onClick={() => !verrou && ouvrirApercu()}>
    <div class="sx-bande-ligne">
      <p class="sx-bande-texte"><span>{t.seance.exerciceN(courant + 1, n)}</span>{volTexte && <><i>{'  ·  '}</i><b>{volTexte}</b></>}</p>
      {!verrou && <button type="button" class="sx-mini" aria-label={m.musclesSeance} onClick={(ev) => { ev.stopPropagation(); ouvrirMuscles(); }}>
        <SilhouettePar mode="heat" vueInitiale="both" ramp="ember" intensites={intensitesDe({ exercices: ec.exercices })} lang={langue} sexe={etat.value?.profil?.sexe === 'f' ? 'f' : 'm'} />
      </button>}
      {!verrou && <button type="button" class="sx-tous" aria-label={`${m.cetteSeance}${dp()}${m.tous}`} onClick={(ev) => { ev.stopPropagation(); ouvrirApercu(); }}>
        <Ic n="list-bullets" taille={14} />{m.tous}
      </button>}
    </div>
    <div class={`sx-segments ${n > 12 ? 'serres' : ''}`} aria-hidden="true">
      {ec.exercices.map((x, k) => {
        const faits = x.series.filter((v) => v.fait).length;
        const part = x.series.length ? faits / x.series.length : 0;
        return <span key={k} class={`${k === courant ? 'cours' : ''} ${k === courant || faits > 0 ? 'teinte' : ''}`}><i style={`transform:scaleX(${part})`} /></span>;
      })}
    </div>
  </div>;
}

/** Ligne d'exercice des feuilles Changer et Ajouter (_swapRow, _addRow). */
function LigneChoix({ e, detail, icone, onClick, estompe }) {
  return <button type="button" class={`sx-choix ${estompe ? 'estompe' : ''}`} onClick={onClick} disabled={estompe}>
    <Vignette e={e} taille={44} />
    <span class="sx-choix-texte"><strong>{nomExercice(e)}</strong><small>{detail}</small></span>
    <Ic n={icone} taille={icone === 'arrows-left-right' ? 15 : 16} />
  </button>;
}

const chercher = (q) => {
  const mots = sansAccent(q).split(/\s+/).filter(Boolean);
  return tousExercices.value.filter((e) => mots.every((w) => sansAccent(`${e.fr} ${e.en} ${e.noms ?? ''}`).includes(w))).slice(0, 40);
};
const dejaFait = (id) => etat.value.seances.some((v) => v.donnees.exercices.some((y) => y.ex === id && y.series?.length));

/** Feuille « Changer d'exercice » : explication, section même muscle, recherche. */
function FeuilleChanger({ i, fermer, choisir }) {
  const m = mx();
  const [q, setQ] = useState('');
  const ec = enCours.value;
  const de = i !== null ? ec?.exercices[i] : null;
  const def = de ? trouverExercice(de.ex) : null;
  const dans = new Set(ec?.exercices.map((x) => x.ex) ?? []);
  let liste = [];
  if (def) {
    if (q.trim()) liste = chercher(q).filter((e) => !dans.has(e.id));
    else {
      const favoris = new Set(lireFavoris());
      const partage = new Set(def.autres ?? []);
      const score = (e) => (favoris.has(e.id) ? 4 : 0) + (dejaFait(e.id) ? 3 : 0) + ((e.autres ?? []).some((x) => partage.has(x)) ? 1 : 0);
      liste = tousExercices.value.filter((e) => e.id !== def.id && e.muscle === def.muscle && !dans.has(e.id) && (e.mesure === 'duree') === (def.mesure === 'duree'))
        .map((e, k) => ({ e, k, s: score(e) })).sort((a, b) => b.s - a.s || a.k - b.k).slice(0, 15).map((x) => x.e);
    }
  }
  const place = de?.remplaceDe ?? de?.ex;
  const remplacants = de ? [
    ...(de.remplaceDe && !dans.has(de.remplaceDe) ? [de.remplaceDe] : []),
    ...altsDe(ec?.routine, place).filter((id) => id !== de.ex && !dans.has(id)),
  ].map(trouverExercice).filter(Boolean) : [];
  if (remplacants.length) { const pris = new Set(remplacants.map((e) => e.id)); liste = liste.filter((e) => !pris.has(e.id)); }
  const fin = () => { setQ(''); fermer(); };
  const commence = de?.series.some((x) => x.fait);
  return <Feuille ouverte={Boolean(de)} fermer={fin} titre={m.changerExercice} sous={de ? (commence ? m.changerGarde : m.changerAide(nomExercice(def) || de.ex)) : ''} sansFocus>
    {de && <div class="sx-gauche pile">
      <Recherche valeur={q} onChange={setQ} placeholder={m.rechercher} label={m.rechercher} />
      {/* Remplaçants du programme (sessionAltsFor) : l'exercice d'origine s'il a été changé, puis ceux choisis dans le programme. */}
      {!q.trim() && remplacants.length > 0 && <>
        <p class="sx-section">{L26().remplacants}</p>
        <div class="sx-choix-liste">{remplacants.map((e) => <LigneChoix key={e.id} e={e} icone="arrows-left-right" detail={t.materiels[e.materiel] ?? ''} onClick={() => { choisir(e.id); setQ(''); }} />)}</div>
      </>}
      <p class="sx-section">{q.trim() ? m.resultats : m.memeMuscle(t.muscles[def?.muscle] ?? '')}</p>
      {liste.length ? <div class="sx-choix-liste">{liste.map((e) => <LigneChoix key={e.id} e={e} icone="arrows-left-right"
        detail={[t.materiels[e.materiel], dejaFait(e.id) && m.dejaFait].filter(Boolean).join(' · ')} onClick={() => { choisir(e.id); setQ(''); }} />)}</div>
        : <p class="sx-aucun">{m.aucun}</p>}
    </div>}
  </Feuille>;
}

/** Feuille « AJOUTER UN EXERCICE » : recherche, section SUGGÉRÉ, bouton « Nouvel exercice ». */
function FeuilleAjouter({ ouverte, fermer, ajouter }) {
  const m = mx();
  const [q, setQ] = useState('');
  const [nouveau, setNouveau] = useState(null);
  const ec = enCours.value;
  const dans = new Set(ec?.exercices.map((x) => x.ex) ?? []);
  const suggestions = () => {
    const ids = lireFavoris().filter((id) => !dans.has(id));
    for (const v of etat.value.seances) {
      for (const y of v.donnees.exercices) if (!dans.has(y.ex) && !ids.includes(y.ex)) ids.push(y.ex);
      if (ids.length >= 12) break;
    }
    return ids.slice(0, 12).map(trouverExercice).filter(Boolean);
  };
  const liste = ouverte ? (q.trim() ? chercher(q) : suggestions()) : [];
  const fin = () => { setQ(''); fermer(); };
  return <>
    <Feuille ouverte={ouverte} fermer={fin} titre={m.ajouterExercice} sansFocus
      pied={<button type="button" class="sx-fantome large" onClick={() => { setNouveau(q.trim()); fin(); }}><Ic n="plus" taille={16} />{m.nouvelExercice}</button>}>
      <div class="sx-gauche sx-ajout pile">
        <Recherche valeur={q} onChange={setQ} placeholder={m.rechercher} label={m.rechercher} />
        <p class="sx-section">{q.trim() ? m.resultats : m.suggere}</p>
        {liste.length ? <div class="sx-choix-liste">{liste.map((e) => <LigneChoix key={e.id} e={e} estompe={dans.has(e.id)} icone={dans.has(e.id) ? 'check' : 'plus'}
          detail={t.muscles[e.muscle]} onClick={() => { ajouter([e.id]); setQ(''); }} />)}</div>
          : q.trim() ? <p class="sx-aucun">{m.aucun}</p> : null}
      </div>
    </Feuille>
    <FormExercice ouverte={nouveau !== null} fermer={() => setNouveau(null)} nomInitial={nouveau ?? ''} apres={(id) => { setNouveau(null); ajouter([id]); }} />
  </>;
}

/** Feuille « Cette séance » (showSessionOverview) : exercices, enchaînement, réordonner par la poignée. */
function FeuilleApercu({ ouverte, fermer, aller, abandonner: demanderAbandon, liste, basculerListe }) {
  const m = mx();
  const ec = enCours.value;
  const glisse = useRef(null);
  const [cible, setCible] = useState(null);
  if (!ec) return null;
  const n = ec.exercices.length;
  const deplacer = (de, vers) => majEnCours((x) => {
    const actuel = x.exercices[x.courant ?? 0];
    if (de > 0) x.exercices[de - 1].lieSuivant = false;
    const [el] = x.exercices.splice(de, 1);
    el.lieSuivant = false;
    x.exercices.splice(vers, 0, el);
    if (vers > 0) x.exercices[vers - 1].lieSuivant = false;
    x.courant = x.exercices.indexOf(actuel);
    return x;
  });
  const poignee = (k) => ({
    onPointerDown: (ev) => { ev.currentTarget.setPointerCapture(ev.pointerId); glisse.current = { k, y: ev.clientY, h: ev.currentTarget.closest('.sx-apercu-ligne').offsetHeight + 8 }; setCible(k); },
    onPointerMove: (ev) => { const g = glisse.current; if (!g) return; setCible(Math.max(0, Math.min(n - 1, g.k + Math.round((ev.clientY - g.y) / g.h)))); },
    onPointerUp: () => { const g = glisse.current; glisse.current = null; if (g && cible !== null && cible !== g.k) deplacer(g.k, cible); setCible(null); },
    onPointerCancel: () => { glisse.current = null; setCible(null); },
    onKeyDown: (ev) => { if (ev.key === 'ArrowUp' && k > 0) { ev.preventDefault(); deplacer(k, k - 1); } if (ev.key === 'ArrowDown' && k < n - 1) { ev.preventDefault(); deplacer(k, k + 1); } },
  });
  return <Feuille ouverte={ouverte} fermer={fermer} titre={m.cetteSeance} sous={`${m.exercices(n)} · ${chrono(secondesEcouleesSession(ec))}`} sansFocus>
    <div class="sx-gauche pile">
      <div class="sx-apercu">
        {ec.exercices.map((e, k) => {
          const def = trouverExercice(e.ex);
          const faits = e.series.filter((x) => x.fait).length;
          const tout = e.series.length > 0 && faits === e.series.length;
          const cours = k === (ec.courant ?? 0);
          const lie = e.lieSuivant || ec.exercices[k - 1]?.lieSuivant;
          return <div key={`${e.ex}-${k}`} class={`sx-apercu-ligne ${cours ? 'cours' : ''} ${glisse.current?.k === k ? 'leve' : ''} ${cible === k && glisse.current?.k !== k ? 'vise' : ''}`}>
            <button type="button" class="sx-apercu-corps" onClick={() => { aller(k); fermer(); }}>
              <span class={`sx-apercu-num ${tout ? 'tout' : ''}`}>{tout ? <Ic n="check:bold" taille={12} /> : k + 1}</span>
              {def && <Vignette e={def} taille={40} />}
              <span class="sx-apercu-texte"><strong>{nomExercice(def) || e.ex}</strong>
                <small><span class={tout ? 'sauge' : ''}>{m.seriesSur(faits, e.series.length)}</span>{cours && <> · <b>{m.maintenant}</b></>}{lie && <Ic n="link" taille={12} />}</small></span>
            </button>
            {k < n - 1 && <button type="button" class={`sx-apercu-lien ${e.lieSuivant ? 'actif' : ''}`} aria-pressed={Boolean(e.lieSuivant)} aria-label={m.enchainer}
              onClick={() => majEnCours((x) => { x.exercices[k].lieSuivant = !x.exercices[k].lieSuivant; return x; })}>
              <Ic n={e.lieSuivant ? 'link:fill' : 'link'} taille={17} /></button>}
            <button type="button" class="sx-apercu-poignee" aria-label={`${m.deplacer}${dp()}${nomExercice(def) || e.ex}`} {...poignee(k)}><Ic n="dots-six-vertical" taille={18} /></button>
          </div>;
        })}
      </div>
      {/* Séance légère (toggleLightSession) : gardée dans l'historique, ignorée par la progression. */}
      <button type="button" class="sx-option l26-legere" aria-pressed={Boolean(enCours.value?.leger)} onClick={() => majEnCours((x) => ({ ...x, leger: !x.leger }))}>
        <Ic n="feather" taille={18} /><span class="l26-alts-texte"><b>{L26().seanceLegere}</b><small>{L26().seanceLegereAide}</small></span><span class={`sx-inter ${enCours.value?.leger ? 'on' : ''}`} aria-hidden="true"><i /></span>
      </button>
      <button type="button" class="sx-option" aria-pressed={liste} onClick={basculerListe}>
        <Ic n="list-bullets" taille={18} /><span>{t.seance.liste}</span><span class={`sx-inter ${liste ? 'on' : ''}`} aria-hidden="true"><i /></span>
      </button>
      <p class="sx-glisser">{m.glisser}</p>
      <button type="button" class="sx-lien-texte danger" onClick={demanderAbandon}>{m.abandonner}</button>
    </div>
  </Feuille>;
}

/** Vue liste (réglage « Vue en liste ») : toutes les cartes à la suite. */
function CarteExerciceListe({ e, i, verrou }) {
  const def = trouverExercice(e.ex);
  const mesure = def?.mesure ?? 'poids';
  const avant = dernieresSeries(e.ex);
  return (
    <section class="exo compact" aria-label={nomExercice(def)}>
      <h2 class="exo-nom">{nomExercice(def) || e.ex}</h2>
      <div class="exo-chips">
        {def && <span class="sx-muscle">{t.muscles[def.muscle]}</span>}
        <span class="exo-dernier"><b>{mx().derniere}</b> {avant.length ? avant.map((x) => libelleSerie(x, mesure)).join(' · ') : t.seance.jamais}</span>
      </div>
      {e.note && <p class="exo-note">{e.note}</p>}
      <Garde verrou={verrou}><BandeNotes ex={e.ex} /></Garde>
      <CarteSeries e={e} i={i} def={def} verrou={verrou} liste />
    </section>
  );
}

export function Seance() {
  const ec = enCours.value;
  const m = mx();
  useTic(1000);
  useEcranAllume();
  const [ajout, setAjout] = useState(false);
  const [echange, setEchange] = useState(null);
  const [apercu, setApercu] = useState(false);
  const [muscles, setMuscles] = useState(false);
  const [noteOuverte, setNoteOuverte] = useState(false);
  const [retrait, setRetrait] = useState(false);
  const [abandon, setAbandon] = useState(false);
  // Réglage « Affichage de la séance » (cartes ou liste) ; l'ancien choix local sert tant que le réglage n'est pas posé.
  const [liste, setListe] = useState(() => {
    const d = lireM13().disposition;
    if (d) return d === 'liste';
    try { return localStorage.getItem('an_vue_liste') === '1'; } catch { return false; }
  });
  const haut = useRef(null);

  // Au démarrage, une seule fois par séance : étape suivante de chaque exercice, puis allègement en semaine de décharge.
  useEffect(() => {
    const s = enCours.value;
    if (!s) return;
    try {
      if (localStorage.getItem(CLE_PREPAREE) === s.cle) return;
      localStorage.setItem(CLE_PREPAREE, s.cle);
    } catch { return; }
    // Séance reprise (autre appareil, rechargement tardif) : rien n'est retouché.
    if (Date.now() - Date.parse(s.debut) > 120000 || s.exercices.some((x) => x.series.some((v) => v.fait))) return;
    const decharge = s.routine != null && semaineDecharge();
    if (!decharge && !s.exercices.some((e) => progressionActive(e.ex) || reglagesDe(e.ex).echauffement || reglagesDe(e.ex).tenue)) return;
    majEnCours((x) => {
      x.exercices.forEach((e) => preparerExercice(e));
      // Semaine de décharge : sur une pile, le poids de la pile sous les 90 % (comme les décharges de la progression).
      if (decharge) x.exercices.forEach((e) => { e.series = alleger(e.series, versKg(pasCharge()), (kg) => dechargePile(e.ex, kg, 10)); });
      return x;
    });
    if (decharge) afficher(langue === 'en' ? 'Deload week: half the sets, 10 % less weight.' : 'Semaine de décharge : moitié des séries, 10 % de charge en moins.');
  }, [ec?.cle]);

  const refAvance = useRef(null);
  useLayoutEffect(() => {
    const s = enCours.value;
    if (!s || s.enPause || liste || !(pref().avanceAutoApresCoche || etat.value?.profil?.avance_auto)) { refAvance.current = null; return; }
    const cur = s.courant ?? 0;
    const ex = s.exercices[cur];
    const cle = `${s.cle}-${cur}-${ex?.series?.length}`;
    if (!ex || !toutesSeriesFaites(ex)) { refAvance.current = null; return; }
    if (cur >= s.exercices.length - 1 || refAvance.current === cle) return;
    refAvance.current = cle;
    majEnCours((x) => ({ ...x, courant: cur + 1 }));
  });

  if (!ec) {
    // Après Terminer, le passage au bilan est déjà demandé : ne pas le remplacer par l'accueil.
    if (location.hash.startsWith('#/seance')) location.replace('#/');
    return null;
  }

  const total = ec.exercices.length;
  const courant = Math.min(ec.courant ?? 0, Math.max(0, total - 1));
  const verrou = Boolean(ec.verrou);
  const enPause = Boolean(ec.enPause);
  const exCourant = ec.exercices[courant];
  const defCourant = exCourant ? trouverExercice(exCourant.ex) : null;
  // Réglages « Démo de l'exercice » (grande, petite, masquée) et « Animation de la démo » (en boucle ou 10 secondes, 6 tours).
  const reglages = lireM13();
  const demo = ['petite', 'aucune'].includes(reglages.tailleDemo) ? reglages.tailleDemo : 'grande';
  const media = (taille) => <IllustrationExercice exo={defCourant} taille={taille} lazy={false} live calmMotion={Boolean(etat.value?.profil?.reduire_animations)} boucles={reglages.boucleDemo === 'courte' ? 6 : null} />;
  const b = bilanSeance({ exercices: ec.exercices.map((e) => ({ series: e.series.filter((x) => x.fait) })) });
  const vol = volume(b.volume);

  const aller = (k) => {
    majEnCours((x) => ({ ...x, courant: k }));
    haut.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const ajouter = (ids) => {
    majEnCours((x) => {
      const nouveaux = ids.map((id) => nouvelExercice(id));
      nouveaux.forEach((n) => preparerExercice(n));
      x.exercices.push(...nouveaux);
      if (!liste) x.courant = x.exercices.length - ids.length;
      return x;
    });
    setAjout(false);
  };

  // Changer : séance pas commencée, l'exercice est remplacé ; commencée, les séries faites restent et le nouveau reprend le reste.
  const changer = (id) => {
    const k = echange;
    majEnCours((x) => {
      const prev = x.exercices[k];
      const faites = prev.series.filter((v) => v.fait);
      const reste = Math.max(1, prev.series.length - faites.length);
      const nouveau = { ...nouvelExercice(id, faites.length ? reste : prev.series.length), lieSuivant: prev.lieSuivant, unilat: prev.unilat, remplaceDe: prev.remplaceDe ?? prev.ex };
      preparerExercice(nouveau);
      if (faites.length) { prev.series = faites; prev.lieSuivant = false; x.exercices.splice(k + 1, 0, nouveau); x.courant = k + 1; }
      else x.exercices[k] = { ...nouveau, note: prev.note };
      return x;
    });
    setEchange(null);
  };

  const finir = async () => {
    try {
      // Gardée pour « Continuer la séance » depuis le bilan.
      const copie = { cle: enCours.value.cle, ec: enCours.value, fin: Date.now(), duree: secondesEcouleesSession(enCours.value) };
      const cle = await terminer();
      // Rien de coché : GymMane n'enregistre rien mais montre quand même le bilan (à zéro), d'où l'on peut continuer.
      if (!cle) { copie.vide = true; abandonner(); }
      try { localStorage.setItem('an_seance_finie', JSON.stringify(copie)); } catch { /* sans reprise */ }
      location.replace(`#/bilan/${cle || copie.cle}`);
    } catch {
      afficher(t.commun.erreur, 'danger');
    }
  };

  const togglePause = () => {
    majEnCours((s) => {
      if (s.enPause) {
        const pauseMs = (s.pauseAccum_ms || 0) + (s.pauseDebut_ms ? Date.now() - s.pauseDebut_ms : 0);
        let repos = s.repos;
        if (repos?.gel) {
          const reste = repos.gel.reste;
          if (reste <= 0) {
            parler(mx().voix.go);
            if (lireM13().styleAlarme !== 'vibration') jouerSonRepos(sonRepos());
            navigator.vibrate?.([200, 100, 200]);
            afficher(t.seance.finRepos);
            repos = null;
          } else repos = { total: repos.total, fin: Date.now() + reste * 1000 };
        }
        return { ...s, enPause: false, pauseAccum_ms: pauseMs, pauseDebut_ms: null, repos };
      }
      let repos = s.repos;
      if (repos && !repos.gel && repos.fin > Date.now()) repos = { ...repos, gel: { reste: Math.max(0, (repos.fin - Date.now()) / 1000) } };
      return { ...s, enPause: true, pauseDebut_ms: Date.now(), pauseAccum_ms: s.pauseAccum_ms || 0, repos };
    });
  };

  // Chevron bas : met en pause et revient à l'accueil, la pilule de reprise reste en bas (stepOutOfSession).
  const sortir = () => {
    if (!enPause && !ec.manuel) togglePause();
    location.hash = '#/';
  };
  const verrouiller = (v) => { navigator.vibrate?.(20); majEnCours((s) => ({ ...s, verrou: v })); };

  // Bouton principal (_mainAction) : série terminée, exercice suivant, puis terminer la séance.
  const enAttente = exCourant ? exCourant.series.findIndex((x) => !x.fait) : -1;
  const apres = ec.exercices.findIndex((x, k) => k > courant && x.series.some((v) => !v.fait));
  // Série en temps : Démarrer lance le minuteur de la série (_mainAction), Arrêter pendant qu'il tourne.
  const serieAttente = enAttente >= 0 ? exCourant.series[enAttente] : null;
  const tenueIci = ec.tenue && ec.tenue.i === courant;
  const principal = serieAttente && defCourant?.mesure === 'duree' && (serieAttente.s ?? 30) > 0
    ? tenueIci
      ? <button type="button" class="btn pri sx-principal" onClick={ec.tenue.gel ? () => finirTenue(true) : arreterTenue}>{ec.tenue.gel ? m24().finirMaintenant : m24().arreter}</button>
      : <button type="button" class="btn pri sx-principal" onClick={() => lancerTenue(courant, enAttente)}><Ic n="play:fill" taille={15} />{m24().demarrer(`${minSec(serieAttente.s ?? 30)}${reglagesDe(exCourant.ex).cotesTemps && modeDe(defCourant) === 'time' ? ' × 2' : ''}`)}</button>
    : enAttente >= 0
    ? <button type="button" class="btn pri sx-principal" onClick={() => basculerSerie(courant, enAttente)}>{m.serieFaite}</button>
    : apres >= 0 || courant < total - 1
      ? <Garde verrou={verrou && apres < 0} classe="sx-principal-garde"><button type="button" class="btn pri sx-principal" onClick={() => aller(apres >= 0 ? apres : courant + 1)}>{m.exerciceSuivant}</button></Garde>
      : <Garde verrou={verrou} classe="sx-principal-garde"><button type="button" class="btn pri sx-principal" onClick={finir}>{m.terminerSeanceMaj}</button></Garde>;

  const basculerListe = () => {
    const v = !liste;
    setListe(v);
    ecrireM13({ ...lireM13(), disposition: v ? 'liste' : 'cartes' });
  };

  return (
    <main class="ecran seance sx" ref={haut}>
      <Confettis actif={toast.value?.genre === 'record'} nombre={48} />
      {ec.decompte && <Decompte ec={ec} />}
      {ec.manuel ? <BarreManuelle ec={ec} sortir={sortir} libSortir={m.pauseQuitter} /> : <header class="sx-barre">
        {verrou ? <TenirPourDeverrouiller deverrouiller={() => verrouiller(false)} /> : <div class="sx-statut">
          <button type="button" class="rond sx-sortir" onClick={sortir} aria-label={m.pauseQuitter}><Ic n="caret-down:bold" taille={15} /></button>
          <i class={enPause ? 'pause' : ''} aria-hidden="true" />
          <span class={enPause ? 'pause' : ''}>{enPause ? t.seance.pause : t.seance.enCours}</span>
        </div>}
        <div class="sx-droite">
          <span class={`sx-chrono tabular-nums ${enPause ? 'pause' : ''}`} role="timer" aria-label={t.seance.chrono}>{chrono(secondesEcouleesSession(ec))}</span>
          {!verrou && <button type="button" class="sx-rond-zone" onClick={() => verrouiller(true)} aria-label={m.verrouiller}><span><Ic n="fingerprint" taille={17} /></span></button>}
          <Garde verrou={verrou} classe="sx-garde-ligne">
            <button type="button" class={`sx-rond-zone large ${enPause ? 'actif' : ''}`} onClick={togglePause} aria-pressed={enPause} aria-label={enPause ? m.reprendre : m.pause}>
              <span><Ic n={enPause ? 'play:fill' : 'pause:fill'} taille={16} /></span>
            </button>
          </Garde>
        </div>
      </header>}

      {ec.leger && <div class="l26-legere-note">
        <Ic n="feather" taille={17} />
        <span><b>{L26().seanceLegere}</b><small>{L26().seanceLegereNote}</small></span>
        <button type="button" onClick={() => majEnCours((x) => ({ ...x, leger: false }))}>{L26().seanceLegereOff}</button>
      </div>}
      {total > 0 && <BandeProgression ec={ec} courant={courant} verrou={verrou} ouvrirApercu={() => setApercu(true)} ouvrirMuscles={() => setMuscles(true)} volTexte={b.volume > 0 ? `${vol.val} ${vol.unite}` : ''} />}

      {total === 0 ? (
        <Vide n="barbell" titre={t.seance.aucunExercice} texte={t.seance.aucunExerciceTexte}>
          <button type="button" class="btn pri" onClick={() => setAjout(true)}><Ic n="plus:bold" taille={15} />{t.seance.ajouterExercice}</button>
        </Vide>
      ) : liste ? (
        <>
          <Tenue /><Repos enPauseSession={enPause} />
          {ec.exercices.map((e, k) => <CarteExerciceListe key={`${e.ex}-${k}`} e={e} i={k} verrou={verrou} />)}
        </>
      ) : (
        <section class="sx-exo" key={`${exCourant.ex}-${courant}`} aria-label={nomExercice(defCourant)}>
          {demo === 'petite' && defCourant ? <div class="sx-tete-demo">
            <TeteExercice e={exCourant} i={courant} def={defCourant} enPause={enPause} verrou={verrou} echanger={() => setEchange(courant)} />
            <Garde verrou={verrou}><a class="sx-media petite" href={`#/exercice/${exCourant.ex}`} aria-label={nomExercice(defCourant)}>{media(104)}</a></Garde>
          </div> : <TeteExercice e={exCourant} i={courant} def={defCourant} enPause={enPause} verrou={verrou} echanger={() => setEchange(courant)} />}
          <Garde verrou={verrou}><BandeNotes ex={exCourant.ex} /></Garde>
          {demo === 'grande' && defCourant && <Garde verrou={verrou}><a class="sx-media" href={`#/exercice/${exCourant.ex}`} aria-label={nomExercice(defCourant)}>{media(170)}</a></Garde>}
          <Tenue /><Repos enPauseSession={enPause} />
          <CarteSeries e={exCourant} i={courant} def={defCourant} verrou={verrou} />
        </section>
      )}

      {total > 0 && <>
        <Garde verrou={verrou}>
          <div class="sx-ajout-ligne">
            <button type="button" class="sx-fantome" onClick={() => setAjout(true)}><Ic n="plus" taille={16} />{m.ajouterBouton}</button>
            {!liste && <button type="button" class="sx-note" onClick={() => setNoteOuverte(true)} aria-label={m.ajouterNote}><Ic n="note-pencil" taille={17} /></button>}
          </div>
        </Garde>
        {!liste ? <div class="sx-nav">
          <button type="button" class="sx-cercle" disabled={verrou || courant === 0} onClick={() => aller(courant - 1)} aria-label={t.seance.precedentExercice}><Ic n="caret-left:bold" taille={18} /></button>
          {principal}
          <button type="button" class="sx-cercle" disabled={verrou || courant >= total - 1} onClick={() => aller(courant + 1)} aria-label={t.seance.suivantExercice}><Ic n="caret-right:bold" taille={18} /></button>
        </div> : <div class="sx-nav">{principal}</div>}
        <Garde verrou={verrou}>
          <p class="sx-liens">
            {!liste && total > 1 && <><button type="button" onClick={() => setRetrait(true)}>{m.retirer}</button><i aria-hidden="true" /></>}
            <button type="button" onClick={finir}>{m.terminerSeance}</button>
          </p>
        </Garde>
      </>}

      <FeuilleAjouter ouverte={ajout} fermer={() => setAjout(false)} ajouter={ajouter} />
      <FeuilleChanger i={echange} fermer={() => setEchange(null)} choisir={changer} />
      <FeuilleApercu ouverte={apercu} fermer={() => setApercu(false)} aller={aller} liste={liste} basculerListe={basculerListe}
        abandonner={() => { setApercu(false); setAbandon(true); }} />

      <Feuille ouverte={muscles} fermer={() => setMuscles(false)} titre={m.musclesSeance}>
        <div class="sx-muscles-grand"><SilhouettePar mode="heat" vueInitiale="both" ramp="ember" intensites={intensitesDe({ exercices: ec.exercices })} lang={langue} sexe={etat.value?.profil?.sexe === 'f' ? 'f' : 'm'} /></div>
      </Feuille>

      <Feuille ouverte={noteOuverte && Boolean(exCourant)} fermer={() => setNoteOuverte(false)} titre={exCourant ? nomExercice(exCourant.ex) : ''} sansFocus>
        {exCourant && <div class="pile">
          <div class="champ">
            <label for="note-ex" class="label">{m.noteExercice}</label>
            <textarea id="note-ex" class="form-input" rows={3} maxLength={500} value={exCourant.note ?? ''}
              onInput={(e) => majEnCours((x) => { x.exercices[courant].note = e.target.value; return x; })} />
          </div>
          {defCourant?.mesure !== 'duree' && <button type="button" class="sx-option" aria-pressed={Boolean(exCourant.unilat)}
            onClick={() => majEnCours((x) => { x.exercices[courant].unilat = !x.exercices[courant].unilat; return x; })}>
            <Ic n="person-simple" taille={18} /><span>{langue === 'en' ? 'Unilateral' : 'Unilatéral'}</span><span class={`sx-inter ${exCourant.unilat ? 'on' : ''}`} aria-hidden="true"><i /></span>
          </button>}
          <button type="button" class="btn pri large" onClick={() => setNoteOuverte(false)}>{m.termine}</button>
        </div>}
      </Feuille>

      <Dialogue ouvert={retrait} fermer={() => setRetrait(false)} titre={m.retirerTitre} texte={exCourant ? m.retirerTexte(nomExercice(exCourant.ex)) : ''} libelle={m.retirerOk} danger
        confirmer={() => {
          majEnCours((x) => { x.exercices.splice(courant, 1); x.courant = Math.max(0, Math.min(courant, x.exercices.length - 1)); return x; });
          setRetrait(false);
        }} />
      <Dialogue ouvert={abandon} fermer={() => setAbandon(false)} titre={t.seance.abandonnerTitre} texte={t.seance.abandonnerTexte} libelle={t.seance.abandonnerOk} danger
        confirmer={() => { abandonner(); location.replace('#/'); }} />
    </main>
  );
}
