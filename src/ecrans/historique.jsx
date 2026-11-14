// Historique : calendrier du mois, totaux, liste des séances ; détail et correction d'une séance.
// Portage 1:1 de GymMane history_screen.dart (carte mois, carte séance, feuille du jour).
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  afficher, api, bilanSeance, charger, dateComplete, dateLongue, dureeCourte, enCours, enDate, etat, jourDe, jourLocal, minSec, nomExercice, poids, recordsDe, refaire,
  trouverExercice, unite, versAffichage, versKg, volume,
} from '../donnees.js';
import { langue, t } from '../i18n.js';
import { textes } from '../i18n/m06.js';
import { Dialogue, EnTete, Feuille, Ic, Kicker, Nombre, Rond, Vide } from '../ui.jsx';
import { FeuilleJour as FeuilleJourComplete } from './l26-jour.jsx';
import { PhotosSeance } from './l26-photos.jsx';
import './m06.css';
import './historique.css';

const T6 = textes;
const tm = () => T6[langue === 'en' ? 'en' : 'fr'];
const locale = () => (langue === 'en' ? 'en-US' : 'fr-FR');

const dateFormat = (options) => new Intl.DateTimeFormat(locale(), options);
// Libellé d'un jour du calendrier comme t.fullDate : « Sunday, Nov 1, 2026 ».
const dateJour = (d) => dateFormat({ weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }).format(d);
const jourCourt = (d) => dateFormat({ weekday: 'short' }).format(d).replace('.', '').toUpperCase();
// Heure comme MaterialLocalizations : « 5:05 PM » en anglais, « 17:05 » en français.
const heureMinute = (v) => dateFormat({ hour: 'numeric', minute: '2-digit' }).format(enDate(v));

// Textes repris de app_fr.arb / app_en.arb (exerciseCount, setCount, historyMore, historyEmptyHint).
const TXT = {
  fr: { exercices: (n) => `${n} exercice${n > 1 ? 's' : ''}`, series: (n) => `${n} série${n > 1 ? 's' : ''}`, plus: (n) => `+${n} de plus`,
    videAide: 'Faites glisser sur le côté ou utilisez les flèches pour voir d’autres mois.' },
  en: { exercices: (n) => `${n} exercise${n === 1 ? '' : 's'}`, series: (n) => `${n} set${n === 1 ? '' : 's'}`, plus: (n) => `+${n} more`,
    videAide: 'Swipe sideways or use the arrows to see other months.' },
};
const TX = () => TXT[langue === 'en' ? 'en' : 'fr'];

/** Série « de travail » comptée dans l'historique (hors échauffement). */
const compte = (s) => s && s.fait !== false && s.type !== 'e';
const meilleureSerie = (ex, e) => {
  const duree = trouverExercice(ex)?.mesure === 'duree';
  let meilleur = null, score = -1;
  for (const s of e.series) if (compte(s)) {
    const v = duree ? (s.s ?? 0) : (s.kg ?? 0) * ((s.r ?? 0) || 1);
    if (v > score) { score = v; meilleur = s; }
  }
  return meilleur;
};
const libelleSerie = (ex, s) => {
  if (!s) return '';
  if (trouverExercice(ex)?.mesure === 'duree') return minSec(s.s ?? 0);
  const u = unite();
  return s.kg ? `${poids(s.kg)} ${u} × ${s.r ?? 0}` : `${s.r ?? 0} ${t.commun.reps}`;
};

const tempsCaps = dureeCourte;

/** Nom lisible d'un exercice du catalogue ; une fiche disparue affiche « Exercice supprimé ». */
const nomEx = (id) => nomExercice(trouverExercice(id)) || tm().historique.exerciceSupprime;

const titreSeance = (s) => {
  if (s.nom?.trim()) return s.nom;
  const groupes = [];
  for (const e of s.donnees.exercices) {
    const cles = trouverExercice(e.ex)?.muscle;
    if (cles && !groupes.includes(cles)) groupes.push(cles);
  }
  return groupes.slice(0, 2).map((k) => t.muscles[k]).filter(Boolean).join(' · ') || t.accueil.seanceLibre;
};

/** Mois demandé par l'adresse (#/historique?mois=2026-07, comme goHistory(month:) de GymMane), sinon le mois en cours ; jamais dans le futur. */
function moisDemande() {
  const maintenant = new Date(), courant = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
  const m = /[?&]mois=(\d{4})-(\d{2})(?:&|$)/.exec(location.hash);
  if (!m) return courant;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return Number(m[2]) >= 1 && Number(m[2]) <= 12 && d <= courant ? d : courant;
}

export function Historique() {
  const seances = etat.value.seances;
  const [mois, setMois] = useState(moisDemande);
  useEffect(() => {
    const f = () => setMois(moisDemande());
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  const [jour, setJour] = useState(null);
  // Panneau arrimé sous la barre du haut : fond et titre compact apparaissent (SheetPage de GymMane).
  const panneau = useRef(null), barre = useRef(null);
  const [arrime, setArrime] = useState(false);
  useEffect(() => {
    const f = () => { const p = panneau.current, b = barre.current; if (p && b) setArrime(p.getBoundingClientRect().top <= b.getBoundingClientRect().bottom); };
    f();
    addEventListener('scroll', f, { passive: true });
    return () => removeEventListener('scroll', f);
  }, []);
  const suivant = new Date(mois.getFullYear(), mois.getMonth() + 1, 1);
  const duMois = seances.filter((s) => { const d = enDate(s.debut); return d >= mois && d < suivant; })
    .sort((a, b) => enDate(b.debut) - enDate(a.debut));
  const changer = (d) => setMois(new Date(mois.getFullYear(), mois.getMonth() + d, 1));
  const auj = jourLocal(new Date());
  const enCoursMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const aDernier = mois.getTime() >= enCoursMois.getTime();
  // Balayage horizontal sur tout l'écran d'un mois à l'autre, comme GymMane (onHorizontalDragEnd).
  const depart = useRef(null);
  const debut = (e) => { const t0 = e.touches[0]; depart.current = { x: t0.clientX, y: t0.clientY }; };
  const fin = (e) => {
    const p = depart.current; depart.current = null;
    if (!p) return;
    const t0 = e.changedTouches[0];
    const dx = t0.clientX - p.x, dy = t0.clientY - p.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx > 0 || !aDernier) changer(dx > 0 ? -1 : 1);
  };
  const titre = t.historique.titre;
  // Taille du grand titre : 42 px, réduite par pas de 2 jusqu'à 28 si un mot ne tient pas (SheetPage._fitTitle).
  const largeur = Math.min(window.innerWidth, 430) - 40; // 430 = --col de app.css
  let taille = 42;
  while (taille > 28 && Math.max(...titre.split(' ').map((m) => m.length)) * taille * 0.56 > largeur) taille -= 2;
  return <main class="ecran hist-ecran" onTouchStart={debut} onTouchEnd={fin}>
    <div class={`hist-barre ${arrime ? 'arrime' : ''}`} ref={barre}>
      <Rond n="chevron" label={t.commun.retour} taille={36} onClick={() => (history.length > 1 ? history.back() : location.assign('#/'))} />
      <span class="hist-barre-titre" aria-hidden="true">{titre}</span>
    </div>
    <div class="hist-tete">
      <p class="hist-surtitre">{t.nav.profil}</p>
      <h1 style={`font-size:${taille}px`}>{titre}</h1>
    </div>
    <div class="hist-panneau" ref={panneau}>
      <span class="hist-poignee" aria-hidden="true" />
      <div class="hist-corps">
        <CarteMois mois={mois} seances={seances} auj={auj} aDernier={aDernier} changer={changer} surJour={setJour} />
        {duMois.length ? <div class="pile-seances hist-pile">
          <p class="hist-liste-kicker">{tm().historique.entrainements(duMois.length)}</p>
          {duMois.map((s) => <CarteSeance key={s.cle} s={s} seances={seances} ouvrir={() => setJour(enDate(s.debut))} />)}
        </div>
          : <div class="hist-pile"><Vide n="calendar-blank" titre={t.historique.vide} texte={TX().videAide} /></div>}
      </div>
    </div>
    {jour && <FeuilleJour jour={jour} fermer={() => setJour(null)} />}
  </main>;
}

function CarteMois({ mois, seances, auj, aDernier, changer, surJour }) {
  const resumer = (m) => {
    const tot = { entrainements: 0, temps: 0, series: 0, volume: 0 };
    const fin = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    for (const s of seances) {
      const d = enDate(s.debut);
      if (d < m || d >= fin) continue;
      tot.entrainements += 1;
      tot.temps += s.duree_s;
      const b = bilanSeance(s.donnees);
      tot.series += b.series;
      tot.volume += b.volume;
    }
    return tot;
  };
  const tot = resumer(mois);
  const avant = resumer(new Date(mois.getFullYear(), mois.getMonth() - 1, 1));
  const delta = tot.entrainements - avant.entrainements;
  const span = new Date(mois.getFullYear(), mois.getMonth() + 1, 1);
  const jours = new Set(seances.filter((s) => { const d = enDate(s.debut); return d >= mois && d < span; }).map((s) => jourDe(s.debut)));
  const decal = (mois.getDay() + 6) % 7, nbJours = new Date(mois.getFullYear(), mois.getMonth() + 1, 0).getDate();
  const aujourdhui = new Date();
  const futur = (d) => d > aujourdhui;
  const vols = volume(tot.volume);
  return <section class="carte hist-mois">
    <div class="cal-tete">
      <Rond n="caret-left:bold" label={t.historique.moisPrec} onClick={() => changer(-1)} taille={34} icone={13} classe="hist-fleche" />
      <h2 class="premiere-maj cal-mois-titre">{t.mois[mois.getMonth()]} {mois.getFullYear()}</h2>
      <Rond n="caret-right:bold" label={t.historique.moisSuiv} onClick={() => changer(1)} taille={34} icone={13} classe="hist-fleche" desactive={aDernier} />
    </div>
    <div class="hist-stats">
      <div class="hist-stat"><strong>{tot.entrainements}</strong><span class="kicker">{tm().historique.stats.entrainements}</span>
        {delta !== 0 && <span class={`hist-delta ${delta > 0 ? 'hausse' : ''}`}><Ic n={delta > 0 ? 'arrow-up:bold' : 'arrow-down:bold'} taille={10} />{Math.abs(delta)}</span>}</div>
      <div class="hist-stat"><strong>{tempsCaps(tot.temps)}</strong><span class="kicker">{tm().historique.stats.temps}</span></div>
      <div class="hist-stat"><strong>{tot.series}</strong><span class="kicker">{tm().historique.stats.series}</span></div>
      <div class="hist-stat"><strong>{vols.val} {vols.unite}</strong><span class="kicker">{tm().historique.stats.volume}</span></div>
    </div>
    <span class="hist-sep" aria-hidden="true" />
    <div class="cal-grille hist-grille" role="grid" aria-label={`${t.mois[mois.getMonth()]} ${mois.getFullYear()}`}>
      {t.jours.map((j, i) => <span class="cal-entete" key={`e${i}`} aria-hidden="true">{j}</span>)}
      {Array.from({ length: decal }, (_, i) => <span key={`v${i}`} />)}
      {Array.from({ length: nbJours }, (_, i) => {
        const d = new Date(mois.getFullYear(), mois.getMonth(), i + 1);
        const on = jours.has(jourLocal(d));
        const estAuj = jourLocal(d) === auj;
        const estFutur = futur(d);
        return <button type="button" key={d.getDate()} class={`hist-cal-jour ${on ? 'fait' : ''} ${estAuj && !on ? 'auj' : ''} ${estFutur ? 'futur' : ''}`}
          role="gridcell" aria-label={dateJour(d)} disabled={estFutur} onClick={() => surJour(d)}><span>{d.getDate()}</span></button>;
      })}
    </div>
  </section>;
}

// Carte d'une séance : en-tête (date, titre, heure, résumé gris, records), séparateur, lignes d'exercices.
// Un tap ouvre la feuille du jour, comme WorkoutHistoryCard (showDaySheet).
function CarteSeance({ s, seances, ouvrir }) {
  const d = enDate(s.debut);
  const records = recordsDe(s, seances);
  const recs = records.length;
  const recsEx = new Set(records.map((r) => r.ex));
  const exs = s.donnees.exercices ?? [];
  const apercu = exs.slice(0, 4);
  const plus = exs.length - apercu.length;
  const b = bilanSeance(s.donnees), v = volume(b.volume);
  const meta = [heureMinute(s.debut), s.duree_s >= 60 && `${Math.round(s.duree_s / 60)} min`].filter(Boolean).join(' · ');
  const resume = [TX().exercices(exs.length), TX().series(b.series), b.volume > 0 && `${v.val} ${v.unite}`].filter(Boolean).join(' · ');
  return <button type="button" class="hist-carte" onClick={ouvrir}>
    <span class="hist-carte-tete">
      <span class="bloc-date"><small>{jourCourt(d)}</small><strong>{d.getDate()}</strong></span>
      <span class="hist-carte-texte">
        <strong>{titreSeance(s)}</strong>
        <small>{meta}</small>
        <small class="hist-resume">{resume}</small>
      </span>
      {recs > 0 && <span class="pastille-recs" aria-label={langue === 'en' ? `${recs} records beaten` : `${recs} records battus`}><Ic n="trophy:fill" taille={11} /><span aria-hidden="true">{recs}</span></span>}
    </span>
    <span class="hist-carte-sep" aria-hidden="true" />
    <span class="hist-lignes">
      {apercu.map((e, i) => <LigneExercice key={i} ex={e.ex} e={e} record={recsEx.has(e.ex)} />)}
      {plus > 0 && <span class="hist-plus">{TX().plus(plus)}</span>}
    </span>
  </button>;
}

function LigneExercice({ ex, e, record }) {
  const n = e.series.filter(compte).length;
  const meilleur = meilleureSerie(ex, e);
  return <span class="hist-ligne">
    <span class="nb">{n}×</span>
    <span class="nom">{nomEx(ex)}</span>
    {record && <span class="hist-pr" role="img" aria-label={tm().historique.pr}><Ic n="trophy:bold" taille={9} /></span>}
    {meilleur && <span class="top">{libelleSerie(ex, meilleur)}</span>}
  </span>;
}

// Feuille du jour (GymMane showDaySheet) : la même que celle de l'accueil et des Progrès.
function FeuilleJour({ jour, fermer }) {
  return <FeuilleJourComplete jour={jourLocal(jour)} fermer={fermer} />;
}

export function SeanceDetail({ id }) {
  const s = etat.value.seances.find((x) => String(x.id) === id || x.cle === id);
  const [modif, setModif] = useState(null);
  const [suppr, setSuppr] = useState(false);
  if (!s) return <main class="ecran"><EnTete titre={t.historique.titre} retour="#/historique" /><Vide titre={t.historique.vide} /></main>;
  const b = bilanSeance(s.donnees), v = volume(b.volume);
  const u = unite();
  const enregistrerProgramme = async () => {
    try {
      const r = await api('POST', '/api/routines', { nom: s.nom.slice(0, 80), exercices: s.donnees.exercices.map((e) => ({ ex: e.ex, series: Math.min(20, e.series.length), reps: e.series.find((x) => x.type === 'n')?.r ?? null, repos: null })) });
      await charger(); afficher(t.programmes.modifie); location.hash = `#/programme/${r.id}`;
    } catch { afficher(t.commun.erreur, 'danger'); }
  };
  return <main class="ecran">
    <EnTete titre={s.nom} retour="#/historique" sous={`${dateComplete(s.debut)} · ${tempsCaps(s.duree_s)}`}
      actions={s.id && <Rond n="pencil-simple" label={t.historique.modifier} onClick={() => setModif(structuredClone(s))} />} />
    <div class="bilan-stats">
      <div class="mini"><Kicker>{t.bilan.duree}</Kicker><strong>{tempsCaps(s.duree_s)}</strong></div>
      <div class="mini"><Kicker>{t.bilan.series}</Kicker><strong>{b.series}</strong></div>
      <div class="mini"><Kicker>{t.bilan.volume}</Kicker><strong>{v.val} <small>{v.unite}</small></strong></div>
    </div>
    {s.donnees.note && <p class="carte texte-carte">{s.donnees.note}</p>}
    <PhotosSeance cle={s.cle} jour={jourLocal(enDate(s.debut))} />
    {s.donnees.exercices.map((e, i) => {
      const def = trouverExercice(e.ex);
      let n = 0;
      return <section class="carte detail-ex" key={i}>
        <h2>{def ? <a class="detail-ex-lien" href={`#/exercice/${e.ex}`}>{nomEx(e.ex)}</a> : <span class="muted">{nomEx(e.ex)}</span>}</h2>
        {e.note && <p class="muted">{e.note}</p>}
        <ol class="detail-series">{e.series.map((x, k) => <li key={k}><span class={`serie-num type-${x.type}`}>{x.type === 'n' ? ++n : t.typesCourts[x.type]}</span>
          <span>{def?.mesure === 'duree' ? minSec(x.s ?? 0) : `${x.kg ? `${poids(x.kg)} ${u} × ` : ''}${x.r ?? 0} ${t.commun.reps}`}</span></li>)}</ol>
      </section>;
    })}
    <div class="options carte-options">
      <button type="button" class="option" disabled={!!enCours.value} onClick={() => { refaire(s); location.hash = '#/seance'; }}><Ic n="repeat" taille={19} /><span><strong>{t.historique.refaire}</strong></span></button>
      <button type="button" class="option" onClick={enregistrerProgramme}><Ic n="stack" taille={19} /><span><strong>{t.historique.enregistrerProgramme}</strong></span></button>
      {s.id && <button type="button" class="option danger" onClick={() => setSuppr(true)}><Ic n="trash" taille={19} /><span><strong>{t.historique.supprimer}</strong></span></button>}
    </div>
    {modif && <Modifier s={modif} fermer={() => setModif(null)} />}
    <Dialogue ouvert={suppr} fermer={() => setSuppr(false)} titre={t.historique.supprimerTitre} texte={t.historique.supprimerTexte} libelle={t.commun.supprimer} danger
      confirmer={async () => { try { await api('DELETE', `/api/seances/${s.id}`); await charger(); afficher(t.commun.supprime); location.replace('#/historique'); } catch { afficher(t.commun.erreur, 'danger'); } }} />
  </main>;
}

// Correction d'une séance passée : nom, date, durée, valeurs des séries.
function Modifier({ s, fermer }) {
  const [x, setX] = useState(s);
  const d = enDate(s.debut);
  const [jour, setJour] = useState(jourLocal(d));
  const [heure, setHeure] = useState(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
  const [min, setMin] = useState(String(Math.round(s.duree_s / 60)));
  const [erreurs, setErreurs] = useState({});
  const maj = (fn) => setX((v) => { const c = structuredClone(v); fn(c); return c; });
  const enregistrer = async () => {
    const debut = new Date(`${jour}T${heure || '00:00'}`);
    const e = {};
    if (!jour || Number.isNaN(debut.getTime())) e.date = tm().historique.dateInvalide;
    else if (debut.getTime() > Date.now()) e.date = tm().historique.dateFuture;
    const m = min.trim();
    if (!/^\d{1,4}$/.test(m) || Number(m) < 1 || Number(m) > 1440) e.duree = tm().historique.dureeInvalide;
    setErreurs(e);
    if (e.date || e.duree) { afficher(e.date || e.duree, 'danger'); return; }
    try {
      await api('PUT', `/api/seances/${s.id}`, { debut: debut.toISOString(), duree_s: Number(m) * 60, nom: x.nom.trim() || s.nom, ...x.donnees,
        exercices: x.donnees.exercices.map((e) => ({ ...e, series: e.series.filter((q) => q.r !== null || q.kg !== null || q.s !== null) })).filter((e) => e.series.length) });
      await charger(); afficher(tm().historique.seanceEnregistree); fermer();
    } catch { afficher(t.commun.erreur, 'danger'); }
  };
  return <Feuille ouverte fermer={fermer} titre={t.historique.modifier} large pied={<><button class="btn large" type="button" onClick={fermer}>{t.historique.annuler}</button><button class="btn pri large" type="button" onClick={enregistrer}>{t.historique.enregistrer}</button></>}>
    <div class="pile">
      <div class="champ"><label class="label" for="m-nom">{t.seance.nomSeance}</label><input id="m-nom" class="form-input" maxLength={80} value={x.nom} onInput={(e) => maj((c) => { c.nom = e.target.value; })} /></div>
      <div class="grille3">
        <div class="champ"><label class="label" for="m-jour">{t.historique.date}</label><input id="m-jour" type="date" class="form-input" value={jour} max={jourLocal(new Date())} aria-invalid={!!erreurs.date} aria-describedby={erreurs.date ? 'm-jour-err' : undefined} onInput={(e) => { setJour(e.target.value); setErreurs((v) => ({ ...v, date: null })); }} />{erreurs.date && <p id="m-jour-err" class="champ-erreur" role="alert">{erreurs.date}</p>}</div>
        <div class="champ"><label class="label" for="m-heure">{t.historique.heure}</label><input id="m-heure" type="time" class="form-input" value={heure} onInput={(e) => setHeure(e.target.value)} /></div>
        <div class="champ"><label class="label" for="m-min">{t.historique.dureeMin}</label><input id="m-min" class="form-input" inputMode="numeric" autoComplete="off" value={min} aria-invalid={!!erreurs.duree} aria-describedby={erreurs.duree ? 'm-min-err' : undefined} onInput={(e) => { setMin(e.target.value); setErreurs((v) => ({ ...v, duree: null })); }} />{erreurs.duree && <p id="m-min-err" class="champ-erreur" role="alert">{erreurs.duree}</p>}</div>
      </div>
      {x.donnees.exercices.map((e, i) => {
        const def = trouverExercice(e.ex);
        return <section class="detail-ex" key={i}><h3>{nomEx(e.ex)}</h3>
          {e.series.map((q, k) => <div class="serie modif" key={k}>
            <span class={`serie-num type-${q.type}`}>{k + 1}</span>
            {def?.mesure === 'duree'
              ? <Nombre valeur={q.s} decimales={false} label={`${t.seance.duree} (${t.commun.s}), ${k + 1}`} onChange={(v) => maj((c) => { c.donnees.exercices[i].series[k].s = v; })} />
              : <><Nombre valeur={q.r} decimales={false} label={`${t.seance.reps}, ${k + 1}`} onChange={(v) => maj((c) => { c.donnees.exercices[i].series[k].r = v; })} />
                <Nombre valeur={versAffichage(q.kg)} label={`${unite()}, ${k + 1}`} onChange={(v) => maj((c) => { c.donnees.exercices[i].series[k].kg = versKg(v); })} /></>}
            <button type="button" class="rond petit" aria-label={t.seance.supprimerSerie} onClick={() => maj((c) => { c.donnees.exercices[i].series.splice(k, 1); })}><Ic n="trash" taille={15} /></button>
          </div>)}
        </section>;
      })}
    </div>
  </Feuille>;
}
