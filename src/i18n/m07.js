// Textes de l'écran M07 (Entraîner, carte des muscles) portés de GymMane.
// Français vouvoiement, sans tiret long.
import { langue } from '../i18n.js';

const fr = {
  step1: 'ÉTAPE 1 SUR 2',
  step2: 'ÉTAPE 2 SUR 2',
  chooseFocus: 'CHOISISSEZ VOTRE CIBLE',
  buildSession: 'CRÉEZ VOTRE SÉANCE',
  tapMuscles: 'Touchez les muscles que vous voulez travailler, devant et derrière.',
  continueBtn: 'Continuer',
  nothingForFocus: 'Aucun exercice pour cette cible',
  goBackPick: 'Revenez en arrière et choisissez un muscle avec des exercices dans votre bibliothèque.',
  pickedHint: (n) => `Nous avons préparé une séance. Touchez pour ajouter ou retirer l’un des ${n} exercices.`,
  pickAnExercise: 'CHOISIR UN EXERCICE',
  searchAllExercises: 'Rechercher un exercice…',
  reinitialiser: 'Réinitialiser la sélection',
  noExercisesMatch: 'Aucun exercice correspondant',
  createItInstead: 'Créer votre propre exercice à la place',
  startCount: (n) => `COMMENCER · ${n} EXERCICE${n > 1 ? 'S' : ''}`,
  allExercisesShort: 'Tous',
  suggestedPicks: 'Suggérés pour vous',
  moreOptions: 'Plus d’options',
  orStartWith: 'Ou commencez par',
  warmupFocus: 'Échauffement',
  warmupFocusHint: 'Mobilité et activation, avec ou sans matériel',
  cardioFocus: 'Cardio',
  cardioFocusHint: 'Course, vélo, rameur ou corde, en distance et en temps',
};

const en = {
  step1: 'STEP 1 OF 2',
  step2: 'STEP 2 OF 2',
  chooseFocus: 'CHOOSE YOUR FOCUS',
  buildSession: 'BUILD YOUR SESSION',
  tapMuscles: 'Tap the muscles you want to train, front and back.',
  continueBtn: 'Continue',
  nothingForFocus: 'Nothing for this focus yet',
  goBackPick: 'Go back and pick a muscle with exercises in your library.',
  pickedHint: (n) => `We picked a session for you. Tap to add or drop any of the ${n}.`,
  pickAnExercise: 'PICK AN EXERCISE',
  searchAllExercises: 'Search any exercise…',
  reinitialiser: 'Reset the selection',
  noExercisesMatch: 'No exercises match',
  createItInstead: 'Create it as your own instead',
  startCount: (n) => `START · ${n} EXERCISE${n > 1 ? 'S' : ''}`,
  allExercisesShort: 'All',
  suggestedPicks: 'Suggested for you',
  moreOptions: 'More options',
  orStartWith: 'Or start with',
  warmupFocus: 'Warm-up',
  warmupFocusHint: 'Mobility and activation, with or without kit',
  cardioFocus: 'Cardio',
  cardioFocusHint: 'Run, bike, row or skip, by distance and time',
};

export const m07 = (cle) => (langue === 'en' ? en : fr)[cle];
