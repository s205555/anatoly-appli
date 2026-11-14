// Feuille Strava : portage 1:1 de strava_sheet.dart (titre et pastille bêta, explication, calendrier du mois,
// séances du jour choisi). Le fichier .fit est réellement produit (exporter.js), comme dans l'original.
import { useState } from 'preact/hooks';
import { etat, enDate as date, jourLocal } from '../donnees.js';
import { langue } from '../i18n.js';
import { telecharger, workoutFit } from '../exporter.js';
import { Feuille, Ic } from '../ui.jsx';
import { lireM13 } from './reglages-m13.js';

const T = {
  fr: {
    beta: 'BÊTA',
    intro: 'Choisissez une séance à envoyer sur Strava. Vous obtenez un fichier .fit : importez-le depuis un navigateur sur strava.com/upload/select, il apparaît comme musculation avec vos séries.',
    vide: 'Aucune séance à exporter pour l’instant.',
    moisPrec: 'Mois précédent', moisSuiv: 'Mois suivant',
    series: (n) => (n === 1 ? '1 série' : `${n} séries`),
    pret: 'Fichier .fit prêt. Importez-le sur strava.com/upload/select.',
  },
  en: {
    beta: 'BETA',
    intro: 'Pick a workout to take it to Strava. You get a .fit file: upload it in a browser at strava.com/upload/select and it shows up as a Weight Training with your sets.',
    vide: 'No workouts to export yet.',
    moisPrec: 'Previous month', moisSuiv: 'Next month',
    series: (n) => (n === 1 ? '1 set' : `${n} sets`),
    pret: '.fit file ready. Upload it at strava.com/upload/select.',
  },
};

const loc = () => (langue === 'en' ? 'en-GB' : 'fr-FR');
const nbSeries = (s) => (s.donnees?.exercices ?? []).reduce((n, e) => n + (e.series ?? []).filter((x) => x.fait !== false).length, 0);

export function FeuilleStrava({ ouverte, fermer }) {
  const x = T[langue] ?? T.fr;
  const seances = [...(etat.value?.seances ?? [])].sort((a, b) => (a.debut < b.debut ? 1 : -1));
  const parJour = new Map();
  for (const s of seances) { const k = jourLocal(date(s.debut)); parJour.set(k, [...(parJour.get(k) ?? []), s]); }
  const premier = seances.length ? jourLocal(date(seances[0].debut)) : null;
  const [jour, setJour] = useState(premier);
  const [mois, setMois] = useState(() => { const d = premier ? date(premier) : new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const debutSemaine = Number(lireM13().debutSemaine) || 0; // 0 = lundi
  const aujourdhui = jourLocal(new Date());
  const nbJours = new Date(mois.getFullYear(), mois.getMonth() + 1, 0).getDate();
  const decalage = ((mois.getDay() + 6) % 7 - debutSemaine + 7) % 7;
  const initiales = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(loc(), { weekday: 'narrow' }).format(new Date(2024, 0, 1 + ((debutSemaine + i) % 7))));
  const cases = Array.from({ length: Math.ceil((decalage + nbJours) / 7) * 7 }, (_, i) => i - decalage + 1);
  const choisis = parJour.get(jour) ?? [];
  const exporter = async (s) => {
    const fit = workoutFit(s, { pounds: etat.value?.profil?.unite === 'lb' });
    await telecharger(new Blob([fit], { type: 'application/vnd.ant.fit' }), `Anatoly ${jourLocal(date(s.debut))}.fit`);
  };
  return <Feuille ouverte={ouverte} fermer={fermer} titre="Strava" classe="stv"><div>
    <div class="stv-tete"><h2>Strava</h2><span class="stv-beta">{x.beta}</span></div>
    <p class="stv-intro">{x.intro}</p>
    {!parJour.size ? <p class="stv-vide">{x.vide}</p> : <>
      <div class="stv-mois">
        <button type="button" class="stv-fleche" aria-label={x.moisPrec} onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() - 1, 1))}><Ic n="caret-left:bold" taille={13} /></button>
        <strong>{new Intl.DateTimeFormat(loc(), { month: 'long', year: 'numeric' }).format(mois)}</strong>
        <button type="button" class="stv-fleche" aria-label={x.moisSuiv} onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() + 1, 1))}><Ic n="caret-right:bold" taille={13} /></button>
      </div>
      <div class="stv-grille" role="grid">
        {initiales.map((l, i) => <span key={`i${i}`} class="stv-initiale" aria-hidden="true">{l.toUpperCase()}</span>)}
        {cases.map((n, i) => {
          if (n < 1 || n > nbJours) return <span key={i} class="stv-case" />;
          const d = new Date(mois.getFullYear(), mois.getMonth(), n);
          const k = jourLocal(d);
          const a = parJour.has(k);
          const on = a && k === jour;
          return <button key={i} type="button" class={`stv-case${a ? ' a' : ''}${on ? ' on' : ''}${k === aujourdhui && !on ? ' auj' : ''}`} disabled={!a} aria-pressed={a ? on : undefined}
            aria-label={new Intl.DateTimeFormat(loc(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d)} onClick={() => setJour(k)}>{n}</button>;
        })}
      </div>
      <div class="stv-liste">
        {choisis.map((s) => {
          const min = Math.floor((Number(s.duree_s) || 0) / 60);
          return <button key={s.cle ?? s.id} type="button" class="stv-ligne" onClick={() => exporter(s)}>
            <span><strong>{new Intl.DateTimeFormat(loc(), { weekday: 'long', day: 'numeric', month: 'long' }).format(date(s.debut))}</strong>
              <small>{x.series(nbSeries(s))}{min > 0 ? ` · ${min} min` : ''}</small></span>
            <span class="stv-ic" aria-hidden="true"><Ic n="export" taille={17} /></span>
          </button>;
        })}
      </div>
    </>}
  </div></Feuille>;
}
