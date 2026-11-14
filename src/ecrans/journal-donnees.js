// Journal des notes (lecture seule, partagé avec l'accueil sans charger l'écran des notes).
import { computed } from '@preact/signals';
import { lireModule } from '../donnees.js';

export const normaliser = (v) => ({
  notes: Array.isArray(v?.notes) ? v.notes.filter((n) => n && n.id).map((n) => ({ ...n, media: Array.isArray(n.media) ? n.media : [] })) : [],
  folders: Array.isArray(v?.folders) ? v.folders.filter((f) => f && f.id) : [],
});

export const journal = computed(() => normaliser(lireModule('journal')));
