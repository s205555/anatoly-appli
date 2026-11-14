// Textes du lot L24 : saisie d'une valeur (askRuler et askNumber de l'original), minuteur des séries en temps (hold), machine assistée.
import { typo } from '../../../app/src/textes.mjs';
import { langue } from '../i18n.js';

const fr = {
  valider: 'Valider', annuler: 'Annuler', clavier: (x) => `Saisir au clavier : ${x}`,
  reps: 'Répétitions', repsG: 'Répétitions à gauche', repsD: 'Répétitions à droite', poids: (u) => `Poids (${u})`,
  tempsS: 'Temps (secondes)', tempsMin: 'Temps (minutes)', distance: (u) => `Distance (${u})`,
  aucun: 'Aucun', rpeAide: '10 : plus aucune répétition possible. 8 : environ deux répétitions en réserve.',
  rirAide: '0 : vous ne pouviez plus en faire une. 2 : il en restait deux.',
  reposApres: 'Repos après cette série', sansMinuteur: 'Sans minuteur', reposExercice: 'Repos pour cet exercice',
  poidsCible: 'Poids visé', repsVisees: 'Répétitions visées',
  ajouterPoids: (u) => `Ajouter un poids (${u})`, poidsGoupille: (u) => `Poids à la goupille (${u})`, ajouter: 'Ajouter',
  toucherPile: 'Touchez un poids pour corriger une valeur bizarre ou le retirer.',
  demarrer: (x) => `Démarrer · ${x}`, arreter: 'Arrêter', finirMaintenant: 'Finir la série maintenant',
  preparez: 'Préparez-vous', changez: 'Changez de côté', cote: (n) => `Côté ${n} sur 2`, tenir: 'Tenir', cardio: 'Cardio',
  pause: 'Mettre en pause', reprendre: 'Reprendre',
  moinsAssistance: 'Moins d’assistance',
};

const en = {
  valider: 'Set', annuler: 'Cancel', clavier: (x) => `Type it: ${x}`,
  reps: 'Reps', repsG: 'Left reps', repsD: 'Right reps', poids: (u) => `Weight (${u})`,
  tempsS: 'Time (seconds)', tempsMin: 'Time (minutes)', distance: (u) => `Distance (${u})`,
  aucun: 'None', rpeAide: '10 is nothing left in the tank, 8 is two reps to spare.',
  rirAide: '0 is nothing left in the tank, 2 is two reps to spare.',
  reposApres: 'Rest after this set', sansMinuteur: 'No timer', reposExercice: 'Rest for this exercise',
  poidsCible: 'Target weight', repsVisees: 'Target reps',
  ajouterPoids: (u) => `Add a weight (${u})`, poidsGoupille: (u) => `Weight on the pin (${u})`, ajouter: 'Add',
  toucherPile: 'Tap a weight to fix an odd one or remove it.',
  demarrer: (x) => `Start · ${x}`, arreter: 'Stop', finirMaintenant: 'Finish set now',
  preparez: 'Get ready', changez: 'Switch sides', cote: (n) => `Side ${n} of 2`, tenir: 'Hold', cardio: 'Cardio',
  pause: 'Pause', reprendre: 'Resume',
  moinsAssistance: 'Least assistance',
};

const traduire = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? typo(v) : typeof v === 'function' ? (...a) => typo(v(...a)) : v]));
const FR = traduire(fr);
export const m24 = () => (langue === 'en' ? en : FR);
