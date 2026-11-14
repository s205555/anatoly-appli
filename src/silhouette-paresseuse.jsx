// SilhouetteSvg (gros morceau de la carte musculaire) chargée à la demande pour les petits aperçus de l'accueil.
// Le cadre qui la contient a une taille fixe : rien ne bouge quand elle arrive.
import { paresseux } from './paresseux.js';

export const SilhouettePar = paresseux(() => import('./silhouette-svg.jsx'), 'SilhouetteSvg');
export const CorpsOnboardingPar = paresseux(() => import('./silhouette-svg.jsx'), 'CorpsOnboarding');
