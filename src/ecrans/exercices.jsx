// Bibliothèque d'exercices : recherche collante, filtres repliés, zones, favoris, exercices perso. Sert aussi de sélecteur en séance.
import { Component } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { afficher, api, charger, etat, lireM05, localM05, nomExercice, sauverExtensions, tousExercices, trouverExercice } from '../donnees.js';
import { MATERIELS, MUSCLES } from '../exercices.js';
import { EQUIPEMENT_PAR_ID, GENRE_PAR_ID, SANS_MATERIEL } from '../categories-exercices.js';
import { IllustrationExercice } from '../illustrations.js';
import { langue, t } from '../i18n.js';
import { m05 } from '../i18n/m05.js';
import { m05b } from '../i18n/m05b.js';
import { Dialogue, Feuille, Ic, Kicker, Rond, Vide } from '../ui.jsx';
import { ajusteIci, choisirLieu, lieuActif, reprendreAnciens, tousLieux } from './lieux.jsx';
import { SilhouettePar } from '../silhouette-paresseuse.jsx';
import { L26 } from '../i18n/l26.js';
import './m05.css';
import './m05b.css';

const CLE_FAVORIS = 'anatoly_favoris';

const listeIds = (v) => (Array.isArray(v) ? v.filter((id) => typeof id === 'string') : []);
const lireCache = () => { try { return listeIds(JSON.parse(localStorage.getItem(CLE_FAVORIS))); } catch { return []; } };
// Dernière liste choisie sur cet appareil : sert tant que le serveur n'a pas confirmé (réponse instantanée).
const choix = signal(null);

// Les favoris vivent sur le compte (extensions.modules.m05.favoris). L'ancienne liste du navigateur sert de repli
// et de reprise : elle est envoyée au compte au premier changement.
export function lireFavoris() {
  const serveur = etat.value?.profil?.extensions?.modules?.m05?.favoris;
  // Un exercice personnalisé supprimé ailleurs ne reste pas compté.
  return (choix.value ?? (Array.isArray(serveur) ? listeIds(serveur) : lireCache())).filter((id) => !id.startsWith('p-') || trouverExercice(id));
}

// Réglages par exercice gardés sur le compte (extensions.modules.m05) : favoris, archives, muscles secondaires,
// objectifs, mode « distance et temps » et média perso. La copie locale répond tout de suite, le serveur suit dans l'ordre.
export { lireM05 };
let envoi = Promise.resolve();
export function ecrireM05(patch) {
  localM05.value = { ...localM05.value, ...patch };
  envoi = envoi.then(() => {
    const mods = etat.value?.profil?.extensions?.modules || {};
    return sauverExtensions({ modules: { ...mods, m05: { ...(mods.m05 || {}), ...localM05.value } } });
  }).catch(() => afficher(t.commun.erreur, 'danger'));
}
// Copie d'un dictionnaire par exercice, avec une clé changée ou retirée (null).
export function majDico(cle, id, valeur) {
  const d = { ...(lireM05()[cle] || {}) };
  if (valeur === undefined || valeur === null) delete d[id]; else d[id] = valeur;
  ecrireM05({ [cle]: d });
}

export function ecrireFavoris(ids) {
  choix.value = ids;
  try { localStorage.setItem(CLE_FAVORIS, JSON.stringify(ids)); } catch { /* privé ou plein */ }
  ecrireM05({ favoris: ids });
}

// Comme GymMane (toggleArchived) : un exercice archivé sort des listes et des choix, son historique reste.
export const lireArchives = () => listeIds(lireM05().archives);
export const basculerArchive = (id) => { const a = lireArchives(); ecrireM05({ archives: a.includes(id) ? a.filter((x) => x !== id) : [...a, id] }); };
// Muscles secondaires : ceux choisis par l'utilisateur, sinon ceux du catalogue.
export const secondairesDe = (e) => { const o = lireM05().secondaires?.[e.id]; return Array.isArray(o) ? o : e.autres ?? []; };
// Mode d'enregistrement GymMane : '' (répétitions et poids), 'time', 'cardio' (distance et temps, gardé sur le compte).
export const modeDe = (e) => (e.mesure === 'duree' ? (lireM05().modes?.[e.id] === 'cardio' ? 'cardio' : 'time') : '');
export const mediaDe = (id) => { const m = lireM05().medias?.[id]; return typeof m === 'string' && /^[0-9a-f]{32}$/.test(m) ? m : ''; };

const sansAccent = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Genre de l'original (kindOf) : sport et étirement d'abord, puis cardio (mode de la fiche compris), callisthénie, force.
export const typeDe = (e) => {
  const g = e.perso ? '' : GENRE_PAR_ID[e.id];
  if (g === 'sport' || g === 'etirement') return g;
  if (modeDe(e) === 'cardio' || g === 'cardio') return 'cardio';
  return g || (e.perso && e.materiel === 'poids-du-corps' ? 'callisthenie' : 'force');
};
// Matériel du filtre : ceux du catalogue, plus « Sans matériel » (isNoKit), anneaux et lesté de l'original.
const MATERIELS_FILTRE = ['sans', ...MATERIELS, 'anneaux', 'leste'];
const nomMateriel = (x) => t.materiels[x] ?? m05().biblio.materiels[x];
const materielVa = (e, x) => (x === 'sans' ? (e.perso ? e.materiel === 'poids-du-corps' : SANS_MATERIEL.has(e.id))
  : x === 'anneaux' || x === 'leste' ? EQUIPEMENT_PAR_ID[e.id] === x : e.materiel === x);

const FILTRES_VIDES = { muscle: '', materiel: '', niveau: 0, type: '', zone: '' };
// Zones du corps (exercise_catalog.dart kBodyZones) : une zone d'un seul muscle est une carte, les autres sont un groupe avec « Tous · N ».
// La bibliothèque d'Anatoly n'a pas d'obliques à part : la ceinture abdominale n'y compte que les abdominaux.
export const ZONES = [['Chest', ['pectoraux']], ['Back', ['dos', 'trapezes', 'lombaires']], ['Shoulders', ['epaules']], ['Arms', ['biceps', 'triceps', 'avant-bras']],
  ['Core', ['abdos']], ['Legs', ['quadriceps', 'fessiers', 'ischios', 'mollets']]];
const SEULES = ['Chest', 'Shoulders'];
const musclesZone = (z) => ZONES.find(([k]) => k === z)?.[1] ?? [];

function filtrer(liste, q, f, perso, favorisSeul, favorisIds, ici = false, archivesSeul = false) {
  const mots = sansAccent(q).split(/\s+/).filter(Boolean);
  const fav = new Set(favorisIds);
  const arch = new Set(lireArchives());
  return liste.filter((e) => {
    if (arch.has(e.id) !== archivesSeul) return false;
    if (perso && !e.perso) return false;
    if (ici && !ajusteIci(e)) return false;
    if (favorisSeul && !fav.has(e.id)) return false;
    if (f.muscle && e.muscle !== f.muscle) return false;
    if (f.zone && !musclesZone(f.zone).includes(e.muscle)) return false;
    if (f.materiel && !materielVa(e, f.materiel)) return false;
    if (f.niveau && e.niveau !== f.niveau) return false;
    if (f.type && typeDe(e) !== f.type) return false;
    return mots.every((m) => sansAccent(`${e.fr} ${e.en} ${e.noms ?? ''}`).includes(m));
  })
    .sort((a, b) => nomExercice(a).localeCompare(nomExercice(b), langue));
}

export function Recherche({ valeur, onChange, label, inputRef }) {
  return <div class="recherche"><Ic n="magnifying-glass" taille={16} />
    <input ref={inputRef} type="search" value={valeur} onInput={(e) => onChange(e.target.value)} placeholder={label} aria-label={label} enterKeyHint="search" autoComplete="off" autoCorrect="off" spellcheck={false} />
    {valeur && <button type="button" class="effacer" onClick={() => onChange('')} aria-label={t.exercices.effacer}><Ic n="x:bold" taille={10} /></button>}
  </div>;
}

// Pastille de filtre actif : le libellé et sa croix retirent le filtre.
function PuceActive({ label, onRetirer }) {
  return <button type="button" class="puce puce-actif" aria-pressed="true" onClick={onRetirer}>{label}<Ic n="x:bold" taille={11} /></button>;
}

const TEINTES = { pectoraux: '#F3C7B1', dos: '#9CC2E8', epaules: '#E8CF98', biceps: '#A8C99E', triceps: '#A78BDA', 'avant-bras': '#E6A4B9', abdos: '#E8CF98', quadriceps: '#F3C7B1',
  ischios: '#9CC2E8', fessiers: '#E6A4B9', mollets: '#A8C99E', trapezes: '#A78BDA', lombaires: '#9CC2E8', cardio: '#E6A4B9', corps: '#A8C99E' };
export const Vignette = ({ e, taille = 52, calmMotion = false }) => {
  const media = mediaDe(e.id);
  return <span class="art-cadre" style={`width:${taille}px;height:${taille}px`} aria-hidden="true">
    {media ? <img class="art-media" src={`/api/media/${media}`} alt="" loading="lazy" /> : <IllustrationExercice exo={e} taille={taille} calmMotion={calmMotion} />}</span>;
};

function Ligne({ e, choisi, onClick, href, favori, onBasculerFavori }) {
  const calm = Boolean(etat.value?.profil?.reduire_animations);
  const milieu = <><Vignette e={e} taille={52} calmMotion={calm} /><span class="ligne-ex-texte"><strong>{nomExercice(e)}</strong><small>{t.materiels[e.materiel]} · {t.niveaux[e.niveau]}</small></span>
    {onClick ? <span class={`choix ${choisi ? 'ok' : ''}`} aria-hidden="true">{choisi ? <Ic n="check:bold" taille={12} /> : null}</span> : null}</>;
  const etoile = onBasculerFavori && <button type="button" class="ligne-ex-fav" aria-pressed={favori} aria-label={favori ? m05().detail.retirerFavori : m05().detail.ajouterFavori}
    onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); onBasculerFavori(); }}><Ic n={favori ? 'star:fill' : 'star'} taille={18} /></button>;
  if (href) {
    return <div class="ligne-ex">
      <a class="ligne-ex-lien" href={href}>{milieu}</a>
      {etoile}
    </div>;
  }
  return <button type="button" class="ligne-ex" onClick={onClick} aria-pressed={choisi}>{milieu}{etoile}</button>;
}

// Ligne de la bibliothèque recalculée seulement si l'exercice ou son étoile change (466 lignes).
class LigneFixe extends Component {
  shouldComponentUpdate(p) { return p.e !== this.props.e || p.favori !== this.props.favori; }
  render(p) { return <Ligne {...p} />; }
}

export function Exercices() {
  const m = m05();
  const b = m05b();
  const [q, setQ] = useState('');
  const [filtres, setFiltres] = useState(FILTRES_VIDES);
  const [perso, setPerso] = useState(false);
  const [favorisSeul, setFavorisSeul] = useState(false);
  const [archivesSeul, setArchivesSeul] = useState(false);
  const archives = lireArchives();
  const [creer, setCreer] = useState(false);
  const [feuille, setFeuille] = useState('');
  const [brouillon, setBrouillon] = useState(FILTRES_VIDES);
  const favoris = lireFavoris();
  const [plie, setPlie] = useState(false);
  const recherche = useRef(null);
  const liste = tousExercices.value;
  const lieu = lieuActif();
  const lieux = tousLieux();
  const cleLieu = lieu ? `${lieu.id}:${lieu.equip.join(',')}` : '';
  useEffect(() => { reprendreAnciens(); }, []);
  // lireFavoris() rend un nouveau tableau à chaque rendu : la clé texte évite de refiltrer 466 exercices à chaque défilement.
  const cleFavoris = favoris.join(',');
  const favorisSet = useMemo(() => new Set(favoris), [cleFavoris]);
  const vus = useMemo(() => filtrer(liste, q, filtres, perso, favorisSeul, favoris, true, archivesSeul), [liste, q, filtres, perso, favorisSeul, cleFavoris, cleLieu, archivesSeul, archives.join(',')]);

  useEffect(() => {
    const fn = () => {
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      setPlie(y > 110);
    };
    fn();
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // Comme GymMane : la pastille « Filtres · N » compte les filtres de la feuille, la zone se compte à part sur le bouton rond.
  const nbFeuille = (lieu ? 1 : 0) + (filtres.materiel ? 1 : 0) + (filtres.niveau ? 1 : 0) + (filtres.type ? 1 : 0) + (perso ? 1 : 0) + (archivesSeul ? 1 : 0);
  const nbActifs = nbFeuille + (filtres.muscle || filtres.zone ? 1 : 0);
  const toutActif = nbActifs + (favorisSeul ? 1 : 0);
  const appliquer = (f) => { setFiltres(f); setFeuille(''); };
  const effacer = () => { setFiltres(FILTRES_VIDES); setPerso(false); setFavorisSeul(false); setArchivesSeul(false); setQ(''); if (lieu) choisirLieu(''); };
  // Relit la liste au clic : une ligne mémorisée garde une ancienne fonction, elle ne doit pas écraser un favori ajouté depuis.
  const basculerFavori = (id) => { const f = lireFavoris(); ecrireFavoris(f.includes(id) ? f.filter((x) => x !== id) : [...f, id]); };
  const allerRecherche = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => recherche.current?.focus({ preventScroll: true }), 360);
  };
  const titres = { muscle: t.exercices.muscle, materiel: t.exercices.materiel, niveau: m.biblio.niveau, type: m.biblio.type };

  return <main class={`ecran avec-nav biblio ${plie ? 'plie' : ''}`}>
    <header class="biblio-tete">
      <div class="biblio-ligne">
        <div class="biblio-titre"><h1>{t.exercices.titre}</h1><p class="muted">{t.exercices.dansBibliotheque(vus.length)}</p></div>
        <div class="biblio-actions">
          <button type="button" class="rond biblio-loupe" aria-label={t.exercices.rechercher} onClick={allerRecherche}><Ic n="magnifying-glass" taille={16} /></button>
          <button type="button" class="rond biblio-filtre" aria-label={m.biblio.filtres} onClick={() => { setBrouillon(filtres); setFeuille('filtres'); }}>
            <Ic n="sliders-horizontal" taille={17} />{nbActifs > 0 && <b class="badge-filtre">{nbActifs}</b>}
          </button>
          <Rond n="plus:bold" label={t.exercices.creer} taille={40} classe="biblio-plus" onClick={() => setCreer(true)} />
        </div>
      </div>
      <div class="biblio-recherche"><Recherche valeur={q} onChange={setQ} label={t.exercices.rechercher} inputRef={recherche} /></div>
      <div class="biblio-puces"><div class="puces" role="group" aria-label={m.biblio.filtres}>
        <button type="button" class="puce" aria-pressed={!!(filtres.muscle || filtres.zone)} onClick={() => { setBrouillon(filtres); setFeuille('zones'); }}>{filtres.muscle ? t.muscles[filtres.muscle] : filtres.zone ? L26().zones[filtres.zone] : m.biblio.parZone}</button>
        <button type="button" class="puce" aria-pressed="false" onClick={() => { setBrouillon(filtres); setFeuille('filtres'); }}>{nbFeuille > 0 ? m.biblio.filtresN(nbFeuille) : m.biblio.filtres}</button>
        {lieu && <PuceActive label={lieu.nom} onRetirer={() => choisirLieu('')} />}
        {filtres.materiel && <PuceActive label={nomMateriel(filtres.materiel)} onRetirer={() => setFiltres((f) => ({ ...f, materiel: '' }))} />}
        {filtres.niveau > 0 && <PuceActive label={t.niveaux[filtres.niveau]} onRetirer={() => setFiltres((f) => ({ ...f, niveau: 0 }))} />}
        {filtres.type && <PuceActive label={m.biblio.types[filtres.type]} onRetirer={() => setFiltres((f) => ({ ...f, type: '' }))} />}
        {perso && <PuceActive label={t.exercices.perso} onRetirer={() => setPerso(false)} />}
        {archivesSeul && <PuceActive label={b.archives} onRetirer={() => setArchivesSeul(false)} />}
        <button type="button" class="puce" aria-pressed={favorisSeul} onClick={() => setFavorisSeul((v) => !v)}>{favoris.length ? m.biblio.favorisN(favoris.length) : t.exercices.favoris}</button>
        {toutActif > 0 && <button type="button" class="puce texte" onClick={effacer}>{m.biblio.effacer}</button>}
      </div></div>
    </header>
    {vus.length ? <Groupes liste={vus} version={favorisSet} rendu={(e) => <LigneFixe key={e.id} e={e} href={`#/exercice/${e.id}`} favori={favorisSet.has(e.id)} onBasculerFavori={() => basculerFavori(e.id)} />} />
      : favorisSeul && !favoris.length
        ? <div class="vide-carte"><Ic n="star" taille={18} /><p class="vide-titre">{m.biblio.aucunFavori}</p><p class="vide-texte">{m.biblio.aucunFavoriTexte}</p></div>
        : <div class="vide-carte"><Ic n="magnifying-glass" taille={30} /><p class="vide-titre">{m.biblio.aucun}</p><p class="vide-texte">{m.biblio.aucunTexte}</p>
          {toutActif > 0 && <button type="button" class="btn lien" onClick={effacer}>{m.biblio.effacer}</button>}</div>}
    <FormExercice ouverte={creer} fermer={() => setCreer(false)} nomInitial={q} />

    <Feuille ouverte={feuille === 'zones'} fermer={() => setFeuille('')} titre={m.biblio.parZone} classe="l26-zones">
      {(() => {
        const compte = (mus) => liste.filter((e) => mus.includes(e.muscle) && ajusteIci(e) && !archives.includes(e.id)).length;
        const carte = (mu) => <button type="button" key={mu} class="zone-carte l26-zone-carte" aria-pressed={filtres.muscle === mu} aria-label={t.muscles[mu]}
          onClick={() => appliquer({ ...filtres, zone: '', muscle: filtres.muscle === mu ? '' : mu })}>
          <span class="l26-zone-art" aria-hidden="true"><SilhouettePar mode="heat" vueInitiale="both" ramp="ember" intensites={{ [mu]: 4 }} lang={langue} sexe={etat.value?.profil?.sexe === 'f' ? 'f' : 'm'} /></span>
          <b>{t.muscles[mu]}</b><small>{t.accueil.exercicesN(compte([mu]))}</small>
        </button>;
        return <>
          <div class="zone-grille">{ZONES.filter(([k]) => SEULES.includes(k)).map(([, [mu]]) => carte(mu))}</div>
          {ZONES.filter(([k]) => !SEULES.includes(k)).map(([k, mus]) => <section key={k}>
            <div class="l26-zone-tete">
              <span>{L26().zones[k]}</span>
              <button type="button" class={filtres.zone === k ? 'on' : ''} aria-pressed={filtres.zone === k}
                onClick={() => appliquer({ ...filtres, muscle: '', zone: filtres.zone === k ? '' : k })}>{L26().tousCourt} · {compte(mus)}</button>
            </div>
            <div class="zone-grille">{mus.map(carte)}</div>
          </section>)}
        </>;
      })()}
    </Feuille>

    <Feuille ouverte={feuille === 'filtres'} fermer={() => setFeuille('')} titre={m.biblio.filtres}
      pied={<>
        <button type="button" class="btn pri large" onClick={() => appliquer(brouillon)}>{m.biblio.appliquer(filtrer(liste, q, brouillon, perso, favorisSeul, favoris, true, archivesSeul).length)}</button>
        {Object.values(brouillon).some(Boolean) && <button type="button" class="btn lien" onClick={() => setBrouillon(FILTRES_VIDES)}>{m.biblio.effacer}</button>}
      </>}>
      {/* Ordre de exercises_screen.dart _FilterSheet : type, matériel, niveau, afficher, lieu. */}
      {['type', 'materiel', 'niveau'].map((cle) => <div class="filtre-groupe" key={cle}>
        <Kicker>{titres[cle]}</Kicker>
        <div class="filtre-puces">
          {cle === 'materiel' && MATERIELS_FILTRE.map((x) => <button type="button" key={x} class="puce" aria-pressed={brouillon.materiel === x}
            onClick={() => setBrouillon((f) => ({ ...f, materiel: f.materiel === x ? '' : x }))}>{nomMateriel(x)}</button>)}
          {cle === 'niveau' && [1, 2, 3].map((x) => <button type="button" key={x} class="puce" aria-pressed={brouillon.niveau === x}
            onClick={() => setBrouillon((f) => ({ ...f, niveau: f.niveau === x ? 0 : x }))}>{t.niveaux[x]}</button>)}
          {cle === 'type' && Object.entries(m.biblio.types).map(([x, l]) => <button type="button" key={x} class="puce" aria-pressed={brouillon.type === x}
            onClick={() => setBrouillon((f) => ({ ...f, type: f.type === x ? '' : x }))}>{l}</button>)}
        </div>
      </div>)}
      {(perso || archivesSeul || archives.length > 0 || liste.some((e) => e.perso)) && <div class="filtre-groupe">
        <Kicker>{m.biblio.seulement}</Kicker>
        <div class="filtre-puces">
          {(perso || liste.some((e) => e.perso)) && <button type="button" class="puce" aria-pressed={perso} onClick={() => setPerso((v) => !v)}>{t.exercices.perso}</button>}
          {(archives.length > 0 || archivesSeul) && <button type="button" class="puce" aria-pressed={archivesSeul} onClick={() => setArchivesSeul((v) => !v)}>{b.archivesN(archives.length)}</button>}
        </div>
      </div>}
      <div class="filtre-groupe">
        <Kicker>{m.biblio.lieu}</Kicker>
        <div class="filtre-puces">
          {lieux.length > 0 && <button type="button" class="puce" aria-pressed={!lieu} onClick={() => choisirLieu('')}>{m.biblio.partout}</button>}
          {lieux.map((l) => <button type="button" key={l.id} class="puce" aria-pressed={lieu?.id === l.id} onClick={() => choisirLieu(l.id)}>{l.nom}</button>)}
          <a class="puce" href="#/lieux" aria-label={lieux.length ? m.biblio.nouveauLieu : undefined}>{lieux.length ? '+' : m.biblio.nouveauLieu}</a>
        </div>
      </div>
    </Feuille>
  </main>;
}

// Rendu progressif : les premières lignes tout de suite, le reste par tranches pendant les temps morts du navigateur.
// Chaque groupe déjà complet n'est plus recalculé (zéro tâche longue au chargement, cible 50 ms).
const TRANCHE = 20;
const plusTard = (fn) => (window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout: 200 }) : setTimeout(fn, 16));
const annuler = (id) => (window.cancelIdleCallback ? window.cancelIdleCallback(id) : clearTimeout(id));

class Groupe extends Component {
  shouldComponentUpdate(p) { return p.items !== this.props.items || p.n !== this.props.n || p.version !== this.props.version; }
  render({ k, items, n, rendu }) {
    return <section class="groupe-ex">
      <Kicker>{k === 'perso' ? t.exercices.perso : t.muscles[k]} <span class="biblio-nb">{items.length}</span></Kicker>
      <div class="carte liste-ex" style={n < items.length ? `min-height:${items.length * 70}px` : undefined}>{items.slice(0, n).map(rendu)}</div>
    </section>;
  }
}

export function Groupes({ liste, rendu, version }) {
  const groupes = useMemo(() => {
    const m = new Map();
    for (const e of liste) { const k = e.perso ? 'perso' : e.muscle; if (!m.has(k)) m.set(k, []); m.get(k).push(e); }
    return ['perso', ...MUSCLES].filter((k) => m.has(k)).map((k) => [k, m.get(k)]);
  }, [liste]);
  const [limite, setLimite] = useState(TRANCHE);
  useEffect(() => { setLimite(TRANCHE); }, [liste]);
  useEffect(() => {
    if (limite >= liste.length) return undefined;
    const id = plusTard(() => setLimite((x) => x + TRANCHE));
    return () => annuler(id);
  }, [limite, liste]);
  let reste = limite;
  return groupes.map(([k, items]) => {
    const n = Math.max(0, Math.min(items.length, reste));
    reste -= n;
    return <Groupe key={k} k={k} items={items} n={n} rendu={rendu} version={version} />;
  });
}

export function ChoixExercices({ ouverte, fermer, choisir, unique = false }) {
  const m = m05();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('');
  const [choisis, setChoisis] = useState([]);
  const favoris = lireFavoris();
  const liste = tousExercices.value;
  const vus = useMemo(() => filtrer(liste, q, { ...FILTRES_VIDES, muscle }, false, false, favoris), [liste, q, muscle, favoris]);
  const fin = () => { setChoisis([]); setQ(''); fermer(); };
  return <Feuille ouverte={ouverte} fermer={fin} titre={unique ? t.seance.remplacer : t.seance.ajouterExercice} large
    pied={!unique && <button type="button" class="btn pri large" disabled={!choisis.length} onClick={() => { choisir(choisis); setChoisis([]); setQ(''); }}>
      {choisis.length ? t.exercices.ajouterN(choisis.length) : t.exercices.choisir}</button>}>
    <Recherche valeur={q} onChange={setQ} label={t.exercices.rechercher} />
    <div class="puces" role="group" aria-label={t.exercices.muscle}>
      <button type="button" class="puce" aria-pressed={!muscle} onClick={() => setMuscle('')}>{t.exercices.tous}</button>
      {MUSCLES.map((x) => <button type="button" key={x} class="puce" aria-pressed={muscle === x} onClick={() => setMuscle(muscle === x ? '' : x)}>{t.muscles[x]}</button>)}
    </div>
    {vus.length ? <div class="carte liste-ex">{vus.slice(0, 200).map((e) => <Ligne key={e.id} e={e} choisi={choisis.includes(e.id)}
      onClick={() => (unique ? (choisir([e.id]), setQ('')) : setChoisis((c) => (c.includes(e.id) ? c.filter((x) => x !== e.id) : [...c, e.id])))} />)}</div>
      : <div class="vide-carte"><Ic n="magnifying-glass" taille={30} /><p class="vide-titre">{m.biblio.aucun}</p><p class="vide-texte">{m.biblio.aucunTexte}</p></div>}
  </Feuille>;
}

export function FormExercice(props) {
  return props.ouverte ? <FormulaireExercice {...props} /> : null;
}

// Familles de muscles de la feuille « Nouvel exercice » (GymMane, kBodyZones) : une famille à plusieurs muscles ouvre le détail.
export const FAMILLES = [['pectoraux', ['pectoraux']], ['dos', ['dos', 'trapezes', 'lombaires']], ['epaules', ['epaules']],
  ['bras', ['biceps', 'triceps', 'avant-bras']], ['tronc', ['abdos']], ['jambes', ['quadriceps', 'fessiers', 'ischios', 'mollets']]];
// Muscles proposés en secondaire (GymMane, kMuscles) : sans les catégories cardio et corps entier.
export const VRAIS_MUSCLES = MUSCLES.filter((x) => x !== 'cardio' && x !== 'corps');
const COURANTS = ['poids-du-corps', 'halteres', 'barre', 'machine', 'poulie', 'elastique'];
const MODES = [['', 'barbell'], ['time', 'timer'], ['cardio', 'person-simple-run']];

// `apres` (facultatif) : reçoit l'id du nouvel exercice au lieu d'ouvrir sa fiche (ajout depuis la séance).
function FormulaireExercice({ fermer, exercice = null, nomInitial = '', apres = null }) {
  const m = m05();
  const b = m05b();
  const f = m.form;
  const [nom, setNom] = useState(exercice?.fr ?? nomInitial.trim());
  const [muscle, setMuscle] = useState(exercice?.muscle ?? 'pectoraux');
  const [materiel, setMateriel] = useState(exercice?.materiel ?? 'barre');
  const [mode, setMode] = useState(exercice ? modeDe(exercice) : '');
  const [secondaires, setSecondaires] = useState(() => (exercice ? secondairesDe(exercice).filter((x) => VRAIS_MUSCLES.includes(x)) : []));
  const [autres, setAutres] = useState(exercice?.noms ?? '');
  const [etapes, setEtapes] = useState(exercice?.etapes ?? '');
  const [avance, setAvance] = useState(false);
  const [tousMateriels, setTousMateriels] = useState(false);
  const [zone, setZone] = useState(() => FAMILLES.find(([, l]) => l.includes(exercice?.muscle ?? 'pectoraux'))?.[0] ?? 'pectoraux');
  const [manque, setManque] = useState(0);
  const champ = useRef(null);
  const id = exercice?.id?.slice(2);
  const reste = MATERIELS.filter((x) => !COURANTS.includes(x));
  const tous = tousMateriels || reste.includes(materiel);
  const enregistrer = async (e) => {
    e.preventDefault();
    if (!nom.trim()) { setManque((n) => n + 1); champ.current?.focus(); champ.current?.closest('.feuille-corps')?.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    // Distance et temps s'enregistre en durée tant que la séance ne saisit pas la distance ; le mode reste sur le compte.
    const mesure = mode ? 'duree' : materiel === 'poids-du-corps' || (exercice?.mesure === 'corps' && materiel === exercice.materiel) ? 'corps' : 'poids';
    try {
      const r = await api(id ? 'PUT' : 'POST', id ? `/api/exercices/${id}` : '/api/exercices', { nom: nom.trim(), muscle, materiel, mesure, autres, etapes });
      const cle = `p-${id ?? r?.id}`;
      if (id || r?.id) {
        const s = { ...(lireM05().secondaires || {}) }, md = { ...(lireM05().modes || {}) };
        const sec = secondaires.filter((x) => x !== muscle);
        if (sec.length) s[cle] = sec; else delete s[cle];
        if (mode === 'cardio') md[cle] = 'cardio'; else delete md[cle];
        ecrireM05({ secondaires: s, modes: md });
      }
      await charger();
      afficher(f.ok);
      fermer();
      if (!id && r?.id) { if (apres) apres(`p-${r.id}`); else location.hash = `#/exercice/p-${r.id}`; }
    } catch { afficher(t.commun.erreur, 'danger'); }
  };
  const famille = FAMILLES.find(([k]) => k === zone)?.[1] ?? [];
  return <Feuille ouverte fermer={fermer} titre={id ? f.modifier : f.nouveau} sous={id ? undefined : f.aide}>
    <form class="form-ex" onSubmit={enregistrer} id="form-ex" noValidate>
      <div class={`form-ex-nom ${manque ? `manque secousse${manque % 2}` : ''}`}>
        <input ref={champ} id="ex-nom" class="form-input" maxLength={80} value={nom} placeholder={f.nom} aria-label={f.nom} autoFocus={!exercice} autoCapitalize="words"
          onInput={(e) => { setNom(e.target.value); if (e.target.value.trim()) setManque(0); }} aria-invalid={!!manque} aria-describedby={manque ? 'ex-nom-err' : undefined} />
      </div>
      {manque > 0 && <p class="form-ex-erreur" id="ex-nom-err" role="alert"><Ic n="warning-circle:fill" taille={15} />{b.nomManquant}</p>}
      <p class="ex-label">{b.enregistrerPar}</p>
      <div class="ex-modes" role="radiogroup" aria-label={b.enregistrerPar}>{MODES.map(([k, ic]) => <button type="button" key={k} role="radio" class="ex-mode" aria-checked={mode === k} onClick={() => setMode(k)}>
        <Ic n={ic} taille={22} /><span>{b.modes[k]}</span></button>)}</div>
      <p class="ex-label">{b.muscle}</p>
      <div class="ex-pilules">{FAMILLES.map(([k, l]) => <button type="button" key={k} class="ex-pilule grande" aria-pressed={l.includes(muscle)}
        onClick={() => { setZone(k); if (!l.includes(muscle)) { setMuscle(l[0]); setSecondaires((s) => s.filter((x) => x !== l[0])); } }}>{b.familles[k]}</button>)}</div>
      {famille.length > 1 && <div class="ex-sous">{famille.map((x) => <button type="button" key={x} class="ex-pilule petite" aria-pressed={muscle === x}
        onClick={() => { setMuscle(x); setSecondaires((s) => s.filter((y) => y !== x)); }}>{t.muscles[x]}</button>)}</div>}
      <p class="ex-label">{b.materiel}</p>
      <div class="ex-pilules">
        {[...COURANTS, ...(tous ? reste : [])].map((x) => <button type="button" key={x} class="ex-pilule" aria-pressed={materiel === x} onClick={() => setMateriel(x)}>{t.materiels[x]}</button>)}
        {!tous && <button type="button" class="ex-pilule plus" onClick={() => setTousMateriels(true)}>+{reste.length}</button>}
      </div>
      <button type="button" class="ligne-avance" aria-expanded={avance} aria-controls="ex-avance" onClick={() => setAvance((v) => !v)}>
        <Ic n="sliders-horizontal" taille={18} /><span>{f.avance}</span><Ic n="caret-down:bold" taille={14} classe={avance ? 'ouvert' : ''} />
      </button>
      {avance && <div id="ex-avance" class="form-ex-avance">
        <p class="ex-label">{b.secondairesForm}</p>
        <div class="ex-pilules">{VRAIS_MUSCLES.filter((x) => x !== muscle).map((x) => <button type="button" key={x} class="ex-pilule petite" aria-pressed={secondaires.includes(x)}
          onClick={() => setSecondaires((s) => (s.includes(x) ? s.filter((y) => y !== x) : [...s, x]))}>{t.muscles[x]}</button>)}</div>
        <label class="ex-label" for="ex-etapes">{f.etapes}</label>
        <textarea id="ex-etapes" class="form-input" rows={3} maxLength={6000} value={etapes} placeholder={f.etapesAide} onInput={(e) => setEtapes(e.target.value)} />
        <label class="ex-label" for="ex-autres">{f.autres}</label>
        <input id="ex-autres" class="form-input" maxLength={500} value={autres} placeholder={f.autresAide} onInput={(e) => setAutres(e.target.value)} />
      </div>}
      <button class="btn pri large form-ex-ok" type="submit">{id ? f.enregistrer : f.ajouter}</button>
    </form>
  </Feuille>;
}

// Suppression d'un exercice personnalisé, avec confirmation (corbeille de la fiche).
export function SupprimerExercice({ ouvert, fermer, exercice }) {
  const f = m05().form;
  return <Dialogue ouvert={ouvert} fermer={fermer} titre={f.supprimerTitre} texte={f.supprimerTexte(nomExercice(exercice))} libelle={f.supprimer} danger
    confirmer={async () => {
      try { await api('DELETE', `/api/exercices/${exercice.id.slice(2)}`); await charger();
        const fav = lireFavoris(); if (fav.includes(exercice.id)) ecrireFavoris(fav.filter((x) => x !== exercice.id)); afficher(t.commun.supprime); location.hash = '#/exercices'; } catch { afficher(t.commun.erreur, 'danger'); }
    }} />;
}
