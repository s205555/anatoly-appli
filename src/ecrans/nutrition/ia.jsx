// Feuille « Repas avec l'IA » (portage de GymMane lib/screens/nutrition/ai.dart, GPLv3).
// 1. Demander : cible, goûts, notes, nombre d'options, demande copiée. 2. Coller : réponse lue, aliments à cocher, ajout au journal.
import { useMemo, useState } from 'preact/hooks';
import { afficher, nombre } from '../../donnees.js';
import { langue } from '../../i18n.js';
import { T } from '../../i18n/m09.js';
import { STYLES_IA, TIA } from '../../i18n/ia-repas.js';
import { Feuille, Ic } from '../../ui.jsx';
import { catalogue, getObjectifs, getRepasJour, jourLocal, nutritionStore } from './aliments.jsx';
import { macrosJour } from './store.js';
import { nouvelId, noterEntrees, sauverPlan, sauverRecette } from './etat.js';
import { PHRASE_RELANCE, choisis, ciblesIA, demandeIA, lireReponseIA, mettreA, resoudreIA, totalOption, utilisable } from './ia-repas.js';

// Repas : id de la demande, clé du jour, clé des plans.
const REPAS = [
  { id: 'breakfast', jour: 'petit-dejeuner', m10: 'petitDejeuner', nom: () => T().petitDejeuner },
  { id: 'lunch', jour: 'dejeuner', m10: 'dejeuner', nom: () => T().dejeuner },
  { id: 'dinner', jour: 'diner', m10: 'diner', nom: () => T().diner },
  { id: 'snacks', jour: 'collations', m10: 'collations', nom: () => T().collations },
];
const parId = (id) => REPAS.find((r) => r.id === id) ?? REPAS[3];

// Gardés entre deux ouvertures, comme les champs statiques de GymMane.
let notesGardees = '';
const stylesGardes = new Set();

function bibliotheque() {
  const out = [];
  for (const a of catalogue.value.values()) {
    out.push({ id: a.id, noms: [langue === 'en' ? a.nomEn : a.nomFr, a.nomEn], g100: { k: a.kcal, p: a.p, c: a.c, l: a.l, fibres: a.f }, portion: a.gPortion || 0, liquide: !!a.liq, rendement: a.rendement || 0 });
  }
  return out;
}
const persos = () => Object.entries(nutritionStore.value.alimentsPerso || {}).map(([id, a]) => ({
  id, perso: true, noms: [a.nom], g100: { k: a.kcal || 0, p: a.p || 0, c: a.c || 0, l: a.l || 0, fibres: a.f || 0 }, portion: a.gPortion || 0, liquide: false, rendement: 0,
}));

const kcalTxt = (k) => `${nombre(Math.round(k), 0)} kcal`;

function Pas({ valeur, moins, plus, label, large = 86 }) {
  return <div class="stepper ia-pas">
    <button type="button" aria-label={`${label} -`} onClick={moins}>−</button>
    <output aria-live="polite" style={`min-width:${large}px`}>{valeur}</output>
    <button type="button" aria-label={`${label} +`} onClick={plus}>+</button>
  </div>;
}

export function FeuilleIA({ ouvert, fermer, repasCible }) {
  const X = TIA();
  const repas = REPAS.find((r) => r.jour === repasCible) ?? REPAS[3];
  const [etape, setEtape] = useState(0);
  const [journee, setJournee] = useState(false);
  const [options, setOptions] = useState(3);
  const [, redessiner] = useState(0);
  const [notes, setNotes] = useState(notesGardees);
  const [voirTexte, setVoirTexte] = useState(false);
  const [reponse, setReponse] = useState('');
  const [lu, setLu] = useState(null); // { options, coupe }
  const [choix, setChoix] = useState(0);
  const [edition, setEdition] = useState(null); // index de l'aliment dont on change la quantité
  const [nommer, setNommer] = useState(null); // nom proposé pour l'enregistrement

  const jour = jourLocal();
  const cibleDe = (j) => {
    const o = getObjectifs();
    const rep = getRepasJour(jour);
    const vides = REPAS.filter((r) => !(rep[r.jour] || []).length).length;
    return ciblesIA({ objectifs: { kcal: o.kcal || 0, p: o.p || 0, c: o.c || 0, l: o.l || 0 }, mange: macrosJour(jour), repasVides: vides, repasVise: !(rep[repas.jour] || []).length, nbRepas: REPAS.length, journee: j });
  };
  const [cible, setCible] = useState(() => cibleDe(false));

  const demande = () => {
    const mange = [];
    for (const l of Object.values(getRepasJour(jour))) for (const e of l || []) if (e.nom && !mange.includes(e.nom)) mange.push(e.nom);
    return demandeIA({
      journee, repasId: repas.id, repasNom: repas.nom(), repasListe: REPAS.map((r) => ({ id: r.id, nom: r.nom() })),
      kcal: cible.kcal, p: cible.p, c: cible.c, l: cible.l, options, langue: X.langueIA,
      styles: STYLES_IA.filter(([id]) => stylesGardes.has(id)).map(([, s]) => s), notes, mange: mange.slice(0, 10),
    });
  };

  const changerJournee = (j) => {
    if (j === journee) return;
    setJournee(j); setOptions(j ? 1 : 3); setCible(cibleDe(j));
  };
  const copier = async () => {
    notesGardees = notes;
    try { await navigator.clipboard.writeText(demande()); } catch { afficher(X.copiee, 'danger'); return; }
    afficher(`${X.copiee}. ${X.copieeAide}`, 'ok');
    setEtape(1);
  };
  const relire = (texte = reponse) => {
    if (!texte.trim()) return;
    const r = lireReponseIA(texte);
    const opts = r.options.length ? resoudreIA(r, { repas: repas.id, repasListe: REPAS.map((x) => ({ id: x.id, nom: x.nom() })), journee, bibliotheque: bibliotheque(), perso: persos() }) : [];
    setLu({ options: opts, coupe: r.coupe }); setChoix(0); setEdition(null); setNommer(null);
  };
  const collerPressePapiers = async () => {
    try { const t = await navigator.clipboard.readText(); if (t?.trim()) { setReponse(t); relire(t); } } catch { /* lecture refusée par le navigateur */ }
  };
  const lireFichier = (ev) => {
    const f = ev.target.files?.[0];
    if (!f) return;
    const l = new FileReader();
    l.onload = () => { const t = String(l.result ?? ''); setReponse(t); relire(t); };
    l.readAsText(f);
    ev.target.value = '';
  };
  const copierPhrase = async () => { try { await navigator.clipboard.writeText(PHRASE_RELANCE); afficher(X.copie, 'ok'); } catch { afficher(X.copie, 'danger'); } };

  const o = lu?.options[Math.min(choix, (lu?.options.length ?? 1) - 1)];
  const maj = (i, d) => { o.items[i] = d; redessiner((n) => n + 1); };
  const entree = (d) => ({ id: nouvelId(), date: null, repas: parId(d.repas).m10, alimentId: d.source === 'bibliotheque' || d.source === 'perso' ? d.alimentId : '', nom: d.nom, grammes: Math.round(d.grammes), portions: 1, liquide: !!d.liquide, cuit: false, macros: { k: d.macros.k, p: d.macros.p, c: d.macros.c, f: d.macros.l } });
  const ajouter = () => {
    const l = choisis(o);
    if (!l.length) return;
    const n = noterEntrees(jour, l.map((d) => ({ ...entree(d), repas: journee ? parId(d.repas).m10 : repas.m10 })));
    afficher(X.ajoutes(n), 'ok');
    fermer();
  };
  const enregistrer = (nom) => {
    const l = choisis(o);
    if (!l.length || !nom.trim()) return;
    if (journee) sauverPlan({ id: nouvelId(), nom: nom.trim(), elements: l.map(entree) });
    else sauverRecette({ id: nouvelId(), nom: nom.trim(), items: l.map((d) => (d.source === 'bibliotheque' ? { slug: d.alimentId, grammes: Math.round(d.grammes) } : { nom: d.nom, grammes: Math.round(d.grammes), liquide: !!d.liquide, macros: entree(d).macros })) });
    afficher(journee ? X.planFait : X.recetteFaite, 'ok');
    fermer();
  };
  const drapeau = (d) => {
    for (const f of ['sansValeurs', 'douteux', 'ajuste', 'sansQuantite']) if (d.drapeaux.has(f)) return X.drapeaux[f];
    return d.source === 'ia' ? X.drapeaux.estime : null;
  };
  const texteDemande = useMemo(() => (voirTexte ? demande() : ''), [voirTexte, journee, options, cible, notes, stylesGardes.size]);

  const pageDemander = <div class="ia-page">
    <p class="kicker ia-kicker">{X.cible.toUpperCase()}</p>
    <div class="seg ia-seg" role="radiogroup" aria-label={X.cible}>
      <button type="button" role="radio" aria-checked={!journee} aria-pressed={!journee} onClick={() => changerJournee(false)}>{repas.nom()}</button>
      <button type="button" role="radio" aria-checked={journee} aria-pressed={journee} onClick={() => changerJournee(true)}>{X.journee}</button>
    </div>
    <div class="ia-boite">
      {!journee ? <>
        <div class="ia-ligne"><span>{X.calories}</span><Pas label={X.calories} valeur={kcalTxt(cible.kcal)}
          moins={() => setCible({ ...cible, kcal: Math.max(100, cible.kcal - 50) })} plus={() => setCible({ ...cible, kcal: Math.min(3000, cible.kcal + 50) })} /></div>
        <div class="ia-ligne"><span>{X.proteines}</span><Pas label={X.proteines} valeur={`${cible.p} g`}
          moins={() => setCible({ ...cible, p: Math.max(5, cible.p - 5) })} plus={() => setCible({ ...cible, p: Math.min(250, cible.p + 5) })} /></div>
        <p class="ia-reste">{X.reste(kcalTxt(cible.resteKcal), cible.resteP)}</p>
      </> : <p class="ia-resume">{`${kcalTxt(cible.kcal)} · ${cible.p} g ${X.proteines.toLowerCase()} · ${cible.c} g ${X.glucides.toLowerCase()} · ${cible.l} g ${X.lipides.toLowerCase()}`}</p>}
    </div>
    <p class="kicker ia-kicker ia-espace">{X.gouts.toUpperCase()}</p>
    <div class="ia-puces">
      {STYLES_IA.map(([id]) => <button key={id} type="button" aria-pressed={stylesGardes.has(id)} class={`nut-puce ${stylesGardes.has(id) ? 'on' : ''}`}
        onClick={() => { if (stylesGardes.has(id)) stylesGardes.delete(id); else stylesGardes.add(id); redessiner((n) => n + 1); }}>{X.styles[id]}</button>)}
    </div>
    <textarea class="ia-texte" rows={2} value={notes} placeholder={X.notes} aria-label={X.gouts}
      onInput={(e) => { setNotes(e.target.value); notesGardees = e.target.value; }} />
    <div class="ia-ligne ia-options"><span>{X.options}</span><Pas label={X.options} large={40} valeur={options}
      moins={() => setOptions(Math.max(1, options - 1))} plus={() => setOptions(Math.min(journee ? 3 : 4, options + 1))} /></div>
    <button type="button" class="btn pri large ia-principal" onClick={copier}>{X.copier}</button>
    <button type="button" class="ia-lien" aria-expanded={voirTexte} onClick={() => setVoirTexte(!voirTexte)}>{voirTexte ? X.masquer : X.voir}</button>
    {voirTexte && <pre class="ia-demande">{texteDemande}</pre>}
  </div>;

  const fait = lu && lu.options.length > 0;
  const total = fait ? totalOption(o) : null;
  const pageColler = <div class="ia-page">
    <textarea class="ia-texte ia-reponse" rows={fait ? 2 : 5} value={reponse} placeholder={X.coller} aria-label={X.coller}
      onInput={(e) => setReponse(e.target.value)} />
    <div class="ia-actions">
      <button type="button" class="ia-puce-bouton" onClick={collerPressePapiers}><Ic n="clipboard-text" taille={15} />{X.collerBouton}</button>
      <label class="ia-puce-bouton"><Ic n="file-arrow-up" taille={15} />{X.fichier}<input type="file" accept=".txt,.json,.md,text/*,application/json" onChange={lireFichier} hidden /></label>
    </div>
    <button type="button" class={`btn large ia-principal ${reponse.trim() ? 'pri' : 'ia-eteint'}`} onClick={() => relire()}>{X.lire}</button>
    {lu && !fait && <div class="ia-illisible" role="alert">
      <b>{X.illisible}</b><p>{X.illisibleAide}</p>
      <button type="button" class="ia-puce-bouton" onClick={copierPhrase}><Ic n="copy" taille={15} />{X.copierPhrase}</button>
    </div>}
    {fait && <div class="ia-resultat">
      {lu.options.length > 1 && <div class="seg ia-seg" role="radiogroup" aria-label={X.options}>
        {lu.options.map((_, i) => <button key={i} type="button" role="radio" aria-checked={i === choix} aria-pressed={i === choix} onClick={() => { setChoix(i); setEdition(null); setNommer(null); }}>{X.option(i + 1)}</button>)}
      </div>}
      {o.nom && <p class="ia-nom">{o.nom}</p>}
      <div class="ia-boite ia-totaux">
        <div class="ia-totaux-ligne">
          <div><b class="grand">{nombre(Math.round(total.k), 0)}</b><small>KCAL</small></div>
          <div><b>{Math.round(total.p)}</b><small>{X.proteines.toUpperCase()}</small></div>
          <div><b>{Math.round(total.c)}</b><small>{X.glucides.toUpperCase()}</small></div>
          <div><b>{Math.round(total.l)}</b><small>{X.lipides.toUpperCase()}</small></div>
        </div>
        {(!journee || cible.kcal > 0) && <p class={`ia-cible ${cible.kcal > 0 && Math.abs(total.k - cible.kcal) <= cible.kcal * 0.15 ? 'proche' : ''}`}>{X.cibleLigne(kcalTxt(cible.kcal))}</p>}
      </div>
      {o.items.map((d, i) => {
        const actif = d.actif && utilisable(d);
        const mauvais = d.drapeaux.has('douteux') || d.drapeaux.has('sansValeurs');
        const f = drapeau(d);
        return <div key={i} class={`ia-item ${actif ? '' : 'eteint'}`}>
          {edition === i
            ? <form class="ia-item-corps" onSubmit={(e) => { e.preventDefault(); const v = Number(String(new FormData(e.target).get('g')).replace(',', '.')); if (v > 0) maj(i, mettreA(d, v)); setEdition(null); }}>
              <span class="ia-item-ic"><Ic n="fork-knife" taille={16} /></span>
              <label class="ia-item-texte"><b>{`${X.quantite} (${d.liquide ? 'ml' : 'g'})`}</b>
                <input name="g" class="cellule" inputMode="decimal" defaultValue={Math.round(d.grammes)} autoFocus onBlur={(e) => e.target.form.requestSubmit()} /></label>
            </form>
            : <button type="button" class="ia-item-corps" disabled={!(utilisable(d) && d.grammes > 0)} onClick={() => setEdition(i)}>
              <span class="ia-item-ic">{d.alimentId && d.source === 'bibliotheque' ? <img src={`/statique/nutrition/${d.alimentId}.webp`} alt="" loading="lazy" /> : <Ic n="fork-knife" taille={16} />}</span>
              <span class="ia-item-texte"><b>{d.nom}</b>
                <small>{[d.grammes > 0 ? `${nombre(Math.round(d.grammes), 0)} ${d.liquide ? 'ml' : 'g'}` : '', utilisable(d) ? kcalTxt(d.macros.k) : ''].filter(Boolean).join(' · ')}</small>
                {f && <em class={mauvais ? 'mauvais' : d.source === 'ia' ? 'ia' : ''}>{f}</em>}
              </span>
            </button>}
          <button type="button" class="ia-coche-zone" role="checkbox" aria-checked={actif} aria-label={d.nom} disabled={!utilisable(d)}
            onClick={() => maj(i, { ...d, actif: !d.actif })}><span class={`ia-coche ${actif ? 'on' : ''}`}>{actif && <Ic n="check:bold" taille={13} />}</span></button>
        </div>;
      })}
      {lu.coupe && <p class="ia-coupee">{X.coupee}</p>}
      {choisis(o).length === 0
        ? <button type="button" class="btn large ia-principal ia-eteint" disabled>{X.rienChoisi}</button>
        : <button type="button" class="btn pri large ia-principal" onClick={ajouter}>{`${journee ? X.ajouterJour : T().ajouterA(repas.nom().toLowerCase())} · ${kcalTxt(total.k)}`}</button>}
      {choisis(o).length > 0 && (nommer === null
        ? <button type="button" class="btn secondaire large ia-fantome" onClick={() => setNommer(o.nom || '')}><Ic n={journee ? 'calendar-plus' : 'cooking-pot'} taille={17} />{journee ? X.plan : X.recette}</button>
        : <form class="ia-nommer" onSubmit={(e) => { e.preventDefault(); enregistrer(nommer); }}>
          <label class="nut-etape-nom" for="ia-nom">{journee ? X.nomPlan : X.nomRecette}</label>
          <input id="ia-nom" class="cellule" maxLength={80} value={nommer} onInput={(e) => setNommer(e.target.value)} autoFocus />
          <div class="ia-actions"><button type="button" class="btn secondaire" onClick={() => setNommer(null)}>{X.annuler}</button><button type="submit" class="btn pri" disabled={!nommer.trim()}>{X.enregistrer}</button></div>
        </form>)}
    </div>}
  </div>;

  return <Feuille ouverte={ouvert} fermer={fermer} titre={X.titre} sous={X.sous}>
    <div class="ia-tete"><span class="nut-beta"><Ic n="flask:fill" taille={10} />{T().beta}</span></div>
    <div class="seg ia-seg ia-etapes" role="group">
      <button type="button" aria-pressed={etape === 0} onClick={() => setEtape(0)}>{`1 · ${X.etapeDemander}`}</button>
      <button type="button" aria-pressed={etape === 1} onClick={() => setEtape(1)}>{`2 · ${X.etapeColler}`}</button>
    </div>
    {etape === 0 ? pageDemander : pageColler}
  </Feuille>;
}
