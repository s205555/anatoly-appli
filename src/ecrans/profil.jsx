// Profil : portage 1:1 de GymMane profile_screen.dart (en-tête bannière épinglé, pastilles, médailles, photos, pass salle, année).
// Pass salle : gym_pass_screen.dart et gym_pass_card.dart. Fiche médaille : medal_shelf.dart. Fiche profil : settings_screen.dart.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { afficher, api, charger, ecrireModule, enDate, etat, jourLocal, lireModule, nombre, unite, versAffichage, versKg } from '../donnees.js';
import { calculerDistinctions, IcMedaille } from '../distinctions.js';
import { code128, code39, ean13, qr } from '../codes-barres.js';
import { profilTextes } from '../i18n/profil.js';
import { langue, dp } from '../i18n.js';
import { Feuille, Ic, Rond } from '../ui.jsx';
import { ecrirePhotos, importerImage, lire, lirePhotos, ecrire, supprimerImages, urlMedia } from './photos.jsx';
import { lireM13 } from './reglages-m13.js';
import './profil.css';

const IMG_BANNIERE = '/statique/app-img/banner_default.jpg';
const IMG_PHOTO = '/statique/app-img/profile_default.jpg';
const CLE_PASS = 'an_profil_pass';
const CLE_PASS_ANCIEN = 'an_m13_pass';
const CLE_VUES = 'an_profil_medailles_vues';
const BADGES = ['gold', 'blue', 'green'];
const COULEUR_BADGE = { gold: '#E8B84B', blue: '#4A9EEB', green: '#54B979' };
const TEINTES = ['#F3C7B1', '#A78BDA', '#A8C99E', '#9CC2E8', '#E8CF98', '#E6A4B9'];
const ACTIVITES = ['sedentaire', 'leger', 'modere', 'actif'];
const TOURS = [-0.06, 0.045, -0.03, 0.055];
const RATIO_PASS = 1.586;
const bornes = (v, a, b) => Math.min(b, Math.max(a, v));

// ===== Pass salle : sur le compte (extensions.modules.pass.liste) ; ceux du navigateur sont repris une fois =====
function passesDuNavigateur() {
  const liste = lire(CLE_PASS, null);
  if (Array.isArray(liste)) return liste;
  const ancien = lire(CLE_PASS_ANCIEN, null); // ancien pass unique de l'écran Profil
  if (ancien?.numero) return [{ id: 'p0', nom: ancien.nomSalle || '', code: String(ancien.numero), format: ancien.format === 'qr' ? 'qr' : 'code128', teinte: 0, membre: '' }];
  return [];
}
const passesValides = (l) => l.filter((p) => p && p.id && typeof p.code === 'string').map((p) => ({ id: String(p.id), nom: String(p.nom ?? ''), code: p.code, format: ['qr', 'photo', 'ean13', 'code39'].includes(p.format) ? p.format : 'code128', teinte: Number(p.teinte) || 0, membre: String(p.membre ?? '') }));
function lirePasses() {
  const m = lireModule('pass');
  return Array.isArray(m?.liste) ? passesValides(m.liste) : passesValides(passesDuNavigateur());
}
export const lirePass = () => lirePasses()[0] ?? null;
let repriseEnCours = false;
/** Envoie une fois au compte les pass gardés dans le navigateur. L'original reste en place ; sans pass, rien n'est écrit. */
async function reprendrePasses() {
  if (repriseEnCours || Array.isArray(lireModule('pass')?.liste)) return;
  const anciens = passesValides(passesDuNavigateur());
  if (!anciens.length) return;
  repriseEnCours = true;
  try { await ecrireModule('pass', { liste: anciens }); } catch { /* repris à la prochaine ouverture */ } finally { repriseEnCours = false; }
}
const ecrirePasses = (liste, dernier = lireModule('pass')?.dernier) => ecrireModule('pass', { liste, ...(dernier ? { dernier } : {}) });
// lastPassId : le carrousel repart du dernier pass montré.
const poserDernier = (id) => { const m = lireModule('pass'); if (Array.isArray(m?.liste) && m.dernier !== id) ecrirePasses(m.liste, id).catch(() => {}); };

// Redimensionne et recompresse en JPEG pour passer sous la limite du service média.
export async function redimensionner(fichier, largeurMax, hauteurMax, qualite) {
  let bmp;
  try { bmp = await createImageBitmap(fichier); } catch { throw new Error('image'); }
  const k = Math.min(1, largeurMax / bmp.width, hauteurMax / bmp.height);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', qualite));
  if (!blob) throw new Error('image');
  return new File([blob], 'image.jpg', { type: 'image/jpeg' });
}

// ===== Identité du profil (extensions.profil) =====
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
function identite() {
  const p = etat.value.profil, e = p.extensions?.profil ?? {};
  const nom = e.nomAffiche || p.prenom;
  return {
    nom, pseudo: e.pseudo || slug(nom) || 'anatoly', badge: e.badge === undefined ? 'blue' : e.badge,
    banniere: e.banniere || '', photo: e.photo || '', age: e.age ?? 28, tailleCm: e.tailleCm ?? 175, sexe: e.sexe ?? 'm', activite: e.activite ?? 'modere',
  };
}

/** Enregistre des champs de extensions.profil (et éventuellement la racine du profil) : affichage tout de suite, serveur ensuite. */
async function enregistrer(champs, racine = {}) {
  const e = etat.value, p = e.profil;
  const ext = { ...p.extensions, profil: { ...(p.extensions?.profil ?? {}), ...champs } };
  etat.value = { ...e, profil: { ...p, ...racine, extensions: ext } };
  try {
    await api('PUT', '/api/reglages', {
      prenom: p.prenom, langue: p.langue, unite: p.unite, theme: p.theme, repos_s: p.repos_s, objectif_semaine: p.objectif_semaine, ...racine,
      extensions: { profil: champs },
    });
    return true;
  } catch {
    etat.value = e;
    afficher(profilTextes[langue].saveFail, 'danger');
    return false;
  }
}

// Change ou retire l'image du profil (photo, banniere) et efface l'ancienne sur le serveur si l'enregistrement a réussi.
async function changerImage(genre, nouvelle, ancien) {
  if ((await enregistrer({ [genre]: nouvelle })) && ancien) supprimerImages([ancien]);
}

// ===== Petits composants =====
const Avatar = ({ id, taille, classe = '' }) => <span class={`pf-avatar ${classe}`} style={{ width: `${taille}px`, height: `${taille}px` }}>
  <img src={id.photo ? urlMedia(id.photo) : IMG_PHOTO} alt="" decoding="async" />
</span>;
const Badge = ({ id, taille }) => id.badge ? <span class="pf-badge" style={{ color: COULEUR_BADGE[id.badge] }}><Ic n="seal-check:fill" taille={taille} /></span> : null;

// Boîte à titre (_box) : zone dégradée, puis titre, compteur et « Tout voir ».
function Boite({ titre, compte, onPlus, children }) {
  const x = profilTextes[langue];
  return <section class="pf-boite">
    <div class="pf-boite-corps">{children}</div>
    <div class="pf-boite-pied">
      <h2>{titre}</h2>{compte != null && <span class="pf-boite-compte">{compte}</span>}
      <span class="pf-ressort" />
      {onPlus && <button type="button" class="pf-voir" onClick={onPlus}>{x.seeAll}</button>}
    </div>
  </section>;
}

function Titre({ titre, compte, onPlus }) {
  const x = profilTextes[langue];
  return <div class="pf-titre">
    <span>{titre}</span>{compte != null && <span class="pf-titre-compte">{compte}</span>}
    <span class="pf-ressort" />
    {onPlus && <button type="button" class="pf-voir" onClick={onPlus}>{x.seeAll}</button>}
  </div>;
}

// ===== Codes =====
const BARRES = { code128, ean13, code39 };
// Formats proposés dans l'éditeur, dans l'ordre de l'original (_formats).
const FORMATS = [['qr', 'QR'], ['code128', 'Code 128'], ['ean13', 'EAN-13'], ['code39', 'Code 39']];
function Code({ code, format, legende = false }) {
  if (format === 'photo') return <img class="pf-code-photo" src={urlMedia(code)} alt="" decoding="async" />;
  if (format === 'qr') {
    const m = qr(code);
    if (!m) return null;
    const n = m.length;
    const d = [];
    m.forEach((l, y) => l.forEach((c, x) => { if (c) d.push(`M${x} ${y}h1v1h-1z`); }));
    return <svg class="pf-code-qr" viewBox={`0 0 ${n} ${n}`} shape-rendering="crispEdges" role="img" aria-label={code}><path d={d.join('')} fill="#000" /></svg>;
  }
  const w = BARRES[format]?.(code) ?? code128(code);
  if (!w) return null;
  const total = w.reduce((a, b) => a + b, 0);
  const d = [];
  let px = 0;
  w.forEach((l, i) => { if (i % 2 === 0) d.push(`M${px} 0h${l}v1h-${l}z`); px += l; });
  return <div class="pf-code-barres">
    <svg viewBox={`0 0 ${total} 1`} preserveAspectRatio="none" shape-rendering="crispEdges" role="img" aria-label={code}><path d={d.join('')} fill="#000" /></svg>
    {legende && <span>{code}</span>}
  </div>;
}
const codeValide = (format, code) => !!code && (format === 'photo' || (format === 'qr' ? !!qr(code) : !!(BARRES[format] ?? code128)(code)));

export function CartePass({ pass, nomMembre }) {
  const x = profilTextes[langue];
  const teinte = TEINTES[Math.abs(pass.teinte) % TEINTES.length];
  const carre = pass.format === 'qr';
  const panneau = <div class="pf-pass-panneau"><Code code={pass.code} format={pass.format} /></div>;
  const qui = <div class="pf-pass-qui"><small>{x.gymPassMember}</small><strong>{pass.membre || nomMembre}</strong></div>;
  return <div class="pf-pass" style={{ '--teinte': teinte }}>
    <div class="pf-pass-carte">
      <div class="pf-pass-fond" aria-hidden="true">
        <svg viewBox="0 0 1000 631" preserveAspectRatio="none">{Array.from({ length: 28 }, (_, i) => <circle key={i} cx="1020" cy="694" r={180 + i * 34} fill="none" stroke="#fff" stroke-opacity=".035" />)}</svg>
        <span class="pf-pass-bord" />
      </div>
      <div class={`pf-pass-contenu ${carre ? 'carre' : ''}`}>
        {carre ? <>
          <div class="pf-pass-gauche"><small class="pf-pass-sur">{x.gymPass}</small><strong class="pf-pass-nom">{pass.nom || ' '}</strong><span class="pf-ressort" />{qui}</div>
          {panneau}
        </> : <>
          <div class="pf-pass-haut"><div class="pf-pass-gauche"><small class="pf-pass-sur">{x.gymPass}</small><strong class="pf-pass-nom">{pass.nom || ' '}</strong></div>{qui}</div>
          <span class="pf-ressort" />
          {panneau}
        </>}
      </div>
    </div>
  </div>;
}

function PassVide({ onClick }) {
  const x = profilTextes[langue];
  return <button type="button" class="pf-pass-vide" onClick={onClick}>
    <svg class="pf-pointilles" viewBox="0 0 1000 631" preserveAspectRatio="none" aria-hidden="true"><rect x="1" y="1" width="998" height="629" rx="58" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="12 12" vector-effect="non-scaling-stroke" /></svg>
    <span class="pf-pass-vide-rond"><Ic n="qr-code" taille={22} /></span>
    <strong>{x.gymPassAdd}</strong>
    <span>{x.gymPassEmpty}</span>
  </button>;
}

// Carrousel (GymPassCarousel) : un seul pass seul, plusieurs en défilement accroché avec points.
function Carrousel({ passes, nomMembre, montrer }) {
  const depart = Math.max(0, passes.findIndex((p) => p.id === lireModule('pass')?.dernier));
  const [i, setI] = useState(depart);
  const ref = useRef(null);
  useEffect(() => { const el = ref.current; if (el && depart) el.scrollLeft = (el.scrollWidth / passes.length) * depart; }, []);
  if (passes.length === 1) return <button type="button" class="pf-presse" onClick={() => montrer(passes[0])}><CartePass pass={passes[0]} nomMembre={nomMembre} /></button>;
  return <div>
    <div class="pf-carrousel" ref={ref} onScroll={(e) => { const el = e.currentTarget; const k = Math.round(el.scrollLeft / (el.scrollWidth / passes.length)); if (k !== i) { setI(k); poserDernier(passes[k]?.id); } }}>
      {passes.map((p) => <button type="button" key={p.id} class="pf-presse pf-carrousel-page" onClick={() => montrer(p)}><CartePass pass={p} nomMembre={nomMembre} /></button>)}
    </div>
    <div class="pf-points" aria-hidden="true">{passes.map((p, k) => <span key={p.id} class={k === i ? 'on' : ''} />)}</div>
  </div>;
}

// Affichage plein écran du code (_PassView) : écran gardé allumé si le navigateur le permet.
function VuePass({ pass, nomMembre, fermer }) {
  const x = profilTextes[langue];
  useEffect(() => {
    let verrou = null;
    try { navigator.wakeLock?.request('screen').then((v) => { verrou = v; }).catch(() => {}); } catch { /* non pris en charge */ }
    const touche = (e) => { if (e.key === 'Escape') fermer(); };
    document.addEventListener('keydown', touche);
    document.body.classList.add('fige');
    return () => { document.removeEventListener('keydown', touche); document.body.classList.remove('fige'); verrou?.release?.().catch(() => {}); };
  }, []);
  const carre = pass.format === 'qr';
  return <div class="pf-vue" role="dialog" aria-modal="true" aria-label={pass.nom} onClick={fermer}>
    <div class="pf-vue-in">
      <h2>{pass.nom}</h2><p>{pass.membre || nomMembre}</p>
      <div class={`pf-vue-code ${carre ? 'carre' : ''} ${pass.format === 'photo' ? 'photo' : ''}`} style={{ '--teinte': TEINTES[Math.abs(pass.teinte) % TEINTES.length] }}><Code code={pass.code} format={pass.format} legende /></div>
      <p class="pf-vue-aide"><Ic n="sun" taille={14} />{x.gymPassShowHint}</p>
    </div>
  </div>;
}

// Lecture d'un code sur une photo (BarcodeDetector, présent sur Chrome et Android).
async function lireCodePhoto(fichier) {
  if (!('BarcodeDetector' in window)) return { erreur: 'none' };
  try {
    const bmp = await createImageBitmap(fichier);
    const r = await new window.BarcodeDetector().detect(bmp);
    if (!r.length) return { erreur: 'fail' };
    const format = /qr/i.test(r[0].format) ? 'qr' : r[0].format === 'ean_13' ? 'ean13' : r[0].format === 'code_39' ? 'code39' : 'code128';
    return { code: r[0].rawValue, format };
  } catch { return { erreur: 'fail' }; }
}

// Choix de la façon d'ajouter un pass (addGymPass) : quatre lignes, puis le formulaire.
function ChoixAjoutPass({ fermer, choisir }) {
  const x = profilTextes[langue];
  const ligne = (ic, titre, aide, v) => <button type="button" class="pf-choix" onClick={() => choisir(v)}>
    <span class="pf-choix-rond"><Ic n={ic} taille={19} /></span>
    <span class="pf-choix-txt"><strong>{titre}</strong><small>{aide}</small></span>
    <Ic n="caret-right" taille={15} />
  </button>;
  return <Feuille ouverte fermer={fermer} titre={x.gymPassAdd} sous={x.gymPassPrivate}>
    <div class="pf-choix-liste">
      {ligne('camera', x.gymPassScan, x.gymPassScanHint, 'camera')}
      {ligne('image', x.gymPassPhoto, x.gymPassPhotoHint, 'photo')}
      {ligne('keyboard', x.gymPassType, x.gymPassTypeHint, 'type')}
      {ligne('frame-corners', x.gymPassPicture, x.gymPassPictureHint, 'picture')}
    </div>
  </Feuille>;
}

// pass : pass existant, null (nouveau vide) ou { neuf: true, code, format } (nouveau prérempli par la lecture ou la photo).
function EditeurPass({ pass, rang, fermer, enregistrerPass, supprimerPass }) {
  const x = profilTextes[langue];
  const existant = pass && !pass.neuf ? pass : null;
  const [b, setB] = useState(() => existant ?? { id: `p${Date.now().toString(36)}`, nom: x.gymPassDefaultName, code: '', format: 'qr', teinte: rang % TEINTES.length, membre: '', ...(pass?.neuf ? { code: pass.code, format: pass.format } : {}) });
  // Photos envoyées pendant l'édition : celles qui ne finissent pas sur le pass sont effacées à la fermeture.
  const nouvelles = useRef(new Set(pass?.neuf && pass.format === 'photo' ? [pass.code] : []));
  const lecteur = useRef(null);
  const [occupe, setOccupe] = useState(false);
  const photo = b.format === 'photo';
  const valide = codeValide(b.format, b.code);
  const quitter = (garde) => {
    supprimerImages([...nouvelles.current].filter((n) => n !== garde));
    if (garde && existant?.format === 'photo' && existant.code !== garde) supprimerImages([existant.code]);
    fermer();
  };
  const scanner = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    if (photo) {
      setOccupe(true);
      try { const n = await importerImage(await redimensionner(f, 1440, 1920, 0.88)); nouvelles.current.add(n); setB((v) => ({ ...v, code: n })); } catch { afficher(x.imageRefusee, 'danger'); } finally { setOccupe(false); }
      return;
    }
    afficher(x.gymPassReading);
    const r = await lireCodePhoto(f);
    if (r.erreur) return afficher(r.erreur === 'none' ? x.passScanNone : x.passScanFail, 'danger');
    setB((v) => ({ ...v, code: r.code, format: r.format, nom: v.nom }));
  };
  return <Feuille ouverte fermer={() => quitter(null)} titre={existant ? x.gymPassEdit : x.gymPassAdd}>
    <form class="pile" onSubmit={(e) => { e.preventDefault(); if (valide && !occupe) { const p = { ...b, nom: b.nom.trim() || x.gymPassDefaultName, code: b.code.trim() }; enregistrerPass(p); quitter(p.code); } }}>
      {photo && <div class="pf-photo-pass">{b.code && <img src={urlMedia(b.code)} alt="" decoding="async" />}</div>}
      <div class="pf-groupe">
        <label class="pf-champ"><span class="pf-etiquette">{x.passName}</span><input class="pf-saisie" maxLength={60} value={b.nom} placeholder={x.gymPassDefaultName} onInput={(e) => setB({ ...b, nom: e.target.value })} /></label>
        {!photo && <label class="pf-champ"><span class="pf-etiquette">{x.passCode}</span><input class="pf-saisie pf-saisie-code" maxLength={200} value={b.code} placeholder="0123456789" aria-invalid={!!b.code && !valide} onInput={(e) => setB({ ...b, code: e.target.value })} /></label>}
        <label class="pf-champ"><span class="pf-etiquette">{x.passMember}</span><input class="pf-saisie" maxLength={40} value={b.membre} onInput={(e) => setB({ ...b, membre: e.target.value })} /></label>
      </div>
      {!photo && <div><span class="pf-etiquette">{x.passFormat}</span>
        <div class="pf-formats" role="radiogroup" aria-label={x.passFormat}>
          {FORMATS.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={b.format === v} class={b.format === v ? 'on' : ''} onClick={() => setB({ ...b, format: v })}>{l}</button>)}
        </div>
      </div>}
      {!photo && !!b.code && !valide && <p class="pf-erreur" role="alert">{x.passCodeInvalid}</p>}
      <div class="pf-ligne-ctl"><span class="pf-ligne-nom">{x.gymPassColor}</span>
        <div class="pf-teintes">{TEINTES.map((c, k) => <button key={c} type="button" class={k === b.teinte ? 'on' : ''} style={{ background: c }} aria-label={`${x.gymPassColor} ${k + 1}`} aria-pressed={k === b.teinte} onClick={() => setB({ ...b, teinte: k })} />)}</div>
      </div>
      <button type="button" class="btn large" disabled={occupe} onClick={() => lecteur.current?.click()}><Ic n={photo ? 'image' : 'camera'} taille={18} />{photo ? x.gymPassChangePicture : x.gymPassRescan}</button>
      <input ref={lecteur} type="file" accept={photo ? 'image/jpeg,image/png' : 'image/*'} capture={photo ? undefined : 'environment'} hidden onChange={scanner} />
      <button type="submit" class="btn pri large" disabled={!valide || occupe}>{x.save}</button>
    </form>
  </Feuille>;
}

// Menu d'un pass (_menu de gym_pass_screen.dart) : montrer, modifier, monter, descendre, supprimer.
function MenuPass({ pass, rang, nb, fermer, montrer, editer, deplacer, supprimer }) {
  const x = profilTextes[langue];
  const ligne = (ic, l, fn, danger) => <button type="button" class={`pf-choix${danger ? ' danger' : ''}`} onClick={() => { fermer(); fn(); }}><span class="pf-choix-rond"><Ic n={ic} taille={19} /></span><span class="pf-choix-txt"><strong>{l}</strong></span></button>;
  return <Feuille ouverte fermer={fermer} titre={pass.nom} sous={formatPass(pass, x)}>
    <div class="pf-choix-liste">
      {ligne('qr-code', x.gymPassShow, () => montrer(pass))}
      {ligne('pencil-simple', x.gymPassEdit, () => editer(pass))}
      {rang > 0 && ligne('arrow-up', x.moveUp, () => deplacer(pass.id, -1))}
      {rang < nb - 1 && ligne('arrow-down', x.moveDown, () => deplacer(pass.id, 1))}
      {ligne('trash', x.passDelete, () => supprimer(pass.id), true)}
    </div>
  </Feuille>;
}
const formatPass = (p, x) => (p.format === 'photo' ? x.gymPassPictureFormat : (FORMATS.find(([v]) => v === p.format) ?? FORMATS[1])[1]);

function ListePasses({ passes, nomMembre, fermer, montrer, editer, ajouter, deplacer, supprimer }) {
  const x = profilTextes[langue];
  const [menu, setMenu] = useState(null);
  return <Feuille ouverte fermer={fermer} titre={x.gymPass} large classe="pf-feuille-passes">
    <div class="pf-liste-tete"><span>{x.profil}</span><Rond n="plus" label={x.gymPassAdd} onClick={ajouter} taille={44} icone={17} /></div>
    <div class="pf-liste-passes">
      {passes.length === 0 && <PassVide onClick={ajouter} />}
      {passes.map((p) => <div key={p.id}>
        <PressionLongue class="pf-presse" onClick={() => montrer(p)} onLong={() => setMenu(p)}><CartePass pass={p} nomMembre={nomMembre} /></PressionLongue>
        <div class="pf-liste-pied">
          <span class="pf-format">{formatPass(p, x).toUpperCase()}</span>
          <button type="button" class="pf-voir" onClick={() => setMenu(p)} aria-label={`${x.gymPassEdit} ${p.nom}`}><Ic n="dots-three:bold" taille={16} /></button>
        </div>
      </div>)}
      <p class="pf-prive"><Ic n="lock-simple" taille={13} />{x.gymPassPrivate}</p>
    </div>
    {menu && <MenuPass pass={menu} rang={passes.findIndex((q) => q.id === menu.id)} nb={passes.length} fermer={() => setMenu(null)} montrer={montrer} editer={editer} deplacer={deplacer} supprimer={supprimer} />}
  </Feuille>;
}

// Bouton à appui long (onLongPress de l'original) ; le clic droit fait de même.
function PressionLongue({ onClick, onLong, children, ...reste }) {
  const t = useRef(null);
  const fin = () => { clearTimeout(t.current?.id); };
  return <button type="button" {...reste} onClick={() => { if (t.current?.long) { t.current = null; return; } onClick(); }}
    onPointerDown={() => { t.current = { id: setTimeout(() => { t.current = { long: true }; navigator.vibrate?.(10); onLong(); }, 450) }; }}
    onPointerUp={fin} onPointerLeave={fin} onPointerCancel={fin} onContextMenu={(e) => { e.preventDefault(); onLong(); }}>{children}</button>;
}

// ===== Fiche d'une médaille (medal_shelf.dart _MedalSheet) : médaille, aide, titre, texte, date d'obtention ou progression =====
function FicheMedaille({ m, fermer }) {
  const x = profilTextes[langue];
  const [angle, setAngle] = useState(0);
  const prise = useRef(null);
  const date = m.debloque && m.obtenue ? new Intl.DateTimeFormat(langue, { day: 'numeric', month: 'short', year: 'numeric' }).format(m.obtenue) : null;
  return <Feuille ouverte fermer={fermer}>
    <div class="pf-fiche">
      <div class="pf-fiche-medaille" role="img" aria-label={m.titre} style={{ transform: `perspective(700px) rotateY(${angle}deg)` }}
        onPointerDown={(e) => { prise.current = { x: e.clientX, a: angle }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (prise.current) setAngle(prise.current.a + (e.clientX - prise.current.x) * 0.9); }}
        onPointerUp={() => { prise.current = null; setAngle((a) => Math.round(a / 360) * 360); }}
        onPointerCancel={() => { prise.current = null; }}>
        <IcMedaille id={m.id} verrou={!m.debloque} />
      </div>
      <p class="pf-fiche-aide">{x.awardSpinHint}</p>
      <h2 class="pf-fiche-titre">{m.titre}</h2>
      <p class="pf-fiche-ligne">{m.ligne}</p>
      {date ? <p class="pf-fiche-date">{x.awardWonOn(date)}</p> : <div class="pf-fiche-progres">
        <span class="pf-fiche-piste"><span style={{ width: `${Math.round(bornes((m.valeur ?? 0) / (m.objectif || 1), 0, 1) * 100)}%` }} /></span>
        <small>{court(m.valeur ?? 0)} / {court(m.objectif)}</small>
      </div>}
    </div>
  </Feuille>;
}
const court = (v) => (v >= 1000 ? `${nombre(v / 1000, 1)}k` : String(Math.round(v)));

// ===== Choix de la source d'une photo =====
// PhotoSourceSheet (et pickPhotoFor pour la photo d'un pass) : poignée puis deux options, sans titre.
function ChoixPhoto({ fermer, choisir, pass = false }) {
  const x = profilTextes[langue];
  return <Feuille ouverte fermer={fermer}>
    <div class="options pf-options" role="group" aria-label={x.addPhoto}>
      <button type="button" class="option" onClick={() => choisir('camera')}><Ic n="camera" taille={19} /><span><strong>{pass ? x.gymPassScan : x.takePhoto}</strong></span></button>
      <button type="button" class="option" onClick={() => choisir('galerie')}><Ic n="image" taille={19} /><span><strong>{pass ? x.gymPassPhoto : x.chooseGallery}</strong></span></button>
    </div>
  </Feuille>;
}

// ===== Fiche « Ton profil » (_ProfileSheet) =====
function Pas({ valeur, moins, plus, label }) {
  return <div class="pf-pas">
    <button type="button" aria-label={`${label} -`} onClick={moins}><Ic n="minus" taille={14} /></button>
    <span class="pf-pas-val" aria-live="polite">{valeur}</span>
    <button type="button" aria-label={`${label} +`} onClick={plus}><Ic n="plus" taille={14} /></button>
  </div>;
}

function FicheProfil({ fermer, choisirImage }) {
  const x = profilTextes[langue];
  const id = identite();
  const p = etat.value.profil;
  const lb = unite() === 'lb';
  const dernier = etat.value.poids?.length ? etat.value.poids[etat.value.poids.length - 1].kg : 75;
  const [txt, setTxt] = useState({ nom: id.nom, pseudo: id.pseudo });
  const [num, setNum] = useState({ age: id.age, tailleCm: id.tailleCm, kg: dernier, objectif: p.objectif_semaine });
  const attente = useRef(null);
  const brut = useRef({ txt, num });
  brut.current = { txt, num };

  // Les champs numériques partent au serveur peu après le dernier appui, ou à la fermeture de la fiche.
  const valider = async () => {
    clearTimeout(attente.current);
    attente.current = null;
    const { txt: t, num: n } = brut.current, cur = identite();
    const ext = {};
    const nom = t.nom.trim().slice(0, 80);
    // Nom vidé : on revient au prénom du compte, comme GymMane revient à son nom par défaut.
    if (nom && nom !== cur.nom) ext.nomAffiche = nom;
    else if (!nom && etat.value.profil.extensions?.profil?.nomAffiche) ext.nomAffiche = '';
    const ps = t.pseudo.trim().replace(/[^A-Za-z0-9_.]/g, '').slice(0, 40);
    if (ps !== cur.pseudo && ps) ext.pseudo = ps;
    if (n.age !== cur.age) ext.age = n.age;
    if (Math.round(n.tailleCm) !== Math.round(cur.tailleCm)) ext.tailleCm = Math.round(n.tailleCm);
    const racine = n.objectif !== etat.value.profil.objectif_semaine ? { objectif_semaine: n.objectif } : {};
    if (Object.keys(ext).length || Object.keys(racine).length) await enregistrer(ext, racine);
    const e = etat.value.poids ?? [];
    if (Math.abs(n.kg - (e.length ? e[e.length - 1].kg : 75)) > 0.001) {
      try { await api('PUT', '/api/poids', { jour: jourLocal(new Date()), kg: Math.round(n.kg * 100) / 100 }); await charger(); } catch { afficher(x.saveFail, 'danger'); }
    }
  };
  const programmer = () => { clearTimeout(attente.current); attente.current = setTimeout(valider, 700); };
  const maj = (cle, f) => { setNum((n) => ({ ...n, [cle]: f(n[cle]) })); programmer(); };
  const fin = async () => { await valider(); fermer(); };
  useEffect(() => () => { if (attente.current) valider(); }, []);

  const pouces = Math.round(num.tailleCm / 2.54);
  const taille = lb ? `${Math.floor(pouces / 12)}′ ${pouces % 12}″` : `${Math.round(num.tailleCm)} cm`;
  const poidsAff = `${nombre(versAffichage(num.kg), 1)} ${unite()}`;
  const ligne = (nom, ctl) => <div class="pf-ligne-ctl"><span class="pf-ligne-nom">{nom}</span>{ctl}</div>;
  const pasKg = lb ? versKg(1) : 0.5;

  return <Feuille ouverte fermer={fin} titre={x.yourProfile} sous={x.autofills} large>
    <div class="pf-edition">
      <div class="pf-edit-haut">
        <button type="button" class="pf-edit-banniere" style={{ backgroundImage: `url(${id.banniere ? urlMedia(id.banniere) : IMG_BANNIERE})` }} onClick={() => choisirImage('banniere')} aria-label={x.changeCover}>
          <span class="pf-puce"><Ic n="image" taille={14} /></span>
        </button>
        <button type="button" class="pf-edit-photo" onClick={() => choisirImage('photo')} aria-label={x.profilePhoto}>
          <Avatar id={id} taille={82} /><span class="pf-puce"><Ic n="camera" taille={14} /></span>
        </button>
        <div class="pf-edit-retirer">
          {id.photo && <button type="button" onClick={() => changerImage('photo', '', id.photo)}>{x.removePhoto}</button>}
          {id.photo && id.banniere && <span aria-hidden="true">·</span>}
          {id.banniere && <button type="button" onClick={() => changerImage('banniere', '', id.banniere)}>{x.removeCover}</button>}
        </div>
      </div>
      <div class="pf-groupe">
        <label class="pf-champ"><span class="pf-etiquette">{x.nameLabel}</span>
          <input class="pf-saisie" maxLength={80} value={txt.nom} placeholder={p.prenom} autoComplete="given-name" aria-describedby={txt.nom.trim() ? undefined : 'pf-nom-vide'} onInput={(e) => setTxt({ ...txt, nom: e.target.value })} onBlur={valider} /></label>
        {!txt.nom.trim() && <p class="pf-erreur pf-aide" id="pf-nom-vide" role="status">{x.nameEmpty}</p>}
        <label class="pf-champ"><span class="pf-etiquette">{x.handleLabel}</span>
          <span class="pf-arobase"><span>@</span><input class="pf-saisie" maxLength={40} autoCapitalize="none" autoCorrect="off" spellCheck={false} value={txt.pseudo}
            onInput={(e) => setTxt({ ...txt, pseudo: e.target.value.replace(/[^A-Za-z0-9_.]/g, '') })} onBlur={valider} /></span></label>
        {ligne(x.pickBadge, <div class="pf-badges">{BADGES.map((b) => <button key={b} type="button" aria-label={x.badge[b]} aria-pressed={id.badge === b} class={id.badge === b ? 'on' : ''}
          style={{ color: COULEUR_BADGE[b] }} onClick={() => enregistrer({ badge: b })}><Ic n="seal-check:fill" taille={id.badge === b ? 26 : 22} /></button>)}</div>)}
      </div>
      <div class="pf-groupe">
        {ligne(x.sexLabel, <div class="seg" role="radiogroup" aria-label={x.sexLabel}>
          {[['m', x.male], ['f', x.female]].map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={id.sexe === v} aria-pressed={id.sexe === v} onClick={() => enregistrer({ sexe: v })}>{l}</button>)}
        </div>)}
        {ligne(x.ageLabel, <Pas label={x.ageLabel} valeur={num.age} moins={() => maj('age', (v) => bornes(v - 1, 12, 99))} plus={() => maj('age', (v) => bornes(v + 1, 12, 99))} />)}
        {ligne(x.heightLabel, <Pas label={x.heightLabel} valeur={taille} moins={() => maj('tailleCm', (v) => bornes(v - (lb ? 2.54 : 1), 80, 240))} plus={() => maj('tailleCm', (v) => bornes(v + (lb ? 2.54 : 1), 80, 240))} />)}
        {ligne(x.weightLabel, <Pas label={x.weightLabel} valeur={poidsAff} moins={() => maj('kg', (v) => bornes(v - pasKg, 20, 500))} plus={() => maj('kg', (v) => bornes(v + pasKg, 20, 500))} />)}
        {ligne(x.weeklyGoal, <Pas label={x.weeklyGoal} valeur={`${num.objectif}×`} moins={() => maj('objectif', (v) => bornes(v - 1, 1, 7))} plus={() => maj('objectif', (v) => bornes(v + 1, 1, 7))} />)}
      </div>
      <div>
        <span class="pf-etiquette pf-etiquette-seule">{x.activityLabel}</span>
        <div class="pf-activites">{ACTIVITES.map((a) => <button key={a} type="button" aria-pressed={id.activite === a} class={id.activite === a ? 'on' : ''} onClick={() => enregistrer({ activite: a })}>{x.act[a]}</button>)}</div>
      </div>
      <button type="button" class="btn pri large pf-fait" onClick={fin}>{x.done}</button>
    </div>
  </Feuille>;
}

// ===== Écran =====
const HAUT = 254, BANDE = 172, BARRE = 60, AVATAR = 86; // hauteurs de _ProfileHeader, en pixels
const cadre = (n, a, b) => Math.min(b, Math.max(a, n));

export function Profil() {
  const x = profilTextes[langue];
  const { seances, profil } = etat.value;
  const id = identite();
  const tete = useRef(null);
  const [feuille, setFeuille] = useState(null);
  const [vues, setVues] = useState(() => lire(CLE_VUES, []));
  const passes = lirePasses();
  useEffect(() => { reprendrePasses(); }, []);
  const [moments, setMoments] = useState(lirePhotos);
  const [occupe, setOccupe] = useState(false);
  const [monte, setMonte] = useState(false);
  const [vue, setVue] = useState(null);
  const [edition, setEdition] = useState(undefined);
  const cible = useRef(null);
  const camera = useRef(null);
  const galerie = useRef(null);

  // En-tête épinglé : la bannière rétrécit au défilement, le nom passe dans la barre (shrinkOffset de Flutter).
  useEffect(() => {
    const el = tete.current;
    const haut = parseFloat(getComputedStyle(el.querySelector('.pf-sonde')).paddingTop) || 0;
    let cadrage = 0;
    const appliquer = () => {
      cadrage = 0;
      const plage = haut + HAUT - (haut + BARRE), s = cadre(window.scrollY / plage, 0, 1);
      const bb = Math.max(haut + BARRE, haut + BANDE - window.scrollY);
      const fondu = cadre(1 - s * 2, 0, 1), disparu = cadre((s - 0.35) / 0.45, 0, 1), barre = cadre((s - 0.7) / 0.3, 0, 1);
      const st = el.style;
      st.setProperty('--bb', `${bb}px`); st.setProperty('--sh', String(s)); st.setProperty('--fondu', String(fondu));
      st.setProperty('--disparu', String(disparu)); st.setProperty('--barre', String(barre));
      el.classList.toggle('replie', fondu < 0.5);
    };
    const demande = () => { if (!cadrage) cadrage = requestAnimationFrame(appliquer); };
    appliquer();
    addEventListener('scroll', demande, { passive: true });
    addEventListener('resize', demande);
    return () => { removeEventListener('scroll', demande); removeEventListener('resize', demande); cancelAnimationFrame(cadrage); };
  }, []);
  useEffect(() => { const r = requestAnimationFrame(() => setMonte(true)); return () => cancelAnimationFrame(r); }, []);

  // Statistiques (stats_state.dart).
  const stats = useMemo(() => {
    const total = seances.length;
    const sec = seances.reduce((a, s) => a + (s.duree_s || 0), 0), heures = Math.floor(sec / 3600);
    const duree = heures < 48 ? [String(heures), x.hours] : [String(Math.floor(heures / 24)), x.days];
    let vol = 0, volAn = 0;
    const mois = new Array(12).fill(0), an = new Date().getFullYear();
    for (const s of seances) {
      let v = 0;
      for (const e of s.donnees?.exercices ?? []) for (const se of e.series ?? []) if (se.fait !== false && se.type !== 'e') v += (se.kg ?? 0) * (se.r ?? 0);
      vol += v;
      const d = enDate(s.debut);
      if (d.getFullYear() === an) { mois[d.getMonth()] += 1; volAn += v; }
    }
    let meilleur = 0;
    for (let i = 1; i < 12; i += 1) if (mois[i] > mois[meilleur]) meilleur = i;
    return { total, duree, vol, volAn, mois, meilleur: mois[meilleur] ? meilleur : -1, seancesAn: mois.reduce((a, b) => a + b, 0), moisActifs: mois.filter((n) => n > 0).length };
  }, [seances, langue, profil.unite]);

  const souleve = (kg) => {
    const v = versAffichage(kg) ?? 0;
    if (v < 1000) return [String(Math.round(v)), unite()];
    const k = v / 1000;
    return [k >= 10 ? nombre(Math.round(k), 0) : nombre(k, 1), unite() === 'kg' ? 't' : `k ${unite()}`];
  };
  const poidsListe = etat.value.poids ?? [];
  const dernierPoids = poidsListe.length ? poidsListe[poidsListe.length - 1].kg : null;
  const niveau = 1 + Math.floor(stats.total / 10);
  const lev = souleve(stats.vol), levAn = souleve(stats.volAn);
  const pastilles = [
    ['barbell', String(stats.total), x.statWorkouts],
    ['timer', `${stats.duree[0]} ${stats.duree[1]}`, ''],
    ['trend-up', `${lev[0]} ${lev[1]}`, ''],
    ['medal', x.level(niveau), ''],
    ...(dernierPoids ? [['scales', `${nombre(versAffichage(dernierPoids), 1)} ${unite()}`, '']] : []),
  ];

  // Médailles (profileMedals) : celles épinglées depuis les récompenses, sinon gagnées d'abord puis à gagner.
  const toutes = useMemo(() => calculerDistinctions(seances, langue, etat.value.routines?.length ?? 0), [seances, langue, etat.value.routines]);
  const epinglees = lireModule('medaillesProfil');
  const ordre = useMemo(() => {
    const choisies = Array.isArray(epinglees) ? toutes.filter((m) => m.debloque && epinglees.includes(m.id)) : [];
    return choisies.length ? choisies : [...toutes.filter((m) => m.debloque), ...toutes.filter((m) => !m.debloque)];
  }, [toutes, epinglees]);
  const gagnees = toutes.filter((m) => m.debloque).length;
  const ouvrirMedaille = (m) => {
    const v = toutes.filter((d) => d.debloque).map((d) => d.id);
    setVues(v); ecrire(CLE_VUES, v);
    setFeuille({ medaille: m });
  };

  // Photos.
  const recentes = useMemo(() => [...moments].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 4), [moments]);
  const ouvrirSource = (genre) => { cible.current = genre; setFeuille(genre === 'moment' ? { source: 'moment' } : { ...feuille, source: genre }); };
  const lancer = (via) => {
    const el = (via === 'camera' ? camera : galerie).current;
    el.multiple = cible.current === 'moment' && via === 'galerie';
    el.click();
  };
  const recevoir = async (e) => {
    const fichiers = [...(e.target.files ?? [])];
    e.target.value = '';
    if (!fichiers.length || occupe) return;
    const genre = cible.current;
    setOccupe(true);
    try {
      if (genre === 'lecture') {
        // Code lu sur la photo : formulaire prérempli. Sinon, proposition d'enregistrer la photo telle quelle (_readCode).
        const r = await lireCodePhoto(fichiers[0]);
        if (!r.erreur) setEdition({ neuf: true, code: r.code, format: r.format });
        else afficher(r.erreur === 'none' ? x.passScanNone : x.gymPassNotFound, 'danger', { libelle: x.gymPassUsePicture, fn: () => passPhoto(fichiers[0]).catch(() => afficher(x.imageRefusee, 'danger')) });
      } else if (genre === 'pass') await passPhoto(fichiers[0]);
      else if (genre === 'banniere' || genre === 'photo') {
        const f = genre === 'banniere' ? await redimensionner(fichiers[0], 1600, 900, 0.82) : await redimensionner(fichiers[0], 512, 512, 0.8);
        await changerImage(genre, await importerImage(f), id[genre]);
      } else {
        const ajouts = [];
        for (const f of fichiers) ajouts.push({ id: await importerImage(await redimensionner(f, 1440, 1920, 0.88)), date: jourLocal(new Date()), quand: Date.now() });
        const suite = [...lirePhotos(), ...ajouts];
        ecrirePhotos(suite); setMoments(suite);
      }
    } catch { afficher(x.imageRefusee, 'danger'); } finally { setOccupe(false); }
  };
  const passPhoto = async (f) => setEdition({ neuf: true, code: await importerImage(await redimensionner(f, 1440, 1920, 0.88)), format: 'photo' });
  const choisirAjout = (v) => {
    setFeuille(null);
    if (v === 'type') return setEdition({ neuf: true, code: '', format: 'code128' });
    if (v === 'picture') { cible.current = 'pass'; return setFeuille({ source: 'pass' }); }
    cible.current = 'lecture';
    lancer(v === 'camera' ? 'camera' : 'galerie');
  };
  const apresSource = (via) => { const garde = feuille; setFeuille(garde && garde.edition ? { edition: true } : null); lancer(via); };

  // Pass salle.
  const sauverPasses = (l) => { ecrirePasses(l).catch(() => afficher(profilTextes[langue].saveFail, 'danger')); };
  const enregistrerPass = (p) => { sauverPasses(passes.some((q) => q.id === p.id) ? passes.map((q) => (q.id === p.id ? p : q)) : [...passes, p]); setEdition(undefined); };
  // removeGymPass : retiré tout de suite, « Annuler » le remet à sa place ; l'image d'un pass photo part après le délai.
  const supprimerPass = (pid) => {
    const k = passes.findIndex((q) => q.id === pid), p = passes[k];
    if (!p) return;
    const avant = passes;
    sauverPasses(passes.filter((q) => q.id !== pid)); setEdition(undefined);
    let annule = false;
    afficher(profilTextes[langue].gymPassDeleted, 'ok', { libelle: profilTextes[langue].undo, fn: () => { annule = true; sauverPasses(avant); } });
    if (p.format === 'photo') setTimeout(() => { if (!annule) supprimerImages([p.code]); }, 7000);
  };
  const deplacerPass = (pid, d) => {
    const k = passes.findIndex((q) => q.id === pid), j = k + d;
    if (k < 0 || j < 0 || j >= passes.length) return;
    const l = [...passes]; [l[k], l[j]] = [l[j], l[k]]; sauverPasses(l);
  };
  const montrerPass = (p) => { poserDernier(p.id); setVue(p); };

  // Année : barres des 12 mois.
  const pic = Math.max(1, ...stats.mois);
  const moisCourant = new Date().getMonth(), an = new Date().getFullYear();
  const initiale = (m) => new Intl.DateTimeFormat(langue, { month: 'narrow' }).format(new Date(2024, m, 1));
  const nomMois = (m) => { const s = new Intl.DateTimeFormat(langue, { month: 'long' }).format(new Date(2024, m, 1)); return s[0].toUpperCase() + s.slice(1); };
  const bloc = (valeur, unit, label) => <div class="pf-stat">
    <div class="pf-stat-val"><strong>{valeur}</strong>{unit && <span>{unit}</span>}</div>
    <small>{label}</small>
  </div>;

  return <main class="pf avec-nav">
    <header class="pf-tete" ref={tete}>
      <div class="pf-tete-in">
        <span class="pf-sonde" />
        <button type="button" class="pf-banniere" aria-label={x.changeCover} onClick={() => ouvrirSource('banniere')}>
          <span class="pf-banniere-img" style={{ backgroundImage: `url(${id.banniere ? urlMedia(id.banniere) : IMG_BANNIERE})` }} />
          <span class="pf-banniere-voile" />
        </button>
        <span class="pf-flou" aria-hidden="true" />
        <a class="pf-rond" href="#/reglages" aria-label={x.settings}><Ic n="gear-six" taille={18} /></a>
        <svg class="pf-poignee" width="44" height="18" viewBox="0 0 44 18" aria-hidden="true"><path d="M6 9 L22 9 L38 9" /></svg>
        <span class="pf-tete-avatar"><Avatar id={id} taille={AVATAR} /></span>
        <button type="button" class="pf-modifier" onClick={() => setFeuille({ edition: true })}><Ic n="pencil-simple" taille={12} />{x.editProfile}</button>
        <div class="pf-complet">
          <div class="pf-complet-nom"><h1>{id.nom}</h1><Badge id={id} taille={19} /></div>
          <p>@{id.pseudo}</p>
        </div>
        <div class="pf-compact"><Avatar id={id} taille={24} /><span>{id.nom}</span><Badge id={id} taille={14} /></div>
      </div>
    </header>

    <div class="pf-pastilles">
      {pastilles.map(([ic, val, lab]) => <span class="pf-pastille" key={ic}><Ic n={ic} taille={15} /><strong>{val}</strong>{lab && <span>{lab}</span>}</span>)}
    </div>

    <div class="pf-contenu">
      <Boite titre={x.awardsTitle} compte={gagnees} onPlus={() => { location.hash = '#/recompenses'; }}>
        <div class="pf-etagere">
          {ordre.map((m) => <button type="button" key={m.id} class="pf-medaille" aria-label={m.titre} onClick={() => ouvrirMedaille(m)}>
            <span class="pf-medaille-img"><IcMedaille id={m.id} verrou={!m.debloque} />{m.debloque && !vues.includes(m.id) && <i class="pf-neuf" />}</span>
            {m.debloque && <span class="pf-medaille-nom">{m.titre}</span>}
          </button>)}
        </div>
      </Boite>

      <div class="pf-bloc">
        <Titre titre={x.snapshots} compte={moments.length > 0 ? moments.length : null} onPlus={moments.length > 0 ? () => { location.hash = '#/photos'; } : null} />
        <button type="button" class="pf-photos pf-presse" aria-label={recentes.length ? x.photosCard : x.addPhoto}
          onClick={() => (recentes.length ? (location.hash = '#/photos') : ouvrirSource('moment'))}>
          {[0, 1, 2, 3].map((i) => <span key={i} class={`pf-cadre ${i >= recentes.length ? 'fantome' : ''}`} style={{ '--i': i, '--tour': `${TOURS[i]}rad`, top: i % 2 ? '12px' : '6px' }}>
            {i < recentes.length && <img src={urlMedia(recentes[i].id)} alt="" loading="lazy" decoding="async" />}
          </span>)}
          {recentes.length === 0 && <span class="pf-photos-ajout"><Ic n="camera" taille={16} />{x.addPhoto}</span>}
        </button>
      </div>

      {lireM13().passOn !== false && <Boite titre={x.gymPass} compte={passes.length > 1 ? passes.length : null} onPlus={() => setFeuille({ passes: true })}>
        <div class="pf-pass-zone">
          {passes.length === 0 ? <PassVide onClick={() => setFeuille({ ajoutPass: true })} /> : <Carrousel passes={passes} nomMembre={id.nom} montrer={montrerPass} />}
        </div>
      </Boite>}

      <Boite titre={x.historyTitle} compte={seances.length ? seances.length : null} onPlus={seances.length ? () => { location.hash = '#/historique'; } : null}>
        <div class="pf-annee">
          <div class="pf-stats">
            {bloc(String(stats.seancesAn), '', x.statWorkouts)}
            {bloc(levAn[0], levAn[1], x.statLifted)}
            {bloc(String(stats.moisActifs), '/12', x.yearMonths)}
          </div>
          <div class="pf-barres">
            {stats.mois.map((n, m) => <button type="button" key={m} class={`pf-barre ${m === moisCourant ? 'courant' : n > 0 ? 'actif' : ''}`} disabled={n === 0} aria-label={`${nomMois(m)}${dp()}${n}`}
              onClick={() => { location.hash = `#/historique?mois=${an}-${String(m + 1).padStart(2, '0')}`; }}>
              <span class="pf-tige" style={{ height: monte ? `${6 + 52 * (n / pic)}px` : '6px', transitionDuration: `${650 + (m + 1) * 35}ms` }} />
            </button>)}
          </div>
          <div class="pf-initiales">{stats.mois.map((_, m) => <span key={m} class={m === moisCourant ? 'courant' : ''}>{initiale(m)}</span>)}</div>
          {stats.meilleur >= 0 && <p class="pf-meilleur">{x.yearBestMonth} · <strong>{nomMois(stats.meilleur)}</strong></p>}
        </div>
      </Boite>
    </div>

    <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={recevoir} />
    <input ref={galerie} type="file" accept="image/*" hidden onChange={recevoir} />

    {feuille?.edition && <FicheProfil fermer={() => setFeuille(null)} choisirImage={(g) => ouvrirSource(g)} />}
    {feuille?.source && <ChoixPhoto pass={feuille.source === 'pass'} fermer={() => setFeuille(feuille.edition ? { edition: true } : null)} choisir={apresSource} />}
    {feuille?.medaille && <FicheMedaille m={feuille.medaille} fermer={() => setFeuille(null)} />}
    {feuille?.passes && edition === undefined && !vue && <ListePasses passes={passes} nomMembre={id.nom} fermer={() => setFeuille(null)} montrer={montrerPass} editer={setEdition} ajouter={() => setFeuille({ ajoutPass: true })} deplacer={deplacerPass} supprimer={supprimerPass} />}
    {feuille?.ajoutPass && <ChoixAjoutPass fermer={() => setFeuille(null)} choisir={choisirAjout} />}
    {edition !== undefined && <EditeurPass pass={edition} rang={passes.length} fermer={() => setEdition(undefined)} enregistrerPass={enregistrerPass} supprimerPass={supprimerPass} />}
    {vue && <VuePass pass={vue} nomMembre={id.nom} fermer={() => setVue(null)} />}
  </main>;
}
