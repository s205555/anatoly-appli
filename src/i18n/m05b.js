// Textes ajoutés par la reprise 1:1 de la bibliothèque et de la fiche exercice (lot v6 L07). Clés GymMane entre crochets.
import { typo } from '../../../app/src/textes.mjs';
import { langue } from '../i18n.js';

const fr = {
  // [exerciseTypeLabel], [typeReps], [typeTime], [typeCardio]
  enregistrerPar: 'Enregistrer par', modes: { '': 'Répétitions et poids', time: 'Temps', cardio: 'Distance et temps' },
  muscle: 'Muscle', materiel: 'Matériel', secondairesForm: 'Secondaire',
  // [mgChest] … [mgCore]
  familles: { pectoraux: 'Pectoraux', dos: 'Dos', epaules: 'Épaules', bras: 'Bras', tronc: 'Ceinture abdominale', jambes: 'Jambes' },
  nomManquant: 'Donnez un nom à l’exercice.',
  // Fiche
  principal: 'Principal', secondaire: 'Secondaire', equipement: 'Matériel', aucun: 'Aucun',
  archiver: 'Archiver l’exercice', restaurer: 'Restaurer', archive: 'Exercice archivé', archiveAide: 'Retrouvez-le dans Exercices › Archivés',
  archiveBandeau: 'Archivé. Il n’apparaît plus dans les listes ni les suggestions ; votre historique est conservé.',
  archives: 'Archivés', archivesN: (n) => `Archivés · ${n}`, annuler: 'Annuler',
  ajouterMedia: 'Ajouter un média', changerMedia: 'Modifier', illustrationDefaut: 'Revenir à l’illustration par défaut', mediaRefuse: 'Image JPEG ou PNG de 5 Mo au plus.',
  secondairesAide: 'Touchez les autres muscles que travaille cet exercice.', retablir: 'Rétablir par défaut', termine: 'Terminé',
  ajouterProgramme: 'Ajouter au programme', nouveauProgramme: 'Nouveau programme', dejaDedans: 'Déjà dedans',
  dansProgrammes: (n) => (n === 0 ? 'Dans aucun programme pour l’instant' : n === 1 ? 'Dans 1 programme' : `Dans ${n} programmes`),
  fixerObjectif: 'Fixer un objectif', objectif: 'Objectif', objectifAtteint: 'Objectif atteint', encore: (v) => `Encore ${v}`,
  repsVisees: 'Répétitions visées', poidsCible: 'Poids cible', echeance: 'Échéance', sansEcheance: 'Sans échéance',
  enregistrer: 'Enregistrer', supprimerObjectif: 'Supprimer l’objectif', dateDepassee: 'Date dépassée',
  joursRestants: (n) => (n === 1 ? '1 jour restant' : `${n} jours restants`), moins: 'Moins', plus: 'Plus', retirerEcheance: 'Retirer l’échéance',
  prochaine: 'Prochaine fois', reps: (n) => `${n} rép.`,
};

const en = {
  enregistrerPar: 'Log by', modes: { '': 'Reps & weight', time: 'Time', cardio: 'Distance & time' },
  muscle: 'Muscle', materiel: 'Equipment', secondairesForm: 'Secondary',
  familles: { pectoraux: 'Chest', dos: 'Back', epaules: 'Shoulders', bras: 'Arms', tronc: 'Core', jambes: 'Legs' },
  nomManquant: 'Give the exercise a name.',
  principal: 'Primary', secondaire: 'Secondary', equipement: 'Equipment', aucun: 'None',
  archiver: 'Archive exercise', restaurer: 'Restore', archive: 'Exercise archived', archiveAide: 'Find it under Exercises › Archived',
  archiveBandeau: 'Archived. It stays out of lists and suggestions; your history is kept.',
  archives: 'Archived', archivesN: (n) => `Archived · ${n}`, annuler: 'Undo',
  ajouterMedia: 'Add media', changerMedia: 'Change', illustrationDefaut: 'Back to the default art', mediaRefuse: 'JPEG or PNG image, 5 MB at most.',
  secondairesAide: 'Tap the other muscles this exercise works.', retablir: 'Reset to default', termine: 'Done',
  ajouterProgramme: 'Add to routine', nouveauProgramme: 'New routine', dejaDedans: 'Already in it',
  dansProgrammes: (n) => (n === 0 ? 'Not in any routine yet' : n === 1 ? 'In 1 routine' : `In ${n} routines`),
  fixerObjectif: 'Set a goal', objectif: 'Goal', objectifAtteint: 'Goal reached', encore: (v) => `${v} to go`,
  repsVisees: 'Target reps', poidsCible: 'Target weight', echeance: 'Deadline', sansEcheance: 'No deadline',
  enregistrer: 'Save', supprimerObjectif: 'Remove goal', dateDepassee: 'Past the date',
  joursRestants: (n) => (n === 1 ? '1 day left' : `${n} days left`), moins: 'Less', plus: 'More', retirerEcheance: 'Remove the deadline',
  prochaine: 'Next', reps: (n) => `${n} reps`,
};

const traduire = (o) => {
  if (typeof o === 'string') return typo(o);
  if (typeof o === 'function') return (...a) => traduire(o(...a));
  if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, traduire(v)]));
  return o;
};

const LANGUES = { fr: traduire(fr), en };
export const m05b = () => LANGUES[langue === 'en' ? 'en' : 'fr'];
