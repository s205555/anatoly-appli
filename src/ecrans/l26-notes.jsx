// Notes d'exercice pendant la séance (workout_notes.dart : WorkoutNoteStrip, showWorkoutNotesSheet, _WorkoutNoteEditor).
// Les notes vivent dans le journal du compte (module « journal ») : épinglées « À chaque fois » ou « La prochaine fois » (genre plan).
import { useState } from 'preact/hooks';
import { dateCourte, enDate, etat, jourLocal, nomExercice, trouverExercice } from '../donnees.js';
import { L26 } from '../i18n/l26.js';
import { Dialogue, Feuille, Ic } from '../ui.jsx';
import { journal } from './journal-donnees.js';

const notesDe = (ex) => journal.value.notes.filter((n) => n.exerciseId === ex).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

/** fit.workoutNotesFor : les épinglées, puis la plus récente « La prochaine fois » écrite depuis la dernière séance de l'exercice. */
export function notesSeance(ex, seances = etat.value.seances, auj = jourLocal(new Date())) {
  if (!ex) return [];
  const miennes = notesDe(ex);
  let dernier = null;
  for (const s of seances) {
    const j = jourLocal(enDate(s.debut));
    if (j >= auj || !s.donnees.exercices.some((e) => e.ex === ex)) continue;
    if (!dernier || j > dernier) dernier = j;
  }
  const d = new Date(); d.setDate(d.getDate() - 30);
  const depuis = dernier ?? jourLocal(d);
  return [...miennes.filter((n) => n.pinned), ...miennes.filter((n) => !n.pinned && n.kind === 'plan' && (n.date || '') >= depuis).slice(0, 1)];
}
/** WorkoutNoteStrip.offers : des notes à montrer, ou un exercice encore neuf (moins de 3 séances) sans aucune note. */
export function offreNotes(ex) {
  if (!ex) return false;
  if (notesSeance(ex).length) return true;
  return notesDe(ex).length === 0 && etat.value.seances.filter((s) => s.donnees.exercices.some((e) => e.ex === ex)).length < 3;
}

const icone = (n) => (n.pinned ? 'push-pin:fill' : 'arrow-bend-down-right:fill');

export function BandeNotes({ ex }) {
  const X = L26();
  const [liste, setListe] = useState(false);
  const [editeur, setEditeur] = useState(null);
  const notes = notesSeance(ex);
  if (!offreNotes(ex)) return null;
  return <>
    {notes.length === 0
      ? <button type="button" class="l26-note-ajout" aria-label={X.noteAjouter} onClick={() => setEditeur({})}>
          <Ic n="push-pin" taille={14} /><span>{X.noteAjouter}</span><Ic n="plus:bold" taille={13} />
        </button>
      : <button type="button" class="l26-note-bande" aria-label={X.notesTitre} onClick={() => setListe(true)}>
          {notes.map((n) => <span key={n.id}><Ic n={icone(n)} taille={13} /><span>{n.text.trim().replace(/\s*\n\s*/g, ' · ')}</span></span>)}
        </button>}
    {liste && <Feuille ouverte fermer={() => setListe(false)} titre={X.notesTitre} sous={nomExercice(trouverExercice(ex))}>
      {notesSeance(ex).map((n) => <div class="l26-note-carte" key={n.id}>
        <div>
          <span class="l26-note-quand"><Ic n={icone(n)} taille={12} />{n.pinned ? X.noteChaque : n.date === jourLocal(new Date()) ? X.noteProchaine : X.noteDerniere(dateCourte(n.date))}</span>
          <p>{n.text.trim()}</p>
        </div>
        <button type="button" class="rond" aria-label={X.modifierNote} onClick={() => setEditeur({ note: n })}><Ic n="pencil-simple" taille={15} /></button>
      </div>)}
      <button type="button" class="l26-fantome" onClick={() => setEditeur({})}><Ic n="plus" taille={16} />{X.nouvelleNote}</button>
    </Feuille>}
    {editeur && <EditeurNote ex={ex} note={editeur.note} fermer={() => setEditeur(null)} />}
  </>;
}

function EditeurNote({ ex, note, fermer }) {
  const X = L26();
  const [texte, setTexte] = useState(note?.text ?? '');
  const [chaque, setChaque] = useState(!note || note.pinned || note.kind !== 'plan');
  const [suppr, setSuppr] = useState(false);
  const enregistrer = async () => {
    if (!texte.trim()) { navigator.vibrate?.(30); return; }
    const kind = chaque ? (note?.kind === 'plan' ? 'note' : note?.kind ?? 'note') : 'plan';
    const { enregistrerNote } = await import('./notes.jsx');
    if (await enregistrerNote({ id: note?.id, exerciseId: ex, date: note?.date ?? jourLocal(new Date()), kind, text: texte, media: note?.media ?? [], pinned: chaque, folder: note?.folder })) fermer();
  };
  const choix = (v) => <button type="button" class={`l26-note-choix ${chaque === v ? 'on' : ''}`} aria-pressed={chaque === v} onClick={() => setChaque(v)}>
    <span><Ic n={v ? 'push-pin:fill' : 'arrow-bend-down-right:fill'} taille={14} /><b>{v ? X.noteChaque : X.noteProchaine}</b></span>
    <small>{v ? X.noteChaqueAide : X.noteProchaineAide}</small>
  </button>;
  return <>
    <Feuille ouverte fermer={fermer} titre={note ? X.modifierNote : X.nouvelleNote} sous={nomExercice(trouverExercice(ex))}
      pied={<>
        <button type="button" class="btn pri large" onClick={enregistrer}>{X.enregistrerCaps}</button>
        {note && <button type="button" class="btn lien danger" onClick={() => setSuppr(true)}>{X.supprimer}</button>}
      </>}>
      <textarea class="form-input l26-note-texte" rows={3} maxLength={1000} placeholder={X.noteIndice} aria-label={X.notesTitre} value={texte} onInput={(e) => setTexte(e.target.value)} />
      <div class="l26-note-choix-ligne">{choix(true)}{choix(false)}</div>
    </Feuille>
    <Dialogue ouvert={suppr} fermer={() => setSuppr(false)} titre={X.supprimerNote} texte={X.supprimerNoteTexte} libelle={X.supprimer} danger
      confirmer={async () => { const { supprimerNote } = await import('./notes.jsx'); if (await supprimerNote(note.id)) { setSuppr(false); fermer(); } }} />
  </>;
}
