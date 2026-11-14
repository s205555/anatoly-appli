// Réglages de l'appli (hors du gros écran reglages.jsx pour que l'accueil ne le charge pas).
// Gardés sur le compte (extensions.modules.reglages) ; localStorage sert de copie pour le premier affichage et les anciens réglages.
import { ecrireModule, etat, lireModule } from '../donnees.js';
import { appliquerTexte } from '../theme.js';

const CLE_M13 = 'an_m13';
const lireLocal = () => { try { const v = JSON.parse(localStorage.getItem(CLE_M13)); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };

export const lireM13 = () => {
  const compte = lireModule('reglages');
  return { ...lireLocal(), ...(compte && typeof compte === 'object' ? compte : {}) };
};

export const ecrireM13 = (v) => {
  try { localStorage.setItem(CLE_M13, JSON.stringify(v)); } catch { /* stockage privé */ }
  ecrireModule('reglages', v).catch(() => {});
};

// Applique l'arrière-plan, le flou et la taille du texte (appelé à chaque rendu de l'appli, sans effet si rien ne change).
export function poserAffichage() {
  const r = lireM13();
  const racine = document.documentElement;
  const photo = typeof r.fondPhoto === 'string' && /^[0-9a-f]{32}$/.test(r.fondPhoto) ? r.fondPhoto : null;
  const f = r.fond === 'photo' && photo ? 'photo' : r.fond === 'grille' ? 'grille' : r.fond === 'aucun' ? 'aucun' : 'points';
  if (racine.dataset.fond !== f) racine.dataset.fond = f;
  if (f === 'photo') {
    const dim = [0.4, 0.55, 0.72].includes(r.fondAssombri) ? r.fondAssombri : 0.55;
    const url = `url("/api/media/${photo}")`;
    if (racine.style.getPropertyValue('--fond-photo') !== url) racine.style.setProperty('--fond-photo', url);
    racine.style.setProperty('--fond-a', `${Math.round(dim * 100)}%`);
    racine.style.setProperty('--fond-b', `${Math.round(Math.min(1, dim + 0.18) * 100)}%`);
  }
  racine.classList.toggle('sans-flou', r.flou === false);
  racine.classList.toggle('flou-fin', r.flou !== false && r.flouFin === true);
  racine.classList.toggle('sans-etiquettes', r.etiquettesChaleur === false);
  appliquerTexte(['petit', 'grand'].includes(r.tailleTexte) ? r.tailleTexte : 'normal');
}

// Sauvegarde automatique (auto_backup.dart) : « Après chaque séance » dès qu'une séance est plus récente que la
// dernière copie, « une fois par jour / semaine » en quittant l'appli. Copie gardée dans ce navigateur.
let sauvEnCours = false;
export async function lancerSauvegardeAuto() {
  const r = lireM13();
  const mode = ['workout', 'daily', 'weekly'].includes(r.sauvegardeAutoMode) ? r.sauvegardeAutoMode : null;
  if (!mode || sauvEnCours) return null;
  sauvEnCours = true;
  try {
    const { sauvegardeAuto, derniereSauvegardeAuto } = await import('./onboarding.jsx');
    const dernier = (await derniereSauvegardeAuto())?.date ?? null;
    const garder = [1, 3, 5, 10, 20].includes(r.sauvegardeAutoGarder) ? r.sauvegardeAutoGarder : 5;
    if (mode === 'workout') {
      const recente = (etat.value?.seances ?? []).some((s) => !dernier || s.debut > dernier);
      return recente ? await sauvegardeAuto('workout', null, garder) : null;
    }
    return await sauvegardeAuto(mode, dernier, garder);
  } catch { return null; } finally { sauvEnCours = false; }
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') lancerSauvegardeAuto(); });
