// M14 : premier lancement, imports, exports, sauvegardes, Strava et coach vocal.
// Portage 1:1 de onboarding_screen.dart, workout_import.dart, strava_sheet.dart et voice_sheet.dart.
import { useEffect, useRef, useState } from 'preact/hooks';
import { api, afficher, charger, etat, jourLocal } from '../donnees.js';
import { langue, t } from '../i18n.js';
import { m14fr, m14en } from '../i18n/m14.js';
import {
  creerSauvegardeZip, exportCsv, restaurerSauvegarde, telecharger, workoutFit,
} from '../exporter.js';
import { analyserFichierImport, detecterFormatImport, importerNecessiteUnite, recapImport } from '../importer.js';
import { Feuille, Ic, Nombre } from '../ui.jsx';
import { EXERCICES } from '../exercices.js';
import { CorpsOnboardingPar } from '../silhouette-paresseuse.jsx';
import './m14.css';

const M = () => (langue === 'en' ? m14en : m14fr);

// Icônes Phosphor manquantes au jeu actuel, tracées à la main (viewBox 256).
const Inline = ({ d, taille = 20 }) => (
  <svg class="ic" width={taille} height={taille} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false"><g>{d}</g></svg>
);
const IC_CAMERA = <><path d="M96 72h64l12 16h20a16 16 0 0 1 16 16v88a16 16 0 0 1-16 16H64a16 16 0 0 1-16-16V104a16 16 0 0 1 16-16h20z" /><circle cx="128" cy="132" r="36" /></>;
const IC_MONTAGNE = <><path d="M32 176l56-80 32 44 24-32 80 100z" /><circle cx="192" cy="72" r="20" fill="none" stroke="currentColor" stroke-width="18" /></>;

const PLACES = {
  salle: { icon: 'barbell', equip: ['barre', 'halteres', 'machine', 'poulie', 'kettlebell', 'barre-ez', 'smith'], lien: 'placeSalle' },
  maison: { icon: 'house', equip: ['halteres', 'elastique', 'kettlebell', 'barre-ez'], lien: 'placeMaison' },
  exterieur: { icon: 'mountain', equip: [], lien: 'placeExterieur' },
};
const EQUIP_LIEN = {
  barre: 'equipBarre', halteres: 'equipHalteres', machine: 'equipMachine', poulie: 'equipPoulie',
  kettlebell: 'equipKettlebell', elastique: 'equipElastique', 'barre-ez': 'equipBarreEz', smith: 'equipSmith', autre: 'equipAutre',
};
const EQUIP_IDS = Object.keys(EQUIP_LIEN);

const EDITEUR = {
  age: { cle: 'age', label: 'ageLabel', decimales: false, min: 12, max: 99, unite: '' },
  taille: { cle: 'taille', label: 'heightLabel', decimales: false, min: 80, max: 240, unite: 'cm' },
  poids: { cle: 'poids', label: 'weightLabel', decimales: true, min: 20, max: 500, unite: 'kg' }, // bornes en kg, saisie dans l'unité choisie
};
const LB = 0.45359237;
// Exercices faisables avec ce matériel (le poids du corps est toujours là), comme exercisesFor de l'original.
const exercicesPour = (equip) => EXERCICES.filter((e) => e.materiel === 'poids-du-corps' || equip.has(e.materiel));
// _WeekRing : sept arcs, trait à 7 % de la taille, 0,16 rad d'écart.
function AnneauSemaine({ allumes, taille = 180 }) {
  const tr = taille * 0.07, r = (taille - tr) / 2, c = taille / 2, pas = (Math.PI * 2) / 7, ecart = 0.16;
  const arc = (i) => {
    const a = -Math.PI / 2 + i * pas + ecart / 2, b = a + pas - ecart;
    return `M ${c + r * Math.cos(a)} ${c + r * Math.sin(a)} A ${r} ${r} 0 0 1 ${c + r * Math.cos(b)} ${c + r * Math.sin(b)}`;
  };
  return <svg class="onb-anneau-svg" width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`} aria-hidden="true">
    {Array.from({ length: 7 }, (_, i) => <path key={i} d={arc(i)} fill="none" stroke-width={tr} stroke-linecap="round" class={i < allumes ? 'on' : ''} />)}
  </svg>;
}

export function Onboarding() {
  const M14 = M();
  const [etape, setEtape] = useState(0);
  const [nom, setNom] = useState('');
  const [photo, setPhoto] = useState(null);
  const [unite, setUnite] = useState(etat.value?.profil?.unite ?? 'kg');
  const [sexe, setSexe] = useState('m');
  const [age, setAge] = useState(28);
  const [taille, setTaille] = useState(175);
  const [poids, setPoids] = useState(75);
  const [objectif, setObjectif] = useState(4);
  const [lieux, setLieux] = useState({});
  const [editCle, setEditCle] = useState(null);
  const [editValeur, setEditValeur] = useState(null);
  const [sauve, setSauve] = useState(false);
  const [errPhoto, setErrPhoto] = useState(false);
  const refNom = useRef(null);
  const fichierPhoto = useRef(null);

  const dernier = 6;
  const page = Math.min(etape, dernier);
  const prenom = nom.trim();

  useEffect(() => { if (etape === 1) setTimeout(() => refNom.current?.focus({ preventScroll: true }), 340); }, [etape]);
  useEffect(() => { if (refCorps.current) refCorps.current.scrollLeft = 0; }, [page]);

  // PageView de l'original : la page suit le doigt, change au-delà de la moitié ou sur un geste vif, sinon revient.
  // Les pages voisines restent rendues pour glisser ; seule la page affichée est atteignable (inert).
  const refCorps = useRef(null);
  const geste = useRef(null);
  const [tire, setTire] = useState(null);
  const pg = (n, contenu) => <div class="onb-page" key={n} inert={n !== page} aria-hidden={n !== page}>{contenu}</div>;
  const glisserDebut = (e) => {
    if (e.pointerType === 'mouse' || sauve) return;
    geste.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, sens: null, id: e.pointerId };
  };
  const glisserSuite = (e) => {
    const g = geste.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.sens) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      g.sens = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (g.sens === 'h') refCorps.current?.setPointerCapture?.(e.pointerId);
    }
    if (g.sens !== 'h') return;
    g.dx = dx; g.vx = (dx - (g.dxAvant ?? 0)) / Math.max(1, e.timeStamp - (g.tAvant ?? g.t)); g.dxAvant = dx; g.tAvant = e.timeStamp;
    const bord = (page === 0 && dx > 0) || (page === dernier && dx < 0);
    setTire(bord ? dx / 4 : dx);
  };
  const glisserFin = () => {
    const g = geste.current;
    geste.current = null;
    if (!g || g.sens !== 'h') return;
    const w = refCorps.current?.clientWidth || innerWidth;
    const dx = g.dx ?? 0, vx = g.vx ?? 0;
    setTire(null);
    if ((dx < -w / 2 || vx < -0.4) && page < dernier) aller(page + 1);
    else if ((dx > w / 2 || vx > 0.4) && page > 0) aller(page - 1);
  };
  useEffect(() => { if (langue === 'en' && unite === 'kg') { /* ok */ } }, [unite]);

  const aller = (i) => setEtape(Math.max(0, Math.min(dernier, i)));

  const choisirPhoto = (fichier) => {
    if (!fichier || !fichier.type.startsWith('image/')) return;
    setErrPhoto(false);
    fichierPhoto.current = fichier;
    const lecteur = new FileReader();
    lecteur.onload = () => setPhoto(lecteur.result);
    lecteur.readAsDataURL(fichier);
  };

  const basculerLieu = (preset) => {
    setLieux((prev) => {
      const nouveau = { ...prev };
      if (nouveau[preset]) delete nouveau[preset];
      else nouveau[preset] = new Set(PLACES[preset].equip);
      return nouveau;
    });
  };

  const basculerEquip = (preset, equip) => {
    setLieux((prev) => {
      const ensemble = new Set(prev[preset] ?? []);
      if (ensemble.has(equip)) ensemble.delete(equip);
      else ensemble.add(equip);
      return { ...prev, [preset]: ensemble };
    });
  };

  const appliquerValeur = () => {
    const e = EDITEUR[editCle];
    const v = editCle === 'poids' && unite === 'lb' && editValeur != null ? editValeur * LB : editValeur;
    if (v == null || v < e.min || v > e.max) { afficher(M14.commun.erreur, 'danger'); return; }
    if (editCle === 'age') setAge(Math.round(v));
    else if (editCle === 'taille') setTaille(Math.round(v));
    else setPoids(Math.round(v * 100) / 100);
    setEditCle(null);
    setEditValeur(null);
  };

  const terminer = async () => {
    if (sauve) return;
    setSauve(true);
    const profil = etat.value?.profil ?? {};
    const extensions = profil.extensions ?? {};
    // Les lieux choisis vont directement dans extensions.modules.lieux, le même module que l'écran Lieux, avec les réglages.
    const anciens = extensions.modules?.lieux;
    const liste = Array.isArray(anciens?.liste) ? [...anciens.liste] : [];
    let actif = typeof anciens?.actif === 'string' ? anciens.actif : '';
    for (const [preset, p] of Object.entries(PLACES)) {
      const nomLieu = M14.onboarding[p.lien];
      if (!lieux[preset] || liste.some((l) => l.nom === nomLieu)) continue;
      liste.push({ id: `l${preset}`, nom: nomLieu, equip: [...new Set(['poids-du-corps', ...lieux[preset]])], barre: null, disques: {}, halteres: [] });
      if (!actif) actif = `l${preset}`;
    }
    const modules = liste.length && liste.length !== (anciens?.liste?.length ?? 0)
      ? { ...(extensions.modules ?? {}), lieux: { ...(anciens ?? {}), liste, actif } }
      : extensions.modules;
    // setProfilePhoto : la photo choisie devient celle du profil (512 px, comme l'original).
    let photoId = null;
    if (fichierPhoto.current) {
      try {
        const { redimensionner } = await import('./profil.jsx');
        const { importerImage } = await import('./photos.jsx');
        photoId = await importerImage(await redimensionner(fichierPhoto.current, 512, 512, 0.8));
      } catch { /* la photo pourra être ajoutée depuis le profil */ }
    }
    const body = {
      prenom: prenom || profil.prenom || 'Sportif',
      langue: profil.langue ?? 'fr',
      unite,
      theme: profil.theme ?? 'sombre',
      repos_s: profil.repos_s ?? 90,
      objectif_semaine: objectif,
      extensions: {
        ...extensions,
        ...(modules ? { modules } : {}),
        profil: {
          ...(extensions.profil ?? {}),
          sexe: sexe || 'o',
          age,
          tailleCm: taille,
          ...(photoId ? { photo: photoId } : {}),
          onboarded: true,
        },
      },
    };
    try {
      await api('PUT', '/api/reglages', body);
      // Le poids saisi est une donnée de suivi : sans ça il disparaît avec l'écran.
      if (poids > 0) await api('PUT', '/api/poids', { jour: jourLocal(new Date()), kg: Math.round(poids * 100) / 100 });
    } catch (e) {
      setSauve(false);
      afficher(e.statut === 0 ? t.commun.horsLigne : M14.commun.erreur, 'danger');
      return;
    }
    location.hash = '#/';
  };

  const passer = () => { if (!sauve) terminer(); };

  return <main class="onb">
    <div class="onb-barre">
      <div class="onb-segments" aria-hidden="true">
        {Array.from({ length: dernier + 1 }, (_, i) => <span key={i} class={i <= page ? 'fait' : ''} />)}
      </div>
      <button type="button" class="onb-passer" onClick={passer} disabled={sauve}>{M14.onboarding.skip}</button>
    </div>

    <div class="onb-corps" ref={refCorps} onPointerDown={glisserDebut} onPointerMove={glisserSuite} onPointerUp={glisserFin} onPointerCancel={glisserFin}>
      <div class={`onb-piste ${tire !== null ? 'tire' : ''}`} style={{ transform: `translateX(calc(${-page * 100}% + ${tire ?? 0}px))` }}>
      {pg(0, <section class="onb-etape">
        <div class="onb-hero onb-hero-bienvenue"><img class="onb-coureur" src="/statique/app-img/runner.webp" alt="" /></div>
        <p class="onb-kicker">{M14.onboarding.kicker}</p>
        <h1 class="onb-titre">Anatoly</h1>
        <p class="onb-why">{M14.onboarding.blurb}</p>
        <div class="onb-promesses">
          {[[<Ic n="gift" taille={19} />, 'free', 'freeWhy'], [<Ic n="wifi-slash" taille={19} />, 'offline', 'offlineWhy'], [<Ic n="export" taille={19} />, 'yours', 'yoursWhy']].map(([ic, titreK, whyK], i) => (
            <div class="onb-promesse" key={titreK}>
              <span class="onb-promesse-ic">{ic}</span>
              <span><strong>{M14.onboarding[titreK]}</strong><small>{M14.onboarding[whyK]}</small></span>
            </div>
          ))}
        </div>
      </section>)}

      {pg(1, <section class="onb-etape">
        <div class="onb-hero">
          <span class={`onb-avatar ${prenom ? 'plein' : ''}`} aria-hidden="true">
            {prenom ? prenom[0].toUpperCase() : <Ic n="user-circle" taille={42} />}
          </span>
        </div>
        <p class={`onb-bonjour ${prenom ? '' : 'vide'}`} aria-hidden="true">{M14.onboarding.hello(prenom || '…')}</p>
        <p class="onb-etape-n">{M14.onboarding.step(1, dernier)}</p>
        <h1 class="onb-titre">{M14.onboarding.nameTitle}</h1>
        <p class="onb-why">{M14.onboarding.nameWhy}</p>
        <div class="onb-groupe">
          <label class="onb-ligne" for="onb-nom">
            <Ic n="person-simple" taille={20} />
            <input id="onb-nom" ref={refNom} class="onb-champ" value={nom} placeholder={M14.onboarding.nameHint}
              maxLength={60} enterKeyHint="next" onInput={(e) => setNom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && aller(2)} />
          </label>
        </div>
      </section>)}

      {pg(2, <section class="onb-etape">
        <div class="onb-hero">
          <span class="onb-avatar onb-photo" aria-hidden="true">
            {photo ? <img src={photo} alt="" /> : <Ic n="person-simple" taille={42} />}
            <span class="onb-photo-badge"><Inline d={IC_CAMERA} taille={18} /></span>
          </span>
        </div>
        <p class="onb-etape-n">{M14.onboarding.step(2, dernier)}</p>
        <h1 class="onb-titre">{M14.onboarding.photoTitle}</h1>
        <p class="onb-why">{M14.onboarding.photoWhy}</p>
        <div class="onb-groupe">
          <label class="onb-ligne onb-cliquable">
            <Ic n={photo ? 'pencil-simple' : 'plus'} taille={20} />
            <span>{photo ? M14.onboarding.photoChange : M14.onboarding.photoAdd}</span>
            <input type="file" accept="image/*" class="onb-fichier" onChange={(e) => choisirPhoto(e.target.files?.[0])} />
          </label>
          {errPhoto && <p class="onb-erreur">{M14.commun.erreur}</p>}
        </div>
      </section>)}

      {pg(3, <section class="onb-etape">
        <div class="onb-hero"><span class="onb-chiffre">{unite === 'kg' ? '100' : '225'}</span><span class="onb-chiffre-unite">{unite === 'kg' ? 'kg' : 'lb'}</span></div>
        <p class="onb-etape-n">{M14.onboarding.step(3, dernier)}</p>
        <h1 class="onb-titre">{M14.onboarding.unitsTitle}</h1>
        <p class="onb-why">{M14.onboarding.unitsWhy}</p>
        <div class="onb-unites">
          {['kg', 'lb'].map((u) => (
            <button type="button" key={u} class={`onb-unite ${unite === u ? 'choisie' : ''}`} aria-pressed={unite === u} onClick={() => setUnite(u)}>
              <span class="onb-unite-coche"><Ic n="check-circle:fill" taille={18} /></span>
              <strong>{u === 'kg' ? 'kg' : 'lb'}</strong>
              <small>{u === 'kg' ? '60 kg · 175 cm · 5 km' : '135 lb · 5′9″ · 3 mi'}</small>
            </button>
          ))}
        </div>
      </section>)}

      {pg(4, <section class="onb-etape">
        <div class="onb-hero"><span class="onb-corps-boite" key={sexe}><CorpsOnboardingPar sexe={sexe} /></span></div>
        <p class="onb-etape-n">{M14.onboarding.step(4, dernier)}</p>
        <h1 class="onb-titre">{M14.onboarding.bodyTitle}</h1>
        <p class="onb-why">{M14.onboarding.bodyWhy}</p>
        <div class="onb-groupe">
          <div class="onb-ligne onb-sexe">
            <span class="onb-ligne-label">{M14.onboarding.sexLabel}</span>
            <span class="onb-seg" role="radiogroup" aria-label={M14.onboarding.sexLabel}>
              {[['m', M14.onboarding.male], ['f', M14.onboarding.female]].map(([v, l]) => (
                <button key={v} type="button" role="radio" aria-checked={sexe === v} class={sexe === v ? 'fait' : ''} onClick={() => setSexe(v)}>{l}</button>
              ))}
            </span>
          </div>
          {Object.entries(EDITEUR).map(([cle, e]) => (
            <button type="button" class="onb-ligne onb-valeur" key={cle} onClick={() => { setEditCle(cle); setEditValeur(null); }}>
              <span class="onb-ligne-label">{M14.onboarding[e.label]}</span>
              <span class="onb-valeur-droite"><strong>{e.cle === 'poids' ? `${unite === 'lb' ? Math.round(poids / LB) : poids} ${unite}` : e.cle === 'age' ? age : unite === 'lb' ? `${Math.floor(taille / 2.54 / 12)}′${Math.round(taille / 2.54) % 12}″` : `${taille} cm`}</strong><Ic n="caret-right" taille={13} /></span>
            </button>
          ))}
        </div>
      </section>)}

      {pg(5, <section class="onb-etape">
        <div class="onb-hero"><span class="onb-objectif-ring"><AnneauSemaine allumes={objectif} /><span class="onb-objectif">{objectif}<small>{M14.onboarding.perWeek(objectif).replace(`${objectif} `, '')}</small></span></span></div>
        <p class="onb-etape-n">{M14.onboarding.step(5, dernier)}</p>
        <h1 class="onb-titre">{M14.onboarding.goalTitle}</h1>
        <p class="onb-why">{M14.onboarding.goalWhy}</p>
        <div class="onb-anneau">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button type="button" key={n} class={n <= objectif ? 'fait' : ''} aria-label={M14.onboarding.perWeek(n)} aria-pressed={n === objectif} onClick={() => setObjectif(n)}>{n}</button>
          ))}
        </div>
      </section>)}

      {pg(6, <section class="onb-etape">
        <div class="onb-hero">
          <span class="onb-lieux">
            {Object.entries(PLACES).map(([preset, p]) => (
              <button type="button" key={preset} class={`onb-lieu ${lieux[preset] ? 'choisi' : ''}`} aria-pressed={!!lieux[preset]} onClick={() => basculerLieu(preset)}>
                {p.icon === 'mountain' ? <Inline d={IC_MONTAGNE} taille={30} /> : <Ic n={p.icon} taille={30} />}
              </button>
            ))}
          </span>
          <span class="onb-lieux-compte"><strong>{exercicesPour(new Set(Object.values(lieux).flatMap((x) => [...x]))).length}</strong><small>{M14.onboarding.placeHero}</small></span>
        </div>
        <p class="onb-etape-n">{M14.onboarding.step(6, dernier)}</p>
        <h1 class="onb-titre">{M14.onboarding.placeTitle}</h1>
        <p class="onb-why">{M14.onboarding.placeWhy}</p>
        {Object.entries(PLACES).map(([preset, p]) => (
          <div class="onb-groupe" key={preset}>
            <button type="button" class={`onb-ligne onb-lieu-ligne ${lieux[preset] ? 'choisi' : ''}`} onClick={() => basculerLieu(preset)}>
              <span class="onb-ligne-ic">{p.icon === 'mountain' ? <Inline d={IC_MONTAGNE} taille={20} /> : <Ic n={p.icon} taille={20} />}</span>
              <span class="onb-ligne-nom">{M14.onboarding[p.lien]}<small>{M14.onboarding.exerciseCount(exercicesPour(lieux[preset] ?? new Set(p.equip)).length)}</small></span>
              <Ic n="check-circle:fill" taille={18} />
            </button>
            {lieux[preset] && <p class="onb-materiel">{Object.keys(lieux).length > 1 ? `${M14.onboarding[p.lien]} · ${M14.onboarding.placeGear}` : M14.onboarding.placeGear}</p>}
            {lieux[preset] && <div class="onb-pilules">
              {EQUIP_IDS.map((e) => (
                <button type="button" key={e} class={lieux[preset].has(e) ? 'fait' : ''} aria-pressed={lieux[preset].has(e)} onClick={() => basculerEquip(preset, e)}>{M14.onboarding[EQUIP_LIEN[e]]}</button>
              ))}
            </div>}
          </div>
        ))}
      </section>)}
      </div>
    </div>

    <div class="onb-pied">
      {page > 0 && <button type="button" class="onb-retour" aria-label={t.commun.retour} onClick={() => aller(page - 1)}><Ic n="caret-left" taille={18} /></button>}
      <button type="button" class="btn pri onb-suivant" onClick={() => (page === dernier ? terminer() : aller(page + 1))} disabled={sauve}>
        {page === 2 && !photo ? M14.onboarding.photoLater : page === dernier ? M14.onboarding.start : M14.onboarding.next}
      </button>
    </div>

    <Feuille ouverte={!!editCle} fermer={() => { setEditCle(null); setEditValeur(null); }} titre={M14.onboarding[EDITEUR[editCle]?.label] ?? ''} sous={M14.onboarding.bodyWhy}>
      <div class="onb-edit">
        <Nombre valeur={editCle === 'poids' ? (unite === 'lb' ? Math.round(poids / LB) : poids) : editCle === 'age' ? age : taille} label={M14.onboarding[EDITEUR[editCle]?.label] ?? ''} decimales={EDITEUR[editCle]?.decimales} onChange={setEditValeur} />
        <button type="button" class="btn pri" onClick={appliquerValeur} disabled={editValeur == null}>{M14.commun.enregistrer}</button>
      </div>
    </Feuille>
  </main>;
}

// ===== Écran Données : import, export, sauvegarde, Strava =====
const FORMAT_LIEN = {
  hevy: 'hevy', strong: 'strong', lyfta: 'lyfta', fitbod: 'fitbod', fitnotes: 'fitnotes',
  openGym: 'openGym', gymmane: 'gymmane', generique: 'generique', poids: 'poidsSeulement',
};

/** Envoie un aperçu d'import à l'API : séances, puis pesées seules si le fichier n'en a pas. */
async function appliquerImport(resultat) {
  let seances = 0;
  if (resultat.seances.length) {
    const r = await api('POST', '/api/importer', { seances: resultat.seances, poids: resultat.poids ?? [] });
    seances = r.seances ?? 0;
  } else {
    // Fichier de poids seul : l'import passe par la route dédiée, une pesée à la fois.
    for (const p of resultat.poids ?? []) await api('PUT', '/api/poids', { jour: p.jour.slice(0, 10), kg: p.kg });
  }
  await charger();
  return seances;
}

export function EcranDonnees() {
  const M14 = M();
  const [import_, setImport] = useState({ texte: '', nom: '', unite: 'kg', format: '' });
  const [apercu, setApercu] = useState(null);
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState('');
  const [restauration, setRestauration] = useState(false);

  const choisirFichier = async (fichier) => {
    if (!fichier) return;
    setErreur('');
    setApercu(null);
    if (/\.zip$/i.test(fichier.name)) { setImport({ texte: '', nom: fichier.name, unite: 'kg', format: 'zip' }); return; }
    const texte = await fichier.text();
    try {
      setImport({ texte, nom: fichier.name, unite: 'kg', format: detecterFormatImport(texte) });
    } catch {
      setErreur(M14.import.formatInconnu);
    }
  };

  const analyser = () => {
    setErreur('');
    try {
      const r = analyserFichierImport(import_.texte, import_.unite);
      if (!r.seances.length && !(r.poids ?? []).length) throw new Error('vide');
      setApercu(r);
    } catch {
      setErreur(M14.import.formatInconnu);
    }
  };

  const appliquer = async () => {
    setOccupe('import');
    try {
      const n = await appliquerImport(apercu);
      afficher(M14.import.succes(n || (apercu.poids ?? []).length), 'ok');
      setApercu(null);
      setImport({ texte: '', nom: '', unite: 'kg', format: '' });
    } catch { afficher(M14.import.erreur, 'danger'); } finally { setOccupe(''); }
  };

  const telechargerCsv = async () => {
    setOccupe('csv');
    try { await telecharger(new Blob([exportCsv(etat.value)], { type: 'text/csv' }), `anatoly-seances-${new Date().toISOString().slice(0, 10)}.csv`); }
    finally { setOccupe(''); }
  };

  const telechargerZip = async () => {
    setOccupe('zip');
    try { await telecharger(creerSauvegardeZip(etat.value), `anatoly-sauvegarde-${new Date().toISOString().slice(0, 10)}.zip`); }
    finally { setOccupe(''); }
  };

  const restaurer = async (fichier) => {
    if (!fichier) return;
    setOccupe('restauration');
    try {
      const octets = new Uint8Array(await fichier.arrayBuffer());
      const r = await restaurerSauvegarde(octets, api, {});
      await charger();
      afficher(`${M14.export.backup.succes} ${M14.import.seances(r.seances)}`, 'ok');
      setRestauration(false);
    } catch { afficher(M14.export.backup.erreur, 'danger'); } finally { setOccupe(''); }
  };

  const seancesTerminees = [...(etat.value?.seances ?? [])].sort((a, b) => (a.debut < b.debut ? 1 : -1)).slice(0, 30);

  return <main class="ecran avec-nav">
    <h1 class="don-titre">{M14.import.title}</h1>
    <p class="muted">{M14.import.sous}</p>

    <section class="carte don-import">
      <h2 class="don-soustitre">{M14.import.title}</h2>
      <label class="don-depot" for="don-fichier">
        <Ic n="export" taille={22} />
        <span>{import_.nom || M14.import.glisser}</span>
        <input id="don-fichier" type="file" accept=".csv,.txt,.json,.zip,text/csv,application/json" class="onb-fichier"
          onChange={(e) => choisirFichier(e.target.files?.[0])} />
      </label>
      {import_.format && import_.format !== 'inconnu' && import_.format !== 'zip' && <p class="don-format">
        {M14.import.format} : <strong>{M14.import[FORMAT_LIEN[import_.format]] ?? import_.format}</strong>
      </p>}
      {import_.format && importerNecessiteUnite(import_.texte) && <div class="don-unite">
        <p class="muted">{M14.import.uniteChoix}</p>
        <div class="onb-seg" role="radiogroup" aria-label={M14.import.unite}>
          {[['kg', M14.import.uniteKg], ['lb', M14.import.uniteLb]].map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={import_.unite === v} class={import_.unite === v ? 'fait' : ''}
              onClick={() => { setImport({ ...import_, unite: v }); setApercu(null); }}>{l}</button>
          ))}
        </div>
      </div>}
      {erreur && <p class="don-erreur" role="alert">{erreur}</p>}
      {!apercu && <button type="button" class="btn pri" disabled={!import_.texte || occupe === 'import'} onClick={analyser}>{M14.import.analyser}</button>}

      {apercu && <div class="don-apercu">
        <h3>{M14.import.apercu}</h3>
        <div class="don-comptes">
          <span><strong>{recapImport(apercu).seances}</strong><small>{M14.import.seances(recapImport(apercu).seances)}</small></span>
          <span><strong>{recapImport(apercu).exercices}</strong><small>{M14.import.exercices(recapImport(apercu).exercices)}</small></span>
          <span><strong>{recapImport(apercu).poids}</strong><small>{M14.import.poidsSeulement}</small></span>
        </div>
        {!!apercu.nomsNonResolus.length && <div class="don-nonresolus">
          <h4>{M14.import.nonResolusTitre}</h4>
          <p class="muted">{M14.import.nonResolusTexte}</p>
          <ul>{apercu.nomsNonResolus.slice(0, 12).map((n) => <li key={n}>{n}</li>)}</ul>
          {apercu.nomsNonResolus.length > 12 && <p class="muted">{M14.import.nonResolus(apercu.nomsNonResolus.length - 12)}</p>}
        </div>}
        <div class="don-actions">
          <button type="button" class="btn" onClick={() => setApercu(null)}>{M14.import.annuler}</button>
          <button type="button" class="btn pri" disabled={occupe === 'import'} onClick={appliquer}>{M14.import.appliquer}</button>
        </div>
      </div>}
    </section>

    <section class="carte don-export">
      <h2 class="don-soustitre">{M14.export.titre}</h2>
      <div class="don-ligne">
        <span><strong>{M14.export.csv.titre}</strong><small>{M14.export.csv.sous}</small></span>
        <button type="button" class="btn petit" disabled={occupe === 'csv'} onClick={telechargerCsv}>{M14.export.csv.bouton}</button>
      </div>
      <div class="don-ligne">
        <span><strong>{M14.export.zip.titre}</strong><small>{M14.export.zip.sous}</small></span>
        <button type="button" class="btn petit" disabled={occupe === 'zip'} onClick={telechargerZip}>{M14.export.zip.bouton}</button>
      </div>
    </section>

    <section class="carte don-strava">
      <h2 class="don-soustitre">{M14.export.strava.titre}</h2>
      <p class="muted">{M14.export.strava.sous}</p>
      {seancesTerminees.length ? <div class="don-strava-liste">
        {seancesTerminees.slice(0, 8).map((s) => (
          <button type="button" key={s.cle} class="don-ligne don-ligne-bouton"
            onClick={async () => {
              const fit = workoutFit(s, { pounds: etat.value?.profil?.unite === 'lb' });
              await telecharger(new Blob([fit], { type: 'application/vnd.ant.fit' }), `anatoly-${s.debut.slice(0, 10)}.fit`);
            }}>
            <span><strong>{s.nom || t.accueil.seanceLibre}</strong><small>{s.debut.slice(0, 10)}</small></span>
            <Ic n="export" taille={17} />
          </button>
        ))}
      </div> : <p class="muted">{M14.export.strava.aucune}</p>}
    </section>

    <section class="carte don-restauration">
      <h2 class="don-soustitre">{M14.export.backup.titre}</h2>
      <p class="muted">{M14.export.backup.sous}</p>
      {!restauration
        ? <button type="button" class="btn" onClick={() => setRestauration(true)}>{M14.export.backup.bouton}</button>
        : <div class="don-depot-zone">
          <p class="don-avertissement">{M14.export.backup.avertissement}</p>
          <label class="don-depot" for="don-backup">
            <Ic n="arrows-clockwise" taille={20} /><span>{M14.export.backup.confirmer}</span>
            <input id="don-backup" type="file" accept=".zip,application/zip" class="onb-fichier"
              onChange={(e) => restaurer(e.target.files?.[0])} />
          </label>
        </div>}
    </section>
  </main>;
}

// ===== Coach vocal : dans sons.js, gardé ici pour les écrans qui l'importent déjà =====
export { arreterVoix, dire, voixDisponible } from '../sons.js';

// ===== Sauvegarde automatique locale (IndexedDB) =====
const BASE_AUTO = 'anatoly-sauvegardes';
const delaiAuto = { workout: 0, daily: 86400000, weekly: 604800000 };

function ouvrirBase() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(BASE_AUTO, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('zips', { keyPath: 'cle' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

/** Copie locale de la sauvegarde, si la fréquence choisie est atteinte. Garde les `garder` dernières copies
 * (AutoBackup.keep : 1, 3, 5, 10 ou 20). Renvoie la date ou null. */
export async function sauvegardeAuto(mode = 'off', dernier = null, garder = 5) {
  const attente = delaiAuto[mode];
  if (attente == null) return null;
  const maintenant = Date.now();
  if (dernier && maintenant - Date.parse(dernier) < attente) return null;
  const zip = creerSauvegardeZip(etat.value);
  const quand = new Date(maintenant).toISOString();
  const base = await ouvrirBase();
  await new Promise((res, rej) => {
    const tx = base.transaction('zips', 'readwrite');
    const st = tx.objectStore('zips');
    st.put({ cle: quand, date: quand, blob: zip });
    const r = st.getAllKeys();
    r.onsuccess = () => { r.result.filter((k) => k !== 'derniere').sort().reverse().slice(Math.max(1, garder)).forEach((k) => st.delete(k)); st.delete('derniere'); };
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
  base.close();
  return quand;
}

/** Dernière sauvegarde locale connue, pour l'afficher dans les réglages. */
export async function derniereSauvegardeAuto() {
  try {
    const base = await ouvrirBase();
    const v = await new Promise((res, rej) => {
      const tx = base.transaction('zips', 'readonly');
      const r = tx.objectStore('zips').getAll();
      r.onsuccess = () => res((r.result ?? []).sort((a, b) => (a.date < b.date ? 1 : -1))[0] ?? null);
      r.onerror = () => rej(r.error);
    });
    base.close();
    return v;
  } catch { return null; }
}
