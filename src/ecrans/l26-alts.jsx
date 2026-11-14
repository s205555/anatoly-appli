// Remplaçants d'un exercice dans un programme (routines_state.dart routineAlts, maxAlts 3 ; routine_edit_screen.dart _altsRow, _pickAlts).
// Gardés dans le module « alts » du compte : { [id du programme]: { [exercice]: [remplaçants] } }. Proposés en tête de « Changer d'exercice » en séance.
import { useState } from 'preact/hooks';
import { afficher, ecrireModule, lireModule, nomExercice, tousExercices, trouverExercice } from '../donnees.js';
import { t } from '../i18n.js';
import { L26 } from '../i18n/l26.js';
import { Feuille, Ic } from '../ui.jsx';
import { lireFavoris } from './exercices.jsx';

export const ALTS_MAX = 3;
export const altsDe = (routineId, ex) => (routineId == null ? [] : lireModule('alts')?.[routineId]?.[ex] ?? []).filter((id) => trouverExercice(id));

/** toggleRoutineAlt : ajoute ou retire ; au-delà de trois, le plus ancien sort. */
export function basculerAlt(alts, routineId, ex, alt) {
  if (alt === ex) return alts;
  const tout = { ...(alts ?? {}) };
  const duProg = { ...(tout[routineId] ?? {}) };
  const liste = [...(duProg[ex] ?? [])];
  const i = liste.indexOf(alt);
  if (i >= 0) liste.splice(i, 1);
  else { if (liste.length >= ALTS_MAX) liste.shift(); liste.push(alt); }
  if (liste.length) duProg[ex] = liste; else delete duProg[ex];
  if (Object.keys(duProg).length) tout[routineId] = duProg; else delete tout[routineId];
  return tout;
}

/** Même muscle, même genre (durée ou non), favoris et exercices déjà faits d'abord : swapOptions(n: 18). */
function options(def, exclus) {
  const favoris = new Set(lireFavoris());
  return tousExercices.value.filter((e) => e.id !== def.id && e.muscle === def.muscle && !exclus.has(e.id) && (e.mesure === 'duree') === (def.mesure === 'duree'))
    .map((e, k) => ({ e, k, s: favoris.has(e.id) ? 1 : 0 })).sort((a, b) => b.s - a.s || a.k - b.k).slice(0, 18).map((x) => x.e);
}

export function LigneRemplacants({ routineId, ex, dansProgramme }) {
  const X = L26();
  const [ouvert, setOuvert] = useState(false);
  if (routineId == null) return null;
  const choisis = altsDe(routineId, ex);
  const def = trouverExercice(ex);
  const basculer = (alt) => ecrireModule('alts', basculerAlt(lireModule('alts'), routineId, ex, alt)).catch(() => afficher(t.commun.erreur, 'danger'));
  const pool = def ? [...choisis.map(trouverExercice), ...options(def, new Set([...choisis, ...dansProgramme]))] : [];
  return <>
    <button type="button" class="exo-prog-progression" onClick={() => setOuvert(true)}>
      <Ic n="arrows-left-right" taille={19} />
      <span class="l26-alts-texte"><b>{X.remplacants}</b><small>{choisis.length ? choisis.map((id) => nomExercice(trouverExercice(id))).join(' · ') : X.remplacantsAide}</small></span>
      <Ic n="caret-right:bold" taille={13} />
    </button>
    {ouvert && <Feuille ouverte fermer={() => setOuvert(false)} titre={X.remplacants} sous={X.remplacantsChoix(ALTS_MAX)}
      pied={<button type="button" class="btn pri large" onClick={() => setOuvert(false)}>{L26().termine}</button>}>
      <div class="pile">
        {pool.map((e) => <button type="button" key={e.id} class={`ligne-dossier${choisis.includes(e.id) ? ' on' : ''}`} aria-pressed={choisis.includes(e.id)} onClick={() => { navigator.vibrate?.(5); basculer(e.id); }}>
          <span class="l26-alts-texte"><b>{nomExercice(e)}</b><small>{t.materiels[e.materiel] ?? ''}</small></span>
          {choisis.includes(e.id) && <Ic n="check:bold" taille={16} />}
        </button>)}
      </div>
    </Feuille>}
  </>;
}
