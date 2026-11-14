// Textes de « Repas avec l'IA » (GymMane 52074f9 et 60ee4c0). Vouvoiement, jamais de tiret long.
import { langue } from '../i18n.js';

const fr = {
  ligne: 'Demander à une IA', ligneAide: 'Copiez une demande, collez la réponse',
  titre: 'Repas avec l’IA', sous: 'Marche avec n’importe quelle IA. L’appli ne lui envoie rien.',
  etapeDemander: 'Demander', etapeColler: 'Coller', journee: 'Journée entière', cible: 'Cible',
  calories: 'Calories', proteines: 'Protéines', glucides: 'Glucides', lipides: 'Lipides',
  reste: (kcal, p) => `Il vous reste ${kcal} et ${p} g de protéines aujourd’hui`,
  gouts: 'Vos goûts',
  styles: { protein: 'Riche en protéines', veggie: 'Végétarien', vegan: 'Végan', nogluten: 'Sans gluten', nolactose: 'Sans lactose', quick: 'Rapide', nocook: 'Sans cuisson', cheap: 'Petit budget' },
  notes: 'J’ai chez moi, je n’aime pas, mes allergies', options: 'Options',
  copier: 'Copier la demande', copiee: 'Demande copiée', copieeAide: 'Collez-la dans votre IA, puis revenez ici avec la réponse',
  voir: 'Voir la demande', masquer: 'Masquer la demande',
  coller: 'Collez ici la réponse de l’IA', collerBouton: 'Coller', fichier: 'Choisir un fichier', lire: 'Lire la réponse',
  illisible: 'Aucun aliment trouvé dans ce texte', illisibleAide: 'Demandez à l’IA de renvoyer seulement le JSON, dans un seul bloc de code, au format de la demande.',
  copierPhrase: 'Copier cette phrase', copie: 'Copié',
  option: (n) => `Option ${n}`, ajouterJour: 'Ajouter à aujourd’hui', ajouter: 'Ajouter',
  ajoutes: (n) => (n === 1 ? '1 aliment ajouté' : `${n} aliments ajoutés`),
  recette: 'Enregistrer comme recette', plan: 'Enregistrer comme plan', recetteFaite: 'Recette enregistrée', planFait: 'Plan enregistré',
  nomRecette: 'Nom de la recette', nomPlan: 'Nom du plan', enregistrer: 'Enregistrer', annuler: 'Annuler',
  drapeaux: { estime: 'Estimé par l’IA', ajuste: 'Calories corrigées pour suivre les macros', douteux: 'Les chiffres ne collent pas, vérifiez', sansValeurs: 'Aucune valeur nutritionnelle', sansQuantite: 'Aucune quantité donnée' },
  coupee: 'La réponse semble coupée. Les aliments complets sont gardés.',
  quantite: 'Quantité', cibleLigne: (k) => `Cible ${k}`, rienChoisi: 'Activez au moins un aliment', langueIA: 'French',
};

const en = {
  ligne: 'Ask an AI', ligneAide: 'Copy a request, paste the answer',
  titre: 'Meals with AI', sous: 'Works with any chatbot. The app sends it nothing.',
  etapeDemander: 'Ask', etapeColler: 'Paste', journee: 'Whole day', cible: 'Target',
  calories: 'Calories', proteines: 'Protein', glucides: 'Carbs', lipides: 'Fat',
  reste: (kcal, p) => `You have ${kcal} and ${p} g of protein left today`,
  gouts: 'Your taste',
  styles: { protein: 'High protein', veggie: 'Vegetarian', vegan: 'Vegan', nogluten: 'Gluten free', nolactose: 'Lactose free', quick: 'Quick', nocook: 'No cooking', cheap: 'Budget' },
  notes: 'I have at home, I don’t like, allergies', options: 'Options',
  copier: 'Copy request', copiee: 'Request copied', copieeAide: 'Paste it into your AI and come back here with the answer',
  voir: 'See the request', masquer: 'Hide the request',
  coller: 'Paste the AI’s answer here', collerBouton: 'Paste', fichier: 'Choose a file', lire: 'Review answer',
  illisible: 'I couldn’t find any food in that text', illisibleAide: 'Ask the AI to send only the JSON, in one code block, with the format of the request.',
  copierPhrase: 'Copy that sentence', copie: 'Copied',
  option: (n) => `Option ${n}`, ajouterJour: 'Add to today', ajouter: 'Add',
  ajoutes: (n) => (n === 1 ? '1 food added' : `${n} foods added`),
  recette: 'Save as a recipe', plan: 'Save as a plan', recetteFaite: 'Recipe saved', planFait: 'Plan saved',
  nomRecette: 'Recipe name', nomPlan: 'Plan name', enregistrer: 'Save', annuler: 'Cancel',
  drapeaux: { estime: 'Estimated by the AI', ajuste: 'Calories fixed to match the macros', douteux: 'Doesn’t add up, check it', sansValeurs: 'No nutrition values', sansQuantite: 'No amount given' },
  coupee: 'The answer looks cut off. I kept the complete foods.',
  quantite: 'Amount', cibleLigne: (k) => `Target ${k}`, rienChoisi: 'Turn on at least one food', langueIA: 'English',
};

export const TIA = () => (langue === 'en' ? en : fr);
/** Styles envoyés à l'IA, toujours en anglais comme dans GymMane. */
export const STYLES_IA = [['protein', 'high protein'], ['veggie', 'vegetarian'], ['vegan', 'vegan'], ['nogluten', 'gluten free'], ['nolactose', 'lactose free'], ['quick', 'quick to make, under 10 minutes'], ['nocook', 'no cooking needed'], ['cheap', 'cheap everyday ingredients']];
