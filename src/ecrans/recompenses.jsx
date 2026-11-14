// Médailles (awards_screen.dart) : sur-titre, grand titre, épingle de choix pour le profil, carte de résumé, grilles à deux colonnes avec date.
// Exporte aussi la célébration (confettis) réutilisée par le bilan et la séance.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { ecrireModule, etat, lireModule } from '../donnees.js';
import { calculerDistinctions, IcMedaille } from '../distinctions.js';
import { M03 } from '../i18n/m03.js';
import { langue } from '../i18n.js';
import { Feuille, Ic, Rond } from '../ui.jsx';
import './m03.css';

const COULEURS = ['#D9A184', '#8FA377', '#C6982C', '#7FA8C9', '#C02347', '#2F63C4', '#1F9F74'];

/** Confettis : pièces colorées qui tombent, désactivées si les animations sont réduites. */
export function Confettis({ actif, nombre = 40 }) {
  const [pieces, setPieces] = useState([]);
  useEffect(() => {
    if (!actif) { setPieces([]); return undefined; }
    let reduit = false;
    try { reduit = matchMedia('(prefers-reduced-motion: reduce)').matches || etat.value?.profil?.reduire_animations; } catch { /* sans effet */ }
    if (reduit) { setPieces([]); return undefined; }
    setPieces(Array.from({ length: nombre }, (_, i) => ({
      i,
      left: Math.random() * 100,
      delai: Math.random() * 900,
      duree: 1800 + Math.random() * 1600,
      rotation: Math.random() * 360,
      couleur: COULEURS[i % COULEURS.length],
      rond: i % 5 === 0,
    })));
    const fin = setTimeout(() => setPieces([]), 4200);
    return () => clearTimeout(fin);
  }, [actif, nombre]);
  if (!pieces.length) return null;
  return <div class="celebration-overlay" aria-hidden="true">
    {pieces.map((p) => (
      <span
        key={p.i}
        class={`confetti ${p.rond ? 'circle' : 'rect'}`}
        style={`left:${p.left}%;background:${p.couleur};transform:rotate(${p.rotation}deg);
          animation:confettiChute ${p.duree}ms var(--ease-out) ${p.delai}ms forwards`}
      />
    ))}
    <style>{`@keyframes confettiChute {
      0% { opacity: 0; translate: 0 -20px; }
      10% { opacity: 1; }
      100% { opacity: 0; translate: 0 105vh; rotate: 320deg; }
    }`}</style>
  </div>;
}

/** Célébration de médaille : carte centrée, médaillon, confettis. */
export function CelebrationMedaille({ medaille, fermer }) {
  useEffect(() => {
    if (!medaille) return undefined;
    const i = setTimeout(fermer, 3600);
    return () => clearTimeout(i);
  }, [medaille?.id]);
  if (!medaille) return null;
  const m = M03[langue] ?? M03.fr;
  return <>
    <Confettis actif nombre={48} />
    <div class="record-celebration" role="status" aria-live="polite" onClick={fermer}>
      <div class="carte">
        <div class="medaille-detail-svg" style="width:96px;height:96px;margin:0 auto 12px"><IcMedaille id={medaille.id} /></div>
        <p class="record-titre">{m.seance.medalTitre}</p>
        <p class="record-exercice">{medaille.titre}</p>
        {medaille.ligne && <p class="record-valeur">{medaille.ligne}</p>}
      </div>
    </div>
  </>;
}

/** Date d'obtention de chaque médaille gagnée : plus petit préfixe chronologique des séances qui la débloque (recherche dichotomique, les compteurs ne font que monter). */
function datesObtention(seances, programmes) {
  const tri = [...seances].sort((a, b) => String(a.debut).localeCompare(String(b.debut)));
  const finales = calculerDistinctions(tri, 'fr', programmes);
  const out = {};
  finales.forEach((d, k) => {
    if (!d.debloque || !tri.length) return;
    // Débloquée sans aucune séance (premier programme) : pas de date de séance à montrer.
    if (calculerDistinctions([], 'fr', programmes)[k].debloque) return;
    let bas = 1, haut = tri.length;
    while (bas < haut) {
      const mil = (bas + haut) >> 1;
      if (calculerDistinctions(tri.slice(0, mil), 'fr', programmes)[k].debloque) haut = mil; else bas = mil + 1;
    }
    out[d.id] = tri[bas - 1].debut;
  });
  return out;
}

const court = (v) => (Math.round(v * 10) / 10).toLocaleString(langue === 'en' ? 'en-US' : 'fr-FR');

export function Recompenses() {
  const m = M03[langue] ?? M03.fr;
  const r = m.recompenses;
  const [detail, setDetail] = useState(null);
  const [choix, setChoix] = useState(false);
  const programmes = etat.value.routines?.length ?? 0;
  const medailles = useMemo(
    () => calculerDistinctions(etat.value.seances, langue, programmes),
    [etat.value.seances, langue, programmes],
  );
  const dates = useMemo(() => datesObtention(etat.value.seances, programmes), [etat.value.seances, programmes]);
  const gagnees = medailles.filter((d) => d.debloque);
  const aVenir = medailles.filter((d) => !d.debloque);
  const total = medailles.length;
  const pct = total ? Math.round((gagnees.length * 100) / total) : 0;
  // Médailles montrées sur le profil (GymMane toggleProfileMedal), gardées sur le compte.
  const profil = Array.isArray(lireModule('medaillesProfil')) ? lireModule('medaillesProfil') : [];
  const basculer = (id) => ecrireModule('medaillesProfil', profil.includes(id) ? profil.filter((x) => x !== id) : [...profil, id]).catch(() => {});
  const fmt = new Intl.DateTimeFormat(langue === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  const Carte = ({ d }) => {
    const choisissable = choix && d.debloque;
    const montree = profil.includes(d.id);
    const quand = dates[d.id];
    return <button
      type="button"
      class={`rc-carte ${d.debloque ? '' : 'verrouillee'} ${choix && !d.debloque ? 'estompee' : ''} ${choisissable && montree ? 'montree' : ''}`}
      onClick={() => (choisissable ? basculer(d.id) : setDetail(d))}
      aria-pressed={choisissable ? montree : undefined}
      aria-label={`${d.titre}, ${d.debloque ? (quand ? fmt.format(new Date(quand)) : r.gagnees) : `${court(d.valeur ?? 0)} / ${court(d.objectif)}`}`}
    >
      <span class="rc-medaille" aria-hidden="true"><IcMedaille id={d.id} /></span>
      <span class="rc-nom">{d.titre}</span>
      <span class="rc-date">{d.debloque ? (quand ? fmt.format(new Date(quand)) : '') : `${court(d.valeur ?? 0)} / ${court(d.objectif)}`}</span>
      {choisissable && <span class={`rc-coche ${montree ? 'oui' : ''}`} aria-hidden="true">{montree && <Ic n="check:bold" taille={12} />}</span>}
    </button>;
  };

  return <main class="ecran rc-ecran">
    <div class="rc-barre">
      <Rond n="chevron" label={r.retour} href="#/profil" classe="rc-rond" />
      {gagnees.length > 0 && <button type="button" class={`rond rc-rond ${choix ? 'plein' : ''}`} aria-pressed={choix} aria-label={r.choisir}
        onClick={() => setChoix((v) => !v)}><Ic n={choix ? 'check:bold' : 'push-pin'} taille={17} /></button>}
    </div>
    <header class="rc-tete">
      <p class="rc-surtitre">{choix ? r.choisirAide : r.profil}</p>
      <h1 class="rc-titre">{r.titre}</h1>
    </header>

    <div class="rc-feuille">
      <span class="rc-poignee" aria-hidden="true" />
      <div class="rc-resume">
        <div class="rc-resume-ligne">
          <span class="rc-resume-ic" aria-hidden="true"><Ic n="medal" taille={22} /></span>
          <div class="rc-resume-texte">
            <p class="rc-compte"><strong>{gagnees.length}</strong><span>/ {total}</span></p>
            <p class="rc-gagnees">{r.gagnees}</p>
          </div>
          <span class="rc-pct">{pct} %</span>
        </div>
        <div class="rc-barre-prog" role="progressbar" aria-label={r.anneau} aria-valuemin={0} aria-valuemax={total} aria-valuenow={gagnees.length}>
          <span style={`width:${Math.max(2, pct)}%`} />
        </div>
      </div>

      {gagnees.length > 0 && <>
        <p class="rc-section">{r.gagnees}<span>{gagnees.length}</span></p>
        <div class="rc-grille">{gagnees.map((d) => <Carte key={d.id} d={d} />)}</div>
      </>}
      {aVenir.length > 0 && <>
        <p class="rc-section">{r.verrouillees}<span>{aVenir.length}</span></p>
        <div class="rc-grille">{aVenir.map((d) => <Carte key={d.id} d={d} />)}</div>
      </>}
    </div>

    <Feuille ouverte={!!detail} fermer={() => setDetail(null)} titre={detail?.titre ?? ''}>
      {detail && <div class="medaille-detail">
        <div class="medaille-detail-svg"><IcMedaille id={detail.id} /></div>
        <p class="medaille-detail-desc">{detail.ligne}</p>
        <p class="medaille-detail-stat">
          {detail.cle === 'record'
            ? `${detail.debloque ? 1 : 0} / 1`
            : m.recompenses.progression(Math.round((detail.valeur ?? 0) * 10) / 10, detail.objectif)}
        </p>
        <div class="medaille-progres" style="height:8px">
          <div class="medaille-progres-bar" style={`width:${Math.round(Math.min(1, (detail.valeur ?? 0) / (detail.objectif || 1)) * 100)}%`} />
        </div>
        {detail.debloque && <p style="margin-top:12px;color:var(--sage);font-weight:800"><Ic n="check-circle:fill" taille={16} /> {dates[detail.id] ? r.obtenueLe(fmt.format(new Date(dates[detail.id]))) : r.gagnees}</p>}
      </div>}
    </Feuille>
  </main>;
}
