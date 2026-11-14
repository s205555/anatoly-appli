// Paramètres : accueil (titre, recherche, catégories en bulles) puis une page par catégorie, comme GymMane.
// Réglages connus du serveur : extensions.preferences. Les autres restent sur cet appareil (localStorage).
import { useEffect, useRef, useState } from 'preact/hooks';
import { afficher, api, appliquerPrefs, appliquerTheme, charger, dateComplete, etat, minSec } from '../donnees.js';
import { choisirLangue, langue, t } from '../i18n.js';
import { DUREE_MAX_SON, TYPES_SON_REPOS, apercuSonRepos, decoderSon, definirSonPerso } from '../sons.js';
import { creerSauvegardeZip, exportCsv, restaurerSauvegarde, telecharger } from '../exporter.js';
import { demanderRegle, Dialogue, Drapeau, Feuille, Ic, Interrupteur, Rond, Segment } from '../ui.jsx';
import { textes } from '../i18n/m13.js';
import { r as textesR } from '../i18n/reglages.js';
import { voixDisponible } from './onboarding.jsx';
import { ecrireM13, lancerSauvegardeAuto, lireM13, poserAffichage } from './reglages-m13.js';
import { FeuilleRapport, FeuilleSante, FeuilleSauvegarde, FeuilleVoix } from './reglages-feuilles.jsx';
import { FeuilleStrava } from './strava.jsx';
import { VitrineAccueil, VitrineAlertes, VitrineApparence } from './reglages-vitrines.jsx';
import './m13.css';
import './reglages.css';

const URL_DEPOT = 'https://github.com/s205555/anatoly-appli';
const jourIso = () => new Date().toISOString().slice(0, 10);

export { lireM13 };

// Ligne à rechercher puis à faire clignoter après un clic sur un résultat de recherche.
const enAttente = { libelle: null };
const sansAccent = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function Ligne({ n, label, sous, valeur, onClick, href, danger, droite, badge }) {
  const contenu = <><span class="pastille-ic" aria-hidden="true"><Ic n={n} taille={17} /></span>
    <span class="rg-texte"><span class="rg-libelle">{label}{badge}</span>{sous && <small>{sous}</small>}</span>
    <span class="rg-ctl">{valeur && <span class="ligne-valeur">{valeur}</span>}{droite}{!droite && <Ic n="caret-right" taille={15} classe="chevron" />}</span></>;
  const p = { class: `ligne-reglage ${danger ? 'danger' : ''}`, 'data-rg': label };
  return href ? <a {...p} href={href} {...(/^https?:/.test(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{contenu}</a>
    : <button type="button" {...p} onClick={onClick}>{contenu}</button>;
}

// Toute la ligne bascule le réglage, comme dans GymMane.
function Bascule({ n, label, sous, actif, onChange, badge }) {
  return <div class="ligne-reglage rg-cliquable" data-rg={label} onClick={() => onChange(!actif)}>
    <span class="pastille-ic" aria-hidden="true"><Ic n={n} taille={17} /></span>
    <span class="rg-texte"><span class="rg-libelle">{label}{badge}</span>{sous && <small>{sous}</small>}</span>
    <span class="rg-ctl"><Interrupteur actif={actif} onChange={() => {}} label={label} /></span>
  </div>;
}

function Statique({ n, label, sous, children, badge }) {
  return <div class="ligne-reglage statique" data-rg={label}>
    <span class="pastille-ic" aria-hidden="true"><Ic n={n} taille={17} /></span>
    <span class="rg-texte"><span class="rg-libelle">{label}{badge}</span>{sous && <small>{sous}</small>}</span>
    {children && <span class="rg-ctl">{children}</span>}
  </div>;
}

const Pas = ({ valeur, moins, plus, edition, label }) => <span class="rg-pas">
  <button type="button" aria-label={`${label} −`} onClick={(e) => { e.stopPropagation(); moins(); }}><Ic n="minus" taille={14} /></button>
  <button type="button" class="rg-pas-val" aria-label={label} onClick={edition}>{valeur}</button>
  <button type="button" aria-label={`${label} +`} onClick={(e) => { e.stopPropagation(); plus(); }}><Ic n="plus" taille={14} /></button>
</span>;

const Carte = ({ children }) => <div class="groupe rg-carte">{children}</div>;
const SousTitre = ({ children, haut }) => <p class={`rg-sous-titre ${haut ? 'haut' : ''}`}>{children}</p>;

function Choix({ ouverte, fermer, titre, options, valeur, choisir, hint, sous, garder, pied, children }) {
  return <Feuille ouverte={ouverte} fermer={fermer} titre={titre} sous={sous} pied={pied}>
    <div class="options" role="radiogroup" aria-label={titre}>{options.map(([v, l, ic, detail]) => <button type="button" role="radio" aria-checked={v === valeur} key={String(v)} class={`option ${v === valeur ? 'choisie' : ''}`}
      onClick={() => { if (v !== valeur) choisir(v); if (!garder) fermer(); }}>{ic && (typeof ic === 'string' ? <Ic n={ic} taille={18} /> : ic)}<span><strong>{l}</strong>{detail && <small>{detail}</small>}</span>{v === valeur && <Ic n="check-circle:fill" taille={18} classe="option-coche" />}</button>)}</div>
    {hint && <p class="rg-choix-aide">{hint}</p>}
    {children}
  </Feuille>;
}

// Esquisse de l'accueil : reprend _HomeSketch de GymMane, les blocs apparaissent selon les cartes activées.
function EsquisseAccueil({ focus, semaine, programmes, suggestions }) {
  const Bloc = ({ visible, children }) => <div class={`rg-esq-bloc ${visible ? 'on' : ''}`}><div>{children}</div></div>;
  return <div class="rg-esquisse" aria-hidden="true">
    <div class="rg-esq-in">
      <span class="rg-barre" style="width:40px;height:5px;background:var(--soft)" />
      <Bloc visible={focus}><div class="rg-esq-box focus"><span class="rg-barre" style="width:46px;height:6px;background:color-mix(in srgb,var(--text) 70%,transparent)" /><span class="rg-barre" style="width:30px;height:4px;background:var(--soft);margin-top:5px" /><span class="rg-barre" style="width:100%;height:11px;background:var(--text);margin-top:auto" /></div></Bloc>
      <Bloc visible><div class="rg-esq-box" style="height:26px;flex-direction:row;align-items:center;justify-content:space-between">{[0, 1, 2, 3, 4, 5, 6].map((i) => <span key={i} class="rg-point" style={`background:${i > 2 && i < 6 ? 'var(--text)' : 'var(--raised2)'}`} />)}</div></Bloc>
      <Bloc visible={semaine}><div class="rg-esq-box" style="height:28px;flex-direction:row;align-items:center;gap:7px">{[18, 12, 10].map((w) => <span key={w} class="rg-barre" style={`width:${w}px;height:6px;background:color-mix(in srgb,var(--text) 60%,transparent)`} />)}<span style="margin-left:auto;width:12px;height:12px;border-radius:50%;border:2px solid var(--accent)" /></div></Bloc>
      <Bloc visible={programmes}><div style="display:flex;gap:6px">{['#8FB4DE', '#DE9FB4'].map((c) => <div key={c} class="rg-esq-box" style="flex:1;height:34px;padding:5px 5px 0"><span class="rg-barre" style={`width:100%;height:7px;background:${c};opacity:.75`} /></div>)}</div></Bloc>
      <Bloc visible><div class="rg-esq-box" style="height:40px;justify-content:center;gap:3px">{[0, 1, 2].map((rr) => <div key={rr} style="display:flex;justify-content:space-between">{[0, 1, 2, 3, 4, 5, 6, 7, 8].map((c) => <span key={c} style={`width:7px;height:6px;border-radius:1.5px;background:${(rr + c) % 3 === 0 ? `color-mix(in srgb,var(--accent) ${Math.round((0.4 + c * 0.06) * 100)}%,transparent)` : 'var(--raised2)'}`} />)}</div>)}</div></Bloc>
      <Bloc visible={suggestions}><div style="display:flex;gap:5px">{[0, 1, 2].map((i) => <div key={i} class="rg-esq-box" style="flex:1;height:30px" />)}</div></Bloc>
    </div>
    <div class="rg-esq-fondu" />
  </div>;
}

const lireId = () => (location.hash.replace(/^#\/?/, '').split('?')[0].split('/')[1]) || null;

export function Reglages() {
  const x = textes[langue];
  const R = textesR[langue];
  const L = R.l;
  const p = etat.value.profil;
  const ext = p.extensions && typeof p.extensions === 'object' ? p.extensions : {};
  const pref = ext.preferences && typeof ext.preferences === 'object' ? ext.preferences : {};
  const [idPage, setIdPage] = useState(() => lireId());
  useEffect(() => {
    const f = () => setIdPage(lireId());
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);

  const [feuille, setFeuille] = useState(null);
  const [prenom, setPrenom] = useState(p.prenom);
  const [mdp, setMdp] = useState({ actuel: '', nouveau: '', erreur: '' });
  const [suppr, setSuppr] = useState({ ouvert: false, mdp: '', erreur: '' });
  const [recherche, setRecherche] = useState('');
  const [focus, setFocus] = useState(false);
  const [loc, setLoc] = useState(lireM13);
  const [confirmEffacer, setConfirmEffacer] = useState(false);
  const [confirmTout, setConfirmTout] = useState(false);
  const [confirmZip, setConfirmZip] = useState(null);
  const champRecherche = useRef(null);
  const fichierZip = useRef(null);

  const ab = p.abonnement;
  const fr = langue === 'fr';

  const local = (k, def) => (loc[k] !== undefined ? loc[k] : def);
  const poser = (k, v) => { const n = { ...lireM13(), [k]: v }; setLoc(n); ecrireM13(n); poserAffichage(); };
  const poserPlusieurs = (m) => { const n = { ...lireM13(), ...m }; setLoc(n); ecrireM13(n); poserAffichage(); };

  const appliquerProfilLocal = (maj) => {
    const prev = etat.value.profil;
    etat.value = { ...etat.value, profil: { ...prev, ...maj, extensions: maj.extensions !== undefined ? maj.extensions : prev.extensions } };
  };

  const sauver = async (champs) => {
    const v = {
      prenom: p.prenom, langue: p.langue, unite: p.unite, theme: p.theme, repos_s: p.repos_s, objectif_semaine: p.objectif_semaine, ...champs,
    };
    try {
      await api('PUT', '/api/reglages', v);
      appliquerProfilLocal({ ...v });
      if (champs.langue) choisirLangue(champs.langue);
      if (champs.theme) appliquerTheme(champs.theme);
      afficher(t.reglages.enregistre);
    } catch { afficher(t.commun.erreur, 'danger'); }
  };

  const sauverPref = async (patchPrefs) => {
    const actExt = etat.value.profil.extensions && typeof etat.value.profil.extensions === 'object' ? etat.value.profil.extensions : {};
    const prefs = { ...(actExt.preferences && typeof actExt.preferences === 'object' ? actExt.preferences : {}), ...patchPrefs };
    const fusion = { ...actExt, preferences: prefs };
    const v = { prenom: p.prenom, langue: p.langue, unite: p.unite, theme: p.theme, repos_s: p.repos_s, objectif_semaine: p.objectif_semaine, extensions: fusion };
    try {
      await api('PUT', '/api/reglages', v);
      appliquerProfilLocal(v);
      appliquerTheme(etat.value.profil.theme); appliquerPrefs();
      afficher(t.reglages.enregistre);
    } catch { afficher(t.commun.erreur, 'danger'); }
  };

  const portail = async () => {
    try { location.assign((await api('POST', '/api/portail')).url); } catch { afficher(t.commun.erreur, 'danger'); }
  };

  const seances = etat.value.seances;
  const statutAbo = ab.statut === 'actif' && ab.resiliation_prevue && ab.fin_periode ? t.reglages.finLe(dateComplete(ab.fin_periode))
    : ab.statut === 'actif' && ab.fin_periode ? t.reglages.prochain(dateComplete(ab.fin_periode))
      : ab.offert_jusqu ? t.reglages.offert(dateComplete(ab.offert_jusqu)) : t.reglages.statut[ab.statut] ?? '';

  // Son importé (alarm_store.dart) : média du compte, nom affiché, rangé dans extensions.modules.reglages.alarmePerso.
  const alarmePerso = local('alarmePerso', null)?.id ? local('alarmePerso', null) : null;
  const sonRepos = pref.sonRepos === 'perso' && alarmePerso ? 'perso' : pref.sonRepos && TYPES_SON_REPOS.includes(pref.sonRepos) ? pref.sonRepos : 'bip';
  const fichierSon = useRef(null);
  const fichierFond = useRef(null);
  // _prettyName : sans dossier ni extension, 28 caractères au plus.
  const joliNom = (n) => { const b = String(n).split(/[\\/]/).pop(); const i = b.lastIndexOf('.'); const s = i > 0 ? b.slice(0, i) : b; return s.length > 28 ? `${s.slice(0, 27)}…` : s; };
  const choisirSon = async (f) => {
    if (fichierSon.current) fichierSon.current.value = '';
    if (!f) return;
    let octets;
    try { octets = await f.arrayBuffer(); const tampon = await decoderSon(octets); if (tampon.duration > DUREE_MAX_SON + 0.05) { afficher(L.alarmeTropLong, 'danger'); return; } }
    catch { afficher(L.alarmeInvalide, 'danger'); return; }
    if (f.size > 3 * 1024 * 1024) { afficher(L.alarmeInvalide, 'danger'); return; }
    try {
      const { importerSon, supprimerImages } = await import('./photos.jsx');
      const id = await importerSon(f);
      const ancien = alarmePerso?.id;
      const nom = joliNom(f.name || 'Son');
      poser('alarmePerso', { id, nom });
      definirSonPerso(id, octets);
      await sauverPref({ sonRepos: 'perso' });
      afficher(L.alarmeChange(nom));
      if (ancien && ancien !== id) supprimerImages([ancien]);
    } catch { afficher(L.alarmeInvalide, 'danger'); }
  };
  const retablirSon = async () => {
    const ancien = alarmePerso?.id;
    poser('alarmePerso', null);
    await sauverPref({ sonRepos: 'bip' });
    afficher(L.alarmeRetabli);
    if (ancien) (await import('./photos.jsx')).supprimerImages([ancien]);
  };
  // Fond « Votre photo » (setBgPhoto / clearBgPhoto) : redimensionnée ici, rangée comme les autres photos du compte.
  const fondPhoto = local('fondPhoto', null);
  const dim = Number(local('fondAssombri', 0.55)) || 0.55;
  const choisirFond = async (f) => {
    if (fichierFond.current) fichierFond.current.value = '';
    if (!f) return;
    try {
      const [{ importerImage, supprimerImages }, { redimensionner }] = await Promise.all([import('./photos.jsx'), import('./profil.jsx')]);
      const id = await importerImage(await redimensionner(f, 1440, 2560, 0.85));
      poserPlusieurs({ fondPhoto: id, fond: 'photo' });
      if (fondPhoto && fondPhoto !== id) supprimerImages([fondPhoto]);
    } catch (e) { (await import('./photos.jsx')).signale(e); }
  };
  const retirerFond = async () => {
    const ancien = fondPhoto;
    poserPlusieurs({ fondPhoto: null, fond: local('fond', 'points') === 'photo' ? 'points' : local('fond', 'points') });
    if (ancien) (await import('./photos.jsx')).supprimerImages([ancien]);
  };
  const reduireAnim = !!pref.reduireAnimations;
  const flouActif = local('flou', true) !== false;
  const flouFin = flouActif && local('flouFin', false) === true;
  // Niveau déduit des réglages fins, comme perfLevel de GymMane (pas de fréquence d'écran sur le web).
  const niveauPerf = !flouActif && reduireAnim ? 'leger' : flouActif && !flouFin && !reduireAnim ? 'equilibre' : flouFin && !reduireAnim ? 'maximum' : 'perso';
  const modeEffort = pref.modeEffort && pref.modeEffort !== 'aucun' ? pref.modeEffort : 'aucun';
  const modeSauv = local('sauvegardeAutoMode', 'off');

  useEffect(() => { if (idPage === 'donnees') lancerSauvegardeAuto(); }, [idPage]);

  const unite = p.unite;
  // deloadWeekIndex / weeksToDeload de settings_state.dart : semaines comptées depuis le lundi du choix.
  const sousDecharge = () => {
    const n = Number(String(local('decharge', 'aucune')).slice(1)) || 0;
    const depuis = local('dechargeDepuis', null);
    if (!n || !depuis) return L.deloadRow;
    const d = new Date(`${depuis}T00:00:00`); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const auj = new Date(); auj.setHours(0, 0, 0, 0);
    const i = Math.floor(Math.round((auj - d) / 86400000) / 7);
    if (i < 0) return L.deloadRow;
    if (i % n === n - 1) return L.deloadNow;
    const reste = (n - 1 - (i % n)) % n;
    return L.deloadIn(reste);
  };
  const lib = (liste, v, def) => (liste.find((o) => o[0] === v) ?? liste.find((o) => o[0] === def) ?? liste[0])[1];
  const ouvrirReglage = (cle) => setFeuille(cle);

  // Listes d'options (valeur, libellé, icône, détail). Les valeurs stockées restent celles de la version précédente.
  const O = {
    theme: [['systeme', L.themeAuto, 'circle-half'], ['sombre', L.themeSombre, 'moon'], ['amoled', L.themeAmoled, 'moon-stars'], ['clair', L.themeClair, 'sun']],
    debutSemaine: [0, 5, 6].map((i) => [i, x.general.jours[i], 'calendar-blank']), // SettingsState.weekStarts : lundi, samedi, dimanche
    chaleur: [['semaines', L.chaleurSem, 'squares-four'], ['annee', L.chaleurAn, 'calendar-dots']],
    fond: [['aucun', L.fondAucun, 'square'], ['points', L.fondPoints, 'dots-nine'], ['grille', L.fondGrille, 'grid-four'],
      ...(fondPhoto ? [['photo', L.fondPhoto, <img class="rg-fond-mini" src={`/api/media/${fondPhoto}`} alt="" decoding="async" />]] : [])],
    performance: [['leger', L.perfLeger, 'leaf', L.perfLegerD], ['equilibre', L.perfEquilibre, 'scales', L.perfEquilibreD], ['maximum', L.perfMax, 'lightning', L.perfMaxSansHz]],
    taille: [['petit', L.petit, 'text-aa'], ['normal', L.normal, 'text-aa'], ['grand', L.grand, 'text-aa']],
    effort: [['aucun', L.desactive, 'prohibit'], ['rpe', 'RPE', 'gauge'], ['rir', 'RIR', 'arrow-counter-clockwise']],
    pasPoids: (unite === 'lb' ? [1, 2.5, 5, 10] : [0.5, 1, 1.25, 2, 2.5, 5]).map((v) => [v, `${v} ${unite}`, 'barbell']),
    progression: Object.entries(x.entrainement.progressions).map(([v, l]) => [v, l, v === 'aucune' ? 'prohibit' : v === 'charge' ? 'barbell' : 'repeat']),
    decharge: Object.entries(x.entrainement.decharges).map(([v, l]) => [v, l, v === 'aucune' ? 'prohibit' : 'calendar-blank']),
    disposition: [['cartes', L.cartes, 'cards'], ['liste', L.liste, 'list-bullets']],
    tailleDemo: [['grande', L.grande, 'rectangle'], ['petite', L.petite, 'square'], ['aucune', L.masquee, 'eye-slash']],
    boucle: [['toujours', L.enBoucle, 'repeat'], ['courte', L.dixSec, 'timer']],
    rappel: Object.entries(x.alertes.rappels).map(([v, l]) => [v, l, v === 'aucune' ? 'prohibit' : 'bell-simple']),
    styleAlarme: [['fort', L.fort, 'bell-ringing'], ['discret', L.discret, 'bell-simple-slash'], ['vibration', L.vibration, 'vibrate']],
    alarme: [...TYPES_SON_REPOS.map((ty) => [ty, t.reglages.sons[ty] ?? ty, ty === 'muet' ? 'speaker-slash' : 'music-note']), ...(alarmePerso ? [['perso', alarmePerso.nom, 'music-notes']] : [])],
    sauvegarde: Object.entries(L.modeSauv).map(([v, l]) => [v, l, v === 'off' ? 'prohibit' : 'clock-counter-clockwise']),
  };
  const choixLocal = (cle, def) => (v) => poser(cle, v);
  const nomSon = sonRepos === 'bip' ? L.alarmeDefaut : lib(O.alarme, sonRepos);

  const miniRepos = local('miniRepos', 20);
  const editerPlage = async (cle, titre, mini, maxi, pas, valeur) => {
    const v = await demanderRegle({ titre, valeur, min: mini, max: maxi, pas, majeur: 6, format: (n) => (n ? minSec(Math.round(n)) : L.desactive), etiquette: (n) => minSec(Math.round(n)) });
    if (v == null) return;
    if (cle === 'repos_s') sauver({ repos_s: Math.round(v) }); else poser(cle, Math.round(v));
  };
  const reposS = p.repos_s ?? 0;
  const bornes = (v, a, b) => Math.max(a, Math.min(b, v));

  const rassembler = async (liste, chemin) => {
    for (const el of liste) await api('DELETE', `${chemin}/${el.id ?? el.jour}`);
  };

  const importerZip = async (fichier) => {
    if (!fichier) return;
    try {
      const octets = new Uint8Array(await fichier.arrayBuffer());
      await restaurerSauvegarde(octets, api, {});
      await charger();
      afficher(t.commun.ok ?? t.reglages.enregistre);
    } catch { afficher(t.commun.erreur, 'danger'); }
    setConfirmZip(null);
  };

  const pastilleBeta = <span class="m13-pastille beta">{L.beta}</span>;

  // Catégories : chaque ligne a son libellé (pour la recherche), son icône et son rendu.
  const accueilLocal = (cle) => local(cle, true);
  const cats = [
    {
      id: 'compte', n: 'user-circle', groupe: 'compte', titre: R.cats.compte,
      corps: () => <>
        <Carte>
          <Ligne n="user" label={L.prenom} valeur={p.prenom} onClick={() => { setPrenom(p.prenom); setFeuille('prenom'); }} />
          <Statique n="envelope" label={L.email} sous={p.email} />
          <Ligne n="lock" label={L.mdp} onClick={() => { setMdp({ actuel: '', nouveau: '', erreur: '' }); setFeuille('mdp'); }} />
          <Statique n="credit-card" label={ab.formule ? t.reglages.formule[ab.formule] : L.abonnement} sous={statutAbo}>
            <span class={`badge ${ab.statut === 'actif' ? 'ok' : ab.statut === 'en_retard' ? 'alerte' : ''}`}>{p.role === 'admin' ? t.reglages.admin : t.reglages.statut[ab.statut]}</span>
          </Statique>
          {ab.gerable && <Ligne n="receipt" label={t.reglages.gerer} onClick={portail} />}
        </Carte>
        <div class="rg-espace" />
        <Carte>
          <form method="post" action="/deconnexion/" class="form-ligne"><input type="hidden" name="_csrf" value={etat.value.csrf} />
            <button type="submit" class="ligne-reglage" data-rg={L.deconnexion}><span class="pastille-ic" aria-hidden="true"><Ic n="sign-out" taille={17} /></span><span class="rg-texte"><span class="rg-libelle">{L.deconnexion}</span></span></button></form>
          {p.role !== 'admin' && <Ligne n="trash" label={t.reglages.supprimerCompte} danger onClick={() => setSuppr({ ouvert: true, mdp: '', erreur: '' })} />}
        </Carte>
      </>,
      lignes: [[L.prenom, 'user'], [L.email, 'envelope'], [L.mdp, 'lock'], [L.abonnement, 'credit-card'], [L.deconnexion, 'sign-out'], [t.reglages.supprimerCompte, 'trash']],
    },
    {
      id: 'general', n: 'sliders-horizontal', groupe: 'app', titre: R.cats.general,
      corps: () => <><Carte>
        <Ligne n="moon" label={L.theme} valeur={lib(O.theme, p.theme)} onClick={() => ouvrirReglage('theme')} />
        <Ligne n="translate" label={L.langue} valeur={<span class="avec-drapeau"><Drapeau langue={p.langue} />{p.langue === 'en' ? 'English' : 'Français'}</span>} onClick={() => ouvrirReglage('langue')} />
        <Statique n="scales" label={L.unites}><Segment label={L.unites} valeur={p.unite} options={[['kg', 'kg'], ['lb', 'lb']]} onChange={(u) => sauver({ unite: u })} /></Statique>
        <Ligne n="calendar-blank" label={L.debutSemaine} valeur={x.general.jours[local('debutSemaine', 0)]} onClick={() => ouvrirReglage('debutSemaine')} />
        <Ligne n="calendar-dots" label={L.chaleur} valeur={lib(O.chaleur, local('porteeChaleur', 'semaines'))} onClick={() => ouvrirReglage('chaleur')} />
        <Bascule n="grid-nine" label={L.etiquettes} actif={local('etiquettesChaleur', true)} onChange={(v) => poser('etiquettesChaleur', v)} />
        <Ligne n="image" label={L.fond} valeur={lib(O.fond, local('fond', 'points'))} onClick={() => ouvrirReglage('fond')} />
        <Ligne n="lightning" label={L.performance} valeur={niveauPerf === 'perso' ? L.perfPerso : lib(O.performance, niveauPerf)} onClick={() => ouvrirReglage('performance')} />
        <Ligne n="text-aa" label={L.tailleTexte} valeur={lib(O.taille, local('tailleTexte', 'normal'))} onClick={() => ouvrirReglage('taille')} />
      </Carte><VitrineApparence /></>,
      lignes: [[L.theme, 'moon'], [L.langue, 'translate'], [L.unites, 'scales'], [L.debutSemaine, 'calendar-blank'], [L.chaleur, 'calendar-dots'], [L.etiquettes, 'grid-nine'], [L.fond, 'image'], [L.performance, 'lightning'], [L.tailleTexte, 'text-aa']],
    },
    {
      id: 'entrainement', n: 'barbell', groupe: 'app', titre: R.cats.entrainement,
      corps: () => <>
        <SousTitre haut={false}>{R.subs.repos}</SousTitre>
        <Carte>
          <Statique n="timer" label={L.repos} sous={L.reposHint}>
            <Pas label={L.repos} valeur={reposS ? minSec(reposS) : L.desactive} moins={() => sauver({ repos_s: bornes(reposS - 15, 0, 600) })} plus={() => sauver({ repos_s: bornes(reposS + 15, 0, 600) })}
              edition={() => editerPlage('repos_s', L.repos, 0, 600, 5, reposS)} />
          </Statique>
          <Statique n="timer" label={L.miniRepos} sous={L.miniReposHint}>
            <Pas label={L.miniRepos} valeur={miniRepos ? minSec(miniRepos) : L.desactive} moins={() => poser('miniRepos', bornes(miniRepos - 5, 0, 180))} plus={() => poser('miniRepos', bornes(miniRepos + 5, 0, 180))}
              edition={() => editerPlage('miniRepos', L.miniRepos, 0, 180, 5, miniRepos)} />
          </Statique>
        </Carte>
        <SousTitre>{R.subs.pendant}</SousTitre>
        <Carte>
          <Ligne n="gauge" label={L.effort} sous={L.effortRow} valeur={lib(O.effort, modeEffort)} onClick={() => ouvrirReglage('effort')} />
          <Ligne n="barbell" label={L.pasPoids} sous={L.pasPoidsHint} valeur={`${local('pasPoids', 2.5)} ${unite}`} onClick={() => ouvrirReglage('pasPoids')} />
          <Ligne n="trend-up" label={L.progression} sous={L.progressionRow} valeur={lib(O.progression, local('progression', 'aucune'))} onClick={() => ouvrirReglage('progression')} />
          <Ligne n="feather" label={L.deload} sous={sousDecharge()} valeur={lib(O.decharge, local('decharge', 'aucune'))} onClick={() => ouvrirReglage('decharge')} />
          <Bascule n="skip-forward" label={L.avanceAuto} sous={L.avanceAutoHint} actif={!!pref.avanceAutoApresCoche} onChange={(v) => sauverPref({ avanceAutoApresCoche: v })} />
          <Bascule n="timer" label={L.decompte} sous={L.decompteHint} actif={!!pref.decompteAvantSeance} onChange={(v) => sauverPref({ decompteAvantSeance: v })} />
          <Bascule n="sun" label={L.ecranAllume} sous={L.ecranAllumeHint} actif={local('ecranAllume', true) !== false} onChange={(v) => poser('ecranAllume', v)} />
          <Bascule n="moon" label={L.checkIn} sous={L.checkInHint} actif={local('checkIn', true)} onChange={(v) => poser('checkIn', v)} />
          <Bascule n="equalizer" label={L.reglageMuscu} sous={L.reglageMuscuHint} actif={local('reglageMusculaire', true)} onChange={(v) => poser('reglageMusculaire', v)} />
          <Bascule n="waveform" label={L.voix} sous={voixDisponible() ? L.voixHint : L.web} badge={pastilleBeta} actif={local('voixCoach', false) && voixDisponible()} onChange={(v) => { if (!voixDisponible()) { afficher(L.web); return; } poser('voixCoach', v); if (v) setFeuille('voix'); }} />
        </Carte>
        <SousTitre>{R.subs.programmes}</SousTitre>
        <Carte>
          <Bascule n="person" label={L.miniCarte} sous={L.miniCarteHint} actif={local('miniCarte', true)} onChange={(v) => poser('miniCarte', v)} />
          <Bascule n="stack" label={L.multiPlan} sous={L.multiPlanHint} actif={local('multiPlan', false)} onChange={(v) => poser('multiPlan', v)} />
          <Bascule n="stairs" label={L.conseils} sous={L.conseilsHint} actif={local('conseilsNiveau', true)} onChange={(v) => poser('conseilsNiveau', v)} />
        </Carte>
        <SousTitre>{R.subs.affichage}</SousTitre>
        <Carte>
          <Ligne n="rows" label={L.disposition} sous={L.dispositionRow} valeur={lib(O.disposition, local('disposition', 'cartes'))} onClick={() => ouvrirReglage('disposition')} />
          <Ligne n="film-strip" label={L.demo} sous={L.demoRow} valeur={lib(O.tailleDemo, local('tailleDemo', 'grande'))} onClick={() => ouvrirReglage('tailleDemo')} />
          {local('tailleDemo', 'grande') !== 'aucune' && <Ligne n="repeat" label={L.boucle} sous={L.boucleRow} valeur={lib(O.boucle, local('boucleDemo', 'toujours'))} onClick={() => ouvrirReglage('boucle')} />}
        </Carte>
        <div class="rg-espace" />
        <Carte><Ligne n="map-pin" label={L.lieux} href="#/lieux" /></Carte>
      </>,
      lignes: [[L.repos, 'timer'], [L.miniRepos, 'timer'], [L.effort, 'gauge'], [L.pasPoids, 'barbell'], [L.progression, 'trend-up'], [L.deload, 'feather'], [L.avanceAuto, 'skip-forward'], [L.decompte, 'timer'], [L.ecranAllume, 'sun'], [L.checkIn, 'moon'], [L.reglageMuscu, 'equalizer'], [L.voix, 'waveform'], [L.miniCarte, 'person'], [L.multiPlan, 'stack'], [L.conseils, 'stairs'], [L.disposition, 'rows'], [L.demo, 'film-strip'], [L.boucle, 'repeat'], [L.lieux, 'map-pin']],
    },
    {
      id: 'alertes', n: 'bell-simple', groupe: 'app', titre: R.cats.alertes,
      corps: () => <><Carte>
        <Ligne n="bell-simple" label={L.rappel} sous={L.rappelRow} valeur={lib(O.rappel, local('rappel', 'aucune'))} onClick={() => ouvrirReglage('rappel')} />
        {local('rappel', 'aucune') === 'fixe' && <Statique n="clock" label={L.heure}>
          <input class="form-input rg-heure" type="time" aria-label={L.heure} value={local('heureRappel', '18:00')} onInput={(e) => poser('heureRappel', e.target.value)} /></Statique>}
        <Ligne n="music-notes" label={L.sons} sous={L.sonsRow} valeur={x.commun.web} onClick={() => afficher(x.alertes.webSeulement)} />
        <Ligne n="speaker-high" label={L.alarme} sous={L.alarmeRow} valeur={nomSon} onClick={() => ouvrirReglage('alarme')} />
        <Ligne n="vibrate" label={L.styleAlarme} sous={L.styleRow} valeur={lib(O.styleAlarme, local('styleAlarme', 'discret'))} onClick={() => ouvrirReglage('styleAlarme')} />
        <Bascule n="bell-simple" label={L.toasts} sous={L.toastsHint} actif={local('sonToasts', true)} onChange={(v) => poser('sonToasts', v)} />
      </Carte><VitrineAlertes /></>,
      lignes: [[L.rappel, 'bell-simple'], [L.sons, 'music-notes'], [L.alarme, 'speaker-high'], [L.styleAlarme, 'vibrate'], [L.toasts, 'bell-simple']],
    },
    {
      id: 'accueil', n: 'house', groupe: 'accueil', titre: R.cats.accueil,
      corps: () => {
        const rows = [[L.carteAujourdhui, 'carteFocus'], [L.carteSemaine, 'carteSemaine'], [L.carteProgrammes, 'carteProgrammes'], [L.carteSuggestions, 'carteSuggestions']];
        return <>
          <div class="rg-panneau" data-rg={L.panneau}>
            <h2>{L.panneau}</h2>
            <div class="rg-panneau-corps">
              <div class="rg-panneau-liste">{rows.map(([l, cle]) => {
                const on = accueilLocal(cle);
                return <button type="button" key={cle} class={`rg-puce ${on ? 'on' : ''}`} onClick={() => poser(cle, !on)} role="switch" aria-checked={on}><span>{l}</span><span class={`inter ${on ? 'on' : ''}`} aria-hidden="true"><span /></span></button>;
              })}</div>
              <EsquisseAccueil focus={accueilLocal('carteFocus')} semaine={accueilLocal('carteSemaine')} programmes={accueilLocal('carteProgrammes')} suggestions={accueilLocal('carteSuggestions')} />
            </div>
          </div>
          <p class="rg-panneau-aide">{L.panneauHint}</p>
          <div class="rg-espace" />
          <Carte>
            <Bascule n="target" label={L.objectifJour} actif={accueilLocal('carteFocus')} onChange={(v) => poser('carteFocus', v)} />
            <Bascule n="sparkle" label={L.recoAccueil} actif={accueilLocal('carteSuggestions')} onChange={(v) => poser('carteSuggestions', v)} />
            <Bascule n="folders" label={L.progAccueil} actif={accueilLocal('carteProgrammes')} onChange={(v) => poser('carteProgrammes', v)} />
            <Bascule n="chart-bar" label={L.semaineAccueil} actif={accueilLocal('carteSemaine')} onChange={(v) => poser('carteSemaine', v)} />
            <Ligne n="heartbeat" label={L.sante} sous={L.santeHint} valeur={L.web} onClick={() => setFeuille('sante')} />
            <Bascule n="medal" label={L.gamification} sous={L.gamificationHint} actif={local('gamification', true)} onChange={(v) => poser('gamification', v)} />
            <Bascule n="qr-code" label={L.passSalle} sous={L.passSalleHint} actif={local('passOn', true)} onChange={(v) => poser('passOn', v)} />
          </Carte>
          <p class="rg-panneau-aide">{L.widgetsTexte}</p>
          <VitrineAccueil nomMembre={p.extensions?.profil?.nomAffiche || p.prenom} />
        </>;
      },
      lignes: [[L.objectifJour, 'target'], [L.recoAccueil, 'sparkle'], [L.progAccueil, 'folders'], [L.semaineAccueil, 'chart-bar'], [L.sante, 'footprints'], [L.gamification, 'medal'], [L.passSalle, 'qr-code'], ['Widgets', 'squares-four']],
    },
    {
      id: 'beta', n: 'flask', groupe: 'accueil', titre: R.cats.beta,
      corps: () => <>
        <Carte><Bascule n="fork-knife" label={L.nutrition} sous={L.nutritionHint} badge={pastilleBeta} actif={local('nutrition', true)} onChange={(v) => poser('nutrition', v)} /></Carte>
        <p class="rg-sous-titre grand">{R.l.nutAbout}</p>
        <div class="rg-apropos">
          {[['barbell', L.nutA], ['shield-check', L.nutB], ['device-mobile', L.nutC], ['flask', L.nutD]].map(([ic, [titre, texte]]) => <div class="rg-apropos-ligne" key={titre}>
            <span class="pastille-ic" aria-hidden="true"><Ic n={ic} taille={17} /></span>
            <div><strong>{titre}</strong><p>{texte}</p></div>
          </div>)}
        </div>
        <div class="rg-espace" />
        <Carte><Ligne n="github-logo" label={L.nutIdee} href="mailto:contact@anatoly.fr?subject=Proposer%20une%20id%C3%A9e%20nutrition" /></Carte>
      </>,
      lignes: [[L.nutrition, 'fork-knife'], [L.nutIdee, 'github-logo']],
    },
    {
      id: 'donnees', n: 'database', groupe: 'donnees', titre: R.cats.donnees,
      corps: () => <>
        <a class="rg-import" href="#/donnees" data-rg={L.importerApp}>
          <span class="pastille-ic grand" aria-hidden="true"><Ic n="arrow-square-in" taille={22} /></span>
          <span class="rg-texte"><span class="rg-libelle">{L.importerApp}</span><small>{L.importerSous}</small></span>
          <Ic n="caret-right" taille={15} classe="chevron" />
        </a>
        <div class="rg-espace petit" />
        <Carte>
          <Ligne n="file-csv" label={L.exportCsv} onClick={() => telecharger(new Blob([exportCsv(etat.value)], { type: 'text/csv' }), `anatoly-seances-${jourIso()}.csv`)} />
          <Ligne n="download-simple" label={L.exportJson} onClick={() => telecharger(new Blob([JSON.stringify({ profil: p, seances, programmes: etat.value.routines, exercices: etat.value.perso, poids: etat.value.poids, mesures: etat.value.mesures }, null, 2)], { type: 'application/json' }), `anatoly-donnees-${jourIso()}.json`)} />
          <Ligne n="file-text" label={L.rapport} onClick={() => setFeuille('rapport')} />
          <Ligne n="file-zip" label={L.exportZip} onClick={() => telecharger(creerSauvegardeZip(etat.value), `anatoly-sauvegarde-${jourIso()}.zip`)} />
          <Ligne n="download-simple" label={L.importZip} onClick={() => setConfirmZip('choisir')} />
          <Ligne n="clock-counter-clockwise" label={L.autoSauv} valeur={lib(O.sauvegarde, modeSauv)} onClick={() => ouvrirReglage('sauvegarde')} />
          <Ligne n="export" label={L.strava} onClick={() => setFeuille('strava')} />
          <Ligne n="barbell" label={L.effacerSeances} danger onClick={() => setConfirmEffacer(true)} />
          <Ligne n="trash" label={L.toutSupprimer} danger onClick={() => setConfirmTout(true)} />
        </Carte>
      </>,
      lignes: [[L.importerApp, 'arrow-square-in'], [L.exportCsv, 'file-csv'], [L.exportJson, 'download-simple'], [L.rapport, 'file-text'], [L.exportZip, 'file-zip'], [L.importZip, 'download-simple'], [L.autoSauv, 'clock-counter-clockwise'], [L.strava, 'export'], [L.effacerSeances, 'barbell'], [L.toutSupprimer, 'trash']],
    },
    {
      id: 'assistance', n: 'heart', groupe: 'donnees', titre: R.cats.assistance,
      corps: () => <>
        <Carte>
          <Ligne n="bug" label={L.bug} sous={L.bugHint} href="mailto:contact@anatoly.fr?subject=Signaler%20un%20bug" />
          <Ligne n="lightbulb" label={L.idee} sous={L.ideeHint} href="mailto:contact@anatoly.fr?subject=Proposer%20une%20fonctionnalit%C3%A9" />
          <Ligne n="github-logo" label={L.github} sous={L.githubHint} href={URL_DEPOT} />
        </Carte>
        <img class="rg-chat" src="/statique/img/support-cat.png" alt="" width="300" height="175" loading="lazy" />
        <h2 class="rg-merci">{L.remerciement}</h2>
        <p class="rg-merci-texte">{L.remerciementTexte}</p>
      </>,
      lignes: [[L.bug, 'bug'], [L.idee, 'lightbulb'], [L.github, 'github-logo']],
    },
    { id: 'apropos', n: 'info', groupe: 'donnees', titre: R.cats.apropos, href: '#/a-propos', lignes: [[R.cats.apropos, 'info']] },
  ];
  const groupes = ['app', 'accueil', 'donnees', 'compte'];

  const q = sansAccent(recherche.trim());
  const recherchant = !!q || focus;
  const resultats = q ? cats.flatMap((c) => c.lignes.filter(([l]) => sansAccent(l).includes(q) || sansAccent(c.titre).includes(q)).map(([l, ic]) => ({ c, l, ic }))) : [];
  const ouvrir = (c, ligne) => { enAttente.libelle = ligne; setFocus(false); location.hash = c.href ?? `#/reglages/${c.id}`; };

  // En-tête de l'accueil : le titre rétrécit et la pilule de recherche devient un rond au défilement (96 px).
  const refs = { barre: useRef(null), titre: useRef(null), pilule: useRef(null), contenu: useRef(null), loupe: useRef(null), voile: useRef(null), tete: useRef(null) };
  useEffect(() => {
    if (idPage) return undefined;
    const maj = () => {
      const { tete, titre, pilule, contenu, loupe, voile } = Object.fromEntries(Object.entries(refs).map(([k, v]) => [k, v.current]));
      if (!tete || !titre) return;
      const w = tete.clientWidth;
      const v = Math.max(0, Math.min(1, window.scrollY / 96));
      const pr = v < 0.5 ? 2 * v * v : 1 - ((-2 * v + 2) ** 2) / 2;
      const echelle = 1 - 0.44 * pr;
      titre.style.transform = `translate(${48 * pr}px, ${-45.4 * pr}px) scale(${echelle})`;
      titre.style.filter = `blur(${Math.sin(pr * Math.PI) * 5}px)`;
      const h = 52 - 16 * pr;
      pilule.style.transform = `translate(${(w - 76) * pr}px, ${-105.6 * pr}px)`;
      pilule.style.width = `${(w - 40) + (36 - (w - 40)) * pr}px`;
      pilule.style.height = `${h}px`;
      pilule.style.borderRadius = `${h / 2}px`;
      contenu.style.width = `${Math.min(w - 40, 520)}px`;
      contenu.style.opacity = Math.max(0, Math.min(1, 1 - pr / 0.6));
      contenu.style.pointerEvents = pr > 0.5 ? 'none' : '';
      loupe.style.opacity = Math.max(0, Math.min(1, (pr - 0.45) / 0.55));
      loupe.style.pointerEvents = pr > 0.45 ? 'auto' : 'none';
      voile.style.opacity = pr;
    };
    maj();
    addEventListener('scroll', maj, { passive: true });
    addEventListener('resize', maj);
    return () => { removeEventListener('scroll', maj); removeEventListener('resize', maj); };
  }, [idPage, recherchant]);

  // Arrivée sur une page depuis un résultat de recherche : la ligne se centre et s'allume.
  useEffect(() => {
    if (!idPage || !enAttente.libelle) return undefined;
    const libelle = enAttente.libelle;
    enAttente.libelle = null;
    const id = setTimeout(() => {
      const el = [...document.querySelectorAll('[data-rg]')].find((e) => e.dataset.rg === libelle);
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      el.classList.add('rg-eclat');
      setTimeout(() => el.classList.remove('rg-eclat'), 1400);
    }, 320);
    return () => clearTimeout(id);
  }, [idPage]);

  const feuilles = <>
    <Feuille ouverte={feuille === 'prenom'} fermer={() => setFeuille(null)} titre={L.prenom}>
      <form class="pile" onSubmit={(e) => { e.preventDefault(); if (prenom.trim()) { sauver({ prenom: prenom.trim() }); setFeuille(null); } }}>
        <label class="sr" for="r-prenom">{L.prenom}</label>
        <input id="r-prenom" class="form-input" maxLength={60} value={prenom} autoComplete="given-name" onInput={(e) => setPrenom(e.target.value)} required />
        <button class="btn pri large" type="submit">{t.commun.enregistrer}</button></form>
    </Feuille>
    <Choix ouverte={feuille === 'theme'} fermer={() => setFeuille(null)} titre={L.theme} valeur={p.theme} options={O.theme} choisir={(v) => sauver({ theme: v })} hint={L.themeHint} />
    <Choix ouverte={feuille === 'langue'} fermer={() => setFeuille(null)} titre={L.langue} valeur={p.langue}
      options={[['fr', <span class="avec-drapeau" lang="fr"><Drapeau langue="fr" />Français</span>], ['en', <span class="avec-drapeau" lang="en"><Drapeau langue="en" />English</span>]]} choisir={(v) => sauver({ langue: v })} />
    <Choix ouverte={feuille === 'debutSemaine'} fermer={() => setFeuille(null)} titre={L.debutSemaine} valeur={local('debutSemaine', 0)} options={O.debutSemaine} choisir={choixLocal('debutSemaine')} />
    <Choix ouverte={feuille === 'chaleur'} fermer={() => setFeuille(null)} titre={L.chaleur} valeur={local('porteeChaleur', 'semaines')} options={O.chaleur} choisir={choixLocal('porteeChaleur')} hint={L.chaleurHint} />
    <Choix ouverte={feuille === 'fond'} fermer={() => setFeuille(null)} titre={L.fond} valeur={fondPhoto ? local('fond', 'points') : (local('fond', 'points') === 'photo' ? 'points' : local('fond', 'points'))} options={O.fond} choisir={choixLocal('fond')} garder
      pied={<button type="button" class="btn pri large" onClick={() => setFeuille(null)}>{L.termine}</button>}>
      {fondPhoto && <>
        <p class="rg-fond-assombri">{L.fondAssombri}</p>
        <div class="rg-fond-seg"><Segment label={L.fondAssombri} valeur={dim < 0.5 ? 0.4 : dim < 0.65 ? 0.55 : 0.72} options={[[0.4, L.assombriLeger], [0.55, L.assombriMoyen], [0.72, L.assombriFort]]} onChange={(v) => poser('fondAssombri', v)} /></div>
      </>}
      <button type="button" class="rg-fantome" onClick={() => fichierFond.current?.click()}><Ic n="image" taille={18} />{fondPhoto ? L.fondPhotoChanger : L.fondPhotoChoisir}</button>
      {fondPhoto && <button type="button" class="rg-lien-accent" onClick={retirerFond}>{L.fondPhotoSupprimer}</button>}
      <p class="rg-fond-aide">{L.fondPhotoHint}</p>
      <input ref={fichierFond} type="file" accept="image/*" hidden onChange={(e) => choisirFond(e.target.files?.[0])} />
    </Choix>
    <Choix ouverte={feuille === 'performance'} fermer={() => setFeuille(null)} titre={L.performance} sous={L.perfSous} valeur={niveauPerf} options={O.performance} garder
      choisir={(v) => { poserPlusieurs({ flou: v !== 'leger', flouFin: v === 'maximum' }); if ((v === 'leger') !== reduireAnim) sauverPref({ reduireAnimations: v === 'leger' }); }}>
      <SousTitre>{L.reglageFin}</SousTitre>
      <div class="groupe rg-carte rg-carte-feuille">
        <Bascule n="drop" label={L.flou} sous={L.flouHint} actif={flouActif} onChange={(v) => poser('flou', v)} />
        {flouActif && <Bascule n="drop-half" label={L.flouFin} sous={L.flouFinHint} actif={flouFin} onChange={(v) => poser('flouFin', v)} />}
        <Bascule n="wave-sine" label={L.calme} sous={L.calmeHint} actif={reduireAnim} onChange={(v) => sauverPref({ reduireAnimations: v })} />
      </div>
    </Choix>
    <Choix ouverte={feuille === 'taille'} fermer={() => setFeuille(null)} titre={L.tailleTexte} valeur={local('tailleTexte', 'normal')} options={O.taille} hint={L.tailleHint} choisir={choixLocal('tailleTexte')} />
    <Choix ouverte={feuille === 'effort'} fermer={() => setFeuille(null)} titre={L.effort} valeur={modeEffort} options={O.effort} choisir={(v) => sauverPref({ modeEffort: v })} hint={L.effortHint} />
    <Choix ouverte={feuille === 'pasPoids'} fermer={() => setFeuille(null)} titre={L.pasPoids} valeur={local('pasPoids', 2.5)} options={O.pasPoids} choisir={choixLocal('pasPoids')} />
    <Choix ouverte={feuille === 'progression'} fermer={() => setFeuille(null)} titre={L.progression} valeur={local('progression', 'aucune')} options={O.progression} choisir={choixLocal('progression')} hint={L.progressionHint} />
    <Choix ouverte={feuille === 'decharge'} fermer={() => setFeuille(null)} titre={L.deload} valeur={local('decharge', 'aucune')} options={O.decharge} choisir={(v) => poserPlusieurs({ decharge: v, dechargeDepuis: v === 'aucune' ? null : new Date().toISOString().slice(0, 10) })} hint={L.deloadHint} />
    <Choix ouverte={feuille === 'disposition'} fermer={() => setFeuille(null)} titre={L.disposition} valeur={local('disposition', 'cartes')} options={O.disposition} choisir={choixLocal('disposition')} hint={L.dispositionHint} />
    <Choix ouverte={feuille === 'tailleDemo'} fermer={() => setFeuille(null)} titre={L.demo} valeur={local('tailleDemo', 'grande')} options={O.tailleDemo} choisir={choixLocal('tailleDemo')} />
    <Choix ouverte={feuille === 'boucle'} fermer={() => setFeuille(null)} titre={L.boucle} valeur={local('boucleDemo', 'toujours')} options={O.boucle} choisir={choixLocal('boucleDemo')} hint={L.boucleHint} />
    <Choix ouverte={feuille === 'rappel'} fermer={() => setFeuille(null)} titre={L.rappel} valeur={local('rappel', 'aucune')} options={O.rappel} choisir={choixLocal('rappel')} />
    <Choix ouverte={feuille === 'styleAlarme'} fermer={() => setFeuille(null)} titre={L.styleAlarme} valeur={local('styleAlarme', 'discret')} options={O.styleAlarme} choisir={choixLocal('styleAlarme')} hint={L.styleHint} />
    <Choix ouverte={feuille === 'alarme'} fermer={() => setFeuille(null)} titre={L.alarme} sous={`${nomSon} · ${L.alarmeHint}`} garder
      valeur={sonRepos} options={[['__ecouter', L.alarmeEcouter, 'play'], ['__choisir', L.alarmeChoisir, 'upload-simple'], ...O.alarme, ...(alarmePerso ? [['__retablir', L.alarmeRetablir, 'arrow-counter-clockwise']] : [])]}
      choisir={(v) => {
        if (v === '__ecouter') { apercuSonRepos(sonRepos); return; }
        if (v === '__choisir') { fichierSon.current?.click(); return; }
        if (v === '__retablir') { setFeuille(null); retablirSon(); return; }
        apercuSonRepos(v); sauverPref({ sonRepos: v });
      }}>
      <input ref={fichierSon} type="file" accept="audio/*,.mp3,.wav,.ogg,.oga,.opus,.m4a,.aac,.flac" hidden onChange={(e) => choisirSon(e.target.files?.[0])} />
    </Choix>

    <FeuilleSauvegarde ouverte={feuille === 'sauvegarde'} fermer={() => { setFeuille(null); setLoc(lireM13()); }} />
    <FeuilleVoix ouverte={feuille === 'voix'} fermer={() => setFeuille(null)} />
    <FeuilleRapport ouverte={feuille === 'rapport'} fermer={() => setFeuille(null)} />
    <FeuilleSante ouverte={feuille === 'sante'} fermer={() => setFeuille(null)} />
    <FeuilleStrava ouverte={feuille === 'strava'} fermer={() => setFeuille(null)} />


    <Feuille ouverte={feuille === 'mdp'} fermer={() => setFeuille(null)} titre={L.mdp}>
      <form class="pile" onSubmit={async (e) => {
        e.preventDefault();
        if (mdp.nouveau.length < 10) { setMdp({ ...mdp, erreur: t.reglages.mdpCourt }); return; }
        try { await api('POST', '/api/mot-de-passe', { actuel: mdp.actuel, nouveau: mdp.nouveau }); afficher(t.reglages.mdpChange); setFeuille(null); }
        catch (err) { setMdp({ ...mdp, erreur: err.message === 'mdp_faux' ? t.reglages.mdpFaux : err.message === 'mdp_court' ? t.reglages.mdpCourt : t.commun.erreur }); }
      }}>
        <input type="text" name="username" autoComplete="username" value={p.email} hidden readOnly />
        <div class="champ"><label class="label" for="mdp-a">{t.reglages.actuel}</label><input id="mdp-a" type="password" class="form-input" autoComplete="current-password" value={mdp.actuel} onInput={(e) => setMdp({ ...mdp, actuel: e.target.value, erreur: '' })} required /></div>
        <div class="champ"><label class="label" for="mdp-n">{t.reglages.nouveau}</label><input id="mdp-n" type="password" class="form-input" autoComplete="new-password" minLength={10} value={mdp.nouveau} onInput={(e) => setMdp({ ...mdp, nouveau: e.target.value, erreur: '' })} required aria-describedby="mdp-aide" />
          <p class="aide" id="mdp-aide">{t.reglages.mdpCourt}</p></div>
        {mdp.erreur && <p class="erreur-champ" role="alert">{mdp.erreur}</p>}
        <button class="btn pri large" type="submit">{t.commun.enregistrer}</button>
      </form>
    </Feuille>

    <Feuille ouverte={confirmZip === 'choisir'} fermer={() => setConfirmZip(null)} titre={L.importZip} sous={fr ? 'Les séances, programmes et mesures du fichier s\'ajoutent à votre compte.' : 'The workouts, routines and measurements in the file are added to your account.'}>
      <input ref={fichierZip} type="file" accept=".zip,application/zip" class="form-input" aria-label={L.importZip} onChange={(e) => importerZip(e.target.files?.[0])} />
    </Feuille>

    <Dialogue ouvert={confirmEffacer} fermer={() => setConfirmEffacer(false)} titre={x.donnees.effacerTitre} texte={x.donnees.effacerTexte} libelle={L.effacerSeances} danger
      confirmer={async () => {
        try {
          await rassembler(seances, '/api/seances');
          await charger(); afficher(t.commun.supprime); setConfirmEffacer(false);
        } catch { afficher(t.commun.erreur, 'danger'); }
      }} />

    <Dialogue ouvert={confirmTout} fermer={() => setConfirmTout(false)} titre={x.donnees.reinitialiserTitre} texte={x.donnees.reinitialiserTexte} libelle={L.toutSupprimer} danger
      confirmer={async () => {
        try {
          const e = etat.value;
          await rassembler(e.seances, '/api/seances'); await rassembler(e.routines, '/api/routines'); await rassembler(e.perso, '/api/exercices');
          await rassembler(e.poids, '/api/poids'); await rassembler(e.mesures, '/api/mesures');
          await charger(); afficher(t.commun.supprime); setConfirmTout(false);
        } catch { afficher(t.commun.erreur, 'danger'); }
      }} />

    <Dialogue ouvert={suppr.ouvert} fermer={() => setSuppr({ ouvert: false, mdp: '', erreur: '' })} titre={t.reglages.supprimerTitre} texte={t.reglages.supprimerTexte} libelle={t.reglages.supprimerOk} danger
      confirmer={async () => {
        try { await api('POST', '/api/supprimer-compte', { mdp: suppr.mdp }); location.assign(fr ? '/' : '/en/'); }
        catch (err) { setSuppr({ ...suppr, erreur: err.message === 'mdp_faux' ? t.reglages.mdpFaux : t.commun.erreur }); }
      }}>
      <div class="champ"><label class="label" for="sup-mdp">{t.reglages.confirmerMdp}</label>
        <input id="sup-mdp" type="password" class="form-input" autoComplete="current-password" value={suppr.mdp} onInput={(e) => setSuppr({ ...suppr, mdp: e.target.value, erreur: '' })} /></div>
      {suppr.erreur && <p class="erreur-champ" role="alert">{suppr.erreur}</p>}
    </Dialogue>
  </>;

  // ===== Page d'une catégorie =====
  const page = idPage && cats.find((c) => c.id === idPage && c.corps);
  if (page) {
    const mots = page.titre.split(' ');
    const largeur = Math.min(window.innerWidth, 430) - 40; // 430 = --col de app.css
    let taille = 42;
    while (taille > 28 && Math.max(...mots.map((m) => m.length)) * taille * 0.56 > largeur) taille -= 2;
    return <main class="ecran rg-ecran">
      <div class="rg-page-tete">
        <Rond n="chevron" label={R.retour} href="#/reglages" taille={40} />
        <div class="rg-page-titre"><p class="rg-etiquette">{R.eyebrow}</p><h1 style={`font-size:${taille}px`}>{page.titre}</h1></div>
      </div>
      <div class="rg-feuille"><span class="rg-poignee" aria-hidden="true" />
        <div class="rg-feuille-corps">{page.corps()}</div></div>
      {feuilles}
    </main>;
  }

  // ===== Accueil des paramètres =====
  return <main class="ecran avec-nav rg-accueil">
    <div class="rg-tete" ref={refs.tete}>
      <div class="rg-voile" ref={refs.voile} />
      <span class="rg-retour"><Rond n="chevron" label={R.retour} href="#/profil" taille={36} /></span>
      <h1 class="rg-titre" ref={refs.titre}>{R.titre}</h1>
      <div class={`rg-pilule ${focus ? 'actif' : ''}`} ref={refs.pilule}>
        <div class="rg-pilule-in" ref={refs.contenu}>
          <Ic n="magnifying-glass" taille={18} />
          <label class="sr" for="rg-rech">{R.recherche}</label>
          <input id="rg-rech" ref={champRecherche} type="text" enterkeyhint="search" value={recherche} placeholder={R.recherche} autoComplete="off" onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} onInput={(e) => setRecherche(e.target.value)} />
          <button type="button" class={`rg-effacer ${recherche ? 'on' : ''}`} aria-label={R.effacerRecherche} tabIndex={recherche ? 0 : -1} onMouseDown={(e) => e.preventDefault()} onClick={() => setRecherche('')}><Ic n="x-circle" taille={20} /></button>
        </div>
        <button type="button" class="rg-loupe" ref={refs.loupe} aria-label={R.recherche} onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(() => champRecherche.current?.focus(), 420); }}><Ic n="magnifying-glass" taille={16} /></button>
      </div>
    </div>

    {recherchant ? (!q ? <div class="rg-vide" />
      : !resultats.length ? <p class="rg-aucun">{R.aucun}</p>
        : <div class="rg-resultats">{resultats.map(({ c, l, ic }) => <button type="button" key={`${c.id}-${l}`} class="rg-resultat" onClick={() => ouvrir(c, l)}>
          <span class="rg-rond petit" aria-hidden="true"><Ic n={ic} taille={18} /></span>
          <span class="rg-texte"><strong>{l}</strong><small>{c.titre}</small></span></button>)}</div>)
      : groupes.map((g) => <section key={g} class="rg-groupe">
        <p class="rg-label">{R.groupes[g]}</p>
        {cats.filter((c) => c.groupe === g).map((c) => {
          const contenu = <><span class="rg-rond" aria-hidden="true"><Ic n={c.n} taille={19} /></span><span class="rg-bulle-titre">{c.titre}</span><Ic n="caret-right" taille={16} classe="chevron" /></>;
          return c.href ? <a key={c.id} class="rg-bulle" href={c.href}>{contenu}</a> : <a key={c.id} class="rg-bulle" href={`#/reglages/${c.id}`}>{contenu}</a>;
        })}
      </section>)}
    {feuilles}
  </main>;
}
