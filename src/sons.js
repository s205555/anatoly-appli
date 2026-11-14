/**
 * Sons de fin de repos synthétisés (Web Audio API), sans fichier audio externe, et voix de l'appareil (speechSynthesis).
 */
import { langue } from './i18n.js';

let contexte = null;

function audioCtx() {
  if (typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined') return null;
  if (!contexte) contexte = new (AudioContext || webkitAudioContext)();
  return contexte;
}

/** Réveille le contexte audio après un geste utilisateur si nécessaire. */
export async function preparerContexteAudio() {
  const ctx = audioCtx();
  if (ctx && ctx.state === 'suspended') await ctx.resume().catch(() => {});
  return ctx;
}

/** Joue un tampon muet : c'est ce qui débloque réellement le son sur iOS Safari. */
function amorcer(ctx) {
  try {
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, 22050);
    src.connect(ctx.destination);
    src.start(0);
  } catch { /* contexte indisponible */ }
}

let deverrouille = false;
/** Débloque le contexte audio au premier toucher ou clic : iOS Safari et Chrome Android refusent le son sans geste. */
export function installerDeverrouillageAudio() {
  if (deverrouille || typeof document === 'undefined') return;
  const evts = ['pointerdown', 'touchend', 'click', 'keydown'];
  const lever = () => {
    const ctx = audioCtx();
    if (!ctx) return;
    amorcer(ctx);
    void ctx.resume().then(() => {
      if (ctx.state !== 'running') return;
      deverrouille = true;
      evts.forEach((e) => document.removeEventListener(e, lever, true));
    }, () => {});
  };
  evts.forEach((e) => document.addEventListener(e, lever, true));
}
installerDeverrouillageAudio();

function bipSimple(ctx, t0, freq, dureeMs, gain = 0.12) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dureeMs / 1000);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dureeMs / 1000 + 0.02);
}

function accordDoux(ctx, t0) {
  [523.25, 659.25, 783.99].forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t0 + i * 0.05);
    g.gain.linearRampToValueAtTime(0.06, t0 + i * 0.05 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.9);
    o.connect(g).connect(ctx.destination);
    o.start(t0 + i * 0.05);
    o.stop(t0 + 1.1);
  });
}

function clocheSalle(ctx, t0) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(800, t0);
  o.frequency.exponentialRampToValueAtTime(400, t0 + 0.35);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.18, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.2);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + 1.3);
}

// Son d'alarme importé par la personne (alarm_store.dart) : gardé sur le compte, décodé une fois dans le contexte audio
// déjà débloqué, pour sonner à la fin du repos même sans geste. Tant qu'il n'est pas prêt, le bip le remplace.
let sonPerso = { id: null, tampon: null };
export const DUREE_MAX_SON = 15;

/** Décode un fichier audio ; rejette si ce n'est pas un son lisible. */
export async function decoderSon(octets) {
  const ctx = audioCtx();
  if (!ctx) throw new Error('audio');
  return ctx.decodeAudioData(octets.slice(0));
}

/** Prépare le son personnel du compte (id du média), ou l'oublie avec null. */
export function definirSonPerso(id, octets) {
  const valide = typeof id === 'string' && /^[0-9a-f]{32}$/.test(id) ? id : null;
  if (valide === sonPerso.id && (sonPerso.tampon || !octets)) return;
  sonPerso = { id: valide, tampon: null };
  if (!valide) return;
  const source = octets ? Promise.resolve(octets) : fetch(`/api/media/${valide}`, { credentials: 'same-origin' }).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('media'))));
  source.then(decoderSon).then((t) => { if (sonPerso.id === valide) sonPerso.tampon = t; }).catch(() => {});
}

function jouerTampon(ctx, tampon) {
  const src = ctx.createBufferSource();
  src.buffer = tampon;
  src.connect(ctx.destination);
  src.start(0);
}

/**
 * Joue le son de fin de repos choisi.
 * @param {'bip'|'carillon'|'cloche'|'double-bip'|'muet'|'perso'} type
 */
export function jouerSonRepos(type) {
  if (type === 'muet') return;
  const ctx = audioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  const t0 = ctx.currentTime;
  if (type === 'perso' && sonPerso.tampon) jouerTampon(ctx, sonPerso.tampon);
  else if (type === 'bip') bipSimple(ctx, t0, 880, 120);
  else if (type === 'carillon') accordDoux(ctx, t0);
  else if (type === 'cloche') clocheSalle(ctx, t0);
  else if (type === 'double-bip') {
    bipSimple(ctx, t0, 920, 80, 0.14);
    bipSimple(ctx, t0 + 0.14, 1100, 100, 0.12);
  } else bipSimple(ctx, t0, 880, 120);
}

/** Aperçu court pour les réglages (même logique que la fin de repos). */
export function apercuSonRepos(type) {
  // Appelé depuis un tap : on amorce et on joue tout de suite, sans attendre une promesse (sinon iOS perd le geste).
  const ctx = audioCtx();
  if (ctx) amorcer(ctx);
  jouerSonRepos(type);
}

export const TYPES_SON_REPOS = ['bip', 'carillon', 'cloche', 'double-bip', 'muet'];

// Petit carillon des notifications (Beeper.chime de l'original : do 6 puis sol 6, 85 ms plus tard), au plus un toutes les 700 ms.
let dernierCarillon = 0;
export function carillon() {
  const ctx = audioCtx();
  if (!ctx || ctx.state !== 'running' || Date.now() - dernierCarillon < 700) return;
  dernierCarillon = Date.now();
  const t0 = ctx.currentTime;
  bipSimple(ctx, t0, 1046.5, 900, 0.05);
  bipSimple(ctx, t0 + 0.085, 1568, 800, 0.04);
}

// ===== Voix de l'appareil (API SpeechSynthesis du navigateur) =====
export function voixDisponible() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function dire(texte, { voix = null, taux = 1, volume = 1 } = {}) {
  if (!voixDisponible() || !texte) return null;
  const u = new SpeechSynthesisUtterance(texte);
  u.lang = langue === 'en' ? 'en-GB' : 'fr-FR';
  if (voix) u.voice = voix;
  u.rate = Math.max(0.5, Math.min(2, Number(taux) || 1));
  u.volume = Math.max(0, Math.min(1, Number(volume) || 1));
  window.speechSynthesis.speak(u);
  return u;
}

export function arreterVoix() {
  if (voixDisponible()) window.speechSynthesis.cancel();
}
