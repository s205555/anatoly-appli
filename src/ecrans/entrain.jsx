// M07 Entraîner : carte des muscles, filtres et sélection d'exercices (portage GymMane).
import { useEffect, useMemo, useState } from 'preact/hooks';
import { dernieresSeries, demarrerAvecExercices, etat, nomExercice, tousExercices, trouverExercice, versAffichage } from '../donnees.js';
import { langue, t } from '../i18n.js';
import { m07 } from '../i18n/m07.js';
import { IllustrationExercice } from '../illustrations.js';
import { SilhouetteSvg } from '../silhouette-svg.jsx';
import { EnTete, Ic, Rond } from '../ui.jsx';
import { ajusteIci, lieuActif, reprendreAnciens } from './lieux.jsx';
import './m07.css';

const plier = (x) => String(x ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** Recherche sans accents, tous les mots en début de mot ou dans le nom, ou nom du muscle (miroir de exerciseSearch). */
const recherchable = (e, q) => {
  const mots = plier(q).split(/[^a-z0-9]+/).filter(Boolean);
  if (!mots.length) return true;
  const nom = plier(`${e.fr} ${e.en} ${e.noms ?? ''}`);
  const bruts = nom.split(/[^a-z0-9]+/).filter(Boolean);
  if (nom.includes(plier(q).trim())) return true;
  if (plier(q).length > 2 && (plier(t.muscles[e.muscle]).startsWith(plier(q).trim()))) return true;
  return mots.every((m) => bruts.some((w) => w.startsWith(m)));
};

const correspond = (ex, sel) => {
  if (!ex) return false;
  if (sel.has(ex.muscle)) return true;
  for (const a of ex.autres ?? []) if (sel.has(a)) return true;
  return sel.has('obliques') && ex.muscle === 'abdos' && (ex.autres || []).includes('obliques');
};

/** Jusqu'à 6 exercices de départ, un par muscle d'abord, favoris puis historique puis les autres (miroir de _defaultPicks). */
const defautPicks = (liste, selection) => {
  let favoris = [];
  try { favoris = JSON.parse(localStorage.getItem('anatoly_favoris') || '[]'); } catch { /* privé ou plein */ }
  const f = new Set(favoris.filter((x) => typeof x === 'string'));
  const h = new Set();
  for (const s of etat.value?.seances ?? []) for (const e of s.donnees?.exercices ?? []) h.add(e.ex);
  const pool = liste.filter((e) => correspond(e, selection));
  if (pool.length <= 6) return pool.map((e) => e.id);
  const rang = (e) => f.has(e.id) ? 0 : h.has(e.id) ? 1 : 2;
  const pris = [];
  for (const m of selection) {
    const pourMuscle = pool.filter((e) => e.muscle === m && !pris.includes(e.id)).sort((a, b) => rang(a) - rang(b));
    if (pourMuscle.length) pris.push(pourMuscle[0].id);
  }
  for (const e of pool.filter((e) => !pris.includes(e.id)).sort((a, b) => rang(a) - rang(b))) {
    if (pris.length >= 6) break;
    pris.push(e.id);
  }
  return pris;
};

// Équivalents des listes d'échauffement et de cardio de GymMane (kWarmupIds, kCardioExtras) dans notre catalogue.
const IDS_ECHAUFFEMENT = ['montee-de-genoux-sur-place', 'jumping-jumping-jack', 'chat-vache-etirement', 'etirement-complet-debout', 'kneeling-hanche-flexor-etirement', 'cross-body-shoulder-etirement', 'posture-de-l-enfant', 'butterfly-etirement', 'ischio-jambier-etirement', 'superman-maintien', 'mountain-simulateur', 'corde-a-sauter'];
const IDS_CARDIO_PLUS = ['corde-a-sauter', 'battle-ropes', 'burpees', 'half-burpee', 'mountain-simulateur', 'montee-de-genoux-sur-place', 'jumping-jumping-jack', 'patin-hop', 'sprawl', 'laterale-pas-chasses', 'gainage-jumping-jack'];
const poolGenre = (liste, genre) => (genre === 'cardio'
  ? liste.filter((e) => e.muscle === 'cardio' || IDS_CARDIO_PLUS.includes(e.id))
  : IDS_ECHAUFFEMENT.map((id) => trouverExercice(id)).filter(Boolean));

/** Résumé de la dernière fois, comme lastSummaryFor de GymMane. */
const dernierResume = (id) => dernieresSeries(id).map((x) => {
  const kg = versAffichage(x.kg);
  if (x.s && !x.r) return kg ? `${kg} × ${x.s} s` : `${x.s} s`;
  return kg ? `${kg}×${x.r ?? 0}` : `${x.r ?? 0}`;
}).join(' · ');

const lieuTexte = (n) => (langue === 'en' ? `Training at ${n}` : `Entraînement à ${n}`);

export function Entrain() {
  const [selection, setSelection] = useState(new Set());
  const [etape, setEtape] = useState('select');
  const [q, setQ] = useState('');
  const [engin, setEngin] = useState(null);
  const [choisis, setChoisis] = useState(new Set());
  const [semence, setSemence] = useState(new Set());
  const [genre, setGenre] = useState(null);

  const profil = etat.value?.profil ?? {};
  const sexe = profil.extensions?.profil?.sexe === 'f' ? 'f' : 'm';
  const calm = Boolean(profil.reduire_animations);
  const tous = tousExercices.value ?? [];
  const lieu = lieuActif();
  useEffect(() => { reprendreAnciens(); }, []);
  // Comme fitsHere de GymMane : hors du matériel du lieu actif, un exercice n'est plus proposé (la recherche reste sur tout).
  const liste = useMemo(() => tous.filter(ajusteIci), [tous, lieu?.id, lieu?.equip.join(',')]);

  const recherche = q.trim().toLowerCase();
  const base = useMemo(() => {
    if (recherche) return tous.filter((e) => recherchable(e, q)).slice(0, 40);
    const socle = genre ? poolGenre(liste, genre) : liste.filter((e) => correspond(e, selection));
    const ids = new Set(socle.map((e) => e.id));
    const tout = [...socle, ...tous.filter((e) => choisis.has(e.id) && !ids.has(e.id))];
    return [...tout.filter((e) => semence.has(e.id)), ...tout.filter((e) => !semence.has(e.id))];
  }, [liste, tous, selection, genre, recherche, choisis, semence, q]);
  const engins = [...new Set(base.map((e) => e.materiel).filter(Boolean))];
  const enginActif = engins.includes(engin) ? engin : null;
  const visibles = enginActif ? base.filter((e) => e.materiel === enginActif) : base;

  const basculerMuscle = (id) => setSelection((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const basculerChoisi = (id) => setChoisis((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const demarrerGenre = (g) => {
    const pool = poolGenre(liste, g);
    let h = new Set();
    for (const se of etat.value?.seances ?? []) for (const e of se.donnees?.exercices ?? []) h.add(e.ex);
    const picks = (g === 'cardio' ? pool.filter((e) => h.has(e.id)).slice(0, 1) : pool.slice(0, 6)).map((e) => e.id);
    setGenre(g);
    setChoisis(new Set(picks));
    setSemence(new Set(picks));
    setQ(''); setEngin(null);
    setEtape('review');
  };

  // Même bascule que GymMane : sélection vide, on remet les suggestions ; sinon on vide.
  const basculerReset = () => {
    if (choisis.size) { setChoisis(new Set()); return; }
    const d = genre ? new Set(genre === 'cardio' ? [] : poolGenre(liste, genre).slice(0, 6).map((e) => e.id)) : new Set(defautPicks(liste, selection));
    if (genre === 'cardio') demarrerGenre('cardio'); else { setChoisis(d); setSemence(d); }
  };

  const demarrer = () => {
    demarrerAvecExercices(tous.filter((e) => choisis.has(e.id)).map((e) => e.id));
    location.hash = '#/seance';
  };

  return <main class="ecran">
    <header class="m07-tete">
      <Rond n="x" label={t.bilan.fermer} href="#/" />
      <h1>{t.entrain.titre}</h1>
      <span class="m07-tete-vide" aria-hidden="true" />
    </header>

    {etape === 'select' ? <div class="m07-etape">
      <p class="m07-kicker">{m07('step1')}</p>
      <h2 class="m07-focus">{m07('chooseFocus')}</h2>

      <section class="m07-corps" aria-label={t.accueil.carteCorps}>
        <SilhouetteSvg mode="selection" vueInitiale="both" sexe={sexe} selection={selection} onToggle={basculerMuscle} lang={langue} />
      </section>

      <p class="m07-aide">{m07('tapMuscles')}</p>

      <div class="m07-puces" role="group" aria-label={t.exercices.muscle}>
        {[...selection].map((id) => (
          <span class="m07-puce" key={id}>
            {t.muscles[id]}
            <button type="button" aria-label={`${t.exercices.muscle} ${t.muscles[id]}`} onClick={() => basculerMuscle(id)}>
              <Ic n="x" taille={12} />
            </button>
          </span>
        ))}
      </div>

      <button type="button" class="btn pri large m07-continuer" disabled={!selection.size} onClick={() => {
        const defauts = defautPicks(liste, selection);
        setGenre(null); setQ(''); setEngin(null);
        setChoisis(new Set(defauts));
        setSemence(new Set(defauts));
        setEtape('review');
      }}>
        {m07('continueBtn')}
      </button>

      <p class="m07-or">{m07('orStartWith')}</p>
      <div class="m07-kinds">
        <button type="button" class="m07-kind" onClick={() => demarrerGenre('echauffement')}>
          <span class="m07-kind-ic"><Ic n="fire" taille={19} /></span>
          <strong>{m07('warmupFocus')}</strong>
          <small>{m07('warmupFocusHint')}</small>
        </button>
        <button type="button" class="m07-kind" onClick={() => demarrerGenre('cardio')}>
          <span class="m07-kind-ic"><Ic n="heartbeat" taille={19} /></span>
          <strong>{m07('cardioFocus')}</strong>
          <small>{m07('cardioFocusHint')}</small>
        </button>
      </div>
    </div> : <div class="m07-etape">
      <div class="m07-revue-tete">
        <button type="button" class="m07-retour" aria-label={t.commun.retour} onClick={() => { setGenre(null); setEtape('select'); }}>
          <Ic n="caret-left" taille={20} />
        </button>
        <div class="m07-revue-titre">
          <p class="m07-kicker">{m07('step2')}</p>
          <h2>{m07('buildSession')}</h2>
        </div>
      </div>

      <div class="m07-outils">
        <div class="m07-recherche">
          <Ic n="magnifying-glass" taille={16} />
          <input type="search" value={q} placeholder={m07('searchAllExercises')} aria-label={m07('searchAllExercises')} onInput={(e) => setQ(e.target.value)} />
          {q && <button type="button" aria-label={t.exercices.effacer} onClick={() => setQ('')}><Ic n="x" taille={14} /></button>}
        </div>
        <button type="button" class={`m07-outil ${choisis.size ? 'actif' : ''}`} aria-label={m07('reinitialiser')} onClick={basculerReset}>
          <Ic n="arrow-counter-clockwise" taille={20} />
        </button>
        <a class="m07-outil neuf" href="#/exercices" aria-label={t.exercices.creer}><Ic n="plus" taille={20} /></a>
      </div>

      {engins.length > 1 && <div class="m07-engins" role="group" aria-label={t.exercices.materiel}>
        <button type="button" class={`m07-engin ${!enginActif ? 'on' : ''}`} onClick={() => setEngin(null)}>{m07('allExercisesShort')}</button>
        {engins.map((e) => (
          <button type="button" key={e} class={`m07-engin ${enginActif === e ? 'on' : ''}`} onClick={() => setEngin(e)}>{t.materiels[e] ?? e}</button>
        ))}
      </div>}

      {lieu && <p class="m07-compte"><Ic n="map-pin" taille={13} /> {lieuTexte(lieu.nom)}</p>}
      {!recherche && base.length > 0 && <p class="m07-compte">{m07('pickedHint')(base.length)}</p>}

      {visibles.length === 0
        ? <div class="m07-vide">
          {recherche
            ? <><strong>{m07('noExercisesMatch')}</strong><a href="#/exercices">{m07('createItInstead')}</a></>
            : <><strong>{m07('nothingForFocus')}</strong><small>{m07('goBackPick')}</small></>}
        </div>
        : (() => {
          const suggeres = !recherche ? visibles.filter((e) => semence.has(e.id)) : [];
          const autres = recherche ? visibles : visibles.filter((e) => !semence.has(e.id));
          const ligne = (e) => {
            const on = choisis.has(e.id);
            return <button type="button" key={e.id} class={`m07-ligne ${on ? 'choisi' : ''}`} aria-pressed={on} onClick={() => basculerChoisi(e.id)}>
              <span class="vignette" aria-hidden="true"><IllustrationExercice exo={e} taille={44} calmMotion={calm} /></span>
              <span class="m07-ligne-texte">
                <strong>{nomExercice(e)}</strong>
                <small>{dernierResume(e.id) || t.muscles[e.muscle] || ''}</small>
              </span>
              <span class={`m07-coche ${on ? 'ok' : ''}`} aria-hidden="true">{on ? <Ic n="check:bold" taille={13} /> : null}</span>
            </button>;
          };
          return <div class="m07-liste">
            {suggeres.length > 0
              ? <>{<p class="m07-section">{m07('suggestedPicks')}</p>}{suggeres.map(ligne)}{autres.length > 0 && <p class="m07-section">{m07('moreOptions')}</p>}{autres.map(ligne)}</>
              : visibles.map(ligne)}
          </div>;
        })()}

      <div class="m07-barre">
        <button type="button" class="btn pri large" disabled={!choisis.size} onClick={demarrer}>
          {choisis.size ? m07('startCount')(choisis.size) : m07('pickAnExercise')}
        </button>
      </div>
    </div>}
  </main>;
}
