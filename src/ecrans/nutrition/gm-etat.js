// Cartes et suivis affichés sur l'écran Nutrition (équivalent des « trackers » de GymMane), gardés sur le compte.
import { computed } from '@preact/signals';
import { ecrireNutrition, lireNutrition } from './store.js';

export const SUIVIS_DEFAUT_OFF = ['fiber', 'animal', 'quality', 'fats', 'sugarSodium', 'fasting'];
export const SUIVIS = ['calories', 'protein', 'carbs', 'fat', 'animal', 'quality', 'fats', 'fiber', 'sugarSodium', 'water', 'shake', 'supplements', 'fasting', 'weight', 'week', 'prep', 'plans', 'foods'];

export const suivis = computed(() => { const v = lireNutrition('nutritionSuivis', {}); return v && typeof v === 'object' ? v : {}; });

export const suiviActif = (k) => (k in suivis.value ? !!suivis.value[k] : !SUIVIS_DEFAUT_OFF.includes(k));
export function basculerSuivi(k) {
  ecrireNutrition('nutritionSuivis', { ...suivis.value, [k]: !suiviActif(k) });
}
