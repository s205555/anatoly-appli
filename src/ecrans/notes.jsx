// Journal et notes, porté de GymMane (lib/screens/notes_screen.dart, lib/widgets/note_kit.dart, note_folder.dart).
// 1 px Flutter = 1 px CSS. Les notes vivent sur le compte (extensions.modules.journal) ; les photos sont des images du service média.
import { useEffect, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { afficher, dateComplete, dateCourte, dateLongue, ecrireModule, enDate, jourLocal, lireModule, nomExercice, trouverExercice } from '../donnees.js';
import { langue } from '../i18n.js';
import { m11 } from '../i18n/m11.js';
import { Dialogue, EnTete, Feuille, Ic, Rond, Vide } from '../ui.jsx';
import { Vignette } from './exercices.jsx';
import { importerImage, supprimerImages } from './photos.jsx';
import { journal, normaliser } from './journal-donnees.js';
import { lireM13 } from './reglages-m13.js';
import './m11.css';

const CLE = 'an_journal'; // ancien stockage dans le navigateur, repris une fois vers le compte
const CLE_REPRIS = 'an_journal_repris';
const KINDS = ['note', 'plan', 'done', 'pain'];
const COULEURS = ['#F3C7B1', '#A78BDA', '#A8C99E', '#9CC2E8', '#E8CF98', '#E6A4B9'];
const META = {
  note: { ic: 'note-pencil', teinte: 'var(--info)' },
  plan: { ic: 'crosshair', teinte: 'var(--warn)' },
  done: { ic: 'check-circle', teinte: 'var(--sage)' },
  pain: { ic: 'warning', teinte: 'var(--danger)' },
};

export { journal };
export const brouillon = signal(null);
export const vueTout = signal(false); // goNotes de GymMane : le journal s'ouvre sur le calendrier
export const dossierOuvert = signal('');
// Exercice dont on affiche les notes (ouvert depuis sa fiche) ; vidé dès qu'on quitte le journal.
export const porteeNote = signal('');
export const filtreNote = signal(null);
export const jourNote = signal(jourLocal(new Date()));
export const moisNote = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
const dansJournal = (h) => /#\/notes?(-edit)?(\/|$|\?)/.test(h);
window.addEventListener('hashchange', (e) => {
  if (!dansJournal(location.hash)) { porteeNote.value = ''; return; }
  // Entrée dans le journal depuis un autre écran (goNotes) : calendrier du jour, sauf depuis la fiche d'un exercice (toutes ses notes).
  if (dansJournal(e.oldURL || '')) return;
  if (!porteeNote.value) vueTout.value = false;
  dossierOuvert.value = '';
  filtreNote.value = null;
  const d = new Date();
  jourNote.value = jourLocal(d);
  moisNote.value = new Date(d.getFullYear(), d.getMonth(), 1);
});

/** Applique un changement au journal du compte. Vrai si le serveur l'a gardé. */
async function maj(fn) {
  const j = journal.value;
  try {
    await ecrireModule('journal', fn({ notes: [...j.notes], folders: [...j.folders] }));
    return true;
  } catch {
    afficher(m11[langue].saveFail, 'danger');
    return false;
  }
}

/** Envoie une image locale (data URL JPEG ou PNG) au service média et rend son adresse. */
export async function envoyerMedia(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png));base64,(.*)$/.exec(dataUrl);
  if (!m) throw new Error('type');
  const octets = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  const id = await importerImage(new File([octets], m[1] === 'image/png' ? 'note.png' : 'note.jpg', { type: m[1] }));
  return `/api/media/${id}`;
}

let reprise = null;
/** Reprend une seule fois les notes d'avant, gardées dans le navigateur, vers le compte. L'original reste en place. */
export function reprendreNotesLocales() {
  reprise ??= (async () => {
    let local;
    try {
      if (localStorage.getItem(CLE_REPRIS)) return;
      local = normaliser(JSON.parse(localStorage.getItem(CLE)));
    } catch { return; }
    try {
      if (local.notes.length || local.folders.length) {
        const actuel = journal.value;
        const idsN = new Set(actuel.notes.map((n) => n.id)), idsF = new Set(actuel.folders.map((f) => f.id));
        const aReprendre = local.notes.filter((n) => !idsN.has(n.id));
        for (const n of aReprendre) {
          const media = [];
          for (const x of n.media) {
            if (/^data:image\/(jpeg|png);/.test(x)) media.push(await envoyerMedia(x)); // les vidéos d'avant ne tiennent pas sur le compte
            else if (/^\/api\/media\//.test(x)) media.push(x);
          }
          n.media = media;
        }
        await ecrireModule('journal', {
          notes: [...actuel.notes, ...aReprendre],
          folders: [...actuel.folders, ...local.folders.filter((f) => !idsF.has(f.id))],
        });
      }
      localStorage.setItem(CLE_REPRIS, '1');
    } catch { reprise = null; /* nouvel essai à la prochaine ouverture */ }
  })();
  return reprise;
}

export async function enregistrerNote({ id, exerciseId, date, kind, text, media = [], pinned, folder }) {
  const corps = String(text ?? '').trim();
  if (!corps) return false;
  const retirees = id ? (journal.value.notes.find((n) => n.id === id)?.media ?? []).filter((m) => !media.includes(m)) : [];
  const ok = await maj((j) => {
    const i = id ? j.notes.findIndex((n) => n.id === id) : -1;
    const commun = { exerciseId: exerciseId || '', date, kind, text: corps, media: [...media], pinned: !!pinned && !!exerciseId, folder: folder || '' };
    if (i < 0) j.notes.push({ id: `n${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString(), ...commun });
    else j.notes[i] = { ...j.notes[i], ...commun };
    return j;
  });
  if (!ok) return false;
  supprimerImages(retirees);
  const d = enDate(date);
  jourNote.value = date;
  moisNote.value = new Date(d.getFullYear(), d.getMonth(), 1);
  return true;
}

export async function supprimerNote(id) {
  const media = journal.value.notes.find((n) => n.id === id)?.media ?? [];
  const ok = await maj((j) => ({ ...j, notes: j.notes.filter((n) => n.id !== id) }));
  if (ok) supprimerImages(media);
  return ok;
}

export const epingler = (id, on) => maj((j) => ({ ...j, notes: j.notes.map((n) => (n.id === id && n.exerciseId ? { ...n, pinned: on } : n)) }));

export async function ajouterDossier(nom, couleur) {
  const id = `f${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return (await maj((j) => ({ ...j, folders: [...j.folders, { id, name: nom.trim(), color: couleur }] }))) ? id : '';
}

export const modifierDossier = (id, { name, color }) => maj((j) => ({ ...j, folders: j.folders.map((f) => (f.id === id ? { ...f, name: name.trim() || f.name, color: color ?? f.color } : f)) }));

export async function supprimerDossier(id) {
  const ok = await maj((j) => ({ ...j, folders: j.folders.filter((f) => f.id !== id), notes: j.notes.map((n) => (n.folder === id ? { ...n, folder: '' } : n)) }));
  if (ok && dossierOuvert.value === id) dossierOuvert.value = '';
  return ok;
}

export function ouvrirEditeur({ id = null, exerciseId = '', date = null, kind = null } = {}) {
  brouillon.value = { id, exerciseId, date: date || jourNote.value, kind: kind || 'note' };
  location.hash = '#/note-edit';
}

const triees = () => [...journal.value.notes].filter((n) => !porteeNote.value || n.exerciseId === porteeNote.value).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
const couleurDossier = (f) => COULEURS[(f?.color ?? 0) % COULEURS.length];
const estVideo = (src) => /^data:video\//.test(src) || /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(src);

// noteDayLabel et fullDate de GymMane : Aujourd'hui, Hier, sinon date courte (avec l'année hors année en cours).
const loc = () => (langue === 'en' ? 'en-US' : 'fr-FR');
const dateShort = (iso) => new Intl.DateTimeFormat(loc(), { day: 'numeric', month: 'short' }).format(enDate(iso));
const dateShortYear = (iso) => new Intl.DateTimeFormat(loc(), { day: 'numeric', month: 'short', year: 'numeric' }).format(enDate(iso));
const majuscule = (x) => x.charAt(0).toUpperCase() + x.slice(1);
const dateFull = (iso) => `${majuscule(new Intl.DateTimeFormat(loc(), { weekday: 'long' }).format(enDate(iso)))}, ${dateShortYear(iso)}`;
function jourLisible(iso) {
  const tx = m11[langue];
  if (iso === jourLocal(new Date())) return tx.today;
  if (iso === jourLocal(new Date(Date.now() - 864e5))) return tx.yesterday;
  return iso.slice(0, 4) === String(new Date().getFullYear()) ? dateShort(iso) : dateShortYear(iso);
}
const dateMois = (d) => new Intl.DateTimeFormat(langue === 'en' ? 'en-GB' : 'fr-FR', { month: 'long', year: 'numeric' }).format(d);

// ---------- Photos et visionneuse (partagées avec l'éditeur) ----------
export function Photos({ media, onView }) {
  const n = media.length;
  if (!n) return null;
  const vignette = (i, classe = '', badge = null) => (
    <button type="button" key={i} class={`m11-photo ${classe}`} aria-label={`${m11[langue].mediaLabel} ${i + 1}`}
      onClick={(e) => { e.stopPropagation(); onView(media, i); }}>
      {estVideo(media[i]) ? <Ic n="play:fill" taille={22} /> : <img src={media[i]} alt="" loading="lazy" />}
      {badge && <span class="m11-photo-plus">{badge}</span>}
    </button>
  );
  if (n === 1) return <span class="m11-photos un">{vignette(0, 'grand')}</span>;
  if (n === 2) return <span class="m11-photos deux">{vignette(0)}{vignette(1)}</span>;
  return <span class="m11-photos trois">{vignette(0, 'grand')}<span class="m11-photos-col">{vignette(1)}{vignette(2, '', n > 3 ? `+${n - 3}` : null)}</span></span>;
}

export function Visionneuse({ vue, fermer }) {
  const [i, setI] = useState(vue.index);
  const media = vue.media;
  useEffect(() => {
    const t = (e) => {
      if (e.key === 'Escape') fermer();
      if (e.key === 'ArrowRight') setI((x) => Math.min(media.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    document.addEventListener('keydown', t);
    document.body.classList.add('fige');
    return () => { document.removeEventListener('keydown', t); document.body.classList.remove('fige'); };
  }, []);
  const src = media[i];
  return <div class="m11-visionneuse" role="dialog" aria-modal="true" aria-label={m11[langue].mediaLabel} onClick={(e) => e.target === e.currentTarget && fermer()}>
    <div class="m11-visionneuse-tete">
      <button type="button" class="m11-visionneuse-x" aria-label={m11[langue].close} onClick={fermer}><Ic n="x:bold" taille={20} /></button>
      {media.length > 1 && <span class="m11-visionneuse-nb">{i + 1}/{media.length}</span>}
    </div>
    {estVideo(src)
      ? <video class="m11-visionneuse-media" src={src} controls autoPlay loop playsInline />
      : <img class="m11-visionneuse-media" src={src} alt="" />}
    {i > 0 && <button type="button" class="m11-visionneuse-nav g" aria-label={m11[langue].prev} onClick={() => setI(i - 1)}><Ic n="caret-left:bold" taille={22} /></button>}
    {i < media.length - 1 && <button type="button" class="m11-visionneuse-nav d" aria-label={m11[langue].next} onClick={() => setI(i + 1)}><Ic n="caret-right:bold" taille={22} /></button>}
  </div>;
}

// ---------- Calendrier ----------
function Calendrier({ mois, jour, onJour, onMois, kindsOn }) {
  const tx = m11[langue];
  const debut = new Date(mois.getFullYear(), mois.getMonth(), 1);
  const nb = new Date(mois.getFullYear(), mois.getMonth() + 1, 0).getDate();
  const lundi = Number(lireM13().debutSemaine) || 0; // 0 = lundi ... 6 = dimanche, réglage « La semaine commence le »
  const decal = ((debut.getDay() + 6) % 7 - lundi + 7) % 7;
  const auj = jourLocal(new Date());
  const cases = [...Array(decal).fill(null), ...Array.from({ length: nb }, (_, i) => i + 1)];
  return <section class="carte m11-cal">
    <div class="m11-cal-tete">
      <button type="button" class="m11-cal-fleche" aria-label={tx.prevMonth} onClick={() => onMois(-1)}><Ic n="caret-left:bold" taille={13} /></button>
      <h2 class="m11-cal-mois">{dateMois(debut)}</h2>
      <button type="button" class="m11-cal-fleche" aria-label={tx.nextMonth} onClick={() => onMois(1)}><Ic n="caret-right:bold" taille={13} /></button>
    </div>
    <div class="m11-cal-grille" role="grid" aria-label={dateMois(debut)}>
      {tx.initiales.map((_, i) => tx.initiales[(i + lundi) % 7]).map((j, i) => <span class="m11-cal-entete" key={`e${i}`} aria-hidden="true">{j}</span>)}
      {cases.map((n, i) => {
        if (n === null) return <span key={`v${i}`} />;
        const iso = jourLocal(new Date(mois.getFullYear(), mois.getMonth(), n));
        const on = iso === jour;
        return <button type="button" key={iso} class={`m11-cal-cell ${on ? 'on' : ''} ${iso === auj ? 'auj' : ''}`} role="gridcell"
          aria-pressed={on} aria-label={dateFull(iso)} onClick={() => onJour(iso)}>
          <span class="m11-cal-num">{n}</span>
          <span class="m11-cal-points" aria-hidden="true">{kindsOn(iso).slice(0, 3).map((k) => <i key={k} style={`background:${META[k].teinte}`} />)}</span>
        </button>;
      })}
    </div>
  </section>;
}

// ---------- Type de note ----------
function BadgeKind({ kind }) {
  return <span class="m11-kind" style={`--k:${META[kind].teinte}`}><Ic n={META[kind].ic} taille={13} /><span>{m11[langue].kinds[kind].toUpperCase()}</span></span>;
}

export function ChoixKind({ valeur, onChange }) {
  return <div class="m11-kinds" role="radiogroup" aria-label={m11[langue].kindLabel}>
    {KINDS.map((k) => <button type="button" key={k} role="radio" aria-checked={valeur === k} class={`m11-kind-tuile ${valeur === k ? 'on' : ''}`}
      style={`--k:${META[k].teinte}`} onClick={() => onChange(k)}>
      <Ic n={META[k].ic} taille={18} /><span>{m11[langue].kinds[k]}</span>
    </button>)}
  </div>;
}

// ---------- Cartes de notes (NoteCard de note_kit.dart) ----------
function CarteNote({ note, showExercise, showDate, onOpen, onView }) {
  const tx = m11[langue];
  const ex = showExercise && note.exerciseId ? trouverExercice(note.exerciseId) : null;
  const dossier = dossierOuvert.value ? null : journal.value.folders.find((f) => f.id === note.folder);
  const lignes = note.text.split('\n');
  const titre = lignes[0];
  const corps = lignes.slice(1).join('\n').trim();
  const jour = showDate ? jourLisible(note.date) : '';
  return <article class="m11-note" role="button" tabIndex={0} style={`--k:${META[note.kind].teinte}`}
    aria-label={`${tx.kinds[note.kind]}, ${titre}`}
    onClick={() => onOpen(note)}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(note); } }}>
    <span class="m11-note-dessous" aria-hidden="true" />
    <div class="m11-note-carte">
      <span class="m11-oreille" aria-hidden="true"><i /></span>
      <div class="m11-note-tete">
        {ex && <a class="m11-note-vignette" href={`#/exercice/${ex.id}`} aria-label={nomExercice(ex)} onClick={(e) => e.stopPropagation()}><Vignette e={ex} taille={44} /></a>}
        <span class="m11-note-meta">
          <span class="m11-note-type"><Ic n={META[note.kind].ic} taille={13} /><span>{tx.kinds[note.kind].toUpperCase()}</span>
            {note.pinned && <Ic n="push-pin:fill" taille={12} classe="m11-pin" />}</span>
          {ex && <span class="m11-note-ex">{nomExercice(ex)}</span>}
        </span>
      </div>
      <strong class="m11-note-titre">{titre}</strong>
      {corps && <span class="m11-note-corps">{corps}</span>}
      {note.media.length > 0 && <Photos media={note.media} onView={onView} />}
      {(dossier || jour) && <span class="m11-note-pied">
        {dossier && <span class="m11-folder-pill"><i style={`background:${couleurDossier(dossier)}`} /><span>{dossier.name}</span></span>}
        <span class="spacer" />{jour && <span class="m11-note-jour">{jour}</span>}
      </span>}
    </div>
  </article>;
}

// ---------- Filtres ----------
function BarreFiltres({ selected, comptes, onPick }) {
  const tx = m11[langue];
  return <div class="m11-filtres" role="group" aria-label={tx.kindLabel}>
    <button type="button" class={`m11-filtre ${selected === null ? 'on' : ''}`} style="--k:var(--ember)" aria-pressed={selected === null} onClick={() => onPick(null)}>{tx.filterAll}</button>
    {KINDS.filter((k) => comptes[k] > 0).map((k) => <button type="button" key={k} class={`m11-filtre ${selected === k ? 'on' : ''}`} style={`--k:${META[k].teinte}`}
      aria-pressed={selected === k} onClick={() => onPick(k)}>{tx.kinds[k]} {comptes[k]}</button>)}
  </div>;
}

// ---------- Dossiers ----------
function CarteDossier({ folder, notes, onOpen, onMenu }) {
  const tx = m11[langue];
  const photo = notes.flatMap((n) => n.media).find((m) => !estVideo(m));
  const dernier = notes[0];
  const detail = [tx.count(notes.length), dernier ? jourLisible(dernier.date) : null].filter(Boolean).join(' · ');
  return <div class="m11-dossier" style={`--teinte:${couleurDossier(folder)}`}>
    <button type="button" class="m11-dossier-bouton" onClick={onOpen} aria-label={`${folder.name}, ${detail}`}>
      <span class="m11-dossier-onglet" aria-hidden="true" />
      <span class="m11-dossier-dos" aria-hidden="true" />
      <span class="m11-dossier-papier" aria-hidden="true">{photo ? <img src={photo} alt="" /> : <><i /><i /></>}</span>
      <span class="m11-dossier-face"><strong>{folder.name}</strong><small>{detail}</small></span>
    </button>
    <button type="button" class="m11-dossier-menu" aria-label={tx.moreOptions} onClick={(e) => { e.stopPropagation(); onMenu(folder); }}><Ic n="dots-three:bold" taille={15} /></button>
  </div>;
}

function CarteNouveauDossier({ onClick }) {
  return <button type="button" class="m11-dossier-neuf" onClick={onClick}>
    <span class="m11-dossier-neuf-rond"><Ic n="plus:bold" taille={15} /></span>
    <span>{m11[langue].folderNew}</span>
  </button>;
}

function SectionDossiers({ onOpen, onMenu, onNew }) {
  const folders = journal.value.folders;
  const notes = triees();
  if (!folders.length) return <button type="button" class="m11-dossier-vide" onClick={onNew}>
    <Ic n="folder-plus" taille={17} /><span>{m11[langue].folderNew}</span><Ic n="plus:bold" taille={13} classe="m11-dossier-vide-plus" />
  </button>;
  return <section class="m11-section">
    <span class="kicker">{m11[langue].folders}</span>
    <div class="m11-dossiers">
      {folders.map((f) => <CarteDossier key={f.id} folder={f} notes={notes.filter((n) => n.folder === f.id)} onOpen={() => onOpen(f)} onMenu={onMenu} />)}
      <CarteNouveauDossier onClick={onNew} />
    </div>
  </section>;
}

function EditeurDossier({ dossier, fermer }) {
  const [nom, setNom] = useState(dossier?.name ?? '');
  const [couleur, setCouleur] = useState(dossier?.color ?? 0);
  const [occupe, setOccupe] = useState(false);
  const ok = nom.trim().length > 0 && !occupe;
  const enregistrer = async () => {
    if (!ok) return;
    setOccupe(true);
    const fait = dossier ? await modifierDossier(dossier.id, { name: nom, color: couleur }) : await ajouterDossier(nom, couleur);
    setOccupe(false);
    if (fait) fermer();
  };
  return <Feuille ouverte fermer={fermer} titre={dossier ? m11[langue].folderEdit : m11[langue].folderNew}
    pied={<button class="btn pri large" type="button" disabled={!ok} onClick={enregistrer}>{m11[langue].saveCaps}</button>}>
    {/* Aperçu du dossier en direct (notes_screen.dart _FolderEditor) : nom, couleur, nombre de notes. */}
    <div class="l26-dossier-apercu" inert>
      <CarteDossier folder={{ id: dossier?.id ?? '', name: nom.trim() || m11[langue].folderName, color: couleur }} notes={dossier ? journal.value.notes.filter((n) => n.folder === dossier.id) : []} onOpen={() => {}} onMenu={() => {}} />
    </div>
    <input id="m11-nom-dossier" class="form-input" maxLength={32} value={nom} placeholder={m11[langue].folderName} aria-label={m11[langue].folderName} onInput={(e) => setNom(e.target.value)} />
    <div class="m11-pastilles" role="group" aria-label={m11[langue].folderLabel}>
      {COULEURS.map((c, i) => <button type="button" key={c} class={`m11-pastille ${i === couleur ? 'on' : ''}`} style={`--c:${c}`}
        aria-pressed={i === couleur} onClick={() => setCouleur(i)}><span /></button>)}
    </div>
  </Feuille>;
}

function MenuDossier({ dossier, fermer, onEdit, onDelete }) {
  const n = journal.value.notes.filter((x) => x.folder === dossier.id).length;
  return <Feuille ouverte fermer={fermer} titre={dossier.name} sous={m11[langue].count(n)}>
    <div class="options">
      <button type="button" class="option" onClick={() => { fermer(); onEdit(dossier); }}><Ic n="pencil-simple" taille={19} /><span><strong>{m11[langue].folderEdit}</strong></span></button>
      <button type="button" class="option danger" onClick={() => { fermer(); onDelete(dossier); }}><Ic n="trash" taille={19} /><span><strong>{m11[langue].folderDeleteAction}</strong></span></button>
    </div>
  </Feuille>;
}

// ---------- Détail d'une note ----------
function DetailNote({ note, fermer, onEdit, onView }) {
  const tx = m11[langue];
  const ex = note.exerciseId ? trouverExercice(note.exerciseId) : null;
  const dossier = journal.value.folders.find((f) => f.id === note.folder);
  const lignes = note.text.split('\n');
  const corps = lignes.slice(1).join('\n').trim();
  return <Feuille ouverte fermer={fermer} titre={null} large>
    <div class="m11-detail-tete">
      <BadgeKind kind={note.kind} />
      {note.pinned && <Ic n="push-pin:fill" taille={13} classe="m11-pin" />}
      <span class="spacer" />
      <span class="m11-note-jour">{dateComplete(note.date)}</span>
    </div>
    <strong class="m11-detail-titre">{lignes[0]}</strong>
    {corps && <p class="m11-detail-corps">{corps}</p>}
    {ex && <a class="m11-detail-ex" href={`#/exercice/${ex.id}`} onClick={fermer}><Ic n="barbell" taille={18} /><span>{nomExercice(ex)}</span><Ic n="caret-right" taille={15} classe="chevron" /></a>}
    {note.media.length > 0 && <Photos media={note.media} onView={onView} />}
    {dossier && <span class="m11-folder-pill"><i style={`background:${couleurDossier(dossier)}`} />{dossier.name}</span>}
    <button type="button" class="btn secondaire" aria-label={tx.editNote} onClick={() => { fermer(); onEdit(note); }}><Ic n="pencil-simple" taille={18} />{tx.editorAction}</button>
  </Feuille>;
}

// ---------- Écran principal ----------
export function Notes() {
  const tx = m11[langue];
  const [dossierEdit, setDossierEdit] = useState(null);
  const [menuDossier, setMenuDossier] = useState(null);
  const [suppr, setSuppr] = useState(null);
  const [detail, setDetail] = useState(null);
  const [vue, setVue] = useState(null);
  useEffect(() => { reprendreNotesLocales(); }, []);

  const all = vueTout.value;
  const portee = porteeNote.value ? trouverExercice(porteeNote.value) : null;
  const dossier = journal.value.folders.find((f) => f.id === dossierOuvert.value) || null;
  const notes = triees();
  const scope = dossier ? notes.filter((n) => n.folder === dossier.id) : notes;
  const visible = filtreNote.value ? scope.filter((n) => n.kind === filtreNote.value) : scope;
  const jour = jourNote.value;
  const notesJour = scope.filter((n) => n.date === jour);
  const kindsOn = (iso) => [...new Set(scope.filter((n) => n.date === iso).map((n) => n.kind))];
  const comptes = KINDS.reduce((a, k) => ({ ...a, [k]: scope.filter((n) => n.kind === k).length }), {});
  const mois = moisNote.value;
  const nbMois = scope.filter((n) => { const d = enDate(n.date); return d.getFullYear() === mois.getFullYear() && d.getMonth() === mois.getMonth(); }).length;
  const ouvrirVue = (media, index) => setVue({ media, index });

  const groupes = [];
  let dernierJour = null;
  for (const n of visible) {
    if (n.date !== dernierJour) {
      dernierJour = n.date;
      groupes.push(<div class="m11-groupe-jour" key={`j-${n.id}`}><span class="kicker">{jourLisible(n.date).toUpperCase()}</span><span>{dateFull(n.date)}</span><i /></div>);
    }
    groupes.push(<CarteNote key={n.id} note={n} showExercise={!dossier && !portee} showDate={false} onOpen={setDetail} onView={ouvrirVue} />);
  }

  return <main class="ecran m11-ecran">
    <EnTete titre={dossier ? dossier.name.toUpperCase() : portee ? nomExercice(portee).toUpperCase() : tx.journal} retour="#/"
      onRetour={dossier ? () => { dossierOuvert.value = ''; } : (all && !portee) ? () => { vueTout.value = false; } : portee ? () => { location.hash = `#/exercice/${portee.id}`; } : null}
      sous={all ? tx.count(scope.length) : tx.monthCount(nbMois)}
      actions={<>
        <Rond n="plus:bold" label={tx.addNote} plein taille={44} icone={16} onClick={() => ouvrirEditeur({ exerciseId: portee?.id, date: all ? jourLocal(new Date()) : jour })} />
        {dossier
          ? <Rond n="dots-three-vertical:bold" label={tx.moreOptions} taille={44} icone={16} onClick={() => setMenuDossier(dossier)} />
          : <Rond n={all ? 'calendar-blank' : 'list-bullets'} label={all ? tx.calendar : tx.allNotes} taille={44} icone={16} onClick={() => { vueTout.value = !all; }} />}
      </>} />

    {all
      ? <>
        {!dossier && <SectionDossiers onOpen={(f) => { dossierOuvert.value = f.id; filtreNote.value = null; vueTout.value = true; }} onMenu={setMenuDossier} onNew={() => setDossierEdit({})} />}
        {scope.length > 0 && <BarreFiltres selected={filtreNote.value} comptes={comptes} onPick={(k) => { filtreNote.value = filtreNote.value === k ? null : k; }} />}
        {visible.length === 0
          ? <Vide n="notebook" titre={tx.emptyTitle} texte={tx.emptyBody} />
          : <div class="m11-liste">{groupes}</div>}
      </>
      : <>
        <Calendrier mois={mois} jour={jour} kindsOn={kindsOn}
          onJour={(iso) => { jourNote.value = iso; }}
          onMois={(n) => { moisNote.value = new Date(mois.getFullYear(), mois.getMonth() + n, 1); }} />
        <div class="m11-jour">
          <div class="m11-jour-texte"><span class="kicker">{jourLisible(jour).toUpperCase()}</span><span class="m11-jour-date">{dateFull(jour)}</span></div>
          <button type="button" class="m11-pilule" onClick={() => ouvrirEditeur({ exerciseId: portee?.id, date: jour })}>{tx.addOnDay}</button>
        </div>
        {notesJour.length === 0
          ? <div class="m11-vide-jour"><Ic n="notebook" taille={20} /><span>{tx.noneOnDay}</span></div>
          : <div class="m11-liste">{notesJour.map((n) => <CarteNote key={n.id} note={n} showExercise={!dossier && !portee} showDate={false} onOpen={setDetail} onView={ouvrirVue} />)}</div>}
      </>}

    {dossierEdit && <EditeurDossier dossier={dossierEdit.id ? dossierEdit : null} fermer={() => setDossierEdit(null)} />}
    {menuDossier && <MenuDossier dossier={menuDossier} fermer={() => setMenuDossier(null)}
      onEdit={(f) => setDossierEdit(f)} onDelete={(f) => setSuppr(f)} />}
    <Dialogue ouvert={!!suppr} fermer={() => setSuppr(null)} titre={tx.folderDelete} texte={tx.folderDeleteBody} libelle={tx.folderDeleteAction} danger
      confirmer={async () => { if (suppr) await supprimerDossier(suppr.id); setSuppr(null); }} />
    {detail && <DetailNote note={detail} fermer={() => setDetail(null)} onView={ouvrirVue}
      onEdit={(n) => ouvrirEditeur({ id: n.id })} />}
    {vue && <Visionneuse vue={vue} fermer={() => setVue(null)} />}
  </main>;
}
