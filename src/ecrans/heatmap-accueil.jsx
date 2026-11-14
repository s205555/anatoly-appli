// Carte « Activité » de l'accueil, hors du gros écran progres.jsx pour que l'accueil ne charge pas la carte musculaire.
import { bilanSeance, dateLongue, jourDe, jourLocal, lundi } from '../donnees.js';
import { langue as langueApp } from '../i18n.js';
import { fr as m04fr, en as m04en } from '../i18n/m04.js';

export const X = () => (langueApp === 'fr' ? m04fr : m04en).progres;

export function parJour(seances, f) {
  const m = new Map();
  for (const s of seances) {
    const k = jourDe(s.debut);
    m.set(k, (m.get(k) ?? 0) + f(s));
  }
  return m;
}

// Rampes de la feuille « Couleur de chaleur » (RAMPE_HEAT de silhouette-svg.jsx, recopiées pour ne pas charger la silhouette ici).
const RAMPES = {
  ember: ['#7A4028', '#B4632C', '#E38B3A', '#FFC168'],
  green: ['#1B4B2C', '#2C7A44', '#3FA95C', '#63D67F'],
  blue: ['#1E3A5C', '#2C5E96', '#3D86C9', '#6EB4F0'],
  mono: ['#3A3A3A', '#5E5E5E', '#8C8C8C', '#D8D8D8'],
};

// _heatLevels (stats_state.dart) : jour actif sans charge = 1, sinon rang de sa charge parmi les jours chargés de la fenêtre (1 à 4).
export function niveauxChaleur(charges, actifs, cles) {
  const leves = cles.map((k) => charges.get(k) ?? 0).filter((v) => v > 0).sort((a, b) => a - b);
  return new Map(cles.map((k) => {
    const v = charges.get(k) ?? 0;
    if (!actifs.has(k)) return [k, 0];
    if (v <= 0) return [k, 1];
    if (leves.length < 2) return [k, 4];
    return [k, 1 + Math.round((leves.indexOf(v) / (leves.length - 1)) * 3)];
  }));
}

// Carte « Activité » de l'accueil (home_screen.dart, Heatmap 12 semaines avec libellés) : mêmes cases que la régularité.
export function HeatmapAccueil({ seances, ouvrirJour, pointes = [], teinte }) {
  const rampe = RAMPES[teinte] ?? RAMPES.ember;
  const charges = parJour(seances, (s) => bilanSeance(s.donnees).volume);
  const debut = lundi(); debut.setDate(debut.getDate() - 7 * 11);
  const auj = jourLocal(new Date());
  const cles = Array.from({ length: 84 }, (_, i) => { const d = new Date(debut); d.setDate(d.getDate() + i); return jourLocal(d); }).filter((k) => k <= auj);
  const niveaux = niveauxChaleur(charges, new Set([...charges.keys(), ...pointes]), cles);
  const semaines = Array.from({ length: 12 }, (_, w) => { const d = new Date(debut); d.setDate(d.getDate() + w * 7); return d; });
  const initiales = langueApp === 'fr' ? ['L', 'M', 'M', 'J', 'V', 'S', 'D'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const fmtMois = new Intl.DateTimeFormat(langueApp === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' });
  const moisLib = [];
  let dernierMois = null;
  semaines.forEach((d, col) => {
    const m = d.getMonth();
    if (m !== dernierMois && (col > 0 || d.getDate() <= 7)) moisLib.push({ col, txt: fmtMois.format(d).replace('.', '') });
    dernierMois = m;
  });
  return (
    <div class="m04-hm-grille" style={{ gridTemplateColumns: '16px repeat(12, minmax(0, 1fr))' }} role="group" aria-label={X().regularite}>
      {moisLib.map(({ col, txt }) => <span key={`m${col}`} class="m04-hm-mois" style={{ gridRow: 1, gridColumn: col + 2 }} aria-hidden="true">{txt}</span>)}
      {initiales.map((x, j) => <span key={`j${j}`} class="m04-hm-jour" style={{ gridRow: j + 2, gridColumn: 1 }} aria-hidden="true">{x}</span>)}
      {initiales.map((_, j) => semaines.map((dSem, col) => {
        const d = new Date(dSem); d.setDate(d.getDate() + j);
        const k = jourLocal(d);
        const n = niveaux.get(k) ?? 0;
        return <button key={`${j}-${k}`} type="button" class={k > auj ? 'futur' : n ? `n${n}` : 'zero'} style={{ gridRow: j + 2, gridColumn: col + 2, ...(n && k <= auj ? { background: rampe[n - 1] } : {}) }} aria-label={dateLongue(k)} disabled={k > auj} onClick={() => ouvrirJour(k)} />;
      }))}
    </div>
  );
}
