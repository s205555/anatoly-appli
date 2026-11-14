// Repas avec une IA : demande à copier et lecteur de réponse (portage de GymMane lib/services/meal_ai.dart, GPLv3).
// Lecture tolérante : JSON abîmé, coupé, clés en plusieurs langues, quantités écrites en toutes lettres.
export const TAG_IA = 'anatoly-meal';
export const VERSION_IA = 1;
const MAX_OPTIONS = 6;
const MAX_ITEMS = 40;

export const plierTexte = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/ı/g, 'i').replace(/ł/g, 'l').replace(/ø/g, 'o');

class ErreurFormat extends Error {}

/** Lecteur JSON indulgent (_Lenient) : commentaires, guillemets simples, clés nues, texte coupé. */
class Indulgent {
  constructor(s, i) { this.s = s; this.i = i; this.coupe = false; this.prof = 0; }
  sauter() {
    const s = this.s;
    while (this.i < s.length) {
      const c = s.charCodeAt(this.i);
      if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d || c === 0xfeff || c === 0xa0) { this.i += 1; continue; }
      if (c === 0x2f && this.i + 1 < s.length) {
        const n = s[this.i + 1];
        if (n === '/') { while (this.i < s.length && s[this.i] !== '\n') this.i += 1; continue; }
        if (n === '*') { const e = s.indexOf('*/', this.i + 2); this.i = e < 0 ? s.length : e + 2; continue; }
      }
      break;
    }
  }
  valeur() {
    this.sauter();
    if (this.i >= this.s.length) { this.coupe = true; return null; }
    if (++this.prof > 40) throw new ErreurFormat('profond');
    try {
      const c = this.s[this.i];
      if (c === '{') return this.objet();
      if (c === '[') return this.tableau();
      if (c === '"' || c === "'") return this.chaine(c);
      return this.nu();
    } finally { this.prof -= 1; }
  }
  objet() {
    this.i += 1;
    const m = {};
    for (;;) {
      this.sauter();
      if (this.i >= this.s.length) { this.coupe = true; return m; }
      const c = this.s[this.i];
      if (c === '}') { this.i += 1; return m; }
      if (c === ',') { this.i += 1; continue; }
      if (c === ']') throw new ErreurFormat('mismatch');
      let cle;
      if (c === '"' || c === "'") cle = this.chaine(c);
      else {
        const d = this.i;
        while (this.i < this.s.length && /[A-Za-z0-9_\-.$]/.test(this.s[this.i])) this.i += 1;
        cle = this.s.slice(d, this.i);
        if (!cle) throw new ErreurFormat('cle');
      }
      this.sauter();
      if (this.i >= this.s.length) { this.coupe = true; m[cle] = null; return m; }
      if (this.s[this.i] !== ':') throw new ErreurFormat('deux-points');
      this.i += 1;
      m[cle] = this.valeur();
      if (this.coupe) return m;
    }
  }
  tableau() {
    this.i += 1;
    const a = [];
    for (;;) {
      this.sauter();
      if (this.i >= this.s.length) { this.coupe = true; return a; }
      const c = this.s[this.i];
      if (c === ']') { this.i += 1; return a; }
      if (c === ',') { this.i += 1; continue; }
      if (c === '}') throw new ErreurFormat('mismatch');
      a.push(this.valeur());
      if (this.coupe) return a;
    }
  }
  chaine(q) {
    const s = this.s;
    this.i += 1;
    let b = '';
    while (this.i < s.length) {
      const c = s[this.i];
      if (c === '\\' && this.i + 1 < s.length) {
        const n = s[this.i + 1];
        this.i += 2;
        if (n === 'n' || n === 'r') b += ' ';
        else if (n === 't') b += ' ';
        else if (n === 'u') {
          const hex = this.i + 4 <= s.length ? parseInt(s.slice(this.i, this.i + 4), 16) : NaN;
          if (!Number.isNaN(hex)) { b += String.fromCharCode(hex); this.i += 4; }
        } else b += n;
        continue;
      }
      if (c === q) {
        if (q === "'") {
          let j = this.i + 1;
          while (j < s.length && ' \n\t\r'.includes(s[j])) j += 1;
          if (j < s.length && ',}]:'.includes(s[j])) { this.i += 1; return b; }
          b += c; this.i += 1; continue;
        }
        this.i += 1;
        return b;
      }
      b += c;
      this.i += 1;
    }
    this.coupe = true;
    return b;
  }
  nu() {
    const d = this.i;
    while (this.i < this.s.length && !',}]\n\r'.includes(this.s[this.i])) this.i += 1;
    let t = this.s.slice(d, this.i);
    const barre = t.indexOf('//');
    if (barre >= 0) t = t.slice(0, barre);
    t = t.trim();
    if (!t) return null;
    const l = t.toLowerCase();
    if (l === 'true') return true;
    if (l === 'false') return false;
    if (['null', 'none', 'nan', 'undefined'].includes(l)) return null;
    if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) return Number(t);
    return t;
  }
}

const nettoyer = (brut) => String(brut).replace(/[​‌‍⁠﻿]/g, '').replace(/ /g, ' ')
  .replace(/[“”„‟«»]/g, '"').replace(/[‘’‚‛]/g, "'");
const k = (s) => plierTexte(s).replace(/[^a-z0-9]/g, '');
const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const norm = (m) => Object.fromEntries(Object.entries(m).map(([a, b]) => [k(a), b]));
const premier = (nm, cles) => { for (const c of cles) { const v = nm[c]; if (v != null) return v; } return null; };

const CLES_NOM = ['food', 'name', 'n', 'item', 'ingredient', 'alimento', 'nombre', 'ingrediente', 'product', 'producto', 'title', 'aliment', 'nom', 'produit'];
const CLES_G = ['grams', 'gram', 'g', 'gr', 'gramos', 'amountg', 'weightg', 'weight', 'quantityg', 'servinggrams', 'portiong', 'peso', 'grammes', 'poids'];
const CLES_ML = ['ml', 'amountml', 'volumeml', 'millilitres', 'milliliters', 'mililitros'];
const CLES_QTE = ['amount', 'quantity', 'cantidad', 'qty', 'portion', 'porcion', 'serving', 'size', 'quantite'];
const CLES_UNITE = ['unit', 'units', 'unidad', 'unite'];
const CLES_NB = ['count', 'pieces', 'piezas', 'unidades', 'servings', 'numberofunits'];
const CLES_KCAL = ['kcal', 'calories', 'calorias', 'cal', 'energy', 'energykcal', 'kilocalories', 'kcals', 'cals'];
const CLES_P = ['protein', 'proteins', 'proteina', 'proteinas', 'prot', 'p', 'proteing', 'proteines'];
const CLES_C = ['carbs', 'carbohydrates', 'carbohydrate', 'carbohidratos', 'hidratos', 'carb', 'c', 'carbsg', 'hidratosdecarbono', 'glucides'];
const CLES_L = ['fat', 'fats', 'grasa', 'grasas', 'lipids', 'lipidos', 'f', 'fatg', 'lipides'];
const CLES_FIB = ['fiber', 'fibre', 'fibra', 'fiberg', 'fibres'];
const CLES_NICHEES = ['macros', 'nutrition', 'nutrients', 'nutrientes', 'nutritionalvalues', 'valoresnutricionales', 'totals', 'total', 'values'];
const CLES_100 = ['per100', 'per100g', 'per100grams', 'porcada100g', 'per100ml'];
const CLES_REPAS = ['meal', 'comida', 'slot', 'mealtype', 'momento', 'repas'];
const CLES_NOM_OPTION = ['name', 'title', 'label', 'nombre', 'option', 'menu', 'plan', 'dish', 'recipe', 'receta', 'idea'];
const CLES_ITEMS = ['items', 'foods', 'ingredients', 'alimentos', 'ingredientes', 'entries', 'food', 'list', 'contents'];
const CLES_OPTIONS = ['options', 'opciones', 'menus', 'plans', 'planes', 'ideas', 'suggestions', 'recipes', 'recetas', 'dishes', 'platos', 'results', 'variants'];
const CLES_JOURS = ['meals', 'comidas', 'day', 'dia', 'plan', 'menu', 'schedule'];

function nombreDe(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.abs(v) : null;
  if (typeof v !== 'string') return null;
  const m = /(\d+(?:[.,]\d+)*)/.exec(v);
  if (!m) return null;
  let t = m[1];
  if (/^\d{1,3}(,\d{3})+$/.test(t)) t = t.replace(/,/g, '');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t) && v.includes('.') && !v.includes(',')) t = t.replace(/\./g, '');
  else {
    t = t.replace(/,/g, '.');
    if ((t.match(/\./g) || []).length > 1) t = t.replace('.', '');
  }
  const d = Number(t);
  return Number.isFinite(d) ? d : null;
}

const UNITES_G = {
  kg: [1000, false], kilogram: [1000, false], kilograms: [1000, false], kilo: [1000, false], kilos: [1000, false],
  g: [1, false], gr: [1, false], grs: [1, false], gram: [1, false], grams: [1, false], gramo: [1, false], gramos: [1, false], gramme: [1, false], grammes: [1, false],
  mg: [0.001, false], ml: [1, true], cl: [10, true], dl: [100, true], l: [1000, true], lt: [1000, true],
  liter: [1000, true], litre: [1000, true], litro: [1000, true], litros: [1000, true], litres: [1000, true],
  oz: [28.35, false], ounce: [28.35, false], ounces: [28.35, false], lb: [453.6, false], lbs: [453.6, false], pound: [453.6, false], pounds: [453.6, false],
  cup: [240, true], cups: [240, true], taza: [240, true], tazas: [240, true], tasse: [240, true], tasses: [240, true],
  tbsp: [15, true], tablespoon: [15, true], tablespoons: [15, true], cucharada: [15, true], cucharadas: [15, true], cuillereasoupe: [15, true],
  tsp: [5, true], teaspoon: [5, true], teaspoons: [5, true], cucharadita: [5, true], cucharaditas: [5, true], cuillereacafe: [5, true],
};

function quantiteDe(v, indice) {
  if (v == null) return {};
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v <= 0) return {};
    const u = UNITES_G[k(indice)];
    if (u) return { grammes: v * u[0], liquide: u[1] };
    if (!k(indice) || k(indice) === 'g') return { grammes: v };
    return { nombre: v };
  }
  if (typeof v !== 'string') return {};
  const texte = plierTexte(v.replace(/,/g, '.'));
  const metrique = /(\d+(?:\.\d+)?)\s*(kg|mg|gr|grs|grams?|gramos?|grammes?|g|ml|cl|dl|litros?|liters?|litres?|lt|l|oz|ounces?|lbs?|pounds?)\b/.exec(texte);
  if (metrique) {
    const n = Number(metrique[1]) || 0;
    const u = UNITES_G[metrique[2]];
    if (u && n > 0) return { grammes: n * u[0], liquide: u[1] };
  }
  const libre = /(\d+)\s+(\d+)\s*\/\s*(\d+)|(\d+)\s*\/\s*(\d+)|(\d+(?:\.\d+)?)\s*([a-z]*)/.exec(texte);
  if (!libre) return {};
  let n; let unite = '';
  const apres = () => texte.slice(libre.index + libre[0].length).trim().split(/\W+/)[0] ?? '';
  if (libre[1] != null) { n = Number(libre[1]) + Number(libre[2]) / Number(libre[3]); unite = apres(); }
  else if (libre[4] != null) { n = Number(libre[4]) / Number(libre[5]); unite = apres(); }
  else { n = Number(libre[6]); unite = libre[7] ?? ''; }
  if (!Number.isFinite(n) || n <= 0) return {};
  const u = UNITES_G[unite || k(indice)];
  if (u) return { grammes: n * u[0], liquide: u[1] };
  if (!unite && !k(indice)) return { grammes: n };
  return { nombre: n };
}

function estItem(v) {
  if (!estObjet(v)) return false;
  const nm = norm(v);
  const nom = premier(nm, CLES_NOM);
  if (typeof nom !== 'string' || !nom.trim()) return false;
  return premier(nm, [...CLES_G, ...CLES_ML, ...CLES_QTE, ...CLES_NB]) != null || premier(nm, [...CLES_KCAL, ...CLES_P, ...CLES_C, ...CLES_L, ...CLES_NICHEES, ...CLES_100]) != null;
}

function sourceMacros(nm, par100) {
  const out = {};
  for (const c of par100 ? CLES_100 : CLES_NICHEES) if (estObjet(nm[c])) Object.assign(out, norm(nm[c]));
  return out;
}

function aliment(brut, repasDefaut) {
  if (!estObjet(brut)) return null;
  const nm = norm(brut);
  const nomBrut = premier(nm, CLES_NOM);
  if (typeof nomBrut !== 'string') return null;
  const nom = nomBrut.replace(/\s+/g, ' ').trim();
  if (!nom) return null;
  const par = sourceMacros(nm, true);
  const par100 = Object.keys(par).length > 0;
  const src = par100 ? { ...nm, ...par } : { ...nm, ...sourceMacros(nm, false) };
  const macro = (cles) => nombreDe(premier(src, cles));
  const indice = premier(nm, CLES_UNITE);
  const unite = typeof indice === 'string' ? indice : '';
  let grammes = null, liquide = false, nombre = null;
  const g = premier(nm, CLES_G), ml = premier(nm, CLES_ML), a = premier(nm, CLES_QTE);
  if (g != null) { const r = quantiteDe(g, typeof g === 'number' ? 'g' : unite); grammes = r.grammes ?? null; liquide = !!r.liquide; nombre = r.nombre ?? null; }
  if (grammes == null && ml != null) { const r = quantiteDe(ml, 'ml'); grammes = r.grammes ?? null; liquide = true; }
  if (grammes == null && a != null) { const r = quantiteDe(a, unite); grammes = r.grammes ?? null; liquide = !!r.liquide; nombre ??= r.nombre ?? null; }
  nombre ??= nombreDe(premier(nm, CLES_NB));
  if (grammes != null && !(grammes > 0 && Number.isFinite(grammes))) grammes = null;
  const repas = premier(nm, CLES_REPAS);
  return {
    nom, grammes, liquide, nombre, kcal: macro(CLES_KCAL), p: macro(CLES_P), c: macro(CLES_C), l: macro(CLES_L), fibres: macro(CLES_FIB),
    par100, repas: typeof repas === 'string' && repas.trim() ? repas.trim() : repasDefaut,
  };
}
const aDesMacros = (f) => f.kcal != null || f.p != null || f.c != null || f.l != null;

function aliments(liste, repasDefaut) {
  const out = [];
  if (Array.isArray(liste)) for (const e of liste) { const f = aliment(e, repasDefaut); if (f) out.push(f); }
  else if (estObjet(liste)) {
    for (const [cle, v] of Object.entries(liste)) {
      if (estObjet(v)) { const f = aliment({ name: cle, ...v }, repasDefaut); if (f) out.push(f); }
      else if (typeof v === 'number' || typeof v === 'string') { const f = aliment({ name: cle, amount: v }, repasDefaut); if (f) out.push(f); }
    }
  }
  return out.slice(0, MAX_ITEMS);
}

const nomOption = (nm) => { const v = premier(nm, CLES_NOM_OPTION); return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''; };
function ressembleItems(v) {
  if (Array.isArray(v)) return v.some(estItem);
  if (estObjet(v)) return Object.values(v).some((e) => estObjet(e) && estItem({ name: 'x', ...e })) || Object.values(v).some((e) => typeof e === 'number' && e > 0);
  return false;
}
function parRepas(m, nom) {
  const items = [];
  for (const [cle, v] of Object.entries(m)) {
    if (Array.isArray(v) && ressembleItems(v)) items.push(...aliments(v, cle.trim()));
    else if (estObjet(v)) {
      const dedans = premier(norm(v), CLES_ITEMS);
      if (dedans != null && ressembleItems(dedans)) items.push(...aliments(dedans, cle.trim()));
    }
  }
  return items.length ? [{ nom, repas: '', items: items.slice(0, MAX_ITEMS * 2) }] : [];
}
function chercher(noeud, prof) {
  if (prof > 6) return [];
  if (Array.isArray(noeud)) {
    if (noeud.some(estItem)) return [{ nom: '', repas: '', items: aliments(noeud, '') }];
    const out = [];
    for (const e of noeud) if (e !== null && typeof e === 'object') out.push(...chercher(e, prof + 1));
    return out;
  }
  if (!estObjet(noeud)) return [];
  const nm = norm(noeud);
  const nom = nomOption(nm);
  const repas = premier(nm, CLES_REPAS);
  const repasDefaut = typeof repas === 'string' ? repas.trim() : '';
  const dedans = premier(nm, CLES_ITEMS);
  if (dedans != null && ressembleItems(dedans)) return [{ nom, repas: repasDefaut, items: aliments(dedans, repasDefaut) }];
  for (const c of CLES_OPTIONS) {
    const v = nm[c];
    if (v !== null && typeof v === 'object') {
      const trouve = estObjet(v) && ressembleItems(v) ? [{ nom, repas: repasDefaut, items: aliments(v, repasDefaut) }] : chercher(v, prof + 1);
      if (trouve.length) return trouve;
    }
  }
  for (const c of CLES_JOURS) {
    const v = nm[c];
    if (estObjet(v)) { const jour = parRepas(v, nom); if (jour.length) return jour; }
    else if (Array.isArray(v)) { const trouve = chercher(v, prof + 1); if (trouve.length) return trouve; }
  }
  const direct = parRepas(noeud, nom);
  if (direct.length) return direct;
  if (estItem(noeud)) return [{ nom: '', repas: '', items: aliments([noeud], '') }];
  for (const v of Object.values(nm)) if (v !== null && typeof v === 'object') { const trouve = chercher(v, prof + 1); if (trouve.length) return trouve; }
  return [];
}

function candidats(texte, ouvrant) {
  const out = [];
  let i = 0;
  while (i < texte.length) {
    const a = texte.indexOf(ouvrant, i);
    if (a < 0) break;
    const p = new Indulgent(texte, a);
    try {
      const v = p.valeur();
      const vrai = Array.isArray(v) ? v.length > 0 : estObjet(v) && Object.keys(v).length > 0;
      if (vrai) out.push([v, p.coupe]);
      i = Math.max(p.i, a + 1);
    } catch (e) {
      if (!(e instanceof ErreurFormat)) throw e;
      i = a + 1;
    }
  }
  return out;
}

const nbItems = (r) => r.options.reduce((n, o) => n + o.items.length, 0);

/** Lit la réponse collée : { options: [{ nom, repas, items }], coupe }. */
export function lireReponseIA(brut) {
  const texte = nettoyer(brut);
  let meilleur = { options: [], coupe: false };
  const libres = [];
  let libresCoupe = false;
  for (const [v, coupe] of [...candidats(texte, '{'), ...candidats(texte, '[')]) {
    if (estItem(v)) {
      const f = aliment(v, '');
      if (f) { libres.push(f); libresCoupe = libresCoupe || coupe; }
      continue;
    }
    const options = chercher(v, 0).filter((o) => o.items.length).slice(0, MAX_OPTIONS);
    if (!options.length) continue;
    const r = { options, coupe };
    if (nbItems(r) > nbItems(meilleur)) meilleur = r;
  }
  if (libres.length > nbItems(meilleur)) meilleur = { options: [{ nom: '', repas: '', items: libres.slice(0, MAX_ITEMS) }], coupe: libresCoupe };
  return meilleur;
}

// ===== Rapprochement avec la bibliothèque d'aliments =====
const MOTS_CUITS = new Set(['cooked', 'boiled', 'grilled', 'roasted', 'baked', 'steamed', 'fried', 'cocido', 'cocida', 'cocidos', 'cocidas', 'hervido',
  'hervida', 'hervidos', 'asado', 'asada', 'plancha', 'horneado', 'horneada', 'cuit', 'cuite', 'cuits', 'cuites', 'grille', 'grillee', 'roti', 'rotie',
  'vapeur', 'poele', 'poelee', 'gekocht', 'cotto', 'cotta', 'cozido', 'cozida']);
const MOTS_BRUIT = new Set(['fresh', 'plain', 'natural', 'raw', 'organic', 'large', 'medium', 'small', 'sliced', 'chopped', 'diced', 'homemade',
  'boneless', 'skinless', 'ripe', 'whole', 'the', 'a', 'an', 'of', 'de', 'la', 'el', 'con', 'with', 'and', 'y', 'du', 'des', 'le', 'les', 'et',
  'au', 'aux', 'frais', 'fraiche', 'nature', 'cru', 'crue', 'maison', ...MOTS_CUITS]);
const mots = (s) => s.split(/[^a-z0-9Ѐ-ӿ؀-ۿ぀-ヿ一-鿿가-힯]+/).filter(Boolean);
const singulier = (w) => {
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && w.endsWith('es') && !w.endsWith('ses')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
};
function variantes(brut) {
  let s = plierTexte(brut).replace(/[([].*?[)\]]/g, ' ').replace(/^\s*\d+([.,]\d+)?\s*(x|g|ml)?\s+/, '');
  const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return [];
  const tout = mots(parts.join(' ')), tete = mots(parts[0]);
  const vus = new Set(); const out = [];
  const ajouter = (l) => { const v = l.join(' '); if (v && !vus.has(v)) { vus.add(v); out.push(v); } };
  const toutPropre = tout.filter((w) => !MOTS_BRUIT.has(w)), tetePropre = tete.filter((w) => !MOTS_BRUIT.has(w));
  ajouter(tout); ajouter(tete); ajouter(toutPropre); ajouter(tetePropre);
  for (const base of [tout, tete, toutPropre, tetePropre]) ajouter(base.map(singulier));
  return out;
}
const estCuit = (nom) => mots(plierTexte(nom)).some((w) => MOTS_CUITS.has(w));
function ressemblance(requete, candidat) {
  const cand = mots(plierTexte(candidat));
  if (!cand.length || !requete.length) return 0;
  if (cand.join(' ') === requete.join(' ')) return 1;
  for (const q of requete) if (!cand.some((c) => c === q || (q.length >= 4 && c.startsWith(q)) || singulier(c) === singulier(q))) return 0;
  return requete.length / cand.length;
}
/** Bibliothèque : [{ id, noms: [nom de la langue, nom anglais], g100: {k,p,c,l,fibres}, portion, liquide, rendement }]. */
function rechercher(bibliotheque, v, limite = 10) {
  const q = plierTexte(v.trim());
  const ws = q.split(/\s+/);
  const debut = new RegExp(`(^|\\s)${ws[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  const notes = [];
  for (const f of bibliotheque) {
    const nom = plierTexte(f.noms[0]);
    const foin = `${nom} ${plierTexte(f.noms[1] ?? '')}`;
    if (!ws.every((w) => foin.includes(w))) continue;
    const s = nom === q ? 0 : nom.startsWith(q) ? 1 : debut.test(nom) ? 2 : nom.includes(ws[0]) ? 3 : 4;
    notes.push([s * 1000 + nom.length, f]);
  }
  return notes.sort((a, b) => a[0] - b[0]).slice(0, limite).map((x) => x[1]);
}
function rapprocher(nom, bibliotheque, perso) {
  const vs = variantes(nom);
  let meilleur = null;
  for (const v of vs) {
    const q = mots(v);
    for (const f of perso) {
      const s = ressemblance(q, f.noms[0]);
      if (s >= 0.6 && (!meilleur || s > meilleur.score)) meilleur = { f, score: s + 0.05 };
    }
  }
  if (meilleur && meilleur.score >= 0.95) return meilleur;
  for (const v of vs) {
    const q = mots(v);
    for (const f of rechercher(bibliotheque, v)) {
      const s = Math.max(ressemblance(q, f.noms[0]), ressemblance(q, f.noms[1] ?? ''));
      if (s >= 0.34 && (!meilleur || s > meilleur.score)) meilleur = { f, score: s };
    }
    if (meilleur && meilleur.score >= 0.95) break;
  }
  return meilleur;
}

/** Repas visé (_mealFor) : ids breakfast, lunch, dinner, snacks. */
export function repasPour(brut, repasListe, repli) {
  const c = k(brut);
  if (!c) return repli;
  for (const r of repasListe) if (k(r.id) === c || (r.nom && k(r.nom) === c)) return r.id;
  const prendre = (id) => (repasListe.some((r) => r.id === id) ? id : repli);
  if (/break|desay|morning|manana|fruhstuck|petitdej|colazione|cafe|matin/.test(c)) return prendre('breakfast');
  if (/lunch|almuerzo|comida|mittag|dejeuner|pranzo|midday|midi/.test(c)) return prendre('lunch');
  if (/dinner|cena|supper|abend|diner|souper|soir/.test(c)) return prendre('dinner');
  if (/snack|merienda|tentempie|colacion|aperitivo|brunch|postre|dessert|collation|gouter|pre|post/.test(c)) return prendre('snacks');
  return repli;
}

function macrosIA(f, grammes, drapeaux) {
  let { kcal, p, c, l, fibres } = f;
  if (f.par100) {
    const x = (grammes ?? 100) / 100;
    kcal = kcal == null ? null : kcal * x; p = p == null ? null : p * x; c = c == null ? null : c * x;
    l = l == null ? null : l * x; fibres = fibres == null ? null : fibres * x;
  }
  const donnes = [p, c, l].filter((e) => e != null).length;
  const deduit = (p ?? 0) * 4 + (c ?? 0) * 4 + (l ?? 0) * 9;
  if (kcal == null && donnes >= 2) kcal = deduit;
  else if (kcal != null && donnes === 3 && Math.abs(kcal - deduit) > Math.max(35, deduit * 0.25)) { kcal = deduit; drapeaux.add('ajuste'); }
  if ((kcal == null && donnes === 1) || kcal == null || (kcal <= 0 && donnes === 0)) { drapeaux.add('sansValeurs'); return { k: 0, p: 0, c: 0, l: 0, fibres: 0 }; }
  p ??= 0; c ??= 0; l ??= 0;
  const poids = grammes ?? 0;
  if (poids > 0) {
    if (p + c + l > poids * 1.08 + 2 || kcal > poids * 9.5 + 5 || kcal > 4000) drapeaux.add('douteux');
    if (poids > 3000) drapeaux.add('douteux');
  } else if (kcal > 2500) drapeaux.add('douteux');
  return { k: kcal, p, c, l, fibres: fibres ?? 0 };
}

/**
 * Brouillon d'un aliment lu (_draft) : { nom, grammes, liquide, macros {k,p,c,l,fibres}, alimentId, source, drapeaux, actif, repas }.
 * source : 'bibliotheque' | 'perso' | 'ia'. Les valeurs de la bibliothèque priment quand elles s'accordent avec celles de l'IA.
 */
function brouillon(f, repas, bibliotheque, perso) {
  const drapeaux = new Set();
  let grammes = f.grammes;
  const trouve = rapprocher(f.nom, bibliotheque, perso);
  if (trouve) {
    const it = trouve.f;
    if (grammes == null && f.nombre != null && it.portion > 0) grammes = f.nombre * it.portion;
    if (grammes != null && grammes > 0) {
      const cuit = it.rendement > 0 && estCuit(f.nom);
      const brut = cuit ? grammes / it.rendement : grammes;
      const x = brut / 100;
      const m = { k: it.g100.k * x, p: it.g100.p * x, c: it.g100.c * x, l: it.g100.l * x, fibres: (it.g100.fibres ?? 0) * x };
      let accord = true;
      const ia = aDesMacros(f) ? macrosIA(f, grammes, new Set()) : { k: 0 };
      if (ia.k > 0 && m.k > 0) {
        const r = ia.k / m.k;
        accord = !((r < 0.55 || r > 1.8) && Math.abs(ia.k - m.k) > 40);
      }
      if (accord) return { nom: it.noms[0], grammes, liquide: !!it.liquide, macros: m, alimentId: it.id, source: it.perso ? 'perso' : 'bibliotheque', drapeaux, actif: true, repas };
    }
  }
  const macros = aDesMacros(f) ? macrosIA(f, grammes, drapeaux) : { k: 0, p: 0, c: 0, l: 0, fibres: 0 };
  if (!aDesMacros(f)) drapeaux.add('sansValeurs');
  if (grammes == null && !drapeaux.has('sansValeurs')) drapeaux.add('sansQuantite');
  const court = f.nom.replace(/\s+/g, ' ').trim().slice(0, 60);
  const off = drapeaux.has('douteux') || drapeaux.has('sansValeurs');
  return { nom: court ? court[0].toUpperCase() + court.slice(1) : court, grammes: grammes ?? 0, liquide: f.liquide, macros, alimentId: '', source: 'ia', drapeaux, actif: !off, repas };
}

/** Options prêtes à relire (resolveMealAi). */
export function resoudreIA(reponse, { repas, repasListe, journee = false, bibliotheque = [], perso = [] }) {
  const out = [];
  for (const o of reponse.options) {
    const items = o.items.map((f) => brouillon(f, journee ? repasPour(f.repas || o.repas, repasListe, repas) : repas, bibliotheque, perso));
    if (items.length) out.push({ nom: o.nom, items });
  }
  return out;
}
export const utilisable = (d) => !d.drapeaux.has('sansValeurs');
export const choisis = (o) => o.items.filter((d) => d.actif && utilisable(d));
export const totalOption = (o) => choisis(o).reduce((s, d) => ({ k: s.k + d.macros.k, p: s.p + d.macros.p, c: s.c + d.macros.c, l: s.l + d.macros.l }), { k: 0, p: 0, c: 0, l: 0 });
/** Change la quantité d'un brouillon : les valeurs suivent (scaleTo). */
export function mettreA(d, grammes) {
  if (!(d.grammes > 0) || !(grammes > 0)) return d;
  const x = grammes / d.grammes;
  return { ...d, grammes, macros: Object.fromEntries(Object.entries(d.macros).map(([a, v]) => [a, v * x])) };
}

/** Cibles de la demande (mealAiTargets) : objectifs du jour, ce qui reste, part d'un repas. */
export function ciblesIA({ objectifs, mange, repasVides, repasVise, nbRepas, journee }) {
  const reste = { k: Math.max(0, objectifs.kcal - mange.kcal), p: Math.max(0, objectifs.p - mange.p), c: Math.max(0, objectifs.c - mange.c), l: Math.max(0, objectifs.l - mange.l) };
  if (journee) return { kcal: objectifs.kcal, p: objectifs.p, c: objectifs.c, l: objectifs.l, resteKcal: Math.round(reste.k), resteP: Math.round(reste.p) };
  const diviseur = Math.max(1, repasVise ? repasVides : repasVides + 1);
  const creneaux = Math.max(1, nbRepas);
  const part = (r, but) => (r > 0 ? r / diviseur : but / creneaux);
  const net = (v, lo, hi, pas) => Math.min(hi, Math.max(lo, Math.round(v / pas) * pas));
  return {
    kcal: net(part(reste.k, objectifs.kcal), 80, 1500, 10), p: net(part(reste.p, objectifs.p), 5, 150, 1),
    c: net(part(reste.c, objectifs.c), 5, 300, 1), l: net(part(reste.l, objectifs.l), 3, 150, 1),
    resteKcal: Math.round(reste.k), resteP: Math.round(reste.p),
  };
}

export const PHRASE_RELANCE = 'Send your last answer again as ONLY the JSON object, inside one ```json code block, using exactly the format from my first message. No text before it and none after it.';

/** Texte de la demande (buildMealAiPrompt), en anglais comme l'original : les IA le suivent mieux, les noms reviennent dans la langue voulue. */
export function demandeIA(b) {
  const ids = b.repasListe.map((r) => r.id);
  const liste = b.repasListe.map((r) => `"${r.id}" (${r.nom})`).join(', ');
  const premierRepas = b.journee ? (ids.includes('breakfast') ? 'breakfast' : ids[0]) : b.repasId;
  const second = b.journee ? (ids.includes('lunch') ? 'lunch' : ids.at(-1)) : b.repasId;
  const quoi = b.journee ? `a full day of eating, spread over these meals: ${liste}` : `ONE meal only: ${b.repasNom} (id "${b.repasId}")`;
  const lignes = [
    'You are the nutrition assistant of Anatoly, a fitness app. A program, not a person, will read your reply, so the format below is strict.',
    '',
    'REQUEST',
    `- I want ${quoi}.`,
    `- Target for ${b.journee ? 'the whole day' : 'this meal'}: about ${b.kcal} kcal, ${b.p} g protein, ${b.c} g carbs and ${b.l} g fat. Stay within 10% of the calories. Protein matters most.`,
    `- Give ${b.options} different option${b.options === 1 ? '' : 's'}${b.options === 1 ? '' : ', each one a complete alternative that could replace the others'}.`,
    `- Write food names and option names in ${b.langue}.`,
    ...(b.styles.length ? [`- Style: ${b.styles.join(', ')}.`] : []),
    ...(b.notes.trim() ? [`- My notes (obey them, they may list foods I have at home, dislikes and allergies): ${b.notes.trim().replace(/\s+/g, ' ')}`] : []),
    ...(b.mange.length ? [`- Already eaten today (do not repeat them, vary the foods): ${b.mange.join(', ')}.`] : []),
    '',
    'FORMAT RULES (follow every one)',
    '1. Reply with exactly one JSON object inside one ```json code block. Nothing before it, nothing after it: no greeting, no explanation, no notes, no markdown outside the block.',
    `2. Use exactly the keys shown in the example. Keep "anatoly" as "${TAG_IA}" and "v" as ${VERSION_IA}.`,
    '3. One entry in "items" per food or ingredient. Split mixed dishes into their ingredients (for example "Rice, cooked" and "Chicken breast, grilled").',
    '4. "grams" is the weight in grams of that item (for liquids, the volume in millilitres). Always a plain number, never a range.',
    '5. "kcal", "protein", "carbs" and "fat" are the TOTAL for the amount in "grams", not per 100 g. Plain numbers only: dot as decimal separator, no units, no quotes. Protein, carbs and fat are in grams. kcal must be close to 4 x protein + 4 x carbs + 9 x fat.',
    '6. Use simple, common, generic food names (for example "Greek yogurt", "Rolled oats", "Banana", "Olive oil"). No brands, no adjectives, no cooking instructions inside the name. Add "cooked" or "grilled" to the name only when the weight is the cooked weight.',
    '7. Use realistic amounts that a person can weigh at home. Do not put the same food twice in one option.',
    `8. "meal" is one of these ids: ${ids.map((e) => `"${e}"`).join(', ')}.${b.journee ? ' Spread the foods across the meals.' : ` Use "${b.repasId}" for every item.`}`,
    '9. Do not use web search, tools or code. Do not ask me questions. If something is unclear, choose a sensible default.',
    '10. Before you reply, check that the JSON is valid and that every item has "food", "grams", "kcal", "protein", "carbs", "fat" and "meal".',
    '',
    'EXAMPLE OF A VALID REPLY (the foods and numbers are only an illustration)',
    '```json',
    '{',
    `  "anatoly": "${TAG_IA}",`,
    `  "v": ${VERSION_IA},`,
    '  "options": [',
    '    {',
    '      "name": "Yogurt with walnuts",',
    '      "items": [',
    `        {"food": "Greek yogurt", "grams": 170, "kcal": 100, "protein": 17, "carbs": 6.1, "fat": 0.7, "meal": "${premierRepas}"},`,
    `        {"food": "Walnuts", "grams": 15, "kcal": 98, "protein": 2.3, "carbs": 2.1, "fat": 9.8, "meal": "${second}"}`,
    '      ]',
    '    }',
    '  ]',
    '}',
    '```',
    '',
    `If you cannot follow these rules, reply with {"anatoly": "${TAG_IA}", "v": ${VERSION_IA}, "options": []}.`,
  ];
  return lignes.join('\n');
}
