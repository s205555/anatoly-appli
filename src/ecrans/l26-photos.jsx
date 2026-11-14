// Photos de la séance (session_photos.dart SessionPhotos) : carte de la fin de séance et du détail d'historique,
// en ligne dans la feuille d'un jour. Les photos rejoignent « Vos photos » (module moments) avec la clé de la séance.
import { useRef, useState } from 'preact/hooks';
import { langue } from '../i18n.js';
import { L26 } from '../i18n/l26.js';
import { m08 } from '../i18n/m08.js';
import { Feuille, Ic } from '../ui.jsx';
import { ecrirePhotos, importerImage, lirePhotos, signale, urlMedia, Visionneuse } from './photos.jsx';

/** fit.momentsOf(session) : les photos liées à cette séance, dans l'ordre d'ajout. */
export const photosDe = (cle) => lirePhotos().filter((m) => m.seance === cle);

export function PhotosSeance({ cle, jour, cadre = true }) {
  const X = L26();
  const txt = m08(langue).photos;
  const [occupe, setOccupe] = useState(false);
  const [source, setSource] = useState(false);
  const [voir, setVoir] = useState(null);
  const [, majVue] = useState(0);
  const camRef = useRef(null), galerieRef = useRef(null);
  const photos = photosDe(cle);
  const ajouter = async (e) => {
    const fichiers = [...(e.target.files ?? [])];
    e.target.value = '';
    if (!fichiers.length) return;
    setOccupe(true);
    try {
      const { redimensionner } = await import('./profil.jsx');
      const ajouts = [];
      for (const f of fichiers) ajouts.push({ id: await importerImage(await redimensionner(f, 1440, 1920, 0.88)), date: jour, quand: Date.now(), seance: cle });
      await ecrirePhotos([...lirePhotos(), ...ajouts]);
      majVue((n) => n + 1);
    } catch (err) { signale(err); } finally { setOccupe(false); }
  };
  const tuileAjout = (taille) => <button type="button" class="l26-photo-ajout" style={{ width: `${taille}px`, height: `${taille}px` }} aria-label={X.photosAjouter} disabled={occupe} onClick={() => setSource(true)}>
    {occupe ? <span class="rond-attente" aria-hidden="true" /> : <Ic n="plus:bold" taille={20} />}
  </button>;
  const corps = photos.length === 0
    ? <div class="l26-photos-vide">
        {tuileAjout(60)}
        <button type="button" class="l26-photos-texte" onClick={() => setSource(true)}><b>{X.photosAjouter}</b><small>{X.photosAide}</small></button>
      </div>
    : <div class="l26-photos-bande">
        {photos.map((m) => <button type="button" key={m.id} class="l26-photo" aria-label={txt.voir} onClick={() => setVoir(m)}><img src={urlMedia(m.id)} alt="" loading="lazy" /></button>)}
        {tuileAjout(72)}
      </div>;
  return <>
    {cadre ? <section class="l26-photos carte-douce">
      <div class="l26-photos-tete"><Ic n="camera:fill" taille={14} /><span>{X.photosSeance}</span>{photos.length > 0 && <b>{photos.length}</b>}</div>
      {corps}
    </section> : corps}
    <input ref={camRef} type="file" accept="image/*" capture="environment" hidden aria-label={txt.appareil} onChange={ajouter} />
    <input ref={galerieRef} type="file" accept="image/*" multiple hidden aria-label={txt.galerie} onChange={ajouter} />
    {source && <Feuille ouverte fermer={() => setSource(false)}>
      <div class="options" aria-label={txt.source}>
        <button type="button" class="m08-option" onClick={() => { setSource(false); camRef.current?.click(); }}><Ic n="camera" taille={19} />{txt.appareil}</button>
        <button type="button" class="m08-option" onClick={() => { setSource(false); galerieRef.current?.click(); }}><Ic n="image" taille={19} />{txt.galerie}</button>
      </div>
    </Feuille>}
    {voir && <Visionneuse moment={voir} fermer={() => setVoir(null)} />}
  </>;
}
