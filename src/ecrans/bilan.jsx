// Bilan de fin de séance (session_screen.dart _complete) : carte titre, trois tuiles, records, médailles, TERMINÉ, partager, continuer la séance.
import { CheckIn } from './l26-jour.jsx';
import { PhotosSeance } from './l26-photos.jsx';
import { L26 } from '../i18n/l26.js';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { EditeurSticker, libelleSticker } from './sticker.jsx';
import { afficher, api, bilanSeance, duree, enDate, etat, jourLocal, majEnCours, minSec, nomExercice, nombre, poids, recordsDe, semaine, serieJours, unite, volume } from '../donnees.js';
import { calculerDistinctions, IcMedaille } from '../distinctions.js';
import { M03 } from '../i18n/m03.js';
import { langue, t, dp } from '../i18n.js';
import { Feuille, Ic, Kicker } from '../ui.jsx';
import { CelebrationMedaille, Confettis } from './recompenses.jsx';
import { lireM13 } from './reglages-m13.js';
import { annulerVotes, CarteEtape, CarteVolume, marquerVue, musclesANoter, proposerEtape } from './bilan-cartes.jsx';
import './m03.css';

function estAnimationReduite() {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches || Boolean(etat.value?.profil?.reduire_animations);
  } catch {
    return Boolean(etat.value?.profil?.reduire_animations);
  }
}

function useCompteurAnime(cible, dureeMs = 800) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (estAnimationReduite()) { setVal(cible); return undefined; }
    const debut = performance.now();
    let frame = 0;
    const anim = (maintenant) => {
      const p = Math.min(1, (maintenant - debut) / dureeMs);
      setVal(Math.round(cible * p));
      if (p < 1) frame = requestAnimationFrame(anim);
    };
    frame = requestAnimationFrame(anim);
    return () => cancelAnimationFrame(frame);
  }, [cible, dureeMs]);
  return val;
}

/** Sticker de partage : mêmes chiffres que le bilan, rendu en SVG pour le téléchargement. */
function svgSticker({ nom, date, dureeTexte, series, vol, records, m }) {
  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lignes = records.slice(0, 3).map((r, i) => `<text x="24" y="${368 + i * 24}" font-family="Nunito, sans-serif" font-size="14" font-weight="600" fill="#FFFFFF">${esc(r.nom)}</text>
      <text x="296" y="${368 + i * 24}" text-anchor="end" font-family="Nunito, sans-serif" font-size="14" font-weight="700" fill="#D9A184">${esc(r.val)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="440" viewBox="0 0 320 440">
  <rect width="320" height="440" rx="24" fill="#0A0A0A"/>
  <text x="24" y="44" font-family="Nunito, sans-serif" font-size="16" font-weight="700" fill="#FFFFFF">${esc(nom)}</text>
  <text x="296" y="44" text-anchor="end" font-family="Nunito, sans-serif" font-size="11" font-weight="600" fill="#808080">${esc(date)}</text>
  <rect x="24" y="70" width="80" height="66" rx="14" fill="#1C1C1C"/>
  <text x="64" y="104" text-anchor="middle" font-family="Nunito, sans-serif" font-size="18" font-weight="800" fill="#FFFFFF">${esc(dureeTexte)}</text>
  <text x="64" y="122" text-anchor="middle" font-family="Nunito, sans-serif" font-size="10" font-weight="700" fill="#808080">${esc(m.partage.duree.toUpperCase())}</text>
  <rect x="120" y="70" width="80" height="66" rx="14" fill="#1C1C1C"/>
  <text x="160" y="104" text-anchor="middle" font-family="Nunito, sans-serif" font-size="18" font-weight="800" fill="#FFFFFF">${esc(series)}</text>
  <text x="160" y="122" text-anchor="middle" font-family="Nunito, sans-serif" font-size="10" font-weight="700" fill="#808080">${esc(m.partage.series.toUpperCase())}</text>
  <rect x="216" y="70" width="80" height="66" rx="14" fill="#1C1C1C"/>
  <text x="256" y="104" text-anchor="middle" font-family="Nunito, sans-serif" font-size="18" font-weight="800" fill="#FFFFFF">${esc(vol)}</text>
  <text x="256" y="122" text-anchor="middle" font-family="Nunito, sans-serif" font-size="10" font-weight="700" fill="#808080">${esc(m.partage.volume.toUpperCase())}</text>
  ${records.length ? `<rect x="24" y="330" width="272" height="${28 + Math.min(3, records.length) * 24}" rx="14" fill="rgba(217,161,132,.16)"/>
  <text x="36" y="352" font-family="Nunito, sans-serif" font-size="11" font-weight="800" fill="#D9A184">${esc(m.partage.records.toUpperCase())}</text>
  ${lignes}` : ''}
  <text x="24" y="416" font-family="Nunito, sans-serif" font-size="11" font-weight="600" fill="#808080">${esc(m.partage.genere)}</text>
  <rect x="238" y="404" width="58" height="18" rx="9" fill="#D9A184"/>
  <text x="267" y="417" text-anchor="middle" font-family="Nunito, sans-serif" font-size="9" font-weight="700" fill="#0A0A0A">ANATOLY</text>
</svg>`;
}

export function Bilan({ cle }) {
  const m = M03[langue] ?? M03.fr;
  const reprise = (() => { try { const x = JSON.parse(localStorage.getItem('an_seance_finie')); return x?.cle === cle && x.ec ? x : null; } catch { return null; } })();
  // Séance terminée sans série cochée : rien n'est enregistré, le bilan s'affiche à zéro depuis la copie gardée.
  const s = etat.value.seances.find((x) => x.cle === cle) ?? (reprise?.vide ? { cle, debut: reprise.ec.debut, nom: reprise.ec.nom, duree_s: reprise.duree ?? 0, donnees: { exercices: [] } } : null);
  const [partage, setPartage] = useState(false);
  const [sticker, setSticker] = useState(false);
  const [medailleCelebree, setMedailleCelebree] = useState(null);
  const [copie, setCopie] = useState(false);
  const dejaCelebre = useRef(false);
  // Juste après Terminer (copie gardée) : réglages « Suggérer l'étape suivante » et « Ajuster les séries par muscle ».
  const neuve = Boolean(reprise && !reprise.vide && s);
  const [offre, setOffre] = useState(() => (neuve && lireM13().conseilsNiveau !== false ? proposerEtape(s, etat.value.seances) : null));
  const remettreVue = useRef(null);
  useEffect(() => { if (offre && !remettreVue.current) remettreVue.current = marquerVue(offre); }, []);
  const [cibles] = useState(() => (neuve && lireM13().reglageMusculaire !== false ? musclesANoter(reprise.ec, etat.value.routines.find((r) => String(r.id) === String(reprise.ec.routine))) : []));
  const [votes, setVotes] = useState({});

  const sansCelle = useMemo(() => etat.value.seances.filter((x) => x.cle !== cle), [etat.value.seances, cle]);
  const nouvMedailles = useMemo(() => {
    if (!s) return [];
    const avant = new Set(calculerDistinctions(sansCelle, langue, etat.value.routines?.length ?? 0).filter((d) => d.debloque).map((d) => d.id));
    return calculerDistinctions(etat.value.seances, langue, etat.value.routines?.length ?? 0).filter((d) => d.debloque && !avant.has(d.id));
  }, [s, sansCelle, langue]);

  useEffect(() => {
    if (dejaCelebre.current || !nouvMedailles.length) return;
    dejaCelebre.current = true;
    setMedailleCelebree(nouvMedailles[0]);
  }, [nouvMedailles.length]);

  const b = s ? bilanSeance(s.donnees) : { volume: 0, series: 0 };
  const records = s ? recordsDe(s, etat.value.seances) : [];
  const v = volume(b.volume);
  const animDuree = useCompteurAnime(s?.duree_s ?? 0, 1100);
  const animSeries = useCompteurAnime(b.series, 1100);

  if (!s) {
    // Après « Continuer la séance », la séance est déjà demandée : ne pas la remplacer par l'accueil.
    if (location.hash.startsWith('#/bilan')) location.replace('#/');
    return null;
  }

  const cibleVol = (() => {
    const brut = String(v.val).replace(/[\s ]/g, '').replace(',', '.');
    const n = Number(brut);
    return Number.isFinite(n) ? n : 0;
  })();
  const decimalesVol = /[.,]/.test(String(v.val)) ? 1 : 0;
  const animVolBrut = useCompteurAnime(Math.round(cibleVol * 1000), 1100);
  const animVolAffiche = decimalesVol ? nombre(animVolBrut / 1000, 1) : nombre(Math.round(animVolBrut / 1000), 0);

  const val = (r) => (r.genre === 's'
    ? minSec(r.val)
    : r.genre === 'reps'
      ? `${r.val} ${t.commun.reps}`
      : r.genre === 'echelle'
        ? `${poids(r.val)} ${unite()} × ${r.r}`
        : `${poids(r.genre === 'rm' ? Math.round(r.val * 2) / 2 : r.val)} ${unite()}${r.genre === 'rm' ? ' (1RM)' : ''}`);

  const recordTexte = records.map((r) => ({ nom: nomExercice(r.ex), val: val(r) }));
  const textePartage = [
    `${m.partage.seance} ${s.nom}`,
    `${m.partage.duree}${dp()}${duree(s.duree_s)}`,
    `${m.partage.series}${dp()}${b.series}`,
    `${m.partage.volume}${dp()}${v.val} ${v.unite}`,
    ...recordTexte.map((r) => `${r.nom}${dp()}${r.val}`),
  ].join('\n');

  const telechargerSticker = () => {
    const svg = svgSticker({
      nom: s.nom, date: enDate(s.debut).toLocaleDateString(langue === 'en' ? 'en-GB' : 'fr-FR'),
      dureeTexte: duree(s.duree_s), series: String(b.series), vol: `${v.val} ${v.unite}`, records: recordTexte, m,
    });
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `anatoly-${(s.nom || 'seance').replace(/\s+/g, '-').toLowerCase()}.svg` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setPartage(false);
  };

  const partagerNatif = async () => {
    try {
      await navigator.share({ title: s.nom || m.partage.seance, text: textePartage });
      setPartage(false);
    } catch { /* annulé par vous */ }
  };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(textePartage);
      setCopie(true);
      setTimeout(() => setCopie(false), 1800);
    } catch { /* presse-papiers refusé */ }
  };

  // Titre et phrase du bilan (finishHeadline / finishBody) : record, objectif de la semaine, série de jours, sinon par défaut.
  const nbRecords = new Set(records.map((r) => r.ex)).size;
  const objectif = etat.value.profil?.objectif_semaine ?? 3;
  const atteint = semaine(etat.value.seances).length >= objectif;
  const serie = serieJours(etat.value.seances);
  const genre = nbRecords > 0 ? 'pr' : atteint ? 'objectif' : serie >= 3 ? 'serie' : 'defaut';
  const texte = genre === 'pr' ? m.bilan.textes.pr(nbRecords) : genre === 'serie' ? m.bilan.textes.serie(serie) : m.bilan.textes[genre];
  // « Continuer la séance » (continueSession) : la séance enregistrée est retirée et la séance en cours revient, le temps passé ici ne compte pas.
  const continuer = async () => {
    try {
      await annulerVotes(reprise.ec.routine, votes);
      remettreVue.current?.();
      if (s.id && !reprise.vide) await api('DELETE', `/api/seances/${s.id}`);
      etat.value = { ...etat.value, seances: etat.value.seances.filter((x) => x.cle !== cle) };
      const ec = reprise.ec;
      majEnCours(() => ({ ...ec, cle: crypto.randomUUID ? crypto.randomUUID() : ec.cle, pauseAccum_ms: (ec.pauseAccum_ms || 0) + (ec.enPause ? 0 : Date.now() - reprise.fin) }));
      try { localStorage.removeItem('an_seance_finie'); } catch { /* */ }
      location.replace('#/seance');
    } catch { afficher(t.commun.erreur, 'danger'); }
  };
  const fermerBilan = () => { try { localStorage.removeItem('an_seance_finie'); } catch { /* */ } location.replace('#/'); };

  return <main class="ecran ecran-borne bilan">
    {lireM13().gamification !== false && <>{/* réglage « Médailles et niveaux » */}
      <Confettis actif={records.length > 0 || nouvMedailles.length > 0} nombre={records.length ? 48 : 28} />
      <CelebrationMedaille medaille={medailleCelebree} fermer={() => setMedailleCelebree(null)} /></>}

    <section class="bl-hero">
      <span class="bl-rond" aria-hidden="true" />
      <div class="bl-hero-texte">
        <p class="bl-kicker">{m.bilan.enregistree}{nbRecords > 0 && <span class="bl-pr">{m.bilan.nbRecords(nbRecords)}</span>}</p>
        <h1>{m.bilan.titres[genre]}</h1>
        <p class="bl-corps">{texte}</p>
        {s.nom && reprise?.ec?.routine == null && <p class="bl-nom">{s.nom}</p>}
      </div>
    </section>

    <div class="bl-tuiles">
      <div class="bl-tuile"><span>{m.bilan.dureeMaj}</span><strong>{animDuree < 3600 ? minSec(animDuree) : duree(animDuree)}</strong></div>
      <div class="bl-tuile"><span>{m.bilan.seriesMaj}</span><strong>{animSeries}</strong></div>
      <div class="bl-tuile"><span>{m.bilan.volumeMaj}</span><strong>{animVolAffiche} {v.unite}</strong></div>
    </div>

    {/* Sommeil et énergie (check_in.dart CheckInCard), si le réglage « Sommeil et énergie » le demande. */}
    {lireM13().checkIn !== false && s.cle && <CheckIn cle={s.cle} />}
    {s.cle && <PhotosSeance cle={s.cle} jour={jourLocal(enDate(s.debut))} />}

    {offre && <CarteEtape offre={offre} routineId={reprise?.ec?.routine} fermer={() => setOffre(null)} />}
    {cibles.length > 0 && <CarteVolume cibles={cibles} routineId={reprise.ec.routine} votes={votes} setVotes={setVotes} />}

    {records.length > 0 && <section class="section">
      <Kicker>{m.bilan.recordsBattus}</Kicker>
      <div class="carte liste-seances">
        {records.map((r) => <div class="ligne-seance" key={r.ex + r.genre}>
          <span class="avec-ic">
            <span class="pastille-record"><Ic n="trophy:fill" taille={14} /></span>
            <strong>{nomExercice(r.ex)}</strong>
          </span>
          <span class="droite"><strong>{val(r)}</strong></span>
        </div>)}
      </div>
    </section>}

    {nouvMedailles.length > 0 && <section class="section">
      <div class="section-tete">
        <Kicker>{m.bilan.medailles}</Kicker>
        <a class="voir" href="#/recompenses">{m.bilan.voirMedailles}</a>
      </div>
      <div class="carte liste-seances">
        {nouvMedailles.map((d) => <div class="ligne-seance" key={d.id}>
          <span class="avec-ic" style="gap:12px">
            <span style="flex:none;display:grid;place-items:center;width:48px;height:48px" aria-hidden="true"><IcMedaille id={d.id} /></span>
            <strong>{d.titre}</strong>
          </span>
        </div>)}
      </div>
    </section>}

    <div class="bl-actions">
      <button type="button" class="btn pri bl-fini" onClick={fermerBilan}>{m.bilan.termine}</button>
      <button type="button" class="bl-partager" onClick={() => setPartage(true)} aria-label={m.bilan.partagerLabel}><Ic n="share-network" taille={20} /></button>
    </div>
    {reprise && <button type="button" class="bl-fantome" onClick={continuer}><Ic n="arrow-counter-clockwise" taille={16} />{m.bilan.continuer}</button>}
    {/* « Partager sur une photo » (stickerOpen) : directement l'éditeur de sticker, sans passer par la feuille de partage. */}
    {b.series > 0 && <button type="button" class="bl-fantome" onClick={() => setSticker(true)}><Ic n="image-square" taille={16} />{L26().partagerPhoto}</button>}
    {!reprise?.vide && <a class="bl-fantome" href={`#/historique/${s.id ?? s.cle}`}><Ic n="list-checks" taille={16} />{m.bilan.voir}</a>}

    <Feuille ouverte={partage} fermer={() => setPartage(false)} titre={m.partage.titre}>
      <div class="partage-options">
        {typeof navigator !== 'undefined' && navigator.share && <button type="button" class="partage-btn" onClick={partagerNatif}>
          <Ic n="share-network" taille={22} /><span>{m.bilan.partager}</span>
        </button>}
        <button type="button" class="partage-btn" onClick={telechargerSticker}>
          <Ic n="image" taille={22} /><span>{m.partage.image}</span>
        </button>
        <button type="button" class="partage-btn" onClick={() => { setPartage(false); setSticker(true); }}>
          <Ic n="camera" taille={22} /><span>{libelleSticker()}</span>
        </button>
        <button type="button" class="partage-btn" onClick={copier}>
          <Ic n="copy" taille={22} /><span>{copie ? m.partage.copie : m.partage.texte}</span>
        </button>
      </div>
      <div class="sticker" style="margin:0 auto">
        <div class="sticker-tete">
          <span class="sticker-nom">{s.nom}</span>
          <span class="sticker-date">{enDate(s.debut).toLocaleDateString(langue === 'en' ? 'en-GB' : 'fr-FR')}</span>
        </div>
        <div class="sticker-stats">
          <div class="sticker-stat"><p class="sticker-stat-val">{duree(s.duree_s)}</p><p class="sticker-stat-lab">{m.partage.duree}</p></div>
          <div class="sticker-stat"><p class="sticker-stat-val">{b.series}</p><p class="sticker-stat-lab">{m.partage.series}</p></div>
          <div class="sticker-stat"><p class="sticker-stat-val">{v.val}</p><p class="sticker-stat-lab">{v.unite}</p></div>
        </div>
        {recordTexte.length > 0 && <div class="sticker-record">
          <p class="sticker-record-titre">{m.partage.records}</p>
          {recordTexte.map((r) => <p class="sticker-record-ligne" key={r.nom}><strong>{r.nom}</strong><span>{r.val}</span></p>)}
        </div>}
        <div class="sticker-pied"><span>{m.partage.genere}</span><span class="sticker-badge">ANATOLY</span></div>
      </div>
    </Feuille>
    {sticker && s && <EditeurSticker seance={s} prs={records.length} fermer={() => setSticker(false)} />}
  </main>;
}
