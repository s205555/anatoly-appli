// Feuille d'un jour (progress_screen.dart showDaySheet / _DaySheet) et ses feuilles : nom de la séance, bilan sommeil et énergie,
// durée, copie en texte, suppression, reprise (CONTINUER), correction d'une entrée (showEditLoggedSheet), « Enregistrer une séance ».
// Ouverte depuis la semaine de l'accueil, la carte de régularité des Progrès et le calendrier de l'Historique.
import { useEffect, useState } from 'preact/hooks';
import {
  afficher, api, bilanSeance, charger, dateLongue, enCours, enDate, etat, jourDe, jourLocal, lireModule, ecrireModule, majEnCours, minSec, nomExercice,
  poids, trouverExercice, unite, versAffichage, versKg, volume,
} from '../donnees.js';
import { langue, t } from '../i18n.js';
import { L26 } from '../i18n/l26.js';
import { demanderRegle, Dialogue, Feuille, feuilleDemarrage, Ic } from '../ui.jsx';
import { lireM13 } from './reglages-m13.js';
import { PhotosSeance, photosDe } from './l26-photos.jsx';
import './l26.css';

const COMPTE = (s) => s.fait !== false && s.type !== 'e';
const pasCharge = () => Number(lireM13().pasPoids) || (unite() === 'lb' ? 5 : 2.5);
const fmt = (n) => { const v = Math.round(n * 100) / 100; return String(v); };

/** Libellé d'une série enregistrée (stats_state.dart loggedSetLabel). */
export function libelleSerie(x) {
  const w = poids(x.kg ?? 0);
  if (x.km > 0) return x.s ? `${fmt(x.km)} km · ${minSec(x.s)}` : `${fmt(x.km)} km`;
  if (x.s != null && !(x.r > 0)) return x.kg > 0 ? `${w} × ${minSec(x.s)}` : minSec(x.s);
  if (x.cote === 'g' || x.cote === 'd' || (x.gauche != null && x.droite != null)) return `${w}×${L26().cotes(x.gauche ?? x.r ?? 0, x.droite ?? x.r ?? 0)}`;
  return `${w}×${x.r ?? 0}`;
}
const resumeSeries = (series) => series.map((x) => (x.rpe != null && x.rpe !== '' ? `${libelleSerie(x)} @${fmt(Number(x.rpe))}` : libelleSerie(x))).join(' · ');

/** Séries qui battent tout ce qui précède (stats_state.dart _recordSets) : charge × répétitions non dominée, ou durée plus longue. */
export function seriesRecords(seances) {
  const ordre = [...seances].sort((a, b) => enDate(a.debut) - enDate(b.debut));
  const front = new Map(), duree = new Map(), out = new Set();
  for (const s of ordre) for (const e of s.donnees?.exercices || []) for (const x of e.series || []) {
    if (!COMPTE(x)) continue;
    if (x.s > 0 && !(x.r > 0)) {
      if (x.s > (duree.get(e.ex) ?? 0)) { if (duree.has(e.ex)) out.add(x); duree.set(e.ex, x.s); }
      continue;
    }
    if (!(x.r > 0)) continue;
    const f = front.get(e.ex);
    const kg = x.kg ?? 0;
    if (f && f.some((p) => p.r >= x.r && p.kg >= kg - 1e-9)) continue;
    if (f) out.add(x);
    front.set(e.ex, [...(f || []).filter((p) => !(p.r <= x.r && p.kg <= kg)), { r: x.r, kg }]);
  }
  return out;
}

/** Texte copié par « Copier en texte » (stats_state.dart workoutText). */
export function texteSeance(s) {
  const X = L26();
  const lignes = [];
  if (s.nom?.trim()) lignes.push(s.nom.trim());
  lignes.push(s.duree_s > 0 ? `${dateLongue(s.debut)} · ${Math.floor(s.duree_s / 60)} min` : dateLongue(s.debut));
  let reps = 0;
  for (const e of s.donnees.exercices) {
    lignes.push('', nomExercice(trouverExercice(e.ex)) || e.ex);
    for (const x of e.series) {
      if (COMPTE(x)) reps += x.r ?? 0;
      const l = x.km > 0 ? `${fmt(x.km)} km · ${minSec(x.s ?? 0)}` : x.s != null && !(x.r > 0) ? minSec(x.s)
        : x.kg > 0 ? `${poids(x.kg)} ${unite()} × ${x.r ?? 0}` : X.reps(x.r ?? 0);
      lignes.push(`  ${l}`);
    }
  }
  const b = bilanSeance(s.donnees), v = volume(b.volume);
  lignes.push('', `${X.series(b.series)} · ${X.reps(reps)} · ${v.val} ${v.unite}`);
  return lignes.join('\n');
}

// ---------- Bilan sommeil et énergie d'une séance (check_in.dart), gardé dans le module « checkin » du compte ----------
export const lireCheckIn = (cle) => lireModule('checkin')?.seances?.[cle] ?? {};
export function noterCheckIn(cle, champ, v) {
  const m = lireModule('checkin') ?? {};
  const seances = { ...(m.seances ?? {}) };
  const actuel = { ...(seances[cle] ?? {}) };
  if (v == null) delete actuel[champ]; else actuel[champ] = v;
  if (Object.keys(actuel).length) seances[cle] = actuel; else delete seances[cle];
  // Les 200 dernières séances notées suffisent (le reste n'entre plus dans aucune moyenne).
  const garder = Object.fromEntries(Object.entries(seances).slice(-200));
  return ecrireModule('checkin', { ...m, seances: garder }).catch(() => afficher(L26().annuler, 'danger'));
}

export function CheckIn({ cle, plat = false }) {
  const X = L26();
  const val = lireCheckIn(cle);
  const ligne = (champ, icone, lib, coul) => {
    const v = val[champ];
    return <div class="l26-ci-ligne">
      <div class="l26-ci-tete">
        <Ic n={icone} taille={15} classe={v ? `l26-ci-ic ${coul}` : 'l26-ci-ic'} />
        <strong>{lib}</strong>
        <span class={v ? coul : ''}>{v ? X.niveaux[v] : X.facultatif}</span>
      </div>
      <div class={`l26-ci-barres ${coul}`}>
        {[1, 2, 3, 4, 5].map((i) => <button key={i} type="button" aria-pressed={v === i} aria-label={`${lib} ${X.niveaux[i]}`}
          onClick={() => { navigator.vibrate?.(5); noterCheckIn(cle, champ, v === i ? null : i); }}><i class={v && i <= v ? 'on' : ''} /></button>)}
      </div>
    </div>;
  };
  return <div class={plat ? 'l26-ci' : 'l26-ci carte-douce'}>
    <p class="l26-ci-titre">{X.checkInTitre}</p>
    {ligne('d', 'moon', X.sommeil, 'sauge')}
    {ligne('e', 'lightning', X.energie, 'laiton')}
  </div>;
}

// ---------- Écriture d'une séance enregistrée ----------
async function ecrireSeance(s, fn) {
  const c = structuredClone(s);
  fn(c);
  const e = etat.value;
  try {
    if (!c.donnees.exercices.length) {
      etat.value = { ...e, seances: e.seances.filter((x) => x.cle !== s.cle) };
      await api('DELETE', `/api/seances/${s.id}`);
    } else {
      etat.value = { ...e, seances: e.seances.map((x) => (x.cle === s.cle ? c : x)) };
      await api('PUT', `/api/seances/${s.id}`, { debut: enDate(c.debut).toISOString(), duree_s: c.duree_s, nom: c.nom ?? '', ...c.donnees });
    }
  } catch {
    afficher(L26().annuler, 'danger');
    await charger().catch(() => {});
  }
}

/** CONTINUER (workout_state.dart resumeLoggedSession) : la séance repasse en cours, séries cochées, à sa date d'origine. */
export async function reprendreSeance(s) {
  if (enCours.value) return;
  const debut = enDate(s.debut);
  const aujourdhui = jourLocal(debut) === jourLocal(new Date());
  majEnCours(() => ({
    cle: s.cle, debut: debut.toISOString(), nom: s.nom ?? '', routine: null, note: s.donnees.note ?? '', courant: 0, repos: null, enPause: false, verrou: false,
    // Séance d'un autre jour : saisie après coup, durée figée (manual de l'original).
    ...(aujourdhui ? { pauseAccum_ms: Math.max(0, Date.now() - debut.getTime() - s.duree_s * 1000) } : { manuel: { duree_s: s.duree_s } }),
    exercices: s.donnees.exercices.map((e) => ({ ...e, note: e.note ?? '', series: e.series.map((x) => ({ rpe: null, rir: null, ...x, fait: true })) })),
  }));
  const e = etat.value;
  etat.value = { ...e, seances: e.seances.filter((x) => x.cle !== s.cle) };
  try { await api('DELETE', `/api/seances/${s.id}`); } catch { /* elle sera réécrite à la fin de la séance (même clé) */ }
  location.hash = '#/seance';
}

// ---------- Feuille d'un jour ----------
export function FeuilleJour({ jour, fermer }) {
  const X = L26();
  const [renommer, setRenommer] = useState(null);
  const [checkIn, setCheckIn] = useState(null);
  const [supprSeance, setSupprSeance] = useState(null);
  const [continuer, setContinuer] = useState(null);
  const [edition, setEdition] = useState(null);
  const [supprEntree, setSupprEntree] = useState(null);
  if (!jour) return null;
  const toutes = etat.value.seances;
  const duJour = toutes.filter((s) => jourDe(s.debut) === jour).sort((a, b) => enDate(a.debut) - enDate(b.debut));
  const records = seriesRecords(toutes);
  let nbEx = 0, nbSeries = 0, vol = 0, duree = 0;
  for (const s of duJour) { const b = bilanSeance(s.donnees); nbEx += s.donnees.exercices.length; nbSeries += b.series; vol += b.volume; duree += s.duree_s ?? 0; }
  const v = volume(vol);
  const futur = jour > jourLocal(new Date());
  const stat = (lib, val) => <div class="l26-jour-stat"><span>{lib}</span><strong>{val}</strong></div>;
  const ouvert = (s) => toutes.find((x) => x.cle === s?.cle) ?? null;
  return <>
    <Feuille ouverte fermer={fermer} titre={dateLongue(jour)} classe="l26-jour">
      {duJour.length === 0 ? <p class="l26-jour-repos">{X.reposRien}</p> : <>
        <div class="l26-jour-stats">
          {stat(X.exercicesCaps, nbEx)}
          {stat(X.seriesCaps, nbSeries)}
          {stat(X.volumeCaps, `${v.val} ${v.unite}`)}
          {duree > 0 && stat(X.tempsCaps, `${Math.floor(duree / 60)}m`)}
        </div>
        <p class="l26-jour-aide">{X.toucherCrayon}</p>
        {duJour.map((s) => {
          const b = bilanSeance(s.donnees), vs = volume(b.volume);
          const ci = lireCheckIn(s.cle);
          const titre = s.nom?.trim();
          return <section class="l26-jour-seance" key={s.cle}>
            <div class="l26-jour-tete">
              <button type="button" class={`l26-jour-nom ${titre ? '' : 'vide'}`} aria-label={X.nomSeance} disabled={!s.id} onClick={() => setRenommer({ s, nom: titre ?? '' })}>
                <span>{titre || X.nommer}</span><Ic n="pencil-simple" taille={13} />
              </button>
              {(lireM13().checkIn !== false || ci.d || ci.e) && <button type="button" class="l26-pastille" aria-label={X.checkInTitre} onClick={() => setCheckIn(s.cle)}>
                <Ic n="moon" taille={12} classe={ci.d ? 'sauge' : ''} /><b>{ci.d ?? '-'}</b>
                <Ic n="lightning" taille={12} classe={ci.e ? 'laiton' : ''} /><b>{ci.e ?? '-'}</b>
              </button>}
            </div>
            {photosDe(s.cle).length > 0 && <PhotosSeance cle={s.cle} jour={jour} cadre={false} />}
            <div class="l26-jour-meta">
              <span class="l26-jour-resume">{X.series(b.series)} · {vs.val} {vs.unite}</span>
              <button type="button" class="l26-pastille" aria-label={X.dureeSeance} disabled={!s.id} onClick={async () => {
                const m = await demanderRegle({ titre: X.dureeSeance, valeur: s.duree_s > 0 ? Math.round(s.duree_s / 60) : 60, min: 1, max: 300, pas: 1, majeur: 10, unite: 'min' });
                if (m != null && Math.round(m) * 60 !== s.duree_s) ecrireSeance(ouvert(s), (c) => { c.duree_s = Math.round(m) * 60; });
              }}><Ic n="timer" taille={12} /><b>{s.duree_s > 0 ? `${Math.round(s.duree_s / 60)} min` : '- min'}</b></button>
              <span class="l26-jour-espace" />
              <button type="button" class="l26-icone" aria-label={X.copierTexte} onClick={async () => {
                try { await navigator.clipboard.writeText(texteSeance(s)); afficher(X.copie); } catch { afficher(X.annuler, 'danger'); }
              }}><Ic n="copy" taille={16} /></button>
              <button type="button" class="l26-icone" aria-label={X.supprimerSeance} disabled={!s.id} onClick={() => setSupprSeance(s)}><Ic n="trash" taille={16} /></button>
              {!enCours.value && s.id && <button type="button" class="l26-continuer" onClick={() => setContinuer(s)}><Ic n="play:fill" taille={11} />{X.continuer}</button>}
            </div>
            {s.donnees.exercices.map((e, i) => {
              const nom = nomExercice(trouverExercice(e.ex)) || e.ex;
              const battues = e.series.filter((x) => COMPTE(x) && records.has(x));
              return <div class="l26-jour-ex" key={i}>
                <i class="l26-puce" aria-hidden="true" />
                <div class="l26-jour-ex-corps">
                  <strong>{nom}</strong>
                  <small>{resumeSeries(e.series)}</small>
                  {battues.length > 0 && <span class="l26-jour-pr"><span class="l26-medaille" role="img" aria-label={X.recordPerso}><Ic n="trophy" taille={10} /></span>{battues.map(libelleSerie).join(' · ')}</span>}
                  {e.series.map((x, k) => x.note?.trim() && <span class="l26-jour-note" key={k}><Ic n="note-pencil:fill" taille={11} />{X.noteSerie(k + 1, x.note.trim())}</span>)}
                </div>
                <button type="button" class="l26-icone" aria-label={`${X.modifier} ${nom}`} disabled={!s.id} onClick={() => setEdition({ s, i })}><Ic n="pencil-simple" taille={16} /></button>
                {s.donnees.exercices.length > 1 && <button type="button" class="l26-icone" aria-label={`${X.supprimerCaps} ${nom}`} disabled={!s.id} onClick={() => setSupprEntree({ s, i, nom })}><Ic n="trash" taille={16} /></button>}
              </div>;
            })}
          </section>;
        })}
      </>}
      {!enCours.value && !futur && <button type="button" class="l26-fantome" onClick={() => { fermer(); feuilleDemarrage.value = jour; if (location.hash.replace(/^#/, '').split('?')[0] !== '/') location.hash = '#/'; }}>
        <Ic n="plus" taille={16} />{X.enregistrerSeance}
      </button>}
    </Feuille>

    {renommer && <Dialogue ouvert fermer={() => setRenommer(null)} titre={X.nomSeance} libelle={t.commun.valider}
      confirmer={() => { const n = renommer.nom.trim(); if (n !== (renommer.s.nom ?? '').trim()) ecrireSeance(ouvert(renommer.s), (c) => { c.nom = n; }); setRenommer(null); }}>
      <input class="form-input" maxLength={80} value={renommer.nom} placeholder={X.nomSeanceAide} aria-label={X.nomSeance}
        onInput={(ev) => setRenommer({ ...renommer, nom: ev.target.value })} />
    </Dialogue>}
    {checkIn && <Feuille ouverte fermer={() => setCheckIn(null)}><CheckIn cle={checkIn} plat /></Feuille>}
    <Dialogue ouvert={!!supprSeance} fermer={() => setSupprSeance(null)} titre={X.supprimerSeance} texte={X.supprimerSeanceTexte} libelle={X.supprimer} danger
      confirmer={() => { const s = supprSeance; setSupprSeance(null); ecrireSeance(ouvert(s), (c) => { c.donnees.exercices = []; }); }} />
    <Dialogue ouvert={!!continuer} fermer={() => setContinuer(null)} titre={X.continuer} texte={X.continuerTexte} libelle={X.continuer}
      confirmer={() => { const s = continuer; setContinuer(null); fermer(); reprendreSeance(s); }} />
    <Dialogue ouvert={!!supprEntree} fermer={() => setSupprEntree(null)} titre={X.supprimerEntree} texte={supprEntree ? X.supprimerEntreeTexte(supprEntree.nom) : ''} libelle={X.supprimer}
      confirmer={() => { const { s, i } = supprEntree; setSupprEntree(null); ecrireSeance(ouvert(s), (c) => { c.donnees.exercices.splice(i, 1); }); }} />
    {edition && <FeuilleCorriger s={ouvert(edition.s)} i={edition.i} fermer={() => setEdition(null)} />}
  </>;
}

// ---------- Correction d'une entrée (showEditLoggedSheet) : les changements partent quand la feuille se ferme ----------
function FeuilleCorriger({ s, i, fermer }) {
  const X = L26();
  const [ex, setEx] = useState(() => structuredClone(s?.donnees.exercices[i]));
  if (!s || !ex) return null;
  const def = trouverExercice(ex.ex);
  const nom = nomExercice(def) || ex.ex;
  const repsSeules = def?.mesure === 'corps';
  const distance = ex.series.some((x) => x.km > 0);
  const temps = !distance && (def?.mesure === 'duree' || ex.series.some((x) => x.s != null && !(x.r > 0)));
  const maj = (k, fn) => setEx((v) => { const c = structuredClone(v); fn(c.series[k]); return c; });
  const finir = () => {
    fermer();
    if (JSON.stringify(ex) === JSON.stringify(s.donnees.exercices[i])) return;
    ecrireSeance(s, (c) => { if (ex.series.length) c.donnees.exercices[i] = ex; else c.donnees.exercices.splice(i, 1); });
  };
  const pasSec = (v) => (v >= 600 ? 30 : 5);
  const cellule = (lib, val, moins, plus) => <div class="l26-cell">
    <span>{lib}</span>
    <div class="l26-pas">
      <button type="button" aria-label={`${X.diminuer} ${lib}`} onClick={moins}>−</button>
      <b>{val}</b>
      <button type="button" aria-label={`${X.augmenter} ${lib}`} onClick={plus}>+</button>
    </div>
  </div>;
  return <Feuille ouverte fermer={finir} titre={nom} sous={X.corrigerAide} classe="l26-corriger"
    pied={<button type="button" class="btn pri large" onClick={finir}>{X.termine}</button>}>
    {ex.series.map((x, k) => {
      const sec = x.s ?? 0;
      const tempsCell = cellule(X.tempsCol, minSec(sec), () => maj(k, (y) => { const p = pasSec(sec); y.s = Math.max(0, Math.floor(sec / p) * p - p); }),
        () => maj(k, (y) => { const p = pasSec(sec); y.s = Math.min(86400, Math.floor(sec / p) * p + p); }));
      const pas = pasCharge();
      const poidsCell = cellule(X.poidsCol(unite().toUpperCase()), poids(x.kg ?? 0),
        () => maj(k, (y) => { y.kg = versKg(Math.max(0, Math.round(versAffichage(y.kg ?? 0) / pas) * pas - pas)); }),
        () => maj(k, (y) => { y.kg = versKg(Math.round(versAffichage(y.kg ?? 0) / pas) * pas + pas); }));
      const cotes = x.gauche != null && x.droite != null;
      return <div class="l26-corr-ligne" key={k}>
        <b class="l26-corr-num">{k + 1}</b>
        {distance ? <>
          {cellule(X.distanceCol, `${fmt(x.km ?? 0)}`, () => maj(k, (y) => { y.km = Math.max(0, Math.round(((y.km ?? 0) - 0.1) * 10) / 10); }), () => maj(k, (y) => { y.km = Math.round(((y.km ?? 0) + 0.1) * 10) / 10; }))}
          {tempsCell}
        </> : <>
          {temps ? tempsCell : cotes ? <>
            {cellule(X.repsG, x.gauche, () => maj(k, (y) => { y.gauche = Math.max(0, y.gauche - 1); }), () => maj(k, (y) => { y.gauche = Math.min(999, y.gauche + 1); }))}
            {cellule(X.repsD, x.droite, () => maj(k, (y) => { y.droite = Math.max(0, y.droite - 1); }), () => maj(k, (y) => { y.droite = Math.min(999, y.droite + 1); }))}
          </> : cellule(X.repsCol, x.r ?? 0, () => maj(k, (y) => { y.r = Math.max(0, (y.r ?? 0) - 1); }), () => maj(k, (y) => { y.r = Math.min(999, (y.r ?? 0) + 1); }))}
          {!repsSeules && (!temps || x.kg > 0) && poidsCell}
        </>}
        <button type="button" class="l26-corr-suppr" aria-label={X.retirerSerie} onClick={() => setEx((v) => ({ ...v, series: v.series.filter((_, j) => j !== k) }))}><Ic n="x" taille={14} /></button>
      </div>;
    })}
    <button type="button" class="l26-corr-ajouter" onClick={() => setEx((v) => {
      const d = v.series.at(-1) ?? { r: 10, kg: repsSeules ? 0 : 20, type: 'n' };
      return { ...v, series: [...v.series, { ...d, type: d.type ?? 'n', fait: true, note: undefined, rpe: undefined }] };
    })}>{X.ajouterSerie}</button>
  </Feuille>;
}

// ---------- Séance saisie après coup (session_screen.dart _manualBar) : jour, heure de début et durée réglables ----------
export function BarreManuelle({ ec, sortir, libSortir }) {
  const X = L26();
  const debut = enDate(ec.debut);
  const minutes = Math.round((ec.manuel?.duree_s ?? 0) / 60);
  const heure = (min) => new Intl.DateTimeFormat(langue === 'en' ? 'en-US' : 'fr-FR', { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, Math.floor(min / 60), min % 60));
  const minuteDuJour = debut.getHours() * 60 + debut.getMinutes();
  return <header class="sx-barre l26-manuel">
    <div class="l26-manuel-ligne">
      <button type="button" class="rond sx-sortir" onClick={sortir} aria-label={libSortir}><Ic n="caret-down:bold" taille={15} /></button>
      <Ic n="calendar-plus" taille={15} classe="laiton" />
      <span class="l26-manuel-titre">{X.enregistrement} · {dateLongue(debut)}</span>
    </div>
    <div class="l26-manuel-puces">
      <button type="button" class="l26-puce-manuelle" aria-label={X.heureDebut} onClick={async () => {
        const v = await demanderRegle({ titre: X.heureDebut, valeur: minuteDuJour, min: 0, max: 24 * 60 - 5, pas: 5, majeur: 12, format: (n) => heure(Math.round(n)), etiquette: (n) => String(Math.floor(Math.round(n) / 60)) });
        if (v == null) return;
        majEnCours((x) => { const d = enDate(x.debut); d.setHours(Math.floor(v / 60), Math.round(v) % 60, 0, 0); x.debut = d.toISOString(); return x; });
      }}><Ic n="clock" taille={15} classe="laiton" /><b>{heure(minuteDuJour)}</b></button>
      <button type="button" class="l26-puce-manuelle" aria-label={X.duree} onClick={async () => {
        const v = await demanderRegle({ titre: X.duree, valeur: minutes || 60, min: 5, max: 240, pas: 5, majeur: 6, format: (n) => `${Math.round(n)} min`, etiquette: (n) => String(Math.round(n)) });
        if (v != null) majEnCours((x) => ({ ...x, manuel: { duree_s: Math.min(24 * 60, Math.round(v)) * 60 } }));
      }}><Ic n="timer" taille={15} classe="laiton" /><b>{minutes ? `${minutes} min` : X.ajouterDuree}</b></button>
    </div>
  </header>;
}

// ---------- Décompte avant la séance (widgets/start_countdown.dart) : toucher n'importe où commence tout de suite ----------
export function Decompte({ ec }) {
  const X = L26();
  const [, tic] = useState(0);
  const reste = Math.ceil(((ec.decompte ?? 0) - Date.now()) / 1000);
  const finir = () => majEnCours((x) => { if (!x?.decompte) return x; const { decompte, ...r } = x; return { ...r, debut: new Date(Math.min(Date.now(), decompte)).toISOString() }; });
  useEffect(() => {
    if (reste <= 0) { navigator.vibrate?.(30); finir(); return undefined; }
    navigator.vibrate?.(12);
    const id = setTimeout(() => tic((n) => n + 1), ((ec.decompte - Date.now()) % 1000) + 5);
    return () => clearTimeout(id);
  });
  if (reste <= 0) return null;
  const premier = ec.exercices[ec.courant ?? 0];
  return <button type="button" class="l26-decompte" aria-label={X.commencerTout} onClick={finir}>
    <span class="l26-decompte-titre">{X.preparez}</span>
    <span class="l26-decompte-n" key={reste} aria-live="assertive">{reste}</span>
    {premier && <span class="l26-decompte-ex">{nomExercice(trouverExercice(premier.ex)) || premier.ex}</span>}
    <span class="l26-decompte-aide">{X.commencerTout}</span>
  </button>;
}
