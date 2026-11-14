// Programmes (routines) : plan de la semaine, rotation, programme actif en carrousel,
// dossiers avec couleur, dix modèles GymMane, import, export, plan assisté.
// L'éditeur vit dans programme.jsx.
import { useEffect, useState } from 'preact/hooks';
import { MODELES, couleurDe, dossierDe, exercicesDuModele, lireMeta, ecrireMeta, nbSeries, partagerProgrammes, routinePourDemarrer } from './programme.jsx';
import { deplacerDans, horloge, nombrePlan, poigneeReordre, secondesPlan } from './programme-donnees.js';
import { IllustrationExercice } from '../illustrations.js';
import { correspondreExerciceCatalogue } from '../import-csv.js';
import { afficher, api, charger, demarrer, ecrireModule, enCours, etat, extrasDuJour, lireModule, nbExercicesValides, nomExercice, sauverExtensions, tousExercices, trouverExercice } from '../donnees.js';
import { langue, t, dp } from '../i18n.js';
import { textes } from '../i18n/m06.js';
import { textes as textes6b } from '../i18n/m06b.js';
import { Dialogue, EnTete, Feuille, Ic, Kicker, Rond, Section, Segment, Vide } from '../ui.jsx';
import { ChoixExercices } from './exercices.jsx';
import { lireM13 } from './reglages-m13.js';
import { Dossier, TB, archivesLues, couleurCarte, estArchive, intensitesDe, lancer } from './programmes-legers.jsx';
import './m06.css';


import { Programme as EditeurProgramme } from './programme.jsx';
// « #/programme/ia » ouvre l'écran plein « Programme avec une IA », comme fit.goAiPlan.
export const Programme = ({ id }) => (id === 'ia' ? <EcranIA /> : <EditeurProgramme id={id} />);
export { Dossier, couleurCarte, estArchive, intensitesDe };

import { TEINTES_DOSSIER, couleurRoutine, enregistrerCouleur, teinte } from './couleurs-programmes.js';
export { TEINTES_DOSSIER, couleurRoutine, teinte };


async function sauverPlan(plan) {
  const e = etat.value;
  if (!e) return;
  etat.value = { ...e, plan };
  const jours = {};
  for (const [k, v] of Object.entries(plan.jours ?? {})) jours[k] = v && v !== 'repos' && Number.isFinite(Number(v)) ? Number(v) : null;
  const act = e.profil.extensions ?? {};
  const extensions = {
    ...act,
    planSemaine: { mode: plan.mode === 'semaine' ? 'fixe' : 'rotation', jours },
  };
  const { prenom, langue: lg, unite, theme, repos_s, objectif_semaine } = e.profil;
  await api('PUT', '/api/reglages', { prenom, langue: lg, unite, theme, repos_s, objectif_semaine, extensions });
  etat.value = { ...e, plan, profil: { ...e.profil, extensions } };
}

const T6 = textes;
const tm = () => T6[langue === 'en' ? 'en' : 'fr'];

/** Ordre de rotation et pointeur, gardés sur l'appareil. */
function lireRotation() {
  const r = lireMeta().rotation;
  return { ordre: Array.isArray(r?.ordre) ? r.ordre : [], index: Number(r?.index) || 0 };
}
function ecrireRotation(patch) {
  const r = { ...lireRotation(), ...patch };
  ecrireMeta({ rotation: r });
  return r;
}
const routinesDeRotation = (rotation, routines) => rotation.ordre.map((id) => routines.find((r) => String(r.id) === String(id))).filter(Boolean);

/** Programmes du plan actif : jours assignés en semaine fixe, ordre en rotation. */
function routinesActives(plan, routines) {
  const ids = plan?.mode === 'rotation'
    ? routinesDeRotation(lireRotation(), routines).map((r) => r.id)
    : Object.values(plan?.jours ?? {}).filter((v) => v && v !== 'repos');
  return [...new Set(ids.map(String))].map((id) => routines.find((r) => String(r.id) === id)).filter(Boolean);
}


/** Plans enregistrés (semaines nommées) et plan courant, gardés sur l'appareil. */
const lirePlans = () => { const m = lireMeta(); return { liste: Array.isArray(m.plans) ? m.plans : [], actuel: String(m.planActuel ?? '') }; };
const identifiantPlan = () => `p${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
const gardeCourant = (liste, actuel, plan) => liste.map((x) => (x.id === actuel ? { ...x, jours: { ...plan.jours } } : x));
function stockerPlanCourant(plan) {
  const { liste, actuel } = lirePlans();
  if (actuel) ecrireMeta({ plans: gardeCourant(liste, actuel, plan) });
}
async function changerPlan(id, plan, sauver) {
  const { liste, actuel } = lirePlans();
  const cible = liste.find((x) => x.id === id);
  if (!cible) return;
  ecrireMeta({ plans: gardeCourant(liste, actuel, plan), planActuel: id });
  try { await sauver({ ...plan, mode: 'semaine', jours: { ...cible.jours } }); } catch { afficher(t.commun.erreur, 'danger'); }
}
async function enregistrerPlanSous(nom, vide, plan, sauver) {
  const tb = TB();
  const { liste: avant, actuel } = lirePlans();
  const liste = gardeCourant(avant, actuel, plan);
  if (vide && !actuel && Object.values(plan.jours ?? {}).some((v) => v && v !== 'repos')) liste.push({ id: identifiantPlan(), nom: tb.planMien, jours: { ...plan.jours } });
  const id = identifiantPlan();
  liste.push({ id, nom, jours: vide ? {} : { ...plan.jours } });
  ecrireMeta({ plans: liste, planActuel: id });
  if (vide) { try { await sauver({ ...plan, jours: {} }); } catch { afficher(t.commun.erreur, 'danger'); } }
}
const renommerPlan = (id, nom) => ecrireMeta({ plans: lirePlans().liste.map((x) => (x.id === id ? { ...x, nom } : x)) });
function supprimerPlan(id) {
  const { liste, actuel } = lirePlans();
  ecrireMeta({ plans: liste.filter((x) => x.id !== id), planActuel: actuel === id ? '' : actuel });
}

/** Corps d'une requête d'enregistrement : tout le programme, avec les changements voulus. */
const corpsDe = (r, patch = {}) => ({
  nom: r.nom, dossier: dossierDe(r), ...(r.couleur ? { couleur: r.couleur } : {}), lies: r.lies ?? [], ...patch,
  exercices: (r.exercices ?? []).map((e) => ({
    ex: e.ex, repos: e.repos ?? null, note: e.note ?? '',
    planifie: Array.isArray(e.planifie) && e.planifie.length ? e.planifie : Array.from({ length: nbSeries(e) }, () => ({ r: e.reps ?? null, kg: null, s: null, type: 'n' })),
  })),
});

const echapper = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Fiche à imprimer : la semaine puis chaque programme. L'impression propose l'export en PDF. */
function imprimerPdf(liste, plan) {
  const tb = TB();
  const jours = tb.jours;
  const semaine = jours.map((j, i) => {
    const r = liste.find((x) => String(x.id) === String(plan?.jours?.[String(i + 1)]));
    return `<tr><td>${echapper(j)}</td><td>${echapper(r ? r.nom : tb.repos)}</td></tr>`;
  }).join('');
  const blocs = liste.map((r) => `<h2>${echapper(r.nom)}</h2><ul>${(r.exercices ?? []).map((e) => `<li>${echapper(nomExercice(trouverExercice(e.ex)))}${dp()}${nbSeries(e)} × ${e.planifie?.find((p) => p.r)?.r ?? e.reps ?? ''}</li>`).join('')}</ul>`).join('');
  const w = window.open('', '_blank');
  if (!w) { afficher(t.commun.erreur, 'danger'); return; }
  w.document.write(`<!doctype html><meta charset="utf-8"><title>${echapper(tb.titre)}</title><style>body{font:14px system-ui;margin:32px;color:#111}td{padding:4px 18px 4px 0}h2{margin:22px 0 6px}</style><h1>${echapper(tb.titre)}</h1><table>${semaine}</table>${blocs}`);
  w.document.close();
  w.focus();
  w.print();
}


function FeuilleTexte({ titre, sous, initial = '', indice, fermer, valider }) {
  const [v, setV] = useState(initial);
  const ok = () => { if (v.trim()) valider(v.trim()); };
  return <Feuille ouverte fermer={fermer} titre={titre} sous={sous}
    pied={<button type="button" class="btn pri large" disabled={!v.trim()} onClick={ok}>{TB().ok}</button>}>
    <input class="form-input" maxLength={80} value={v} placeholder={indice} aria-label={titre}
      onInput={(ev) => setV(ev.target.value)} onKeyDown={(ev) => { if (ev.key === 'Enter') ok(); }} />
  </Feuille>;
}

const Option = ({ n, libelle, detail, danger, choisi, onClick }) => <button type="button" class={`rt-opt${danger ? ' danger' : ''}${choisi ? ' choisi' : ''}`} onClick={onClick}>
  {n && <Ic n={n} taille={18} />}<span class="rt-opt-texte"><b>{libelle}</b>{detail && <small>{detail}</small>}</span>{choisi && <Ic n="check:bold" taille={16} />}
</button>;

const Dossiers = ({ liste, menu }) => liste.length ? <div class="rt-grille">{liste.map((r) => <Dossier key={r.id} r={r} onMenu={() => menu(r)} />)}</div> : null;

export function Programmes() {
  const tb = TB();
  const tm6 = tm();
  const { routines, plan: planBrut } = etat.value;
  const plan = planBrut ?? { mode: 'semaine', jours: {}, index_rotation: 0 };
  const modeSegment = plan.mode === 'rotation' ? 'rotation' : 'semaine';
  const [rotation, setRotation] = useState(lireRotation);
  const [choixRotation, setChoixRotation] = useState(false);
  const [demonstration, setDemonstration] = useState(null); // 'import'
  const circuits = lireCircuits();
  useEffect(() => { migrerCircuitsLocaux(); }, []);
  const [circuit, setCircuit] = useState(null);
  const [vue, setVue] = useState(null); // { type, ... } feuille ouverte
  const [archivesOuvertes, setArchivesOuvertes] = useState(false);
  const [, rafraichir] = useState(0);
  const majRotation = (patch) => setRotation(ecrireRotation(patch));
  const fermer = () => setVue(null);

  const majPlan = async (partiel) => {
    const suivant = { ...plan, ...partiel, jours: { ...plan.jours, ...(partiel.jours || {}) } };
    try {
      await sauverPlan(suivant);
      stockerPlanCourant(suivant);
    } catch { afficher(t.commun.erreur, 'danger'); }
  };

  const utiliser = async (m) => {
    try {
      const jours = { ...plan.jours };
      for (const jour of m.jours) {
        const r = await api('POST', '/api/routines', { nom: jour.nom, dossier: m[langue], exercices: exercicesDuModele(jour) });
        if (jour.weekday) { jours[String(jour.weekday)] = r.id; enregistrerCouleur(r.id, TEINTES_DOSSIER[0]); }
      }
      await sauverPlan({ ...plan, mode: 'semaine', jours });
      await charger();
      afficher(tm6.v6.ajoutes(m.jours.length));
    } catch { afficher(t.commun.erreur, 'danger'); }
  };

  const visibles = routines.filter((r) => !estArchive(r));
  const archives = routines.filter(estArchive);
  // Ordre et repli des groupes sur le compte (GymMane : moveGroup, collapsedGroups).
  const modGroupes = lireModule('groupes') || {};
  const ordreGroupes = Array.isArray(modGroupes.ordre) ? modGroupes.ordre : [];
  const replies = new Set(Array.isArray(modGroupes.replies) ? modGroupes.replies : []);
  const naturels = [...new Set(visibles.map(dossierDe).filter(Boolean))];
  const rang = (g) => { const i = ordreGroupes.indexOf(g); return i < 0 ? ordreGroupes.length + naturels.indexOf(g) : i; };
  const groupes = [...naturels].sort((a, b) => rang(a) - rang(b));
  const ecrireGroupes = (patch) => ecrireModule('groupes', { ...modGroupes, ordre: groupes, replies: [...replies], ...patch }).catch(() => afficher(t.commun.erreur, 'danger'));
  const basculerGroupe = (g) => ecrireGroupes({ replies: replies.has(g) ? [...replies].filter((x) => x !== g) : [...replies, g] });
  const deplacerGroupe = (g, sens) => {
    const l = [...groupes]; const i = l.indexOf(g); const j = i + sens;
    if (i < 0 || j < 0 || j >= l.length) return;
    l.splice(j, 0, l.splice(i, 1)[0]);
    ecrireGroupes({ ordre: l });
  };
  const rotationListe = routinesDeRotation(rotation, routines);
  const plans = lirePlans();

  const enregistrerArchive = (r, on) => {
    const set = new Set(archivesLues());
    if (on) set.add(String(r.id)); else set.delete(String(r.id));
    ecrireMeta({ archives: [...set] });
    rafraichir((x) => x + 1);
  };
  const archiver = (r) => {
    const on = !estArchive(r);
    enregistrerArchive(r, on);
    afficher(on ? tb.archivee : tb.restaurer, 'ok', { libelle: tb.annuler, fn: () => enregistrerArchive(r, !on) });
  };

  const modifierRoutines = async (liste, fn) => {
    try { for (const r of liste) await fn(r); await charger(); } catch { afficher(t.commun.erreur, 'danger'); }
  };
  const dupliquer = (r) => modifierRoutines([r], async (x) => {
    const c = couleurRoutine(x.id);
    const nouvelle = await api('POST', '/api/routines', corpsDe(x, { nom: tb.copieNom(x.nom) }));
    if (c) enregistrerCouleur(nouvelle.id, c);
  });
  const supprimerRoutine = (r) => modifierRoutines([r], async (x) => { await api('DELETE', `/api/routines/${x.id}`); });
  const renommerGroupe = async (ancien, nouveau) => {
    await modifierRoutines(routines.filter((r) => dossierDe(r) === ancien), (r) => api('PUT', `/api/routines/${r.id}`, corpsDe(r, { dossier: nouveau })));
    const n = nouveau.trim();
    ecrireGroupes({
      ordre: n ? groupes.map((g) => (g === ancien ? n : g)) : groupes.filter((g) => g !== ancien),
      replies: [...replies].filter((g) => g !== ancien).concat(replies.has(ancien) && n ? [n] : []),
    });
  };
  const supprimerGroupe = (nom) => modifierRoutines(routines.filter((r) => dossierDe(r) === nom), (r) => api('DELETE', `/api/routines/${r.id}`));

  // Réglage « Plusieurs programmes par jour » : la feuille reste ouverte et chaque programme se coche ou se décoche (togglePlanDay).
  const multi = lireM13().multiPlan === true;
  const ecrireExtras = (k, l) => { const x = { ...(lireModule('planExtras') || {}) }; if (l.length) x[k] = l; else delete x[k]; return ecrireModule('planExtras', x).catch(() => afficher(t.commun.erreur, 'danger')); };
  const choisirJour = async (k, id) => {
    if (!multi || id == null) {
      if ((lireModule('planExtras') || {})[k]) await ecrireExtras(k, []); // assignRoutineToDay retire aussi les ajouts du jour
      await majPlan({ jours: { [k]: id == null ? 'repos' : Number(id) } }); fermer(); return;
    }
    const base = plan.jours[k] ?? plan.jours[Number(k)];
    const extras = extrasDuJour(k).map(String);
    const cle = String(id);
    if (base != null && base !== 'repos' && String(base) === cle) {
      if (extras.length) { await majPlan({ jours: { [k]: Number(extras[0]) } }); await ecrireExtras(k, extras.slice(1).map(Number)); }
      else await majPlan({ jours: { [k]: 'repos' } });
    } else if (extras.includes(cle)) await ecrireExtras(k, extras.filter((x) => x !== cle).map(Number));
    else if (base == null || base === 'repos') await majPlan({ jours: { [k]: Number(id) } });
    else await ecrireExtras(k, [...extras.map(Number), Number(id)]);
  };
  const prevuLe = (k, id) => String(plan.jours[k] ?? plan.jours[Number(k)]) === String(id) || extrasDuJour(k).map(String).includes(String(id));

  const jourAujourdhui = ((new Date().getDay() + 6) % 7) + 1;
  const nomJour = (i) => {
    const v = plan.jours[String(i + 1)] ?? plan.jours[i + 1];
    const ids = [...(v && v !== 'repos' ? [v] : []), ...extrasDuJour(String(i + 1))];
    const noms = ids.map((id) => routines.find((x) => String(x.id) === String(id))?.nom).filter(Boolean);
    return noms.length ? noms.join(' + ') : null;
  };

  const partageHebdo = (liste) => {
    const planifiees = liste.filter((r) => Object.values(plan.jours ?? {}).some((v) => String(v) === String(r.id)));
    return [...planifiees, ...liste.filter((r) => !planifiees.includes(r))];
  };

  return <main class="ecran rt-ecran">
    <EnTete titre={tb.titre} actions={<>
      <Rond n="download-simple" label={tb.importer} onClick={() => setDemonstration('import')} icone={17} />
      {visibles.length > 0 && <Rond n="share-network" label={tb.partagerSemaine} onClick={() => setVue({ type: 'partage' })} icone={17} />}
    </>} />

    <div class="rt-etiq-ligne">
      <p class="rt-etiq">{modeSegment === 'rotation' ? tb.rotation : tb.planHebdo}</p>
      <div class="rt-seg" role="radiogroup" aria-label={tb.planHebdo}>
        <button type="button" role="radio" aria-checked={modeSegment === 'semaine'} onClick={() => modeSegment !== 'semaine' && majPlan({ mode: 'semaine' })}>{tb.semaineFixe}</button>
        <button type="button" role="radio" aria-checked={modeSegment === 'rotation'} onClick={() => modeSegment !== 'rotation' && majPlan({ mode: 'rotation' })}>{tb.rotationBtn}</button>
      </div>
    </div>

    {modeSegment === 'semaine' ? <>
      <section class="rt-semaine">
        {tb.jours.map((lib, i) => {
          const nom = nomJour(i);
          return <button key={i} type="button" class="rt-jour" onClick={() => setVue({ type: 'jour', i })}>
            <span class={i + 1 === jourAujourdhui ? 'aujourdhui' : ''}>{lib}</span>
            <em class={nom ? '' : 'repos'}>{nom ?? tb.repos}</em>
            <Ic n="caret-right" taille={14} />
          </button>;
        })}
      </section>
      {/* Comme l'original : la rangée des plans n'apparaît qu'avec au moins un programme. */}
      {visibles.length > 0 && <div class="rt-plans">
        {plans.liste.map((p) => <button key={p.id} type="button" class={`rt-puce${p.id === plans.actuel ? ' actif' : ''}`}
          onClick={() => (p.id === plans.actuel ? setVue({ type: 'planMenu', p }) : changerPlan(p.id, plan, sauverPlan))}>{p.nom}</button>)}
        <button type="button" class="rt-puce rt-puce-nouveau" onClick={() => setVue({ type: 'planNouveau' })}><Ic n="plus:bold" taille={13} />{tm6.v6.planNouveau}</button>
      </div>}
    </> : <CarteRotation rotation={rotation} liste={rotationListe} majRotation={majRotation} ouvrirChoix={() => setChoixRotation(true)} />}

    {enCours.value && <p class="note-etat" role="status">{tm6.liste.seanceEnCours}</p>}

    <p class="rt-etiq rt-etiq-section">{tb.tesProgrammes}</p>
    {visibles.length === 0
      ? <p class="rt-aucun">{tb.aucun}</p>
      : <>
        {groupes.map((g) => {
          const liste = visibles.filter((r) => dossierDe(r) === g);
          const ouvert = !replies.has(g);
          return <div key={g} class="rt-groupe-bloc">
            <div class="rt-groupe-tete">
              <button type="button" class="rt-groupe" aria-expanded={ouvert} onClick={() => basculerGroupe(g)}>
                <Ic n="folder-simple" taille={15} /><span>{g}</span><em>{liste.length}</em><Ic n="caret-down:bold" taille={13} classe={`rt-groupe-fleche${ouvert ? ' ouvert' : ''}`} />
              </button>
              <button type="button" class="rt-groupe-menu" aria-label={`${tb.plusOptions}${dp()}${g}`} onClick={() => setVue({ type: 'groupe', g, n: liste.length })}>
                <Ic n="dots-three:bold" taille={18} />
              </button>
            </div>
            <div class={`rt-groupe-corps${ouvert ? ' ouvert' : ''}`}><div><Dossiers liste={liste} menu={(r) => setVue({ type: 'routine', r })} /></div></div>
          </div>;
        })}
        {groupes.length > 0 && visibles.some((r) => !dossierDe(r)) && <div class="rt-groupe-espace" />}
        <Dossiers liste={visibles.filter((r) => !dossierDe(r))} menu={(r) => setVue({ type: 'routine', r })} />
      </>}

    {archives.length > 0 && <div>
      <button type="button" class="rt-groupe rt-archive" aria-expanded={archivesOuvertes} onClick={() => setArchivesOuvertes(!archivesOuvertes)}>
        <Ic n="archive" taille={15} /><span>{tb.archivees}</span><em>{archives.length}</em><Ic n={archivesOuvertes ? 'caret-up:bold' : 'caret-down:bold'} taille={14} />
      </button>
      {archivesOuvertes && <div class="rt-archives"><Dossiers liste={archives} menu={(r) => setVue({ type: 'routine', r })} /></div>}
    </div>}

    <div class="rt-boutons">
      <a class="btn pri large" href="#/programme/nouveau">{tb.nouveau}</a>
      <button type="button" class="btn rt-fantome" onClick={() => setVue({ type: 'modeles' })}><Ic n="stack" taille={16} />{tb.modeles}</button>
      <button type="button" class="btn rt-fantome" onClick={() => setDemonstration('import')}><Ic n="download-simple" taille={16} />{tb.importer}</button>
      <a class="btn rt-fantome" href="#/programme/ia"><Ic n="sparkle" taille={16} />{tb.ia}</a>
    </div>

    {/* Circuits (circuit_screen.dart, CircuitSection) */}
    <section class="rt-circuits">
      <div class="rt-circuits-tete">
        <p class="rt-etiq">{tm6.v6.circuits}</p>
        {circuits.length > 0 && <button type="button" class="rt-circuit-plus" aria-label={tm6.v6.nouveauCircuit} onClick={() => setCircuit({ brouillon: true })}><Ic n="plus:bold" taille={14} /></button>}
      </div>
      {circuits.length === 0
        ? <button type="button" class="rt-circuit-nouveau" onClick={() => setCircuit({ brouillon: true })}>
          <span class="rt-circuit-ic"><Ic n="timer" taille={19} /></span>
          <span class="rt-circuit-texte"><b>{tm6.v6.nouveauCircuit}</b><small>{tm6.v6.circuitsAide}</small></span>
          <Ic n="plus:bold" taille={15} />
        </button>
        : circuits.map((c) => <div class="rt-circuit" key={c.id}>
          <button type="button" class="rt-circuit-texte" onClick={() => setCircuit({ ...c, brouillon: true })}>
            <b>{c.nom}</b><small>{tm6.circuit.resume(c.etapes.length, c.tours, horloge(tempsCircuit(c)))}</small>
            {c.etapes.length > 0 && <em>{c.etapes.map((e) => nomExercice(trouverExercice(e.ex))).filter(Boolean).join(' · ')}</em>}
          </button>
          <button type="button" class="rt-circuit-go" aria-label={`${tm6.v6.demarrer}${dp()}${c.nom}`} disabled={!c.etapes.length} onClick={() => setCircuit({ ...c })}><Ic n="play:fill" taille={18} /></button>
        </div>)}
    </section>

    {/* Choix du programme d'un jour */}
    {vue?.type === 'jour' && <Feuille ouverte fermer={fermer} titre={tb.definirJour(tb.joursLongs[vue.i])} sous={multi ? tb.multiAide : undefined}>
      <div class="rt-options">
        <Option n="moon-stars" libelle={tb.repos} choisi={!nomJour(vue.i)} onClick={() => choisirJour(String(vue.i + 1), null)} />
        {[...groupes.flatMap((g) => visibles.filter((r) => dossierDe(r) === g)), ...visibles.filter((r) => !dossierDe(r))].map((r) =>
          <Option key={r.id} libelle={r.nom} detail={dossierDe(r) || null} choisi={prevuLe(String(vue.i + 1), r.id)} onClick={() => choisirJour(String(vue.i + 1), r.id)} />)}
      </div>
    </Feuille>}

    {/* Partage */}
    {vue?.type === 'partage' && <Feuille ouverte fermer={fermer} titre={tb.partagerSemaine}>
      <div class="rt-options">
        <Option n="calendar-dots" libelle={tb.partagerSemaine} detail={tb.partagerSemaineAide} onClick={() => { fermer(); partagerProgrammes(partageHebdo(visibles), tb.planHebdo); }} />
        <Option n="file-pdf" libelle={tb.pdfPlan} detail={tb.pdfPlanAide} onClick={() => { fermer(); imprimerPdf(partageHebdo(visibles), plan); }} />
      </div>
      <p class="rt-etiq rt-etiq-section">{tb.partagerRoutine.toUpperCase()}</p>
      <div class="rt-options">
        {[...groupes.flatMap((g) => visibles.filter((r) => dossierDe(r) === g)), ...visibles.filter((r) => !dossierDe(r))].map((r) =>
          <Option key={r.id} n="list-checks" libelle={r.nom} detail={[dossierDe(r), tb.exosN(nbExercicesValides(r))].filter(Boolean).join(' · ')} onClick={() => { fermer(); partagerProgrammes([r], r.nom); }} />)}
      </div>
    </Feuille>}

    {/* Menu d'un programme */}
    {vue?.type === 'routine' && <Feuille ouverte fermer={fermer} titre={vue.r.nom} sous={tb.exosN(nbExercicesValides(vue.r))}>
      <div class="rt-options">
        <Option n="pencil-simple" libelle={tb.modifier} onClick={() => { fermer(); location.hash = `#/programme/${vue.r.id}`; }} />
        {vue.r.exercices.length > 0 && <Option n="play" libelle={tb.demarrer} onClick={() => { fermer(); lancer(vue.r); }} />}
        <Option n="share-network" libelle={tb.partagerRoutine} onClick={() => { fermer(); partagerProgrammes([vue.r], vue.r.nom); }} />
        {vue.r.exercices.length > 0 && <Option n="file-pdf" libelle={tb.pdf} onClick={() => { fermer(); imprimerPdf([vue.r], plan); }} />}
        <Option n="copy" libelle={tb.dupliquer} onClick={() => { fermer(); dupliquer(vue.r); }} />
        <Option n={estArchive(vue.r) ? 'arrow-u-up-left' : 'archive'} libelle={estArchive(vue.r) ? tb.restaurer : tb.archiver} onClick={() => { fermer(); archiver(vue.r); }} />
        <Option n="trash" danger libelle={tb.supprimer} onClick={() => setVue({ type: 'routineSuppr', r: vue.r })} />
      </div>
    </Feuille>}
    {vue?.type === 'routineSuppr' && <Dialogue ouvert fermer={fermer} titre={tb.supprimerTitre} texte={vue.r.nom} libelle={tb.supprimer} danger
      confirmer={async () => { fermer(); await supprimerRoutine(vue.r); }} />}

    {/* Menu d'un groupe */}
    {vue?.type === 'groupe' && <Feuille ouverte fermer={fermer} titre={vue.g} sous={tb.routinesN(vue.n)}>
      <div class="rt-options">
        {groupes.indexOf(vue.g) > 0 && <Option n="arrow-up" libelle={tb.groupeMonter} onClick={() => { fermer(); deplacerGroupe(vue.g, -1); }} />}
        {groupes.indexOf(vue.g) < groupes.length - 1 && <Option n="arrow-down" libelle={tb.groupeDescendre} onClick={() => { fermer(); deplacerGroupe(vue.g, 1); }} />}
        <Option n="pencil-simple" libelle={tb.groupeRenommer} onClick={() => setVue({ type: 'groupeNom', g: vue.g })} />
        <Option n="folder-simple-minus" libelle={tb.groupeDissoudre} onClick={() => { fermer(); renommerGroupe(vue.g, ''); }} />
        <Option n="trash" danger libelle={tb.groupeSupprimer} onClick={() => setVue({ type: 'groupeSuppr', g: vue.g, n: vue.n })} />
      </div>
    </Feuille>}
    {vue?.type === 'groupeNom' && <FeuilleTexte titre={tb.groupeRenommer} initial={vue.g} indice={tb.groupeNomAide} fermer={fermer}
      valider={(v) => { fermer(); if (v !== vue.g) renommerGroupe(vue.g, v); }} />}
    {vue?.type === 'groupeSuppr' && <Dialogue ouvert fermer={fermer} titre={tb.groupeSupprimerTitre(vue.g)} texte={tb.groupeSupprimerTexte(tb.routinesN(vue.n))} libelle={tb.supprimer} danger
      confirmer={async () => { fermer(); await supprimerGroupe(vue.g); }} />}

    {/* Plans enregistrés */}
    {vue?.type === 'planNouveau' && <Feuille ouverte fermer={fermer} titre={tb.planNouveau} sous={tb.plansAide}>
      <div class="rt-options">
        <Option n="floppy-disk" libelle={tb.planEnregistrer} detail={tb.planEnregistrerAide} onClick={() => setVue({ type: 'planNom', vide: false })} />
        <Option n="calendar-blank" libelle={tb.planVide} detail={tb.planVideAide} onClick={() => setVue({ type: 'planNom', vide: true })} />
      </div>
    </Feuille>}
    {vue?.type === 'planNom' && <FeuilleTexte titre={tb.planNom} indice={tb.planNomAide} fermer={fermer}
      valider={async (v) => { fermer(); await enregistrerPlanSous(v, vue.vide, plan, sauverPlan); rafraichir((x) => x + 1); afficher(tb.planSauve); }} />}
    {vue?.type === 'planMenu' && <Feuille ouverte fermer={fermer} titre={vue.p.nom} sous={tb.plansAide}>
      <div class="rt-options">
        <Option n="pencil-simple" libelle={tb.planRenommer} onClick={() => setVue({ type: 'planRenom', p: vue.p })} />
        <Option n="trash" danger libelle={tb.planSupprimer} onClick={() => setVue({ type: 'planSuppr', p: vue.p })} />
      </div>
    </Feuille>}
    {vue?.type === 'planRenom' && <FeuilleTexte titre={tb.planNom} initial={vue.p.nom} indice={tb.planNomAide} fermer={fermer}
      valider={(v) => { fermer(); renommerPlan(vue.p.id, v); rafraichir((x) => x + 1); }} />}
    {vue?.type === 'planSuppr' && <Dialogue ouvert fermer={fermer} titre={tb.planSupprimer} texte={tb.planSupprimerTexte} libelle={tb.supprimer} danger
      confirmer={async () => { fermer(); supprimerPlan(vue.p.id); rafraichir((x) => x + 1); afficher(tb.planSuppr); }} />}

    {/* Programmes prêts à l'emploi */}
    {vue?.type === 'modeles' && <Feuille ouverte fermer={fermer} titre={tb.modeles} sous={tm6.v6.modelesAide}>
      <div class="rt-modeles">{MODELES.map((m) => <button key={m.id} type="button" class="rt-modele" onClick={() => { fermer(); utiliser(m); }}>
        <span class="rt-modele-ic"><Ic n="stack" taille={20} /></span>
        <span class="rt-modele-texte"><b>{m[langue]}</b><small>{tm6.v6.blurbs[m.id]}</small><em>{tm6.v6.joursN(m.jours.length)}</em></span>
        <Ic n="plus" taille={16} />
      </button>)}</div>
    </Feuille>}

    <Feuille ouverte={choixRotation} fermer={() => setChoixRotation(false)} titre={tm6.rotation.titre} sous={tm6.rotation.aide}
      pied={<button type="button" class="btn pri large" onClick={() => setChoixRotation(false)}>{tm6.editeur.terminer}</button>}>
      <div class="pile">
        {routines.map((r) => {
          const on = rotation.ordre.some((id) => String(id) === String(r.id));
          return <button key={r.id} type="button" class={`ligne-dossier${on ? ' on' : ''}`} aria-pressed={on}
            onClick={() => majRotation({ ordre: on ? rotation.ordre.filter((id) => String(id) !== String(r.id)) : [...rotation.ordre, r.id] })}>
            <Ic n={on ? 'check-circle' : 'circle'} taille={18} /><span>{r.nom}</span>
          </button>;
        })}
        {!routines.length && <p class="muted">{tm6.liste.vide}</p>}
      </div>
    </Feuille>

    {demonstration && <FeuilleImport fermer={() => setDemonstration(null)} plan={plan} />}

    {circuit && (circuit.brouillon
      ? <FeuilleCircuit valeur={circuit} fermer={() => setCircuit(null)} enregistrer={async (c) => {
        try {
          const i = circuits.findIndex((x) => x.id === c.id);
          await ecrireCircuits(i < 0 ? [...circuits, c] : circuits.map((x) => (x.id === c.id ? c : x)));
          setCircuit(null);
        } catch { afficher(t.commun.erreur, 'danger'); }
      }} supprimer={async (id) => {
        try { await ecrireCircuits(circuits.filter((x) => x.id !== id)); setCircuit(null); } catch { afficher(t.commun.erreur, 'danger'); }
      }} />
      : <CircuitLance circuit={circuit} fermer={() => setCircuit(null)} />)}
  </main>;
}

// Circuits : gardés sur le compte (extensions.modules.m06), avec leur chrono par exercice.
const lireCircuits = () => {
  const l = etat.value?.profil?.extensions?.modules?.m06?.circuits;
  return Array.isArray(l) ? l : [];
};
const ecrireCircuits = (liste) => sauverExtensions({ modules: { ...(etat.value.profil.extensions.modules || {}), m06: { ...(etat.value.profil.extensions.modules?.m06 || {}), circuits: liste } } });
/** Reprend une seule fois les circuits d'avant, gardés dans le navigateur, vers le compte. */
async function migrerCircuitsLocaux() {
  const locaux = lireMeta().circuits;
  if (!Array.isArray(locaux) || !locaux.length) return;
  const ids = new Set(lireCircuits().map((c) => c.id));
  try {
    await ecrireCircuits([...lireCircuits(), ...locaux.filter((c) => c && !ids.has(c.id))]);
    ecrireMeta({ circuits: [] });
  } catch { /* nouvel essai à la prochaine ouverture */ }
}
// Comme Circuit.totalSeconds : pas de repos après le dernier exercice d'un tour, ni après le dernier tour.
const tempsCircuit = (c) => c.tours * c.etapes.reduce((a, e, i) => a + e.effort + (i < c.etapes.length - 1 ? e.repos : 0), 0) + c.reposTour * Math.max(0, c.tours - 1);
const dureeTexte = (s) => (s >= 60 ? `${Math.floor(s / 60)} min${s % 60 ? ` ${String(s % 60).padStart(2, '0')}` : ''}` : `${s} s`);

/** Choix d'une durée en secondes (askRuler de GymMane) : pas de 5 s, « Sans minuteur » si zéro est permis. */
function FeuilleSecondes({ titre, valeur, min = 5, zero = false, fermer, valider }) {
  const v = tm().v6;
  const [s, setS] = useState(valeur);
  return <Feuille ouverte fermer={fermer} titre={titre}
    pied={<>{zero && <button type="button" class="btn large" onClick={() => valider(0)}>{v.sansMinuteur}</button>}
      <button type="button" class="btn pri large" onClick={() => valider(s)}>OK</button></>}>
    <div class="stepper rt-secondes">
      <button type="button" aria-label={`${t.commun.moins}${dp()}${titre}`} disabled={s <= min} onClick={() => setS(Math.max(min, s - 5))}>−</button>
      <output aria-live="polite">{horloge(s)}</output>
      <button type="button" aria-label={`${t.commun.plus}${dp()}${titre}`} disabled={s >= 600} onClick={() => setS(Math.min(600, s + 5))}>+</button>
    </div>
  </Feuille>;
}

/** Éditeur de circuit (circuit_screen.dart, _CircuitEditor). */
function FeuilleCircuit({ valeur, fermer, enregistrer, supprimer }) {
  const v = tm().v6;
  const nouveau = !valeur.id;
  const [nom, setNom] = useState(valeur.nom ?? '');
  const [tours, setTours] = useState(valeur.tours ?? 3);
  const [reposTour, setReposTour] = useState(valeur.reposTour ?? 60);
  const [etapes, setEtapes] = useState(valeur.etapes ?? []);
  const [choix, setChoix] = useState(false);
  const [duree, setDuree] = useState(null); // { titre, valeur, min, zero, poser }
  const [suppr, setSuppr] = useState(false);
  const [erreur, setErreur] = useState('');
  const majEtape = (i, champs) => setEtapes((l) => l.map((x, k) => (k === i ? { ...x, ...champs } : x)));

  const enregistrerClic = () => {
    if (!etapes.length) { setErreur(v.circuitVide); afficher(tm().circuit.aucuneEtape, 'danger'); return; }
    const d = etapes[etapes.length - 1];
    enregistrer({ id: valeur.id ?? `c${Date.now()}`, nom: nom.trim() || 'Circuit', tours, reposTour, effortDefaut: d.effort, reposDefaut: d.repos, etapes });
  };
  const total = tempsCircuit({ tours, reposTour, etapes });

  return <Feuille ouverte fermer={fermer} titre={nouveau ? v.nouveauCircuit : v.modifierCircuit} large={0.92}
    pied={<div class="rt-circuit-pied">
      <button type="button" class="btn pri large" onClick={enregistrerClic}>{v.enregistrer}</button>
      {!nouveau && <button type="button" class="btn lien danger" onClick={() => setSuppr(true)}>{v.supprimer}</button>}
    </div>}>
    <input class="rt-circuit-nom" maxLength={60} value={nom} placeholder={v.circuitNom} aria-label={v.circuitNom}
      onInput={(ev) => { setNom(ev.target.value); setErreur(''); }} />
    <div class="rt-reglages">
      <div class="rt-reglage"><span>{v.tours}</span>
        <div class="stepper rt-pas">
          <button type="button" aria-label={`${t.commun.moins}${dp()}${v.tours}`} disabled={tours <= 1} onClick={() => setTours(tours - 1)}>−</button>
          <output>{tours}</output>
          <button type="button" aria-label={`${t.commun.plus}${dp()}${v.tours}`} disabled={tours >= 50} onClick={() => setTours(tours + 1)}>+</button>
        </div></div>
      {tours > 1 && <button type="button" class="rt-reglage" onClick={() => setDuree({ titre: v.reposTours, valeur: reposTour || 60, min: 5, zero: true, poser: setReposTour })}>
        <span>{v.reposTours}</span><em class="sauge">{reposTour === 0 ? v.sansMinuteur : horloge(reposTour)}</em></button>}
    </div>
    {etapes.length === 0 && <p class="rt-circuit-vide">{v.circuitVide}</p>}
    {etapes.length > 0 && <div class="rt-etapes">{etapes.map((e, i) => {
      const def = trouverExercice(e.ex);
      const nomEx = nomExercice(def) || e.ex;
      return <div class="rt-etape" data-ligne key={`${e.ex}-${i}`}>
        <button type="button" class="rt-poignee" aria-label={v.deplacer(nomEx)} {...poigneeReordre(i, etapes.length, (x, y) => setEtapes((l) => deplacerDans(l, x, y)))}><Ic n="dots-six-vertical" taille={18} /></button>
        <span class="rt-vignette" aria-hidden="true"><IllustrationExercice exo={def || { id: e.ex }} taille={44} /></span>
        <div class="rt-etape-texte"><b>{nomEx}</b>
          <div class="rt-etape-puces">
            <button type="button" class="rt-puce-temps accent" onClick={() => setDuree({ titre: v.effort, valeur: e.effort, min: 5, poser: (x) => majEtape(i, { effort: x }) })}>{v.effort} {horloge(e.effort)}</button>
            {i < etapes.length - 1 && <button type="button" class="rt-puce-temps sauge" onClick={() => setDuree({ titre: v.repos, valeur: e.repos || 15, min: 5, zero: true, poser: (x) => majEtape(i, { repos: x }) })}>{v.repos} {e.repos === 0 ? '0 s' : horloge(e.repos)}</button>}
          </div></div>
        <button type="button" class="rt-icone" aria-label={v.dupliquer} onClick={() => setEtapes((l) => [...l.slice(0, i + 1), { ...e }, ...l.slice(i + 1)])}><Ic n="copy" taille={17} /></button>
        <button type="button" class="rt-icone" aria-label={v.supprimer} onClick={() => setEtapes((l) => l.filter((_, k) => k !== i))}><Ic n="x" taille={16} /></button>
      </div>;
    })}</div>}
    <button type="button" class="btn rt-fantome" onClick={() => setChoix(true)}><Ic n="plus:bold" taille={16} />{v.ajouterExercice}</button>
    {etapes.length > 0 && <p class="rt-circuit-resume">{tm().circuit.resume(etapes.length, tours, horloge(total))}</p>}
    {erreur && <p class="erreur-champ" role="alert">{erreur}</p>}
    <ChoixExercices ouverte={choix} fermer={() => setChoix(false)} choisir={(ids) => {
      setEtapes((l) => { const d = l[l.length - 1]; return [...l, ...ids.map((x) => ({ ex: x, effort: d?.effort ?? 40, repos: d?.repos ?? 15 }))]; });
      setChoix(false); setErreur('');
    }} />
    {duree && <FeuilleSecondes titre={duree.titre} valeur={duree.valeur} min={duree.min} zero={duree.zero} fermer={() => setDuree(null)}
      valider={(x) => { duree.poser(x); setDuree(null); }} />}
    <Dialogue ouvert={suppr} fermer={() => setSuppr(false)} titre={tm().circuit.supprimerTitre(nom || 'Circuit')} texte={tm().circuit.supprimerTexte}
      libelle={v.supprimer} danger confirmer={async () => { setSuppr(false); await supprimer(valeur.id); }} />
  </Feuille>;
}

/** Circuit lancé : préparation, effort, repos, tour après tour, puis séance enregistrée. */
function CircuitLance({ circuit, fermer }) {
  const tm6 = tm();
  const total = tempsCircuit(circuit);
  const [etape, setEtape] = useState({ phase: 'prepa', index: 0, tour: 1, restant: 5, pause: false });
  const [arreter, setArreter] = useState(false);
  const [fini, setFini] = useState(false);

  useEffect(() => {
    if (etape.pause || fini) return undefined;
    if (etape.restant > 0) {
      const i = setTimeout(() => setEtape((e) => ({ ...e, restant: e.restant - 1 })), 1000);
      return () => clearTimeout(i);
    }
    setEtape((e) => {
      if (e.phase === 'prepa') return { ...e, phase: 'effort', restant: circuit.etapes[0].effort };
      if (e.phase === 'effort') {
        const r = circuit.etapes[e.index].repos;
        return r > 0 ? { ...e, phase: 'repos', restant: r } : etapeSuivante(e);
      }
      if (e.phase === 'repos') return etapeSuivante(e);
      if (e.phase === 'reposTour') return { ...e, phase: 'effort', index: 0, tour: e.tour + 1, restant: circuit.etapes[0].effort };
      return e;
    });
    return undefined;
  }, [etape, fini]);

  function etapeSuivante(e) {
    if (e.index < circuit.etapes.length - 1) return { ...e, phase: 'effort', index: e.index + 1, restant: circuit.etapes[e.index + 1].effort };
    if (e.tour < circuit.tours) return { ...e, phase: 'reposTour', restant: circuit.reposTour };
    setFini(true);
    return e;
  }

  useEffect(() => {
    if (!fini) return undefined;
    (async () => {
      try {
        await api('POST', '/api/seances', {
          cle: crypto.randomUUID(),
          debut: new Date().toISOString(),
          duree_s: Math.round(total),
          nom: circuit.nom,
          note: '',
          exercices: circuit.etapes.map((e, i) => ({
            ex: e.ex, note: '', lie: i < circuit.etapes.length - 1,
            series: Array.from({ length: circuit.tours }, () => ({ r: null, kg: null, s: e.effort, type: 'n', fait: true })),
          })),
        });
        await charger();
        afficher(tm6.circuit.termine);
      } catch { afficher(t.commun.erreur, 'danger'); }
    })();
    return undefined;
  }, [fini]);

  if (fini) return <div class="voile"><div class="feuille" role="dialog" aria-modal="true" aria-label={tm6.circuit.termine}>
    <span class="poignee" aria-hidden="true" />
    <h2 class="feuille-titre">{tm6.circuit.termine}</h2>
    <p class="feuille-sous">{tm6.circuit.termineTexte(dureeTexte(total))}</p>
    <div class="feuille-pied"><button type="button" class="btn pri large" onClick={fermer}>{tm6.editeur.terminer}</button></div>
  </div></div>;

  const actuelle = circuit.etapes[etape.index];
  const suivante = circuit.etapes[etape.index + 1];
  return <div class="voile" role="dialog" aria-modal="true" aria-label={tm6.circuit.titre}>
    <div class="feuille large" style="align-items:center;text-align:center">
      <span class="poignee" aria-hidden="true" />
      <p class="kicker">{etape.phase === 'prepa' ? tm6.circuit.prepa : tm6.circuit.tourN(etape.tour, circuit.tours)}</p>
      <p class="dock-temps" style="font-size:64px;line-height:1;margin:18px 0" aria-live="polite">{dureeTexte(etape.restant)}</p>
      <p style="font-size:20px;font-weight:800">{etape.phase === 'reposTour' ? tm6.circuit.reposTour : nomExercice(trouverExercice(actuelle.ex))}</p>
      <p class="muted">{etape.phase === 'effort' ? tm6.circuit.effort : tm6.circuit.repos}</p>
      {etape.phase !== 'prepa' && <p class="muted petit-texte">{suivante ? tm6.circuit.ensuite(nomExercice(trouverExercice(suivante.ex))) : tm6.circuit.dernier}</p>}
      <div class="feuille-pied" style="width:100%;margin-top:22px">
        <button type="button" class="btn secondaire" onClick={() => setEtape((e) => ({ ...e, pause: !e.pause }))}>{etape.pause ? tm6.circuit.reprendre : tm6.circuit.pause}</button>
        <button type="button" class="btn" onClick={() => setEtape((e) => etapeSuivante(e))}>{tm6.circuit.suivant}</button>
      </div>
      <button type="button" class="btn lien danger centre-bloc" onClick={() => setArreter(true)}>{tm6.circuit.arreter}</button>
      <Dialogue ouvert={arreter} fermer={() => setArreter(false)} titre={tm6.circuit.arreterTitre} texte={tm6.circuit.arreterTexte}
        libelle={tm6.circuit.arreter} danger confirmer={async () => { setArreter(false); setFini(true); }} />
    </div>
  </div>;
}

/** Carte de rotation (routines_screen.dart, _rotationCard) : aide, barre de tour, lignes A, B, C, ajout, passer et nouveau tour. */
function CarteRotation({ rotation, liste, majRotation, ouvrirChoix }) {
  const v = tm().v6;
  const n = liste.length;
  const etape = n ? rotation.index % n : 0;
  const [menu, setMenu] = useState(null);
  const deplacer = (i, d) => {
    const ordre = liste.map((r) => r.id);
    const [x] = ordre.splice(i, 1);
    ordre.splice(i + d, 0, x);
    majRotation({ ordre });
  };
  const choisie = menu !== null ? liste[menu] : null;
  return <section class="rt-rotation">
    <p class="rt-rot-aide">{n ? v.rotationAide : v.rotationVide}</p>
    {n > 1 && <>
      <div class="rt-rot-barre" aria-hidden="true">{liste.map((r, i) => <i key={r.id} class={i < etape ? 'fait' : i === etape ? 'suivante' : ''} />)}</div>
      <p class="rt-rot-progres">{v.rotationProgres(etape, n)}</p>
    </>}
    {n > 0 && <div class="rt-rot-liste">{liste.map((r, i) => <button key={r.id} type="button" class={`rt-rot-ligne${i === etape ? ' suivante' : ''}`} onClick={() => setMenu(i)}>
      <span class={`rt-rot-lettre${i < etape ? ' fait' : ''}`}>{i < etape ? <Ic n="check:bold" taille={13} /> : String.fromCharCode(65 + (i % 26))}</span>
      <span class="rt-rot-texte"><b>{r.nom}</b><small>{[i === etape ? v.rotationSuivante : '', v.exercicesN(nbExercicesValides(r))].filter(Boolean).join(' · ')}</small></span>
    </button>)}</div>}
    <button type="button" class="rt-rot-ajout" onClick={ouvrirChoix}><span><Ic n="plus:bold" taille={13} /></span>{v.rotationAjouter}</button>
    {n > 1 && <div class="rt-rot-actions">
      <button type="button" onClick={() => majRotation({ index: rotation.index + 1 })}><Ic n="skip-forward" taille={14} />{v.rotationPasser}</button>
      <i aria-hidden="true" />
      <button type="button" onClick={() => majRotation({ index: 0 })}><Ic n="arrow-counter-clockwise" taille={14} />{v.rotationNouveauTour}</button>
    </div>}
    {choisie && <Feuille ouverte fermer={() => setMenu(null)} titre={choisie.nom} sous={v.exercicesN(nbExercicesValides(choisie))}>
      <div class="rt-options">
        {menu !== etape && <Option n="flag-pennant" libelle={v.rotationEnFaireSuivante} onClick={() => { majRotation({ index: menu }); setMenu(null); }} />}
        {menu > 0 && <Option n="arrow-up" libelle={v.monter} onClick={() => { deplacer(menu, -1); setMenu(null); }} />}
        {menu < n - 1 && <Option n="arrow-down" libelle={v.descendre} onClick={() => { deplacer(menu, 1); setMenu(null); }} />}
        <Option n="minus-circle" danger libelle={v.rotationRetirer} onClick={() => { majRotation({ ordre: rotation.ordre.filter((id) => String(id) !== String(choisie.id)) }); setMenu(null); }} />
      </div>
    </Feuille>}
  </section>;
}



const NUM_JOUR = { lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, dimanche: 7, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7 };
const numJour = (d) => (typeof d === 'number' ? (d >= 1 && d <= 7 ? d : null) : NUM_JOUR[String(d).toLowerCase()] ?? null);

const champ = (o, cles) => { for (const c of cles) if (o?.[c] != null) return o[c]; return null; };
const CLES_TEMPS = ['time', 'duration', 'seconds', 'sec', 'secs', 'tiempo', 'durationseconds', 'duree', 'temps'];
const CLES_DISTANCE = ['distance', 'km', 'distancekm', 'distancia'];

/** Lit un plan (JSON collé ou fichier) : programmes reconnus, noms d'exercices absents de la bibliothèque, ou null si illisible. */
// _parseCsv de plan_share.dart : une ligne par exercice, regroupées par programme (et semaine), séparateur deviné.
const normCle = (k) => String(k).toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
function csvVersPlan(texte) {
  const lignes = texte.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lignes.length) return null;
  const sep = [';', '\t', ','].reduce((a, b) => (lignes[0].split(a).length >= lignes[0].split(b).length ? a : b));
  const couper = (l) => { const out = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(c.trim()); c = ''; } else c += ch; } out.push(c.trim()); return out; };
  const rangs = lignes.map(couper);
  const tete = rangs[0].map(normCle);
  const col = (cles) => tete.findIndex((h) => cles.includes(h));
  const entier = (v) => (/^\d+$/.test(String(v).trim()) ? Number(v) : null);
  let ex = col(['exercise', 'ejercicio', 'exercisename', 'movement', 'name', 'exercice']), prog = col(['routine', 'rutina', 'workout', 'day', 'dia', 'session', 'programme', 'seance']);
  let series = col(['sets', 'series', 'setcount']), reps = col(['reps', 'repetitions', 'repeticiones', 'rep', 'repeticoes', 'ripetizioni']);
  let charge = col(['weight', 'weightkg', 'load', 'kg', 'peso', 'carga', 'lbs', 'lb', 'poids', 'charge']);
  const groupe = col(['week', 'semana', 'group', 'grupo', 'program', 'semaine']), repos = col(['rest', 'restseconds', 'restsec', 'descanso', 'pause', 'riposo', 'repos']);
  const jours = col(['weekday', 'weekdays', 'schedule', 'jours']);
  const lb = tete.some((h) => h === 'lbs' || h === 'lb' || h === 'weightlbs');
  let corps = rangs.slice(1);
  if (ex < 0) {
    const r0 = rangs[0];
    if (r0.length < 3 || entier(r0[1]) != null || entier(r0[2]) == null) return null;
    corps = rangs; prog = 0; ex = 1; series = 2; reps = 3; charge = 4;
  }
  const cell = (r, i) => (i >= 0 && i < r.length ? r[i] : '');
  const parCle = new Map();
  for (const r of corps) {
    const nom = cell(r, ex);
    if (!nom || entier(nom) != null) continue;
    const cle = `${cell(r, groupe)}|${cell(r, prog)}`;
    if (!parCle.has(cle)) parCle.set(cle, { name: cell(r, prog), group: cell(r, groupe), days: cell(r, jours).split(/[\s,/]+/).filter(Boolean), exercises: [] });
    const kg = Number(String(cell(r, charge)).replace(',', '.'));
    parCle.get(cle).exercises.push({ name: nom, sets: entier(cell(r, series)) ?? 3, reps: entier(cell(r, reps)), weight: Number.isFinite(kg) && kg > 0 ? (lb ? Math.round(kg * 0.45359237 * 100) / 100 : kg) : null, rest: entier(cell(r, repos)) });
  }
  return parCle.size ? [...parCle.values()] : null;
}

function lirePlan(texte) {
  let data;
  try { data = JSON.parse(texte); } catch { data = csvVersPlan(texte); if (!data) return null; }
  // Un programme seul (« { "name": …, "exercises": [ … ] } ») vaut une liste d'un programme.
  const bruts = Array.isArray(data?.routines) ? data.routines : Array.isArray(data) ? data : data?.exercises ? [data] : null;
  if (!bruts) return null;
  const plans = [];
  const manques = [];
  for (const brut of bruts) {
    const exercices = [];
    const lies = [];
    for (const e of Array.isArray(brut?.exercises) ? brut.exercises : []) {
      const id = e.ex ?? e.id ?? (typeof e.name === 'string' ? correspondreExerciceCatalogue(e.name)?.id : null);
      if (!id || !trouverExercice(id)) { if (typeof e.name === 'string' && e.name.trim()) manques.push(e.name.trim()); continue; }
      if (e.superset && exercices.length) lies.push(exercices[exercices.length - 1].ex);
      // Temps et distance posés sur l'exercice valent pour chaque série, sauf si la série donne les siens (GymMane 5c7e280).
      const sec = secondesPlan(champ(e, CLES_TEMPS)), km = nombrePlan(champ(e, CLES_DISTANCE));
      const serie = (r, kg, s, d, type = 'n') => ({ r: r ?? null, kg: kg ?? null, s: s ?? null, ...(d ? { km: d } : {}), type });
      const planifie = Array.isArray(e.plan) && e.plan.length
        ? e.plan.map((p) => serie(p.reps ?? e.reps, p.weight ?? (p.type === 'e' ? null : e.weight), secondesPlan(champ(p, CLES_TEMPS)) ?? sec, nombrePlan(champ(p, CLES_DISTANCE)) ?? km, p.type ?? 'n'))
        : Array.from({ length: Math.max(1, Number(e.sets) || 3) }, () => serie(e.reps, e.weight, sec, km));
      exercices.push({ ex: id, repos: e.rest ?? null, note: e.note ?? '', planifie });
    }
    if (!exercices.length) continue;
    plans.push({
      nom: String(brut.name ?? '').trim() || (langue === 'en' ? 'New routine' : 'Nouveau programme'),
      dossier: String(brut.group ?? '').trim(),
      jours: (Array.isArray(brut.days) ? brut.days : []).map(numJour).filter((x) => x != null),
      exercices,
      lies,
    });
  }
  return { plans, manques };
}

/** Programme déjà présent : même nom et mêmes exercices dans le même ordre (ownsPlan). */
const possede = (p) => etat.value.routines.some((r) => r.nom === p.nom && (r.exercices ?? []).map((e) => e.ex).join('|') === p.exercices.map((e) => e.ex).join('|'));

/** Crée les programmes lus (applyPlan) : ceux déjà présents sont sautés, sauf en copie ; le planning remplace les jours apportés. */
async function appliquerPlans(plans, { planning = false, copies = false } = {}) {
  const plan = etat.value.plan ?? { mode: 'semaine', jours: {} };
  const jours = { ...plan.jours };
  let routines = 0, ajoutes = 0;
  for (const p of plans) {
    if (!copies && possede(p)) continue;
    const corps = { nom: p.nom, exercices: p.exercices };
    if (p.dossier) corps.dossier = p.dossier;
    if (p.lies.length) corps.lies = p.lies;
    const r = await api('POST', '/api/routines', corps);
    routines++; ajoutes += p.exercices.length;
    if (planning) for (const d of p.jours) jours[String(d)] = r.id;
  }
  if (planning && routines) await sauverPlan({ ...plan, mode: 'semaine', jours });
  await charger();
  return { routines, ajoutes };
}

const lireFichier = (ev, suite) => {
  const f = ev.target.files?.[0];
  ev.target.value = '';
  if (!f) return;
  const l = new FileReader();
  l.onload = () => suite(String(l.result ?? ''));
  l.readAsText(f);
};
const lirePressePapiers = async () => { try { return (await navigator.clipboard.readText()) || ''; } catch { afficher(t.commun.erreur, 'danger'); return ''; } };

/** Feuille d'import (plan_import_sheet.dart) : aide, zone de collage, Coller et Choisir un fichier, aperçu puis ajout. */
function FeuilleImport({ fermer }) {
  const v = tm().v6;
  const [texte, setTexte] = useState('');
  const [champ, setChamp] = useState(true); // _field : la zone de texte disparaît après « Choisir un fichier »
  const [planning, setPlanning] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const lu = texte.trim() ? lirePlan(texte) : null;
  const plans = lu?.plans ?? [];
  const avecJours = plans.some((p) => p.jours.length);
  const tousLa = plans.length > 0 && plans.every(possede);
  const poser = (x) => {
    setTexte(x);
    const l = x.trim() ? lirePlan(x) : null;
    setPlanning(!!l?.plans.some((p) => p.jours.length) && !Object.values(etat.value.plan?.jours ?? {}).some((j) => j && j !== 'repos'));
  };
  const appliquer = async (copies) => {
    setOccupe(true);
    try {
      const r = await appliquerPlans(plans, { planning, copies });
      afficher(r.routines ? v.ajoutes(r.routines) : v.rien, r.routines ? 'ok' : 'danger');
      fermer();
    } catch { afficher(t.commun.erreur, 'danger'); } finally { setOccupe(false); }
  };
  return <Feuille ouverte fermer={fermer} titre={v.importTitre}>
    <div class="rt-import">
      <p class="rt-import-aide">{v.importAide}</p>
      {champ && <textarea class="rt-zone" rows={4} value={texte} placeholder={v.importExemple} aria-label={v.importTitre} onInput={(ev) => poser(ev.target.value)} />}
      <div class="rt-actions-puces">
        <button type="button" class="rt-action" onClick={async () => { const x = await lirePressePapiers(); setChamp(true); if (x.trim()) poser(x); }}><Ic n="clipboard-text" taille={15} />{v.coller}</button>
        <label class="rt-action"><Ic n="file-arrow-up" taille={15} />{v.fichier}
          <input type="file" accept=".json,.txt,.csv,application/json,text/plain,text/csv" class="masque" onChange={(ev) => lireFichier(ev, (x) => { setChamp(false); poser(x); })} /></label>
      </div>
      {plans.length > 0 && <>
        <p class="rt-etiq rt-import-compte">{`${v.programmesN(plans.length)} · ${v.exercicesN(plans.reduce((a, p) => a + p.exercices.length, 0))}`}</p>
        {plans.map((p, i) => <div class="rt-plan-lu" key={i}>
          <span class="rt-modele-ic petit"><Ic n="list-checks" taille={19} /></span>
          <span class="rt-modele-texte"><b>{p.nom}</b><small>{[p.dossier, p.jours.map((d) => TB().jours[d - 1]).join(', '), v.exercicesN(p.exercices.length)].filter(Boolean).join(' · ')}</small></span>
          {possede(p) && <span class="etiq-sauge">{v.dejaLa}</span>}
        </div>)}
        {lu.manques.length > 0 && <p class="rt-import-manque"><b>{v.manquent(lu.manques.length)}</b>{lu.manques.join(' · ')}</p>}
        {avecJours && <button type="button" class="rt-import-planning" role="switch" aria-checked={planning} onClick={() => setPlanning(!planning)}>
          <span><b>{v.planning}</b><small>{v.planningAide}</small></span><span class={`inter ${planning ? 'on' : ''}`} aria-hidden="true"><span /></span>
        </button>}
        {tousLa && <p class="rt-import-deja"><Ic n="check-circle" taille={16} />{v.dejaTous}</p>}
        {tousLa
          ? <button type="button" class="btn rt-fantome" disabled={occupe} onClick={() => appliquer(true)}><Ic n="copy" taille={16} />{v.enCopie}</button>
          : <button type="button" class="btn pri large" disabled={occupe} onClick={() => appliquer(false)}>{v.ajouterMiens}</button>}
      </>}
      {texte.trim() && !plans.length && <p class="rt-import-rien"><Ic n="warning-circle" taille={16} />{v.rien}</p>}
    </div>
  </Feuille>;
}

/** Écran « Programme avec une IA » (ai_plan_screen.dart) : plein écran, rien ne part tout seul. */
export function EcranIA() {
  const v = tm().v6;
  const [texte, setTexte] = useState('');
  const [format, setFormat] = useState(false);
  const [resultat, setResultat] = useState(null); // { illisible } | { routines, ajoutes, manques }
  const [occupe, setOccupe] = useState(false);
  const copier = async () => {
    try { await navigator.clipboard.writeText(demandePourIA()); afficher(v.copie); } catch { afficher(t.commun.erreur, 'danger'); }
  };
  const partager = async () => {
    const f = new File([demandePourIA()], 'anatoly-exercices.txt', { type: 'text/plain' });
    try {
      if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], title: v.iaTitre }); return; }
    } catch (e) { if (e?.name === 'AbortError') return; }
    const url = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = url; a.download = f.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importer = async () => {
    if (!texte.trim() || occupe) return;
    const lu = lirePlan(texte);
    if (!lu || !lu.plans.length) { setResultat(lu ? { routines: 0, ajoutes: 0, manques: lu.manques } : { illisible: true }); return; }
    setOccupe(true);
    try {
      const vide = !Object.values(etat.value.plan?.jours ?? {}).some((j) => j && j !== 'repos');
      const r = await appliquerPlans(lu.plans, { planning: vide });
      setResultat({ ...r, manques: lu.manques });
    } catch { afficher(t.commun.erreur, 'danger'); } finally { setOccupe(false); }
  };
  const bon = resultat?.ajoutes > 0;
  return <main class="ecran rt-ecran rt-ia">
    <EnTete titre={v.iaTitre} retour="#/programmes" />
    <section class="carte rt-ia-carte">
      <p class="rt-ia-horsligne"><Ic n="shield-check" taille={18} />{v.horsLigne}</p>
      <p class="rt-ia-intro">{v.iaIntro}</p>
      <ol class="rt-ia-etapes">{v.iaEtapes.map((e, i) => <li key={i}><span>{i + 1}</span><p>{e}</p></li>)}</ol>
    </section>
    <button type="button" class="btn pri large" onClick={copier}>{v.copierIa}</button>
    <button type="button" class="btn rt-fantome" onClick={partager}><Ic n="share-network" taille={16} />{v.partagerFichier}</button>
    <textarea class="rt-zone rt-ia-zone" rows={8} value={texte} placeholder={v.collerIci} aria-label={v.collerIci} onInput={(ev) => setTexte(ev.target.value)} />
    <div class="rt-actions-puces">
      <button type="button" class="rt-action fonce" onClick={async () => { const x = await lirePressePapiers(); if (x.trim()) setTexte(x); }}><Ic n="clipboard-text" taille={15} />{v.coller}</button>
      <label class="rt-action fonce"><Ic n="file-arrow-up" taille={15} />{v.fichier}
        <input type="file" accept=".json,.txt,application/json,text/plain" class="masque" onChange={(ev) => lireFichier(ev, setTexte)} /></label>
      <button type="button" class="rt-format" aria-expanded={format} onClick={() => setFormat(!format)}>{v.voirFormat}</button>
    </div>
    {format && <pre class="rt-format-texte">{JSON_PLAN}</pre>}
    <button type="button" class={`btn pri large rt-ia-importer${texte.trim() ? "" : " rt-eteint"}`} aria-disabled={!texte.trim() || occupe} onClick={importer}>{v.importer}</button>
    {resultat && <div class={`rt-ia-resultat${bon ? ' bon' : ''}`} role="status">
      <b>{resultat.illisible ? v.illisible : bon ? `${v.ajoutes(resultat.routines)} · ${v.exercicesN(resultat.ajoutes)}` : v.aucunCorrespond}</b>
      {resultat.manques?.length > 0 && <small><b class="rt-manquent">{v.manquent(resultat.manques.length)}</b>{resultat.manques.join(' · ')}</small>}
      {bon && <a href="#/programmes">{tm().liste.titre}</a>}
    </div>}
  </main>;
}

const JSON_PLAN = '{\n  "program": "Upper Lower",\n  "unit": "kg",\n  "routines": [\n    {\n      "name": "Upper A",\n      "days": ["lundi", "jeudi"],\n      "exercises": [\n        {"name": "développé couché à la barre", "sets": 4, "reps": 8, "weight": 60, "rest": 120},\n        {"name": "rowing barre penché", "sets": 4, "reps": 8, "superset": true}\n      ]\n    },\n    {\n      "name": "Cardio et gainage",\n      "days": ["samedi"],\n      "exercises": [\n        {"name": "tapis de course", "sets": 1, "time": 1800, "distance": 5},\n        {"name": "gainage planche", "sets": 3, "time": 45}\n      ]\n    }\n  ]\n}';

/** Demande à copier dans une IA : profil, exercices disponibles et format attendu. */
function demandePourIA() {
  const { profil, seances, routines } = etat.value;
  const fr = langue !== 'en';
  const noms = tousExercices.value.map((e) => e[langue] ?? e.fr);
  return [
    fr ? 'Construisez-moi un programme d\'entraînement.' : 'Build me a training routine.',
    fr ? `Unité de poids : ${profil.unite}.` : `Weight unit: ${profil.unite}.`,
    fr ? `Séances déjà enregistrées : ${seances.length}.` : `Workouts logged so far: ${seances.length}.`,
    fr ? `Programmes déjà enregistrés : ${routines.map((r) => r.nom).join(', ') || 'aucun'}.` : `Routines already saved: ${routines.map((r) => r.nom).join(', ') || 'none'}.`,
    '',
    fr ? 'Pour les exercices de cardio ou chronométrés, utilisez « time » (en secondes, ou comme « 30:00 ») et « distance » (en km) au lieu de « reps » ; pour les changer série par série, mettez-les dans « plan ».'
      : 'For cardio or timed exercises, use "time" (seconds, or like "30:00") and "distance" (in km) instead of "reps"; to change them set by set, put them inside "plan".',
    fr ? 'Répondez uniquement avec ce JSON, sans autre texte :' : 'Reply with only this JSON, no other text:',
    JSON_PLAN,
    '',
    fr ? 'Exercices disponibles (utilisez exactement ces noms) :' : 'Available exercises (use these exact names):',
    noms.join(' | '),
  ].join('\n');
}
