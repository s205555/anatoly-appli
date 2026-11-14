// Écran Meal prep (M10) : étagère de fournées, éditeur d'ingrédients, journal d'une fournée.
import { useEffect, useState } from 'preact/hooks';
import { afficher } from '../../donnees.js';
import { Ic, Feuille, Nombre, Vide, EnTete, Segment, Dialogue } from '../../ui.jsx';
import { m10 } from '../../i18n/m10.js';
import {
  version, photoAliment, entreeDepuisAliment,
  REPAS, lots, lotParId, macrosLot, poidsCru, poidsTotal, par100,
  sauverLot, supprimerLot, modifierLot, noterDepuisLot, macrosEntree,
  nouvelId, jourSemaine, jourDecale,
} from './etat.js';
import { PaletteAliments } from './plans.jsx';
import { Assiette } from './gm.jsx';
import './m10.css';

const photoLot = (lot) => {
  const slug = lot.elements[0]?.alimentId;
  return slug ? photoAliment(slug) : '/statique/nutrition/2-milk.webp';
};

export function Prep() {
  const t = m10();
  const [, force] = useState(0);
  useEffect(() => version.subscribe(() => force((x) => x + 1)), []);
  const [editeur, setEditeur] = useState(null);
  const [journal, setJournal] = useState(null);
  const [supprimerId, setSupprimerId] = useState(null);
  const tous = lots();

  return <main class="ecran m10">
    <EnTete titre={t.titrePrep} retour="#/" actions={<button class="btn pri petit" type="button" onClick={() => setEditeur({ lot: null })}><Ic n="plus" taille={14} />{t.nouvelleFournee}</button>} />
    <p class="muted" style="font-size:13px;margin-top:-6px">{t.prepAide}</p>

    {tous.length ? (
      <div class="m10-etagere" role="list" aria-label={t.titrePrep}>
        {tous.map((b) => <FicheFournee key={b.id} lot={b} seule={tous.length === 1} surOuvrir={() => setJournal(b)} surModifier={() => setEditeur({ lot: b })} surSupprimer={() => setSupprimerId(b.id)} />)}
      </div>
    ) : (
      <button class="gm-prep-vide" type="button" onClick={() => setEditeur({ lot: null })}>
        <Assiette taille={64} items={['rice', 'chicken-breast', 'broccoli'].map((s) => ({ src: photoAliment(s), nom: s }))} />
        <p>{t.prepVide}</p>
      </button>
    )}

    {editeur && <EditeurFournee lot={editeur.lot} fermer={() => setEditeur(null)} />}
    {journal && <JournalFournee lot={journal} fermer={() => setJournal(null)} />}
    {supprimerId && <Dialogue ouvert={!!supprimerId} fermer={() => setSupprimerId(null)} titre={t.supprimer} texte={t.supprimerPlanTexte} confirmer={() => { supprimerLot(supprimerId); afficher(t.planEnregistre); }} libelle={t.supprimer} danger />}
  </main>;
}

function FicheFournee({ lot, seule, surOuvrir, surModifier, surSupprimer }) {
  const t = m10();
  const macros = macrosLot(lot);
  const total = poidsTotal(lot);
  const part = total > 0 ? lot.reste / total : 0;
  return <div class={`m10-fournee ${seule ? 'seule' : ''}`} role="listitem" onClick={surOuvrir}>
    <Assiette taille={46} items={(lot.elements ?? []).slice(0, 5).map((e) => ({ src: photoAliment(e.alimentId), nom: e.nom ?? '' }))} />
    <strong>{lot.nom}</strong>
    <small>{Math.round(macros.k)} {t.kcal} · {Math.round(lot.reste)} / {Math.round(total)} g</small>
    <span class="m10-barre"><i style={{ width: `${Math.max(0, Math.min(1, part)) * 100}%` }} /></span>
    <div style="display:flex;gap:6px;margin-top:auto">
      <button class="btn petit" type="button" aria-label={t.supprimer} onClick={(e) => { e.stopPropagation(); surSupprimer(); }}><Ic n="trash" taille={14} /></button>
      <button class="btn petit" type="button" aria-label={t.modifierFournee} onClick={(e) => { e.stopPropagation(); surModifier(); }}><Ic n="pencil-simple" taille={14} /></button>
    </div>
  </div>;
}

function EditeurFournee({ lot, fermer }) {
  const t = m10();
  const [nom, setNom] = useState(lot?.nom ?? '');
  const [poidsCuit, setPoidsCuit] = useState(lot?.poidsCuit ?? null);
  const [elements, setElements] = useState(lot?.elements ?? []);
  const [palette, setPalette] = useState(null);
  const id = lot?.id ?? nouvelId();
  const estNeuf = !lot;
  const totalCru = poidsCru({ elements });
  const total = poidsCuit > 0 ? poidsCuit : totalCru;
  const macros = macrosLot({ elements });

  const enregistrer = () => {
    if (!elements.length || !(total > 0)) { afficher(t.poidsRequis, 'danger'); return; }
    sauverLot({ id, nom: nom.trim() || t.fourneeDefaut, elements, poidsCuit, reste: total });
    afficher(t.planEnregistre);
    fermer();
  };

  const ajouter = (liste) => {
    const arr = Array.isArray(liste) ? liste : [liste];
    setElements((e) => [...e, ...arr.map((x) => ({ ...x, id: nouvelId() }))]);
    setPalette(null);
  };

  return <>
    <Feuille ouverte large fermer={fermer} titre={estNeuf ? t.nouvelleFournee : t.modifierFournee}
      pied={<>
        <button class="btn pri large" type="button" onClick={enregistrer}>{t.enregistrer}</button>
      </>}>
      <label class="champ">
        <input class="form-input" value={nom} placeholder={t.nomFournee} onInput={(e) => setNom(e.target.value)} />
      </label>

      <div class="m10-macros">
        <div class="m10-stat k"><strong>{Math.round(macros.k)}</strong><small>{t.kcal}</small></div>
        <div class="m10-stat p"><strong>{Math.round(macros.p)}</strong><small><span class="m10-dot" />{t.proteines}</small></div>
        <div class="m10-stat c"><strong>{Math.round(macros.c)}</strong><small><span class="m10-dot" />{t.glucides}</small></div>
        <div class="m10-stat f"><strong>{Math.round(macros.f)}</strong><small><span class="m10-dot" />{t.lipides}</small></div>
      </div>

      <label class="champ">
        <Nombre valeur={poidsCuit} onChange={setPoidsCuit} label={t.poidsCuit} decimales={false} placeholder={t.poidsCuitAide(totalCru)} />
      </label>

      <div class="champ">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <p class="kicker">{t.ingredients}</p>
          <button class="btn lien petit" type="button" onClick={() => setPalette({})}><Ic n="plus" taille={14} />{t.ajouterIngredient}</button>
        </div>
        {elements.map((e) => (
          <div class="m10-element" key={e.id}>
            <img src={photoAliment(e.alimentId)} alt="" loading="lazy" />
            <span><strong>{e.nom}</strong><small>{Math.round(e.grammes)} g · {Math.round(macrosEntree(e).k)} {t.kcal}</small></span>
            <button type="button" aria-label={t.retirer} onClick={() => setElements(elements.filter((x) => x.id !== e.id))}><Ic n="x" taille={16} /></button>
          </div>
        ))}
        {!elements.length && <p class="muted" style="font-size:13px;text-align:center;padding:8px 0">{t.ajouterIngredient}</p>}
      </div>
    </Feuille>

    {palette !== null && <PaletteAliments ouverte fermer={() => setPalette(null)} surAjout={ajouter} />}
  </>;
}

function JournalFournee({ lot, fermer }) {
  const t = m10();
  const [mode, setMode] = useState('portions');
  const [portions, setPortions] = useState(2);
  const [pct, setPct] = useState(50);
  const [grammes, setGrammes] = useState(100);
  const [repas, setRepas] = useState('dejeuner');
  const [jour, setJour] = useState(0); // -1 hier, 0 aujourd'hui, 1 demain
  const [editeur, setEditeur] = useState(false);
  const courant = lotParId(lot.id) ?? lot; // rafraîchi après chaque notation
  const macros = macrosLot(courant);
  const total = poidsTotal(courant);
  const p100 = par100(courant);
  const part = total > 0 ? courant.reste / total : 0;
  const fini = courant.reste <= 0;

  const calculerG = () => {
    if (mode === 'portions') return Math.min(Math.round(total / portions), courant.reste);
    if (mode === 'pct') return Math.min(Math.round((total * pct) / 100), courant.reste);
    return Math.min(grammes, courant.reste);
  };
  const g = calculerG();

  const noter = () => {
    if (!(g > 0)) return;
    noterDepuisLot(courant, g, repas, jourDecale(jour));
    afficher(t.noterNote(`${g} g`));
  };

  const jourJours = [-1, 0, 1];

  return <>
    <Feuille ouverte large fermer={fermer} titre={courant.nom}
      pied={<>
        <button class="btn secondaire" type="button" onClick={() => setEditeur(true)}>{t.modifierFournee}</button>
        <button class="btn pri large" type="button" disabled={fini || !(g > 0)} onClick={noter}>{t.noterMontant(`${g} g`)}</button>
      </>}>
      <span class="m10-plat" style="background:none;display:grid;place-items:center"><Assiette taille={128} items={(courant.elements ?? []).slice(0, 5).map((e) => ({ src: photoAliment(e.alimentId), nom: e.nom ?? '' }))} /></span>
      <div class="m10-journal-info">
        <strong>{fini ? t.fourneeTerminee : t.resteSur(Math.round(courant.reste), Math.round(total))}</strong>
        <small>{Math.round(p100.k)} {t.kcal} · P {Math.round(p100.p)} · G {Math.round(p100.c)} · L {Math.round(p100.f)} {t.pour100('g')}</small>
      </div>
      <span class="m10-barre"><i style={{ width: `${Math.max(0, Math.min(1, part)) * 100}%` }} /></span>

      <Segment options={[['portions', t.portions], ['pct', t.partDuReste], ['grammes', t.quantite]]} valeur={mode} onChange={setMode} label={t.quantite} />

      {mode === 'portions' && <div class="puces" role="group" aria-label={t.portions}>
        {[2, 3, 4, 5, 6].map((v) => (
          <button key={v} type="button" class="puce" aria-pressed={portions === v} onClick={() => setPortions(v)}>{v}</button>
        ))}
      </div>}

      {mode === 'pct' && <div class="puces" role="group" aria-label={t.partDuReste}>
        {[10, 25, 33, 50, 66, 75, 100].map((v) => (
          <button key={v} type="button" class="puce" aria-pressed={pct === v} onClick={() => setPct(v)}>{v}%</button>
        ))}
      </div>}

      {mode === 'grammes' && <div class="m10-pesee">
        <div class="stepper" style="justify-content:center">
          <button type="button" aria-label="−25 g" onClick={() => setGrammes(Math.max(5, grammes - 25))}><Ic n="minus" taille={18} /></button>
          <output aria-live="polite" style="font-size:20px;font-weight:800;min-width:56px">{Math.min(grammes, courant.reste)} g</output>
          <button type="button" aria-label="+25 g" onClick={() => setGrammes(Math.min(courant.reste, grammes + 25))}><Ic n="plus" taille={18} /></button>
        </div>
        <Nombre valeur={grammes} onChange={setGrammes} label={t.quantiteUnite('g')} decimales={false} />
        <button class="btn pri large" type="button" onClick={() => { if (Number.isFinite(grammes) && grammes >= 0) { modifierLot(courant.id, { reste: Math.min(total, grammes) }); afficher(t.poidsMisAJour); } }}>{t.peserReste}</button>
      </div>}

      <Segment options={REPAS.map((r) => [r, t[r]])} valeur={repas} onChange={setRepas} label={t.pourQuelRepas} />

      <div class="m10-chips" role="group" aria-label={t.pourQuelJour}>
        {jourJours.map((j) => {
          const label = j === -1 ? t.hier : j === 1 ? t.demain : t.aujourdHui;
          const on = jour === j;
          return <button key={j} type="button" class={`m10-chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setJour(j)}>{label}</button>;
        })}
      </div>

      {editeur && <EditeurFournee lot={courant} fermer={() => setEditeur(false)} />}
    </Feuille>
  </>;
}
