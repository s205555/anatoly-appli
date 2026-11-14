// Éditeur de note, porté de GymMane (lib/screens/note_edit_screen.dart, lib/widgets/note_kit.dart).
// 1 px Flutter = 1 px CSS. Photos compressées en JPEG puis envoyées au service média à l'enregistrement.
import { useEffect, useRef, useState } from 'preact/hooks';
import { afficher, enDate, jourLocal, nomExercice, trouverExercice, tousExercices } from '../donnees.js';
import { langue } from '../i18n.js';
import { m11 } from '../i18n/m11.js';
import { Dialogue, EnTete, Feuille, Ic, Recherche, Rond } from '../ui.jsx';
import { ChoixKind, Visionneuse, brouillon, enregistrerNote, envoyerMedia, journal, reprendreNotesLocales, supprimerNote } from './notes.jsx';
import './m11.css';

const MAX_MEDIA = 6;
const MAX_IMAGE_KB = 2048;
const COULEURS = ['#F3C7B1', '#A78BDA', '#A8C99E', '#9CC2E8', '#E8CF98', '#E6A4B9'];

function compresserImage(fichier, maxKb) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(1, 1600 / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      let quality = 0.82;
      let data = canvas.toDataURL('image/jpeg', quality);
      while (data.length / 1024 > maxKb && quality > 0.4) {
        quality -= 0.1;
        data = canvas.toDataURL('image/jpeg', quality);
      }
      if (data.length / 1024 > maxKb) reject(new Error('trop_lourd'));
      else resolve(data);
    };
    img.onerror = () => reject(new Error('invalide'));
    // data: et non blob: (la CSP du site n'autorise que 'self' et data: pour img-src).
    const lecteur = new FileReader();
    lecteur.onload = () => { img.src = lecteur.result; };
    lecteur.onerror = () => reject(new Error('invalide'));
    lecteur.readAsDataURL(fichier);
  });
}

const sansAccent = (x) => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function NoteEdit() {
  const tx = m11[langue];
  const [note, setNote] = useState(null);
  const [kind, setKind] = useState('note');
  const [texte, setTexte] = useState('');
  const [date, setDate] = useState(jourLocal(new Date()));
  const [exercice, setExercice] = useState('');
  const [dossier, setDossier] = useState('');
  const [epinglee, setEpinglee] = useState(false);
  const [medias, setMedias] = useState([]);
  const [dossierFeuille, setDossierFeuille] = useState(false);
  const [exoFeuille, setExoFeuille] = useState(false);
  const [suppr, setSuppr] = useState(false);
  const [vue, setVue] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const [recherche, setRecherche] = useState('');
  const fileRef = useRef(null);
  const dateRef = useRef(null);

  useEffect(() => {
    const br = brouillon.value;
    brouillon.value = null;
    if (!br) { location.replace('#/notes'); return; }
    reprendreNotesLocales();
    if (br.id) {
      const n = journal.value.notes.find((x) => x.id === br.id);
      if (!n) { location.replace('#/notes'); return; }
      setNote(n);
      setKind(n.kind);
      setTexte(n.text);
      setDate(n.date);
      setExercice(n.exerciseId || '');
      setDossier(n.folder || '');
      setEpinglee(!!n.pinned && !!n.exerciseId);
      setMedias([...n.media]);
    } else {
      setDate(br.date || jourLocal(new Date()));
      setKind(br.kind || 'note');
      setExercice(br.exerciseId || '');
    }
  }, []);

  const canSave = texte.trim().length > 0;

  async function ajouterMedia(fichiers) {
    let nb = medias.length;
    for (const f of fichiers) {
      if (nb >= MAX_MEDIA) { afficher(tx.storageFull, 'danger'); break; }
      if (!f.type.startsWith('image/')) { afficher(tx.fileTooLarge, 'danger'); continue; }
      try {
        const data = await compresserImage(f, MAX_IMAGE_KB);
        setMedias((m) => [...m, data]);
        nb += 1;
      } catch (e) { afficher(e.message === 'trop_lourd' ? tx.fileTooLarge : tx.saveFail, 'danger'); }
    }
    fileRef.current.value = '';
  }

  async function enregistrer() {
    if (!canSave || occupe) return;
    setOccupe(true);
    try {
      // Les photos neuves partent au service média ; celles déjà gardées gardent leur adresse.
      const medias2 = [];
      for (const m of medias) medias2.push(m.startsWith('data:') ? await envoyerMedia(m) : m);
      if (await enregistrerNote({ id: note?.id, exerciseId: exercice || '', date, kind, text: texte, media: medias2, pinned: epinglee, folder: dossier || '' })) {
        if (!note) afficher(tx.save);
        location.hash = '#/notes';
      }
    } catch { afficher(tx.saveFail, 'danger'); }
    setOccupe(false);
  }

  async function supprimer() {
    if (await supprimerNote(note.id)) location.hash = '#/notes';
  }

  const exercices = tousExercices.value;
  const q = sansAccent(recherche.trim());
  const trouves = q ? exercices.filter((ex) => sansAccent(nomExercice(ex)).includes(q)) : exercices;
  const exo = exercice ? trouverExercice(exercice) : null;
  const dossierObj = journal.value.folders.find((f) => f.id === dossier) || null;
  const dateAnnee = (iso) => new Intl.DateTimeFormat(langue === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(enDate(iso));

  return <main class="ecran m11-ecran">
    <EnTete titre={note ? tx.editNote : tx.newNote} retour="#/notes"
      actions={note && <Rond n="trash" label={tx.deleteNote} onClick={() => setSuppr(true)} />} />

    <div class="m11-editeur">
      <span class="m11-etiquette">{tx.kindLabel}</span>
      <ChoixKind valeur={kind} onChange={setKind} />

      <span class="m11-etiquette gros">{tx.textLabel}</span>
      <div class="m11-zone-texte">
        <textarea id="m11-texte" class="m11-texte" maxLength={1000} placeholder={tx.placeholder} rows={4} autoFocus={!note}
          aria-label={tx.textLabel} value={texte} onInput={(e) => setTexte(e.target.value)} />
        <small>{texte.length}/1000</small>
      </div>

      <div class="m11-lignes">
        <button type="button" class="m11-ligne" onClick={() => { const i = dateRef.current; try { i.showPicker(); } catch { i.focus(); i.click(); } }}>
          <Ic n="calendar-blank" taille={19} /><span class="m11-ligne-nom">{tx.dateLabel}</span>
          <span class="m11-ligne-val">{dateAnnee(date)}</span><Ic n="caret-right" taille={15} classe="m11-ligne-fin" />
        </button>
        <input ref={dateRef} type="date" class="m11-date-cache" tabIndex={-1} aria-hidden="true" value={date} onInput={(e) => e.target.value && setDate(e.target.value)} />
        <div class="m11-ligne-sep" />
        <button type="button" class="m11-ligne" onClick={() => setExoFeuille(true)}>
          <Ic n="barbell" taille={19} /><span class="m11-ligne-nom">{tx.exerciseLabel}</span>
          <span class={`m11-ligne-val ${exo ? '' : 'att'}`}>{exo ? nomExercice(exo) : tx.general}</span>
          {exo ? <span class="m11-ligne-x" role="button" aria-label={tx.general} onClick={(e) => { e.stopPropagation(); setExercice(''); setEpinglee(false); }}><Ic n="x:bold" taille={13} /></span>
            : <Ic n="caret-right" taille={15} classe="m11-ligne-fin" />}
        </button>
        <div class="m11-ligne-sep" />
        <button type="button" class="m11-ligne" onClick={() => setDossierFeuille(true)}>
          <Ic n="folder" taille={19} /><span class="m11-ligne-nom">{tx.folderLabel}</span>
          <span class={`m11-ligne-val ${dossierObj ? '' : 'att'}`}>{dossierObj ? dossierObj.name : tx.folderNone}</span><Ic n="caret-right" taille={15} classe="m11-ligne-fin" />
        </button>
        {exo && <>
          <div class="m11-ligne-sep" />
          <button type="button" role="switch" aria-checked={epinglee} class="m11-ligne" onClick={() => setEpinglee(!epinglee)}>
            <Ic n="push-pin" taille={19} /><span class="m11-ligne-nom">{tx.pinWorkout}</span><span class="m11-ligne-val" />
            <span class={`inter ${epinglee ? 'on' : ''}`} aria-hidden="true"><span /></span>
          </button>
        </>}
      </div>

      <span class="m11-etiquette gros">{tx.mediaSection}</span>
      <div class="m11-medias">
        {medias.map((m, i) => <span class="m11-media-vignette" key={i}>
          <button type="button" class="m11-media-ouvrir" aria-label={`${tx.mediaLabel} ${i + 1}`} onClick={() => setVue({ media: medias, index: i })}>
            {<img src={m} alt="" />}
          </button>
          <button type="button" class="m11-media-retirer" aria-label={tx.removeMedia} onClick={() => setMedias((x) => x.filter((_, j) => j !== i))}><Ic n="x:bold" taille={11} /></button>
        </span>)}
        <button type="button" class="m11-joindre" onClick={() => fileRef.current.click()}><Ic n="images" taille={20} /><span>{tx.attach}</span></button>
        <input ref={fileRef} type="file" hidden accept="image/*" multiple onChange={(e) => e.target.files && ajouterMedia(e.target.files)} />
      </div>

      <button class={`m11-enregistrer ${canSave ? 'ok' : ''}`} type="button" disabled={!canSave || occupe} onClick={enregistrer}>{tx.saveCaps}</button>
    </div>

    <Feuille ouverte={dossierFeuille} fermer={() => setDossierFeuille(false)} titre={tx.folderLabel}>
      <div class="m11-liste-choix">
        <button type="button" class={!dossier ? 'on' : ''} onClick={() => { setDossier(''); setDossierFeuille(false); }}>
          <Ic n="x" taille={16} />{tx.folderNone}
        </button>
        {journal.value.folders.map((f) => <button type="button" key={f.id} class={dossier === f.id ? 'on' : ''}
          onClick={() => { setDossier(f.id); setDossierFeuille(false); }}>
          <span class="m11-folder-pill"><i style={`background:${COULEURS[f.color]}`} />{f.name}</span>
        </button>)}
      </div>
    </Feuille>

    <Feuille ouverte={exoFeuille} fermer={() => { setExoFeuille(false); setRecherche(''); }} titre={tx.exerciseLabel} sansFocus>
      <Recherche valeur={recherche} onChange={setRecherche} placeholder={tx.searchExercises} label={tx.searchExercises} />
      <div class="m11-liste-choix m11-exo-liste">
        <button type="button" class={!exercice ? 'on' : ''} onClick={() => { setExercice(''); setEpinglee(false); setExoFeuille(false); setRecherche(''); }}>
          <Ic n="notebook" taille={16} />{tx.general}
        </button>
        {trouves.map((ex) => <button type="button" key={ex.id} class={exercice === ex.id ? 'on' : ''}
          onClick={() => { setExercice(ex.id); setExoFeuille(false); setRecherche(''); }}>
          <Ic n="barbell" taille={16} />{nomExercice(ex)}
        </button>)}
        {q && trouves.length === 0 && <p class="muted m11-exo-aucun">{tx.noExercise}</p>}
      </div>
    </Feuille>

    <Dialogue ouvert={suppr} fermer={() => setSuppr(false)} titre={tx.deleteNote} texte={tx.deleteNoteBody} libelle={tx.deleteNote} danger
      confirmer={async () => { await supprimer(); setSuppr(false); }} />

    {vue && <Visionneuse vue={vue} fermer={() => setVue(null)} />}
  </main>;
}
