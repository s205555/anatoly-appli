// Feuille « Progression » d'un exercice, ouverte depuis l'éditeur de programme (GymMane : widgets/progression_sheet.dart).
import { etat, nombre, unite, versAffichage } from '../donnees.js';
import { langue } from '../i18n.js';
import { textes } from '../i18n/m06.js';
import { Feuille, Ic } from '../ui.jsx';
import { GENRES, ajusterPas, basculerProgression, changerRegle, pasDe, progressionActive, regleDe, usePlage } from '../progression.js';

const tp = () => textes[langue === 'en' ? 'en' : 'fr'].progression;

function Pas({ valeur, moins, plus, label, serre }) {
  return <div class={`stepper prog-pas${serre ? ' serre' : ''}`}>
    <button type="button" aria-label={`${label} -`} onClick={moins}>−</button>
    <output aria-live="polite">{valeur}</output>
    <button type="button" aria-label={`${label} +`} onClick={plus}>+</button>
  </div>;
}

export function libelleGenre(ex) { return tp().genres[regleDe(ex).k]; }

export function FeuilleProgression({ ex, fermer }) {
  void etat.value; // relit la feuille quand le module du compte change
  const T = tp();
  const r = regleDe(ex);
  const on = progressionActive(ex);
  const poser = (patch) => changerRegle(ex, { ...r, ...patch });
  const ligne = (label, controles) => <div class="prog-ligne"><span>{label}</span><div class="prog-controles">{controles}</div></div>;
  return <Feuille ouverte fermer={fermer} titre={T.titre}>
    <div class="rt-options" role="radiogroup" aria-label={T.titre}>
      {GENRES.map((k) => <button key={k} type="button" role="radio" aria-checked={k === r.k} class={`rt-opt${k === r.k ? ' choisi' : ''}`} onClick={() => poser({ k })}>
        <span class="rt-opt-texte"><b>{T.genres[k]}</b>{k === r.k && <small>{T.aides[k]}</small>}</span>{k === r.k && <Ic n="check:bold" taille={16} />}
      </button>)}
    </div>
    {r.k !== 'manuelle' && <div class="prog-boite">
      <button type="button" class="prog-ligne prog-bascule" role="switch" aria-checked={on} onClick={() => basculerProgression(ex)}>
        <span class="prog-bascule-texte"><span>{T.appliquer}</span>{!on && <small>{T.appliquerAide}</small>}</span>
        <span class={`inter ${on ? 'on' : ''}`} aria-hidden="true"><span /></span>
      </button>
      {on && ligne(T.pas, <Pas label={T.pas} valeur={`${nombre(versAffichage(pasDe(ex) ?? 0), 2)} ${unite()}`} moins={() => ajusterPas(ex, -1)} plus={() => ajusterPas(ex, 1)} />)}
      {usePlage(r) && ligne(T.plage, <>
        <Pas serre label={T.plage} valeur={r.lo} moins={() => poser({ lo: r.lo - 1 })} plus={() => poser({ lo: r.lo + 1, hi: Math.max(r.hi, r.lo + 2) })} />
        <span class="prog-sep" aria-hidden="true">-</span>
        <Pas serre label={T.plage} valeur={r.hi} moins={() => poser({ hi: r.hi - 1 })} plus={() => poser({ hi: r.hi + 1 })} />
      </>)}
      {r.k === 'volume' && ligne(T.series, <>
        <Pas serre label={T.series} valeur={r.s} moins={() => poser({ s: r.s - 1 })} plus={() => poser({ s: r.s + 1, ms: Math.max(r.ms, r.s + 2) })} />
        <span class="prog-sep" aria-hidden="true">-</span>
        <Pas serre label={T.series} valeur={r.ms} moins={() => poser({ ms: r.ms - 1 })} plus={() => poser({ ms: r.ms + 1 })} />
      </>)}
      {on && ligne(T.allegerApres, <Pas label={T.allegerApres} valeur={T.echecs(r.f)} moins={() => poser({ f: r.f - 1 })} plus={() => poser({ f: r.f + 1 })} />)}
      {on && ligne(T.allegerDe, <Pas label={T.allegerDe} valeur={`${r.d} %`} moins={() => poser({ d: r.d - 5 })} plus={() => poser({ d: r.d + 5 })} />)}
    </div>}
  </Feuille>;
}
