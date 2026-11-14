// Dossier de programme et ses petits aides, hors du gros écran programmes.jsx pour que l'accueil ne charge pas tout l'écran.
import { demarrer, enCours, etat, nbExercicesValides, trouverExercice } from '../donnees.js';
import { langue, dp } from '../i18n.js';
import { textes as textes6b } from '../i18n/m06b.js';
import { SilhouettePar } from '../silhouette-paresseuse.jsx';
import { Ic } from '../ui.jsx';
import { couleurDe, dossierDe, lireMeta, nbSeries, routinePourDemarrer } from './programme-donnees.js';
import { couleurRoutine } from './couleurs-programmes.js';

export const lancer = (r) => { if (!enCours.value) demarrer(routinePourDemarrer(r)); location.hash = '#/seance'; };

export const TB = () => textes6b[langue === 'en' ? 'en' : 'fr'];
export const archivesLues = () => (Array.isArray(lireMeta().archives) ? lireMeta().archives.map(String) : []);
export const estArchive = (r) => archivesLues().includes(String(r.id));
export const couleurCarte = (r) => couleurRoutine(r.id) ?? couleurDe(r);

/** Séries par muscle d'un programme : principal plein, secondaires à moitié. */
function seriesMuscles(r) {
  const out = {};
  for (const e of r.exercices ?? []) {
    const d = trouverExercice(e.ex);
    if (!d || !d.muscle) continue;
    const n = nbSeries(e);
    out[d.muscle] = (out[d.muscle] ?? 0) + n;
    for (const m of d.autres ?? []) out[m] = (out[m] ?? 0) + n / 2;
  }
  return out;
}
export function intensitesDe(r) {
  const s = seriesMuscles(r);
  const top = Math.max(0, ...Object.values(s));
  const o = {};
  for (const [m, n] of Object.entries(s)) o[m] = top > 0 ? Math.max(1, Math.round((n / top) * 3) + 1) : 0;
  return o;
}

// `dernier` : texte « Il y a N jours » de l'accueil (RoutineFolder lastDone), à la place du groupe.
export function Dossier({ r, onMenu, dernier }) {
  const tb = TB();
  const n = nbExercicesValides(r);
  const g = dossierDe(r);
  return <article class="rt-dossier" style={`--teinte:${couleurCarte(r)}`}>
    <span class="rt-onglet" aria-hidden="true" /><span class="rt-fond" aria-hidden="true" />
    <span class="rt-dos" aria-hidden="true" />
    <span class="rt-feuille" aria-hidden="true"><i /><i /></span>
    <a class="rt-ouvrir" href={`#/programme/${r.id}`} aria-label={r.nom} />
    <div class="rt-face">
      <div class="rt-face-haut">
        <strong><span class="rt-nom">{r.nom}</span><Ic n="caret-right:bold" taille={13} /></strong>
        <button type="button" class="rt-plus" aria-label={tb.plusOptions} onClick={onMenu}><Ic n="dots-three-vertical:bold" taille={16} /></button>
      </div>
      <div class="rt-face-bas">
        <small>{(dernier ? [tb.exosN(n), dernier] : [g, tb.exosN(n)]).filter(Boolean).join(' · ')}</small>
        {n > 0 && <span class="rt-mini" aria-hidden="true"><SilhouettePar mode="heat" vueInitiale="both" ramp="ember" intensites={intensitesDe(r)} lang={langue} sexe={etat.value?.profil?.sexe === 'f' ? 'f' : 'm'} /></span>}
      </div>
    </div>
    {n > 0
      ? <button type="button" class="rt-pied" disabled={!!enCours.value} onClick={() => lancer(r)} aria-label={`${tb.demarrer}${dp()}${r.nom}`}><Ic n="play:fill" taille={12} />{tb.demarrer}</button>
      : <a class="rt-pied" href={`#/programme/${r.id}`}><Ic n="plus:bold" taille={12} />{tb.ajouterExos}</a>}
  </article>;
}
