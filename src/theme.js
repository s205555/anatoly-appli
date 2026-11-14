// Application du thème (sombre/clair/amoled/système) et de la taille du texte (petit/normal/grand, cap 1,15).
import { appliquerTheme } from './donnees.js';

export { appliquerTheme };

export function appliquerTexte(t) {
  const root = document.documentElement;
  if (root.dataset.texte === t) return;
  root.dataset.texte = t;
  // Zoom sur #app : le corps est en px, le zoom est le moyen le plus court de respecter le 1 px Flutter = 1 px CSS.
  const app = document.getElementById('app');
  if (!app) return;
  app.style.zoom = t === 'petit' ? '0.9' : t === 'grand' ? '1.12' : '';
}

export function essayerTexte(d) {
  const t = (d && d.tailleTexte) || 'normal';
  appliquerTexte(t);
}