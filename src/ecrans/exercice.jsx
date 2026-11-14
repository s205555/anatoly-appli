// Fiche d'un exercice : illustration ou média, muscles, matériel, programmes, record et sa courbe, objectif, prochaine fois, historique.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { afficher, api, assiste, bilanAssiste, charger, dateCourte, etat, jourLocal, meilleures, minSec, nombre, nomExercice, poids, trouverExercice, unite, unRM, versAffichage, versKg } from '../donnees.js';
import { etapeSuivante } from '../calculatrices.js';
import { prochainPlan } from '../progression.js';
import { lireM13 } from './reglages-m13.js';
import { typo } from '../../../app/src/textes.mjs';
import { IllustrationExercice } from '../illustrations.js';
import { dp, langue, t } from '../i18n.js';
import { m05 } from '../i18n/m05.js';
import { m05b } from '../i18n/m05b.js';
import { m24 } from '../i18n/m24.js';
import { Courbe, demanderNombre, Feuille, Ic, Kicker, Rond, Segment } from '../ui.jsx';
import { dossierDe, liesDe, nbSeries } from './programme-donnees.js';
import { importerImage, supprimerImages, urlMedia } from './photos.jsx';
import { basculerArchive, ecrireFavoris, FormExercice, lireArchives, lireFavoris, lireM05, majDico, mediaDe, secondairesDe, SupprimerExercice, VRAIS_MUSCLES } from './exercices.jsx';
import { journal, porteeNote, vueTout } from './notes.jsx';
import { ReglagesExercice } from './exercice-reglages.jsx';
import './m05.css';
import './m05b.css';

const sansEchauffement = (s) => s.type !== 'e';

// Résumé d'une séance pour un exercice : meilleure série, volume, valeur de référence.
function resumeSeance(e, s, id) {
  const series = s.donnees.exercices.filter((x) => x.ex === id).flatMap((x) => x.series).filter(sansEchauffement);
  const duree = e.mesure === 'duree';
  const score = (x) => (duree ? x.s ?? 0 : e.mesure === 'corps' && !x.kg ? x.r ?? 0 : unRM(x.kg, x.r));
  const best = series.reduce((a, b) => (score(b) > score(a) ? b : a), series[0]);
  return { s, series, best, vol: series.reduce((n, x) => n + (x.kg ?? 0) * (x.r ?? 0), 0) };
}

// Objectif de la prochaine séance : règle de progression des réglages (double par défaut : répétitions jusqu'à 12, puis charge et retour à 8).
function objectifSuivant(e, derniere) {
  const m = m05();
  const series = derniere.donnees.exercices.filter((x) => x.ex === e.id).flatMap((x) => x.series).filter(sansEchauffement);
  if (!series.length) return null;
  const u = unite();
  if (e.mesure === 'duree') {
    const s = Math.max(...series.map((x) => x.s ?? 0));
    return { valeur: minSec(s + 15), raison: m.detail.raisons.duree(minSec(s)), monte: true };
  }
  const repsMax = Math.max(...series.map((x) => x.r ?? 0));
  if (e.mesure === 'corps' && !series.some((x) => x.kg)) {
    if (repsMax >= 12) return { valeur: `${repsMax} ${t.commun.reps}`, raison: m.detail.raisons.lest(), monte: false };
    return { valeur: `${repsMax + 1} ${t.commun.reps}`, raison: m.detail.raisons.corps(repsMax), monte: true };
  }
  if (!series.some((x) => x.kg)) return { valeur: `${repsMax + 1} ${t.commun.reps}`, raison: m.detail.raisons.reps(repsMax), monte: true };
  // Même règle que la séance : celle des réglages, sinon progression double (jusqu'à 12, puis charge et retour à 8).
  const reglage = lireM13();
  const mode = reglage.progression === 'charge' ? 'charge' : 'repetitions';
  const pasKg = versKg(Number(reglage.pasPoids) || (u === 'lb' ? 5 : 2.5));
  const etape = prochainPlan(e.id) ?? etapeSuivante(series, mode, pasKg);
  if (!etape) return null;
  const kg = Math.max(...etape.series.map((x) => x.kg ?? 0));
  const reps = etape.series.map((x) => x.r);
  const r = Math.min(...reps) === Math.max(...reps) ? reps[0] : reps.join('-');
  const avant = series[0].r ?? 0;
  if (etape.coup === 'charge') return { valeur: `${poids(kg)} ${u} × ${r}`, raison: m.detail.raisons.charge(avant, u), monte: true };
  return { valeur: `${poids(kg)} ${u} × ${r}`, raison: m.detail.raisons.poids(poids(kg), avant, u), monte: etape.coup === 'reps' };
}

export function Exercice({ id }) {
  const m = m05();
  const b = m05b();
  const e = trouverExercice(id);
  const [modif, setModif] = useState(false);
  const [histo, setHisto] = useState(false);
  const [suppr, setSuppr] = useState(false);
  const [feuille, setFeuille] = useState('');
  const fichier = useRef(null);
  const favoris = lireFavoris();
  const seances = useMemo(() => (etat.value?.seances ?? []).filter((s) => s.donnees.exercices.some((x) => x.ex === id)), [id, etat.value?.seances]);

  if (!e) return <main class="ecran"><Rond n="chevron" label={t.commun.retour} href="#/exercices" /><div class="vide-carte"><Ic n="question" taille={30} /><p class="vide-titre">{t.exercices.aucun}</p></div></main>;

  const duree = e.mesure === 'duree';
  const calm = Boolean(etat.value?.profil?.reduire_animations);
  const u = unite();
  const favori = favoris.includes(e.id);
  const basculerFavori = () => ecrireFavoris(favori ? favoris.filter((x) => x !== e.id) : [...favoris, e.id]);
  const archive = lireArchives().includes(e.id);
  const archiver = () => {
    basculerArchive(e.id);
    if (!archive) afficher(b.archive, 'ok', { libelle: b.annuler, fn: () => basculerArchive(e.id) });
  };
  const media = mediaDe(e.id);
  const choisirMedia = async (ev) => {
    const f = ev.target.files?.[0];
    ev.target.value = '';
    if (!f) return;
    try {
      const nouveau = await importerImage(f);
      if (media) supprimerImages([media]);
      majDico('medias', e.id, nouveau);
    } catch (err) { afficher(err?.message === 'image' ? b.mediaRefuse : t.commun.erreur, 'danger'); }
  };
  const retirerMedia = () => { supprimerImages([media]); majDico('medias', e.id, null); };
  const nbNotes = journal.value.notes.filter((n) => n.exerciseId === e.id).length;
  const secondaires = secondairesDe(e).map((x) => t.muscles[x]).filter(Boolean).join(', ');
  const nbProgrammes = (etat.value?.routines ?? []).filter((r) => r.exercices?.some((x) => x.ex === e.id)).length;
  const resume = seances.map((s) => resumeSeance(e, s, id));
  const best = resume.reduce((a, b) => ((b.best && (!a.best || (duree ? (b.best.s ?? 0) > (a.best.s ?? 0) : unRM(b.best.kg, b.best.r) > unRM(a.best.kg, a.best.r)))) ? b : a), {});
  const meilleureSeance = resume.reduce((a, b) => (b.vol > (a.vol ?? -1) ? b : a), {});
  const m0 = meilleures(id, seances);
  const objectif = seances.length ? objectifSuivant(e, seances[0]) : null;
  // Une valeur par séance, de la plus ancienne à la plus récente, dans l'unité affichée.
  const points = [...resume].reverse().filter((r) => r.best).map((r) => (duree ? r.best.s ?? 0 : versAffichage(Math.round(unRM(r.best.kg, r.best.r) * 10) / 10)));
  // Machine assistée : record au moins d'aide, meilleure série à la plus forte charge réelle (poids du corps moins l'aide).
  const aide = assiste(e) ? bilanAssiste(id, seances) : null;
  const record = duree ? minSec(m0.s) : aide?.moins != null ? `${poids(aide.moins)} ${u}` : e.mesure === 'corps' && !m0.kg ? `${m0.reps} ${t.commun.reps}` : `${poids(m0.kg)} ${u}`;
  const recordDetail = duree ? '' : aide?.moins != null ? m24().moinsAssistance : e.mesure === 'corps' && !m0.kg ? '' : m.detail.unRM(`${poids(m0.rm)} ${u}`);
  const meilleure = aide?.serie ? { best: aide.serie, s: aide.sSerie } : best;
  // GymMane (goalFits) : pas d'objectif pour un exercice en temps ou en distance.
  const parReps = e.mesure === 'corps' && !(m0.kg > 0);
  const but = duree ? null : lireM05().objectifs?.[e.id];

  return <main class="ecran fiche-ex">
    <div class="exo-actions">
      <Rond n="chevron" label={t.commun.retour} href="#/exercices" taille={36} classe="petit" />
      <div class="exo-actions-droite">
        {e.perso && <Rond n="trash" label={m.form.supprimer} onClick={() => setSuppr(true)} taille={36} classe="petit" />}
        {e.perso && <Rond n="pencil-simple" label={m.form.modifier} onClick={() => setModif(true)} taille={36} classe="petit" />}
        <Rond n={archive ? 'archive:fill' : 'archive'} label={archive ? b.restaurer : b.archiver} onClick={archiver} taille={36} classe={`petit ${archive ? 'fav' : ''}`} />
        <Rond n={favori ? 'star:fill' : 'star'} label={favori ? m.detail.retirerFavori : m.detail.ajouterFavori} onClick={basculerFavori} taille={36} classe={`petit ${favori ? 'fav' : ''}`} />
      </div>
    </div>
    <div class="exo-media">
      <div class="cadre-art">{media ? <img class="art-media" src={urlMedia(media)} alt={nomExercice(e)} /> : <IllustrationExercice exo={e} taille={220} lazy={false} calmMotion={calm} live />}</div>
      <div class="exo-media-actions">
        {media && <button type="button" class="exo-media-btn" aria-label={b.illustrationDefaut} title={b.illustrationDefaut} onClick={retirerMedia}><Ic n="arrow-counter-clockwise" taille={16} /></button>}
        <button type="button" class="exo-media-btn" aria-label={media ? b.changerMedia : b.ajouterMedia} title={media ? b.changerMedia : b.ajouterMedia} onClick={() => fichier.current?.click()}>
          <Ic n={media ? 'pencil-simple' : 'upload-simple'} taille={16} /></button>
        <input ref={fichier} type="file" accept="image/jpeg,image/png" hidden onChange={choisirMedia} />
      </div>
    </div>
    {archive && <div class="exo-bandeau"><Ic n="archive:fill" taille={17} /><p>{b.archiveBandeau}</p>
      <button type="button" onClick={() => basculerArchive(e.id)}>{b.restaurer}</button></div>}
    <h1 class="exo-nom">{nomExercice(e)}</h1>
    <div class="exo-meta exo-meta-l07">
      <div><Kicker>{b.principal}</Kicker><strong title={t.muscles[e.muscle]}>{t.muscles[e.muscle]}</strong></div>
      <button type="button" class="exo-meta-btn" onClick={() => setFeuille('secondaires')}>
        <Kicker>{b.secondaire}<Ic n="pencil-simple" taille={11} /></Kicker><strong title={secondaires}>{secondaires || b.aucun}</strong></button>
      <div><Kicker>{b.equipement}</Kicker><strong>{t.materiels[e.materiel]}</strong></div>
    </div>
    <button type="button" class="exo-ligne" onClick={() => setFeuille('programme')}>
      <Ic n="list-plus" taille={19} classe={nbProgrammes ? 'on' : ''} />
      <span><strong>{b.ajouterProgramme}</strong><small>{b.dansProgrammes(nbProgrammes)}</small></span>
      <Ic n="plus" taille={16} />
    </button>

    {seances.length ? <section class="record-carte">
      <div class="record-tete">
        <div><Kicker>{m.detail.record}</Kicker><p class="record-val">{record}</p></div>
        {recordDetail && <p class="record-detail">{recordDetail}</p>}
      </div>
      <div class="record-cellules">
        <div><small>{m.detail.meilleureSerie}</small><b>{duree ? minSec(meilleure.best?.s ?? 0) : meilleure.best?.kg ? `${poids(meilleure.best.kg)} ${u} × ${meilleure.best.r ?? 0}` : `${meilleure.best?.r ?? 0} ${t.commun.reps}`}</b><small>{meilleure.s ? dateCourte(meilleure.s.debut) : ''}</small></div>
        {aide?.sReps ? <div><small>{m.detail.meilleureSeance}</small><b>{`${aide.reps} ${t.commun.reps}`}</b><small>{dateCourte(aide.sReps.debut)}</small></div>
          : <div><small>{m.detail.meilleureSeance}</small><b>{duree ? minSec(Math.max(...resume.map((r) => r.best?.s ?? 0))) : `${poids(meilleureSeance.vol ?? 0)} ${u}`}</b><small>{meilleureSeance.s ? dateCourte(meilleureSeance.s.debut) : ''}</small></div>}
      </div>
      {(aide ? aide.courbe : points).length > 2 && <CourbeRecord valeurs={aide ? aide.courbe.map((v) => versAffichage(Math.round(v * 10) / 10)) : points} label={duree ? t.exercice.meilleureDuree : t.exercice.courbe} format={duree ? minSec : (v) => nombre(v, 1)} />}
    </section> : <div class="vide-carte"><Ic n="chart-line-up" taille={30} /><p class="vide-titre">{m.detail.aucunHisto}</p><p class="vide-texte">{m.detail.aucunHistoTexte}</p></div>}

    {!duree && !assiste(e) && <CarteObjectif e={e} but={but} meilleur={parReps ? m0.reps : m0.kg} parReps={parReps} ouvrir={() => setFeuille('objectif')} />}

    {objectif && <section class={`prochaine-carte prochaine-l07 ${objectif.monte ? 'monte' : ''}`}>
      <Ic n="chart-line-up" taille={18} />
      <span><b class="prochaine-titre">{b.prochaine}</b><small class="prochaine-aide">{objectif.raison}</small></span>
      <strong>{objectif.valeur}</strong>
    </section>}

    {seances.length > 0 && <section class="section">
      <div class="section-tete"><Kicker>{t.exercice.historique}</Kicker><button type="button" class="tout-voir" onClick={() => setHisto(true)}>{m.detail.toutVoir}</button></div>
      <div class="carte histo-liste">{resume.slice(0, 8).map((r) => <div class="histo-ligne" key={r.s.cle}>
        <span><strong>{dateCourte(r.s.debut)}</strong><small>{t.exercice.series(r.series.length)}</small></span>
        <span class="droite"><strong>{duree ? minSec(r.best?.s ?? 0) : r.best?.kg ? `${poids(r.best.kg)} ${u} × ${r.best.r ?? 0}` : `${r.best?.r ?? 0} ${t.commun.reps}`}</strong></span>
      </div>)}</div>
    </section>}

    <a class="ligne-note" href="#/notes" onClick={() => { porteeNote.value = e.id; vueTout.value = true; }}>
      <span class={`pastille-ic ${nbNotes ? 'on' : ''}`} aria-hidden="true"><Ic n="notebook" taille={17} /></span>
      <span class="ligne-note-texte"><strong>{m.notes.titre}</strong><small>{nbNotes ? m.notes.n(nbNotes) : m.notes.aucune}</small></span>
      <Ic n="caret-right" taille={15} />
    </a>

    {e.conseils && <section class="section"><Kicker>{m.detail.etapes}</Kicker>
      <ol class="carte conseils">{e.conseils[langue].map((c, i) => <li key={i}><span class="conseil-num" aria-hidden="true">{i + 1}</span><span>{langue === 'fr' ? typo(c) : c}</span></li>)}</ol>
    </section>}

    <ReglagesExercice e={e} />

    {histo && <FeuilleHisto ouverte={histo} fermer={() => setHisto(false)} e={e} />}
    <FeuilleSecondaires ouverte={feuille === 'secondaires'} fermer={() => setFeuille('')} e={e} />
    <FeuilleProgramme ouverte={feuille === 'programme'} fermer={() => setFeuille('')} e={e} />
    {feuille === 'objectif' && <FeuilleObjectif fermer={() => setFeuille('')} e={e} but={but} meilleur={parReps ? m0.reps : m0.kg} parReps={parReps} />}
    {e.perso && <FormExercice ouverte={modif} fermer={() => setModif(false)} exercice={e} />}
    {e.perso && <SupprimerExercice ouvert={suppr} fermer={() => setSuppr(false)} exercice={e} />}
  </main>;
}

// Bornes « rondes » de l'axe (GymMane, niceBounds) : pas de 1, 2, 2,5, 5 ou 10, nombre pair d'intervalles.
export function bornesRondes(valeurs) {
  let lo = Math.min(...valeurs), hi = Math.max(...valeurs);
  if (Math.abs(hi - lo) < 1e-9) { const pad = Math.abs(lo) < 1e-9 ? 1 : Math.abs(lo) * 0.1; lo -= pad; hi += pad; }
  const brut = (hi - lo) / 4;
  const mag = 10 ** Math.floor(Math.log10(brut));
  const r = brut / mag;
  const pas = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * mag;
  const a = Math.floor(lo / pas) * pas;
  let n = Math.round((Math.ceil(hi / pas) * pas - a) / pas);
  if (n < 2) n = 2;
  if (n % 2) n++;
  return [a, a + n * pas];
}

// Tracé monotone (GymMane, _TrendPainter) : tangentes de Fritsch-Carlson, la courbe ne dépasse jamais les points.
function traceMonotone(pts) {
  const n = pts.length;
  const pente = pts.slice(0, -1).map((p, i) => (pts[i + 1][1] - p[1]) / (pts[i + 1][0] - p[0]));
  const tg = pts.map((_, i) => (i === 0 ? pente[0] : i === n - 1 ? pente[n - 2] : pente[i - 1] * pente[i] <= 0 ? 0 : (pente[i - 1] + pente[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (pente[i] === 0) { tg[i] = 0; tg[i + 1] = 0; continue; }
    const a = tg[i] / pente[i], c = tg[i + 1] / pente[i], h = a * a + c * c;
    if (h > 9) { const k = 3 / Math.sqrt(h); tg[i] = k * a * pente[i]; tg[i + 1] = k * c * pente[i]; }
  }
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = (pts[i + 1][0] - pts[i][0]) / 3;
    d += ` C${(pts[i][0] + dx).toFixed(1)},${(pts[i][1] + tg[i] * dx).toFixed(1)} ${(pts[i + 1][0] - dx).toFixed(1)},${(pts[i + 1][1] - tg[i + 1] * dx).toFixed(1)} ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`;
  }
  return d;
}

// Courbe de la carte record (GymMane, TrendChart avec ChartScale) : 84 px, grille pointillée à 12, 50 et 88 %, échelle à droite.
function CourbeRecord({ valeurs, label, format }) {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([x]) => setW(Math.round(x.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const h = 84;
  const [lo, hi] = bornesRondes(valeurs);
  const marques = [[0.12, hi], [0.5, (hi + lo) / 2], [0.88, lo]];
  const pts = valeurs.map((v, i) => [6 + ((w - 12) * i) / (valeurs.length - 1), h * (0.88 - ((v - lo) / (hi - lo || 1)) * 0.76)]);
  const ligne = w > 12 ? traceMonotone(pts) : '';
  const fin = pts.at(-1);
  return <div class="courbe-record" role="img" aria-label={label}>
    <svg ref={ref} height={h} aria-hidden="true">
      <defs><linearGradient id="courbe-record-fond" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".28" /><stop offset="1" stop-color="var(--accent)" stop-opacity="0" /></linearGradient></defs>
      {marques.map(([f]) => <line key={f} x1="0" x2={w} y1={h * f} y2={h * f} class="courbe-grille" />)}
      {ligne && <>
        <path d={`${ligne} L${fin[0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`} fill="url(#courbe-record-fond)" />
        <path d={ligne} class="courbe-trait" />
        <circle cx={fin[0]} cy={fin[1]} r="8" class="courbe-halo" />
        <circle cx={fin[0]} cy={fin[1]} r="4.5" class="courbe-point" />
      </>}
    </svg>
    <div class="courbe-echelle" aria-hidden="true"><i>{marques.map(([, v]) => format(v)).reduce((a, x) => (x.length > a.length ? x : a), '')}</i>
      {marques.map(([f, v]) => <span key={f} style={`top:${f * 100}%`}>{format(v)}</span>)}</div>
  </div>;
}

// Carte « Fixer un objectif » puis, une fois fixé, objectif, reste à faire, barre et échéance (GymMane, _goalCard).
function CarteObjectif({ e, but, meilleur, parReps, ouvrir }) {
  const b = m05b();
  const u = unite();
  const lib = (v) => (parReps ? b.reps(Math.round(v)) : `${poids(v)} ${u}`);
  if (!but) return <button type="button" class="objectif-vide" onClick={ouvrir}><Ic n="target" taille={18} /><span>{b.fixerObjectif}</span><Ic n="plus" taille={15} /></button>;
  const fait = meilleur >= but.cible;
  const part = but.cible <= 0 ? 1 : Math.min(1, Math.max(0, meilleur / but.cible));
  const jours = but.echeance ? Math.round((new Date(`${but.echeance}T00:00:00`) - new Date(`${jourLocal(new Date())}T00:00:00`)) / 86400000) : null;
  const quand = fait || jours === null ? '' : jours < 0 ? b.dateDepassee : `${b.joursRestants(jours)} · ${dateCourte(`${but.echeance}T12:00:00`)}`;
  return <button type="button" class={`objectif-carte ${fait ? 'fait' : ''}`} onClick={ouvrir} aria-label={`${b.objectif} ${nomExercice(e)}`}>
    <span class="objectif-tete"><span><Kicker>{b.objectif}</Kicker><b>{lib(but.cible)}</b></span><small>{fait ? b.objectifAtteint : b.encore(lib(but.cible - meilleur))}</small></span>
    <span class="objectif-barre"><i style={`width:${part * 100}%`} /></span>
    {quand && <small class={`objectif-quand ${jours < 0 ? 'retard' : ''}`}>{quand}</small>}
  </button>;
}

const dateAnnee = (j) => new Intl.DateTimeFormat(langue === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${j}T12:00:00`));

function FeuilleObjectif({ fermer, e, but, meilleur, parReps }) {
  const b = m05b();
  const u = unite();
  const pas = parReps ? 1 : versKg(Number(lireM13().pasPoids) || (u === 'lb' ? 5 : 2.5));
  const [cible, setCible] = useState(() => but?.cible ?? (parReps ? Math.max(meilleur + 5, 10) : (meilleur || 0) + pas * 4));
  const [echeance, setEcheance] = useState(but?.echeance ?? '');
  const affiche = parReps ? `${Math.round(cible)}` : `${poids(cible)} ${u}`;
  const bouger = (d) => setCible((c) => (parReps ? Math.max(1, c + d) : Math.max(0, Math.round((c + d * pas) * 100) / 100)));
  const aujourdhui = jourLocal(new Date());
  const date = useRef(null);
  return <Feuille ouverte fermer={fermer} titre={b.objectif}>
    <div class="options objectif-reglages">
      <div class="option"><span><strong>{parReps ? b.repsVisees : b.poidsCible}</strong></span>
        <span class="pas-a-pas"><button type="button" class="rond petit" aria-label={b.moins} onClick={() => bouger(-1)}><Ic n="minus:bold" taille={14} /></button>
          <button type="button" class="objectif-valeur" aria-label={`${parReps ? b.repsVisees : b.poidsCible}${dp()}${affiche}`} onClick={async () => {
            const v = await demanderNombre({ titre: parReps ? b.repsVisees : b.poidsCible, valeur: parReps ? Math.round(cible) : Math.round(versAffichage(cible) * 100) / 100, decimales: !parReps });
            if (v > 0) setCible(parReps ? Math.round(v) : versKg(v));
          }}>{affiche}</button>
          <button type="button" class="rond petit" aria-label={b.plus} onClick={() => bouger(1)}><Ic n="plus:bold" taille={14} /></button></span></div>
      <div class="option objectif-echeance">
        <button type="button" class="objectif-date" onClick={() => { try { date.current.showPicker(); } catch { date.current?.focus(); } }}>
          <strong>{b.echeance}</strong><b class={echeance ? '' : 'vide'}>{echeance ? dateAnnee(echeance) : b.sansEcheance}</b></button>
        {echeance && <button type="button" class="objectif-sans" aria-label={b.retirerEcheance} onClick={() => setEcheance('')}><Ic n="x" taille={14} /></button>}
        <input ref={date} type="date" class="objectif-input" tabIndex={-1} aria-hidden="true" min={aujourdhui} value={echeance} onInput={(ev) => setEcheance(ev.target.value)} />
      </div>
    </div>
    <button type="button" class="btn pri large" onClick={() => { majDico('objectifs', e.id, { cible, echeance: echeance || null }); fermer(); }}>{b.enregistrer}</button>
    {but && <button type="button" class="btn lien" onClick={() => { majDico('objectifs', e.id, null); fermer(); }}>{b.supprimerObjectif}</button>}
  </Feuille>;
}

// Muscles secondaires d'un exercice, modifiables même pour le catalogue (GymMane, _editSecondary).
function FeuilleSecondaires({ ouverte, fermer, e }) {
  const b = m05b();
  const choisis = secondairesDe(e);
  const perso = Array.isArray(lireM05().secondaires?.[e.id]);
  const basculer = (x) => majDico('secondaires', e.id, choisis.includes(x) ? choisis.filter((y) => y !== x) : [...choisis, x]);
  return <Feuille ouverte={ouverte} fermer={fermer} titre={nomExercice(e)} sous={b.secondairesAide}>
    <div class="ex-pilules">{VRAIS_MUSCLES.filter((x) => x !== e.muscle).map((x) => <button type="button" key={x} class="ex-pilule petite" aria-pressed={choisis.includes(x)} onClick={() => basculer(x)}>{t.muscles[x]}</button>)}</div>
    {perso ? <button type="button" class="btn lien" onClick={() => majDico('secondaires', e.id, null)}>{b.retablir}</button> : null}
    <button type="button" class="btn pri large" onClick={fermer}>{b.termine}</button>
  </Feuille>;
}

// Ajouter au programme : l'exercice rejoint le programme choisi (ou un nouveau), puis l'éditeur s'ouvre (GymMane, addToRoutineAndEdit).
function FeuilleProgramme({ ouverte, fermer, e }) {
  const b = m05b();
  const routines = etat.value?.routines ?? [];
  const serie = () => ({ r: null, kg: null, s: null, type: 'n' });
  const nouvelExo = { ex: e.id, repos: null, note: '', planifie: [serie(), serie(), serie()] };
  const choisir = async (r) => {
    fermer();
    try {
      if (!r) {
        const n = await api('POST', '/api/routines', { nom: b.nouveauProgramme, dossier: '', couleur: '', lies: [], exercices: [nouvelExo] });
        await charger();
        location.hash = `#/programme/${n.id}`;
        return;
      }
      if (!r.exercices?.some((x) => x.ex === e.id)) {
        const exercices = (r.exercices ?? []).map((x) => ({ ex: x.ex, repos: x.repos ?? null, note: x.note ?? '',
          planifie: Array.isArray(x.planifie) && x.planifie.length ? x.planifie : Array.from({ length: nbSeries(x) }, () => ({ ...serie(), r: x.reps ?? null })) }));
        await api('PUT', `/api/routines/${r.id}`, { nom: r.nom, dossier: r.dossier ?? '', couleur: r.couleur ?? '', lies: liesDe(r), exercices: [...exercices, nouvelExo] });
        await charger();
      }
      location.hash = `#/programme/${r.id}`;
    } catch { afficher(t.commun.erreur, 'danger'); }
  };
  return <Feuille ouverte={ouverte} fermer={fermer} titre={b.ajouterProgramme} sous={nomExercice(e)}>
    <div class="options">
      <button type="button" class="option" onClick={() => choisir(null)}><Ic n="plus" taille={18} /><span><strong>{b.nouveauProgramme}</strong></span></button>
      {routines.map((r) => {
        const dedans = r.exercices?.some((x) => x.ex === e.id);
        const detail = dedans ? b.dejaDedans : dossierDe(r);
        return <button type="button" key={r.id} class={`option ${dedans ? 'choisie' : ''}`} onClick={() => choisir(r)}>
          <span><strong>{r.nom || b.nouveauProgramme}</strong>{detail && <small>{detail}</small>}</span>
          {dedans && <Ic n="check:bold" taille={16} classe="option-coche" />}
        </button>;
      })}
    </div>
  </Feuille>;
}

/** Meilleure charge pour chaque nombre de répétitions, en échelle (GymMane, repRecords) : au plus 5 marches. */
export function echelleRecords(e, seances) {
  if (!e || e.mesure !== 'poids') return [];
  const best = new Map();
  for (const s of seances) for (const x of s.donnees.exercices) if (x.ex === e.id) for (const v of x.series) {
    if (!sansEchauffement(v) || v.fait === false || !(v.r > 0) || !(v.kg > 0)) continue;
    const d = best.get(v.r);
    if (!d || v.kg > d.kg || (v.kg === d.kg && s.debut < d.date)) best.set(v.r, { kg: v.kg, date: s.debut });
  }
  const out = [];
  let plancher = 0;
  for (const r of [...best.keys()].sort((a, b) => b - a)) {
    const b = best.get(r);
    if (b.kg <= plancher) continue;
    out.push({ r, kg: b.kg, date: b.date });
    plancher = b.kg;
  }
  const echelle = out.reverse();
  if (echelle.length <= 5) return echelle;
  return [0, 1, 2, 3, 4].map((i) => echelle[Math.round((i * (echelle.length - 1)) / 4)]);
}

const quand = (d) => (new Date(d).getFullYear() === new Date().getFullYear() ? dateCourte(d)
  : new Intl.DateTimeFormat(langue === 'en' ? 'en-GB' : 'fr-FR', { month: 'short', year: 'numeric' }).format(new Date(d)));

/** Carte des records au-dessus de l'historique : échelle des répétitions, sinon record personnel, puis meilleure séance. */
function CarteRecords({ e, seances, resume }) {
  const m = m05();
  const u = unite();
  if (!resume.length) return null;
  const echelle = echelleRecords(e, seances);
  const m0 = meilleures(e.id, seances);
  const duree = e.mesure === 'duree';
  const parReps = !duree && !(m0.kg > 0);
  const record = duree ? minSec(m0.s) : parReps ? m.detail.repsN(m0.reps) : `${poids(m0.kg)} ${u}`;
  const scoreSeance = (r) => (parReps ? r.series.reduce((n, x) => n + (x.r ?? 0), 0) : r.vol);
  const meilleure = duree ? null : resume.reduce((a, b) => (scoreSeance(b) > (a ? scoreSeance(a) : 0) ? b : a), null);
  return <div class="histo-records">
    {echelle.length ? <>
      <Kicker>{`${m.detail.echelle} · ${u}`}</Kicker>
      <div class="histo-echelle">{echelle.map((x) => <div key={x.r}>
        <b>{poids(x.kg)}</b><span>{m.detail.repsN(x.r)}</span><small>{quand(x.date)}</small>
      </div>)}</div>
    </> : <>
      <Kicker>{m.detail.record}</Kicker>
      <p class="histo-record-val">{record}</p>
    </>}
    {meilleure && scoreSeance(meilleure) > 0 && <div class="histo-meilleure">
      <span>{m.detail.meilleureSeance}</span>
      <b>{parReps ? m.detail.repsN(scoreSeance(meilleure)) : `${nombre(Math.round(versAffichage(meilleure.vol)), 0)} ${u}`}</b>
      <small>{quand(meilleure.s.debut)}</small>
    </div>}
  </div>;
}

// Feuille d'historique : plages 30 j, 90 j, 1 an, tout, courbe et delta.
function FeuilleHisto({ ouverte, fermer, e }) {
  const m = m05();
  const [plage, setPlage] = useState('90');
  const [tout, setTout] = useState(false);
  const seances = (etat.value?.seances ?? []).filter((s) => s.donnees.exercices.some((x) => x.ex === e.id));
  const duree = e.mesure === 'duree';
  const u = unite();
  const limite = plage === 'all' ? 0 : Date.now() - Number(plage) * 86400000;
  const resume = seances.map((s) => resumeSeance(e, s, e.id)).filter((r) => r.best && (!limite || new Date(r.s.debut).getTime() >= limite));
  const points = [...resume].reverse().map((r) => ({ y: duree ? r.best.s ?? 0 : Math.round(unRM(r.best.kg, r.best.r) * 10) / 10 }));
  const premier = points[0]?.y ?? 0, dernier = points.at(-1)?.y ?? 0;
  const delta = premier > 0 ? Math.round(((dernier - premier) / premier) * 100) : 0;
  const visibles = tout ? resume : resume.slice(0, 12);
  return <Feuille ouverte={ouverte} fermer={fermer} titre={nomExercice(e)} sous={`${t.exercice.historique} · ${t.exercice.series(resume.length)}`}>
    <div class="histo-feuille">
      <CarteRecords e={e} seances={seances} resume={seances.map((s) => resumeSeance(e, s, e.id)).filter((r) => r.best)} />
      <Segment options={Object.entries(m.detail.plages)} valeur={plage} onChange={setPlage} label={m.detail.plages.all} />
      {resume.length ? <>
        <div class="histo-tete">
          <p class="histo-grande">{duree ? minSec(dernier) : poids(dernier)}<small>{duree ? '' : ` ${u}`}</small></p>
          {delta !== 0 && <span class={`delta ${delta > 0 ? 'haut' : 'bas'}`}><Ic n="chart-line-up" taille={12} />{delta > 0 ? '+' : ''}{delta} %</span>}
        </div>
        {points.length > 1 && <Courbe points={points} hauteur={120} label={duree ? t.exercice.meilleureDuree : t.exercice.courbe} />}
        <div class="histo-liste">{visibles.map((r) => <div class="histo-ligne" key={r.s.cle}>
          <span><strong>{dateCourte(r.s.debut)}</strong><small>{t.exercice.series(r.series.length)}</small></span>
          <span class="droite"><strong>{duree ? minSec(r.best?.s ?? 0) : r.best?.kg ? `${poids(r.best.kg)} ${u} × ${r.best.r ?? 0}` : `${r.best?.r ?? 0} ${t.commun.reps}`}</strong></span>
        </div>)}</div>
        {!tout && resume.length > 12 && <button type="button" class="plus-lignes" onClick={() => setTout(true)}>{m.detail.dePlus(resume.length - 12)}</button>}
      </> : <div class="vide-carte"><Ic n="chart-line-up" taille={30} /><p class="vide-titre">{m.detail.aucunHisto}</p><p class="vide-texte">{m.detail.aucunHistoTexte}</p></div>}
    </div>
  </Feuille>;
}
