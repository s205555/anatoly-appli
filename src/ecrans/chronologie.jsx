// Chronologie : fil des photos de progression et carte musculaire par fenêtre.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { afficher, dateCourte, enDate, etat, jourLocal, trouverExercice } from '../donnees.js';
import { langue, t } from '../i18n.js';
import { INTERVALLES, m08, POSES } from '../i18n/m08.js';
import { Dialogue, EnTete, Feuille, Ic, Kicker, Nombre } from '../ui.jsx';
import { idle, RAMPE_HEAT, SilhouetteSvg } from '../silhouette-svg.jsx';
import { ecrire, idJour, importerImage, joursEntre, lire, Segment, signale, supprimerImages, urlMedia, Visionneuse } from './photos.jsx';
import './m08.css';

const CLE_POSES = 'an_m08_poses';
const CLE_INTERVALLE = 'an_m08_intervalle';
const JOURS = 86400000;
const T = () => m08(langue);

export function Chronologie() {
  const txt = T().chronologie;
  const [mode, setMode] = useState('photos');
  const [intervalle, setIntervalle] = useState(() => { const n = Number(lire(CLE_INTERVALLE, 30)); return Number.isFinite(n) && n >= 0 && n <= 365 ? Math.round(n) : 30; });
  const [poses, setPoses] = useState(() => lire(CLE_POSES, []));
  const [voir, setVoir] = useState(null);
  const [choixPose, setChoixPose] = useState(false);
  const [cible, setCible] = useState(null); // { date, pose } de la photo à prendre
  const [supprJour, setSupprJour] = useState(null);
  const [supprPose, setSupprPose] = useState(null);
  const camRef = useRef(null);
  const galerieRef = useRef(null);
  const prise = useRef(null); // cible gardée pendant que le sélecteur de fichier est ouvert

  useEffect(() => { ecrire(CLE_POSES, poses); }, [poses]);
  useEffect(() => { ecrire(CLE_INTERVALLE, intervalle); }, [intervalle]);

  const tri = useMemo(() => [...poses].sort((a, b) => (a.date === b.date ? POSES.indexOf(a.pose) - POSES.indexOf(b.pose) : a.date < b.date ? 1 : -1)), [poses]);
  const jours = useMemo(() => [...new Set(tri.map((p) => p.date))].sort(), [tri]);
  const derniere = jours.at(-1);
  const reste = derniere && intervalle > 0 ? intervalle - joursEntre(derniere, idJour()) : null;

  // Comme GymMane (_replaceShot) : une photo par pose et par jour, la nouvelle remplace l'ancienne.
  const ajouter = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    const cible = prise.current;
    if (!f || !cible) return;
    try {
      const id = await importerImage(f);
      const anciennes = poses.filter((x) => x.date === cible.date && x.pose === cible.pose).map((x) => x.id);
      if (anciennes.length) supprimerImages(anciennes);
      setPoses((p) => [...p.filter((x) => !(x.date === cible.date && x.pose === cible.pose)), { id, date: cible.date, pose: cible.pose }]);
      afficher(txt.photoAjoutee);
    } catch (err) {
      signale(err);
    }
  };

  const supprimerJour = async () => {
    supprimerImages(poses.filter((x) => x.date === supprJour).map((x) => x.id));
    setPoses((p) => p.filter((x) => x.date !== supprJour));
    setSupprJour(null);
    afficher(txt.journeeSupprimee);
  };

  const supprimerPose = async () => {
    supprimerImages([supprPose]);
    setPoses((p) => p.filter((x) => x.id !== supprPose));
    setSupprPose(null);
    afficher(txt.photoRetiree);
  };

  const modePhotos = mode === 'photos';
  const seances = etat.value.seances ?? [];
  const premier = jours[0];

  return <main class={`ecran ecran-borne m08${modePhotos ? ' m08-avec-pied' : ''}`}>
    <EnTete titre={txt.titre} sous={modePhotos ? txt.sousPhotos(poses.length) : txt.sousCorps(seances.length)} />

    <div class="m08-segments m08-mode" role="radiogroup" aria-label={txt.titre}>
      <button type="button" role="radio" aria-checked={modePhotos} class={modePhotos ? 'actif' : ''} onClick={() => setMode('photos')}><Ic n="image" taille={15} />{txt.photos}</button>
      <button type="button" role="radio" aria-checked={!modePhotos} class={!modePhotos ? 'actif' : ''} onClick={() => setMode('corps')}><Ic n="person" taille={15} />{txt.corps}</button>
    </div>

    {modePhotos ? <>
      {tri.length === 0
        ? <section class="m08-vide">
          <div class="m08-fantomes" aria-hidden="true">{POSES.map((p) => <span key={p}><Ic n="person" taille={24} /></span>)}</div>
          <p class="m08-vide-titre">{txt.videTitre}</p>
          <p class="m08-vide-texte">{txt.aidePhotos}</p>
        </section>
        : <Bandeau tri={tri} jours={jours} />}

      <Intervalle valeur={intervalle} onChange={setIntervalle} reste={reste} />

      {jours.length > 0 && <div class="m08-fil m08-fil-photos">
        {jours.slice().reverse().map((d, i, liste) => {
          const dernier = i === liste.length - 1;
          const ecart = dernier ? 0 : joursEntre(liste[i + 1], d);
          return <div key={d} class="m08-fil-ligne">
            <Rail dernier={dernier} ecart={ecart} />
            <section class="m08-fenetre">
              <div class="m08-jour-tete">
                <span class="m08-jour-date">{dateCourte(d)}</span>
                <span class="m08-jour-num">{txt.jour(joursEntre(premier, d) + 1)}</span>
                <button type="button" class="m08-jour-suppr" aria-label={txt.supprimerJour} onClick={() => setSupprJour(d)}><Ic n="trash" taille={15} /></button>
              </div>
              <div class="m08-pose-grille">
                {POSES.map((p) => {
                  const photo = tri.find((x) => x.date === d && x.pose === p);
                  const nom = T().comparer[p];
                  if (!photo) {
                    return <button key={p} type="button" class="m08-pose-tuile m08-pose-vide" aria-label={txt.pose(nom)} onClick={() => setCible({ date: d, pose: p })}>
                      <Ic n="plus" taille={16} /><span>{nom}</span>
                    </button>;
                  }
                  return <div key={p} class="m08-pose-tuile">
                    <button type="button" class="m08-pose-voir" onClick={() => setVoir(photo)} onContextMenu={(e) => { e.preventDefault(); setSupprPose(photo.id); }} aria-label={txt.pose(nom)}>
                      <img src={urlMedia(photo.id)} alt="" loading="lazy" />
                      <span class="m08-pose-nom">{nom}</span>
                    </button>
                    <button type="button" class="m08-pose-retirer" aria-label={txt.supprimerPoseTexte(nom)} onClick={() => setSupprPose(photo.id)}>
                      <Ic n="x" taille={13} />
                    </button>
                  </div>;
                })}
              </div>
            </section>
          </div>;
        })}
      </div>}

      <div class="m08-pied">
        <button type="button" class="btn pri large" onClick={() => setChoixPose(true)}><Ic n="plus:bold" taille={18} />{txt.ajouter}</button>
      </div>

      <input ref={camRef} type="file" accept="image/jpeg,image/png" capture="environment" hidden aria-label={T().photos.appareil} onChange={ajouter} />
      <input ref={galerieRef} type="file" accept="image/jpeg,image/png" hidden aria-label={T().photos.galerie} onChange={ajouter} />
      <Feuille ouverte={choixPose} fermer={() => setChoixPose(false)}>
        <div class="m08-choix-poses">
          {POSES.map((p) => <button key={p} type="button" class="m08-choix-pose" onClick={() => { setChoixPose(false); setCible({ date: idJour(), pose: p }); }}>
            <Ic n="person" taille={20} />{txt.pose(langue === 'en' ? T().comparer[p] : T().comparer[p].toLowerCase())}
          </button>)}
        </div>
      </Feuille>
      <Feuille ouverte={!!cible} fermer={() => setCible(null)} titre={T().photos.source}>
        <div class="options">
          <button type="button" class="m08-option" onClick={() => { prise.current = cible; setCible(null); camRef.current?.click(); }}><Ic n="device-mobile" taille={19} />{T().photos.appareil}</button>
          <button type="button" class="m08-option" onClick={() => { prise.current = cible; setCible(null); galerieRef.current?.click(); }}><Ic n="eye" taille={19} />{T().photos.galerie}</button>
        </div>
      </Feuille>
      <Dialogue ouvert={!!supprJour} fermer={() => setSupprJour(null)} titre={txt.supprimerJour} texte={txt.supprimerJourTexte}
        libelle={txt.supprimerJour} danger confirmer={supprimerJour} />
      <Dialogue ouvert={!!supprPose} fermer={() => setSupprPose(null)} titre={txt.supprimerPose} texte={txt.supprimerPoseTexte(T().comparer[poses.find((x) => x.id === supprPose)?.pose ?? 'face'])}
        libelle={txt.supprimerPose} danger confirmer={supprimerPose} />
      {voir && <Visionneuse moment={voir} fermer={() => setVoir(null)} />}
    </> : <CarteMusculaire intervalle={intervalle} onIntervalle={setIntervalle} seances={seances} />}
  </main>;
}

// Bandeau du haut (timeline_screen.dart _heroBand) : une seule journée, sa photo et l'aide ;
// deux journées ou plus, la première et la dernière côte à côte avec « Comparer ».
function Bandeau({ tri, jours }) {
  const txt = T().chronologie;
  const de = jours[0];
  const a = jours.at(-1);
  const premiere = (d) => tri.find((x) => x.date === d);
  if (jours.length < 2) {
    return <section class="m08-bandeau m08-bandeau-seul">
      <span class="m08-vignette" style="width:62px;height:82px"><img src={urlMedia(premiere(a).id)} alt="" /></span>
      <p class="m08-vide-texte">{txt.comparerAide}</p>
    </section>;
  }
  const commune = POSES.find((p) => tri.some((x) => x.date === de && x.pose === p) && tri.some((x) => x.date === a && x.pose === p));
  const photo = (d) => (commune ? tri.find((x) => x.date === d && x.pose === commune) : premiere(d));
  const contenu = <>
    <div class="m08-bandeau-photos">
      <span class="m08-vignette"><img src={urlMedia(photo(de).id)} alt="" /></span>
      <Ic n="arrow-right:bold" taille={16} />
      <span class="m08-vignette"><img src={urlMedia(photo(a).id)} alt="" /></span>
    </div>
    <div class="m08-bandeau-bas">
      <strong>{T().comparer.joursEcart(joursEntre(de, a))}</strong>
      {commune && <span class="m08-pilule">{txt.comparer}</span>}
    </div>
  </>;
  return commune ? <a class="m08-bandeau" href="#/comparer">{contenu}</a> : <section class="m08-bandeau">{contenu}</section>;
}

function Rail({ dernier, ecart }) {
  return <div class="m08-rail" aria-hidden="true">
    <span class="m08-rail-point" />
    {!dernier && <><span class="m08-rail-tirets" />{ecart > 0 && <em>{ecart}{langue === 'en' ? 'd' : 'j'}</em>}<span class="m08-rail-tirets" /></>}
  </div>;
}

// Rappel (photos) ou regroupement (carte musculaire) : rangée de segments en pilule, comme _intervalPicker.
function Intervalle({ corps, valeur, onChange, reste = null }) {
  const txt = T().chronologie;
  const [saisie, setSaisie] = useState(null);
  const titre = corps ? txt.regrouper : txt.rappeler;
  const perso = valeur > 0 && !INTERVALLES.includes(valeur);
  const valider = () => {
    const n = Math.round(Number(saisie));
    if (Number.isFinite(n) && n >= 1) onChange(Math.min(365, n));
    setSaisie(null);
  };
  return <div class="m08-intervalle">
    <div class="m08-rappel-tete">
      <Kicker>{`${titre} · ${txt.jours}`.toUpperCase()}</Kicker>
      {!corps && reste !== null && <span class={reste <= 0 ? 'm08-due' : 'm08-reste'}>{txt.prochaine(Math.max(0, reste))}</span>}
    </div>
    <div class="m08-segments" role="radiogroup" aria-label={`${titre} ${txt.jours}`}>
      {INTERVALLES.filter((j) => !corps || j > 0).map((j) => <Segment key={j} actif={valeur === j} label={j === 0 ? txt.jamais : txt.tousLes(j)} onClick={() => onChange(j)}>
        {j === 0 ? txt.jamais : j}
      </Segment>)}
      <Segment actif={perso} label={txt.personnalise} onClick={() => setSaisie(valeur > 0 ? valeur : 30)}>
        {perso ? valeur : txt.personnalise}
      </Segment>
    </div>
    <Dialogue ouvert={saisie !== null} fermer={() => setSaisie(null)} titre={titre} texte={txt.nbJours} libelle={t.commun.valider} confirmer={valider}>
      <Nombre valeur={saisie} onChange={setSaisie} label={txt.nbJours} decimales={false} classe="m08-saisie-jours" />
    </Dialogue>
  </div>;
}

const decale = (ms, n) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime(); };
const jourMs = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// Fenêtres de N jours (jour d'aujourd'hui inclus), de la plus récente à la plus ancienne.
// Comme GymMane : les fenêtres vides sont sautées (sauf la première), 12 au plus.
function calculerFenetres(seances, pas) {
  const jours = seances.map((s) => enDate(s.debut)).filter((d) => !Number.isNaN(d.getTime())).map(jourMs);
  if (!jours.length) return [];
  const premier = Math.min(...jours);
  const out = [];
  let fin = jourMs(new Date());
  while (fin >= premier && out.length < 12) {
    const debut = decale(fin, -(pas - 1));
    const nb = jours.filter((j) => j >= debut && j <= fin).length;
    if (nb > 0 || out.length === 0) out.push({ debut, fin, nb });
    fin = decale(debut, -1);
  }
  return out;
}

const niveaux = ['', ...RAMPE_HEAT.ember];

// Carte musculaire : une silhouette par fenêtre, chaleur construite depuis les séries.
function CarteMusculaire({ intervalle, onIntervalle, seances }) {
  const txt = T().chronologie;
  const pas = intervalle > 0 ? intervalle : 30;
  const fenetres = useMemo(() => calculerFenetres(seances, pas), [seances, pas]);

  if (!seances.length) {
    return <section class="m08-vide"><Ic n="person" taille={30} /><p class="m08-vide-texte">{txt.videCorps}</p></section>;
  }

  return <div class="m08-fenetres">
    <p class="m08-aide-corps">{txt.aideCorps}</p>
    <Intervalle corps valeur={intervalle} onChange={onIntervalle} />
    <div class="m08-legende" aria-hidden="true">
      <span>{txt.echelleBasse}</span>
      <span class="m08-legende-paliers">{[0, 1, 2, 3, 4].map((i) => <i key={i} style={`background:${i === 0 ? idle : niveaux[i]}`} />)}</span>
      <span>{txt.echelleHaute}</span>
    </div>
    <div class="m08-fil">
      {fenetres.map((f, i) => {
        const dernier = i === fenetres.length - 1;
        const ecart = dernier ? 0 : Math.round((f.fin - fenetres[i + 1].fin) / JOURS);
        return <div key={f.fin} class="m08-fil-ligne">
          <Rail dernier={dernier} ecart={ecart} />
          <section class="m08-fenetre">
            <div class="m08-fenetre-tete">
              <span class="m08-jour-date">{txt.fenetre(dateCourte(jourLocal(new Date(f.debut))), dateCourte(jourLocal(new Date(f.fin))))}</span>
              <span class="m08-fenetre-nb">{txt.seances(f.nb)}</span>
            </div>
            <div class="m08-fenetre-carte carte">
              <div style="width:100%;max-width:240px">
                <SilhouetteSvg mode="heat" vueInitiale="both" intensites={heatFenetre(seances, f.debut, decale(f.fin, 1) - 1)} ramp="ember" lang={langue} />
              </div>
            </div>
          </section>
        </div>;
      })}
    </div>
  </div>;
}

// Compte les séries de travail par muscle dans la fenêtre, puis étale sur 0..4.
function heatFenetre(seances, debutMs, finMs) {
  const compte = {};
  for (const s of seances) {
    const t = enDate(s.debut).getTime();
    if (Number.isNaN(t) || t < debutMs || t > finMs) continue;
    for (const e of s.donnees?.exercices ?? []) {
      const def = trouverExercice(e.ex);
      const mus = def?.muscle;
      if (!mus) continue;
      for (const ser of e.series ?? []) {
        if (ser.fait === false || ser.type === 'e') continue;
        compte[mus] = (compte[mus] ?? 0) + 1;
        for (const a of def.autres ?? []) compte[a] = (compte[a] ?? 0) + 0.5;
      }
    }
  }
  const max = Math.max(1, ...Object.values(compte));
  const out = {};
  for (const [k, v] of Object.entries(compte)) out[k] = Math.min(4, Math.ceil((v / max) * 4));
  return out;
}
