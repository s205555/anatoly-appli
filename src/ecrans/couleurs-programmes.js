// Couleurs des programmes (hors du gros écran programmes.jsx pour que l'accueil ne charge pas la silhouette).
export const TEINTES_DOSSIER = ['#F3C7B1', '#A78BDA', '#A8C99E', '#9CC2E8', '#E8CF98', '#E6A4B9'];
export const teinte = (id, couleur) => (couleur && TEINTES_DOSSIER.includes(String(couleur).toUpperCase()) ? String(couleur).toUpperCase() : TEINTES_DOSSIER[Math.abs(Number(id) || 0) % TEINTES_DOSSIER.length]);

const CLE_COULEURS = 'an_couleurs_programmes';

function lireCarteCouleur() {
  try {
    return JSON.parse(localStorage.getItem(CLE_COULEURS) ?? '{}') || {};
  } catch {
    return {};
  }
}

export function couleurRoutine(id) {
  const m = lireCarteCouleur();
  const c = m[String(id)];
  return c && TEINTES_DOSSIER.includes(String(c).toUpperCase()) ? String(c).toUpperCase() : null;
}

export function enregistrerCouleur(id, couleur) {
  const m = lireCarteCouleur();
  if (couleur && TEINTES_DOSSIER.includes(String(couleur).toUpperCase())) m[String(id)] = String(couleur).toUpperCase();
  else delete m[String(id)];
  try { localStorage.setItem(CLE_COULEURS, JSON.stringify(m)); } catch { /* ignoré */ }
}
