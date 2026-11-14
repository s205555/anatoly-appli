// Groupe « Réglages de cet exercice » en bas de la fiche (exercise_detail_screen.dart, _group) et feuilles du mode et de la pile de poids.
// Tout vit sur le compte : m05.modes (mode) et m05.reglages[id] (le reste), lus par la séance (seance.jsx, donnees.js).
import { useState } from 'preact/hooks';
import { enCours, etat, majEnCours, minSec, nombre, reglagesDe, unite, versAffichage, versKg } from '../donnees.js';
import { choixBarresPourUnite } from '../calculatrices.js';
import { m05b } from '../i18n/m05b.js';
import { m23 } from '../i18n/m23.js';
import { demanderNombre, demanderRegle, Feuille, Ic, Nombre } from '../ui.jsx';
import { m24 } from '../i18n/m24.js';
import { dp } from '../i18n.js';
import { lireM13 } from './reglages-m13.js';
import { FeuilleProgression, libelleGenre } from './feuille-progression.jsx';
import { majDico, modeDe } from './exercices.jsx';

const TENUES = [0, 5, 10, 15]; // holdSteps
const MODES = [['', 'barbell'], ['time', 'timer'], ['cardio', 'person-simple-run']];

/** Change un réglage de la fiche ; undefined ou null le retire. */
export function majReglage(id, patch) {
  const r = { ...reglagesDe(id), ...patch };
  for (const k of Object.keys(r)) if (r[k] === undefined || r[k] === null) delete r[k];
  majDico('reglages', id, Object.keys(r).length ? r : null);
}

function Ligne({ ic, on, titre, aide, aideOn, onAide, children, onClick, bascule }) {
  const corps = <>
    <Ic n={ic} taille={19} classe={on ? 'on' : ''} />
    <span class="exr-texte"><strong>{titre}</strong>{aide && (onAide
      ? <button type="button" class={`exr-aide ${aideOn ? 'on' : ''}`} onClick={onAide}>{aide}</button>
      : <small class={aideOn ? 'on' : ''}>{aide}</small>)}</span>
    {children}
  </>;
  if (bascule !== undefined) return <button type="button" class="exr-ligne" role="switch" aria-checked={bascule} onClick={onClick}>
    {corps}<span class={`inter ${bascule ? 'on' : ''}`} aria-hidden="true"><span /></span></button>;
  if (onClick) return <button type="button" class="exr-ligne" onClick={onClick}>{corps}<Ic n="caret-right" taille={15} classe="exr-fleche" /></button>;
  return <div class="exr-ligne">{corps}</div>;
}

// StepperControl de l'original : − et +, et la valeur se touche pour la saisir (onEdit).
function Pas({ valeur, label, moins, plus, editer }) {
  const r = m23();
  return <div class="exr-pas">
    <button type="button" aria-label={`${r.moins} ${label}`} onClick={moins}>−</button>
    {editer ? <button type="button" class="exr-pas-valeur" aria-label={`${label}${dp()}${valeur}`} onClick={editer}>{valeur}</button> : <output aria-live="polite">{valeur}</output>}
    <button type="button" aria-label={`${r.plus} ${label}`} onClick={plus}>+</button>
  </div>;
}

export function ReglagesExercice({ e }) {
  void etat.value; // relit les réglages quand le compte change
  const r = m23();
  const b = m05b();
  const [feuille, setFeuille] = useState('');
  const reg = reglagesDe(e.id);
  const mode = modeDe(e);
  const sansPoids = Boolean(e.sansPoids);
  const u = unite();
  const maj = (patch) => majReglage(e.id, patch);

  // Repos : celui de la fiche, sinon aucun en distance et temps, sinon celui du profil (restFor).
  const reposPropre = typeof reg.repos === 'number';
  const repos = reposPropre ? reg.repos : mode === 'cardio' ? 0 : etat.value?.profil?.repos_s ?? 0;
  const poserRepos = (v) => maj({ repos: v <= 0 ? 0 : Math.min(600, Math.max(15, v)) });

  // Barre : poids du chariot pour la machine, barre de l'unité sinon (barFor).
  const barreEx = ['barre', 'barre-ez'].includes(e.materiel);
  const barrePropre = typeof reg.barre === 'number';
  const barre = barrePropre ? versAffichage(reg.barre) : barreEx ? choixBarresPourUnite(u)[0] ?? 20 : 0;
  const pasPoids = Number(lireM13().pasPoids) || (u === 'lb' ? 5 : 2.5);
  const poserBarre = (v) => maj({ barre: versKg(Math.min(u === 'lb' ? 1100 : 500, Math.max(0, Math.round(v * 100) / 100))) });

  const pile = Array.isArray(reg.pile) && reg.pile.length ? reg.pile : null;
  const tenue = Number(reg.tenue) || 0;
  const cyclerTenue = (d) => { const k = Math.max(0, TENUES.indexOf(tenue)); const n = TENUES[Math.min(TENUES.length - 1, Math.max(0, k + d))]; maj({ tenue: n || undefined }); };

  // « Chaque côté » : la séance en cours prend tout de suite les colonnes gauche et droite (syncSides).
  const basculerCotes = () => {
    const on = !reg.cotes;
    maj({ cotes: on || undefined });
    if (enCours.value?.exercices.some((x) => x.ex === e.id)) majEnCours((x) => { x.exercices.forEach((y) => { if (y.ex === e.id && !y.series.some((v) => v.fait)) y.unilat = on; }); return x; });
  };

  return <section class="section exr">
    <h2 class="exr-titre">{r.titre}</h2>
    <div class="exr-groupe">
      <Ligne ic={mode === 'cardio' ? 'person-simple-run' : 'list-numbers'} on={Boolean(mode)} titre={b.enregistrerPar} onClick={() => setFeuille('mode')}>
        <span class="exr-valeur">{b.modes[mode]}</span>
      </Ligne>
      {mode !== 'cardio' && <Ligne ic="scales" on={sansPoids} titre={mode === 'time' ? r.dureeSeule : r.repsSeules} aide={r.repsSeulesAide}
        bascule={sansPoids} onClick={() => maj({ repsSeules: !sansPoids })} />}
      {mode === 'time' && <>
        <Ligne ic="arrows-left-right" on={Boolean(reg.cotesTemps)} titre={r.cotes} aide={r.cotesTempsAide} bascule={Boolean(reg.cotesTemps)} onClick={() => maj({ cotesTemps: !reg.cotesTemps || undefined })} />
        <Ligne ic="trend-up" on={tenue > 0} titre={r.tenue} aide={tenue > 0 ? r.tenueOn(tenue) : r.tenueAide} aideOn={tenue > 0}>
          <Pas label={r.tenue} valeur={tenue ? `+${tenue} s` : r.desactive} moins={() => cyclerTenue(-1)} plus={() => cyclerTenue(1)} />
        </Ligne>
      </>}
      {mode === '' && <Ligne ic="arrows-left-right" on={Boolean(reg.cotes)} titre={r.cotes} aide={r.cotesAide} bascule={Boolean(reg.cotes)} onClick={basculerCotes} />}
      <Ligne ic="timer" on={reposPropre} titre={r.repos} aide={reposPropre ? r.reposPropre : r.reposDefaut} aideOn={reposPropre} onAide={reposPropre ? () => maj({ repos: undefined }) : null}>
        <Pas label={r.repos} valeur={repos ? minSec(repos) : r.desactive} moins={() => poserRepos(repos - 15)} plus={() => poserRepos(repos + 15)}
          editer={async () => { const v = await demanderRegle({ titre: r.repos, valeur: repos, max: 600, pas: 5, majeur: 6, format: minSec }); if (v != null) maj({ repos: Math.round(v) }); }} />
      </Ligne>
      {(barreEx || ['machine', 'smith'].includes(e.materiel)) && <Ligne ic="barbell" on={barrePropre} titre={r.barre} aide={barrePropre ? r.barrePropre : r.barreAide} aideOn={barrePropre} onAide={barrePropre ? () => maj({ barre: undefined }) : null}>
        <Pas label={r.barre} valeur={`${nombre(barre, 2)} ${u}`} moins={() => poserBarre(barre - pasPoids)} plus={() => poserBarre(barre + pasPoids)}
          editer={async () => { const v = await demanderNombre({ titre: r.barre, valeur: barre }); if (v != null) poserBarre(v); }} />
      </Ligne>}
      {['machine', 'smith', 'poulie'].includes(e.materiel) && mode === '' && !sansPoids && <Ligne ic="stack" on={Boolean(pile)} titre={r.pile} aideOn={Boolean(pile)}
        aide={pile ? `${nombre(versAffichage(pile[0]), 2)}-${nombre(versAffichage(pile.at(-1)), 2)} ${u} · ${r.pileN(pile.length)}` : r.pileOff} onClick={() => setFeuille('pile')} />}
      <Ligne ic="sparkle" on={reg.suggerer !== false} titre={r.suggerer} aide={r.suggererAide} bascule={reg.suggerer !== false} onClick={() => maj({ suggerer: reg.suggerer === false ? undefined : false })} />
      {!sansPoids && mode === '' && <>
        <Ligne ic="arrow-fat-lines-down" on={Boolean(reg.assiste)} titre={r.assiste} aide={r.assisteAide} bascule={Boolean(reg.assiste)} onClick={() => maj({ assiste: !reg.assiste || undefined })} />
        <Ligne ic="trend-up" on titre={r.progression} onClick={() => setFeuille('progression')}><span class="exr-valeur on">{libelleGenre(e.id)}</span></Ligne>
        <Ligne ic="fire" on={Boolean(reg.echauffement)} titre={r.echauffement} aide={r.echauffementAide} bascule={Boolean(reg.echauffement)} onClick={() => maj({ echauffement: !reg.echauffement || undefined })} />
      </>}
    </div>
    <FeuilleMode ouverte={feuille === 'mode'} fermer={() => setFeuille('')} e={e} mode={mode} />
    {feuille === 'pile' && <FeuillePile fermer={() => setFeuille('')} e={e} />}
    {feuille === 'progression' && <FeuilleProgression ex={e.id} fermer={() => setFeuille('')} />}
  </section>;
}

function FeuilleMode({ ouverte, fermer, e, mode }) {
  const b = m05b();
  // 'weight' force répétitions et poids sur un exercice que le catalogue enregistre en temps (modeOverride).
  const choisir = (v) => { majDico('modes', e.id, v || 'weight'); fermer(); };
  return <Feuille ouverte={ouverte} fermer={fermer} titre={b.enregistrerPar}>
    <div class="rt-options" role="radiogroup" aria-label={b.enregistrerPar}>
      {MODES.map(([k, ic]) => <button key={k} type="button" role="radio" aria-checked={k === mode} class={`rt-opt${k === mode ? ' choisi' : ''}`} onClick={() => choisir(k)}>
        <Ic n={ic} taille={18} /><span class="rt-opt-texte"><b>{b.modes[k]}</b></span>{k === mode && <Ic n="check:bold" taille={16} />}
      </button>)}
    </div>
    <p class="exr-note">{m23().aideMode}</p>
  </Feuille>;
}

function FeuillePile({ fermer, e }) {
  const r = m23();
  const u = unite();
  const [kg, setKg] = useState(() => (Array.isArray(reglagesDe(e.id).pile) ? reglagesDe(e.id).pile : []));
  const [de, setDe] = useState(() => (kg.length ? versAffichage(kg[0]) : u === 'lb' ? 10 : 5));
  const [a, setA] = useState(() => (kg.length ? versAffichage(kg.at(-1)) : u === 'lb' ? 200 : 100));
  const [tous, setTous] = useState(u === 'lb' ? 10 : 5);
  const remplir = () => {
    if (!(tous > 0) || !(a >= de)) return;
    const l = [];
    for (let v = de; v <= a + 1e-6 && l.length < 60; v += tous) l.push(versKg(Math.round(v * 100) / 100));
    setKg(l);
  };
  // _edit et _add de weight_stack_sheet.dart : zéro retire le poids, une saisie vide ne change rien.
  const x = m24();
  const trier = (l) => [...new Set(l)].sort((p, q) => p - q);
  const corriger = async (k) => {
    const v = await demanderNombre({ titre: x.poidsGoupille(u), valeur: Math.round(versAffichage(kg[k]) * 100) / 100 });
    if (v == null) return;
    setKg((l) => trier([...l.slice(0, k), ...l.slice(k + 1), ...(v > 0 ? [versKg(v)] : [])]));
  };
  const ajouter = async () => {
    const v = await demanderNombre({ titre: x.ajouterPoids(u), valeur: '' });
    if (v > 0) setKg((l) => trier([...l, versKg(v)]));
  };
  const finir = (liste) => { majReglage(e.id, { pile: liste.length ? [...new Set(liste)].sort((x, y) => x - y) : undefined }); fermer(); };
  return <Feuille ouverte fermer={() => finir(kg)} titre={r.pile} sous={r.pileAide}
    pied={<><button type="button" class="btn pri large" onClick={() => finir(kg)}>{r.termine}</button>
      {kg.length > 0 && <button type="button" class="btn lien exr-danger" onClick={() => finir([])}>{r.retirerPile}</button>}</>}>
    <div class="exr-champs">
      <label><span class="label">{r.de}</span><Nombre valeur={de} label={r.de} onChange={(v) => setDe(v ?? 0)} /></label>
      <label><span class="label">{r.a}</span><Nombre valeur={a} label={r.a} onChange={(v) => setA(v ?? 0)} /></label>
      <label><span class="label">{r.tous}</span><Nombre valeur={tous} label={r.tous} onChange={(v) => setTous(v ?? 0)} /></label>
    </div>
    <button type="button" class="btn secondaire large exr-remplir" onClick={remplir}><Ic n="stack" taille={17} />{r.remplir}</button>
    {kg.length > 0 && <p class="exr-note">{x.toucherPile}</p>}
    <div class="exr-poids">{kg.map((v, k) => <button type="button" key={k} class="puce" aria-label={`${x.poidsGoupille(u)}${dp()}${nombre(versAffichage(v), 2)}`}
      onClick={() => corriger(k)}>{nombre(versAffichage(v), 2)}</button>)}
      <button type="button" class="puce exr-ajout" onClick={ajouter}><Ic n="plus:bold" taille={12} />{x.ajouter}</button></div>
  </Feuille>;
}

