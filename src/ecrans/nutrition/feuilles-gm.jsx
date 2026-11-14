/* Nutrition : feuilles reprises de GymMane (portage GPLv3) : ajout rapide, options du repas, eau, objectifs, nouvel aliment, shake, plat. */
import { dp } from '../../i18n.js';
import { useRef, useState } from 'preact/hooks';
import { Feuille, Ic } from '../../ui.jsx';
import { afficher, dateLongue, nombre, unite, versAffichage, versKg } from '../../donnees.js';
import { G } from '../../i18n/gm.js';
import { L26 } from '../../i18n/l26.js';
import { EditeurDetourage } from './detourage-editeur.jsx';
import {
  nutritionStore, getAliment, getRepasJour, setRepasJour, jourLocal, getObjectifs, sauverObjectifs, calculerObjectifsSuggeres,
  basculerObjectifsRepos, energie, uniteEnergie, eauMl, eauObjectifMl, verreMl, ajouterEau, retirerPrise, prisesEau, reglerVerre,
  shakes, getShake, choisirShake, marquerShake, ajoutRapide, joursAvecRepas, copierRepas, deplacerRepas, creerAlimentPerso,
  CATEGORIES_ORDRE, CAT_LABEL, MACRO_COULEUR,
} from './aliments.jsx';
import { Photo, IMG } from './gm.jsx';
import { suiviActif } from './gm-etat.js';
import { sauverRecette, nouvelId } from './etat.js';
import { PaletteAliments } from './plans.jsx';
import { importerImage, urlMedia } from '../photos.jsx';

export const REPAS = ['petit-dejeuner', 'dejeuner', 'diner', 'collations'];
const ICONE_REPAS = { 'petit-dejeuner': 'coffee', dejeuner: 'fork-knife', diner: 'bowl-food', collations: 'cookie' };
const lire = (v) => Number(String(v ?? '').trim().replace(',', '.')) || 0;
const borne = (x, min, max) => Math.min(max, Math.max(min, Math.round(x)));
/** Quantité d'eau lisible (waterLabel) : « 250 ml », « 2,75 L ». */
export const libelleEau = (ml) => (ml >= 1000 ? `${nombre(ml / 1000, 2)} L` : `${Math.round(ml)} ml`);
const kcalDepuis = (v) => (nutritionStore.value.objectifs.kj ? v / 4.184 : v);

/* ===== Petites pièces (ui_kit de GymMane) ===== */
/** Ligne d'un groupe (ToolRow) : libellé à gauche, contrôle à droite, séparateurs en retrait. */
export const Ligne = ({ label, children }) => <div class="gm-ligne"><span>{label}</span>{children}</div>;
export const Kicker = ({ children, classe = '' }) => <p class={`gm-kicker ${classe}`}>{children}</p>;

/** Compteur − valeur + (StepperControl) ; toucher la valeur permet de la saisir. */
export function Pas({ valeur, brut, moins, plus, saisir, label }) {
  const [edition, setEdition] = useState(false);
  const valider = (e) => { setEdition(false); const n = lire(e.target.value); if (n > 0) saisir(n); };
  return <div class="gm-pas">
    <button type="button" aria-label={`${label} −`} onClick={moins}>−</button>
    {edition
      ? <input autoFocus inputMode="decimal" aria-label={label} defaultValue={brut} onBlur={valider} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} />
      : <button type="button" class="gm-pas-val" aria-label={`${label}${dp()}${valeur}`} onClick={() => setEdition(true)}>{valeur}</button>}
    <button type="button" aria-label={`${label} +`} onClick={plus}>+</button>
  </div>;
}

/** Interrupteur compact (TinySwitch). */
export const Bouton = ({ actif, onChange, label }) => <button type="button" role="switch" aria-checked={actif} aria-label={label} class={`inter ${actif ? 'on' : ''}`} onClick={() => onChange(!actif)}><span /></button>;

/** Bascule à pastille (SegToggle). options : [[libellé, actif, action]]. */
export const Bascule = ({ options, petit = false, label }) => <div class={`gm-seg ${petit ? 'petit' : ''}`} role="radiogroup" aria-label={label}>
  {options.map(([l, on, fn]) => <button key={l} type="button" role="radio" aria-checked={on} class={on ? 'on' : ''} onClick={fn}>{l}</button>)}
</div>;

/** Champ chiffré à étiquette colorée (_NumberField). */
export const ChampNombre = ({ label, valeur, onInput, couleur = 'var(--text3)', suffixe = 'g', indice = '0' }) => <label class="gm-champ">
  <small style={`color:${couleur}`}>{label}</small>
  <span><input inputMode="decimal" placeholder={indice} value={valeur} onInput={(e) => onInput(e.target.value.replace(/[^\d.,]/g, ''))} /><i>{suffixe}</i></span>
</label>;

/** Champ texte à étiquette (_TextInput). */
export const ChampTexte = ({ label, valeur, onInput, indice }) => <label class="gm-champ texte">
  {label && <small>{label}</small>}
  <span><input value={valeur} placeholder={indice} aria-label={label || indice} onInput={(e) => onInput(e.target.value)} /></span>
</label>;

/** Calories et macros (_MacroInputs), avec la proposition calculée quand elles ne collent pas. */
function Macros({ v, set }) {
  const g = G();
  const u = uniteEnergie();
  const est = energie(lire(v.p) * 4 + lire(v.c) * 4 + lire(v.l) * 9);
  const tape = lire(v.kcal);
  const ecart = Math.abs(est - tape);
  const faux = est > 0 && (tape <= 0 || (ecart > 40 && ecart / est > 0.25));
  return <>
    <div class="gm-champs2">
      <ChampNombre label={u} valeur={v.kcal} onInput={(x) => set({ ...v, kcal: x })} couleur="var(--text)" suffixe={u} />
      <ChampNombre label={g.proteines} valeur={v.p} onInput={(x) => set({ ...v, p: x })} couleur={MACRO_COULEUR.proteines} />
    </div>
    <div class="gm-champs2">
      <ChampNombre label={g.glucides} valeur={v.c} onInput={(x) => set({ ...v, c: x })} couleur={MACRO_COULEUR.glucides} />
      <ChampNombre label={g.lipides} valeur={v.l} onInput={(x) => set({ ...v, l: x })} couleur={MACRO_COULEUR.lipides} />
    </div>
    {faux && <div class={`gm-calc ${tape > 0 ? 'alerte' : ''}`}>
      <Ic n="calculator:bold" taille={14} /><span>{g.macrosEnviron(`${est} ${u}`)}</span>
      <button type="button" onClick={() => set({ ...v, kcal: String(est) })}>{g.utiliser}</button>
    </div>}
  </>;
}

/** Choix du repas (_MealPicker). */
export function ChoixRepas({ valeur, onChoix }) {
  const g = G();
  return <div class="gm-choix-repas" role="radiogroup">
    {REPAS.map((r) => <button key={r} type="button" role="radio" aria-checked={r === valeur} class={r === valeur ? 'on' : ''} onClick={() => onChoix(r)}>
      <Ic n={ICONE_REPAS[r]} taille={16} /><span>{g.repas[r]}</span>
    </button>)}
  </div>;
}

const ParPortion = ({ par100, set }) => {
  const g = G();
  return <div class="gm-par">
    <Kicker>{par100 ? g.pour100Maj('g') : g.parPortion}</Kicker>
    <Bascule petit options={[[g.parPortionCourt, !par100, () => set(false)], ['100 g', par100, () => set(true)]]} />
  </div>;
};

/* ===== Ajout rapide (showQuickAddSheet) ===== */
export function FeuilleAjoutRapide({ fermer, jour, repas }) {
  const g = G();
  const [nom, setNom] = useState('');
  const [v, setV] = useState({ kcal: '', p: '', c: '', l: '' });
  const [par100, setPar100] = useState(false);
  const [quantite, setQuantite] = useState('');
  const [choix, setChoix] = useState(repas);
  const ajouter = () => {
    let k = 1;
    if (par100) k = lire(quantite) > 0 ? lire(quantite) / 100 : 0;
    const e = ajoutRapide(jour, choix, nom, { kcal: kcalDepuis(lire(v.kcal)) * k, p: lire(v.p) * k, c: lire(v.c) * k, l: lire(v.l) * k });
    if (!e) return;
    afficher(g.ajouteAu(g.repasPhrase[choix]), 'ok');
    fermer();
  };
  return <Feuille ouverte fermer={fermer} titre={g.ajoutRapide} sous={g.ajoutRapideIndice}>
    <div class="gm-pile">
      <ChampTexte valeur={nom} onInput={setNom} indice={g.ajoutRapideNom} />
      <ParPortion par100={par100} set={setPar100} />
      <Macros v={v} set={setV} />
      {par100 && <ChampNombre label={g.quantiteMangee} valeur={quantite} onInput={setQuantite} />}
      <ChoixRepas valeur={choix} onChoix={setChoix} />
      <button type="button" class="btn pri gm-plein" onClick={ajouter}>{g.ajouter}</button>
    </div>
  </Feuille>;
}

/* ===== Options du repas (showMealMenu) ===== */
const kcalEntrees = (liste) => Math.round(liste.reduce((s, e) => s + (e.kcal || 0), 0));
export function FeuilleOptionsRepas({ fermer, jour, repas }) {
  const g = G();
  const [nomRepas, setNomRepas] = useState(null);
  const entrees = getRepasJour(jour)[repas] || [];
  const jours = joursAvecRepas(repas, jour);
  const jourVide = Object.values(getRepasJour(jour)).every((l) => !(l || []).length);
  const joursEntiers = jourVide ? joursAvecRepas(null, jour, 3) : [];
  const aujourdhui = jourLocal();
  const hier = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return jourLocal(d); })();
  const nomJour = (d) => (d === aujourdhui ? g.aujourdhui : d === hier ? g.hier : dateLongue(`${d}T12:00:00`));
  const retirer = (ajouts) => {
    const ids = new Set(ajouts.map((e) => e.id));
    const r = getRepasJour(jour);
    setRepasJour(jour, Object.fromEntries(Object.entries(r).map(([k, l]) => [k, (l || []).filter((e) => !ids.has(e.id))])));
  };
  const copier = (d, tout) => {
    const ajouts = tout ? REPAS.flatMap((k) => copierRepas(d, k, jour)) : copierRepas(d, repas, jour);
    fermer();
    if (ajouts.length) afficher(g.nCopies(ajouts.length), 'ok', { libelle: g.annuler, fn: () => retirer(ajouts) });
  };
  const deplacer = (vers) => {
    const bouges = deplacerRepas(jour, repas, vers);
    fermer();
    if (bouges.length) afficher(g.nDeplaces(bouges.length), 'ok', { libelle: g.annuler, fn: () => deplacerRepas(jour, vers, repas) });
  };
  const enregistrer = () => {
    const nom = (nomRepas || '').trim();
    if (!nom) { afficher(g.nomRequis, 'danger'); return; }
    sauverRecette({ id: nouvelId(), nom, items: entrees.map((e) => (getAliment(e.alimentId) && !getAliment(e.alimentId).perso ? { slug: e.alimentId, grammes: e.g } : { nom: e.nom, grammes: e.g, macros: { k: e.kcal, p: e.p, c: e.c, f: e.l } })) });
    fermer();
    afficher(g.repasEnregistre, 'ok');
  };
  return <Feuille ouverte fermer={fermer} titre={g.repas[repas]}>
    <div class="gm-pile">
      {entrees.length > 0 && <>
        {nomRepas === null
          ? <button type="button" class="btn gm-plein" onClick={() => setNomRepas('')}><Ic n="bookmark-simple:bold" taille={16} />{g.enregistrerRepas}</button>
          : <div class="gm-ligne-saisie"><ChampTexte valeur={nomRepas} onInput={setNomRepas} indice={g.nomRepasIndice} /><button type="button" class="btn pri" onClick={enregistrer}>{g.enregistrer}</button></div>}
        <Kicker classe="m18">{g.deplacerVers}</Kicker>
        <ChoixRepas valeur={repas} onChoix={deplacer} />
      </>}
      <Kicker classe={entrees.length ? 'm18' : ''}>{g.reprendreDe}</Kicker>
      {jours.length === 0
        ? <p class="gm-note">{g.rienAutresJours}</p>
        : <div class="gm-groupe">{jours.map((d) => <button key={d} type="button" class="gm-ligne gm-option" onClick={() => copier(d, false)}>
          <Ic n="copy" taille={17} /><span>{nomJour(d)}</span><small>{kcalEntrees(getRepasJour(d)[repas] || [])} kcal</small>
        </button>)}</div>}
      {joursEntiers.length > 0 && <>
        <Kicker classe="m18">{g.reprendreJour}</Kicker>
        <div class="gm-groupe">{joursEntiers.map((d) => <button key={d} type="button" class="gm-ligne gm-option" onClick={() => copier(d, true)}>
          <Ic n="calendar-dots" taille={17} /><span>{nomJour(d)}</span><small>{kcalEntrees(Object.values(getRepasJour(d)).flat())} kcal</small>
        </button>)}</div>
      </>}
    </div>
  </Feuille>;
}

/* ===== Eau : réglages partagés avec les objectifs (_waterRows) ===== */
function LignesEau() {
  const g = G();
  const o = getObjectifs();
  const eau = (ml) => sauverObjectifs({ eauMl: borne(ml, 500, 8000) });
  const verre = (ml) => reglerVerre(borne(ml, 30, 1500));
  return <div class="gm-groupe">
    <Ligne label={g.eauJour}><Pas label={g.eauJour} valeur={libelleEau(o.eauMl)} brut={o.eauMl} moins={() => eau(o.eauMl - 250)} plus={() => eau(o.eauMl + 250)} saisir={eau} /></Ligne>
    <Ligne label={g.tailleVerre}><Pas label={g.tailleVerre} valeur={libelleEau(verreMl())} brut={verreMl()} moins={() => verre(verreMl() - 50)} plus={() => verre(verreMl() + 50)} saisir={verre} /></Ligne>
  </div>;
}

/* ===== Eau (showWaterSheet) ===== */
export function FeuilleEau({ fermer, jour }) {
  const g = G();
  const [autre, setAutre] = useState(null);
  const prises = prisesEau(jour).map((p, i) => ({ ...p, i })).reverse();
  const heure = (at) => (at ? new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '');
  const valider = () => { const ml = lire(autre); if (ml > 0) ajouterEau(ml, jour); setAutre(null); };
  return <Feuille ouverte fermer={fermer} titre={g.eauTitre} sous={`${libelleEau(eauMl(jour))} / ${libelleEau(eauObjectifMl())}`}>
    <div class="gm-pile">
      <div class="gm-puces-rapides">
        {[...new Set([verreMl(), 500])].map((ml) => <button key={ml} type="button" class="gm-puce-rapide" onClick={() => ajouterEau(ml, jour)}>+ {libelleEau(ml)}</button>)}
        <button type="button" class="gm-puce-rapide" onClick={() => setAutre('')}>{g.autreQuantite}</button>
      </div>
      {autre !== null && <div class="gm-ligne-saisie">
        <ChampNombre label={g.autreQuantite} valeur={autre} onInput={setAutre} suffixe="ml" />
        <button type="button" class="btn pri" onClick={valider}>{g.ajouter}</button>
      </div>}
      <Kicker classe="m18">{jour === jourLocal() ? g.aujourdhui : dateLongue(`${jour}T12:00:00`)}</Kicker>
      {prises.length === 0
        ? <p class="gm-note">{g.aucuneEau}</p>
        : <div class="gm-carte-liste">{prises.map((p) => <div key={p.i} class="gm-prise">
          <Ic n="drop:fill" taille={15} /><b>{libelleEau(p.ml)}</b><span>{heure(p.at)}</span>
          <button type="button" aria-label={g.supprimer} onClick={() => retirerPrise(p.i, jour)}><Ic n="x:bold" taille={14} /></button>
        </div>)}</div>}
      <div class="m16"><LignesEau /></div>
    </div>
  </Feuille>;
}

/* ===== Objectifs du jour (showGoalsSheet) ===== */
export function FeuilleObjectifs({ fermer }) {
  const g = G();
  const o = getObjectifs();
  const st = nutritionStore.value.objectifs;
  const u = uniteEnergie();
  const maj = (patch) => sauverObjectifs({ kcal: o.kcal, p: o.p, c: o.c, l: o.l, eauMl: o.eauMl, ...patch });
  const [poidsEdit, setPoidsEdit] = useState(false);
  const lignesMacros = (m, set) => [
    [g.tr.calories, `${energie(m.kcal)} ${u}`, energie(m.kcal), (d) => set({ kcal: borne(m.kcal + d * 50, 800, 9000) }), (n) => set({ kcal: borne(kcalDepuis(n), 800, 9000) })],
    [g.proteines, `${m.p} g`, m.p, (d) => set({ p: borne(m.p + d * 5, 10, 600) }), (n) => set({ p: borne(n, 10, 600) })],
    [g.glucides, `${m.c} g`, m.c, (d) => set({ c: borne(m.c + d * 10, 10, 1500) }), (n) => set({ c: borne(n, 10, 1500) })],
    [g.lipides, `${m.l} g`, m.l, (d) => set({ l: borne(m.l + d * 5, 10, 500) }), (n) => set({ l: borne(n, 10, 500) })],
  ].map(([label, valeur, brut, pas, saisir]) => <Ligne key={label} label={label}><Pas label={label} valeur={valeur} brut={brut} moins={() => pas(-1)} plus={() => pas(1)} saisir={saisir} /></Ligne>);
  const repos = st.repos;
  const setRepos = (patch) => sauverObjectifs({ repos: { ...repos, ...patch } });
  const poids = st.poidsKg;
  const fibres = o.fibres ?? calculerObjectifsSuggeres().fibres;
  const sucre = st.sucre ?? 50;
  const sodium = st.sodium ?? 2300;
  return <Feuille ouverte fermer={fermer} titre={g.objectifsJour}>
    <div class="gm-pile">
      <div class="gm-centre"><Bascule label={g.objectifsJour} options={[['kcal', !st.kj, () => sauverObjectifs({ kj: false })], ['kJ', !!st.kj, () => sauverObjectifs({ kj: true })]]} /></div>
      {repos && <Kicker classe="m16">{g.joursEntrainement}</Kicker>}
      <div class={`gm-groupe ${repos ? '' : 'm16'}`}>{lignesMacros(o, maj)}</div>
      <div class="gm-groupe m12"><Ligne label={g.objectifsRepos}><Bouton label={g.objectifsRepos} actif={!!repos} onChange={basculerObjectifsRepos} /></Ligne></div>
      {repos && <>
        <Kicker classe="m16">{g.joursRepos}</Kicker>
        <div class="gm-groupe">{lignesMacros({ ...o, ...repos }, setRepos)}</div>
      </>}
      <div class="gm-groupe m12">
        <Ligne label={g.ajouterBrule}><Bouton label={g.ajouterBrule} actif={!!st.ajouterBrule} onChange={(x) => sauverObjectifs({ ajouterBrule: x })} /></Ligne>
        <Ligne label={g.poidsCible}>
          {poidsEdit
            ? <input class="gm-valeur-saisie" autoFocus inputMode="decimal" aria-label={g.poidsCible} defaultValue={poids ? nombre(versAffichage(poids), 1) : ''}
              onBlur={(e) => { setPoidsEdit(false); const n = lire(e.target.value); sauverObjectifs({ poidsKg: n > 0 ? versKg(n) : null }); }} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} />
            : <button type="button" class="gm-valeur" onClick={() => setPoidsEdit(true)}>{poids ? `${nombre(versAffichage(poids), 1)} ${unite()}` : '-'}</button>}
        </Ligne>
      </div>
      <p class="gm-note centre">{g.ajouterBruleIndice}</p>
      <div class="m12"><LignesEau /></div>
      {(suiviActif('fiber') || suiviActif('sugarSodium')) && <div class="gm-groupe m12">
        {suiviActif('fiber') && <Ligne label={g.fibres}><Pas label={g.fibres} valeur={`${fibres} g`} brut={fibres} moins={() => sauverObjectifs({ fibres: borne(fibres - 5, 5, 200) })} plus={() => sauverObjectifs({ fibres: borne(fibres + 5, 5, 200) })} saisir={(n) => sauverObjectifs({ fibres: borne(n, 5, 200) })} /></Ligne>}
        {suiviActif('sugarSodium') && <>
          <Ligne label={g.limiteSucre}><Pas label={g.limiteSucre} valeur={`${sucre} g`} brut={sucre} moins={() => sauverObjectifs({ sucre: borne(sucre - 5, 5, 500) })} plus={() => sauverObjectifs({ sucre: borne(sucre + 5, 5, 500) })} saisir={(n) => sauverObjectifs({ sucre: borne(n, 5, 500) })} /></Ligne>
          <Ligne label={g.limiteSodium}><Pas label={g.limiteSodium} valeur={`${nombre(sodium / 1000, 1)} g`} brut={sodium} moins={() => sauverObjectifs({ sodium: borne(sodium - 100, 200, 20000) })} plus={() => sauverObjectifs({ sodium: borne(sodium + 100, 200, 20000) })} saisir={(n) => sauverObjectifs({ sodium: borne(n, 200, 20000) })} /></Ligne>
        </>}
      </div>}
      <button type="button" class="btn gm-plein m16" onClick={() => { const s = calculerObjectifsSuggeres(); sauverObjectifs({ kcal: s.kcal, p: s.p, c: s.c, l: s.l, eauMl: s.eauMl }); }}><Ic n="sparkle:bold" taille={16} />{g.depuisProfil}</button>
      <p class="gm-note centre">{g.depuisProfilIndice}</p>
    </div>
  </Feuille>;
}

/* ===== Nouvel aliment (showFoodEditor) ===== */
// Aperçu local en data: (la politique de sécurité du site refuse les adresses blob:).
const enDataUrl = (blob) => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(blob); });
// Photo réduite à 512 px en JPEG : accepte aussi les formats que le service média refuse (HEIC, WebP) quand le navigateur sait les lire.
async function photoJpeg(fichier) {
  const img = await createImageBitmap(fichier);
  const k = Math.min(1, 512 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.85));
  return new File([blob], 'aliment.jpg', { type: 'image/jpeg' });
}

export function FeuilleNouvelAliment({ fermer, nomInitial = '', shake = false }) {
  const g = G();
  const [photo, setPhoto] = useState('');
  const photoActuelle = photo;
  const [envoi, setEnvoi] = useState(false);
  const [nom, setNom] = useState(nomInitial);
  const [portion, setPortion] = useState('');
  const [grammes, setGrammes] = useState('');
  const [cat, setCat] = useState(null);
  const [par100, setPar100] = useState(false);
  const [v, setV] = useState({ kcal: '', p: '', c: '', l: '' });
  const [plus, setPlus] = useState(false);
  const [x, setX] = useState({ fi: '', su: '', na: '', sat: '', trans: '', mono: '', poly: '' });
  const [estShake, setEstShake] = useState(shake);
  const [eau, setEau] = useState(0); // ml d'eau par portion (food.dart _WaterToggle), 0 = ne compte pas
  const fichier = useRef(null);
  // Photo choisie (food.dart _pick) : détourage automatique et photo entière préparés dans le navigateur, envoyés à l'enregistrement.
  const [det, setDet] = useState(null); // { brouillon, decoupe: { blob, url } | null, entiere: { blob, url }, choix: 'decoupe' | 'entiere' }
  const [retouche, setRetouche] = useState(false);
  const choisirPhoto = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setEnvoi(true);
    try {
      await new Promise((r) => setTimeout(r, 30)); // laisse paraître l'attente avant le calcul
      const { decoderImage, brouillonDetourage, rendreAutocollant, photoEntiere, versPng } = await import('../../detourage.js');
      const img = await decoderImage(f);
      const brouillon = brouillonDetourage(img.w, img.h, img.src);
      const enBlob = async (rendu) => { const blob = rendu && await versPng(rendu); return blob ? { blob, url: await enDataUrl(blob) } : null; };
      const decoupe = brouillon.trouve ? await enBlob(rendreAutocollant(img.w, img.h, img.src, brouillon.masque)) : null;
      const entiere = await enBlob(photoEntiere(img.w, img.h, img.src));
      setDet({ brouillon, decoupe, entiere, choix: decoupe ? 'decoupe' : 'entiere' });
      setPhoto((decoupe ?? entiere)?.url ?? '');
    } catch {
      // Navigateur sans décodage de ce format : l'ancienne voie (JPEG 512 px envoyé tout de suite).
      try { setDet(null); setPhoto(urlMedia(await importerImage(await photoJpeg(f)))); } catch { afficher(g.photoErreur, 'danger'); }
    } finally { setEnvoi(false); }
  };
  const choisir = (choix) => { if (!det?.[choix]) return; setDet({ ...det, choix }); setPhoto(det[choix].url); };
  const sauver = async () => {
    if (!nom.trim()) { afficher(g.nomRequis, 'danger'); return; }
    let photo = photoActuelle;
    if (det?.[det.choix]) {
      setEnvoi(true);
      try { photo = urlMedia(await importerImage(new File([det[det.choix].blob], 'aliment.png', { type: 'image/png' }))); }
      catch { afficher(g.photoErreur, 'danger'); setEnvoi(false); return; }
      setEnvoi(false);
    }
    const gPortion = lire(grammes) || 100;
    const k = par100 ? 1 : 100 / gPortion; // valeurs gardées pour 100 g
    const r1 = (n) => Math.round(n * k * 10) / 10;
    const p = lire(v.p), c = lire(v.c), l = lire(v.l);
    const kcal = kcalDepuis(lire(v.kcal)) || p * 4 + c * 4 + l * 9;
    const id = creerAlimentPerso({
      nom: nom.trim(), portion: portion.trim(), gPortion, cat: cat ?? 'pantry', photo, approx: 0, ...(eau > 0 ? { eau } : {}),
      kcal: Math.round(kcal * k), p: r1(p), c: r1(c), l: r1(l),
      f: r1(lire(x.fi)), su: r1(lire(x.su)), na: Math.round(lire(x.na) * k), sat: r1(lire(x.sat)), trans: r1(lire(x.trans)), mono: r1(lire(x.mono)), poly: r1(lire(x.poly)),
    });
    if (estShake) { marquerShake(id, true); choisirShake(id); }
    afficher(nom.trim(), 'ok');
    fermer(id);
  };
  return <Feuille ouverte large fermer={() => fermer(null)} titre={g.nouvelAliment}>
    <div class="gm-pile">
      <button type="button" class={`gm-photo-choix ${photo ? 'pleine' : ''}`} onClick={() => !envoi && fichier.current?.click()} aria-label={g.ajouterPhoto}>
        {envoi ? <span class="gm-attente" aria-hidden="true" />
          : photo ? <img src={photo} alt="" />
            : <><Ic n="camera" taille={30} /><b>{g.ajouterPhoto}</b></>}
      </button>
      <input ref={fichier} type="file" accept="image/*" hidden onChange={choisirPhoto} />
      {det && <div class="l26-photo-choix">
        {[['decoupe', L26().detourer], ['entiere', L26().photoEntiere]].map(([k, lib]) => <button key={k} type="button" aria-pressed={det.choix === k} disabled={!det[k]} onClick={() => choisir(k)}>
          <span class="vignette">{det[k] ? <img src={det[k].url} alt="" /> : <Ic n="scissors" taille={22} />}</span>{lib}</button>)}
      </div>}
      {det && <button type="button" class="nut-puce l26-puce-retouche" onClick={() => setRetouche(true)}><Ic n="paint-brush:bold" taille={13} />{det.brouillon.trouve ? L26().retoucher : L26().detourerMain}</button>}
      {retouche && det && <EditeurDetourage brouillon={det.brouillon} fermer={() => setRetouche(false)} terminer={async (rendu, masque) => {
        const { versPng } = await import('../../detourage.js');
        const blob = await versPng(rendu);
        setRetouche(false);
        if (!blob) return;
        const decoupe = { blob, url: await enDataUrl(blob) };
        setDet({ ...det, brouillon: { ...det.brouillon, masque }, decoupe, choix: 'decoupe' });
        setPhoto(decoupe.url);
      }} />}
      <p class="gm-note centre">{g.photoIndice}</p>
      <ChampTexte label={g.nomLabel} valeur={nom} onInput={setNom} indice={g.nomIndice} />
      <div class="gm-champs32">
        <ChampTexte label={g.portionLabel} valeur={portion} onInput={setPortion} indice={g.portionIndice} />
        <ChampNombre label={g.grammesLabel} valeur={grammes} onInput={setGrammes} indice="100" />
      </div>
      <Kicker classe="m14">{g.categorie}</Kicker>
      <div class="gm-pastilles">
        {CATEGORIES_ORDRE.map((k) => <button key={k} type="button" aria-pressed={cat === k} class={cat === k ? 'on' : ''} onClick={() => setCat(cat === k ? null : k)}>{CAT_LABEL[k]()}</button>)}
      </div>
      <div class="m14"><ParPortion par100={par100} set={setPar100} /></div>
      <Macros v={v} set={setV} />
      {plus
        ? <>
          <div class="gm-champs3">
            <ChampNombre label={g.fibres} valeur={x.fi} onInput={(n) => setX({ ...x, fi: n })} couleur="var(--sage)" />
            <ChampNombre label={g.sucre} valeur={x.su} onInput={(n) => setX({ ...x, su: n })} couleur="var(--warn)" />
            <ChampNombre label={g.sodium} valeur={x.na} onInput={(n) => setX({ ...x, na: n })} couleur="var(--text2)" suffixe="mg" />
          </div>
          <Kicker classe="m14">{g.typesGraisses}</Kicker>
          <div class="gm-champs2">
            <ChampNombre label={g.saturees} valeur={x.sat} onInput={(n) => setX({ ...x, sat: n })} couleur="var(--warn)" />
            <ChampNombre label={g.trans} valeur={x.trans} onInput={(n) => setX({ ...x, trans: n })} couleur="var(--danger)" />
          </div>
          <div class="gm-champs2">
            <ChampNombre label={g.mono} valeur={x.mono} onInput={(n) => setX({ ...x, mono: n })} couleur="var(--sage)" />
            <ChampNombre label={g.poly} valeur={x.poly} onInput={(n) => setX({ ...x, poly: n })} couleur="var(--info)" />
          </div>
          <p class="gm-note centre">{g.typesGraissesIndice}</p>
        </>
        : <button type="button" class="gm-lien" onClick={() => setPlus(true)}>{g.plusNutriments}</button>}
      <button type="button" role="switch" aria-checked={estShake} class={`gm-carte-bascule ${estShake ? 'on' : ''}`} onClick={() => setEstShake(!estShake)}>
        <img src={`${IMG}peek-shake.webp`} alt="" />
        <span><b>{g.cestShake}</b><small>{g.cestShakeIndice}</small></span>
        <span class={`inter ${estShake ? 'on' : ''}`} aria-hidden="true"><span /></span>
      </button>
      {suiviActif('water') && <div class={`l26-eau ${eau > 0 ? 'on' : ''}`}>
        <button type="button" role="switch" aria-checked={eau > 0} class="l26-eau-tete"
          onClick={() => setEau(eau > 0 ? 0 : estShake ? 400 : 250)}>
          <Ic n="drop:fill" taille={22} />
          <span><b>{L26().compteEau}</b><small>{L26().compteEauAide}</small></span>
          <span class={`inter ${eau > 0 ? 'on' : ''}`} aria-hidden="true"><span /></span>
        </button>
        {eau > 0 && <div class="l26-eau-pas">
          <span>{L26().eauParPortion}</span>
          <span class="l26-pas">
            <button type="button" aria-label={`${L26().diminuer} ${L26().eauParPortion}`} onClick={() => setEau(Math.max(50, eau - 50))}>−</button>
            <b>{eau} ml</b>
            <button type="button" aria-label={`${L26().augmenter} ${L26().eauParPortion}`} onClick={() => setEau(Math.min(5000, eau + 50))}>+</button>
          </span>
        </div>}
      </div>}
      <button type="button" class="btn pri gm-plein m8" disabled={envoi} onClick={sauver}>{g.enregistrer}</button>
    </div>
  </Feuille>;
}

/* ===== Votre shake (showShakePicker) ===== */
export function FeuilleShake({ fermer, nouveau }) {
  const g = G();
  const liste = shakes();
  const actif = getShake();
  const s = nutritionStore.value;
  const autres = [...new Set([...s.recents, ...s.favoris, ...Object.keys(s.alimentsPerso)])].filter((id) => !s.shakes.includes(id)).map(getAliment).filter(Boolean);
  const nomDe = (a) => a.nom ?? a.nomFr ?? a.nomEn;
  const photo = (a) => (a.perso ? a.photo || null : `/statique/nutrition/${a.id}.webp`);
  return <Feuille ouverte fermer={fermer} titre={g.ton_shake} sous={g.shakeIndice}>
    <div class="gm-pile">
      {liste.length
        ? <div class="gm-groupe">{liste.map((a) => <div key={a.id} class={`gm-ligne gm-option ${actif?.id === a.id ? 'choisi' : ''}`}>
          <button type="button" class="gm-option-corps" onClick={() => { choisirShake(a.id); fermer(); }}>
            <Photo src={photo(a)} nom={nomDe(a)} taille={32} incline={false} /><span>{nomDe(a)}</span>
            <small>{nombre((a.p * (a.gPortion || 100)) / 100, 1)} g</small>
          </button>
          <button type="button" class="gm-option-x" aria-label={g.pasShake} onClick={() => marquerShake(a.id, false)}><Ic n="x:bold" taille={14} /></button>
        </div>)}</div>
        : <div class="gm-encart"><img src={`${IMG}peek-shake.webp`} alt="" /><p>{g.shakeAucun}</p></div>}
      {autres.length > 0 && <>
        <Kicker classe="m18">{g.marquerShake}</Kicker>
        <div class="gm-defile">{autres.map((a) => <button key={a.id} type="button" class="gm-puce-aliment" onClick={() => marquerShake(a.id, true)}>
          <Photo src={photo(a)} nom={nomDe(a)} taille={24} incline={false} ombre={false} /><span>{nomDe(a)}</span>
        </button>)}</div>
      </>}
      <button type="button" class="btn gm-plein m16" onClick={nouveau}><Ic n="plus:bold" taille={16} />{g.nouveauShake}</button>
    </div>
  </Feuille>;
}

/* ===== Créer mon plat (showDishEditor) ===== */
export function FeuillePlatPerso({ fermer }) {
  const g = G();
  const [nom, setNom] = useState('');
  const [items, setItems] = useState([]);
  const [palette, setPalette] = useState(false);
  const sauver = () => {
    if (!nom.trim()) { afficher(g.nomRequis, 'danger'); return; }
    if (!items.length) { afficher(g.aucunIngredient, 'danger'); return; }
    sauverRecette({ id: nouvelId(), nom: nom.trim(), items: items.map((e) => ({ slug: e.alimentId, grammes: e.grammes })) });
    afficher(g.repasEnregistre, 'ok');
    fermer();
  };
  if (palette) return <PaletteAliments ouverte fermer={() => setPalette(false)} surAjout={(l) => setItems([...items, ...(Array.isArray(l) ? l : [l])])} />;
  return <Feuille ouverte large fermer={fermer} titre={g.creerPlat} sous={g.creerPlatIndice}>
    <div class="gm-pile">
      <ChampTexte label={g.nomPlat} valeur={nom} onInput={setNom} indice={g.nomPlatIndice} />
      <Kicker classe="m14">{g.ingredients}</Kicker>
      {items.length > 0 && <div class="gm-groupe">{items.map((e, i) => <div key={e.id} class="gm-ligne gm-option">
        <Photo src={`/statique/nutrition/${e.alimentId}.webp`} nom={e.nom} taille={32} incline={false} /><span>{e.nom}</span><small>{Math.round(e.grammes)} g</small>
        <button type="button" class="gm-option-x" aria-label={g.supprimer} onClick={() => setItems(items.filter((_, j) => j !== i))}><Ic n="x:bold" taille={14} /></button>
      </div>)}</div>}
      <button type="button" class="btn gm-plein" onClick={() => setPalette(true)}><Ic n="plus:bold" taille={16} />{g.ajouterIngredient}</button>
      <button type="button" class="btn pri gm-plein m8" onClick={sauver}>{g.enregistrerPlat}</button>
    </div>
  </Feuille>;
}
