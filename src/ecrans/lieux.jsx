// Lieux et matériel, porté de GymMane (lib/screens/places_screen.dart, lib/state/places_state.dart).
// Les lieux vivent sur le compte (extensions.modules.lieux) ; ceux d'avant, gardés dans le navigateur, sont repris une fois.
import { EQUIPEMENT_PAR_ID } from '../categories-exercices.js';
import { useEffect, useState } from 'preact/hooks';
import { computed } from '@preact/signals';
import { afficher, ecrireModule, lireModule, nombre, tousExercices, unite, versAffichage, versKg } from '../donnees.js';
import { langue, dp } from '../i18n.js';
import { Dialogue, EnTete, Feuille, Ic } from '../ui.jsx';
import { textes } from '../i18n/m13.js';
import './m13.css';

const CLE_ANCIENNE = 'an_m13_lieux';
const CLE_ANCIEN_ACTIF = 'an_m13_lieu_actif';
const MATERIELS = ['barre', 'halteres', 'poulie', 'machine', 'poids-du-corps', 'lest', 'elastique', 'kettlebell', 'anneaux', 'autre'];
// kPlacePresetGear de GymMane : Salle de sport (tout), Maison, Extérieur.
const PRESETS = {
  gym: MATERIELS,
  home: ['poids-du-corps', 'halteres', 'kettlebell', 'elastique', 'lest'],
  outdoors: ['poids-du-corps', 'elastique'],
};
const DISQUES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];
const DISQUES_LB = [45, 35, 25, 10, 5, 2.5];
const HALTERES_KG = [1, 2, 2.5, 3, 4, 5, 6, 7, 7.5, 8, 9, 10, 12, 12.5, 14, 15, 16, 17.5, 18, 20, 22, 22.5, 24, 25, 26, 27.5, 28, 30, 32, 32.5, 34, 35, 36, 37.5, 40, 42.5, 45, 47.5, 50];
const HALTERES_LB = [5, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100];

const arrondi3 = (n) => Math.round(n * 1000) / 1000;
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const normaliser = (l) => ({
  id: String(l.id),
  nom: String(l.nom ?? '').slice(0, 60),
  equip: Array.isArray(l.equip) ? l.equip.map(String) : [],
  barre: num(l.barre),
  disques: l.disques && typeof l.disques === 'object' && !Array.isArray(l.disques) ? l.disques : {},
  halteres: Array.isArray(l.halteres) ? l.halteres.map(Number).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b) : [],
});

const donnees = computed(() => {
  const v = lireModule('lieux');
  return {
    liste: Array.isArray(v?.liste) ? v.liste.filter((l) => l && l.id).map(normaliser) : [],
    actif: typeof v?.actif === 'string' ? v.actif : '',
    repris: Array.isArray(v?.repris) ? v.repris.map(String) : null,
  };
});

/** Écrit la liste des lieux sur le compte. Vrai si le serveur l'a gardée. */
async function enregistrerDonnees(suivant) {
  try {
    await ecrireModule('lieux', suivant);
    return true;
  } catch {
    afficher(textes[langue].lieux.erreur, 'danger');
    return false;
  }
}
const maj = (fn) => {
  const d = donnees.value;
  return enregistrerDonnees(fn({ liste: d.liste.map((l) => ({ ...l, equip: [...l.equip], halteres: [...l.halteres], disques: { ...l.disques } })), actif: d.actif, repris: d.repris ?? [] }));
};
const majLieu = (id, fn) => maj((d) => ({ ...d, liste: d.liste.map((l) => (l.id === id ? fn(l) : l)) }));

let repriseEnCours = null;
/** Reprend les lieux d'avant (écran Lieux simplifié, onboarding), gardés dans le navigateur. L'original reste en place ; un lieu repris puis supprimé ne revient pas. */
function reprendreAnciens() {
  repriseEnCours ??= (async () => {
    let anciens;
    try { anciens = JSON.parse(localStorage.getItem(CLE_ANCIENNE)); } catch { return; }
    if (!Array.isArray(anciens) || !anciens.length) return;
    const d = donnees.value;
    const deja = new Set([...d.liste.map((l) => l.id), ...(d.repris ?? [])]);
    const neufs = anciens.filter((l) => l && l.id && !deja.has(String(l.id)));
    if (!neufs.length) return;
    let ancienActif = '';
    try { ancienActif = localStorage.getItem(CLE_ANCIEN_ACTIF) || ''; } catch { /* stockage privé */ }
    const liste = neufs.map((l) => normaliser({ id: l.id, nom: l.nom, equip: l.equip, barre: num(l.barrePoids) && l.barrePoids !== 20 ? l.barrePoids : null }));
    const reprisAvant = d.repris === null;
    await enregistrerDonnees({
      liste: [...d.liste, ...liste],
      actif: d.actif || (reprisAvant && liste.some((l) => l.id === ancienActif) ? ancienActif : ''),
      repris: [...(d.repris ?? []), ...neufs.map((l) => String(l.id))],
    });
  })().finally(() => { repriseEnCours = null; });
  return repriseEnCours;
}

const materielDe = (equip) => {
  const gear = new Set([...equip, 'poids-du-corps']);
  if (gear.has('barre')) { gear.add('barre-ez'); gear.add('smith'); }
  return gear;
};
// Matériel du lieu pour un exercice : anneaux et lesté de l'original (fitsHere), sinon le matériel du catalogue.
const materielLieu = (e) => ({ anneaux: 'anneaux', leste: 'lest' })[EQUIPEMENT_PAR_ID[e.id]] ?? e.materiel;
const compteExercices = (equip) => tousExercices.value.filter((e) => materielDe(equip).has(materielLieu(e))).length;

/** Lieu actif (null = partout), lu sur le compte. */
export const lieuActif = () => {
  const { liste, actif } = donnees.value;
  return liste.find((l) => l.id === actif) ?? null;
};
/** Lieux enregistrés sur le compte. */
export const tousLieux = () => donnees.value.liste;
/** Choisit le lieu actif ('' = partout). */
export const choisirLieu = (id) => maj((d) => ({ ...d, actif: id }));
/** Miroir de fitsHere de GymMane : sans lieu actif tout passe ; sinon le matériel du lieu (poids du corps toujours) ou un exercice perso. */
export const ajusteIci = (e) => {
  const l = lieuActif();
  return !l || Boolean(e.perso) || materielDe(l.equip).has(materielLieu(e));
};
export { reprendreAnciens };

const nouvelId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const barreParDefaut = () => (unite() === 'lb' ? 45 : 20);
const fmt = (n) => nombre(n, 2);

function Pas({ valeur, moins, plus, label, large = false }) {
  const x = textes[langue].lieux;
  return <div class={`m13-pas ${large ? 'large' : ''}`}>
    <button type="button" aria-label={`${x.moins}${dp()}${label}`} onClick={moins}><Ic n="minus:bold" taille={13} /></button>
    <output aria-label={label}>{valeur}</output>
    <button type="button" aria-label={`${x.plus}${dp()}${label}`} onClick={plus}><Ic n="plus:bold" taille={13} /></button>
  </div>;
}

// ---------- Feuille « Disques et barre » (_editPlates) ----------
function FeuilleDisques({ id, fermer }) {
  const x = textes[langue].lieux;
  const lieu = donnees.value.liste.find((l) => l.id === id);
  if (!lieu) return null;
  const lb = unite() === 'lb';
  const tailles = lb ? DISQUES_LB : DISQUES_KG;
  const pas = lb ? 5 : 2.5;
  const barre = lieu.barre === null ? barreParDefaut() : versAffichage(lieu.barre);
  const reglerBarre = (v) => majLieu(id, (l) => ({ ...l, barre: arrondi3(Math.min(60, Math.max(1, versKg(v)))) }));
  const paires = (taille) => {
    const kg = String(versKg(taille));
    return Number(lieu.disques[kg]) || 0;
  };
  const reglerPaires = (taille, n) => majLieu(id, (l) => {
    const disques = { ...l.disques };
    const cle = String(versKg(taille));
    if (n <= 0) delete disques[cle]; else disques[cle] = Math.min(20, n);
    return { ...l, disques };
  });
  const possede = Object.keys(lieu.disques).length > 0;
  return <Feuille ouverte fermer={fermer} titre={x.disquesBarre} sous={lieu.nom} sansFocus
    pied={<button type="button" class="btn pri large" onClick={fermer}>{x.termine}</button>}>
    <div class="m13-ligne-pas">
      <span class="m13-etiquette">{x.poidsBarre}</span>
      <Pas large label={x.poidsBarre} valeur={`${fmt(barre)} ${unite()}`} moins={() => reglerBarre(barre - pas)} plus={() => reglerBarre(barre + pas)} />
    </div>
    <div class="m13-etiquette-tete">
      <span class="m13-etiquette">{x.paires}</span>
      {possede && <button type="button" class="m13-lien" onClick={() => majLieu(id, (l) => ({ ...l, disques: {}, barre: null }))}>{x.toutDispo}</button>}
    </div>
    <div class="m13-disques">
      {tailles.map((taille) => <div class="m13-ligne-pas" key={taille}>
        <span class="m13-ligne-nom">{fmt(taille)} {unite()}</span>
        <Pas label={`${fmt(taille)} ${unite()}`} valeur={paires(taille)} moins={() => reglerPaires(taille, paires(taille) - 1)} plus={() => reglerPaires(taille, paires(taille) + 1)} />
      </div>)}
    </div>
  </Feuille>;
}

// ---------- Feuille « Haltères » (_editDumbbells) ----------
function FeuilleHalteres({ id, fermer }) {
  const x = textes[langue].lieux;
  const [autre, setAutre] = useState(false);
  const [saisie, setSaisie] = useState('');
  const lieu = donnees.value.liste.find((l) => l.id === id);
  if (!lieu) return null;
  const lb = unite() === 'lb';
  const possedes = lieu.halteres.map((kg) => Math.round(versAffichage(kg) * 100) / 100);
  const tailles = [...new Set([...(lb ? HALTERES_LB : HALTERES_KG), ...possedes])].sort((a, b) => a - b);
  const bascule = (taille) => majLieu(id, (l) => {
    const kg = arrondi3(versKg(taille));
    const at = l.halteres.findIndex((v) => Math.abs(v - kg) < 0.05);
    const liste = [...l.halteres];
    if (at >= 0) liste.splice(at, 1); else liste.push(kg);
    return { ...l, halteres: liste.sort((a, b) => a - b) };
  });
  const ajouterAutre = () => {
    const v = Number(saisie.replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0 || v > 500) { afficher(x.autrePoidsAide, 'danger'); return; }
    if (!possedes.some((p) => Math.abs(p - v) < 0.05)) bascule(v);
    setSaisie('');
    setAutre(false);
  };
  if (autre) return <Feuille ouverte fermer={() => setAutre(false)} titre={x.autrePoids}
    pied={<button type="button" class="btn pri large" onClick={ajouterAutre}>{x.enregistrer}</button>}>
    <form onSubmit={(e) => { e.preventDefault(); ajouterAutre(); }}>
      <label class="label" for="lieu-haltere">{`${x.autrePoidsAide} (${unite()})`}</label>
      <input id="lieu-haltere" class="form-input" inputMode="decimal" value={saisie} onInput={(e) => setSaisie(e.target.value)} />
    </form>
  </Feuille>;
  return (
    <Feuille ouverte fermer={fermer} titre={x.halteresTitre} sous={x.aideHalteres} sansFocus
      pied={<button type="button" class="btn pri large" onClick={fermer}>{x.termine}</button>}>
      <div class="m13-puces">
        {tailles.map((taille) => {
          const on = possedes.some((p) => Math.abs(p - taille) < 0.05);
          return <button type="button" key={taille} class={`m13-puce ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => bascule(taille)}>{fmt(taille)}</button>;
        })}
        <button type="button" class="m13-puce plus" aria-label={x.autrePoids} onClick={() => setAutre(true)}><Ic n="plus:bold" taille={13} /></button>
      </div>
      {lieu.halteres.length > 0 && <button type="button" class="m13-lien centre" onClick={() => majLieu(id, (l) => ({ ...l, halteres: [] }))}>{x.toutDispo}</button>}
    </Feuille>
  );
}

// ---------- Nom du lieu (_rename) ----------
function FeuilleNom({ lieu, fermer, valider }) {
  const x = textes[langue].lieux;
  const [nom, setNom] = useState(lieu?.nom ?? '');
  const [occupe, setOccupe] = useState(false);
  const ok = nom.trim().length > 0 && !occupe;
  const envoyer = async () => {
    if (!ok) return;
    setOccupe(true);
    const fait = await valider(nom.trim());
    setOccupe(false);
    if (fait) fermer();
  };
  return <Feuille ouverte fermer={fermer} titre={lieu ? x.renommer : x.nouveau}
    pied={<button type="button" class="btn pri large" disabled={!ok} onClick={envoyer}>{x.enregistrer}</button>}>
    <form onSubmit={(e) => { e.preventDefault(); envoyer(); }}>
      <label class="label" for="lieu-nom">{x.nouveau}</label>
      <input id="lieu-nom" class="form-input" maxLength={60} placeholder={x.placeholderNom} value={nom} onInput={(e) => setNom(e.target.value)} />
    </form>
  </Feuille>;
}

function Puce({ id, lieu, verrou }) {
  const x = textes[langue].lieux;
  const on = lieu.equip.includes(id) || id === 'poids-du-corps';
  const basculer = () => majLieu(lieu.id, (l) => ({ ...l, equip: l.equip.includes(id) ? l.equip.filter((e) => e !== id) : [...l.equip, id] }));
  return <button type="button" class={`m13-gear ${on ? 'on' : ''}`} aria-pressed={on} disabled={verrou} onClick={basculer}>
    <Ic n={on ? 'check:bold' : 'plus:bold'} taille={10} />{x.equip[id]}
  </button>;
}

function LigneStock({ icone, nom, valeur, onClick }) {
  return <button type="button" class="m13-stock" onClick={onClick}>
    <Ic n={icone} taille={17} /><span class="m13-stock-nom">{nom}</span><span class="m13-stock-val">{valeur}</span><Ic n="caret-right" taille={14} classe="m13-stock-fin" />
  </button>;
}

function CarteLieu({ lieu, actif, onChoisir, onNom, onSupprimer, onDisques, onHalteres }) {
  const x = textes[langue].lieux;
  const n = compteExercices(lieu.equip);
  const nbDisques = Object.keys(lieu.disques).length;
  return <article class={`m13-lieu ${actif ? 'actif' : ''}`}>
    <div class="m13-lieu-tete">
      <button type="button" class={`m13-coche ${actif ? 'on' : ''}`} aria-pressed={actif} aria-label={`${x.choisir}${dp()}${lieu.nom}`} onClick={onChoisir}><span>{actif && <Ic n="check:bold" taille={14} />}</span></button>
      <button type="button" class="m13-lieu-corps" onClick={onChoisir}>
        <span class="m13-lieu-nom">{lieu.nom}</span>
        <span class="m13-lieu-etat">{actif ? `${x.ici} · ${x.exercices(n)}` : `${x.exercices(n)} · ${x.toucher}`}</span>
      </button>
      <button type="button" class="m13-lieu-icone" aria-label={`${x.renommer}${dp()}${lieu.nom}`} onClick={onNom}><Ic n="pencil-simple" taille={16} /></button>
      <button type="button" class="m13-lieu-icone" aria-label={`${x.supprimer}${dp()}${lieu.nom}`} onClick={onSupprimer}><Ic n="trash" taille={16} /></button>
    </div>
    <div class="m13-lieu-pied">
      <span class="m13-etiquette">{x.materiel}</span>
      <div class="m13-gears">{MATERIELS.map((id) => <Puce key={id} id={id} lieu={lieu} verrou={id === 'poids-du-corps'} />)}</div>
      {lieu.equip.includes('barre') && <LigneStock icone="circles-three" nom={x.disquesBarre} valeur={nbDisques ? x.tailles(nbDisques) : x.toutDispo} onClick={onDisques} />}
      {lieu.equip.includes('halteres') && <LigneStock icone="barbell" nom={x.halteresTitre} valeur={lieu.halteres.length ? x.tailles(lieu.halteres.length) : x.toutDispo} onClick={onHalteres} />}
    </div>
  </article>;
}

export function Lieux() {
  const x = textes[langue].lieux;
  const { liste, actif } = donnees.value;
  const lieuActif = liste.find((l) => l.id === actif) ?? null;
  const [nom, setNom] = useState(null); // null fermé, {} nouveau, lieu à renommer
  const [suppr, setSuppr] = useState(null);
  const [disques, setDisques] = useState('');
  const [halteres, setHalteres] = useState('');
  useEffect(() => { reprendreAnciens(); }, []);

  const choisir = (id) => maj((d) => ({ ...d, actif: d.actif === id ? '' : id }));
  const ajouter = async (nomLieu, equip = ['poids-du-corps']) => {
    const id = nouvelId();
    return maj((d) => ({ ...d, liste: [...d.liste, normaliser({ id, nom: nomLieu, equip })], actif: id }));
  };
  const retirer = (id) => maj((d) => ({ ...d, liste: d.liste.filter((l) => l.id !== id), actif: d.actif === id ? '' : d.actif }));

  return <main class="ecran avec-nav">
    <EnTete titre={x.titre} retour="#/reglages" sous={lieuActif ? x.actifA(lieuActif.nom) : x.partout} />
    <p class="m13-lieux-aide">{x.aide}</p>

    {liste.length === 0 && <section class="carte m13-lieux-vide">
      <strong>{x.videTitre}</strong>
      <p>{x.videTexte}</p>
      <div class="m13-presets">
        {Object.keys(PRESETS).map((p) => <button type="button" key={p} onClick={() => ajouter(x.presets[p], PRESETS[p])}>{x.presets[p]}</button>)}
      </div>
    </section>}

    <div class="m13-lieux">
      {liste.map((l) => <CarteLieu key={l.id} lieu={l} actif={l.id === actif}
        onChoisir={() => choisir(l.id)} onNom={() => setNom(l)} onSupprimer={() => setSuppr(l)}
        onDisques={() => setDisques(l.id)} onHalteres={() => setHalteres(l.id)} />)}
    </div>

    <button type="button" class="m13-lieu-nouveau" onClick={() => setNom({})}><Ic n="plus" taille={16} /><span>{x.nouveau}</span></button>

    {nom && <FeuilleNom lieu={nom.id ? nom : null} fermer={() => setNom(null)}
      valider={(n) => (nom.id ? majLieu(nom.id, (l) => ({ ...l, nom: n })) : ajouter(n))} />}
    {disques && <FeuilleDisques id={disques} fermer={() => setDisques('')} />}
    {halteres && <FeuilleHalteres id={halteres} fermer={() => setHalteres('')} />}
    <Dialogue ouvert={!!suppr} fermer={() => setSuppr(null)} titre={x.supprimerTitre} texte={x.supprimerTexte} libelle={x.supprimer} danger
      confirmer={async () => { if (suppr) await retirer(suppr.id); setSuppr(null); }} />
  </main>;
}
