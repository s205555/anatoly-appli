// Écran Plans de repas (M10) : bande de semaine, dossiers de plans, éditeur avec affectation par jour.
import { useEffect, useState } from 'preact/hooks';
import { afficher } from '../../donnees.js';
import { Ic, Feuille, Nombre, Vide, EnTete, Segment } from '../../ui.jsx';
import { teinte } from '../programmes.jsx';
import { m10, jours, joursLongs } from '../../i18n/m10.js';
import {
  version, jourSemaine,
  PLATS_OBJ, aliment, nomAliment, photoAliment, chercherAliments,
  REPAS, plans, plansArchives, planParId, elementsRepas,
  sauverPlan, supprimerPlan, dupliquerPlan, deplacerPlan, archiverPlan,
  semainePlans, planDuJour, joursDuPlan, affecterJour,
  noterJourDuPlan, macrosEntree, totalMacros, entreeDepuisItem,
  entreeDepuisAliment, favoris, basculerFavori,
  recettes, sauverRecette, nouvelId, dateISO,
} from './etat.js';
import { Dossier, Coup } from './gm.jsx';
import './m10.css';

const ICONE_REPAS = { petitDejeuner: 'sun', dejeuner: 'clock', diner: 'moon', collations: 'lightning' };

const copier = (texte) => {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(texte);
  return new Promise((res, rej) => {
    const ta = document.createElement('textarea');
    ta.value = texte; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); res(); } catch (e) { rej(e); }
    ta.remove();
  });
};

function DossierPlan({ plan, archive, libelle, onOuvrir, onAction, vide = 'forkKnife' }) {
  const t = m10();
  const els = plan.elements ?? [];
  const photos = els.filter((e) => e.alimentId).slice(0, 3).map((e) => ({ src: photoAliment(e.alimentId), nom: e.nom ?? '' }));
  return <div class="gm gm-plan">
    <Dossier titre={plan.nom} detail={`${Math.round(totalMacros(els).k)} ${t.kcal} · ${t.aliments(els.length)}`} onClick={onOuvrir}
      peek={<Coup photos={photos} vide={vide === 'star' ? 'star:fill' : vide === 'pot' ? 'cooking-pot:fill' : 'fork-knife:fill'} />} />
    <button class="btn petit gm-plan-action" type="button" onClick={onAction}>{libelle ?? (archive ? t.restaurer : t.noterJour)}</button>
  </div>;
}

function DossiersRaccourcis({ surOuvrir }) {
  const t = m10();
  return <>
    <DossierPlan libelle={t.parcourir}
      vide="star" plan={{ id: 'favoris', nom: t.favorisTitre, elements: favoris().map((slug) => { const a = aliment(slug); return a ? { id: slug, alimentId: slug, nom: nomAliment(a), grammes: 0 } : null; }).filter(Boolean) }}
      onOuvrir={() => surOuvrir('aliments')} onAction={() => surOuvrir('aliments')} />
    <DossierPlan libelle={t.parcourir}
      vide="pot" plan={{ id: 'recettes', nom: t.recettesTitre, elements: recettes().slice(0, 3).map((r) => ({ id: r.id, alimentId: r.items[0]?.slug ?? '', nom: r.nom, grammes: 0 })) }}
      onOuvrir={() => surOuvrir('recettes')} onAction={() => surOuvrir('recettes')} />
  </>;
}

function Semaine({ surJour }) {
  const t = m10();
  const maintenant = jourSemaine();
  const sem = semainePlans();
  const jrs = jours();
  const longs = joursLongs();
  return <div class="m10-semaine" role="group" aria-label={t.semaineAide}>
    {jrs.map((lettre, i) => {
      const j = i + 1;
      const p = planParId(sem[j]);
      return <div class={`m10-jour ${j === maintenant ? 'plein' : ''} ${p ? 'vec-plan' : ''}`} key={j}>
        <button type="button" aria-label={p ? `${longs[i]} · ${p.nom}` : longs[i]} onClick={() => surJour(j)}>{lettre}</button>
        <span class="m10-jour-nom">{p?.nom}</span>
      </div>;
    })}
  </div>;
}

function CarteJour({ onNoter }) {
  const t = m10();
  const p = planDuJour(jourSemaine());
  if (!p) return null;
  const els = p.elements ?? [];
  return <div class="m10-carte-jour">
    <Ic n="calendar-blank" taille={22} />
    <span><strong>{t.planDuJour}</strong><small>{p.nom} · {Math.round(totalMacros(els).k)} {t.kcal}</small></span>
    <button class="btn pri petit" type="button" disabled={!els.length} onClick={onNoter}>{t.noterJour}</button>
  </div>;
}

export function Plans() {
  const t = m10();
  const [, force] = useState(0);
  useEffect(() => version.subscribe(() => force((x) => x + 1)), []);
  const [edition, setEdition] = useState(null);
  const [jourChoix, setJourChoix] = useState(null);
  const [palette, setPalette] = useState(null);
  const arch = plansArchives();
  const actifs = plans().filter((p) => !arch.includes(p.id));
  const archives = plans().filter((p) => arch.includes(p.id));

  const noter = (p) => () => {
    const n = noterJourDuPlan(p, dateISO());
    afficher(n ? t.planNote(n) : t.rienANoter);
  };

  return <main class="ecran m10">
    <EnTete titre={t.titrePlans} retour="#/" actions={<button class="btn pri petit" type="button" onClick={() => setEdition({ plan: null })}><Ic n="plus" taille={14} />{t.nouveauPlan}</button>} />
    <Semaine surJour={setJourChoix} />
    <CarteJour onNoter={noter(planDuJour(jourSemaine()))} />

    {actifs.length ? (
      <div class="grille-dossiers">
        {actifs.map((p) => <DossierPlan key={p.id} plan={p} onOuvrir={() => setEdition({ plan: p })} onAction={noter(p)} />)}
        <DossiersRaccourcis surOuvrir={(onglet) => setPalette({ onglet })} />
      </div>
    ) : (
      <>
        <Vide n="calendar-blank" titre={t.aucunPlan} texte={t.planNouveauTexte}>
          <button class="btn pri" type="button" onClick={() => setEdition({ plan: null })}>{t.nouveauPlan}</button>
        </Vide>
        <div class="grille-dossiers"><DossiersRaccourcis surOuvrir={(onglet) => setPalette({ onglet })} /></div>
      </>
    )}

    {archives.length > 0 && (
      <section class="section">
        <div class="section-tete"><p class="kicker">{t.archives}</p></div>
        <div class="liste-seances">
          {archives.map((p) => (
            <div class="ligne-seance" key={p.id}>
              <span><strong>{p.nom}</strong><small>{t.aliments((p.elements ?? []).length)} · {Math.round(totalMacros(p.elements ?? []).k)} {t.kcal}</small></span>
              <button class="btn petit" type="button" onClick={() => { archiverPlan(p.id, false); afficher(t.planEnregistre); }}>{t.restaurer}</button>
            </div>
          ))}
        </div>
      </section>
    )}

    {edition && <EditeurPlan cle={edition.plan?.id ?? 'neuf'} plan={edition.plan} joursInit={edition.jours} fermer={() => setEdition(null)} />}
    {jourChoix && <ChoixJour jour={jourChoix} fermer={() => setJourChoix(null)} surNouveau={(j) => setEdition({ plan: null, jours: [j] })} />}
    {palette && <PaletteAliments ouverte fermer={() => setPalette(null)} ongletInitial={palette.onglet} />}
  </main>;
}

function EditeurPlan({ plan, joursInit, fermer }) {
  const t = m10();
  const [nom, setNom] = useState(plan?.nom ?? '');
  const [elements, setElements] = useState(plan?.elements ?? []);
  const [joursChoisis, setJoursChoisis] = useState(plan ? joursDuPlan(plan.id) : (joursInit ?? [jourSemaine()]));
  const [repasPalette, setRepasPalette] = useState(null);
  const [options, setOptions] = useState(false);
  const id = plan?.id ?? nouvelId();
  const macros = totalMacros(elements);

  const ajouter = (liste) => {
    const arr = Array.isArray(liste) ? liste : [liste];
    setElements((e) => [...e, ...arr.map((x) => ({ ...x, id: nouvelId() }))]);
  };

  const enregistrer = () => {
    sauverPlan({ id, nom: nom.trim() || 'Plan', elements }, joursChoisis);
    afficher(t.planEnregistre);
    fermer();
  };

  return <>
    <Feuille ouverte large={0.92} fermer={fermer} titre={plan ? t.modifierPlan : t.nouveauPlan}
      pied={<>
        {plan && <button class="btn secondaire" type="button" onClick={() => setOptions(true)}>{t.optionsPlan}</button>}
        <button class="btn pri large" type="button" onClick={enregistrer}>{t.enregistrer}</button>
      </>}>
      <label class="champ">
        <input class="form-input" value={nom} placeholder={t.nomPlan} onInput={(e) => setNom(e.target.value)} />
      </label>

      <div class="m10-macros">
        <div class="m10-stat k"><strong>{Math.round(macros.k)}</strong><small>{t.kcal}</small></div>
        <div class="m10-stat p"><strong>{Math.round(macros.p)}</strong><small><span class="m10-dot" />{t.proteines}</small></div>
        <div class="m10-stat c"><strong>{Math.round(macros.c)}</strong><small><span class="m10-dot" />{t.glucides}</small></div>
        <div class="m10-stat f"><strong>{Math.round(macros.f)}</strong><small><span class="m10-dot" />{t.lipides}</small></div>
      </div>

      <div class="champ">
        <p class="kicker">{t.quelsJours}</p>
        <p class="muted" style="font-size:12px;margin-top:2px">{t.joursAide}</p>
        <div class="m10-chips" role="group" aria-label={t.quelsJours}>
          {jours().map((lettre, i) => {
            const j = i + 1;
            const on = joursChoisis.includes(j);
            return <button key={j} type="button" class={`m10-chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setJoursChoisis(on ? joursChoisis.filter((x) => x !== j) : [...joursChoisis, j])}>{lettre}</button>;
          })}
        </div>
        {joursChoisis.length === 0 && <p class="muted" style="font-size:12px;margin-top:4px">{t.joursAucun}</p>}
      </div>

      {REPAS.map((cle) => {
        const els = elementsRepas({ elements }, cle);
        const kcal = Math.round(totalMacros(els).k);
        return <div class="m10-repas" key={cle}>
          <div class="m10-repas-tete">
            <Ic n={ICONE_REPAS[cle]} taille={16} />
            <strong>{t[cle]}</strong>
            <small>{kcal} {t.kcal}</small>
            <button type="button" disabled={!els.length} aria-label={t.enregistrerRecette} title={t.enregistrerRecette}
              onClick={() => { sauverRecette({ id: nouvelId(), nom: t[cle], items: els.map((e) => ({ slug: e.alimentId, grammes: e.grammes })) }); afficher(t.recetteEnregistree); }}>
              <Ic n="star" taille={14} /></button>
          </div>
          {els.map((e) => (
            <div class="m10-element" key={e.id}>
              <img src={photoAliment(e.alimentId)} alt="" loading="lazy" />
              <span><strong>{e.nom}</strong><small>{Math.round(e.grammes)} g · {Math.round(macrosEntree(e).k)} {t.kcal}</small></span>
              <button type="button" aria-label={t.retirer} onClick={() => setElements(elements.filter((x) => x.id !== e.id))}><Ic n="x" taille={16} /></button>
            </div>
          ))}
          <button class="m10-ajouter" type="button" onClick={() => setRepasPalette(cle)}><Ic n="plus" taille={16} />{t.ajouterAu(t[cle])}</button>
        </div>;
      })}
    </Feuille>

    {repasPalette && <PaletteAliments ouverte fermer={() => setRepasPalette(null)}
      surAjout={(liste) => {
        const arr = Array.isArray(liste) ? liste : [liste];
        ajouter(arr.map((x) => ({ ...x, repas: repasPalette })));
        afficher(t.ajoutes(arr.length));
        setRepasPalette(null);
      }} />}
    {plan && options && <OptionsPlan plan={plan} archive={plansArchives().includes(plan.id)} fermer={() => setOptions(false)} />}
  </>;
}

function OptionsPlan({ plan, archive, fermer }) {
  const t = m10();
  const fin = (fn, toast) => () => { fn(); if (toast) afficher(toast); fermer(); };
  const actions = [
    [t.partager, 'export', () => copier(JSON.stringify({ nom: plan.nom, elements: plan.elements.map((e) => ({ repas: e.repas, alimentId: e.alimentId, nom: e.nom, grammes: e.grammes })) })).then(() => afficher(t.planCopie)).catch(() => afficher(t.planCopie, 'danger')), null],
    [t.dupliquer, 'copy', () => dupliquerPlan(plan.id), t.planEnregistre],
    [t.monter, 'caret-up', () => deplacerPlan(plan.id, -1), null],
    [t.descendre, 'caret-down', () => deplacerPlan(plan.id, 1), null],
  ];
  if (!archive) actions.push([t.archiver, 'download-simple', () => archiverPlan(plan.id, true), t.planArchive]);
  else actions.push([t.restaurer, 'arrow-counter-clockwise', () => archiverPlan(plan.id, false), t.planEnregistre]);
  return <Feuille ouverte fermer={fermer} titre={t.optionsPlan}>
    <div class="options">
      {actions.map(([nom, ic, fn, toast]) => (
        <button key={nom} class="option" type="button" onClick={fin(fn, toast)}>
          <Ic n={ic} taille={18} /><span><strong>{nom}</strong></span>
        </button>
      ))}
      <button class="option danger" type="button" onClick={fin(() => supprimerPlan(plan.id), null)}>
        <Ic n="trash" taille={18} /><span><strong>{t.supprimer}</strong></span>
      </button>
    </div>
  </Feuille>;
}

function ChoixJour({ jour, fermer, surNouveau }) {
  const t = m10();
  const arch = plansArchives();
  const actifs = plans().filter((p) => !arch.includes(p.id));
  const actuel = semainePlans()[jour];
  const choisir = (pid) => {
    affecterJour(jour, pid);
    afficher(t.planJourDefini(pid ? planParId(pid).nom : t.aucunPlan));
    fermer();
  };
  return <Feuille ouverte fermer={fermer} titre={joursLongs()[jour - 1]} sous={t.choisirPlanAide}>
    <div class="options">
      <button class={`option ${!actuel ? 'choisie' : ''}`} type="button" onClick={() => choisir(null)}>
        <span><strong>{t.aucunPlan}</strong><small>{t.choisirPlanAide}</small></span>
        {!actuel && <Ic n="check" taille={18} classe="option-coche" />}
      </button>
      {actifs.map((p) => {
        const sel = actuel === p.id;
        return <button key={p.id} class={`option ${sel ? 'choisie' : ''}`} type="button" onClick={() => choisir(p.id)}>
          <span><strong>{p.nom}</strong><small>{joursDuPlan(p.id).map((j) => jours()[j - 1]).join(' · ')}</small></span>
          {sel && <Ic n="check" taille={18} classe="option-coche" />}
        </button>;
      })}
      <button class="option" type="button" onClick={() => { fermer(); surNouveau(jour); }}>
        <span><strong>{t.nouveauPlan}</strong></span>
        <Ic n="plus" taille={18} />
      </button>
    </div>
  </Feuille>;
}

// Palette de choix d'aliments, de plats et de recettes enregistrées. Partagée avec l'écran prep.
export function PaletteAliments({ ouverte, fermer, ongletInitial = 'aliments', surAjout }) {
  const t = m10();
  const [onglet, setOnglet] = useState(ongletInitial);
  const [recherche, setRecherche] = useState('');
  const [quantite, setQuantite] = useState(null);
  const fav = favoris();

  const ajouter = (liste) => {
    if (surAjout) surAjout(liste); else afficher(t.ajoutes(Array.isArray(liste) ? liste.length : 1));
    fermer();
  };

  return <>
    <Feuille ouverte={ouverte} large fermer={fermer} titre={t.rechercheAliment}>
      <Segment options={[['aliments', t.alimentsTitre], ['plats', t.platsTitre], ['recettes', t.recettesTitre]]} valeur={onglet} onChange={setOnglet} label={t.rechercheAliment} />
      {onglet === 'aliments' && <>
        {fav.length > 0 && <div class="m10-favoris" aria-label={t.favorisTitre}>
          {fav.map((slug) => <div class="m10-favori" key={slug}>
            <img src={photoAliment(slug)} alt={nomAliment(aliment(slug))} />
            <button type="button" aria-label={t.retirerFavori} onClick={() => basculerFavori(slug)}><Ic n="x" taille={12} /></button>
          </div>)}
        </div>}
        <div class="recherche">
          <Ic n="magnifying-glass" taille={18} />
          <input type="search" value={recherche} placeholder={t.rechercheAliment} aria-label={t.rechercheAliment} onInput={(e) => setRecherche(e.target.value)} />
        </div>
        <div class="liste-seances">
          {chercherAliments(recherche).map((a) => {
            const on = fav.includes(a.slug);
            return <div class="m10-ligne-aliment" key={a.slug}>
              <button type="button" class="m10-ligne-tap" onClick={() => setQuantite(a)}>
                <img src={photoAliment(a.slug)} alt="" loading="lazy" />
                <span><strong>{nomAliment(a)}</strong><small>{a.kcal} {t.kcal} · {a.grammesPortion ? `${a.grammesPortion} g` : t.parPortion}</small></span>
              </button>
              <button type="button" class={`fav ${on ? 'on' : ''}`} aria-label={on ? t.retirerFavori : t.ajouterFavori} onClick={() => basculerFavori(a.slug)}>
                <Ic n={on ? 'star:fill' : 'star'} taille={18} /></button>
            </div>;
          })}
          {!chercherAliments(recherche).length && <p class="muted" style="text-align:center;padding:16px 0">{t.aucunAliment}</p>}
        </div>
      </>}

      {onglet === 'plats' && <div class="liste-seances">
        {PLATS_OBJ.map((p) => (
          <button class="m10-ligne-aliment" type="button" key={p.id} onClick={() => ajouter(p.items.map((it) => entreeDepuisAliment(aliment(it.slug), null, it.grammes)))}>
            <span class="m10-plat-ic"><Ic n="stack" taille={20} /></span>
            <span><strong>{p.nom}</strong><small>{t.aliments(p.items.length)}</small></span>
          </button>
        ))}
        {!PLATS_OBJ.length && <p class="muted" style="text-align:center;padding:16px 0">{t.aucunAliment}</p>}
      </div>}

      {onglet === 'recettes' && <div class="liste-seances">
        {recettes().map((r) => (
          <button class="m10-ligne-aliment" type="button" key={r.id} onClick={() => ajouter(r.items.map((it) => entreeDepuisItem(it)))}>
            <span class="m10-plat-ic"><Ic n="notebook" taille={20} /></span>
            <span><strong>{r.nom}</strong><small>{t.aliments(r.items.length)}</small></span>
          </button>
        ))}
        {!recettes().length && <p class="muted" style="text-align:center;padding:16px 0">{t.aucunAliment}</p>}
      </div>}
    </Feuille>

    {quantite && <Feuille ouverte fermer={() => setQuantite(null)} titre={nomAliment(quantite)}>
      <QuantiteSheet cle={quantite.slug} aliment={quantite} surValider={(g) => { ajouter(entreeDepuisAliment(quantite, null, g)); }} />
    </Feuille>}
  </>;
}

function QuantiteSheet({ aliment: a, surValider }) {
  const t = m10();
  const [g, setG] = useState(a.grammesPortion || 100);
  return <div class="m10-quantite">
    <img src={photoAliment(a.slug)} alt="" />
    <small class="muted" style="font-size:12.5px">{a.kcal} {t.kcal} pour 100 g</small>
    <div class="stepper">
      <button type="button" aria-label="−25 g" onClick={() => setG(Math.max(5, g - 25))}>−</button>
      <output aria-live="polite">{g} g</output>
      <button type="button" aria-label="+25 g" onClick={() => setG(g + 25)}>+</button>
    </div>
    <Nombre valeur={g} onChange={(n) => setG(n ?? 0)} label={t.quantiteUnite('g')} decimales={false} />
    <div class="m10-valeurs">
      {[25, 50, 100, 150, 200].map((v) => <button key={v} type="button" class={`m10-valeur ${g === v ? 'on' : ''}`} onClick={() => setG(v)}>{v} g</button>)}
    </div>
    <button class="btn pri large" type="button" disabled={!(g > 0)} onClick={() => surValider(g)}>{t.enregistrer}</button>
  </div>;
}
