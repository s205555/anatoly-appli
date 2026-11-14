// Textes des écrans exercices (M05). Séparé de i18n.js pour ne pas toucher aux fichiers partagés.
import { typo } from '../../../app/src/textes.mjs';
import { langue } from '../i18n.js';

const fr = {
  form: {
    nouveau: 'Nouvel exercice', modifier: 'Modifier l’exercice', aide: 'Seul le nom est obligatoire. Le reste aide, mais vous pouvez l’ajouter plus tard.',
    nom: 'Nom de l’exercice', ajouter: 'Ajouter l’exercice', enregistrer: 'Enregistrer', avance: 'Avancé',
    etapes: 'Comment faire (facultatif)', etapesAide: 'Une étape par ligne', autres: 'Autres noms (facultatif)', autresAide: 'Autres noms, séparés par des virgules',
    supprimerTitre: 'Supprimer cet exercice ?', supprimerTexte: (n) => `« ${n} » sera retiré de votre bibliothèque et de vos programmes. Vos séries passées sont conservées.`,
    supprimer: 'Supprimer', ok: 'Exercice enregistré',
  },
  notes: { titre: 'Notes', aucune: 'Aucune note sur cet exercice pour l’instant.', n: (n) => (n === 1 ? '1 note' : `${n} notes`) },
  biblio: {
    parZone: 'Par zone', zones: 'Choisir une zone', filtres: 'Filtres', filtresN: (n) => `Filtres · ${n}`,
    favorisN: (n) => `Favoris · ${n}`, effacer: 'Effacer les filtres', appliquer: (n) => `${n} exercice${n > 1 ? 's' : ''} dans votre bibliothèque`,
    type: 'Type', niveau: 'Niveau', seulement: 'Afficher', aucunFavori: 'Aucun favori',
    aucunFavoriTexte: 'Touchez l’étoile d’un exercice pour le garder ici.',
    aucun: 'Aucun exercice trouvé', aucunTexte: 'Essayez une autre recherche ou effacez les filtres.',
    enregistrerPar: 'Enregistrer par', avance: 'Avancé', nomVide: 'Donnez un nom à l’exercice.',
    types: { force: 'Force', callisthenie: 'Callisthénie', cardio: 'Cardio', etirement: 'Étirements', sport: 'Sport' },
    materiels: { sans: 'Sans matériel', anneaux: 'Anneaux', leste: 'Lesté' },
    reinitialiser: 'Réinitialiser', lieu: 'LIEU', partout: 'Partout', nouveauLieu: 'Nouveau lieu',
  },
  detail: {
    record: 'Record personnel', meilleureSerie: 'Meilleure série', meilleureSeance: 'Meilleure séance',
    unRM: (x) => `1RM estimé : ${x}`,
    echelle: 'Meilleure charge par répétitions', repsN: (n) => `${n} rép.`,
    prochaine: 'La prochaine fois', toutVoir: 'Tout voir', aucunHisto: 'Aucune séance enregistrée.',
    aucunHistoTexte: 'Faites cet exercice en séance pour créer un historique.',
    aucuneEtape: 'Pas encore d’étapes.',
    etapes: 'Comment faire', fermer: 'Fermer', dePlus: (n) => `+${n} de plus`,
    plages: { '30': '30 j', '90': '90 j', '365': '1 an', all: 'Tout' },
    serie: (n) => `${n} série${n > 1 ? 's' : ''}`, sur: (d) => `depuis le ${d}`,
    ajouterRoutine: 'Ajouter à un programme', retirerFavori: 'Retirer des favoris', ajouterFavori: 'Ajouter aux favoris',
    raisons: {
      poids: (kg, r, unite) => `Vous avez fait ${kg} ${unite} × ${r} la dernière fois : +1 répétition.`,
      charge: (r, unite) => `${r} répétitions la dernière fois : la charge monte.`,
      reps: (r) => `${r} répétitions la dernière fois : visez une de plus.`,
      duree: (s) => `${s} la dernière fois : tenez un peu plus longtemps.`,
      corps: (r) => `${r} répétitions la dernière fois : visez une de plus.`,
      lest: () => 'Vous êtes au plafond de répétitions : ajoutez du lest.',
    },
  },
};

const en = {
  form: {
    nouveau: 'New exercise', modifier: 'Edit exercise', aide: 'Only the name is required. The rest helps, but you can add it later.',
    nom: 'Exercise name', ajouter: 'Add exercise', enregistrer: 'Save', avance: 'Advanced',
    etapes: 'How to (optional)', etapesAide: 'One step per line', autres: 'Other names (optional)', autresAide: 'Other names, separated by commas',
    supprimerTitre: 'Delete this exercise?', supprimerTexte: (n) => `"${n}" will be removed from your library and your routines. Your past sets are kept.`,
    supprimer: 'Delete', ok: 'Exercise saved',
  },
  notes: { titre: 'Notes', aucune: 'No notes on this exercise yet.', n: (n) => (n === 1 ? '1 note' : `${n} notes`) },
  biblio: {
    parZone: 'By area', zones: 'Choose an area', filtres: 'Filters', filtresN: (n) => `Filters · ${n}`,
    favorisN: (n) => `Favourites · ${n}`, effacer: 'Clear filters', appliquer: (n) => `${n} exercise${n === 1 ? '' : 's'} in your library`,
    type: 'Type', niveau: 'Level', seulement: 'Show', aucunFavori: 'No favourites yet',
    aucunFavoriTexte: 'Tap the star on an exercise to keep it here.',
    aucun: 'No exercises found', aucunTexte: 'Try a different search or clear your filters.',
    enregistrerPar: 'Log by', avance: 'Advanced', nomVide: 'Give the exercise a name.',
    types: { force: 'Strength', callisthenie: 'Calisthenics', cardio: 'Cardio', etirement: 'Stretching', sport: 'Sport' },
    materiels: { sans: 'No kit', anneaux: 'Rings', leste: 'Weighted' },
    reinitialiser: 'Reset', lieu: 'PLACE', partout: 'Anywhere', nouveauLieu: 'New place',
  },
  detail: {
    record: 'Personal record', meilleureSerie: 'Best set', meilleureSeance: 'Best workout',
    unRM: (x) => `1RM est. ${x}`,
    echelle: 'Best weight by reps', repsN: (n) => (n === 1 ? '1 rep' : `${n} reps`),
    prochaine: 'Next time', toutVoir: 'See all', aucunHisto: 'No sessions logged yet.',
    aucunHistoTexte: 'Train this exercise to build history.',
    aucuneEtape: 'No steps yet.',
    etapes: 'How to', fermer: 'Close', dePlus: (n) => `+${n} more`,
    plages: { '30': '30 D', '90': '90 D', '365': '1 Y', all: 'All' },
    serie: (n) => `${n} set${n > 1 ? 's' : ''}`, sur: (d) => `since ${d}`,
    ajouterRoutine: 'Add to a routine', retirerFavori: 'Remove from favourites', ajouterFavori: 'Add to favourites',
    raisons: {
      poids: (kg, r, unite) => `You did ${kg} ${unite} × ${r} last time: one more rep.`,
      charge: (r, unite) => `${r} reps last time: the weight goes up.`,
      reps: (r) => `${r} reps last time: aim for one more.`,
      duree: (s) => `${s} last time: hold a little longer.`,
      corps: (r) => `${r} reps last time: aim for one more.`,
      lest: () => 'You are at the rep ceiling: add weight.',
    },
  },
};

const traduire = (o) => {
  if (typeof o === 'string') return typo(o);
  if (typeof o === 'function') return (...a) => traduire(o(...a));
  if (Array.isArray(o)) return o.map(traduire);
  if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, traduire(v)]));
  return o;
};

const LANGUES = { fr: traduire(fr), en };
export const m05 = () => LANGUES[langue === 'en' ? 'en' : 'fr'];
