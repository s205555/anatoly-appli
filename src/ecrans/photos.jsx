// Photos libres (moments) : grille, groupement par date, sélection, visionneuse, ajout.
// Sert aussi de module partagé pour M08 : stockage local des photos et service média.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { afficher, api, dateComplete, ecrireModule, jourLocal, lireModule } from '../donnees.js';
import { langue, t } from '../i18n.js';
import { m08, POSES } from '../i18n/m08.js';
import { Dialogue, EnTete, Feuille, Ic, Rond } from '../ui.jsx';
import './m08.css';

const T = () => m08(langue);

// ===== Module partagé M08 =====
export const CLE_POSES = 'an_m08_poses'; // photos de progression, par pose
const CLE_PHOTOS = 'an_m08_photos'; // photos libres

export function lire(cle, def) {
  try {
    return JSON.parse(localStorage.getItem(cle) ?? 'null') ?? def;
  } catch {
    return def;
  }
}

export function ecrire(cle, valeur) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    /* stockage plein ou navigation privée : on garde en mémoire */
  }
}

// Photos libres sur le compte (extensions.modules.moments.liste) ; celles du navigateur sont reprises une fois.
export function lirePhotos() {
  const m = lireModule('moments');
  return Array.isArray(m?.liste) ? m.liste : lire(CLE_PHOTOS, []);
}
export function ecrirePhotos(liste) {
  ecrire(CLE_PHOTOS, liste);
  return ecrireModule('moments', { liste }).catch(() => {});
}

export const urlMedia = (id) => `/api/media/${id}`;
export const idJour = (d) => jourLocal(d ?? new Date());

export function joursEntre(a, b) {
  const [a1, a2, a3] = a.split('-').map(Number);
  const [b1, b2, b3] = b.split('-').map(Number);
  return Math.round((Date.UTC(b1, b2 - 1, b3) - Date.UTC(a1, a2 - 1, a3)) / 86400000);
}

let jeton = null;
// Envoie une image au service média de M01 (corps brut, JPEG ou PNG, 5 Mo).
export async function importerImage(fichier) {
  if (!fichier || !/^image\/(jpeg|png)$/.test(fichier.type) || fichier.size > 5 * 1024 * 1024) throw new Error('image');
  return envoyerMedia(fichier, fichier.type, 'image');
}

// Son d'alarme (3 Mo) : le serveur relit le type dans le fichier, le navigateur ne le connaît pas toujours.
export async function importerSon(fichier) {
  if (!fichier || fichier.size > 3 * 1024 * 1024) throw new Error('son');
  return envoyerMedia(fichier, fichier.type || 'application/octet-stream', 'son');
}

async function envoyerMedia(fichier, type, refus) {
  // shortcut: le jeton CSRF n'est pas exposé hors de donnees.js, on le relit avec /api/etat une seule fois.
  jeton ??= (await api('GET', '/api/etat')).csrf;
  const r = await fetch('/api/media', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': type, 'X-CSRF': jeton }, body: fichier });
  if (!r.ok) throw new Error(r.status === 413 || r.status === 400 ? refus : 'media');
  const { id } = await r.json();
  if (!id) throw new Error('media');
  return id;
}

// Efface côté serveur les images retirées ou remplacées (ids ou adresses /api/media/...). Silencieux : une image orpheline ne doit jamais gêner l'écran.
export async function supprimerImages(refs) {
  const ids = [...new Set((refs ?? []).map((r) => /([0-9a-f]{32})$/.exec(String(r ?? ''))?.[1]).filter(Boolean))];
  if (!ids.length) return;
  try {
    jeton ??= (await api('GET', '/api/etat')).csrf;
    await Promise.all(ids.map((id) => fetch(`/api/media/${id}`, { method: 'DELETE', credentials: 'same-origin', headers: { 'X-CSRF': jeton } }).catch(() => {})));
  } catch { /* hors ligne : tant pis */ }
}

export function signale(erreur) {
  const c = T().commun;
  const m = erreur?.message === 'image' ? c.imageRefusee : erreur?.message === 'media' ? c.mediaAbsent : c.erreur;
  afficher(m, 'danger');
}

// ===== Écran =====
const today = () => idJour();

export function Photos() {
  const [moments, setMoments] = useState(lirePhotos);
  const [groupe, setGroupe] = useState(false);
  const [picks, setPicks] = useState([]);
  const [voir, setVoir] = useState(null);
  const [source, setSource] = useState(false);
  const [suppr, setSuppr] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const camRef = useRef(null);
  const galerieRef = useRef(null);
  const txt = T().photos;

  const premier = useRef(true);
  useEffect(() => { if (premier.current) { premier.current = false; if (!Array.isArray(lireModule('moments')?.liste) && moments.length) ecrirePhotos(moments); return; } ecrirePhotos(moments); }, [moments]);

  // Plus récente d'abord ; le même jour, la dernière ajoutée d'abord (DateTime complet de l'original).
  const tri = useMemo(() => moments.map((m, i) => [m, i]).sort(([a, i], [b, j]) => (a.date === b.date ? (b.quand ?? j) > (a.quand ?? i) ? 1 : -1 : a.date < b.date ? 1 : -1)).map(([m]) => m), [moments]);
  const mois = useMemo(() => {
    const m = today().slice(0, 7);
    return tri.filter((x) => x.date.startsWith(m)).length;
  }, [tri]);
  const jours = useMemo(() => new Set(tri.map((x) => x.date)).size, [tri]);

  const ajouter = async (e) => {
    const fichiers = [...(e.target.files ?? [])];
    e.target.value = '';
    if (!fichiers.length) return;
    setOccupe(true);
    try {
      const ajouts = [];
      const { redimensionner } = await import('./profil.jsx');
      for (const f of fichiers) ajouts.push({ id: await importerImage(await redimensionner(f, 1440, 1920, 0.88)), date: today(), quand: Date.now() });
      setMoments((m) => [...m, ...ajouts]);
    } catch (err) {
      signale(err);
    } finally {
      setOccupe(false);
    }
  };

  const supprimer = async () => {
    const ids = new Set(picks);
    supprimerImages([...ids]);
    setMoments((m) => m.filter((x) => !ids.has(x.id)));
    setPicks([]);
    setSuppr(false);
  };

  const basculer = (id) => setPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toucher = (m) => { if (appui.current?.long) { appui.current = null; return; } if (picks.length) basculer(m.id); else setVoir(m); };
  // Appui long (selectionClick) : entre en sélection ; clic droit fait de même sur ordinateur.
  const appui = useRef(null);
  const appuiDebut = (m) => { clearTimeout(appui.current?.t); appui.current = { t: setTimeout(() => { appui.current = { long: true }; navigator.vibrate?.(10); basculer(m.id); }, 450) }; };
  const appuiFin = () => { if (appui.current && !appui.current.long) { clearTimeout(appui.current.t); appui.current = null; } };

  const groupes = useMemo(() => {
    if (!groupe) return null;
    const par = new Map();
    const auj = today();
    for (const m of tri) {
      const d = joursEntre(m.date, auj);
      const dt = new Date(`${m.date}T12:00:00`);
      const nom = t.mois[dt.getMonth()] ?? '';
      const mot = `${nom.charAt(0).toUpperCase()}${nom.slice(1)}`;
      const cle = d <= 0 ? txt.aujourdhui : d < 7 ? txt.cetteSemaine : dt.getFullYear() === new Date().getFullYear() ? mot : `${mot} ${dt.getFullYear()}`;
      if (!par.has(cle)) par.set(cle, []);
      par.get(cle).push(m);
    }
    return [...par];
  }, [groupe, tri]);

  const tuile = (m, carre) => (
    <button type="button" key={m.id} class={`m08-tuile ${carre ? 'carree' : ''} ${picks.includes(m.id) ? 'choisie' : ''}`}
      aria-pressed={picks.length ? picks.includes(m.id) : undefined} aria-label={picks.length ? txt.selectionner : txt.voir} onClick={() => toucher(m)}
      onPointerDown={() => appuiDebut(m)} onPointerUp={appuiFin} onPointerLeave={appuiFin} onPointerCancel={appuiFin}
      onContextMenu={(e) => { e.preventDefault(); if (!picks.includes(m.id)) basculer(m.id); }}>
      <img src={urlMedia(m.id)} alt="" loading="lazy" />
      {!carre && <span class="m08-tuile-date">{dateCourteJour(m.date)}</span>}
      {picks.length > 0 && <span class="m08-coche" aria-hidden="true">{picks.includes(m.id) && <Ic n="check:bold" taille={12} />}</span>}
    </button>
  );

  // backFromMoments : la sélection se vide d'abord, sinon retour au profil.
  return <main class="ecran ecran-borne m08 m08-moments">
    <EnTete titre={txt.titre} sous={picks.length ? txt.selectionnee(picks.length) : txt.profil} retour="#/profil" onRetour={picks.length ? () => setPicks([]) : null} actions={<>
      {picks.length > 0
        ? <Rond n="trash" label={txt.supprimer} onClick={() => setSuppr(true)} taille={44} icone={17} />
        : <>{tri.length > 0 && <Rond n={groupe ? 'squares-four' : 'rows'} label={txt.vosPhotos} onClick={() => setGroupe((g) => !g)} taille={44} icone={17} />}<Rond n="camera" label={txt.ajouter} onClick={() => setSource(true)} taille={44} icone={17} /></>}
    </>} />

    {tri.length === 0
      ? <div class="m08-vide"><Ic n="camera" taille={34} /><h2>{txt.aucuneTitre}</h2><p>{txt.aucuneTexte}</p>
        <button type="button" class="m08-fantome" onClick={() => setSource(true)}><Ic n="camera" taille={16} />{txt.ajouter}</button></div>
      : <>
        <section class="m08-stats carte">
          <div><strong>{tri.length}</strong><small>{txt.vosPhotos}</small></div>
          <div><strong>{mois}</strong><small>{txt.ceMois}</small></div>
          <div><strong>{jours}</strong><small>{txt.jours}</small></div>
        </section>

        {groupe
          ? groupes.map(([titre, liste]) => <section key={titre} class="m08-groupe">
            <h2 class="m08-groupe-titre">{titre}</h2>
            <div class="m08-grille carres">{liste.map((m) => tuile(m, true))}</div>
          </section>)
          : <div class="m08-grille">{tri.map((m) => tuile(m, false))}</div>}

      </>}

    <input ref={camRef} type="file" accept="image/*" capture="environment" hidden aria-label={txt.appareil} onChange={ajouter} />
    <input ref={galerieRef} type="file" accept="image/*" multiple hidden aria-label={txt.galerie} onChange={ajouter} />

    <Feuille ouverte={source} fermer={() => setSource(false)}>
      <div class="options" aria-label={txt.source}>
        <button type="button" class="m08-option" onClick={() => { setSource(false); camRef.current?.click(); }}><Ic n="camera" taille={19} />{txt.appareil}</button>
        <button type="button" class="m08-option" onClick={() => { setSource(false); galerieRef.current?.click(); }}><Ic n="image" taille={19} />{txt.galerie}</button>
      </div>
    </Feuille>

    <Dialogue ouvert={suppr} fermer={() => setSuppr(false)} titre={txt.supprimerPlusieurs(picks.length)} texte={txt.supprimerTexte}
      libelle={txt.supprimer} danger confirmer={supprimer} />

    {voir && <Visionneuse moment={voir} fermer={() => setVoir(null)} />}
  </main>;
}

function dateCourteJour(jour) {
  return new Intl.DateTimeFormat(langue === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short' }).format(new Date(`${jour}T12:00:00`));
}

export function Visionneuse({ moment, fermer }) {
  const txt = T().photos;
  useEffect(() => {
    const f = (e) => { if (e.key === 'Escape') fermer(); };
    document.addEventListener('keydown', f);
    document.body.classList.add('fige');
    return () => { document.removeEventListener('keydown', f); document.body.classList.remove('fige'); };
  }, []);
  return <div class="m08-visionneuse" role="dialog" aria-modal="true" aria-label={txt.voir} onClick={fermer}>
    <img src={urlMedia(moment.id)} alt="" />
    <p>{dateComplete(`${moment.date}T12:00:00`)}</p>
    <button type="button" class="m08-visionneuse-fermer" aria-label={txt.fermer} onClick={fermer}><Ic n="x" taille={20} /></button>
  </div>;
}

// Segment d'une rangée en pilule (_intervalTab) : le libellé rétrécit pour tenir sur une ligne, comme FittedBox.
export function Segment({ actif, label, onClick, children }) {
  return <button type="button" role="radio" aria-checked={actif} class={actif ? 'actif' : ''} aria-label={label} onClick={onClick}>
    <span style={`--n:${String(children).length}`}>{children}</span>
  </button>;
}

// Réexport utilitaire pour chronologie et comparer.
export { POSES };
