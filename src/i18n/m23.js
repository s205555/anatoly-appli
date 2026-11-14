// Textes du groupe « Réglages de cet exercice » de la fiche (exercise_detail_screen.dart) et de la pile de poids (weight_stack_sheet.dart), lot L23.
import { typo } from '../../../app/src/textes.mjs';
import { langue } from '../i18n.js';

const fr = {
  titre: 'Réglages de cet exercice',
  aideMode: 'Le cardio comme la course ou la natation enregistre distance et temps. Les gainages comme la planche enregistrent le temps.',
  repsSeules: 'Répétitions uniquement', dureeSeule: 'Durée uniquement', repsSeulesAide: 'Enregistre cet exercice sans poids.',
  cotes: 'Chaque côté', cotesTempsAide: 'Le temps se saisit pour un côté, le repos commence après les deux.',
  cotesAide: 'Saisissez les répétitions à gauche et à droite séparément. La progression suit le côté le plus faible.',
  tenue: 'Progression au temps', tenueAide: 'Ajoute des secondes quand vous tenez toutes les séries',
  tenueOn: (s) => `+${s} s chaque fois que vous tenez toutes les séries`,
  repos: 'Repos pour cet exercice', reposPropre: 'Uniquement pour celui-ci', reposDefaut: 'Utilise la durée par défaut', desactive: 'Désactivé',
  barre: 'Poids de la barre ou du chariot', barrePropre: 'Personnalisé · touchez pour réinitialiser', barreAide: 'Utilisé par le calculateur de disques',
  pile: 'Pile de poids', pileOff: 'Désactivée : paliers normaux', pileN: (n) => `${n} poids`,
  pileAide: 'Les poids réels de cette machine. + et −, la progression et les décharges ne tombent que dessus.',
  de: 'De', a: 'À', tous: 'Tous les', remplir: 'Remplir la pile', toucher: 'Touchez un poids pour le retirer.', retirerPile: 'Retirer la pile', termine: 'Terminé',
  suggerer: 'Suggérer dans les séances rapides', suggererAide: 'Désactivé, il n’apparaît plus dans les suggestions. Vous pouvez toujours l’ajouter à la main.',
  assiste: 'Machine assistée', assisteAide: 'Le poids vous aide, donc moins c’est mieux : records et suggestions vont vers le bas.',
  progression: 'Progression',
  echauffement: 'Commencer par des séries d’échauffement', echauffementAide: 'Ajoute les séries de montée en charge à l’ouverture de la séance.',
  moins: 'Diminuer', plus: 'Augmenter', retirer: (p) => `Retirer ${p}`,
};

const en = {
  titre: 'Settings for this exercise',
  aideMode: 'Cardio like running or swimming logs distance and time. Holds like a plank log time.',
  repsSeules: 'Reps only', dureeSeule: 'Time only', repsSeulesAide: 'Log this exercise without weight.',
  cotes: 'Each side', cotesTempsAide: 'The time is logged for one side and the rest starts after both.',
  cotesAide: 'Log the left and right reps separately. Progression follows the weaker side.',
  tenue: 'Progress by time', tenueAide: 'Adds seconds when you hold every set',
  tenueOn: (s) => `+${s} s each time you hold every set`,
  repos: 'Rest for this exercise', reposPropre: 'Only for this one', reposDefaut: 'Using your default', desactive: 'Off',
  barre: 'Bar or sled weight', barrePropre: 'Your own · tap to reset', barreAide: 'Used by the plate calculator',
  pile: 'Weight stack', pileOff: 'Off: normal weight steps', pileN: (n) => `${n} weights`,
  pileAide: 'The weights this machine really has. The + and − buttons, progression and deloads land only on them.',
  de: 'From', a: 'To', tous: 'Every', remplir: 'Fill the stack', toucher: 'Tap a weight to remove it.', retirerPile: 'Remove the stack', termine: 'Done',
  suggerer: 'Suggest in quick workouts', suggererAide: 'Off keeps it out of the picks made for you. You can still add it by hand.',
  assiste: 'Assisted machine', assisteAide: 'The weight helps you, so less is better: your records and suggestions go down.',
  progression: 'Progression',
  echauffement: 'Start with warm-up sets', echauffementAide: 'Adds the ramp-up sets when the workout opens.',
  moins: 'Decrease', plus: 'Increase', retirer: (p) => `Remove ${p}`,
};

const traduire = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? typo(v) : typeof v === 'function' ? (...a) => typo(v(...a)) : v]));
const FR = traduire(fr);
export const m23 = () => (langue === 'en' ? en : FR);
