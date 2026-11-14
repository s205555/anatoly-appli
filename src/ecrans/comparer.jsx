// Comparer : portage 1:1 de compare_screen.dart. Deux photos côte à côte (zoom partagé, double appui pour revenir),
// écart en jours et en poids dessous, une rangée de dates pour la photo de départ et une pour celle d'arrivée.
import { useMemo, useRef, useState } from 'preact/hooks';
import { afficher, dateCourte, etat, nombre, unite, versAffichage } from '../donnees.js';
import { langue } from '../i18n.js';
import { m08, POSES } from '../i18n/m08.js';
import { EnTete, Ic, Rond } from '../ui.jsx';
import { joursEntre, lire, urlMedia } from './photos.jsx';
import './m08.css';

const CLE_POSES = 'an_m08_poses';
const T = () => m08(langue);
const dateAn = (j) => new Intl.DateTimeFormat(langue === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${j}T12:00:00`));

export function Comparer() {
  const txt = T().comparer;
  const poses = useMemo(() => lire(CLE_POSES, []), []);
  // posesWithBoth : seules les poses qui ont au moins deux dates.
  const avecPaire = POSES.filter((p) => new Set(poses.filter((x) => x.pose === p).map((x) => x.date)).size > 1);
  const [pose, setPose] = useState(avecPaire[0] ?? POSES[0]);
  const tri = useMemo(() => poses.filter((p) => p.pose === pose).sort((a, b) => (a.date < b.date ? -1 : 1)), [poses, pose]);
  const [de, setDe] = useState(null);
  const [a, setA] = useState(null);
  const [vue, setVue] = useState({ s: 1, x: 0, y: 0 });
  const gestes = useRef(new Map()), depart = useRef(null);

  if (tri.length < 2) {
    return <main class="ecran m08">
      <EnTete titre={txt.titre} retour="#/chronologie" />
      <p class="m08-aide">{txt.aucun}</p>
      <a class="btn pri large" href="#/chronologie">{txt.allerChronologie}</a>
    </main>;
  }

  const gauche = tri.find((m) => m.id === de) ?? tri[0];
  const droite = tri.find((m) => m.id === a) ?? tri[tri.length - 1];
  const ecart = Math.abs(joursEntre(gauche.date, droite.date));
  const poidsParJour = new Map((etat.value.poids ?? []).map((w) => [String(w.jour).slice(0, 10), w]));
  const p1 = poidsParJour.get(gauche.date), p2 = poidsParJour.get(droite.date);
  const delta = p1 && p2 ? Math.round((versAffichage(p2.kg) - versAffichage(p1.kg)) * 10) / 10 : null;
  const choisirPose = (p) => { setPose(p); setDe(null); setA(null); setVue({ s: 1, x: 0, y: 0 }); };
  const choisir = (poser) => (id) => { poser(id); setVue({ s: 1, x: 0, y: 0 }); };

  // InteractiveViewer partagé : pincer ou molette pour zoomer (1 à 5), glisser quand c'est zoomé.
  const borne = (v) => { const s = Math.min(5, Math.max(1, v.s)); const m = (s - 1) * 120; return { s, x: Math.max(-m, Math.min(m, v.x)), y: Math.max(-m, Math.min(m, v.y)) }; };
  const bas = (e) => { e.currentTarget.setPointerCapture(e.pointerId); gestes.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); depart.current = null; };
  const bouge = (e) => {
    const g = gestes.current; const avant = g.get(e.pointerId); if (!avant) return;
    if (g.size === 1 && vue.s > 1) setVue((v) => borne({ ...v, x: v.x + (e.clientX - avant.x), y: v.y + (e.clientY - avant.y) }));
    g.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.size === 2) { const [p, q] = [...g.values()]; const d = Math.hypot(q.x - p.x, q.y - p.y); if (!depart.current) depart.current = { d, s: vue.s }; else setVue((v) => borne({ ...v, s: depart.current.s * d / depart.current.d })); }
  };
  const haut = (e) => { gestes.current.delete(e.pointerId); depart.current = null; };
  const style = { transform: `translate(${vue.x}px, ${vue.y}px) scale(${vue.s})` };
  const cliche = (m) => <div class="cmp-cliche">
    <div class="cmp-cadre" onPointerDown={bas} onPointerMove={bouge} onPointerUp={haut} onPointerCancel={haut}
      onWheel={(e) => { e.preventDefault(); setVue((v) => borne({ ...v, s: v.s * (1 - e.deltaY * 0.002) })); }} onDblClick={() => setVue({ s: 1, x: 0, y: 0 })}>
      {m ? <img src={urlMedia(m.id)} alt="" style={style} draggable={false} /> : <Ic n="image-square" taille={22} />}
    </div>
    <span>{m ? dateAn(m.date) : ''}</span>
  </div>;

  const partager = async () => {
    try {
      const charge = (m) => new Promise((ok, ko) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = ko; i.src = urlMedia(m.id); });
      const [i1, i2] = await Promise.all([charge(gauche), charge(droite)]);
      const W = 1080, H = 1440, c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H);
      [i1, i2].forEach((im, k) => { const w = W / 2 - 6, s = Math.max(w / im.naturalWidth, H / im.naturalHeight); ctx.save(); ctx.beginPath(); ctx.rect(k * (W / 2 + 6), 0, w, H); ctx.clip(); ctx.drawImage(im, k * (W / 2 + 6) + (w - im.naturalWidth * s) / 2, (H - im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s); ctx.restore(); });
      const blob = await new Promise((ok) => c.toBlob(ok, 'image/png'));
      const f = new File([blob], 'anatoly-comparer.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], title: `${txt.titre} · ${txt.joursEcart(ecart)}` });
      else { const u = URL.createObjectURL(blob); const l = Object.assign(document.createElement('a'), { href: u, download: f.name }); document.body.append(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
    } catch (e) { if (e?.name !== 'AbortError') afficher(txt.partageEchec, 'danger'); }
  };

  const rangee = (choisi, poser, classe) => <div class={`cmp-dates ${classe}`} role="radiogroup">
    {tri.map((m) => <button key={m.id} type="button" role="radio" aria-checked={m.id === choisi.id} class={m.id === choisi.id ? 'on' : ''} onClick={() => poser(m.id)}>{dateCourte(m.date)}</button>)}
  </div>;

  return <main class="ecran m08 cmp">
    <EnTete titre={txt.titre} retour="#/chronologie" actions={<Rond n="share-network" label={txt.partager} onClick={partager} taille={44} icone={16} />} />
    {avecPaire.length > 1 && <div class="seg cmp-poses" role="radiogroup" aria-label={txt.pose}>
      {avecPaire.map((p) => <button key={p} type="button" role="radio" aria-checked={pose === p} aria-pressed={pose === p} onClick={() => choisirPose(p)}>{txt[p]}</button>)}
    </div>}
    <div class="cmp-paire">{cliche(gauche)}{cliche(droite)}</div>
    <div class="cmp-ecart">
      <strong>{txt.joursEcart(ecart)}</strong>
      {delta !== null && <span class={delta === 0 ? 'nul' : ''}>{delta > 0 ? '+' : ''}{nombre(delta, 1)} {unite()}</span>}
    </div>
    {rangee(gauche, choisir(setDe), 'de')}
    {rangee(droite, choisir(setA), 'a')}
  </main>;
}
