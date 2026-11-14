// Cartes du bilan branchées sur les réglages d'Entraînement : « Ajuster les séries par muscle » (_TuneCard)
// et « Suggérer l'étape suivante » (_levelUpCard), d'après workout_state.dart (tuneTargets, _offerLevelUp).
import { afficher, api, ecrireModule, etat, lireModule, nomExercice, trouverExercice } from '../donnees.js';
import { progressionActive, regleDe } from '../progression.js';
import { M03 } from '../i18n/m03.js';
import { langue, t } from '../i18n.js';
import { Ic } from '../ui.jsx';
import { lireArchives, modeDe, Vignette } from './exercices.jsx';
import { ajusterPlan, dossierDe, echelleDe, etapeSuivante, LENTS, liesDe, planDe, seriesTravail } from './programme-donnees.js';

const tx = () => (M03[langue] ?? M03.fr).bilan;

const JOUR = 86400000;
const reussit = (series, reps) => series.filter((s) => s.type !== 'e' && (s.r ?? 0) >= reps).length >= 3;
const lireEtapes = () => { const m = lireModule('etapes'); return { vu: m?.vu && typeof m.vu === 'object' ? m.vu : {}, garde: Array.isArray(m?.garde) ? m.garde : [] }; };
const ecrireEtapes = (patch) => ecrireModule('etapes', { ...lireEtapes(), ...patch }).catch(() => {});

/** Proposition d'étape suivante pour la séance enregistrée `s` (null si rien), comme _offerLevelUp. Pur : n'écrit rien. */
export function proposerEtape(s, seances, maintenant = Date.now()) {
  const { vu, garde } = lireEtapes();
  const faits = new Set(s.donnees.exercices.map((e) => e.ex));
  const archives = new Set(lireArchives());
  let meilleur = null;
  let rang = -1;
  for (const e of s.donnees.exercices) {
    const vers = etapeSuivante(e.ex);
    if (!vers || faits.has(vers) || garde.includes(e.ex) || archives.has(vers) || (vu[e.ex] ?? 0) > maintenant) continue;
    const de = trouverExercice(e.ex), a = trouverExercice(vers);
    if (!de || !a || modeDe(de)) continue;
    const reps = LENTS.has(e.ex) ? 5 : 8;
    if (!reussit(e.series, reps)) continue;
    const avant = seances.filter((x) => x.cle !== s.cle && x.debut < s.debut).sort((x, y) => (x.debut < y.debut ? 1 : -1))
      .map((x) => x.donnees.exercices.filter((y) => y.ex === e.ex).at(-1)).find(Boolean);
    if (!avant || !reussit(avant.series, reps)) continue;
    const i = echelleDe(e.ex).indexOf(e.ex);
    if (i > rang) { rang = i; meilleur = { de, a, reps }; }
  }
  return meilleur;
}

const corpsRoutine = (r, exercices) => ({ nom: r.nom, dossier: dossierDe(r), ...(r.couleur ? { couleur: r.couleur } : {}), lies: liesDe(r), exercices });
const exercicesPlan = (r) => (r.exercices ?? []).map((e) => ({ ex: e.ex, repos: e.repos ?? null, note: e.note ?? '', ...(Array.isArray(e.lies) ? { lies: e.lies } : {}), planifie: planDe(e) }));

async function enregistrerRoutine(r, exercices) {
  await api('PUT', `/api/routines/${r.id}`, corpsRoutine(r, exercices));
  const e = etat.value;
  etat.value = { ...e, routines: e.routines.map((x) => (x.id === r.id ? { ...x, exercices } : x)) };
}

/** Muscles à noter (tuneTargets) : exercices du programme, hors durée et hors règle « séries », au moins 2 séries par muscle, 3 muscles. */
export function musclesANoter(ec, routine) {
  if (!ec || !routine) return [];
  const ids = new Set((routine.exercices ?? []).map((e) => e.ex));
  const faits = {}, dernier = {};
  for (const e of ec.exercices) {
    const place = e.remplaceDe && ids.has(e.remplaceDe) && !ids.has(e.ex) ? e.remplaceDe : e.ex;
    const def = trouverExercice(e.ex);
    if (!def || !ids.has(place) || def.mesure === 'duree' || (progressionActive(place) && regleDe(place).k === 'volume')) continue;
    const n = e.series.filter((x) => x.fait && x.type !== 'e').length;
    if (!n) continue;
    faits[def.muscle] = (faits[def.muscle] ?? 0) + n;
    dernier[def.muscle] = place;
  }
  return Object.entries(faits).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([muscle]) => ({ muscle, ex: dernier[muscle] }));
}

/** « Volume du jour » : trop peu (+1 série), bien, trop (-1 série) pour la prochaine fois. `votes` est gardé par le bilan pour l'annuler. */
export function CarteVolume({ cibles, routineId, votes, setVotes }) {
  const b = tx();
  const routine = etat.value.routines.find((r) => String(r.id) === String(routineId));
  if (!routine || !cibles.length) return null;
  const voter = async (c, v) => {
    const ancien = votes[c.muscle]?.vote ?? 0;
    const suivant = votes[c.muscle]?.vote === v ? null : v;
    const delta = (suivant ?? 0) - ancien;
    const r = etat.value.routines.find((x) => x.id === routine.id);
    const ex = r.exercices.find((e) => e.ex === c.ex);
    if (!ex || seriesTravail(ex) + delta < 1) return;
    try {
      if (delta) await enregistrerRoutine(r, exercicesPlan(r).map((e) => (e.ex === c.ex ? { ...e, planifie: ajusterPlan(e, delta) } : e)));
      setVotes((x) => { const n = { ...x }; if (suivant === null) delete n[c.muscle]; else n[c.muscle] = { ex: c.ex, vote: suivant }; return n; });
    } catch { afficher(t.commun.erreur, 'danger'); }
  };
  return <section class="bl-carte">
    <p class="bl-carte-kicker">{b.volumeJour}</p>
    <p class="bl-carte-aide">{b.volumeAide}</p>
    {cibles.map((c) => {
      const vote = votes[c.muscle]?.vote;
      const ex = routine.exercices.find((e) => e.ex === c.ex);
      return <div class="bl-muscle" key={c.muscle}>
        <strong>{t.muscles[c.muscle] ?? c.muscle}</strong>
        {vote != null && ex && <small class={vote === 0 ? '' : 'sauge'}>{vote === 0 ? b.volumePareil : b.volumeSuite(seriesTravail(ex), nomExercice(c.ex))}</small>}
        <div class="bl-seg" role="radiogroup" aria-label={t.muscles[c.muscle] ?? c.muscle}>
          {[[1, b.tropPeu], [0, b.bien], [-1, b.trop]].map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={vote === v} onClick={() => voter(c, v)}>{l}</button>)}
        </div>
      </div>;
    })}
  </section>;
}

/** Annule les votes (_undoVotes), pour « Continuer la séance ». */
export async function annulerVotes(routineId, votes) {
  const r = etat.value.routines.find((x) => String(x.id) === String(routineId));
  const liste = Object.values(votes).filter((v) => v.vote);
  if (!r || !liste.length) return;
  await enregistrerRoutine(r, exercicesPlan(r).map((e) => { const v = liste.find((x) => x.ex === e.ex); return v ? { ...e, planifie: ajusterPlan(e, -v.vote) } : e; }));
}

/** Carte « ÉTAPE SUIVANTE » : remplacer dans le programme (ou voir l'exercice), pas maintenant (21 jours), je garde celui-ci. */
export function CarteEtape({ offre, routineId, fermer }) {
  const b = tx();
  const routine = routineId == null ? null : etat.value.routines.find((r) => String(r.id) === String(routineId));
  const ids = (routine?.exercices ?? []).map((e) => e.ex);
  const dansRoutine = Boolean(routine) && ids.includes(offre.de.id) && !ids.includes(offre.a.id);
  const remplacer = async () => {
    try {
      await enregistrerRoutine(routine, exercicesPlan(routine).map((e) => (e.ex === offre.de.id ? { ...e, ex: offre.a.id } : e)));
      afficher(b.etapeRemplace(nomExercice(offre.a), routine.nom));
      fermer();
    } catch { afficher(t.commun.erreur, 'danger'); }
  };
  const plusTard = () => { ecrireEtapes({ vu: { ...lireEtapes().vu, [offre.de.id]: Date.now() + 21 * JOUR } }); fermer(); };
  const garder = () => {
    const avant = lireEtapes().garde;
    ecrireEtapes({ garde: [...avant, offre.de.id] });
    fermer();
    afficher(b.etapeGardee, 'ok', { libelle: t.commun.annuler, fn: () => ecrireEtapes({ garde: avant }) });
  };
  return <section class="bl-carte">
    <div class="bl-etape">
      <a class="bl-etape-img" href={`#/exercice/${offre.a.id}`} aria-label={b.etapeVoir}><Vignette e={offre.a} taille={64} /></a>
      <div class="bl-etape-texte">
        <p class="bl-carte-kicker sauge"><Ic n="trend-up:bold" taille={13} />{b.etapeKicker}</p>
        <strong>{nomExercice(offre.a)}</strong>
        <small>{b.etapeCorps(offre.reps, nomExercice(offre.de))}</small>
      </div>
    </div>
    {dansRoutine ? <button type="button" class="bl-etape-btn" onClick={remplacer}>{b.etapeRemplacer(routine.nom)}</button>
      : <a class="bl-etape-btn" href={`#/exercice/${offre.a.id}`}>{b.etapeVoir}</a>}
    <p class="bl-etape-liens"><button type="button" onClick={plusTard}>{b.etapePlusTard}</button><i aria-hidden="true">·</i><button type="button" onClick={garder}>{b.etapeGarder}</button></p>
  </section>;
}

/** Pose le délai de 7 jours sur l'exercice proposé (levelSeen), et rend la valeur d'avant pour « Continuer la séance ». */
export function marquerVue(offre) {
  const vu = lireEtapes().vu;
  const avant = vu[offre.de.id];
  ecrireEtapes({ vu: { ...vu, [offre.de.id]: Date.now() + 7 * JOUR } });
  return () => { const v = { ...lireEtapes().vu }; if (avant == null) delete v[offre.de.id]; else v[offre.de.id] = avant; ecrireEtapes({ vu: v }); };
}

