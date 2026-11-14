// Application Anatoly : routeur par ancre, barre de navigation flottante, chargement et états d'erreur.
import { h, render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
// Règles du site utiles à l'appli (build.mjs) : avant app.css, comme l'ordre des deux feuilles d'origine.
import './anatoly-commun.css';
import './app.css';
// Ordre des feuilles de style figé : les écrans chargés à la demande ne doivent pas changer la cascade.
import './ecrans/m13.css';
import './ecrans/m05.css';
import './ecrans/m05b.css';
import './ecrans/m06.css';
import './ecrans/m02.css';
import './ecrans/m03.css';
import './ecrans/m08.css';
import './ecrans/m11.css';
import './ecrans/m04.css';
import './ecrans/progres-structure.css';
import './ecrans/m14.css';
import './ecrans/reglages.css';
import './ecrans/profil.css';
import './ecrans/m07.css';
import './ecrans/m12.css';
import './ecrans/nutrition/gm.css';
import './ecrans/m09.css';
import './ecrans/nutrition/m10.css';
import './ecrans/historique.css';
import './ecrans/l26.css';
import './ecrans/l30.css';
import './ecrans/l31.css';
import './ecrans/l32.css';
// Mise en page tablette et ordinateur : en dernier, n'agit qu'à partir de 768 px.
import './ecrans/grand-ecran.css';
import { charger, chrono, demarrer, enCours, enLigne, erreurChargement, etat, nbExercicesValides, routineSelonPlanDuJour, secondesEcouleesSession } from './donnees.js';
import { langue, t } from './i18n.js';
import { Accueil } from './ecrans/accueil.jsx';
import { Seance } from './ecrans/seance.jsx';
import { feuilleDemarrage, Ic, Saisie, Toast } from './ui.jsx';
import { poserAffichage } from './ecrans/reglages-m13.js';
import { paresseux } from './paresseux.js';

const Bilan = paresseux(() => import('./ecrans/bilan.jsx'), 'Bilan');
const Exercice = paresseux(() => import('./ecrans/exercice.jsx'), 'Exercice');
const Exercices = paresseux(() => import('./ecrans/exercices.jsx'), 'Exercices');
const Historique = paresseux(() => import('./ecrans/historique.jsx'), 'Historique');
const SeanceDetail = paresseux(() => import('./ecrans/historique.jsx'), 'SeanceDetail');
const Programme = paresseux(() => import('./ecrans/programmes.jsx'), 'Programme');
const Programmes = paresseux(() => import('./ecrans/programmes.jsx'), 'Programmes');
const Progres = paresseux(() => import('./ecrans/progres.jsx'), 'Progres');
const Reglages = paresseux(() => import('./ecrans/reglages.jsx'), 'Reglages');
const Profil = paresseux(() => import('./ecrans/profil.jsx'), 'Profil');
const APropos = paresseux(() => import('./ecrans/a-propos.jsx'), 'APropos');
const Lieux = paresseux(() => import('./ecrans/lieux.jsx'), 'Lieux');
const Recompenses = paresseux(() => import('./ecrans/recompenses.jsx'), 'Recompenses');
const Entrain = paresseux(() => import('./ecrans/entrain.jsx'), 'Entrain');
const Notes = paresseux(() => import('./ecrans/notes.jsx'), 'Notes');
const NoteEdit = paresseux(() => import('./ecrans/note-edit.jsx'), 'NoteEdit');
const EcranCalculatrices = paresseux(() => import('./ecrans/outils.jsx'), 'EcranOutils');
const EcranDonnees = paresseux(() => import('./ecrans/onboarding.jsx'), 'EcranDonnees');
const Onboarding = paresseux(() => import('./ecrans/onboarding.jsx'), 'Onboarding');
const Mesures = paresseux(() => import('./ecrans/mesures.jsx'), 'Mesures');
const Chronologie = paresseux(() => import('./ecrans/chronologie.jsx'), 'Chronologie');
const Comparer = paresseux(() => import('./ecrans/comparer.jsx'), 'Comparer');
const Photos = paresseux(() => import('./ecrans/photos.jsx'), 'Photos');
const Jour = paresseux(() => import('./ecrans/nutrition/jour.jsx'), 'Jour');
const Plans = paresseux(() => import('./ecrans/nutrition/plans.jsx'), 'Plans');
const Prep = paresseux(() => import('./ecrans/nutrition/prep.jsx'), 'Prep');

const lireRoute = () => (location.hash.replace(/^#/, '') || '/').split('?')[0];
const ONGLETS = [['/', 'house', 'accueil'], ['/progres', 'chart-line-up', 'progres'], null, ['/exercices', 'barbell', 'exercices'], ['/profil', 'user-circle', 'profil']];

// ▶ (app_shell.dart _play) : reprend la séance en cours, sinon lance le programme du jour, sinon ouvre la feuille « Démarrer ».
// Appui long : toujours la feuille « Démarrer » (portée par l'accueil).
const ouvrirDemarrage = () => { feuilleDemarrage.value = true; if (lireRoute() !== '/') location.hash = '#/'; };
function jouer() {
  if (enCours.value) { location.hash = '#/seance'; return; }
  const r = routineSelonPlanDuJour();
  if (r && nbExercicesValides(r) > 0) { demarrer(r); location.hash = '#/seance'; return; }
  ouvrirDemarrage();
}

function BoutonJouer({ classe = 'nav-play', libelle }) {
  const ec = enCours.value;
  const appui = useRef({ minuteur: 0, long: false });
  const relacher = () => clearTimeout(appui.current.minuteur);
  return <button type="button" class={classe} aria-label={ec ? t.accueil.reprendre : t.nav.demarrer}
    onPointerDown={() => { appui.current.long = false; relacher(); appui.current.minuteur = setTimeout(() => { appui.current.long = true; navigator.vibrate?.(10); ouvrirDemarrage(); }, 500); }}
    onPointerUp={relacher} onPointerLeave={relacher} onPointerCancel={relacher}
    onContextMenu={(e) => e.preventDefault()}
    onClick={() => { if (appui.current.long) { appui.current.long = false; return; } jouer(); }}>
    <Ic n={ec ? 'timer:fill' : 'play:fill'} taille={21} />{libelle && <span>{ec ? t.accueil.reprendre : libelle}</span>}</button>;
}

// Barre latérale de l'ordinateur (grand-ecran.css, ≥ 1100 px) : les onglets du bas, plus les écrans que l'accueil ouvre.
const LIENS_LAT = [...ONGLETS.slice(0, 2), ONGLETS[3], ['/programmes', 'list-bullets', 'programmes'], ['/historique', 'clock-counter-clockwise', 'historique'],
  ['/calculatrices', 'calculator', 'outils'], ['/nutrition', 'fork-knife', 'nutrition'], ['/notes', 'notebook', 'journal']];
const AVEC_FILL = new Set(['house', 'chart-line-up', 'barbell', 'user-circle']);
const estActif = (route, c) => (c === '/' ? route === '/' : route === c || route.startsWith(`${c.replace(/s$/, '')}/`));
function LienLat({ o, route }) {
  const actif = estActif(route, o[0]);
  return <a href={`#${o[0]}`} class="lat-lien" aria-current={actif ? 'page' : undefined}>
    <Ic n={actif && AVEC_FILL.has(o[1]) ? `${o[1]}:fill` : o[1]} taille={22} /><span>{t.nav[o[2]]}</span></a>;
}
function Laterale({ route }) {
  return <nav class="lat" aria-label="Navigation">
    <a class="lat-marque" href="#/">Anatoly</a>
    <BoutonJouer classe="lat-play" libelle={t.nav.demarrerCourt} />
    <div class="lat-liens">{LIENS_LAT.map((o) => <LienLat key={o[0]} o={o} route={route} />)}</div>
    <div class="lat-pied"><LienLat o={ONGLETS[4]} route={route} /></div>
  </nav>;
}
const SANS_LATERALE = new Set(['seance', 'bilan', 'onboarding']);

function Nav({ route }) {
  const actif = ONGLETS.findIndex((o) => o && (o[0] === '/' ? route === '/' : route.startsWith(o[0])));
  return <nav class="nav" aria-label="Navigation">
    <div class="nav-in">
      {actif >= 0 && <span class="nav-liquide" style={`--i:${actif}`} aria-hidden="true" />}
      {ONGLETS.map((o, i) => (o
        ? <a key={o[0]} href={`#${o[0]}`} class="nav-item" aria-current={i === actif ? 'page' : undefined} aria-label={t.nav[o[2]]}><Ic n={i === actif ? `${o[1]}:fill` : o[1]} taille={24} /></a>
        : <BoutonJouer key="play" />))}
    </div>
  </nav>;
}

// Bandeau replié (app_shell.dart _CollapsedBar, _compactTitle) : flou en haut et titre court centré dès 44 px de défilement.
const TITRES_COURTS = {
  fr: { progres: 'Progrès', 'a-propos': 'À propos', mesures: 'Mensurations', programmes: 'Programmes', calculatrices: 'Outils', nutrition: 'Nutrition' },
  en: { progres: 'Progress', 'a-propos': 'About', mesures: 'Measurements', programmes: 'Routines', calculatrices: 'Tools', nutrition: 'Nutrition' },
};
const AVEC_BANDEAU = new Set(['', 'progres', 'seance', 'a-propos', 'exercice', 'mesures', 'programmes', 'calculatrices', 'nutrition']);
function dateCourte(d) {
  const loc = langue === 'en' ? 'en-US' : 'fr-FR';
  const jour = new Intl.DateTimeFormat(loc, { weekday: 'long' }).format(d);
  return `${jour[0].toUpperCase()}${jour.slice(1)}, ${new Intl.DateTimeFormat(loc, { month: 'short', day: 'numeric' }).format(d)}`;
}
function BandeauReplie({ a }) {
  const [replie, setReplie] = useState(false);
  useEffect(() => {
    let r = false;
    const f = () => { const y = window.scrollY; const n = y > 44 ? true : y < 16 ? false : r; if (n !== r) { r = n; setReplie(n); } };
    f();
    addEventListener('scroll', f, { passive: true });
    return () => removeEventListener('scroll', f);
  }, [a]);
  const titre = a === '' ? dateCourte(new Date()) : (TITRES_COURTS[langue] ?? TITRES_COURTS.fr)[a];
  return <div class={`bandeau-replie ${replie ? 'replie' : ''}`} aria-hidden="true">
    {titre && <span class="bandeau-titre">{titre}</span>}
  </div>;
}


function Reprise({ route }) {
  const ec = enCours.value;
  const [, tic] = useState(0);
  useEffect(() => { const i = setInterval(() => tic((x) => x + 1), 1000); return () => clearInterval(i); }, []);
  const visible = Boolean(ec) && !route.startsWith('/seance');
  // GymMane réserve 68 px sous le contenu quand la pilule est posée au-dessus de la barre.
  useEffect(() => {
    document.body.classList.toggle('a-reprise', visible);
    return () => document.body.classList.remove('a-reprise');
  }, [visible]);
  if (!visible) return null;
  const s = secondesEcouleesSession(ec);
  return <a class="reprise" href="#/seance">
    <span><span class="kicker">{t.accueil.enCours}</span><strong>{ec.nom || t.accueil.seanceLibre}</strong></span>
    <span class="reprise-temps">{chrono(s)}</span>
    <span class="reprise-play" aria-hidden="true"><Ic n="play:fill" taille={16} /></span>
    <span class="sr">{t.accueil.reprendre}</span>
  </a>;
}

function Erreur({ genre }) {
  const [msg, bouton, href] = genre === 'session' ? [t.commun.sessionExpiree, t.commun.reconnecter, langue === 'en' ? '/en/login/?suite=/app/' : '/connexion/?suite=/app/']
    : genre === 'abonnement' ? [t.commun.abonnement, t.commun.reabonner, langue === 'en' ? '/en/subscribe/' : '/abonnement/']
      : [t.commun.horsLigne, t.commun.reessayer, null];
  return <main class="ecran centre"><div class="vide-carte"><Ic n={genre === 'reseau' ? 'warning' : 'lock'} taille={30} /><p class="vide-titre">{msg}</p>
    {href ? <a class="btn pri" href={href}>{bouton}</a> : <button class="btn pri" type="button" onClick={() => charger()}>{bouton}</button>}</div></main>;
}

function App() {
  const [route, setRoute] = useState(lireRoute());
  useEffect(() => {
    const f = () => { const r = lireRoute(); if (r !== '/') feuilleDemarrage.value = false; setRoute(r); window.scrollTo(0, 0); };
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  if (erreurChargement.value) return <><Erreur genre={erreurChargement.value} /><Toast /></>;
  if (!etat.value) return <main class="ecran centre" aria-busy="true"><span class="rond-attente" role="img" aria-label={t.commun.chargement} /></main>;
  const [, a = '', b] = route.split('/');
  poserAffichage();
  // Barre du bas seulement sur les quatre onglets, comme fit.showNav : les autres routes sont poussées en plein écran.
  let ecran, nav = false;
  if (a === 'seance') ecran = <Seance />;
  else if (a === 'bilan') ecran = <Bilan cle={b} />;
  else if (a === 'recompenses') ecran = <Recompenses />;
  else if (a === 'progres') { ecran = <Progres />; nav = true; }
  else if (a === 'historique' && b) ecran = <SeanceDetail id={b} />;
  else if (a === 'historique') ecran = <Historique />;
  else if (a === 'exercices') { ecran = <Exercices />; nav = true; }
  else if (a === 'exercice') ecran = <Exercice id={b} />;
  else if (a === 'programmes') ecran = <Programmes />;
  else if (a === 'programme') ecran = <Programme id={b} />;
  else if (a === 'reglages') ecran = <Reglages />;
  else if (a === 'profil') { ecran = <Profil />; nav = true; }
  else if (a === 'a-propos') ecran = <APropos />;
  else if (a === 'lieux') ecran = <Lieux />;
  else if (a === 'nutrition') ecran = <Jour />;
  else if (a === 'entrain' || a === 'entrainer') ecran = <Entrain />;
  else if (a === 'calculatrices') ecran = <EcranCalculatrices />;
  else if (a === 'notes') ecran = <Notes />;
  else if (a === 'note-edit') ecran = <NoteEdit />;
  else if (a === 'onboarding') ecran = <Onboarding />;
  else if (a === 'donnees') ecran = <EcranDonnees />;
  else if (a === 'mesures') ecran = <Mesures />;
  else if (a === 'chronologie') ecran = <Chronologie />;
  else if (a === 'comparer') ecran = <Comparer />;
  else if (a === 'photos') ecran = <Photos />;
  else if (a === 'nutrition-plans') ecran = <Plans />;
  else if (a === 'nutrition-prep') ecran = <Prep />;
  else { ecran = <Accueil />; nav = true; }
  const cle = ecran.type === Accueil ? '' : a;
  return <>
    {!enLigne.value && <p class="hors-ligne" role="status"><Ic n="warning" taille={14} />{t.commun.horsLigne}</p>}
    <div class={SANS_LATERALE.has(a) ? 'vue' : 'vue a-lat'}>
      {!SANS_LATERALE.has(a) && <Laterale route={route} />}
      <div class="vue-in" key={cle || 'accueil'}>{ecran}</div>
      {AVEC_BANDEAU.has(cle) && <BandeauReplie key={cle} a={cle} />}
      {nav && <><div class="bandeau-bas" aria-hidden="true" /><Reprise route={route} /><Nav route={route} /></>}
    </div>
    <Toast />
    <Saisie />
  </>;
}

render(<App />, document.getElementById('app'));
charger();
// Les écrans chargés à la demande ne sont pas demandés par la page : le service worker les met en cache en arrière-plan.
function precharger() {
  if (!('serviceWorker' in navigator)) return;
  fetch('/statique/app/manifest.json').then((r) => r.json()).then((m) => navigator.serviceWorker.ready.then((reg) => {
    reg.active?.postMessage({ type: 'precharger', urls: m.fichiers.map((f) => `/statique/app/${f}`) });
  })).catch(() => {});
}
(self.requestIdleCallback ?? setTimeout)(() => setTimeout(precharger, 2000));
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { scope: '/app/' }).catch(() => {});
